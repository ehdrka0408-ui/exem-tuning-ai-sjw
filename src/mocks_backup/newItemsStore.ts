import type { WorkItem } from './workItems'
import type { V2WorkItem } from './v2WorkItems'

// 세션 스토어: 후보 화면에서 생성된 신규 작업 아이템 보관
// 페이지 새로고침 시 초기화됨 (mock이므로 OK)

let v1Counter = 100
let v2Counter = 100

const v1Items: WorkItem[] = []
const v2Items: V2WorkItem[] = []

/**
 * 즉시 튜닝 요청 — workItems 에 status='pending'으로 즉시 등록.
 * 예약 요청은 workItems 에 넣지 않고, QueueContext.addScheduledRequest 를 사용한다.
 */
export function addNewWorkItem(opts: {
  sqlId: string
  sqlText: string
  instanceName: string
  schemaName: string
  source: WorkItem['source']
  executionContext?: 'OLTP' | 'Batch'
  estimatedDailyExec?: number
  selectionSource?: 'auto' | 'manual'
  queryTimeoutSec?: number
  scheduledAt?: string
  alias?: string
}): { v1Id: string; v2Id: string } {
  void opts.scheduledAt // 예약 시각은 현재 mock 파이프라인에서 사용하지 않음 (즉시 pending 등록). 시그니처 호환성 유지용.
  const now = new Date().toISOString()
  const v1Id = `WI-NEW-${String(v1Counter++).padStart(3, '0')}`
  const v2Id = `V2-NEW-${String(v2Counter++).padStart(3, '0')}`

  const workName = `${opts.sqlId} 튜닝 요청`

  v1Items.push({
    id: v1Id,
    sqlId: opts.sqlId,
    sqlText: opts.sqlText,
    status: 'pending',
    type: 'tuning',
    createdAt: now,
    updatedAt: now,
    assignee: '김민수',
    instanceName: opts.instanceName,
    schemaName: opts.schemaName,
    workName,
    alias: opts.alias,
    selectionSource: opts.selectionSource ?? 'manual',
    originalElapsed: 5000 + Math.floor(Math.random() * 40000),
    originalBuffers: 500000 + Math.floor(Math.random() * 4000000),
    source: opts.source,
    executionContext: opts.executionContext ?? 'OLTP',
    estimatedDailyExec: opts.estimatedDailyExec ?? 1000,
    batchId: `REQ-MANUAL-${Date.now()}`,
    batchMemo: '수동 튜닝 요청',
    queuePosition: v1Items.length + 1,
    queryTimeoutSec: opts.queryTimeoutSec,
  })

  v2Items.push({
    id: v2Id,
    sqlId: opts.sqlId,
    sqlText: opts.sqlText,
    status: 'pending',
    type: 'tuning',
    createdAt: now,
    updatedAt: now,
    assignee: '김민수',
    instanceName: opts.instanceName,
    schemaName: opts.schemaName,
    workName,
    alias: opts.alias,
    selectionSource: opts.selectionSource ?? 'manual',
    originalElapsed: 5000 + Math.floor(Math.random() * 40000),
    originalBuffers: 500000 + Math.floor(Math.random() * 4000000),
    source: opts.source,
    executionContext: opts.executionContext ?? 'OLTP',
    estimatedDailyExec: opts.estimatedDailyExec ?? 1000,
    batchId: `REQ-MANUAL-${Date.now()}`,
    batchMemo: '수동 튜닝 요청',
    queryTimeoutSec: opts.queryTimeoutSec,
  })

  return { v1Id, v2Id }
}

export function getNewV1Items(): WorkItem[] {
  return [...v1Items]
}

export function getNewV2Items(): V2WorkItem[] {
  return [...v2Items]
}

// ── 큐 순서 관리 ──────────────────────────────────────
// 수동 재정렬된 pending 아이템 ID 순서 (맨 앞 = 다음 처리 대상)
let queueOrder: string[] = []

export function getQueueOrder(): readonly string[] {
  return queueOrder
}

export function setQueueFront(id: string): void {
  queueOrder = [id, ...queueOrder.filter(x => x !== id)]
  window.dispatchEvent(new Event('queueOrderChange'))
}

export function reorderQueue(orderedIds: string[]): void {
  queueOrder = [...orderedIds]
  window.dispatchEvent(new Event('queueOrderChange'))
}

// ── 전역 상태 오버라이드 (알림 재시도 등) ─────────────
// 알림에서 재시도 버튼 → 해당 작업의 상태를 pending/apply_pending으로 복원
const globalStatusOverrides = new Map<string, WorkItem['status']>()

export function setGlobalStatusOverride(workId: string, status: WorkItem['status']): void {
  globalStatusOverrides.set(workId, status)
  window.dispatchEvent(new Event('globalStatusOverrideChange'))
}

export function getGlobalStatusOverrides(): ReadonlyMap<string, WorkItem['status']> {
  return globalStatusOverrides
}
