"""기존 DB 구조에 맞춘 모델 — 테이블은 이미 존재, ORM 매핑만 제공."""
from typing import Optional, List
from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class TargetDatabase(Base):
    __tablename__ = "target_databases"

    id: Mapped[int] = mapped_column(primary_key=True)
    instance_id: Mapped[str] = mapped_column(String(32), index=True)
    db_name: Mapped[str] = mapped_column(String(128))
    display_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    schemas: Mapped[List["TargetSchema"]] = relationship(
        back_populates="database", cascade="save-update, merge"
    )


class TargetSchema(Base):
    __tablename__ = "target_schemas"

    id: Mapped[int] = mapped_column(primary_key=True)
    database_id: Mapped[int] = mapped_column(ForeignKey("target_databases.id"))
    schema_name: Mapped[str] = mapped_column(String(128))
    display_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    database: Mapped[TargetDatabase] = relationship(back_populates="schemas")
