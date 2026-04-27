"""rename sql_performance metric columns and extend phase/status check

Revision ID: 7a1e2b9c4d50
Revises: fa5cc8952b39
Create Date: 2026-04-17 16:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a1e2b9c4d50'
down_revision: Union[str, None] = 'fa5cc8952b39'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) sql_performance 단위 suffix rename
    op.alter_column('sql_performance', 'elapsed_time', new_column_name='elapsed_time_sec',
                    existing_type=sa.Numeric())
    op.alter_column('sql_performance', 'cpu_time', new_column_name='cpu_time_sec',
                    existing_type=sa.Numeric())
    op.alter_column('sql_performance', 'buffer_gets', new_column_name='buffer_gets_count',
                    existing_type=sa.BigInteger())
    op.alter_column('sql_performance', 'disk_reads', new_column_name='disk_reads_count',
                    existing_type=sa.BigInteger())
    op.alter_column('sql_performance', 'executions', new_column_name='executions_count',
                    existing_type=sa.BigInteger())
    op.alter_column('sql_performance', 'rows_processed', new_column_name='rows_processed_count',
                    existing_type=sa.BigInteger())

    # 2) phase CHECK 확장: before|after → before|after|applied
    op.drop_constraint('sql_performance_phase_check', 'sql_performance', type_='check')
    op.create_check_constraint(
        'sql_performance_phase_check', 'sql_performance',
        "phase IN ('before','after','applied')"
    )
    op.drop_constraint('sql_plans_phase_check', 'sql_plans', type_='check')
    op.create_check_constraint(
        'sql_plans_phase_check', 'sql_plans',
        "phase IN ('before','after','applied')"
    )

    # 3) tuning_requests.status CHECK 신규 추가
    op.create_check_constraint(
        'tuning_requests_status_check', 'tuning_requests',
        "status IN ('requested','tuning','completed','approved','applied','failed')"
    )

    # 4) sql_plans.cost 컬럼 코멘트
    op.alter_column('sql_plans', 'cost',
                    existing_type=sa.Integer(),
                    comment='Oracle optimizer cost (no unit)')


def downgrade() -> None:
    op.alter_column('sql_plans', 'cost', existing_type=sa.Integer(), comment=None)

    op.drop_constraint('tuning_requests_status_check', 'tuning_requests', type_='check')

    op.drop_constraint('sql_plans_phase_check', 'sql_plans', type_='check')
    op.create_check_constraint(
        'sql_plans_phase_check', 'sql_plans',
        "phase IN ('before','after')"
    )
    op.drop_constraint('sql_performance_phase_check', 'sql_performance', type_='check')
    op.create_check_constraint(
        'sql_performance_phase_check', 'sql_performance',
        "phase IN ('before','after')"
    )

    op.alter_column('sql_performance', 'rows_processed_count', new_column_name='rows_processed',
                    existing_type=sa.BigInteger())
    op.alter_column('sql_performance', 'executions_count', new_column_name='executions',
                    existing_type=sa.BigInteger())
    op.alter_column('sql_performance', 'disk_reads_count', new_column_name='disk_reads',
                    existing_type=sa.BigInteger())
    op.alter_column('sql_performance', 'buffer_gets_count', new_column_name='buffer_gets',
                    existing_type=sa.BigInteger())
    op.alter_column('sql_performance', 'cpu_time_sec', new_column_name='cpu_time',
                    existing_type=sa.Numeric())
    op.alter_column('sql_performance', 'elapsed_time_sec', new_column_name='elapsed_time',
                    existing_type=sa.Numeric())
