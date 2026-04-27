"""add tuning_request_group + tuning_requests.group_id FK (backfill legacy)

Revision ID: n9i0j1k2l3m4
Revises: m8h9i0j1k2l3
Create Date: 2026-04-24 10:30:00.000000

변경 내용:
  1) CREATE TABLE tuning_request_group (UUID PK, request_source CHECK 4값)
  2) ALTER tuning_requests ADD group_id UUID (NULLABLE 임시)
  3) 기존 tuning_requests N건을 1:1 로 legacy group 으로 백필
     - 단건 N개 → 각각 독립 그룹 1개 (item_count=1)
     - 이후에는 앱 레벨에서 단건=그룹1건, 일괄=그룹1+requests N건 규칙
  4) tuning_requests.group_id NOT NULL 전환 + FK + 인덱스

downgrade: FK/컬럼/테이블 DROP (백필 데이터 소실)
"""
from typing import Sequence, Union
from alembic import op

revision: str = "n9i0j1k2l3m4"
down_revision: Union[str, None] = "m8h9i0j1k2l3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 0. UUID 생성 함수 확보 ─────────────────
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    # ── 1. tuning_request_group ────────────────
    op.execute("""
        CREATE TABLE public.tuning_request_group (
            group_id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            request_group_name   VARCHAR(128) NULL,
            alias                TEXT         NULL,
            instance_id          BIGINT       NOT NULL,
            request_source       VARCHAR(16)  NOT NULL,
            created_by           VARCHAR(64)  NOT NULL,
            created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
            scheduled_at         TIMESTAMPTZ  NULL,
            item_count           INT          NOT NULL DEFAULT 0,
            CONSTRAINT ck_tuning_request_source
                CHECK (request_source IN ('AWR','V$SQL','MG','DIRECT')),
            CONSTRAINT ck_tuning_request_item_count
                CHECK (item_count >= 0)
        )
    """)
    op.execute("CREATE INDEX idx_trg_created_at  ON public.tuning_request_group(created_at DESC)")
    op.execute("CREATE INDEX idx_trg_instance    ON public.tuning_request_group(instance_id)")
    op.execute("CREATE INDEX idx_trg_created_by  ON public.tuning_request_group(created_by)")
    op.execute("CREATE INDEX idx_trg_scheduled   ON public.tuning_request_group(scheduled_at) WHERE scheduled_at IS NOT NULL")

    # ── 2. tuning_requests.group_id (NULLABLE 임시) ─
    op.execute("ALTER TABLE public.tuning_requests ADD COLUMN IF NOT EXISTS group_id UUID NULL")

    # ── 3. 기존 N건 백필: 1행 = 1그룹 ─────────────
    #   request_source 매핑: 기존 source='ui' → 'DIRECT'
    op.execute("""
        DO $$
        DECLARE
            r RECORD;
            new_gid UUID;
        BEGIN
            FOR r IN
                SELECT request_id, instance_id, alias, user_id, requested_at
                FROM public.tuning_requests
                WHERE group_id IS NULL
                ORDER BY request_id
            LOOP
                INSERT INTO public.tuning_request_group
                    (request_group_name, alias, instance_id, request_source,
                     created_by, created_at, item_count)
                VALUES (
                    COALESCE(r.alias, 'legacy-#' || r.request_id::text),
                    r.alias,
                    r.instance_id::bigint,
                    'DIRECT',
                    COALESCE(r.user_id, 'system'),
                    r.requested_at,
                    1
                )
                RETURNING group_id INTO new_gid;

                UPDATE public.tuning_requests
                   SET group_id = new_gid
                 WHERE request_id = r.request_id;
            END LOOP;
        END $$;
    """)

    # ── 4. NOT NULL + FK + 인덱스 ────────────────
    op.execute("ALTER TABLE public.tuning_requests ALTER COLUMN group_id SET NOT NULL")
    op.execute("""
        ALTER TABLE public.tuning_requests
            ADD CONSTRAINT fk_tuning_requests_group_id
            FOREIGN KEY (group_id) REFERENCES public.tuning_request_group(group_id)
    """)
    op.execute("CREATE INDEX idx_tuning_requests_group_id ON public.tuning_requests(group_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_tuning_requests_group_id")
    op.execute("ALTER TABLE public.tuning_requests DROP CONSTRAINT IF EXISTS fk_tuning_requests_group_id")
    op.execute("ALTER TABLE public.tuning_requests DROP COLUMN IF EXISTS group_id")
    op.execute("DROP TABLE IF EXISTS public.tuning_request_group")
