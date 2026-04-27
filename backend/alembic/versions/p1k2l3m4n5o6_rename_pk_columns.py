"""rename PK columns: users.id→user_id, llm_models.id→llm_id, instances.id→instance_id; tuning_requests.instance_id int→bigint

Revision ID: p1k2l3m4n5o6
Revises: o0j1k2l3m4n5
Create Date: 2026-04-24 19:00:00.000000

"""
from alembic import op

revision = 'p1k2l3m4n5o6'
down_revision = 'o0j1k2l3m4n5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. tuning_requests_llm_id_fkey DROP (llm_models.id 참조 → 리네임 전 제거)
    op.drop_constraint('tuning_requests_llm_id_fkey', 'tuning_requests', type_='foreignkey')

    # ── 2. llm_models.id → llm_id
    op.alter_column('llm_models', 'id', new_column_name='llm_id')
    op.execute("ALTER SEQUENCE llm_models_id_seq RENAME TO llm_models_llm_id_seq")
    op.execute("ALTER TABLE llm_models ALTER COLUMN llm_id SET DEFAULT nextval('llm_models_llm_id_seq')")

    # ── 3. tuning_requests.llm_id FK 재생성 (llm_models.llm_id 참조)
    op.create_foreign_key(
        'tuning_requests_llm_id_fkey',
        'tuning_requests', 'llm_models',
        ['llm_id'], ['llm_id'],
    )

    # ── 4. users.id → user_id
    op.alter_column('users', 'id', new_column_name='user_id')
    op.execute("ALTER SEQUENCE users_id_seq RENAME TO users_user_id_seq")
    op.execute("ALTER TABLE users ALTER COLUMN user_id SET DEFAULT nextval('users_user_id_seq')")

    # ── 5. instances.id → instance_id
    op.alter_column('instances', 'id', new_column_name='instance_id')
    op.execute("ALTER SEQUENCE instances_id_seq RENAME TO instances_instance_id_seq")
    op.execute("ALTER TABLE instances ALTER COLUMN instance_id SET DEFAULT nextval('instances_instance_id_seq')")

    # ── 6. tuning_requests.instance_id: integer → bigint (FK 대상인 db_instances.instance_id 는 bigint)
    op.execute("ALTER TABLE tuning_requests ALTER COLUMN instance_id TYPE BIGINT USING instance_id::BIGINT")


def downgrade() -> None:
    # ── 6. tuning_requests.instance_id: bigint → integer
    op.execute("ALTER TABLE tuning_requests ALTER COLUMN instance_id TYPE INTEGER USING instance_id::INTEGER")

    # ── 5. instances.instance_id → id
    op.execute("ALTER SEQUENCE instances_instance_id_seq RENAME TO instances_id_seq")
    op.execute("ALTER TABLE instances ALTER COLUMN instance_id SET DEFAULT nextval('instances_id_seq')")
    op.alter_column('instances', 'instance_id', new_column_name='id')

    # ── 4. users.user_id → id
    op.execute("ALTER SEQUENCE users_user_id_seq RENAME TO users_id_seq")
    op.execute("ALTER TABLE users ALTER COLUMN user_id SET DEFAULT nextval('users_id_seq')")
    op.alter_column('users', 'user_id', new_column_name='id')

    # ── 3. tuning_requests_llm_id_fkey DROP (llm_models.llm_id 참조)
    op.drop_constraint('tuning_requests_llm_id_fkey', 'tuning_requests', type_='foreignkey')

    # ── 2. llm_models.llm_id → id
    op.execute("ALTER SEQUENCE llm_models_llm_id_seq RENAME TO llm_models_id_seq")
    op.execute("ALTER TABLE llm_models ALTER COLUMN llm_id SET DEFAULT nextval('llm_models_id_seq')")
    op.alter_column('llm_models', 'llm_id', new_column_name='id')

    # ── 1. tuning_requests_llm_id_fkey 재생성 (llm_models.id 참조)
    op.create_foreign_key(
        'tuning_requests_llm_id_fkey',
        'tuning_requests', 'llm_models',
        ['llm_id'], ['id'],
    )
