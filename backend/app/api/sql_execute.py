"""직접 입력 SQL 실행 + DBMS_XPLAN Plan 조회 API.

실행 전에 `ALTER SESSION SET statistics_level = ALL` 을 걸고, 실행 직후 같은 세션에서
`DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'ALLSTATS LAST')` 로 실측 A-Rows/Buffers 가
포함된 실행계획을 수집한다.
"""
import logging, re, time, uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import oracledb

from app.api.oracle_top_sql import _get_oracle_instances

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/sql", tags=["sql_execute"])


class BindVar(BaseModel):
    name: str
    value: Optional[str] = None
    data_type: str = "VARCHAR2"


class ExecuteBody(BaseModel):
    instance_id: str
    schema: Optional[str] = None
    sql: str
    bind_vars: list[BindVar] = []
    # row_limit 가 None(미전송)이면 전체 조회
    row_limit: Optional[int] = Field(default=200, ge=1)


_SELECT_RE = re.compile(r"^\s*(SELECT|WITH)\b", re.IGNORECASE)


def _inject_hint_and_marker(sql: str, marker: str) -> str:
    """SELECT/WITH 직후에 gather_plan_statistics 힌트 + 고유 marker 주석 주입.
    - gather_plan_statistics : 세션 statistics_level 에 관계없이 ALLSTATS 캡처 보장
    - marker : v$sql 에서 해당 cursor 를 유일하게 식별하기 위한 tag
    """
    return re.sub(
        r"^(\s*)(SELECT|WITH)\b",
        rf"\1\2 /*+ gather_plan_statistics */ /* {marker} */ ",
        sql, count=1, flags=re.IGNORECASE,
    )


_DATE_FORMATS = (
    "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d",
    "%Y/%m/%d %H:%M:%S", "%Y/%m/%d %H:%M", "%Y/%m/%d",
    "%Y.%m.%d %H:%M:%S", "%Y.%m.%d",
    "%d-%m-%Y %H:%M:%S", "%d-%m-%Y",
    "%d/%m/%Y %H:%M:%S", "%d/%m/%Y",
    "%m/%d/%Y %H:%M:%S", "%m/%d/%Y",
    "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f",
    "%Y%m%d", "%Y%m%d%H%M%S",
)


def _parse_date_like(v: str):
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(v, fmt)
        except ValueError:
            continue
    return None


def _convert_bind(bv: BindVar):
    v = (bv.value or "").strip()
    if not v:
        return None
    t = (bv.data_type or "").upper()
    if t in ("NUMBER", "INT", "INTEGER", "FLOAT", "DECIMAL"):
        try:
            return float(v) if "." in v else int(v)
        except ValueError:
            return v
    # 공격적 date 파싱: data_type 무시하고 일단 시도 → 성공하면 datetime 으로 바인드
    # (ORA-01843 회피. 문자열이어도 DB 컬럼이 DATE 면 Oracle implicit conversion 대신
    # Python datetime 로 직접 바인딩하는 게 안전)
    parsed = _parse_date_like(v)
    if parsed is not None:
        return parsed
    return v


def _resolve_instance(instance_id: str):
    lst = _get_oracle_instances()
    for inst in lst:
        if inst["id"] == instance_id:
            return inst
    return lst[0] if lst else None


@router.post("/execute")
def execute_sql(body: ExecuteBody):
    sql = body.sql.strip().rstrip(";")
    if not sql:
        raise HTTPException(400, "SQL is empty")
    if not _SELECT_RE.match(sql):
        raise HTTPException(400, "Only SELECT / WITH queries are allowed")
    sql_wo_comments = re.sub(r"--[^\n]*", "", sql)
    sql_wo_comments = re.sub(r"/\*[\s\S]*?\*/", "", sql_wo_comments)
    if ";" in sql_wo_comments:
        raise HTTPException(400, "Multiple statements not allowed")

    inst = _resolve_instance(body.instance_id)
    if not inst:
        raise HTTPException(404, f"Oracle instance not available: {body.instance_id}")

    from app.clients.oracle import open_oracle_inst
    conn = open_oracle_inst(inst)
    cur = conn.cursor()
    plan_text = ""
    columns: list[str] = []
    rows: list[dict] = []
    elapsed_ms = 0
    error_message: Optional[str] = None

    try:
        # 선택된 스키마를 현재 세션 기본 스키마로
        if body.schema:
            try:
                cur.execute(f"ALTER SESSION SET CURRENT_SCHEMA = {body.schema}")
            except Exception as e:
                logger.warning(f"ALTER SESSION schema failed: {e}")

        # 요구사항: SQL 실행 전 statistics_level = ALL (세션 전체 보장)
        try:
            cur.execute("ALTER SESSION SET statistics_level = ALL")
        except Exception as e:
            logger.warning(f"ALTER SESSION statistics_level failed: {e}")

        # DATE 문자열 바인드 암묵 변환을 위한 NLS 포맷 설정 (ORA-01843 회피)
        try:
            cur.execute("ALTER SESSION SET NLS_DATE_FORMAT = 'YYYY-MM-DD HH24:MI:SS'")
            cur.execute("ALTER SESSION SET NLS_TIMESTAMP_FORMAT = 'YYYY-MM-DD HH24:MI:SS.FF'")
        except Exception as e:
            logger.warning(f"ALTER SESSION NLS format failed: {e}")

        bind_dict = {bv.name: _convert_bind(bv) for bv in body.bind_vars}
        logger.warning(
            f"execute_sql SQL_PREVIEW={body.sql[:200]!r} "
            f"binds={[(bv.name, bv.data_type, bv.value) for bv in body.bind_vars]} "
            f"converted={ {k: (type(v).__name__, str(v)[:40]) for k, v in bind_dict.items()} }"
        )

        # 실 실행 — 유니크 marker + gather_plan_statistics 힌트 주입
        # prev_sql_id 를 쓰는 방식은 oracledb recursive SQL 로 0 으로 리셋되는
        # 케이스가 있어, v$sql.sql_text 에서 marker 로 직접 조회한다.
        marker = f"tuning_ai_{uuid.uuid4().hex[:12]}"
        tagged_sql = _inject_hint_and_marker(sql, marker)
        captured_sql_id: Optional[str] = None
        captured_child: Optional[int] = None

        t0 = time.time()
        try:
            cur.execute(tagged_sql, bind_dict)
            elapsed_ms = int((time.time() - t0) * 1000)
            if cur.description:
                columns = [d[0] for d in cur.description]
                if body.row_limit is None:
                    fetched = cur.fetchall()
                else:
                    fetched = cur.fetchmany(body.row_limit)
                    # Plan ALLSTATS LAST 는 cursor 가 끝까지 실행되어야 A-Rows/Buffers
                    # 가 채워진다. 표시는 row_limit 까지만 하더라도 cursor 는 silent
                    # drain 해서 실행을 완료시킨다. (큰 결과셋은 elapsed_ms 가 늘어남)
                    try:
                        while True:
                            batch = cur.fetchmany(10000)
                            if not batch:
                                break
                    except Exception as e:
                        logger.warning(f"cursor drain failed: {e}")
                for r in fetched:
                    row: dict = {}
                    for i, col in enumerate(columns):
                        v = r[i]
                        if v is None:
                            row[col] = None
                        elif isinstance(v, (int, float, str, bool)):
                            row[col] = v
                        else:
                            row[col] = str(v)
                    rows.append(row)

            # marker 로 v$sql 에서 cursor 조회
            try:
                cur.execute(
                    """
                    SELECT sql_id, child_number
                    FROM v$sql
                    WHERE sql_text LIKE :m
                    ORDER BY last_active_time DESC NULLS LAST, child_number DESC
                    FETCH FIRST 1 ROWS ONLY
                    """,
                    {"m": f"%{marker}%"},
                )
                row_sid = cur.fetchone()
                if row_sid:
                    captured_sql_id = row_sid[0]
                    captured_child = row_sid[1]
                else:
                    logger.warning(f"v$sql lookup by marker={marker} returned no row")
            except Exception as e:
                logger.warning(f"v$sql marker lookup failed: {e}")
        except Exception as e:
            error_message = f"{type(e).__name__}: {e}"
            logger.error(f"execute_sql SQL failed: {error_message}")

        # SQL 실행이 실패한 경우 — 커서가 없으므로 Plan 영역에 오류 메시지만 담는다.
        if error_message:
            plan_text = (
                f"-- SQL 실행 실패 — Plan 을 조회할 수 없습니다.\n"
                f"-- {error_message}\n"
                f"--\n"
                f"-- 힌트: 바인드 값의 형식을 확인하세요 (DATE 는 'YYYY-MM-DD' 또는 "
                f"'YYYY-MM-DD HH24:MI:SS' 형태 권장). SQL 이 성공해야 A-Rows / Buffers / "
                f"Reads 등 실측 지표를 볼 수 있습니다."
            )
        else:
            # DBMS_XPLAN.DISPLAY_CURSOR — 캡처한 sql_id/child_number 를 명시 전달
            try:
                if captured_sql_id:
                    cur.execute(
                        "SELECT plan_table_output FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(:sid, :child, 'ALLSTATS LAST'))",
                        {"sid": captured_sql_id, "child": captured_child},
                    )
                    plan_text = "\n".join(r[0] for r in cur.fetchall())

                    from app.clients.oracle import trim_plan_header

                    plan_text = trim_plan_header(plan_text)
                    if not plan_text.strip():
                        raise RuntimeError("DISPLAY_CURSOR returned empty plan")
                else:
                    raise RuntimeError("sql_id capture failed — skipping DISPLAY_CURSOR")
            except Exception as e:
                logger.warning(f"DISPLAY_CURSOR failed, fallback to EXPLAIN PLAN: {e}")
                try:
                    cur.execute("EXPLAIN PLAN FOR " + sql, bind_dict)
                    cur.execute(
                        "SELECT plan_table_output FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, NULL, 'BASIC ROWS BYTES COST PREDICATE'))"
                    )
                    plan_text = "\n".join(r[0] for r in cur.fetchall())

                    from app.clients.oracle import trim_plan_header

                    plan_text = trim_plan_header(plan_text)
                except Exception as e2:
                    plan_text = f"-- Plan 조회 실패: {type(e2).__name__}: {e2}"
    except Exception as e:
        error_message = error_message or f"{type(e).__name__}: {e}"
        logger.error(f"execute_sql failed: {error_message}")
    finally:
        try: cur.close()
        except Exception: pass
        try: conn.close()
        except Exception: pass

    if error_message and not rows:
        return {
            "status": "error", "elapsed_ms": elapsed_ms,
            "fetched_rows": 0, "columns": [], "rows": [],
            "plan_text": plan_text, "message": error_message,
        }
    return {
        "status": "success", "elapsed_ms": elapsed_ms,
        "fetched_rows": len(rows), "columns": columns, "rows": rows,
        "plan_text": plan_text,
    }


@router.get("/fulltext")
def get_fulltext(sql_id: str, instance_id: str = "INS-REPO"):
    """SQL_ID 로 원본 SQL 조회. V$SQL.sql_fulltext 우선, 없으면 DBA_HIST_SQLTEXT fallback."""
    inst = _resolve_instance(instance_id)
    if not inst:
        raise HTTPException(404, f"Oracle instance not available: {instance_id}")
    sid = (sql_id or "").strip()
    if not sid:
        raise HTTPException(400, "sql_id is empty")

    from app.clients.oracle import open_oracle_inst
    conn = open_oracle_inst(inst)
    cur = conn.cursor()
    text: Optional[str] = None
    source: Optional[str] = None
    parsing_schema: Optional[str] = None
    try:
        cur.execute(
            "SELECT sql_fulltext, parsing_schema_name FROM gv$sql "
            "WHERE sql_id = :sid AND ROWNUM = 1",
            {"sid": sid},
        )
        row = cur.fetchone()
        if row and row[0] is not None:
            clob = row[0]
            text = clob.read() if hasattr(clob, "read") else str(clob)
            source = "v$sql"
            parsing_schema = row[1]
        if not text:
            cur.execute(
                "SELECT sql_text FROM dba_hist_sqltext WHERE sql_id = :sid AND ROWNUM = 1",
                {"sid": sid},
            )
            row = cur.fetchone()
            if row and row[0] is not None:
                clob = row[0]
                text = clob.read() if hasattr(clob, "read") else str(clob)
                source = "awr"
    finally:
        try: cur.close()
        except Exception: pass
        try: conn.close()
        except Exception: pass
    if not text:
        raise HTTPException(404, f"SQL text not found for sql_id={sid}")
    return {"sql_id": sid, "source": source, "sql_text": text, "parsing_schema_name": parsing_schema}
