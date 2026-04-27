"""exception_sqls CRUD — 튜닝 대상 제외 SQL 등록.

엔드포인트:
- GET    /api/exception-sqls
- POST   /api/exception-sqls
- PATCH  /api/exception-sqls/{id}
- DELETE /api/exception-sqls/{id}
"""
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text as sql_text
from sqlalchemy.orm import Session

from app.db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/exception-sqls", tags=["exception_sqls"])


class ExceptionCreate(BaseModel):
    id: Optional[str] = Field(default=None, max_length=32)  # 미지정 시 EX-{nextval} 자동
    sql_id: str = Field(..., min_length=1, max_length=64)
    sql_text: str = Field(..., min_length=1)
    reason: str = Field(..., min_length=1, max_length=255)
    registered_by: str = Field(..., min_length=1, max_length=64)
    registered_at: Optional[str] = Field(default=None, max_length=32)  # YYYY-MM-DD


class ExceptionUpdate(BaseModel):
    sql_id: Optional[str] = Field(default=None, max_length=64)
    sql_text: Optional[str] = None
    reason: Optional[str] = Field(default=None, max_length=255)
    registered_by: Optional[str] = Field(default=None, max_length=64)
    registered_at: Optional[str] = Field(default=None, max_length=32)


def _row_to_dict(r) -> dict:
    # frontend 호환 키도 함께 노출 (sqlId/addedBy/addedAt)
    return {
        "id": r[0],
        "sql_id": r[1], "sqlId": r[1],
        "sql_text": r[2], "sqlText": r[2],
        "reason": r[3],
        "registered_by": r[4], "addedBy": r[4],
        "registered_at": r[5], "addedAt": r[5],
    }


_COLS = "id, sql_id, sql_text, reason, registered_by, registered_at"


@router.get("")
def list_exceptions(db: Session = Depends(get_db)) -> list[dict]:
    rows = db.execute(sql_text(
        f"SELECT {_COLS} FROM exception_sqls ORDER BY id"
    )).fetchall()
    return [_row_to_dict(r) for r in rows]


def _next_id(db: Session) -> str:
    row = db.execute(sql_text(
        "SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 'EX-(\\d+)') AS INTEGER)), 0) + 1 "
        "FROM exception_sqls WHERE id ~ '^EX-[0-9]+$'"
    )).first()
    n = int(row[0] or 1)
    return f"EX-{n:03d}"


@router.post("")
def create_exception(body: ExceptionCreate, db: Session = Depends(get_db)) -> dict:
    eid = body.id or _next_id(db)
    exists = db.execute(sql_text("SELECT 1 FROM exception_sqls WHERE id=:id"),
                        {"id": eid}).scalar()
    if exists:
        raise HTTPException(409, f"id already exists: {eid}")
    today = body.registered_at or date.today().isoformat()
    db.execute(
        sql_text(
            "INSERT INTO exception_sqls (id, sql_id, sql_text, reason, registered_by, registered_at) "
            "VALUES (:id, :sql_id, :sql_text, :reason, :registered_by, :registered_at)"
        ),
        {"id": eid, "sql_id": body.sql_id, "sql_text": body.sql_text,
         "reason": body.reason, "registered_by": body.registered_by,
         "registered_at": today},
    )
    db.commit()
    row = db.execute(sql_text(f"SELECT {_COLS} FROM exception_sqls WHERE id=:id"),
                     {"id": eid}).first()
    return _row_to_dict(row)


@router.patch("/{exc_id}")
def update_exception(exc_id: str, body: ExceptionUpdate, db: Session = Depends(get_db)) -> dict:
    exists = db.execute(sql_text("SELECT 1 FROM exception_sqls WHERE id=:id"),
                        {"id": exc_id}).scalar()
    if not exists:
        raise HTTPException(404, f"exception not found: {exc_id}")
    fields = body.dict(exclude_unset=True)
    if not fields:
        row = db.execute(sql_text(f"SELECT {_COLS} FROM exception_sqls WHERE id=:id"),
                         {"id": exc_id}).first()
        return _row_to_dict(row)
    set_clause = ", ".join(f"{k} = :{k}" for k in fields)
    fields["id"] = exc_id
    db.execute(sql_text(f"UPDATE exception_sqls SET {set_clause} WHERE id=:id"), fields)
    db.commit()
    row = db.execute(sql_text(f"SELECT {_COLS} FROM exception_sqls WHERE id=:id"),
                     {"id": exc_id}).first()
    return _row_to_dict(row)


@router.delete("/{exc_id}")
def delete_exception(exc_id: str, db: Session = Depends(get_db)) -> dict:
    res = db.execute(sql_text("DELETE FROM exception_sqls WHERE id=:id"), {"id": exc_id})
    db.commit()
    if (res.rowcount or 0) == 0:
        raise HTTPException(404, f"exception not found: {exc_id}")
    return {"deleted": exc_id}
