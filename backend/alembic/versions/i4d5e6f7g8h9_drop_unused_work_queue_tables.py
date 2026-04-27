"""drop unused work_items, queue_items, work_item_snapshots, work_history

Revision ID: i4d5e6f7g8h9
Revises: h3c4d5e6f7g8
Create Date: 2026-04-23 14:00:00.000000

변경 내용:
  - 백엔드 모델/API 미존재, 프론트는 mock 데이터로만 사용중인 placeholder 테이블 정리
  - 유일한 실데이터 흐름은 tuning_requests로 일원화됨

DROP 순서 (FK 자식 → 부모):
  1) work_history          (FK→work_items, ON DELETE CASCADE)
  2) work_item_snapshots   (FK→work_items, ON DELETE CASCADE)
  3) queue_items           (FK 없음)
  4) work_items            (참조 정리 후)

downgrade: 복원 불필요 (영구 정리)
"""
from typing import Sequence, Union

from alembic import op


revision: str = "i4d5e6f7g8h9"
down_revision: Union[str, None] = "h3c4d5e6f7g8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.work_history CASCADE")
    op.execute("DROP TABLE IF EXISTS public.work_item_snapshots CASCADE")
    op.execute("DROP TABLE IF EXISTS public.queue_items CASCADE")
    op.execute("DROP TABLE IF EXISTS public.work_items CASCADE")


def downgrade() -> None:
    raise NotImplementedError(
        "i4d5e6f7g8h9: work_items/queue_items/work_item_snapshots/work_history는 "
        "사용되지 않아 영구 제거됨. 복원이 필요하면 git history에서 이전 정의를 참조하라."
    )
