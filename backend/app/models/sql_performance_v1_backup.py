"""sql_performance — before/after/applied 성능 스냅샷.

단위 컨벤션: 시간계열은 _sec(Second), 누적/카운트는 _count(Count).
PK 없음 — request_id + instance_id + sql_id + phase 조합으로 WHERE 조건 사용.
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Numeric, BigInteger, DateTime, Integer, ForeignKey, String, CheckConstraint, func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


PHASES = ("before", "after", "applied")


class SqlPerformance(Base):
    __tablename__ = "sql_performance"
    __table_args__ = (
        CheckConstraint("phase IN ('before','after','applied')", name="sql_performance_phase_check"),
    )

    # PK 없음 — SQLAlchemy 에서 매핑만 필요할 경우 아래처럼 사용
    request_id: Mapped[int] = mapped_column(Integer, primary_key=True, nullable=False)
    instance_id: Mapped[int] = mapped_column(Integer, ForeignKey("db_instances.id"), primary_key=True, nullable=False, default="INS-REPO"
    )
    sql_id: Mapped[Optional[str]] = mapped_column(String(64), primary_key=True, nullable=True)
    phase: Mapped[str] = mapped_column(String(16), primary_key=True, nullable=False)
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True, server_default=func.now(), nullable=False
    )
    elapsed_time_sec: Mapped[Optional[Decimal]] = mapped_column(Numeric, nullable=True)
    cpu_time_sec: Mapped[Optional[Decimal]] = mapped_column(Numeric, nullable=True)
    buffer_gets_count: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    disk_reads_count: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    executions_count: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    rows_processed_count: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
