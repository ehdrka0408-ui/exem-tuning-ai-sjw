"""drop unused settings tables + add settings scaffold (ait_groups, users, instances, policy_settings)

Revision ID: m8h9i0j1k2l3
Revises: l7g8h9i0j1k2
Create Date: 2026-04-24 10:00:00.000000

변경 내용:
  Phase A. DROP — 백엔드 미사용 레거시 설정 테이블
    - model_configs, notifications, schedules, user_instructions
  Phase B. CREATE — 신규 설정 영역 (table_architecture.md §1 준거)
    - ENUM user_role (admin/tuner/viewer)
    - ait_groups       (4 grant 플래그 + seed 2건)
    - users            (role + group_id FK, seed 1건)
    - instances        (Pool/Timeout/CB 포함)
    - policy_settings  (KV 9건 seed)

보존 (백엔드·HTML 참조로 유지):
  db_instances / console_users / user_groups / llm_models / exception_sqls /
  plans / target_databases / target_schemas / tuning_cases / bind_variables

downgrade: DDL 복원 불가 (seed 및 데이터 손실 수반) — NotImplementedError
"""
from typing import Sequence, Union

from alembic import op


revision: str = "m8h9i0j1k2l3"
down_revision: Union[str, None] = "l7g8h9i0j1k2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Phase A. DROP ──────────────────────────────
    op.execute("DROP TABLE IF EXISTS public.model_configs      CASCADE")
    op.execute("DROP TABLE IF EXISTS public.notifications      CASCADE")
    op.execute("DROP TABLE IF EXISTS public.schedules          CASCADE")
    op.execute("DROP TABLE IF EXISTS public.user_instructions  CASCADE")

    # ── Phase B.0 ENUM ─────────────────────────────
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE user_role AS ENUM ('admin', 'tuner', 'viewer');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    # ── Phase B.1 ait_groups ───────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.ait_groups (
            group_id                BIGSERIAL   PRIMARY KEY,
            group_name              VARCHAR(64) NOT NULL UNIQUE,
            grant_request           BOOLEAN     NOT NULL DEFAULT FALSE,
            grant_user_group_manage BOOLEAN     NOT NULL DEFAULT FALSE,
            grant_auto              BOOLEAN     NOT NULL DEFAULT FALSE,
            grant_approval          BOOLEAN     NOT NULL DEFAULT FALSE,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        INSERT INTO public.ait_groups
          (group_name, grant_request, grant_user_group_manage, grant_auto, grant_approval)
        VALUES
          ('관리자', TRUE,  TRUE,  TRUE,  TRUE),
          ('튜너',   TRUE,  FALSE, FALSE, FALSE)
        ON CONFLICT (group_name) DO NOTHING
    """)

    # ── Phase B.2 users ────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.users (
            id              BIGSERIAL    PRIMARY KEY,
            email           VARCHAR(128) NOT NULL UNIQUE,
            name            VARCHAR(64)  NOT NULL,
            role            user_role    NOT NULL DEFAULT 'tuner',
            group_id        BIGINT       NULL,
            password_hash   VARCHAR(255) NULL,
            last_login_at   TIMESTAMPTZ  NULL,
            ip_limits       TEXT         NULL,
            is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
            phone           VARCHAR(32)  NULL,
            created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
            updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
            CONSTRAINT users_group_id_fkey
                FOREIGN KEY (group_id) REFERENCES public.ait_groups(group_id) ON DELETE SET NULL
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_users_group
            ON public.users(group_id) WHERE group_id IS NOT NULL
    """)
    op.execute("""
        INSERT INTO public.users (email, name, role, group_id, is_active, phone)
        VALUES ('admin@exem.local', 'Admin', 'admin', 1, TRUE, '010-1234-5678')
        ON CONFLICT (email) DO NOTHING
    """)

    # ── Phase B.3 instances ────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.instances (
            id                        BIGSERIAL    PRIMARY KEY,
            name                      VARCHAR(64)  NOT NULL UNIQUE,
            alias_name                VARCHAR(64)  NULL,
            db_groupname              VARCHAR(64)  NOT NULL DEFAULT '미지정',
            host                      VARCHAR(128) NOT NULL,
            port                      INT          NOT NULL DEFAULT 1521,
            sid                       VARCHAR(64)  NULL,
            service_name              VARCHAR(64)  NULL,
            db_type                   VARCHAR(16)  NOT NULL DEFAULT 'oracle',
            db_version                VARCHAR(32)  NULL,
            os_type                   VARCHAR(32)  NULL,
            username                  VARCHAR(64)  NOT NULL,
            password_encrypted        TEXT         NOT NULL,
            is_sysdba                 BOOLEAN      NOT NULL DEFAULT FALSE,
            is_active                 BOOLEAN      NOT NULL DEFAULT TRUE,
            pool_min                  INT          NOT NULL DEFAULT 1,
            pool_max                  INT          NOT NULL DEFAULT 4,
            pool_increment            INT          NOT NULL DEFAULT 1,
            pool_timeout_sec          INT          NOT NULL DEFAULT 10,
            pool_max_lifetime_sec     INT          NOT NULL DEFAULT 3600,
            stmt_cache_size           INT          NOT NULL DEFAULT 100,
            connect_timeout_sec       INT          NOT NULL DEFAULT 10,
            query_timeout_sec         INT          NOT NULL DEFAULT 30,
            cb_failure_threshold      INT          NOT NULL DEFAULT 5,
            cb_cooldown_sec           INT          NOT NULL DEFAULT 30,
            cb_success_threshold      INT          NOT NULL DEFAULT 1,
            health_status             VARCHAR(16)  NOT NULL DEFAULT 'unknown',
            last_health_check_at      TIMESTAMPTZ  NULL,
            last_tested_at            TIMESTAMPTZ  NULL,
            last_error_message        TEXT         NULL,
            created_at                TIMESTAMPTZ  NOT NULL DEFAULT now(),
            updated_at                TIMESTAMPTZ  NOT NULL DEFAULT now(),
            CONSTRAINT ck_sid_or_service
                CHECK (sid IS NOT NULL OR service_name IS NOT NULL),
            CONSTRAINT ck_pool_range
                CHECK (pool_min >= 1 AND pool_max >= pool_min),
            CONSTRAINT ck_timeouts_positive
                CHECK (pool_timeout_sec > 0 AND connect_timeout_sec > 0 AND query_timeout_sec > 0)
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_instances_active
            ON public.instances(is_active) WHERE is_active = TRUE
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_instances_health
            ON public.instances(health_status) WHERE health_status <> 'healthy'
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_instances_group
            ON public.instances(db_groupname)
    """)

    # ── Phase B.4 policy_settings ──────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.policy_settings (
            key         VARCHAR(128) PRIMARY KEY,
            value       JSONB        NOT NULL,
            description TEXT         NULL,
            updated_by  VARCHAR(64)  NULL,
            updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        INSERT INTO public.policy_settings (key, value, description) VALUES
          ('global.query_timeout_sec',    '30',          '전역 Oracle 쿼리 타임아웃 (sec)'),
          ('global.request_timeout_sec',  '45',          '전역 HTTP 요청 타임아웃 (sec)'),
          ('global.hold_ttl_days',        '7',           'AI Queue 보류 자동 만료일'),
          ('global.result_match.enabled', 'false',       '튜닝 결과셋 정합성 자동 검증'),
          ('exceptions.enabled',          'false',       'sql_exceptions 기능 활성'),
          ('auto_tuning.enabled',         'false',       '반복 자동튜닝 스케줄러 on/off'),
          ('auto_tuning.schedule_cron',   '"0 2 * * *"', '자동튜닝 cron'),
          ('ai.default_provider',         '"disabled"',  'AI 어댑터 초기값'),
          ('queue.backpressure_at',       '100',         'pending 적체 임계 (초과 시 503)')
        ON CONFLICT (key) DO NOTHING
    """)


def downgrade() -> None:
    raise NotImplementedError(
        "m8h9i0j1k2l3: 운영 정리 마이그레이션으로 downgrade 비지원. "
        "DROP된 model_configs/notifications/schedules/user_instructions 복원은 git history 참조."
    )
