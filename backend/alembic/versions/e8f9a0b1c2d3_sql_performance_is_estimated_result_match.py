"""sql_performance: is_estimated CHAR(1) DEFAULT 'N' + result_match CHAR(1) NULL 추가

Revision ID: e8f9a0b1c2d3
Revises: d7e8f9a0b1c2
Create Date: 2026-04-23 12:00:00.000000

변경 내용:
  1) sql_performance.is_estimated CHAR(1) NOT NULL DEFAULT 'N'
     - 'N' = 실제 측정값 (Oracle 실수행)
     - 'Y' = 예상치 (Explain Plan / LLM 추정)
     - CHECK (is_estimated IN ('Y','N'))
  2) sql_performance.result_match CHAR(1) NULL
     - 'Y' = 튜닝 전/후 결과셋 일치
     - 'N' = 불일치
     - NULL = 비교 미실행
     - CHECK (result_match IN ('Y','N'))

멱등(IF NOT EXISTS): 이미 컬럼이 있으면 무시.
기존 레코드: is_estimated='N' (기본값 적용), result_match=NULL.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e8f9a0b1c2d3"
down_revision: Union[str, None] = "d7e8f9a0b1c2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # is_estimated — 실측/예상치 구분
    op.execute(
        """
        ALTER TABLE sql_performance
        ADD COLUMN IF NOT EXISTS is_estimated CHAR(1) NOT NULL DEFAULT 'N'
        """
    )
    # CHECK 제약 — 멱등 (이미 있으면 오류 무시를 위해 DO NOTHING 패턴)
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE table_name = 'sql_performance'
                  AND constraint_name = 'sql_performance_is_estimated_check'
            ) THEN
                ALTER TABLE sql_performance
                ADD CONSTRAINT sql_performance_is_estimated_check
                CHECK (is_estimated IN ('Y','N'));
            END IF;
        END
        $$
        """
    )

    # result_match — 튜닝 전/후 결과셋 일치 여부
    op.execute(
        """
        ALTER TABLE sql_performance
        ADD COLUMN IF NOT EXISTS result_match CHAR(1) NULL
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE table_name = 'sql_performance'
                  AND constraint_name = 'sql_performance_result_match_check'
            ) THEN
                ALTER TABLE sql_performance
                ADD CONSTRAINT sql_performance_result_match_check
                CHECK (result_match IN ('Y','N'));
            END IF;
        END
        $$
        """
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE sql_performance DROP CONSTRAINT IF EXISTS sql_performance_result_match_check"
    )
    op.execute(
        "ALTER TABLE sql_performance DROP COLUMN IF EXISTS result_match"
    )
    op.execute(
        "ALTER TABLE sql_performance DROP CONSTRAINT IF EXISTS sql_performance_is_estimated_check"
    )
    op.execute(
        "ALTER TABLE sql_performance DROP COLUMN IF EXISTS is_estimated"
    )
