"""rename item_count→request_count; sync group meta into tuning_requests

Revision ID: o0j1k2l3m4n5
Revises: n9i0j1k2l3m4
Create Date: 2026-04-24 11:00:00.000000

변경 내용:
  1) tuning_request_group.item_count → request_count (컬럼 rename)
     - CHECK 제약도 re-bind (기존 ck_tuning_request_item_count 삭제 후 재생성)
  2) tuning_requests 에 그룹 메타 동기화 컬럼 추가 (NULLABLE)
     - request_group_name VARCHAR(128)
     - request_source     VARCHAR(16)  + CHECK (AWR/V$SQL/MG/DIRECT)
     - scheduled_at       TIMESTAMPTZ
  3) 기존 백필: tuning_requests.group_id 기준으로 group 의 메타를 개별 row 에 복사
     (alias, user_id 는 기존부터 동기화되어 별도 backfill 불필요)
"""
from typing import Sequence, Union
from alembic import op

revision: str = "o0j1k2l3m4n5"
down_revision: Union[str, None] = "n9i0j1k2l3m4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) item_count → request_count
    op.execute("ALTER TABLE public.tuning_request_group DROP CONSTRAINT IF EXISTS ck_tuning_request_item_count")
    op.execute("ALTER TABLE public.tuning_request_group RENAME COLUMN item_count TO request_count")
    op.execute("""
        ALTER TABLE public.tuning_request_group
            ADD CONSTRAINT ck_tuning_request_count
            CHECK (request_count >= 0)
    """)

    # 2) tuning_requests 에 그룹 메타 동기화 컬럼 (nullable 로 추가)
    op.execute("ALTER TABLE public.tuning_requests ADD COLUMN IF NOT EXISTS request_group_name VARCHAR(128)")
    op.execute("ALTER TABLE public.tuning_requests ADD COLUMN IF NOT EXISTS request_source    VARCHAR(16)")
    op.execute("ALTER TABLE public.tuning_requests ADD COLUMN IF NOT EXISTS scheduled_at      TIMESTAMPTZ")
    op.execute("""
        ALTER TABLE public.tuning_requests
            ADD CONSTRAINT ck_tr_request_source
            CHECK (request_source IS NULL OR request_source IN ('AWR','V$SQL','MG','DIRECT'))
    """)

    # 3) 기존 tuning_requests row 에 그룹 메타 백필
    op.execute("""
        UPDATE public.tuning_requests tr
        SET request_group_name = g.request_group_name,
            request_source     = g.request_source,
            scheduled_at       = g.scheduled_at
        FROM public.tuning_request_group g
        WHERE g.group_id = tr.group_id
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE public.tuning_requests DROP CONSTRAINT IF EXISTS ck_tr_request_source")
    op.execute("ALTER TABLE public.tuning_requests DROP COLUMN IF EXISTS scheduled_at")
    op.execute("ALTER TABLE public.tuning_requests DROP COLUMN IF EXISTS request_source")
    op.execute("ALTER TABLE public.tuning_requests DROP COLUMN IF EXISTS request_group_name")
    op.execute("ALTER TABLE public.tuning_request_group DROP CONSTRAINT IF EXISTS ck_tuning_request_count")
    op.execute("ALTER TABLE public.tuning_request_group RENAME COLUMN request_count TO item_count")
    op.execute("""
        ALTER TABLE public.tuning_request_group
            ADD CONSTRAINT ck_tuning_request_item_count CHECK (item_count >= 0)
    """)
