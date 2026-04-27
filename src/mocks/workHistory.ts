export type HistoryEventType =
  | 'created'
  | 'tuning_started'
  | 'tuning_completed'
  | 'approved'
  | 'retune_requested'
  | 'rejected'
  | 'exported'
  | 'applied'
  | 'cancelled'

export interface WorkHistoryEvent {
  timestamp: string
  type: HistoryEventType
  actor?: string
  note?: string
  /** 반려 사유 — type === 'rejected'인 이벤트에서만 사용 */
  reason?: string
}

/** 런타임에 새 이벤트를 이력 맨 앞에 추가 (mock 전용) */
export function addHistoryEvent(workItemId: string, event: WorkHistoryEvent) {
  const list = workHistory[workItemId] ?? (workHistory[workItemId] = [])
  list.unshift(event)
}

const ACTORS = {
  system: 'System',
  ai: 'AI Engine',
  kimjs: '김정수',
  parksh: '박상현',
  leejw: '이지원',
}

export const workHistory: Record<string, WorkHistoryEvent[]> = {}
