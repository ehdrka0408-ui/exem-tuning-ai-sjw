"""add llm_models table, drop llm columns from tuning_requests, add plan_hash to sql_performance

Revision ID: k6f7g8h9i0j1
Revises: j5e6f7g8h9i0
Create Date: 2026-04-24 10:30:00.000000

변경 내용:
  Item #2: LLM 컬럼 정규화
    - llm_models 테이블 신규 (id SERIAL PK, provider, model_name, description)
    - seed: vllm/axis-v1 row 삽입
    - tuning_requests.llm_id INTEGER FK 추가
    - tuning_requests 에서 llm_provider, llm_model, input_tokens, output_tokens DROP
    - (latency_ms 는 이번 스코프 아님 — 보존)

  Item #3: sql_performance.plan_hash 추가
    - VARCHAR(64) NULL 컬럼 추가
    - sql_plans 조인으로 기존 42건 백필 (request_id+sql_id+instance_id+phase 기준)
    - INDEX idx_sql_perf_plan_hash 추가

롤백:
  - llm_models DROP, tuning_requests 컬럼 복원
  - sql_performance.plan_hash DROP
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'k6f7g8h9i0j1'
down_revision: Union[str, None] = 'j5e6f7g8h9i0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Item #2: llm_models 테이블 신규 ──
    op.create_table(
        'llm_models',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('provider', sa.String(64), nullable=False),
        sa.Column('model_name', sa.String(128), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('provider', 'model_name', name='uq_llm_models_provider_model'),
    )

    # seed: vllm/axis-v1
    op.execute("""
        INSERT INTO llm_models (provider, model_name, description)
        VALUES ('vllm', 'axis-v1', 'Local vLLM LoRA on Qwen2.5-Coder-32B (10.10.48.89:8606)')
    """)

    # tuning_requests 에 llm_id FK 추가
    op.add_column('tuning_requests',
        sa.Column('llm_id', sa.Integer(), sa.ForeignKey('llm_models.id'), nullable=True))

    # 기존 레코드: provider='vllm', model='axis-v1' → llm_id=1 매핑
    op.execute("""
        UPDATE tuning_requests
        SET llm_id = (
            SELECT id FROM llm_models
            WHERE provider = 'vllm' AND model_name = 'axis-v1'
            LIMIT 1
        )
        WHERE llm_provider = 'vllm'
           OR llm_model ILIKE '%axis%'
           OR llm_model ILIKE '%qwen%'
    """)

    # 삭제: llm_provider, llm_model, input_tokens, output_tokens
    op.drop_column('tuning_requests', 'llm_provider')
    op.drop_column('tuning_requests', 'llm_model')
    op.drop_column('tuning_requests', 'input_tokens')
    op.drop_column('tuning_requests', 'output_tokens')

    # ── Item #3: sql_performance.plan_hash 추가 ──
    op.add_column('sql_performance',
        sa.Column('plan_hash', sa.String(64), nullable=True))

    # 백필: sql_plans 에서 request_id+sql_id+instance_id+phase 기준 조인
    op.execute("""
        UPDATE sql_performance sp
        SET plan_hash = pl.plan_hash::VARCHAR
        FROM sql_plans pl
        WHERE pl.request_id = sp.request_id
          AND pl.sql_id = sp.sql_id
          AND pl.instance_id = sp.instance_id
          AND pl.phase = sp.phase
    """)

    op.create_index(
        'idx_sql_perf_plan_hash',
        'sql_performance',
        ['plan_hash']
    )


def downgrade() -> None:
    # ── Item #3 롤백: sql_performance.plan_hash DROP ──
    op.drop_index('idx_sql_perf_plan_hash', table_name='sql_performance')
    op.drop_column('sql_performance', 'plan_hash')

    # ── Item #2 롤백: tuning_requests 컬럼 복원, llm_models DROP ──
    op.add_column('tuning_requests',
        sa.Column('output_tokens', sa.Integer(), nullable=True))
    op.add_column('tuning_requests',
        sa.Column('input_tokens', sa.Integer(), nullable=True))
    op.add_column('tuning_requests',
        sa.Column('llm_model', sa.String(128), nullable=True))
    op.add_column('tuning_requests',
        sa.Column('llm_provider', sa.String(64), nullable=True))

    # 복원: llm_id → llm_provider/llm_model
    op.execute("""
        UPDATE tuning_requests tr
        SET llm_provider = lm.provider,
            llm_model = lm.model_name
        FROM llm_models lm
        WHERE lm.id = tr.llm_id
    """)

    op.drop_column('tuning_requests', 'llm_id')
    op.drop_table('llm_models')
