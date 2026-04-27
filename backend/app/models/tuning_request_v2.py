"""tuning_requests — 튜닝 요청 이력 (재튜닝은 parent_request_id 체이닝)."""
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, DateTime, Integer, ForeignKey, CheckConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


# 허용 status: requested → tuning → completed → approved → applied (+ failed)
TUNING_STATUSES = ("requested", "tuning", "completed", "approved", "applied", "failed", "rejected")


class TuningRequest(Base):
    __tablename__ = "tuning_requests"
    __table_args__ = (
        CheckConstraint(
            "status IN ('requested','tuning','completed','approved','applied','failed','rejected')",
            name="tuning_requests_status_check",
        ),
    )

    request_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    instance_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("db_instances.instance_id"), nullable=False
    )
    parent_request_id: Mapped[int] = mapped_column(Integer, nullable=True)
    asis_sql_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    tobe_sql_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="requested")
    rationale: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    user_instruction: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    requested_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    llm_provider: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    llm_model: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    input_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)   # Count
    output_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # Count
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)     # Millisecond
    user_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("console_users.id"), nullable=True
    )
