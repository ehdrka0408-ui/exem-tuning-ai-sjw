from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class PlanRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    phase: str
    plan_hash: Optional[str] = None
    plan_text: str
    cost: Optional[int] = None
    # elapsed_sec: 실행 경과 시간 (Second 단위, 소수점 허용)
    # 구 elapsed_ms(ms 단위) 에서 변경됨 (migration d7e8f9a0b1c2)
    elapsed_sec: Optional[float] = None
    buffers: Optional[int] = None
    note: Optional[str] = None


class BindVariableRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    data_type: str
    value: Optional[str] = None
    position: Optional[int] = None


class TuningCaseSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: Optional[str] = None
    alias: Optional[str] = None
    category: Optional[str] = None
    sql_id: Optional[str] = None
    schema_name: Optional[str] = None
    instance_name: Optional[str] = None
    status: str
    owner: str
    source: str
    created_at: datetime


class TuningCaseDetail(TuningCaseSummary):
    sql_text: str
    tuned_sql_text: Optional[str] = None
    rationale: Optional[str] = None
    plans: List[PlanRead] = []
    bind_variables: List[BindVariableRead] = []


class AliasUpdate(BaseModel):
    alias: Optional[str] = None
