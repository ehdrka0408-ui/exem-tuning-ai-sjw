"""DB 인스턴스 CRUD + 연결 테스트.

엔드포인트:
- GET    /api/instances         목록 (password 마스킹)
- POST   /api/instances         등록
- PATCH  /api/instances/{id}    수정
- DELETE /api/instances/{id}    삭제
- POST   /api/instances/{id}/test  연결 테스트

변경 이력:
  v2 (2026-04-23): db_instances.id → instance_id PK rename 반영.
                   응답 스키마 'id' 필드 → 'instance_id' 로 변경.
                   [프론트 영향] GET/POST/PATCH 응답의 'id' 키가 'instance_id' 로 바뀜.
"""
import logging
from typing import Optional, Literal

import oracledb
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text as sql_text
from sqlalchemy.orm import Session

from app.db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/instances", tags=["instances"])

InstanceType = Literal["production", "staging", "development"]


class InstanceCreate(BaseModel):
    instance_id: str = Field(..., min_length=1, max_length=32, alias="id")
    name: str = Field(..., min_length=1, max_length=64)
    alias: Optional[str] = Field(default=None, max_length=64)
    host: str = Field(..., min_length=1, max_length=64)
    port: int = Field(default=1521, ge=1, le=65535)
    sid: Optional[str] = Field(default=None, max_length=64)
    db_user: Optional[str] = Field(default=None, max_length=64)
    db_password: Optional[str] = Field(default=None, max_length=128)
    schema_name: Optional[str] = Field(default=None, max_length=64)
    db_type: str = Field(default="Oracle", max_length=64)
    status: str = Field(default="active", max_length=32)
    instance_type: Optional[InstanceType] = None

    class Config:
        populate_by_name = True


class InstanceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=64)
    alias: Optional[str] = Field(default=None, max_length=64)
    host: Optional[str] = Field(default=None, max_length=64)
    port: Optional[int] = Field(default=None, ge=1, le=65535)
    sid: Optional[str] = Field(default=None, max_length=64)
    db_user: Optional[str] = Field(default=None, max_length=64)
    db_password: Optional[str] = Field(default=None, max_length=128)
    schema_name: Optional[str] = Field(default=None, max_length=64)
    db_type: Optional[str] = Field(default=None, max_length=64)
    status: Optional[str] = Field(default=None, max_length=32)
    instance_type: Optional[InstanceType] = None


def _row_to_dict(r, *, mask_password: bool = True) -> dict:
    # instances 테이블: instance_id, name, alias_name, host, port, sid, username, password_encrypted, db_type, is_active
    is_active = r[9]
    return {
        "instance_id": r[0], "name": r[1], "alias": r[2],
        "host": r[3], "port": r[4], "sid": r[5],
        "db_user": r[6],
        "db_password": ("****" if (r[7] and mask_password) else r[7]),
        "db_type": r[8],
        "status": "active" if is_active else "inactive",
        "schema_name": None,
        "instance_type": None,
    }


_SELECT_COLS = (
    "instance_id, name, alias_name AS alias, host, port, sid, username AS db_user, "
    "password_encrypted AS db_password, db_type, is_active"
)


@router.get("")
def list_instances(reveal_password: bool = False, db: Session = Depends(get_db)) -> list[dict]:
    rows = db.execute(sql_text(
        f"SELECT {_SELECT_COLS} FROM instances ORDER BY instance_id"
    )).fetchall()
    return [_row_to_dict(r, mask_password=not reveal_password) for r in rows]


@router.post("")
def create_instance(body: InstanceCreate, db: Session = Depends(get_db)) -> dict:
    iid = body.instance_id
    exists = db.execute(
        sql_text("SELECT 1 FROM instances WHERE instance_id=:id"), {"id": iid}
    ).scalar()
    if exists:
        raise HTTPException(409, f"instance id already exists: {iid}")
    db.execute(
        sql_text(
            "INSERT INTO instances (instance_id, name, alias_name, host, port, sid, username, password_encrypted, "
            "db_type, is_active) "
            "VALUES (:instance_id, :name, :alias, :host, :port, :sid, :db_user, :db_password, "
            ":db_type, :is_active)"
        ),
        {
            "instance_id": iid,
            "name": body.name, "alias": body.alias, "host": body.host,
            "port": body.port, "sid": body.sid, "db_user": body.db_user,
            "db_password": body.db_password,
            "db_type": (body.db_type or "oracle").lower(),
            "is_active": body.status == "active",
        },
    )
    db.commit()
    row = db.execute(sql_text(
        f"SELECT {_SELECT_COLS} FROM instances WHERE instance_id=:id"
    ), {"id": iid}).first()
    return _row_to_dict(row, mask_password=True)


@router.patch("/{instance_id}")
def update_instance(instance_id: str, body: InstanceUpdate, db: Session = Depends(get_db)) -> dict:
    exists = db.execute(
        sql_text("SELECT 1 FROM instances WHERE instance_id=:id"), {"id": instance_id}
    ).scalar()
    if not exists:
        raise HTTPException(404, f"instance not found: {instance_id}")
    # 컬럼명 매핑: 외부 필드명 → instances 컬럼명
    _col_map = {"alias": "alias_name", "db_user": "username", "db_password": "password_encrypted",
                "status": None}
    raw = body.dict(exclude_unset=True)
    if not raw:
        row = db.execute(sql_text(
            f"SELECT {_SELECT_COLS} FROM instances WHERE instance_id=:id"
        ), {"id": instance_id}).first()
        return _row_to_dict(row, mask_password=True)
    fields: dict = {}
    for k, v in raw.items():
        if k == "status":
            fields["is_active"] = (v == "active")
        elif k == "db_type":
            fields["db_type"] = (v or "oracle").lower()
        elif k in _col_map:
            fields[_col_map[k]] = v
        else:
            fields[k] = v
    set_clause = ", ".join(f"{k} = :{k}" for k in fields)
    fields["_iid"] = instance_id
    db.execute(sql_text(f"UPDATE instances SET {set_clause} WHERE instance_id=:_iid"), fields)
    db.commit()
    row = db.execute(sql_text(
        f"SELECT {_SELECT_COLS} FROM instances WHERE instance_id=:id"
    ), {"id": instance_id}).first()
    return _row_to_dict(row, mask_password=True)


@router.delete("/{instance_id}")
def delete_instance(instance_id: str, db: Session = Depends(get_db)) -> dict:
    res = db.execute(sql_text("DELETE FROM instances WHERE instance_id=:id"), {"id": instance_id})
    db.commit()
    if (res.rowcount or 0) == 0:
        raise HTTPException(404, f"instance not found: {instance_id}")
    return {"deleted": instance_id}


@router.post("/{instance_id}/test")
def test_instance(instance_id: str, db: Session = Depends(get_db)) -> dict:
    row = db.execute(sql_text(
        "SELECT host, port, sid, username, password_encrypted FROM instances WHERE instance_id=:id"
    ), {"id": instance_id}).first()
    if not row:
        raise HTTPException(404, f"instance not found: {instance_id}")
    host, port, sid, user, password = row
    if not (host and port and sid and user and password):
        raise HTTPException(400, "incomplete connection info (host/port/sid/db_user/db_password required)")
    try:
        from app.clients.oracle import open_oracle
        conn = open_oracle(host, port, sid, user, password)
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM dual")
        ok = cur.fetchone()[0] == 1
        cur.close()
        conn.close()
        return {"instance_id": instance_id, "ok": bool(ok), "message": "connected"}
    except Exception as e:
        return {"instance_id": instance_id, "ok": False,
                "message": f"{type(e).__name__}: {e}"}
