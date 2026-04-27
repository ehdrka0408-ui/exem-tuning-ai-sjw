"""sql_bind_variables — 튜닝 파이프라인용 바인드 변수 캡처.

PK 없음. 모든 컬럼은 일반 컬럼.
FK (물리): request_id → tuning_requests(request_id) ON DELETE CASCADE
조인 규칙:
  tuning_requests 와는 (request_id, instance_id, sql_id=asis_sql_id) 로 조인.

주의: 카탈로그용 bind_variables (tuning_cases.id 참조) 와는 별개 테이블.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, DateTime, Integer, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class SqlBindVariable(Base):
    __tablename__ = "sql_bind_variables"
    # ORM 매핑용 — 실제 DB 에는 PK 없음. 애플리케이션 레이어에서 (request_id, sql_id, instance_id, name, position) 로 구분.
    __mapper_args__ = {
        "primary_key": ["request_id", "sql_id", "instance_id", "name", "position"],
    }

    request_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("tuning_requests.request_id", ondelete="CASCADE"),
        nullable=False,
        comment="튜닝 요청 ID (물리 FK → tuning_requests.request_id)"
    )
    sql_id: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        comment="SQL ID (논리 참조 → tuning_requests.asis_sql_id)"
    )
    instance_id: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="DB 인스턴스 ID (논리 참조 → tuning_requests.instance_id)"
    )
    name: Mapped[str] = mapped_column(
        String(256),
        nullable=False,
        comment="바인드 변수명 (예: :B1, :p_date)"
    )
    position: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="바인드 변수 순서 (1-based, NOT NULL)"
    )
    data_type: Mapped[Optional[str]] = mapped_column(
        String(128),
        nullable=True,
        comment="Oracle 바인드 타입 (예: NUMBER, VARCHAR2, DATE)"
    )
    value: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="캡처된 바인드 값 (문자열 표현)"
    )
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        comment="바인드 변수 캡처 시각 (TIMESTAMPTZ)"
    )
