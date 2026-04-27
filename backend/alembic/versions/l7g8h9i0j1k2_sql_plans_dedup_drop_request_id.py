"""deduplicate sql_plans and drop request_id column

Revision ID: l7g8h9i0j1k2
Revises: k6f7g8h9i0j1
Create Date: 2026-04-24 11:00:00.000000

변경 내용:
  Item #4: sql_plans.request_id DROP + 중복 제거 + UNIQUE 제약
    - 전제: sql_performance.plan_hash 가 rev2(k6f7g8h9i0j1) 에서 이미 백필됨
    - 중복 제거: (sql_id, instance_id, phase, plan_hash) 기준 최신 captured_at 1건만 보존
    - request_id 컬럼 DROP
    - UNIQUE 제약 uq_sql_plans_sql_inst_phase_hash 추가
    - 새 조인 경로: tuning_requests → sql_performance(plan_hash) → sql_plans(plan_hash+sql_id+instance_id)

롤백:
  - UNIQUE 제거
  - request_id 컬럼 재추가 (NULL로 복원, FK 미복원 — 완전 복원 불가)
  - 중복 rows 복원 불가 (downgrade 는 구조만 되돌림)
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'l7g8h9i0j1k2'
down_revision: Union[str, None] = 'k6f7g8h9i0j1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) 중복 제거: (sql_id, instance_id, phase, plan_hash) 기준 최신 captured_at 1건 보존
    # ctid 사용으로 물리 행 직접 식별하여 삭제
    op.execute("""
        DELETE FROM sql_plans sp
        WHERE sp.ctid NOT IN (
            SELECT DISTINCT ON (sql_id, instance_id, phase, plan_hash)
                ctid
            FROM sql_plans
            ORDER BY sql_id, instance_id, phase, plan_hash, captured_at DESC NULLS LAST
        )
    """)

    # 2) request_id 컬럼 DROP
    op.drop_column('sql_plans', 'request_id')

    # 3) UNIQUE 제약 추가
    op.create_unique_constraint(
        'uq_sql_plans_sql_inst_phase_hash',
        'sql_plans',
        ['sql_id', 'instance_id', 'phase', 'plan_hash']
    )


def downgrade() -> None:
    # UNIQUE 제거
    op.drop_constraint(
        'uq_sql_plans_sql_inst_phase_hash',
        'sql_plans',
        type_='unique'
    )

    # request_id 컬럼 재추가 (NULL, FK 미복원)
    op.add_column('sql_plans',
        sa.Column('request_id', sa.Integer(), nullable=True))
