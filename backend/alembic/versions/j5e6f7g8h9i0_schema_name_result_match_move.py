"""move schema_name to tuning_requests, result_match to tuning_requests

Revision ID: j5e6f7g8h9i0
Revises: i4d5e6f7g8h9
Create Date: 2026-04-24 10:00:00.000000

변경 내용:
  Item #1: sql_texts.schema_name -> tuning_requests.schema_name
    - tuning_requests 에 schema_name VARCHAR(128) 추가
    - asis_sql_id 기준으로 sql_texts.schema_name 백필
    - sql_texts.schema_name DROP

  Item #5: sql_performance.result_match -> tuning_requests.result_match
    - tuning_requests 에 result_match BOOLEAN 추가
    - request_id 기준으로 after phase 의 result_match 백필
    - sql_performance.result_match DROP

롤백:
  - tuning_requests.schema_name -> sql_texts (asis_sql_id 기준 역방향)
  - tuning_requests.result_match -> sql_performance.after phase
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'j5e6f7g8h9i0'
down_revision: Union[str, None] = 'i4d5e6f7g8h9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Item #1: schema_name sql_texts -> tuning_requests ──
    op.add_column('tuning_requests',
        sa.Column('schema_name', sa.String(128), nullable=True))

    op.execute("""
        UPDATE tuning_requests tr
        SET schema_name = st.schema_name
        FROM sql_texts st
        WHERE st.sql_id = tr.asis_sql_id
    """)

    op.drop_column('sql_texts', 'schema_name')

    # ── Item #5: result_match sql_performance -> tuning_requests ──
    op.add_column('tuning_requests',
        sa.Column('result_match', sa.Boolean(), nullable=True))

    op.execute("""
        UPDATE tuning_requests tr
        SET result_match = sp.result_match::BOOLEAN
        FROM sql_performance sp
        WHERE sp.request_id = tr.request_id
          AND sp.phase = 'after'
    """)

    op.drop_column('sql_performance', 'result_match')


def downgrade() -> None:
    # ── Item #5 롤백: result_match tuning_requests -> sql_performance ──
    op.add_column('sql_performance',
        sa.Column('result_match', sa.Boolean(), nullable=True))

    op.execute("""
        UPDATE sql_performance sp
        SET result_match = tr.result_match
        FROM tuning_requests tr
        WHERE tr.request_id = sp.request_id
          AND sp.phase = 'after'
    """)

    op.drop_column('tuning_requests', 'result_match')

    # ── Item #1 롤백: schema_name tuning_requests -> sql_texts ──
    op.add_column('sql_texts',
        sa.Column('schema_name', sa.String(128), nullable=True))

    op.execute("""
        UPDATE sql_texts st
        SET schema_name = tr.schema_name
        FROM tuning_requests tr
        WHERE tr.asis_sql_id = st.sql_id
    """)

    op.drop_column('tuning_requests', 'schema_name')
