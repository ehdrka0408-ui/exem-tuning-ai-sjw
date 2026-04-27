from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, DateTime, Integer, Numeric, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("tuning_cases.id", ondelete="CASCADE"), index=True)
    phase: Mapped[str] = mapped_column(String(16))  # 'before' | 'after'
    plan_hash: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    plan_text: Mapped[str] = mapped_column(Text)
    cost: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # elapsed_sec: 실행 경과 시간 (Second 단위, 소수점 허용)
    # 구 elapsed_ms(INTEGER, ms) → elapsed_sec(NUMERIC, sec) 으로 변경 (migration d7e8f9a0b1c2)
    elapsed_sec: Mapped[Optional[float]] = mapped_column(Numeric(precision=18, scale=6), nullable=True)
    buffers: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BindVariable(Base):
    __tablename__ = "bind_variables"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("tuning_cases.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(64))
    data_type: Mapped[str] = mapped_column(String(32))
    value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    position: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
