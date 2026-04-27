"""tuning_request_group: add llm_id + user_id, migrate llm_id from tuning_requests

Revision ID: r3m4n5o6p7q8
Revises: q2l3m4n5o6p7
Create Date: 2026-04-24 19:45:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'r3m4n5o6p7q8'
down_revision = 'q2l3m4n5o6p7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. tuning_request_group 에 llm_id, user_id 컬럼 추가
    op.add_column('tuning_request_group', sa.Column('llm_id', sa.Integer(), nullable=True))
    op.add_column('tuning_request_group', sa.Column('user_id', sa.BigInteger(), nullable=True))

    # ── 2. FK 추가
    op.create_foreign_key(
        'fk_trg_llm_id',
        'tuning_request_group', 'llm_models',
        ['llm_id'], ['llm_id'],
    )
    op.create_foreign_key(
        'fk_trg_user_id',
        'tuning_request_group', 'users',
        ['user_id'], ['user_id'],
    )

    # ── 3. llm_id 이관: 그룹별 MAX(llm_id) (단일값이므로 MAX = 실제값)
    #    user_id 는 tuning_requests 전체 NULL → 이관 불필요
    op.execute("""
        UPDATE tuning_request_group g
        SET llm_id = t.llm_id
        FROM (
            SELECT group_id, MAX(llm_id) AS llm_id
            FROM tuning_requests
            WHERE llm_id IS NOT NULL
            GROUP BY group_id
        ) t
        WHERE g.group_id = t.group_id
    """)


def downgrade() -> None:
    op.drop_constraint('fk_trg_user_id', 'tuning_request_group', type_='foreignkey')
    op.drop_constraint('fk_trg_llm_id', 'tuning_request_group', type_='foreignkey')
    op.drop_column('tuning_request_group', 'user_id')
    op.drop_column('tuning_request_group', 'llm_id')
