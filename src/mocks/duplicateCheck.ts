// 중복 작업 체크 — 같은 sqlId에 이미 활성(in-flight) 작업이 있는지 확인
// 활성 (차단) = pending | tuning | approval_pending | apply_pending
// 종료 (허용) = applied | rejected | cancelled  → 재생성 허용
//
// 왜 종료 상태는 허용? 이미 적용되었지만 성능이 다시 나빠지는 재발 케이스,
// 반려된 건에 대한 재시도, 예외 해제 후 재요청 등 모두 유효한 시나리오.

import { workItems, type WorkItem } from './workItems'
import { getNewV1Items } from './newItemsStore'

const ACTIVE_STATUSES: ReadonlySet<WorkItem['status']> = new Set([
  'pending',
  'tuning',
  'approval_pending',
  'apply_pending',
])

export function isActiveStatus(status: WorkItem['status']): boolean {
  return ACTIVE_STATUSES.has(status)
}

function allWorkItems(): WorkItem[] {
  return [...workItems, ...getNewV1Items()]
}

/** 같은 sqlId 의 활성 작업이 있으면 반환 */
export function findActiveWorkItem(sqlId: string): WorkItem | undefined {
  return allWorkItems().find(w => w.sqlId === sqlId && isActiveStatus(w.status))
}

/** 같은 sqlId 의 활성 작업 존재 여부 (boolean) */
export function isActiveWorkItem(sqlId: string): boolean {
  return !!findActiveWorkItem(sqlId)
}

/** SQL 본문 기준 활성 작업 찾기 — DirectInput 전용 (공백 정규화, 대소문자 무시) */
export function findActiveWorkItemByText(sqlText: string): WorkItem | undefined {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()
  const target = norm(sqlText)
  if (!target) return undefined
  return allWorkItems().find(w => isActiveStatus(w.status) && norm(w.sqlText) === target)
}

const TERMINAL_STATUSES: ReadonlySet<WorkItem['status']> = new Set([
  'applied',
  'rejected',
  'cancelled',
])

/** 같은 sqlId 의 종료(terminal) 작업이 있으면 반환 — "기존 결과 있음" 뱃지용 */
export function findTerminalWorkItem(sqlId: string): WorkItem | undefined {
  return allWorkItems().find(w => w.sqlId === sqlId && TERMINAL_STATUSES.has(w.status))
}

/**
 * 야간 자동 튜닝 실행 시 중복으로 스킵된 건수 (mock 고정값).
 * 실제 구현: AI 자동 선정 결과 ↔ 기존 활성 작업 대조 후 스킵된 건수를 실행 메타에 기록.
 * demo 단계에서는 WorkPipeline meta 에 표시만 되면 되므로 상수로 처리.
 */
export const AUTO_DUPLICATE_EXCLUDED_COUNT = 4
