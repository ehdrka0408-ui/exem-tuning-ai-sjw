"""sql_texts — SQL 원문 저장소 (AS-IS / TO-BE)."""
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, DateTime, Integer, CheckConstraint, UniqueConstraint, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class SqlText(Base):
    __tablename__ = "sql_texts"
    __table_args__ = (
        CheckConstraint("sql_type IN ('as_is','to_be')", name="sql_texts_sql_type_check"),
        UniqueConstraint("sql_id", "instance_id", "sql_type", name="sql_texts_unique_combo"),
    )

    text_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sql_id: Mapped[str] = mapped_column(String(64), nullable=False)
    instance_id: Mapped[int] = mapped_column(Integer, ForeignKey("db_instances.instance_id"), nullable=False
    )
    sql_text: Mapped[str] = mapped_column(Text, nullable=False)
    schema_name: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    sql_type: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
