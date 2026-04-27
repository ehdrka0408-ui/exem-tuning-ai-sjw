"""Oracle 연결 helper — SID/Service Name 자동 fallback.

`db_instances.sid` 컬럼은 의미상 SID 또는 Service Name 둘 다 허용 (사용자가 구분 못 해도 됨).
SID 시도 → ORA-12505/TNS 류 실패 시 Service Name 으로 재시도.
"""
import logging
from typing import Optional

import oracledb

logger = logging.getLogger(__name__)


def open_oracle(host: str, port: int, identifier: str, user: str, password: str):
    """Oracle 연결 — SID 우선, 실패 시 Service Name fallback."""
    try:
        dsn = oracledb.makedsn(host, port, sid=identifier)
        return oracledb.connect(user=user, password=password, dsn=dsn)
    except oracledb.DatabaseError as e:
        msg = str(e)
        if 'ORA-12505' in msg or 'TNS' in msg or 'listener does not currently know' in msg.lower():
            logger.info(f"SID '{identifier}' failed ({e!s:.80s}), retry as service_name")
            dsn = oracledb.makedsn(host, port, service_name=identifier)
            return oracledb.connect(user=user, password=password, dsn=dsn)
        raise


def open_oracle_inst(inst: dict):
    """db_instances dict (host/port/sid/db_user/db_password) 로 연결."""
    return open_oracle(
        inst["host"], inst["port"], inst["sid"],
        inst["db_user"], inst["db_password"],
    )


def trim_plan_header(plan: str) -> str:
    """'Plan hash value' 라인부터 시작하도록 위 헤더 제거. 헤더 없으면 원본."""
    if not plan:
        return plan
    lines = plan.splitlines()
    for i, line in enumerate(lines):
        if 'Plan hash value' in line:
            return '\n'.join(lines[i:])
    return plan
