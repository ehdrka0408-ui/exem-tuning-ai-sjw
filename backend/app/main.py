from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api import (
    health, tuning_cases, oracle_top_sql, targets, sql_execute, instances, users, exception_sqls,
)
from app.api import tuning_requests_v4 as tuning_requests

_startup_logger = logging.getLogger("startup")


@asynccontextmanager
async def lifespan(application: FastAPI):
    """서버 시작 시 30분 이상 requested/tuning 상태인 고아 요청을 failed 로 전환."""
    try:
        from app.db.session import SessionLocal
        from sqlalchemy import text as _sql_text
        db = SessionLocal()
        try:
            result = db.execute(_sql_text("""
                UPDATE tuning_requests
                   SET status='failed',
                       completed_at=NOW(),
                       rationale=COALESCE(rationale,'') ||
                           '[timeout:server restart cleanup · ' || NOW()::text || ']'
                 WHERE status IN ('requested','tuning')
                   AND requested_at < NOW() - INTERVAL '30 minutes'
                 RETURNING request_id
            """))
            cleaned = [r[0] for r in result.fetchall()]
            db.commit()
            if cleaned:
                _startup_logger.warning(f"[startup cleanup] orphan requests failed: {cleaned}")
            else:
                _startup_logger.info("[startup cleanup] no orphan requests found")
        finally:
            db.close()
    except Exception as e:
        _startup_logger.error(f"[startup cleanup] failed: {e}")
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(tuning_cases.router)
app.include_router(oracle_top_sql.router)
app.include_router(targets.router)
app.include_router(sql_execute.router)
app.include_router(tuning_requests.router)
app.include_router(instances.router)
app.include_router(users.router)
app.include_router(exception_sqls.router)
