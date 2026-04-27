from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/health/db")
def health_db(db: Session = Depends(get_db)):
    row = db.execute(text("SELECT 1 AS ok, current_database() AS db")).mappings().first()
    ext = db.execute(text("SELECT extname FROM pg_extension WHERE extname='vector'")).scalar()
    return {"db_ok": row["ok"] == 1, "database": row["db"], "pgvector": bool(ext)}
