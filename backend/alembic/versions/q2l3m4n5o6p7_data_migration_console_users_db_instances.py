"""data migration: backup + console_users→users + db_instances→instances

Revision ID: q2l3m4n5o6p7
Revises: p1k2l3m4n5o6
Create Date: 2026-04-24 19:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'q2l3m4n5o6p7'
down_revision = 'p1k2l3m4n5o6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. 백업 CTAS
    op.execute("CREATE TABLE _bak_console_users_20260424 AS SELECT * FROM console_users")
    op.execute("CREATE TABLE _bak_db_instances_20260424 AS SELECT * FROM db_instances")

    # ── 2. users 에 legacy_console_id 컬럼 추가
    op.add_column('users', sa.Column('legacy_console_id', sa.String(32), nullable=True))

    # ── 3. console_users 5건 → users INSERT (bigint PK 자동 채번, group_id NULL, password_hash NULL)
    op.execute("""
        INSERT INTO users (email, name, role, group_id, password_hash, is_active, legacy_console_id)
        SELECT
            email,
            name,
            role::user_role,
            NULL,
            NULL,
            true,
            id
        FROM console_users
        ORDER BY id
    """)

    # ── 4. db_instances 1건 → instances INSERT
    #    NOT NULL 필드: name, host, port, db_type, username, password_encrypted,
    #                   db_groupname(default), health_status(default)
    #    password 는 PLACEHOLDER (관리자 재입력 필요)
    op.execute("""
        INSERT INTO instances (
            instance_id, name, alias_name, host, port, sid, db_type,
            username, password_encrypted, is_active, health_status
        )
        SELECT
            instance_id,
            name,
            alias AS alias_name,
            host,
            port,
            sid,
            lower(db_type),
            db_user,
            '[MIGRATION_PLACEHOLDER] original: ' || COALESCE(db_password, ''),
            CASE WHEN status = 'active' THEN true ELSE false END,
            COALESCE(status, 'unknown')
        FROM db_instances
        WHERE instance_id = 1
    """)
    # 시퀀스를 현재 최대값과 동기화 (instance_id=1 명시 INSERT 후)
    op.execute("SELECT setval('instances_instance_id_seq', (SELECT MAX(instance_id) FROM instances))")

    # ── 5. 관리자 재입력 필요 로그
    print("[migration] REPO instance password_encrypted set to PLACEHOLDER — admin must re-enter via UI or UPDATE")


def downgrade() -> None:
    # instances 에서 이관된 REPO 행 삭제 (백업에서 복원 가능)
    op.execute("DELETE FROM instances WHERE instance_id = 1 AND password_encrypted LIKE '[MIGRATION_PLACEHOLDER]%'")
    op.execute("SELECT setval('instances_instance_id_seq', COALESCE((SELECT MAX(instance_id) FROM instances), 0))")

    # users 에서 이관된 console_users 행 삭제
    op.execute("DELETE FROM users WHERE legacy_console_id IS NOT NULL")

    # legacy_console_id 컬럼 제거
    op.drop_column('users', 'legacy_console_id')

    # 백업 테이블 제거
    op.execute("DROP TABLE IF EXISTS _bak_console_users_20260424")
    op.execute("DROP TABLE IF EXISTS _bak_db_instances_20260424")
