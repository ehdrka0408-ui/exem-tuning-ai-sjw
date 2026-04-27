"""sql_bind_variables — 튜닝 파이프라인용 바인드 변수 캡처.

PK: (request_id, sql_id, instance_id, name, position)
FK (물리): request_id → tuning_requests(request_id) ON DELETE CASCADE
FK (논리): (sql_id, instance_id) → sql_texts — 물리 FK 없음, 애플리케이션 레이어에서 보장.
           sql_texts 에 (sql_id, instance_id) 복합 유니크 키 미존재로 물리 FK 미생성.

주의: 카탈로그용 bind_variables (tuning_cases.id 참조) 와는 별개 테이블.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, DateTime, Integer, Numeric, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class SqlBindVariable(Base):
    __tablename__ = "sql_bind_variables"

    # --- PK 구성 컬럼 ---
    request_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("tuning_requests.request_id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
        comment="튜닝 요청 ID (물리 FK → tuning_requests.request_id)"
    )
    sql_id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        nullable=False,
        comment="SQL ID (논리 참조 → sql_texts.sql_id, 물리 FK 없음)"
    )
    instance_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        nullable=False,
        comment="DB 인스턴스 ID (논리 참조 → sql_texts.instance_id, 물리 FK 없음)"
    )
    name: Mapped[str] = mapped_column(
        String(256),
        primary_key=True,
        nullable=False,
        comment="바인드 변수명 (예: :B1, :p_date)"
    )
    position: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        nullable=False,
        comment="바인드 변수 순서 (1-based, NOT NULL)"
    )

    # --- 속성 컬럼 ---
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
