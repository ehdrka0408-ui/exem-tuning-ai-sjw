"""rev5: retarget instance FKs to instances table, drop db_instances + console_users

Revision ID: t5o6p7q8r9s0
Revises: s4n5o6p7q8r9
Create Date: 2026-04-24 20:15:00.000000

"""
from alembic import op

revision = 't5o6p7q8r9s0'
down_revision = 's4n5o6p7q8r9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. tuning_requests.instance_id FK: db_instances → instances
    op.drop_constraint('tuning_requests_instance_id_fkey', 'tuning_requests', type_='foreignkey')
    op.create_foreign_key(
        'tuning_requests_instance_id_fkey',
        'tuning_requests', 'instances',
        ['instance_id'], ['instance_id'],
    )

    # ── 2. sql_texts.instance_id FK: db_instances → instances
    op.drop_constraint('sql_texts_instance_id_fkey', 'sql_texts', type_='foreignkey')
    op.create_foreign_key(
        'sql_texts_instance_id_fkey',
        'sql_texts', 'instances',
        ['instance_id'], ['instance_id'],
    )

    # ── 3. DROP db_instances (백업은 rev2 에서 생성됨)
    op.drop_table('db_instances')

    # ── 4. DROP console_users (백업은 rev2 에서 생성됨)
    op.drop_table('console_users')


def downgrade() -> None:
    import sqlalchemy as sa
    # console_users 재생성 (백업에서 수동 복원 필요)
    op.create_table(
        'console_users',
        sa.Column('id', sa.String(32), primary_key=True),
        sa.Column('name', sa.String(64), nullable=False),
        sa.Column('email', sa.String(128), nullable=False),
        sa.Column('role', sa.String(32), nullable=False),
        sa.Column('last_login', sa.String(32), nullable=True),
        sa.Column('group_id', sa.String(64), nullable=True),
        sa.Column('permissions', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    )

    # db_instances 재생성 (백업에서 수동 복원 필요)
    op.create_table(
        'db_instances',
        sa.Column('instance_id', sa.BigInteger(), primary_key=True),
        sa.Column('name', sa.String(64), nullable=False),
        sa.Column('host', sa.String(128), nullable=False),
        sa.Column('port', sa.Integer(), nullable=False),
        sa.Column('db_type', sa.String(32), nullable=False),
        sa.Column('status', sa.String(32), nullable=True),
        sa.Column('sid', sa.String(64), nullable=True),
        sa.Column('db_user', sa.String(64), nullable=True),
        sa.Column('db_password', sa.String(128), nullable=True),
        sa.Column('schema_name', sa.String(128), nullable=True),
        sa.Column('alias', sa.String(128), nullable=True),
        sa.Column('instance_type', sa.String(32), nullable=True),
    )

    # FK 원복
    op.drop_constraint('sql_texts_instance_id_fkey', 'sql_texts', type_='foreignkey')
    op.create_foreign_key(
        'sql_texts_instance_id_fkey',
        'sql_texts', 'db_instances',
        ['instance_id'], ['instance_id'],
    )
    op.drop_constraint('tuning_requests_instance_id_fkey', 'tuning_requests', type_='foreignkey')
    op.create_foreign_key(
        'tuning_requests_instance_id_fkey',
        'tuning_requests', 'db_instances',
        ['instance_id'], ['instance_id'],
    )
