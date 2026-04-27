"""tuning_requests.requested_by→alias, sql_texts.text_id drop, sql_bind_variables PK drop

Revision ID: h3c4d5e6f7g8
Revises: g2b3c4d5e6f7
Create Date: 2026-04-23 12:00:00.000000

변경 내용:
  1) tuning_requests.requested_by → alias (RENAME)
  2) sql_texts.text_id 컬럼 및 PK 삭제
     - PK (sql_texts_new_pkey) DROP, 컬럼 DROP, 시퀀스 DROP
     - UNIQUE(sql_id, instance_id, sql_type)는 그대로 유지 (조회/UPSERT 키)
  3) sql_bind_variables PK(sql_bind_variables_pkey) DROP
     - 컬럼은 그대로 유지 (일반 컬럼)
     - FK(request_id → tuning_requests), ix_sql_bind_variables_request_id 인덱스 유지
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "h3c4d5e6f7g8"
down_revision: Union[str, None] = "g2b3c4d5e6f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) tuning_requests.requested_by → alias
    op.alter_column("tuning_requests", "requested_by", new_column_name="alias")

    # 2) sql_texts.text_id 삭제
    op.drop_constraint("sql_texts_new_pkey", "sql_texts", type_="primary")
    op.drop_column("sql_texts", "text_id")
    op.execute("DROP SEQUENCE IF EXISTS sql_texts_new_text_id_seq")

    # 3) sql_bind_variables PK 제거
    op.drop_constraint("sql_bind_variables_pkey", "sql_bind_variables", type_="primary")


def downgrade() -> None:
    # 3) sql_bind_variables PK 복원
    op.create_primary_key(
        "sql_bind_variables_pkey",
        "sql_bind_variables",
        ["request_id", "sql_id", "instance_id", "name", "position"],
    )

    # 2) sql_texts.text_id 복원
    op.execute("CREATE SEQUENCE IF NOT EXISTS sql_texts_new_text_id_seq")
    op.add_column(
        "sql_texts",
        sa.Column(
            "text_id",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("nextval('sql_texts_new_text_id_seq'::regclass)"),
        ),
    )
    op.execute("ALTER SEQUENCE sql_texts_new_text_id_seq OWNED BY sql_texts.text_id")
    op.create_primary_key("sql_texts_new_pkey", "sql_texts", ["text_id"])

    # 1) alias → requested_by
    op.alter_column("tuning_requests", "alias", new_column_name="requested_by")
