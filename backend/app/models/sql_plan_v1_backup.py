"""sql_plans — before/after/applied 실행계획 스냅샷.
PK 없음 — request_id + instance_id + sql_id + phase 조합으로 WHERE 조건 사용.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    String, Text, DateTime, Integer, ForeignKey, CheckConstraint, func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class SqlPlan(Base):
    __tablename__ = "sql_plans"
    __table_args__ = (
        CheckConstraint("phase IN ('before','after','applied')", name="sql_plans_phase_check"),
        {"comment": "Oracle 실행계획 스냅샷"},
    )

    request_id: Mapped[int] = mapped_column(Integer, primary_key=True, nullable=False)
    instance_id: Mapped[int] = mapped_column(Integer, ForeignKey("db_instances.id"), primary_key=True, nullable=False, default="INS-REPO"
    )
    sql_id: Mapped[Optional[str]] = mapped_column(String(64), primary_key=True, nullable=True)
    phase: Mapped[str] = mapped_column(String(16), primary_key=True, nullable=False)
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True, server_default=func.now(), nullable=False
    )
    plan_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    plan_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cost: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
