"""[1단계] POST /api/tuning/requests — 튜닝 요청 등록 + before 캡처.

흐름:
1. sql_texts(as_is) UPSERT (sha1(sql_text+schema) 기반 sql_id)
2. tuning_requests INSERT (status='requested')
3. Oracle 실행: EXPLAIN PLAN + 실 SELECT → sql_plans(before), sql_performance(before)
4. binds → sql_bind_variables
5. 부분 실패 시 status='failed' 갱신, 응답 일관 유지

엄격:
- SELECT/WITH 만 허용. DDL/DML 즉시 거부
- 시간 단위는 Second, 카운트는 Count (컬럼명 suffix 일치)
- 단일 statement만 허용 (주석 제거 후 ; 검출)
"""
import hashlib
import logging
import re
import time
import uuid
from typing import Optional, Union

import oracledb
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import text as sql_text
from sqlalchemy.orm import Session

from app.api.oracle_top_sql import _get_oracle_instances
from app.db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["tuning_requests"])

_SELECT_RE = re.compile(r"^\s*(SELECT|WITH)\b", re.IGNORECASE)


# ── request_id 생성 헬퍼 ──
def _generate_request_id(db: Session) -> str:
    """TR-NNNNNN 형식의 request_id 생성 (시퀀스 기반)."""
    seq = db.execute(sql_text("SELECT nextval('tuning_request_seq')")).scalar()
    return f"TR-{seq:06d}"



# ── 요청/응답 모델 ──
class BindVar(BaseModel):
    name: str
    # 프론트가 number/bool/null 도 보낼 수 있도록 Union 허용
    value: Optional[Union[str, int, float, bool]] = None
    data_type: str = "VARCHAR2"
    position: Optional[int] = None


class TuningRequestBody(BaseModel):
    sql_text: str
    schema_name: Optional[str] = None
    instance_id: str
    binds: list[BindVar] = []
    user_instruction: Optional[str] = None
    source: str = "ui"
    alias: Optional[str] = None
    auto_tune: bool = False
    complex_case: bool = False
    parent_request_id: Optional[str] = None
    user_id: Optional[str] = None  # 요청자 식별 — 프론트가 보내면 적재
    # [그룹 단위 요청] 단건=새 group 1건, 일괄=프론트가 group_id 공유
    group_id: Optional[str] = None            # 기존 그룹에 추가 시 UUID 전달
    request_group_name: Optional[str] = None  # 새 그룹 생성 시 그룹명
    request_source: Optional[str] = None      # AWR / V$SQL / MG / DIRECT (미지정 시 자동 매핑)
    scheduled_at: Optional[str] = None        # 예약 시각(ISO-8601). 미지정 시 즉시 실행


class BeforePerformance(BaseModel):
    elapsed_time_sec: Optional[float] = None
    cpu_time_sec: Optional[float] = None
    buffer_gets_count: Optional[int] = None
    disk_reads_count: Optional[int] = None
    executions_count: Optional[int] = None
    rows_processed_count: Optional[int] = None


class BulkDeleteBody(BaseModel):
    ids: list[str] = Field(default_factory=list)


class BulkDeleteResponse(BaseModel):
    deleted_request_ids: list[str]
    deleted_sql_plans: int
    deleted_sql_performance: int
    deleted_llm_call_log: int = 0


class TuningRequestResponse(BaseModel):
    request_id: str
    status: str
    asis_sql_id: str
    before_performance: Optional[BeforePerformance] = None
    before_plan: Optional[str] = None
    message: Optional[str] = None
    user_id: Optional[str] = None
    # 2단계(auto_tune) 결과
    tuning_outcome: Optional[dict] = None


# ── 헬퍼 ──
def _sql_hash(sql: str, schema: Optional[str]) -> str:
    raw = (schema or "") + "\x00" + sql.strip()
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:32]


def _strip_sql_for_check(sql: str) -> str:
    s = re.sub(r"--[^\n]*", "", sql)
    s = re.sub(r"/\*[\s\S]*?\*/", "", s)
    return s


_TR_DATE_FORMATS = (
    "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d",
    "%Y/%m/%d %H:%M:%S", "%Y/%m/%d %H:%M", "%Y/%m/%d",
    "%Y.%m.%d %H:%M:%S", "%Y.%m.%d",
    "%d-%m-%Y %H:%M:%S", "%d-%m-%Y",
    "%d/%m/%Y %H:%M:%S", "%d/%m/%Y",
    "%m/%d/%Y %H:%M:%S", "%m/%d/%Y",
    "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f",
    "%Y%m%d", "%Y%m%d%H%M%S",
    "%d-%b-%y", "%d-%b-%Y",
)


def _tr_parse_date_like(v: str):
    from datetime import datetime
    for fmt in _TR_DATE_FORMATS:
        try:
            return datetime.strptime(v, fmt)
        except ValueError:
            continue
    return None


def _convert_bind(bv: BindVar):
    v = bv.value
    if v is None:
        return None
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return v
    if isinstance(v, bool):
        return 1 if v else 0
    s2 = str(v).strip()
    if not s2:
        return None
    t = (bv.data_type or "").upper()
    if t in ("NUMBER", "INT", "INTEGER", "FLOAT", "DECIMAL"):
        try:
            return float(s2) if "." in s2 else int(s2)
        except ValueError:
            return s2
    # 공격적 date 파싱: data_type 값과 무관하게 일단 시도. 프론트가 DATE 컬럼인데
    # 바인드 이력을 VARCHAR2 로 넘기는 케이스까지 방어 (ORA-01843 회피)
    parsed = _tr_parse_date_like(s2)
    if parsed is not None:
        return parsed
    return s2


def _resolve_instance(instance_id: str) -> Optional[dict]:
    # 1) id 기준 매칭
    for inst in _get_oracle_instances():
        if str(inst["id"]) == str(instance_id):
            return inst
    # 2) 폴백: name 으로도 찾기 (프론트가 instance_name 을 instance_id 슬롯에 넣어 보내는 케이스 대응)
    for inst in _get_oracle_instances():
        if inst.get("name") == instance_id:
            return inst
    return None


def _upsert_as_is_sql(db: Session, *, sql_text_str: str, schema_name: Optional[str],
                     instance_id: str) -> str:
    """sql_texts(as_is) UPSERT. (sql_id, instance_id, sql_type='as_is') UNIQUE 보장. Returns sql_id."""
    sid = _sql_hash(sql_text_str, schema_name)
    row = db.execute(
        sql_text("SELECT sql_id FROM sql_texts WHERE sql_id = :sid AND instance_id = :iid AND sql_type = 'as_is'"),
        {"sid": sid, "iid": instance_id},
    ).first()
    if row:
        return str(row[0])
    db.execute(
        sql_text(
            "INSERT INTO sql_texts (sql_id, instance_id, sql_text, schema_name, sql_type) "
            "VALUES (:sid, :iid, :txt, :sch, 'as_is') RETURNING sql_id"
        ),
        {"sid": sid, "iid": instance_id, "txt": sql_text_str, "sch": schema_name},
    )
    return sid


def _tr_inject_hint_and_marker(sql: str, marker: str) -> str:
    """튜닝 요청용 SQL 에 gather_plan_statistics + 유니크 marker 주입."""
    return re.sub(
        r"^(\s*)(SELECT|WITH)\b",
        rf"\1\2 /*+ gather_plan_statistics */ /* {marker} */ ",
        sql, count=1, flags=re.IGNORECASE,
    )


# 튜닝 요청 시 전체 fetch 를 위한 soft cap — 환경변수로 조정 가능
import os as _os
_TR_MAX_FETCH_ROWS = int(_os.getenv("TUNING_MAX_FETCH_ROWS", "10000000"))


def _capture_before(inst: dict, sql: str, schema: Optional[str], binds: list[BindVar]
                   ) -> tuple[Optional[str], Optional[BeforePerformance], Optional[str], bool]:
    """Oracle 접속 → statistics_level=ALL + gather_plan_statistics + 전체 fetch drain
    → DBMS_XPLAN.DISPLAY_CURSOR(ALLSTATS LAST) + V$SQL 통계 캡처.
    Returns: (plan_text, perf, error_msg, wall_clock_fallback).
    """
    from app.clients.oracle import open_oracle_inst
    conn = open_oracle_inst(inst)
    cur = conn.cursor()
    plan_text: Optional[str] = None
    perf: Optional[BeforePerformance] = None
    err: Optional[str] = None
    captured_sql_id: Optional[str] = None
    captured_child: Optional[int] = None
    try:
        # actual stats (A-Rows/A-Time/Buffers) 수집 — DISPLAY_CURSOR(ALLSTATS LAST) 활성화
        try:
            cur.execute("ALTER SESSION SET STATISTICS_LEVEL = ALL")
        except Exception as e:
            logger.warning(f"ALTER SESSION STATISTICS_LEVEL failed: {e}")
        if schema:
            try:
                cur.execute(f"ALTER SESSION SET CURRENT_SCHEMA = {schema}")
            except Exception as e:
                logger.warning(f"ALTER SESSION schema failed: {e}")

        # 실측 통계 수집 + NLS 포맷 (ORA-01843/ORA-01858 회피)
        try:
            cur.execute("ALTER SESSION SET statistics_level = ALL")
        except Exception as e:
            logger.warning(f"ALTER SESSION statistics_level failed: {e}")
        try:
            cur.execute("ALTER SESSION SET NLS_DATE_FORMAT = 'YYYY-MM-DD HH24:MI:SS'")
            cur.execute("ALTER SESSION SET NLS_TIMESTAMP_FORMAT = 'YYYY-MM-DD HH24:MI:SS.FF'")
        except Exception as e:
            logger.warning(f"ALTER SESSION NLS format failed: {e}")

        bind_dict = {bv.name: _convert_bind(bv) for bv in binds}
        logger.warning(
            f"tuning_capture_before SQL_PREVIEW={sql[:180]!r} "
            f"binds={[(bv.name, bv.data_type, bv.value) for bv in binds]} "
            f"converted={ {k: (type(v).__name__, str(v)[:40]) for k, v in bind_dict.items()} }"
        )

        marker = f"tuning_req_{uuid.uuid4().hex[:12]}"
        tagged_sql = _tr_inject_hint_and_marker(sql, marker)

        # 실 수행 — 전체 fetch + drain (ALLSTATS LAST 가 유의미하려면 cursor 가 끝까지 실행돼야 함)
        wall_t0 = time.time()
        try:
            cur.execute(tagged_sql, bind_dict)
            rows_processed = 0
            if cur.description:
                while True:
                    batch = cur.fetchmany(10_000)
                    if not batch:
                        break
                    rows_processed += len(batch)
                    if rows_processed >= _TR_MAX_FETCH_ROWS:
                        logger.warning(f"tuning fetch capped at {_TR_MAX_FETCH_ROWS}")
                        break
            wall_elapsed_sec = time.time() - wall_t0
        except Exception as e:
            err = f"실행 실패: {type(e).__name__}: {e}"
            logger.warning(f"tuning exec failed: {err}")
            return None, None, err, False

        # marker 로 cursor sql_id/child 캡처
        try:
            cur.execute(
                """
                SELECT sql_id, child_number FROM v$sql
                WHERE sql_text LIKE :m
                ORDER BY last_active_time DESC NULLS LAST, child_number DESC
                FETCH FIRST 1 ROWS ONLY
                """,
                {"m": f"%{marker}%"},
            )
            row = cur.fetchone()
            if row:
                captured_sql_id = row[0]
                captured_child = row[1]
        except Exception as e:
            logger.warning(f"v$sql marker lookup failed: {e}")

        sql_id_oracle = captured_sql_id

        # DBMS_XPLAN.DISPLAY_CURSOR ALLSTATS LAST — explicit sql_id
        try:
            if captured_sql_id:
                cur.execute(
                    "SELECT plan_table_output FROM TABLE("
                    "DBMS_XPLAN.DISPLAY_CURSOR(:sid, :child, 'ALLSTATS LAST'))",
                    {"sid": captured_sql_id, "child": captured_child},
                )
                plan_text = "\n".join(r[0] for r in cur.fetchall())
                from app.clients.oracle import trim_plan_header
                plan_text = trim_plan_header(plan_text)
                if not plan_text.strip():
                    raise RuntimeError("DISPLAY_CURSOR empty")
            else:
                raise RuntimeError("sql_id capture failed")
        except Exception as e:
            logger.warning(f"DISPLAY_CURSOR failed, fallback to EXPLAIN PLAN: {e}")
            try:
                cur.execute("EXPLAIN PLAN FOR " + sql, bind_dict)
                cur.execute(
                    "SELECT plan_table_output FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, NULL, "
                    "'BASIC ROWS BYTES COST PREDICATE'))"
                )
                plan_text = "\n".join(r[0] for r in cur.fetchall())
                from app.clients.oracle import trim_plan_header
                plan_text = trim_plan_header(plan_text)
            except Exception as e2:
                plan_text = f"-- Plan 조회 실패: {type(e2).__name__}: {e2}"

        elapsed_sec = wall_elapsed_sec
        cpu_sec = None
        buffer_gets = None
        disk_reads = None
        executions = None
        gv_sql_hit = False
        if sql_id_oracle:
            try:
                cur.execute(
                    "SELECT SUM(elapsed_time)/1000000, SUM(cpu_time)/1000000, "
                    "SUM(buffer_gets), SUM(disk_reads), SUM(executions), SUM(rows_processed) "
                    "FROM gv$sql WHERE sql_id = :sid",
                    {"sid": sql_id_oracle},
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
                logger.warning(f"V$SQL stats lookup failed: {e}")

        perf = BeforePerformance(
            elapsed_time_sec=round(elapsed_sec, 6) if elapsed_sec is not None else None,
            cpu_time_sec=round(cpu_sec, 6) if cpu_sec is not None else None,
            buffer_gets_count=buffer_gets,
            disk_reads_count=disk_reads,
            executions_count=executions,
            rows_processed_count=rows_processed,
        )
        return plan_text, perf, None, (not gv_sql_hit)
    finally:
        try: cur.close()
        except Exception: pass
        try: conn.close()
        except Exception: pass


# ── 메인 엔드포인트 ──
@router.post("/tuning/requests", response_model=TuningRequestResponse)
def create_tuning_request(body: TuningRequestBody, db: Session = Depends(get_db)) -> TuningRequestResponse:
    sql = body.sql_text.strip().rstrip(";")
    if not sql:
        raise HTTPException(400, "sql_text is empty")
    if not _SELECT_RE.match(sql):
        raise HTTPException(400, "Only SELECT / WITH queries are allowed")
    sql_no_comments = _strip_sql_for_check(sql)
    if ";" in sql_no_comments:
        raise HTTPException(400, "Multiple statements not allowed")

    inst = _resolve_instance(body.instance_id)
    if not inst:
        raise HTTPException(404, f"Oracle instance not found or inactive: {body.instance_id}")

    instance_id = str(inst["id"])

    # 1) sql_texts(as_is) UPSERT
    asis_sql_id = _upsert_as_is_sql(
        db, sql_text_str=sql, schema_name=body.schema_name, instance_id=instance_id,
    )

    # 2) tuning_request_group 처리 (무조건 먼저) —
    #   - body.group_id 있으면: 기존 그룹 존재 확인 + request_count +1
    #   - 없으면: 새 그룹 생성 (단건이든 일괄의 첫 건이든 동일 경로)
    _SRC_MAP = {
        "ui": "DIRECT", "api": "DIRECT", "direct": "DIRECT",
        "awr": "AWR", "v$sql": "V$SQL", "vsql": "V$SQL",
        "mg": "MG", "maxgauge": "MG",
    }
    if body.group_id:
        hit = db.execute(
            sql_text(
                "UPDATE tuning_request_group SET request_count = request_count + 1 "
                "WHERE group_id = CAST(:gid AS uuid) "
                "RETURNING group_id, request_group_name, request_source, scheduled_at"
            ),
            {"gid": body.group_id},
        ).first()
        if not hit:
            raise HTTPException(404, f"tuning_request_group not found: {body.group_id}")
        group_id         = str(hit[0])
        _grp_name        = hit[1]
        _grp_source      = hit[2]
        _grp_scheduled   = hit[3]
    else:
        _req_source = (body.request_source or _SRC_MAP.get((body.source or "").lower(), "DIRECT"))
        if _req_source not in ("AWR", "V$SQL", "MG", "DIRECT"):
            _req_source = "DIRECT"
        new_row = db.execute(
            sql_text(
                "INSERT INTO tuning_request_group "
                "(request_group_name, alias, instance_id, request_source, created_by, request_count, scheduled_at) "
                "VALUES (:name, :alias, :iid, :src, :cb, 1, :sa) "
                "RETURNING group_id, request_group_name, request_source, scheduled_at"
            ),
            {
                "name":  body.request_group_name or body.alias,
                "alias": body.alias,
                "iid":   int(instance_id),
                "src":   _req_source,
                "cb":    body.user_id or "system",
                "sa":    body.scheduled_at,
            },
        ).first()
        group_id         = str(new_row[0])
        _grp_name        = new_row[1]
        _grp_source      = new_row[2]
        _grp_scheduled   = new_row[3]

    # 3) tuning_requests INSERT — request_id 는 시퀀스 기반 생성
    request_id = _generate_request_id(db)
    db.execute(
        sql_text(
            "INSERT INTO tuning_requests "
            "(request_id, instance_id, asis_sql_id, source, status, user_instruction, alias, parent_request_id, user_id, group_id, request_group_name, request_source, scheduled_at) "
            "VALUES (:rid, :iid, :sid, :src, 'requested', :ui, :al, :pid, :uid, CAST(:gid AS uuid), :rgn, :rsrc, :sa)"
        ),
        {"rid": request_id, "iid": instance_id, "sid": asis_sql_id, "src": body.source,
         "ui": body.user_instruction, "al": body.alias,
         "pid": body.parent_request_id, "uid": body.user_id, "gid": group_id, "rgn": _grp_name, "rsrc": _grp_source, "sa": _grp_scheduled},
    )

    # 4) sql_bind_variables (Oracle 접속 전 적재)
    for bv in body.binds:
        db.execute(
            sql_text(
                "INSERT INTO sql_bind_variables (request_id, sql_id, instance_id, name, data_type, value, position) "
                "VALUES (:rid, :sid, :iid, :n, :dt, :v, :p)"
            ),
            {"rid": request_id, "sid": asis_sql_id, "iid": instance_id, "n": bv.name, "dt": bv.data_type,
             "v": (None if bv.value is None else str(bv.value)),
             "p": bv.position or 0},
        )
    db.commit()

    # 3) Oracle 실 캡처
    try:
        plan, perf, exec_err, before_fallback = _capture_before(inst, sql, body.schema_name, body.binds)
    except Exception as e:
        logger.exception("before capture failed")
        db.execute(
            sql_text("UPDATE tuning_requests SET status='failed' WHERE request_id=:rid"),
            {"rid": request_id},
        )
        db.commit()
        raise HTTPException(500, f"Oracle capture failed: {type(e).__name__}: {e}")

    # 5) 캡처 결과 적재
    if plan:
        db.execute(
            sql_text(
                "INSERT INTO sql_plans (request_id, instance_id, sql_id, phase, plan_text) "
                "VALUES (:rid, :iid, :sid, 'before', :pt)"
            ),
            {"rid": request_id, "iid": instance_id, "sid": asis_sql_id, "pt": plan},
        )
    if perf:
        db.execute(
            sql_text(
                "INSERT INTO sql_performance "
                "(request_id, instance_id, sql_id, phase, elapsed_time_sec, cpu_time_sec, "
                " buffer_gets_count, disk_reads_count, executions_count, rows_processed_count, "
                " is_estimated, result_match) "
                "VALUES (:rid, :iid, :sid, 'before', :el, :cp, :bg, :dr, :ex, :rp, 'N', NULL)"
            ),
            {"rid": request_id, "iid": instance_id, "sid": asis_sql_id,
             "el": perf.elapsed_time_sec, "cp": perf.cpu_time_sec,
             "bg": perf.buffer_gets_count, "dr": perf.disk_reads_count,
             "ex": perf.executions_count, "rp": perf.rows_processed_count},
        )

    if exec_err:
        db.execute(
            sql_text("UPDATE tuning_requests SET status='failed' WHERE request_id=:rid"),
            {"rid": request_id},
        )
        db.commit()
        return TuningRequestResponse(
            request_id=request_id, status="failed", asis_sql_id=asis_sql_id,
            before_plan=plan, before_performance=perf, message=exec_err,
        )

    db.commit()
    # before 캡처가 wall-clock fallback 사용한 경우 마커 append
    if before_fallback:
        db.execute(
            sql_text("UPDATE tuning_requests SET rationale = "
                     "COALESCE(rationale, '') || '\n\n[wall_clock_fallback]' "
                     "WHERE request_id = :rid"),
            {"rid": request_id},
        )
        db.commit()
    # auto_tune=True 면 즉시 2단계 실행
    outcome_dict = None
    final_status = "requested"
    if body.auto_tune:
        from app.services.tuning_pipeline import run_tuning_job
        try:
            outcome = run_tuning_job(
                db, request_id=request_id, instance_id=instance_id,
                inst=inst, as_is_sql=sql,
                before_plan=plan, before_perf=perf or BeforePerformance(),
                binds=body.binds, schema_name=body.schema_name,
                user_instruction=body.user_instruction,
                complex_case=body.complex_case,
            )
            outcome_dict = {
                "attempts": outcome.attempts,
                "rationale": outcome.rationale,
                "improvement_pct": outcome.improvement_pct,
                "buffer_improvement_pct": outcome.buffer_improvement_pct,
                "after": outcome.after.dict() if outcome.after else None,
                "after_plan": outcome.after_plan,
            }
            final_status = outcome.status
        except Exception as e:
            logger.exception("auto_tune failed")
            db.execute(sql_text(
                "UPDATE tuning_requests SET status='failed', rationale=:r WHERE request_id=:i"
            ), {"r": f"파이프라인 실패: {type(e).__name__}: {e}", "i": request_id})
            db.commit()
            final_status = "failed"
            outcome_dict = {"error": f"{type(e).__name__}: {e}"}
    return TuningRequestResponse(
        request_id=request_id, status=final_status, asis_sql_id=asis_sql_id,
        before_performance=perf, before_plan=plan,
        tuning_outcome=outcome_dict,
    )


@router.get("/tuning/requests")
def list_tuning_requests(
    status: Optional[list[str]] = Query(default=None),
    source: Optional[str] = None,
    schema_name: Optional[str] = None,
    instance_id: Optional[str] = None,
    from_date: Optional[str] = None,    # ISO 8601
    to_date: Optional[str] = None,      # ISO 8601
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[dict]:
    """튜닝 요청 목록 — 프론트 WorkPipeline 용 요약 형식."""
    where = []
    params: dict = {"limit": limit, "offset": offset}
    if status:
        ph = ", ".join(f":st_{i}" for i, _ in enumerate(status))
        where.append(f"r.status IN ({ph})")
        for i, st in enumerate(status):
            params[f"st_{i}"] = st
    if source:
        where.append("r.source = :src"); params["src"] = source
    if schema_name:
        where.append("st.schema_name = :sch"); params["sch"] = schema_name
    if instance_id:
        where.append("r.instance_id = :inst_id"); params["inst_id"] = instance_id
    if from_date:
        where.append("r.requested_at >= :from_dt"); params["from_dt"] = from_date
    if to_date:
        where.append("r.requested_at <= :to_dt"); params["to_dt"] = to_date
    where_clause = ("WHERE " + " AND ".join(where)) if where else ""

    q = f"""
        SELECT r.request_id, r.status, r.source, r.asis_sql_id, r.tobe_sql_id,
               substring(st.sql_text from 1 for 100) AS source_sql_text_preview,
               r.parent_request_id,
               st.schema_name, r.instance_id,
               r.requested_at, r.completed_at,
               r.llm_provider, r.llm_model, r.rationale,
               (
                 SELECT b.elapsed_time_sec FROM sql_performance b
                 WHERE b.request_id = r.request_id AND b.phase = 'before'
                 ORDER BY b.captured_at LIMIT 1
               ) AS before_elapsed_sec,
               (
                 SELECT a.elapsed_time_sec FROM sql_performance a
                 WHERE a.request_id = r.request_id AND a.phase IN ('after','applied')
                 ORDER BY a.captured_at DESC LIMIT 1
               ) AS after_elapsed_sec,
               (
                 SELECT b.buffer_gets_count FROM sql_performance b
                 WHERE b.request_id = r.request_id AND b.phase = 'before'
                 ORDER BY b.captured_at LIMIT 1
               ) AS before_buffer_gets,
               (
                 SELECT a.buffer_gets_count FROM sql_performance a
                 WHERE a.request_id = r.request_id AND a.phase IN ('after','applied')
                 ORDER BY a.captured_at DESC LIMIT 1
               ) AS after_buffer_gets,
               r.asis_sql_id AS asis_sql_id_hash,
               r.tobe_sql_id AS tobe_sql_id_hash,
               r.alias,
               st.sql_text AS source_sql_text_full,
               di.name AS instance_name
        FROM tuning_requests r
        LEFT JOIN sql_texts st ON st.sql_id = r.asis_sql_id AND st.instance_id = r.instance_id AND st.sql_type = 'as_is'
        LEFT JOIN db_instances di ON di.instance_id = r.instance_id
        {where_clause}
        ORDER BY r.requested_at DESC
        LIMIT :limit OFFSET :offset
    """
    rows = db.execute(sql_text(q), params).fetchall()
    out: list[dict] = []
    for r in rows:
        rationale = r[13] or ""
        before = float(r[14]) if r[14] is not None else None
        after = float(r[15]) if r[15] is not None else None
        improvement_pct = None
        if before and before > 0 and after is not None:
            improvement_pct = (before - after) / before
        out.append({
            "id": r[0],                  # request_id (프론트 호환)
            "request_id": r[0],
            "status": r[1],
            "source": r[2],
            "asis_sql_id": r[3],
            "tobe_sql_id": r[4],
            "source_sql_text_preview": r[5],
            "parent_request_id": r[6],
            "schema_name": r[7],
            "instance_id": r[8],
            "instance_name": r[22] if r[22] is not None else str(r[8]),
            "requested_at": str(r[9]) if r[9] else None,
            "completed_at": str(r[10]) if r[10] else None,
            "llm_provider": r[11],
            "llm_model": r[12],
            "improvement_pct": (round(improvement_pct, 4) if improvement_pct is not None else None),
            "is_no_improve": "[no_improve]" in rationale,
            "is_wall_clock_fallback": "[wall_clock_fallback]" in rationale,
            "rationale": rationale,
            "before_elapsed_sec": before,
            "after_elapsed_sec": after,
            "before_buffer_gets": int(r[16]) if r[16] is not None else None,
            "after_buffer_gets": int(r[17]) if r[17] is not None else None,
            "asis_sql_id_hash": r[18],
            "tobe_sql_id_hash": r[19],
            "alias": r[20],
            "source_sql_text": r[21],
        })
    return out


@router.post("/tuning/requests/delete", response_model=BulkDeleteResponse)
def delete_tuning_requests(body: BulkDeleteBody, db: Session = Depends(get_db)) -> BulkDeleteResponse:
    """선택된 tuning_requests 를 일괄 삭제."""
    if not body.ids:
        return BulkDeleteResponse(deleted_request_ids=[], deleted_sql_plans=0, deleted_sql_performance=0, deleted_llm_call_log=0)

    # 1) 대상 + 모든 descendant 수집
    desc_rows = db.execute(
        sql_text(
            """
            WITH RECURSIVE descendants(request_id) AS (
                SELECT request_id FROM tuning_requests WHERE request_id = ANY(:ids)
                UNION
                SELECT tr.request_id FROM tuning_requests tr
                JOIN descendants d ON tr.parent_request_id = d.request_id
            )
            SELECT request_id FROM descendants
            """
        ),
        {"ids": body.ids},
    ).fetchall()
    all_ids = [str(r[0]) for r in desc_rows]
    if not all_ids:
        return BulkDeleteResponse(deleted_request_ids=[], deleted_sql_plans=0, deleted_sql_performance=0, deleted_llm_call_log=0)

    # 2) 자식 테이블 먼저 삭제
    plans_deleted = db.execute(
        sql_text("DELETE FROM sql_plans WHERE request_id = ANY(:ids)"),
        {"ids": all_ids},
    ).rowcount or 0
    perf_deleted = db.execute(
        sql_text("DELETE FROM sql_performance WHERE request_id = ANY(:ids)"),
        {"ids": all_ids},
    ).rowcount or 0
    llm_log_deleted = db.execute(
        sql_text("DELETE FROM llm_call_log WHERE request_id = ANY(:ids)"),
        {"ids": all_ids},
    ).rowcount or 0

    # 3) tuning_requests 내부 self-ref 제거
    db.execute(
        sql_text("UPDATE tuning_requests SET parent_request_id = NULL "
                 "WHERE parent_request_id = ANY(:ids)"),
        {"ids": all_ids},
    )

    # 4) 본체 삭제
    db.execute(
        sql_text("DELETE FROM tuning_requests WHERE request_id = ANY(:ids)"),
        {"ids": all_ids},
    )
    db.commit()

    logger.info(
        f"delete_tuning_requests requested={body.ids} expanded={all_ids} "
        f"plans={plans_deleted} perf={perf_deleted} llm_call_log={llm_log_deleted}"
    )
    return BulkDeleteResponse(
        deleted_request_ids=all_ids,
        deleted_sql_plans=plans_deleted,
        deleted_sql_performance=perf_deleted,
        deleted_llm_call_log=llm_log_deleted,
    )


@router.get("/tuning/requests/{request_id}")
def get_tuning_request(request_id: str, db: Session = Depends(get_db)) -> dict:
    """튜닝 요청 단건 조회 — 폴링용."""
    row = db.execute(
        sql_text(
            "SELECT request_id, asis_sql_id, tobe_sql_id, status, rationale, "
            "       llm_provider, llm_model, input_tokens, output_tokens, latency_ms, "
            "       requested_at, completed_at, instance_id, user_id "
            "FROM tuning_requests WHERE request_id = :rid"
        ),
        {"rid": request_id},
    ).first()
    if not row:
        raise HTTPException(404, f"request not found: {request_id}")
    keys = ["request_id","asis_sql_id","tobe_sql_id","status","rationale","llm_provider",
            "llm_model","input_tokens","output_tokens","latency_ms",
            "requested_at","completed_at","instance_id","user_id"]
    base = {k: (str(v) if "_at" in k and v is not None else v) for k, v in zip(keys, row)}
    # 프론트 하위호환: id = request_id
    base["id"] = base["request_id"]
    instance_id = base["instance_id"]
    # AS-IS / TO-BE SQL 본문 — 프론트 Diff 표시용
    base["source_sql_text"] = (
        db.execute(sql_text("SELECT sql_text FROM sql_texts WHERE sql_id=:sid AND instance_id=:iid AND sql_type='as_is' LIMIT 1"),
                   {"sid": base["asis_sql_id"], "iid": instance_id}).scalar()
        if base.get("asis_sql_id") else None
    )
    base["tuned_sql_text"] = (
        db.execute(sql_text("SELECT sql_text FROM sql_texts WHERE sql_id=:sid AND instance_id=:iid AND sql_type='to_be' LIMIT 1"),
                   {"sid": base["tobe_sql_id"], "iid": instance_id}).scalar()
        if base.get("tobe_sql_id") else None
    )
    perf_rows = db.execute(
        sql_text(
            "SELECT phase, elapsed_time_sec, cpu_time_sec, buffer_gets_count, "
            "       disk_reads_count, executions_count, rows_processed_count, captured_at, "
            "       is_estimated, result_match "
            "FROM sql_performance WHERE request_id = :rid ORDER BY captured_at"
        ), {"rid": request_id},
    ).fetchall()
    pkeys = ["phase","elapsed_time_sec","cpu_time_sec","buffer_gets_count",
             "disk_reads_count","executions_count","rows_processed_count","captured_at",
             "is_estimated","result_match"]
    base["performance"] = [
        {k: (str(v) if k=="captured_at" and v is not None else (float(v) if isinstance(v, (int,float)) and k.endswith("_sec") else v))
         for k, v in zip(pkeys, r)} for r in perf_rows
    ]
    plan_rows = db.execute(
        sql_text("SELECT phase, plan_text, captured_at FROM sql_plans "
                 "WHERE request_id = :rid ORDER BY captured_at"), {"rid": request_id},
    ).fetchall()
    base["plans"] = [
        {"phase": r[0], "plan_text": r[1], "captured_at": str(r[2])} for r in plan_rows
    ]
    # bind variables
    bind_rows = db.execute(
        sql_text("SELECT name, data_type, value, position FROM sql_bind_variables "
                 "WHERE request_id = :rid AND sql_id = :sid AND instance_id = :iid "
                 "ORDER BY position, captured_at"),
        {"rid": base["request_id"], "sid": base["asis_sql_id"], "iid": instance_id},
    ).fetchall() if base.get("asis_sql_id") else []
    base["bind_variables"] = [
        {"name": r[0], "data_type": r[1], "value": r[2], "position": r[3]}
        for r in bind_rows
    ]
    return base


# ── [3] 승인 / [4] 적용 ──

_NEXT_FROM = {
    "approved": "completed",
    "applied": "approved",
    "rejected": "completed",
}


def _enforce_transition(db: Session, request_id: str, target: str) -> dict:
    row = db.execute(
        sql_text(
            "SELECT request_id, asis_sql_id, tobe_sql_id, status, instance_id FROM tuning_requests WHERE request_id=:rid"
        ),
        {"rid": request_id},
    ).first()
    if not row:
        raise HTTPException(404, f"request not found: {request_id}")
    rec = {"request_id": row[0], "asis_sql_id": row[1], "tobe_sql_id": row[2], "status": row[3], "instance_id": row[4]}
    required = _NEXT_FROM[target]
    if rec["status"] != required:
        raise HTTPException(
            409, f"invalid transition: status={rec['status']}, required={required} for {target}"
        )
    return rec


@router.patch("/tuning/requests/{request_id}/approve")
def approve_tuning_request(request_id: str, db: Session = Depends(get_db)) -> dict:
    rec = _enforce_transition(db, request_id, "approved")
    if not rec["tobe_sql_id"]:
        raise HTTPException(409, "tobe_sql_id is null — cannot approve")
    db.execute(
        sql_text("UPDATE tuning_requests SET status='approved' WHERE request_id=:rid"),
        {"rid": request_id},
    )
    db.commit()
    return {"request_id": request_id, "status": "approved"}


class RejectBody(BaseModel):
    reason: str


@router.patch("/tuning/requests/{request_id}/reject")
def reject_tuning_request(request_id: str, body: RejectBody, db: Session = Depends(get_db)) -> dict:
    rec = _enforce_transition(db, request_id, "rejected")
    reason = (body.reason or "").strip()
    if not reason:
        raise HTTPException(400, "reason is required")
    db.execute(
        sql_text(
            "UPDATE tuning_requests SET status='rejected', "
            "rationale = COALESCE(rationale, '') || :marker "
            "WHERE request_id=:rid"
        ),
        {"rid": request_id, "marker": f" [reject:{reason}]"},
    )
    db.commit()
    return {"request_id": request_id, "status": "rejected", "reason": reason}


class ApplyResponse(BaseModel):
    request_id: str
    status: str
    applied_performance: Optional[BeforePerformance] = None
    applied_plan: Optional[str] = None
    message: Optional[str] = None


class ApplyBody(BaseModel):
    instance_id: Optional[str] = None
    schema_name: Optional[str] = None


def _resolve_instance_by_name(name: Optional[str]) -> Optional[dict]:
    if not name: return None
    for inst in _get_oracle_instances():
        if inst.get("name") == name: return inst
    return None


@router.post("/tuning/requests/{request_id}/apply", response_model=ApplyResponse)
def apply_tuning_request(request_id: str, body: ApplyBody = ApplyBody(),
                        db: Session = Depends(get_db)) -> ApplyResponse:
    rec = _enforce_transition(db, request_id, "applied")
    if not rec["tobe_sql_id"]:
        raise HTTPException(409, "tobe_sql_id is null — cannot apply")

    instance_id = rec["instance_id"]

    row = db.execute(
        sql_text(
            "SELECT sql_text, schema_name FROM sql_texts WHERE sql_id=:sid AND instance_id=:iid AND sql_type='to_be' LIMIT 1"
        ),
        {"sid": rec["tobe_sql_id"], "iid": instance_id},
    ).first()
    if not row:
        raise HTTPException(500, f"to_be sql_text not found: sql_id={rec['tobe_sql_id']}")
    to_be_sql, to_be_schema = row[0], row[1]

    inst = None
    if body.instance_id:
        inst = _resolve_instance(body.instance_id)
    if inst is None:
        inst = _resolve_instance(instance_id)
    if inst is None:
        raise HTTPException(404, f"Oracle instance not found for apply: instance_id={instance_id}")

    schema = body.schema_name or to_be_schema

    bind_rows = db.execute(
        sql_text(
            "SELECT name, data_type, value, position FROM sql_bind_variables "
            "WHERE request_id=:rid AND sql_id=:sid AND instance_id=:iid "
            "ORDER BY position, captured_at"
        ),
        {"rid": rec["request_id"], "sid": rec["asis_sql_id"], "iid": instance_id},
    ).fetchall()
    binds = [BindVar(name=r[0], data_type=r[1] or "VARCHAR2", value=r[2], position=r[3]) for r in bind_rows]

    from app.services.tuning_pipeline import _capture_after
    cap = _capture_after(inst, to_be_sql.strip().rstrip(";"), schema, binds)
    if cap.error:
        db.execute(
            sql_text("UPDATE tuning_requests SET status='failed' WHERE request_id=:rid"),
            {"rid": request_id},
        )
        db.commit()
        return ApplyResponse(
            request_id=request_id, status="failed",
            applied_performance=cap.perf, applied_plan=cap.plan_text,
            message=cap.error,
        )

    if cap.plan_text:
        db.execute(
            sql_text(
                "INSERT INTO sql_plans (request_id, instance_id, sql_id, phase, plan_text) "
                "VALUES (:rid, :iid, :sid, 'applied', :pt)"
            ),
            {"rid": request_id, "iid": instance_id, "sid": rec["tobe_sql_id"], "pt": cap.plan_text},
        )
    if cap.perf:
        db.execute(
            sql_text(
                "INSERT INTO sql_performance "
                "(request_id, instance_id, sql_id, phase, elapsed_time_sec, cpu_time_sec, "
                " buffer_gets_count, disk_reads_count, executions_count, rows_processed_count, "
                " is_estimated, result_match) "
                "VALUES (:rid, :iid, :sid, 'applied', :el, :cp, :bg, :dr, :ex, :rp, 'N', NULL)"
            ),
            {"rid": request_id, "iid": instance_id, "sid": rec["tobe_sql_id"],
             "el": cap.perf.elapsed_time_sec, "cp": cap.perf.cpu_time_sec,
             "bg": cap.perf.buffer_gets_count, "dr": cap.perf.disk_reads_count,
             "ex": cap.perf.executions_count, "rp": cap.perf.rows_processed_count},
        )

    db.execute(
        sql_text("UPDATE tuning_requests SET status='applied' WHERE request_id=:rid"),
        {"rid": request_id},
    )
    db.commit()

    return ApplyResponse(
        request_id=request_id, status="applied",
        applied_performance=cap.perf, applied_plan=cap.plan_text,
    )
