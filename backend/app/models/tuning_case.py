from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector

from app.db.session import Base


class TuningCase(Base):
    __tablename__ = "tuning_cases"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    alias: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    sql_id: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    schema_name: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    instance_name: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    sql_text: Mapped[str] = mapped_column(Text)
    tuned_sql_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rationale: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    owner: Mapped[str] = mapped_column(String(32), default="ai")
    source: Mapped[str] = mapped_column(String(32), default="manual")
    sql_embedding: Mapped[Optional[list]] = mapped_column(Vector(1536), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
