"""console_users + user_groups CRUD.

엔드포인트:
- GET    /api/users
- POST   /api/users
- PATCH  /api/users/{id}
- DELETE /api/users/{id}
- GET    /api/user-groups
- POST   /api/user-groups
- PATCH  /api/user-groups/{id}
- DELETE /api/user-groups/{id}
"""
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy import text as sql_text
from sqlalchemy.orm import Session

from app.db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["users"])


# ── User models ──
class UserCreate(BaseModel):
    id: str = Field(..., min_length=1, max_length=32)
    name: str = Field(..., min_length=1, max_length=64)
    email: str = Field(..., min_length=1, max_length=128)
    role: str = Field(default="viewer", max_length=32)
    group_id: Optional[str] = Field(default=None, max_length=32)
    permissions: list[str] = Field(default_factory=list)


class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=64)
    email: Optional[str] = Field(default=None, max_length=128)
    role: Optional[str] = Field(default=None, max_length=32)
    group_id: Optional[str] = Field(default=None, max_length=32)
    permissions: Optional[list[str]] = None


def _user_row_to_dict(r) -> dict:
    perms = r[6]
    if isinstance(perms, str):
        try: perms = json.loads(perms)
        except Exception: perms = []
    return {
        "id": r[0], "name": r[1], "email": r[2], "role": r[3],
        "last_login": r[4], "group_id": r[5],
        "permissions": perms or [],
        "created_at": str(r[7]) if r[7] else None,
    }


_USER_COLS = "id, name, email, role, last_login, group_id, permissions, created_at"


@router.get("/users")
def list_users(db: Session = Depends(get_db)) -> list[dict]:
    rows = db.execute(sql_text(f"SELECT {_USER_COLS} FROM console_users ORDER BY id")).fetchall()
    return [_user_row_to_dict(r) for r in rows]


@router.post("/users")
def create_user(body: UserCreate, db: Session = Depends(get_db)) -> dict:
    exists = db.execute(sql_text("SELECT 1 FROM console_users WHERE id=:id"),
                        {"id": body.id}).scalar()
    if exists:
        raise HTTPException(409, f"user id already exists: {body.id}")
    if body.group_id:
        gexists = db.execute(sql_text("SELECT 1 FROM user_groups WHERE id=:id"),
                             {"id": body.group_id}).scalar()
        if not gexists:
            raise HTTPException(400, f"group_id not found: {body.group_id}")
    db.execute(
        sql_text(
            "INSERT INTO console_users (id, name, email, role, last_login, group_id, permissions) "
            "VALUES (:id, :name, :email, :role, '', :group_id, CAST(:permissions AS jsonb))"
        ),
        {**body.dict(), "permissions": json.dumps(body.permissions)},
    )
    db.commit()
    row = db.execute(sql_text(f"SELECT {_USER_COLS} FROM console_users WHERE id=:id"),
                     {"id": body.id}).first()
    return _user_row_to_dict(row)


@router.patch("/users/{user_id}")
def update_user(user_id: str, body: UserUpdate, db: Session = Depends(get_db)) -> dict:
    exists = db.execute(sql_text("SELECT 1 FROM console_users WHERE id=:id"),
                        {"id": user_id}).scalar()
    if not exists:
        raise HTTPException(404, f"user not found: {user_id}")
    fields = body.dict(exclude_unset=True)
    if "group_id" in fields and fields["group_id"]:
        gexists = db.execute(sql_text("SELECT 1 FROM user_groups WHERE id=:id"),
                             {"id": fields["group_id"]}).scalar()
        if not gexists:
            raise HTTPException(400, f"group_id not found: {fields['group_id']}")
    if not fields:
        row = db.execute(sql_text(f"SELECT {_USER_COLS} FROM console_users WHERE id=:id"),
                         {"id": user_id}).first()
        return _user_row_to_dict(row)
    set_parts = []
    params: dict = {"id": user_id}
    for k, v in fields.items():
        if k == "permissions":
            set_parts.append("permissions = CAST(:permissions AS jsonb)")
            params["permissions"] = json.dumps(v or [])
        else:
            set_parts.append(f"{k} = :{k}"); params[k] = v
    db.execute(sql_text(f"UPDATE console_users SET {', '.join(set_parts)} WHERE id=:id"), params)
    db.commit()
    row = db.execute(sql_text(f"SELECT {_USER_COLS} FROM console_users WHERE id=:id"),
                     {"id": user_id}).first()
    return _user_row_to_dict(row)


@router.delete("/users/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db)) -> dict:
    res = db.execute(sql_text("DELETE FROM console_users WHERE id=:id"), {"id": user_id})
    db.commit()
    if (res.rowcount or 0) == 0:
        raise HTTPException(404, f"user not found: {user_id}")
    return {"deleted": user_id}


# ── Group models ──
class GroupCreate(BaseModel):
    id: str = Field(..., min_length=1, max_length=32)
    name: str = Field(..., min_length=1, max_length=64)
    description: Optional[str] = None


class GroupUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=64)
    description: Optional[str] = None


@router.get("/user-groups")
def list_groups(db: Session = Depends(get_db)) -> list[dict]:
    rows = db.execute(sql_text(
        "SELECT g.id, g.name, g.description, g.created_at, "
        " (SELECT COUNT(*) FROM console_users u WHERE u.group_id = g.id) AS members "
        "FROM user_groups g ORDER BY g.id"
    )).fetchall()
    return [{
        "id": r[0], "name": r[1], "description": r[2],
        "created_at": str(r[3]) if r[3] else None,
        "members": int(r[4] or 0),
    } for r in rows]


@router.post("/user-groups")
def create_group(body: GroupCreate, db: Session = Depends(get_db)) -> dict:
    exists = db.execute(sql_text("SELECT 1 FROM user_groups WHERE id=:id"),
                        {"id": body.id}).scalar()
    if exists:
        raise HTTPException(409, f"group id already exists: {body.id}")
    db.execute(
        sql_text("INSERT INTO user_groups (id, name, description) VALUES (:id, :name, :description)"),
        body.dict(),
    )
    db.commit()
    return {"id": body.id, "name": body.name, "description": body.description, "members": 0}


@router.patch("/user-groups/{group_id}")
def update_group(group_id: str, body: GroupUpdate, db: Session = Depends(get_db)) -> dict:
    exists = db.execute(sql_text("SELECT 1 FROM user_groups WHERE id=:id"),
                        {"id": group_id}).scalar()
    if not exists:
        raise HTTPException(404, f"group not found: {group_id}")
    fields = body.dict(exclude_unset=True)
    if fields:
        set_clause = ", ".join(f"{k} = :{k}" for k in fields)
        fields["id"] = group_id
        db.execute(sql_text(f"UPDATE user_groups SET {set_clause} WHERE id=:id"), fields)
        db.commit()
    return list_group_one(group_id, db)


@router.delete("/user-groups/{group_id}")
def delete_group(group_id: str, db: Session = Depends(get_db)) -> dict:
    res = db.execute(sql_text("DELETE FROM user_groups WHERE id=:id"), {"id": group_id})
    db.commit()
    if (res.rowcount or 0) == 0:
        raise HTTPException(404, f"group not found: {group_id}")
    return {"deleted": group_id}


def list_group_one(group_id: str, db: Session) -> dict:
    r = db.execute(sql_text(
        "SELECT g.id, g.name, g.description, g.created_at, "
        " (SELECT COUNT(*) FROM console_users u WHERE u.group_id = g.id) "
        "FROM user_groups g WHERE g.id=:id"
    ), {"id": group_id}).first()
    return {"id": r[0], "name": r[1], "description": r[2],
            "created_at": str(r[3]) if r[3] else None, "members": int(r[4] or 0)}
