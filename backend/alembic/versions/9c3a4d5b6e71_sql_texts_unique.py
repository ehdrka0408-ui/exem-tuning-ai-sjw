"""add unique constraint sql_texts_sql_id_sql_type_key

Revision ID: 9c3a4d5b6e71
Revises: 8b2f3c1a5e60
Create Date: 2026-04-17 17:08:00.000000
"""
from typing import Sequence, Union
from alembic import op


revision: str = '9c3a4d5b6e71'
down_revision: Union[str, None] = '8b2f3c1a5e60'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        'sql_texts_sql_id_sql_type_key', 'sql_texts', ['sql_id', 'sql_type']
    )


def downgrade() -> None:
    op.drop_constraint('sql_texts_sql_id_sql_type_key', 'sql_texts', type_='unique')
