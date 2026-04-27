"""tuning_requests: user_id VARCHAR(64) NULL + FK console_users(id) + 인덱스 추가

Revision ID: f1a2b3c4d5e6
Revises: e8f9a0b1c2d3
Create Date: 2026-04-23 14:00:00.000000

변경 내용:
  1) tuning_requests.user_id VARCHAR(64) NULL
     - console_users.id (VARCHAR) FK 참조
     - NULL 허용 (기존 레코드 소급 불가)
  2) ix_tuning_requests_user_id 인덱스 생성
  3) fk_tuning_requests_user_id FK 제약 생성

멱등 보장: DO $$ EXCEPTION 처리로 중복 실행 안전
"""
from alembic import op
import sqlalchemy as sa


revision = 'f1a2b3c4d5e6'
down_revision = 'e8f9a0b1c2d3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) 컬럼 추가 (IF NOT EXISTS 에뮬레이션)
    conn = op.get_bind()
    col_exists = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name='tuning_requests' AND column_name='user_id'"
    )).scalar()
    if not col_exists:
        op.add_column(
            'tuning_requests',
            sa.Column('user_id', sa.String(64), nullable=True),
        )

    # 2) FK 제약 추가 (이미 존재하면 스킵)
    fk_exists = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.table_constraints "
        "WHERE table_schema='public' AND constraint_name='fk_tuning_requests_user_id'"
    )).scalar()
    if not fk_exists:
        op.create_foreign_key(
            'fk_tuning_requests_user_id',
            'tuning_requests', 'console_users',
            ['user_id'], ['id'],
        )

    # 3) 인덱스 추가 (이미 존재하면 스킵)
    idx_exists = conn.execute(sa.text(
        "SELECT 1 FROM pg_indexes "
        "WHERE schemaname='public' AND indexname='ix_tuning_requests_user_id'"
    )).scalar()
    if not idx_exists:
        op.create_index('ix_tuning_requests_user_id', 'tuning_requests', ['user_id'])


def downgrade() -> None:
    conn = op.get_bind()

    idx_exists = conn.execute(sa.text(
        "SELECT 1 FROM pg_indexes "
        "WHERE schemaname='public' AND indexname='ix_tuning_requests_user_id'"
    )).scalar()
    if idx_exists:
        op.drop_index('ix_tuning_requests_user_id', table_name='tuning_requests')

    fk_exists = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.table_constraints "
        "WHERE table_schema='public' AND constraint_name='fk_tuning_requests_user_id'"
    )).scalar()
    if fk_exists:
        op.drop_constraint('fk_tuning_requests_user_id', 'tuning_requests', type_='foreignkey')

    col_exists = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name='tuning_requests' AND column_name='user_id'"
    )).scalar()
    if col_exists:
        op.drop_column('tuning_requests', 'user_id')
