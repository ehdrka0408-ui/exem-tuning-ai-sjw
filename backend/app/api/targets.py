"""직접 입력용 대상 DB/Schema 조회 API.

구조: Instance (instance_id) → Database (db_name) → Schema (schema_name)
DBMS agnostic 을 위해 instance_id 는 문자열이며, 향후 db_type 확장 가능.
"""
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.models.target import TargetDatabase, TargetSchema
from app.schemas.target import (
    TargetDatabaseRead, TargetSchemaRead,
    TargetDatabaseWithSchemas, TargetInstanceRead,
)

router = APIRouter(prefix="/api/targets", tags=["targets"])


@router.get("/databases", response_model=list[TargetDatabaseRead])
def list_databases(db: Session = Depends(get_db)):
    return db.execute(
        select(TargetDatabase).order_by(
            TargetDatabase.instance_id.asc(), TargetDatabase.db_name.asc()
        )
    ).scalars().all()


@router.get("/databases/{database_id}/schemas", response_model=list[TargetSchemaRead])
def list_schemas(database_id: int, db: Session = Depends(get_db)):
    if not db.get(TargetDatabase, database_id):
        raise HTTPException(404, "database not found")
    return db.execute(
        select(TargetSchema)
        .where(TargetSchema.database_id == database_id)
        .order_by(TargetSchema.schema_name.asc())
    ).scalars().all()


@router.get("/tree", response_model=list[TargetInstanceRead])
def get_tree(db: Session = Depends(get_db)):
    """Instance → Database → Schema 전체 트리. 프론트 직접 입력 드롭다운용."""
    dbs = db.execute(
        select(TargetDatabase).order_by(
            TargetDatabase.instance_id.asc(), TargetDatabase.db_name.asc()
        )
    ).scalars().all()

    grouped: dict[str, list] = defaultdict(list)
    for d in dbs:
        schemas = db.execute(
            select(TargetSchema)
            .where(TargetSchema.database_id == d.id)
            .order_by(TargetSchema.schema_name.asc())
        ).scalars().all()
        grouped[d.instance_id].append(
            TargetDatabaseWithSchemas(
                id=d.id, instance_id=d.instance_id, db_name=d.db_name,
                display_name=d.display_name,
                schemas=[TargetSchemaRead.model_validate(s) for s in schemas],
            )
        )
    return [
        TargetInstanceRead(instance_id=k, databases=v)
        for k, v in grouped.items()
    ]
