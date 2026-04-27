"""extend tuning_requests status check with 'rejected'

Revision ID: a4d5e6f7b820
Revises: 9c3a4d5b6e71
Create Date: 2026-04-17 18:55:00.000000
"""
from typing import Sequence, Union
from alembic import op


revision: str = 'a4d5e6f7b820'
down_revision: Union[str, None] = '9c3a4d5b6e71'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint('tuning_requests_status_check', 'tuning_requests', type_='check')
    op.create_check_constraint(
        'tuning_requests_status_check', 'tuning_requests',
        "status IN ('requested','tuning','completed','approved','applied','failed','rejected')"
    )


def downgrade() -> None:
    op.drop_constraint('tuning_requests_status_check', 'tuning_requests', type_='check')
    op.create_check_constraint(
        'tuning_requests_status_check', 'tuning_requests',
        "status IN ('requested','tuning','completed','approved','applied','failed')"
    )
