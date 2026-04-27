from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class TargetSchemaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    schema_name: str
    display_name: Optional[str] = None


class TargetDatabaseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    instance_id: str
    db_name: str
    display_name: Optional[str] = None


class TargetDatabaseWithSchemas(TargetDatabaseRead):
    schemas: List[TargetSchemaRead] = []


class TargetInstanceRead(BaseModel):
    """instance_id 기준 집계 — 같은 instance_id를 가진 DB 목록"""
    instance_id: str
    databases: List[TargetDatabaseWithSchemas]
