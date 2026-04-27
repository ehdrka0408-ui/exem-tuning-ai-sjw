"""plans.elapsed_ms->elapsed_sec (Numeric/Second) and rebuild sql_bind_variables with request_id FK

Revision ID: d7e8f9a0b1c2
Revises: c6f7a8b9d041
Create Date: 2026-04-23 10:00:00.000000

변경 내용:
  1) plans.elapsed_ms (INTEGER, ms 단위) → elapsed_sec (NUMERIC, 초 단위, 소수점 허용)
     - 기존 ms 값을 초로 환산: elapsed_sec = elapsed_ms / 1000.0
  2) sql_bind_variables 테이블 재정의
     - 기존 테이블: PK/FK 없는 미완성 상태 (sql_id, instance_id, name, position, captured_at 복합 키 없음)
     - DROP 후 재생성: PK (request_id, sql_id, instance_id, name, position)
     - FK: request_id → tuning_requests(request_id) (물리 FK)
     - (sql_id, instance_id) → sql_texts: 논리적 참조만 (물리 FK 생성 안 함)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd7e8f9a0b1c2'
down_revision: Union[str, None] = 'c6f7a8b9d041'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -----------------------------------------------------------------------
    # 1) plans.elapsed_ms → elapsed_sec
    #    INTEGER(ms) → NUMERIC(초, 소수점 허용), 기존 값 환산 적용
    # -----------------------------------------------------------------------
    op.add_column(
        'plans',
        sa.Column('elapsed_sec', sa.Numeric(precision=18, scale=6), nullable=True)
    )
    # 기존 elapsed_ms 값을 초로 환산하여 elapsed_sec 에 적재
    op.execute(
        "UPDATE plans SET elapsed_sec = ROUND(elapsed_ms::numeric / 1000.0, 6) WHERE elapsed_ms IS NOT NULL"
    )
    op.drop_column('plans', 'elapsed_ms')

    # -----------------------------------------------------------------------
    # 2) sql_bind_variables 재정의
    #    기존 테이블은 PK/FK 없는 미완성 상태 → DROP 후 신규 정의로 재생성
    #    논리적 참조: (sql_id, instance_id) → sql_texts (물리 FK 없음, 주석 문서화)
    # -----------------------------------------------------------------------
    op.drop_table('sql_bind_variables')

    op.create_table(
        'sql_bind_variables',
        # PK 구성: (request_id, sql_id, instance_id, name, position)
        sa.Column('request_id', sa.Integer(), nullable=False),
        sa.Column('sql_id', sa.String(length=64), nullable=False),
        sa.Column('instance_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=256), nullable=False,
                  comment='바인드 변수명 (예: :B1, :p_date)'),
        sa.Column('position', sa.Integer(), nullable=False,
                  comment='바인드 변수 순서 (1-based)'),
        # 속성 컬럼
        sa.Column('data_type', sa.String(length=128), nullable=True,
                  comment='Oracle 바인드 타입 (예: NUMBER, VARCHAR2, DATE)'),
        sa.Column('value', sa.Text(), nullable=True,
                  comment='캡처된 바인드 값 (문자열 표현)'),
        sa.Column('captured_at', sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text('now()'),
                  comment='바인드 변수 캡처 시각 (TIMESTAMPTZ)'),
        # PK
        sa.PrimaryKeyConstraint('request_id', 'sql_id', 'instance_id', 'name', 'position',
                                name='sql_bind_variables_pkey'),
        # 물리 FK: request_id → tuning_requests(request_id)
        sa.ForeignKeyConstraint(
            ['request_id'], ['tuning_requests.request_id'],
            name='fk_sql_bind_variables_request_id',
            ondelete='CASCADE'
        ),
        # (sql_id, instance_id) → sql_texts: 논리적 참조만 (물리 FK 없음)
        # sql_texts 테이블에 sql_id+instance_id 복합 유니크 키가 없어 물리 FK 미생성.
        # 애플리케이션 레이어에서 참조 무결성 보장.
        comment='튜닝 파이프라인용 바인드 변수 캡처 테이블. '
                '(sql_id, instance_id)는 sql_texts 논리 참조 (물리 FK 없음).'
    )

    # 조회 성능을 위한 보조 인덱스
    op.create_index(
        'ix_sql_bind_variables_request_id',
        'sql_bind_variables',
        ['request_id'],
        unique=False
    )


def downgrade() -> None:
    # -----------------------------------------------------------------------
    # 2) sql_bind_variables 역방향: 현재 정의 DROP → 구 미완성 구조로 복원
    # -----------------------------------------------------------------------
    op.drop_index('ix_sql_bind_variables_request_id', table_name='sql_bind_variables')
    op.drop_table('sql_bind_variables')

    # 구 미완성 테이블 복원 (PK/FK 없는 원래 상태 — 데이터 유실 감수)
    op.create_table(
        'sql_bind_variables',
        sa.Column('sql_id', sa.String(length=64), nullable=False),
        sa.Column('instance_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=64), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('captured_at', sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.text('now()')),
        sa.Column('data_type', sa.String(length=32), nullable=True),
        sa.Column('value', sa.Text(), nullable=True),
    )

    # -----------------------------------------------------------------------
    # 1) plans.elapsed_sec → elapsed_ms 역방향
    # -----------------------------------------------------------------------
    op.add_column(
        'plans',
        sa.Column('elapsed_ms', sa.Integer(), nullable=True)
    )
    op.execute(
        "UPDATE plans SET elapsed_ms = ROUND(elapsed_sec * 1000)::integer WHERE elapsed_sec IS NOT NULL"
    )
    op.drop_column('plans', 'elapsed_sec')
