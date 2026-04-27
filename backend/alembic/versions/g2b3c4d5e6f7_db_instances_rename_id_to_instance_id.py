"""db_instances: PK 컬럼 id → instance_id rename + 의존 FK 이름 정비

Revision ID: g2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-04-23 14:30:00.000000

변경 내용:
  1) ALTER TABLE db_instances RENAME COLUMN id TO instance_id
     - PostgreSQL은 컬럼 rename 시 FK 참조가 자동으로 갱신됨 (물리 참조 유지)
     - 기존 FK constraint는 이름만 변경 (drop → recreate)
       * sql_texts_instance_id_fkey     → 이름 유지 (이미 instance_id 기준)
       * tuning_requests_instance_id_fkey → 이름 유지 (이미 instance_id 기준)
  2) PK constraint 이름 변경: db_instances_pkey (변경 없음, 자동 추적)
  3) 시퀀스 없음 (db_instances.id 는 수동 입력 PK, default NULL 확인됨)

FK drop/recreate 필요: PostgreSQL은 RENAME COLUMN 후 FK가 새 컬럼명을 추적하므로
constraint 자체는 유지. 단, constraint 이름에 'id' 가 들어간 경우는 없으므로 rename 불필요.

멱등 보장: 컬럼명 존재 여부 확인 후 분기
"""
from alembic import op
import sqlalchemy as sa


revision = 'g2b3c4d5e6f7'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # 이미 rename 완료 여부 확인
    new_col_exists = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name='db_instances' AND column_name='instance_id'"
    )).scalar()
    old_col_exists = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name='db_instances' AND column_name='id'"
    )).scalar()

    if old_col_exists and not new_col_exists:
        # FK 일시 해제 후 rename — PostgreSQL은 RENAME COLUMN이 FK를 자동 추적하므로
        # drop/recreate 없이 rename만으로 충분. 단 안전을 위해 FK 이름도 정비.

        # Step 1: 기존 FK drop
        sql_texts_fk = conn.execute(sa.text(
            "SELECT 1 FROM information_schema.table_constraints "
            "WHERE table_schema='public' AND constraint_name='sql_texts_instance_id_fkey'"
        )).scalar()
        tr_fk = conn.execute(sa.text(
            "SELECT 1 FROM information_schema.table_constraints "
            "WHERE table_schema='public' AND constraint_name='tuning_requests_instance_id_fkey'"
        )).scalar()

        if sql_texts_fk:
            op.drop_constraint('sql_texts_instance_id_fkey', 'sql_texts', type_='foreignkey')
        if tr_fk:
            op.drop_constraint('tuning_requests_instance_id_fkey', 'tuning_requests', type_='foreignkey')

        # Step 2: PK drop
        op.drop_constraint('db_instances_pkey', 'db_instances', type_='primary')

        # Step 3: 컬럼 rename
        op.alter_column('db_instances', 'id', new_column_name='instance_id')

        # Step 4: PK recreate
        op.create_primary_key('db_instances_pkey', 'db_instances', ['instance_id'])

        # Step 5: FK recreate (동일 이름 유지 — 이미 'instance_id' 기반 네이밍이므로 일관)
        if sql_texts_fk:
            op.create_foreign_key(
                'sql_texts_instance_id_fkey',
                'sql_texts', 'db_instances',
                ['instance_id'], ['instance_id'],
            )
        if tr_fk:
            op.create_foreign_key(
                'tuning_requests_instance_id_fkey',
                'tuning_requests', 'db_instances',
                ['instance_id'], ['instance_id'],
            )


def downgrade() -> None:
    conn = op.get_bind()

    new_col_exists = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name='db_instances' AND column_name='instance_id'"
    )).scalar()
    old_col_exists = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name='db_instances' AND column_name='id'"
    )).scalar()

    if new_col_exists and not old_col_exists:
        sql_texts_fk = conn.execute(sa.text(
            "SELECT 1 FROM information_schema.table_constraints "
            "WHERE table_schema='public' AND constraint_name='sql_texts_instance_id_fkey'"
        )).scalar()
        tr_fk = conn.execute(sa.text(
            "SELECT 1 FROM information_schema.table_constraints "
            "WHERE table_schema='public' AND constraint_name='tuning_requests_instance_id_fkey'"
        )).scalar()

        if sql_texts_fk:
            op.drop_constraint('sql_texts_instance_id_fkey', 'sql_texts', type_='foreignkey')
        if tr_fk:
            op.drop_constraint('tuning_requests_instance_id_fkey', 'tuning_requests', type_='foreignkey')

        op.drop_constraint('db_instances_pkey', 'db_instances', type_='primary')
        op.alter_column('db_instances', 'instance_id', new_column_name='id')
        op.create_primary_key('db_instances_pkey', 'db_instances', ['id'])

        if sql_texts_fk:
            op.create_foreign_key(
                'sql_texts_instance_id_fkey',
                'sql_texts', 'db_instances',
                ['instance_id'], ['id'],
            )
        if tr_fk:
            op.create_foreign_key(
                'tuning_requests_instance_id_fkey',
                'tuning_requests', 'db_instances',
                ['instance_id'], ['id'],
            )
