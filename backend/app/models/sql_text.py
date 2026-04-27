"""sql_texts — SQL 원문 저장소 (AS-IS / TO-BE).

조인 규칙:
  tuning_requests 와 (instance_id, asis_sql_id) 또는 (instance_id, tobe_sql_id) 로 조인
  — sql_type('as_is'/'to_be') 로 AS-IS / TO-BE 를 구분.
"""
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

    # PK 없음 — sql_texts_unique_combo(sql_id, instance_id, sql_type) 가 유일성 보장.
    # ORM 매핑용 복합 primary_key 지정.
    sql_id: Mapped[str] = mapped_column(String(64), primary_key=True, nullable=False)
    instance_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("db_instances.instance_id"), primary_key=True, nullable=False
    )
    sql_type: Mapped[str] = mapped_column(String(16), primary_key=True, nullable=False)
    sql_text: Mapped[str] = mapped_column(Text, nullable=False)
    schema_name: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
