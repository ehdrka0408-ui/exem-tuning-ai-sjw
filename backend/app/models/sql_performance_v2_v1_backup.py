"""sql_performance v2 — is_estimated + result_match 컬럼 추가.

단위 컨벤션: 시간계열은 _sec(Second), 누적/카운트는 _count(Count).
PK 없음 — request_id + instance_id + sql_id + phase 조합으로 WHERE 조건 사용.

v2 변경:
  - is_estimated CHAR(1) NOT NULL DEFAULT 'N'  ('N'=실측, 'Y'=예상치)
  - result_match  CHAR(1) NULL                 ('Y'=일치, 'N'=불일치, NULL=비교 미실행)
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Numeric, BigInteger, DateTime, Integer, ForeignKey, String, CheckConstraint, func, CHAR,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


PHASES = ("before", "after", "applied")


class SqlPerformance(Base):
    __tablename__ = "sql_performance"
    __table_args__ = (
        CheckConstraint("phase IN ('before','after','applied')", name="sql_performance_phase_check"),
        CheckConstraint("is_estimated IN ('Y','N')", name="sql_performance_is_estimated_check"),
        CheckConstraint("result_match IN ('Y','N')", name="sql_performance_result_match_check"),
    )

    request_id: Mapped[int] = mapped_column(Integer, primary_key=True, nullable=False)
    instance_id: Mapped[int] = mapped_column(Integer, ForeignKey("db_instances.id"), primary_key=True, nullable=False)
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
    # v2: 실측/예상치 구분
    is_estimated: Mapped[str] = mapped_column(CHAR(1), nullable=False, server_default="N")
    # v2: 튜닝 전/후 결과셋 일치 여부 (NULL = 비교 미실행)
    result_match: Mapped[Optional[str]] = mapped_column(CHAR(1), nullable=True)
