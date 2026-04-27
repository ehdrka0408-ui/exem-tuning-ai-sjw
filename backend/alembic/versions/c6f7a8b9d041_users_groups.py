"""extend console_users + add user_groups

Revision ID: c6f7a8b9d041
Revises: b5e6f7a8c930
Create Date: 2026-04-21 11:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'c6f7a8b9d041'
down_revision: Union[str, None] = 'b5e6f7a8c930'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'user_groups',
        sa.Column('id', sa.String(length=32), primary_key=True),
        sa.Column('name', sa.String(length=64), nullable=False, unique=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
    )
    op.add_column('console_users', sa.Column('group_id', sa.String(length=32), nullable=True))
    op.add_column('console_users',
                  sa.Column('permissions', sa.dialects.postgresql.JSONB(),
                            nullable=False, server_default=sa.text("'[]'::jsonb")))
    op.add_column('console_users',
                  sa.Column('created_at', sa.DateTime(timezone=True),
                            server_default=sa.text('now()'), nullable=False))
    op.create_foreign_key(
        'console_users_group_id_fkey', 'console_users', 'user_groups',
        ['group_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('console_users_group_id_fkey', 'console_users', type_='foreignkey')
    op.drop_column('console_users', 'created_at')
    op.drop_column('console_users', 'permissions')
    op.drop_column('console_users', 'group_id')
    op.drop_table('user_groups')
