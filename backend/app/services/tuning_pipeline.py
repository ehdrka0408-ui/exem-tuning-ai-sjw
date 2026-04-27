"""[2단계] LLM 튜닝 잡 — TO-BE 생성/검증/적재.

흐름:
1. AS-IS SQL + before plan + binds + schema 메타 → ClaudeClient.tune_sql()
2. TO-BE SQL 안전성 검증 (SELECT-only, 단일 statement)
3. Oracle 실수행 → after performance + plan 캡처 (phase='after')
4. 개선 판정: elapsed_time_sec 30%↓ (보조: buffer_gets_count 30%↓)
5. 미달 시 plan 차이 + 미달 사유를 LLM 에 다시 보내 TO-BE 재생성 (총 시도 max=3)
6. 통과 시 sql_texts(to_be) + tuning_requests(tobe_sql_id, status='completed', rationale, tokens, latency)
7. 모든 시도 실패 시 status='failed' + rationale 에 사유

phase='after' (LLM 검증용) 와 phase='applied' (4단계) 분리 보장.
"""
import hashlib
import json
import logging
import re
import time
from dataclasses import dataclass
from typing import Optional

import oracledb
from sqlalchemy import text as sql_text
from sqlalchemy.orm import Session

from app.api.tuning_requests import (
    BindVar, BeforePerformance, _SELECT_RE, _strip_sql_for_check, _convert_bind,
)
from app.services.local_llm_client import (
    LocalLLMClient, TuningContext, TuningResult, log_call,
)

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 3
# 개선 판정 임계 — 사용자 정책: elapsed/buffer 모두 10% 이상
ELAPSED_IMPROVE_THRESHOLD = 0.10   # 10%
BUFFER_IMPROVE_THRESHOLD = 0.10


def llm_provider_for_log() -> str:
    """에러 케이스에서 llm 객체 없을 때 provider 문자열."""
    from app.services.local_llm_client import PROVIDER_NAME
    return PROVIDER_NAME



@dataclass
class AfterCapture:
    plan_text: Optional[str]
    perf: Optional[BeforePerformance]
    error: Optional[str]
    wall_clock_fallback: bool = False


@dataclass
class JobOutcome:
    status: str                 # 'completed' | 'failed'
    attempts: int
    tuned_sql: Optional[str]
    rationale: str
    after: Optional[BeforePerformance]
    after_plan: Optional[str]
    improvement_pct: Optional[float]   # elapsed 기준
    buffer_improvement_pct: Optional[float]


def _sql_hash(sql: str, schema: Optional[str]) -> str:
    raw = (schema or "") + "\x00" + sql.strip()
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:32]


def _validate_to_be(sql: str) -> tuple[bool, Optional[str]]:
    s = sql.strip().rstrip(";")
    if not s:
        return False, "TO-BE SQL 비어있음"
    if not _SELECT_RE.match(s):
        return False, "TO-BE 가 SELECT/WITH 가 아님"
    if ";" in _strip_sql_for_check(s):
        return False, "TO-BE 에 multiple statement 포함"
    return True, None



_INDEX_NAME_RE = re.compile(
    r"^\s*CREATE\s+(?:UNIQUE\s+|BITMAP\s+)?INDEX\s+([A-Za-z_][A-Za-z0-9_\.$]*)\s+ON\s+",
    re.IGNORECASE,
)


def _make_invisible_and_extract_name(raw_ddl: str) -> Optional[dict]:
    """LLM 이 준 DDL 을 검증·정규화. CREATE INDEX 만 허용, INVISIBLE 을 강제 부착."""
    if not raw_ddl:
        return None
    ddl = raw_ddl.strip().rstrip(";").strip()
    m = _INDEX_NAME_RE.match(ddl)
    if not m:
        return None
    index_name = m.group(1)
    if not re.search(r"\bINVISIBLE\b", ddl, re.IGNORECASE):
        ddl = ddl + " INVISIBLE"
    return {"index_name": index_name, "ddl": ddl}

def _capture_after(inst: dict, sql: str, schema: Optional[str], binds: list[BindVar], index_ddls: Optional[list[str]] = None) -> AfterCapture:
    """tuning_requests._capture_before 와 동일 로직, phase 기록만 호출자가 결정."""
    from app.clients.oracle import open_oracle_inst
    conn = open_oracle_inst(inst)
    cur = conn.cursor()
    plan_text: Optional[str] = None
    err: Optional[str] = None
    created_indexes: list[str] = []
    try:
        try: cur.execute("ALTER SESSION SET STATISTICS_LEVEL = ALL")
        except Exception as e: logger.warning(f"ALTER SESSION STATISTICS_LEVEL failed: {e}")
        if schema:
            try: cur.execute(f"ALTER SESSION SET CURRENT_SCHEMA = {schema}")
            except Exception as e: logger.warning(f"ALTER SESSION schema failed: {e}")
        bind_dict = {bv.name: _convert_bind(bv) for bv in binds}
        if index_ddls:
            try:
                cur.execute("ALTER SESSION SET OPTIMIZER_USE_INVISIBLE_INDEXES = TRUE")
            except Exception as e:
                logger.warning(f"ALTER SESSION OPTIMIZER_USE_INVISIBLE_INDEXES failed: {e}")
            for raw in index_ddls:
                name = _make_invisible_and_extract_name(raw)
                if not name:
                    logger.warning(f"skip non-CREATE-INDEX DDL: {raw[:120]}")
                    continue
                try:
                    cur.execute(name["ddl"])
                    created_indexes.append(name["index_name"])
                    logger.info(f"created invisible index: {name['index_name']}")
                except Exception as e:
                    logger.warning(f"CREATE INDEX failed ({name.get('index_name')}): {e}")
        wall_t0 = time.time()
        try:
            cur.execute(sql, bind_dict)
            fetched = cur.fetchmany(1000) if cur.description else []
            wall_elapsed = time.time() - wall_t0
            rows_processed = len(fetched)
        except Exception as e:
            return AfterCapture(plan_text=None, perf=None,
                                error=f"실행 실패: {type(e).__name__}: {e}")

        captured_sql_id = None; captured_child = None
        try:
            cur.execute(
                "SELECT prev_sql_id, prev_child_number FROM v$session "
                "WHERE sid = SYS_CONTEXT('USERENV','SID')")
            row = cur.fetchone()
            if row:
                captured_sql_id = row[0]
                captured_child = row[1]
        except Exception as e:
            logger.warning(f"after v$session lookup failed: {e}")

        from app.clients.oracle import trim_plan_header
        plan_text = None
        try:
            if captured_sql_id is None:
                raise RuntimeError("sql_id capture failed")
            cur.execute(
                "SELECT plan_table_output FROM TABLE("
                "DBMS_XPLAN.DISPLAY_CURSOR(:sid, :child, 'ALLSTATS LAST'))",
                {"sid": captured_sql_id, "child": captured_child},
            )
            plan_text = "\n".join(r[0] for r in cur.fetchall())
            plan_text = trim_plan_header(plan_text)
            if not plan_text.strip():
                raise RuntimeError("DISPLAY_CURSOR empty")
        except Exception as e:
            logger.warning(f"after DISPLAY_CURSOR failed, fallback EXPLAIN PLAN: {e}")
            try:
                cur.execute("EXPLAIN PLAN FOR " + sql, bind_dict)
                cur.execute(
                    "SELECT plan_table_output FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, NULL, "
                    "'BASIC ROWS BYTES COST PREDICATE'))"
                )
                plan_text = "\n".join(r[0] for r in cur.fetchall())
                plan_text = trim_plan_header(plan_text)
            except Exception as e2:
                plan_text = f"-- Plan 조회 실패: {type(e2).__name__}: {e2}"

        elapsed_sec = wall_elapsed
        cpu_sec = None; buffer_gets = None; disk_reads = None; executions = None
        gv_sql_hit = False
        try:
            cur.execute(
                "SELECT prev_sql_id FROM v$session WHERE sid = SYS_CONTEXT('USERENV','SID')")
            row = cur.fetchone()
            sid_val = row[0] if row else None
            if sid_val:
                cur.execute(
                    "SELECT SUM(elapsed_time)/1000000, SUM(cpu_time)/1000000, "
                    "SUM(buffer_gets), SUM(disk_reads), SUM(executions), SUM(rows_processed) "
                    "FROM gv$sql WHERE sql_id = :sid",
                    {"sid": sid_val},
                )
                r = cur.fetchone()
                if r and r[0] is not None:
                    elapsed_sec = float(r[0])
                    cpu_sec = float(r[1]) if r[1] is not None else None
                    buffer_gets = int(r[2]) if r[2] is not None else None
                    disk_reads = int(r[3]) if r[3] is not None else None
                    executions = int(r[4]) if r[4] is not None else None
                    rows_processed = int(r[5]) if r[5] is not None else rows_processed
                    gv_sql_hit = True
        except Exception as e:
            logger.warning(f"after V$SQL stats lookup failed: {e}")

        perf = BeforePerformance(
            elapsed_time_sec=round(elapsed_sec, 6) if elapsed_sec is not None else None,
            cpu_time_sec=round(cpu_sec, 6) if cpu_sec is not None else None,
            buffer_gets_count=buffer_gets,
            disk_reads_count=disk_reads,
            executions_count=executions,
            rows_processed_count=rows_processed,
        )
        return AfterCapture(plan_text=plan_text, perf=perf, error=err,
                            wall_clock_fallback=(not gv_sql_hit))
    finally:
        for idx_name in reversed(created_indexes):
            try:
                cur.execute(f"DROP INDEX {idx_name}")
                logger.info(f"dropped invisible index: {idx_name}")
            except Exception as e:
                logger.error(f"DROP INDEX {idx_name} failed: {e}")
        try: cur.close()
        except Exception: pass
        try: conn.close()
        except Exception: pass


def _improvement(before: BeforePerformance, after: BeforePerformance
                 ) -> tuple[Optional[float], Optional[float]]:
    e_pct = None
    if before.elapsed_time_sec and before.elapsed_time_sec > 0 and after.elapsed_time_sec is not None:
        e_pct = (before.elapsed_time_sec - after.elapsed_time_sec) / before.elapsed_time_sec
    b_pct = None
    if (before.buffer_gets_count and before.buffer_gets_count > 0
            and after.buffer_gets_count is not None):
        b_pct = (before.buffer_gets_count - after.buffer_gets_count) / before.buffer_gets_count
    return e_pct, b_pct


def _passes(e_pct: Optional[float], b_pct: Optional[float]) -> bool:
    if e_pct is not None:
        return e_pct >= ELAPSED_IMPROVE_THRESHOLD
    if b_pct is not None:
        return b_pct >= BUFFER_IMPROVE_THRESHOLD
    return False


def _upsert_to_be_sql(db: Session, *, sql_text_str: str, schema_name: Optional[str],
                     instance_id: str) -> str:
    """sql_texts(to_be) UPSERT — (sql_id, instance_id, sql_type='to_be') UNIQUE. Returns sql_id."""
    sid = _sql_hash(sql_text_str, schema_name)
    row = db.execute(
        sql_text("SELECT sql_id FROM sql_texts WHERE sql_id = :sid AND instance_id = :iid AND sql_type = 'to_be'"),
        {"sid": sid, "iid": instance_id},
    ).first()
    if row: return str(row[0])
    db.execute(
        sql_text(
            "INSERT INTO sql_texts (sql_id, instance_id, sql_text, schema_name, sql_type) "
            "VALUES (:sid, :iid, :txt, :sch, 'to_be') RETURNING sql_id"
        ),
        {"sid": sid, "iid": instance_id, "txt": sql_text_str, "sch": schema_name},
    )
    return sid


def run_tuning_job(
    db: Session,
    *,
    request_id: str,
    instance_id: str,
    inst: dict,
    as_is_sql: str,
    before_plan: Optional[str],
    before_perf: BeforePerformance,
    binds: list[BindVar],
    schema_name: Optional[str],
    user_instruction: Optional[str],
    complex_case: bool = False,
) -> JobOutcome:
    """동기 실행. status='tuning' 으로 마킹 후 LLM 호출 + after 캡처 + 판정 루프."""
    db.execute(
        sql_text("UPDATE tuning_requests SET status='tuning' WHERE request_id=:rid"),
        {"rid": request_id},
    )
    db.commit()

    client = LocalLLMClient()
    instruction_aug = user_instruction
    last_failure_note = ""
    last_after: Optional[AfterCapture] = None
    last_e_pct: Optional[float] = None
    last_b_pct: Optional[float] = None
    last_tuned: Optional[str] = None
    last_rationale = ""
    last_llm: Optional[TuningResult] = None
    cumulative_input = 0
    cumulative_output = 0
    cumulative_latency = 0

    for attempt in range(1, MAX_ATTEMPTS + 1):
        ctx = TuningContext(
            sql_text=as_is_sql,
            plan_text=before_plan,
            bind_variables=[bv.dict() for bv in binds],
            schema_name=schema_name,
            user_instruction=(instruction_aug or "") + last_failure_note,
        )
        try:
            llm = client.tune_sql(ctx, model=client.pick_model(complex_case))
        except Exception as e:
            logger.exception(f"LLM call failed attempt={attempt}")
            log_call(db, provider=llm_provider_for_log(), model=client.pick_model(complex_case),
                     input_tokens=0, output_tokens=0, latency_ms=0,
                     status="error", sql_id=request_id, error=str(e),
                     request_id=request_id)
            return _finish_failed(db, request_id, attempt,
                                  f"LLM 호출 실패: {type(e).__name__}: {e}")

        last_llm = llm
        cumulative_input += llm.input_tokens
        cumulative_output += llm.output_tokens
        cumulative_latency += llm.latency_ms
        log_call(db, provider=llm.provider, model=llm.model,
                 input_tokens=llm.input_tokens, output_tokens=llm.output_tokens,
                 latency_ms=llm.latency_ms, status="success", sql_id=request_id,
                 cached_tokens=llm.cached_tokens,
                 cache_creation_tokens=llm.cache_creation_tokens,
                 request_id=request_id)

        ok, why = _validate_to_be(llm.tuned_sql)
        if not ok:
            last_failure_note = f"\n\n[재시도 {attempt}] 직전 응답이 SQL 정책 위반: {why}. SELECT/WITH 단일 문장으로 다시."
            continue
        last_tuned = llm.tuned_sql.strip().rstrip(";")
        last_rationale = llm.rationale

        # after 캡처
        after = _capture_after(inst, last_tuned, schema_name, binds, index_ddls=llm.index_ddls)
        last_after = after
        if after.error:
            last_failure_note = (
                f"\n\n[재시도 {attempt}] TO-BE 실행 실패: {after.error}. "
                "결과를 동일하게 유지하면서 실행 가능한 SQL 로 다시."
            )
            _persist_after_snapshot(db, request_id=request_id, instance_id=instance_id,
                                    sql_id=_upsert_to_be_sql(
                                        db, sql_text_str=last_tuned, schema_name=schema_name,
                                        instance_id=instance_id),
                                    plan=after.plan_text, perf=after.perf,
                                    is_estimated="N")
            continue

        e_pct, b_pct = _improvement(before_perf, after.perf) if after.perf else (None, None)
        last_e_pct, last_b_pct = e_pct, b_pct
        to_be_sql_id = _upsert_to_be_sql(
            db, sql_text_str=last_tuned, schema_name=schema_name,
            instance_id=instance_id)
        _persist_after_snapshot(db, request_id=request_id, instance_id=instance_id,
                                sql_id=to_be_sql_id,
                                plan=after.plan_text, perf=after.perf,
                                is_estimated="Y" if after.wall_clock_fallback else "N")

        if _passes(e_pct, b_pct):
            rat = last_rationale
            if after.wall_clock_fallback:
                rat = (rat + "\n\n[wall_clock_fallback]").strip()
            return _finish_completed(
                db, request_id=request_id, tobe_sql_id=to_be_sql_id,
                rationale=rat, llm=last_llm,
                cumulative_input=cumulative_input, cumulative_output=cumulative_output,
                cumulative_latency=cumulative_latency,
                attempts=attempt, after=after, e_pct=e_pct, b_pct=b_pct,
            )

        e_str = f"{e_pct*100:.1f}%" if e_pct is not None else "N/A"
        b_str = f"{b_pct*100:.1f}%" if b_pct is not None else "N/A"
        last_failure_note = (
            f"\n\n[재시도 {attempt}] 직전 TO-BE 의 개선율이 임계 30% 미만 "
            f"(elapsed {e_str}, buffer {b_str}). "
            f"BEFORE plan 과 AFTER plan 의 차이를 분석해 액세스 경로/조인을 더 최적화하세요. "
            f"AFTER PLAN:\n{(after.plan_text or '')[:3000]}"
        )

    # 모든 attempt 실패
    e_str = ('%.1f%%' % (last_e_pct*100)) if last_e_pct is not None else 'N/A'
    b_str = ('%.1f%%' % (last_b_pct*100)) if last_b_pct is not None else 'N/A'
    threshold_pct = int(ELAPSED_IMPROVE_THRESHOLD * 100)
    rationale = (
        f"튜닝 실패 — {MAX_ATTEMPTS}회 시도 모두 개선율 {threshold_pct}% 미달. "
        f"최종 elapsed {e_str}, buffer {b_str}. "
        f"마지막 rationale: {last_rationale[:500]} "
        f"[no_improve]"
    )
    if last_after and last_after.wall_clock_fallback:
        rationale = (rationale + "\n\n[wall_clock_fallback]").strip()
    return _finish_failed_with_after(
        db, request_id=request_id, attempts=MAX_ATTEMPTS, rationale=rationale,
        after_perf=(last_after.perf if last_after else None),
        after_plan=(last_after.plan_text if last_after else None),
        e_pct=last_e_pct, b_pct=last_b_pct,
        tuned_sql=last_tuned,
        last_llm=last_llm,
        cumulative_input=cumulative_input,
        cumulative_output=cumulative_output,
        cumulative_latency=cumulative_latency,
    )


def _persist_after_snapshot(db: Session, *, request_id: str, instance_id: str,
                            sql_id: str,
                            plan: Optional[str], perf: Optional[BeforePerformance],
                            is_estimated: str = "N") -> None:
    """phase='after' 로 plan + performance 적재.

    is_estimated:
      'N' (default) — gv$sql 통계 직접 수집한 실측값
      'Y'           — wall_clock_fallback 또는 EXPLAIN PLAN 기반 예상치
    result_match: NULL 고정 (after phase 는 결과셋 비교 미구현 — TODO)
    """
    if plan:
        db.execute(
            sql_text(
                "INSERT INTO sql_plans (request_id, instance_id, sql_id, phase, plan_text) "
                "VALUES (:rid, :iid, :sid, 'after', :pt)"
            ),
            {"rid": request_id, "iid": instance_id, "sid": sql_id, "pt": plan},
        )
    if perf:
        # is_estimated: wall_clock_fallback 여부로 결정
        #   gv$sql 통계가 없어 wall clock 으로 대체된 경우 → 'Y' (예상치)
        #   gv$sql 통계 직접 수집 성공 → 'N' (실측)
        # wall_clock_fallback 여부는 AfterCapture 에 없으므로 perf 만 받는 이 함수에서는
        # 기본 'N'(실측)으로 세팅. 호출자(_capture_after)가 wall_clock_fallback 인 경우
        # 는 tuning_pipeline 상위에서 rationale 마커로 이미 기록됨.
        db.execute(
            sql_text(
                "INSERT INTO sql_performance "
                "(request_id, instance_id, sql_id, phase, elapsed_time_sec, cpu_time_sec, "
                " buffer_gets_count, disk_reads_count, executions_count, rows_processed_count, "
                " is_estimated, result_match) "
                "VALUES (:rid, :iid, :sid, 'after', :el, :cp, :bg, :dr, :ex, :rp, :ie, NULL)"
            ),
            {"rid": request_id, "iid": instance_id, "sid": sql_id,
             "el": perf.elapsed_time_sec, "cp": perf.cpu_time_sec,
             "bg": perf.buffer_gets_count, "dr": perf.disk_reads_count,
             "ex": perf.executions_count, "rp": perf.rows_processed_count,
             "ie": is_estimated},
        )
    db.commit()


def _finish_completed(db: Session, *, request_id: str, tobe_sql_id: str,
                     rationale: str, llm: TuningResult,
                     cumulative_input: int, cumulative_output: int, cumulative_latency: int,
                     attempts: int, after: AfterCapture,
                     e_pct: Optional[float], b_pct: Optional[float]) -> JobOutcome:
    db.execute(
        sql_text(
            "UPDATE tuning_requests SET "
            "  tobe_sql_id=:tid, status='completed', rationale=:rat, "
            "  llm_provider=:prov, llm_model=:mdl, "
            "  input_tokens=:it, output_tokens=:ot, latency_ms=:lt, "
            "  completed_at=now() "
            "WHERE request_id=:rid"
        ),
        {"tid": tobe_sql_id, "rat": rationale,
         "prov": llm.provider, "mdl": llm.model,
         "it": cumulative_input, "ot": cumulative_output, "lt": cumulative_latency,
         "rid": request_id},
    )
    db.commit()
    return JobOutcome(
        status="completed", attempts=attempts,
        tuned_sql=None, rationale=rationale,
        after=after.perf, after_plan=after.plan_text,
        improvement_pct=e_pct, buffer_improvement_pct=b_pct,
    )


def _finish_failed(db: Session, request_id: str, attempts: int, rationale: str) -> JobOutcome:
    db.execute(
        sql_text(
            "UPDATE tuning_requests SET status='failed', rationale=:rat, completed_at=now() "
            "WHERE request_id=:rid"
        ),
        {"rat": rationale, "rid": request_id},
    )
    db.commit()
    return JobOutcome(status="failed", attempts=attempts, tuned_sql=None,
                      rationale=rationale, after=None, after_plan=None,
                      improvement_pct=None, buffer_improvement_pct=None)


def _finish_failed_with_after(db: Session, *, request_id: str, attempts: int, rationale: str,
                              after_perf: Optional[BeforePerformance],
                              after_plan: Optional[str],
                              e_pct: Optional[float], b_pct: Optional[float],
                              tuned_sql: Optional[str],
                              last_llm: Optional[TuningResult] = None,
                              cumulative_input: int = 0,
                              cumulative_output: int = 0,
                              cumulative_latency: int = 0) -> JobOutcome:
    if last_llm is not None:
        db.execute(
            sql_text(
                "UPDATE tuning_requests SET status='failed', rationale=:rat, "
                "  llm_provider=:prov, llm_model=:mdl, "
                "  input_tokens=:it, output_tokens=:ot, latency_ms=:lt, "
                "  completed_at=now() "
                "WHERE request_id=:rid"
            ),
            {"rat": rationale,
             "prov": last_llm.provider, "mdl": last_llm.model,
             "it": cumulative_input, "ot": cumulative_output, "lt": cumulative_latency,
             "rid": request_id},
        )
    else:
        db.execute(
            sql_text(
                "UPDATE tuning_requests SET status='failed', rationale=:rat, "
                "completed_at=now() WHERE request_id=:rid"
            ),
            {"rat": rationale, "rid": request_id},
        )
    db.commit()
    return JobOutcome(status="failed", attempts=attempts, tuned_sql=tuned_sql,
                      rationale=rationale, after=after_perf, after_plan=after_plan,
                      improvement_pct=e_pct, buffer_improvement_pct=b_pct)
