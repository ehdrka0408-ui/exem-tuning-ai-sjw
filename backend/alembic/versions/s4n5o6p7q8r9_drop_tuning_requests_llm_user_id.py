"""tuning_requests: DROP llm_id + user_id (moved to tuning_request_group)

Revision ID: s4n5o6p7q8r9
Revises: r3m4n5o6p7q8
Create Date: 2026-04-24 20:00:00.000000

"""
from alembic import op

revision = 's4n5o6p7q8r9'
down_revision = 'r3m4n5o6p7q8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. FK 제약 선 DROP
    op.drop_constraint('fk_tuning_requests_user_id', 'tuning_requests', type_='foreignkey')
    op.drop_constraint('tuning_requests_llm_id_fkey', 'tuning_requests', type_='foreignkey')

    # ── 2. 컬럼 DROP
    op.drop_column('tuning_requests', 'llm_id')
    op.drop_column('tuning_requests', 'user_id')


def downgrade() -> None:
    import sqlalchemy as sa
    # 컬럼 복원 (데이터는 복원 안 됨 — tuning_request_group 에서 역이관 필요)
    op.add_column('tuning_requests', sa.Column('user_id', sa.String(64), nullable=True))
    op.add_column('tuning_requests', sa.Column('llm_id', sa.Integer(), nullable=True))

    # FK 복원
    op.create_foreign_key(
        'fk_tuning_requests_user_id',
        'tuning_requests', 'console_users',
        ['user_id'], ['id'],
    )
    op.create_foreign_key(
        'tuning_requests_llm_id_fkey',
        'tuning_requests', 'llm_models',
        ['llm_id'], ['llm_id'],
    )
