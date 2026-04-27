"""add alias + instance_type to db_instances and reseed INS-REPO

Revision ID: b5e6f7a8c930
Revises: a4d5e6f7b820
Create Date: 2026-04-21 09:50:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'b5e6f7a8c930'
down_revision: Union[str, None] = 'a4d5e6f7b820'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('db_instances', sa.Column('alias', sa.String(length=64), nullable=True))
    op.add_column('db_instances',
                  sa.Column('instance_type', sa.String(length=16), nullable=True))
    op.create_check_constraint(
        'db_instances_instance_type_check', 'db_instances',
        "instance_type IS NULL OR instance_type IN ('production','staging','development')"
    )


def downgrade() -> None:
    op.drop_constraint('db_instances_instance_type_check', 'db_instances', type_='check')
    op.drop_column('db_instances', 'instance_type')
    op.drop_column('db_instances', 'alias')
