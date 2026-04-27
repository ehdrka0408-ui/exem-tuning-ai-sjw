"""extend llm_call_log with cache-related columns + request_id FK

Revision ID: 8b2f3c1a5e60
Revises: 7a1e2b9c4d50
Create Date: 2026-04-17 17:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '8b2f3c1a5e60'
down_revision: Union[str, None] = '7a1e2b9c4d50'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('llm_call_log',
        sa.Column('cached_tokens', sa.BigInteger(), nullable=True,
                  comment='Anthropic cache_read_input_tokens (Count)'))
    op.add_column('llm_call_log',
        sa.Column('cache_creation_tokens', sa.BigInteger(), nullable=True,
                  comment='Anthropic cache_creation_input_tokens (Count)'))
    op.add_column('llm_call_log',
        sa.Column('request_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'llm_call_log_request_id_fkey', 'llm_call_log', 'tuning_requests',
        ['request_id'], ['id'])
    op.create_index('ix_llm_call_log_request_id', 'llm_call_log', ['request_id'])


def downgrade() -> None:
    op.drop_index('ix_llm_call_log_request_id', table_name='llm_call_log')
    op.drop_constraint('llm_call_log_request_id_fkey', 'llm_call_log', type_='foreignkey')
    op.drop_column('llm_call_log', 'request_id')
    op.drop_column('llm_call_log', 'cache_creation_tokens')
    op.drop_column('llm_call_log', 'cached_tokens')
