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

export const workHistory: Record<string, WorkHistoryEvent[]> = {
  // apply_pending 상태 — 풀 이력
  'WI-2024-004': [
    { timestamp: '2026-04-02T09:30:00', type: 'approved', actor: ACTORS.kimjs, note: '인덱스안 채택, 야간 배치 시 인덱스 생성 예정' },
    { timestamp: '2026-04-02T02:45:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T02:15:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정 (Buffer Gets 상위 5%)' },
  ],
  'WI-2024-005': [
    { timestamp: '2026-04-02T10:15:00', type: 'approved', actor: ACTORS.kimjs },
    { timestamp: '2026-04-02T03:30:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T03:10:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정 (Elapsed 상위 10%)' },
  ],
  // applied 상태 — export + applied 포함
  'WI-2024-006': [
    { timestamp: '2026-04-03T14:00:00', type: 'applied', actor: ACTORS.parksh, note: 'PRD 반영 완료' },
    { timestamp: '2026-04-03T10:30:00', type: 'exported', actor: ACTORS.kimjs, note: '개발팀(박상현) 전달' },
    { timestamp: '2026-04-02T11:00:00', type: 'approved', actor: ACTORS.kimjs },
    { timestamp: '2026-04-02T02:00:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:45:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정' },
  ],
  // retune_requested 이력 포함
  'WI-2024-007': [
    { timestamp: '2026-04-03T03:00:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-03T02:30:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T15:20:00', type: 'retune_requested', actor: ACTORS.kimjs, note: '바인드 민감 — 다른 바인드셋으로 재검증 필요' },
    { timestamp: '2026-04-02T03:00:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T02:30:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정 (Elapsed 상위 5%)' },
  ],
  'WI-2024-008': [
    { timestamp: '2026-04-02T03:15:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T02:45:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정' },
  ],
  'WI-2024-003': [
    { timestamp: '2026-04-02T02:00:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:30:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정' },
  ],
  // rejected
  'WI-2024-015': [
    { timestamp: '2026-04-02T11:30:00', type: 'rejected', actor: ACTORS.kimjs, reason: '동적 SQL — 튜닝 대상 아님' },
    { timestamp: '2026-04-02T03:30:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T03:00:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정' },
  ],
  // applied — 인덱스 생성 후 SQL 전달까지 풀 사이클
  'WI-2024-001': [
    { timestamp: '2026-04-03T11:00:00', type: 'applied', actor: ACTORS.leejw, note: '개발서버 반영, PRD 다음 배포 예정' },
    { timestamp: '2026-04-03T09:00:00', type: 'exported', actor: ACTORS.kimjs, note: '개발팀(이지원) SQL 변경분 전달' },
    { timestamp: '2026-04-03T22:30:00', type: 'applied', actor: ACTORS.parksh, note: '인덱스 IDX_TAX_CC_DT 야간 생성 완료' },
    { timestamp: '2026-04-03T10:00:00', type: 'approved', actor: ACTORS.kimjs, note: '인덱스안 채택' },
    { timestamp: '2026-04-02T01:30:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T00:30:00', type: 'created', actor: ACTORS.system, note: '자동 선정 (Buffer Gets 상위 3%)' },
  ],
  // 기본 이력 (대부분의 approval_pending 상태)
  'WI-2024-019': [
    { timestamp: '2026-04-02T02:30:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T02:00:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정' },
  ],
  'WI-2024-020': [
    { timestamp: '2026-04-02T10:45:00', type: 'approved', actor: ACTORS.parksh },
    { timestamp: '2026-04-02T01:45:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:15:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정' },
  ],
  'WI-2024-021': [
    { timestamp: '2026-04-02T03:20:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T02:50:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정' },
  ],
  'WI-2024-022': [
    { timestamp: '2026-04-02T02:20:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:50:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '수동 선정 (김정수)' },
  ],
  // 재튜닝 이력 — pending으로 복귀한 건 (retuneCount=1)
  'WI-2024-045': [
    { timestamp: '2026-04-01T12:00:00', type: 'retune_requested', actor: ACTORS.kimjs, note: '인덱스만으로는 개선 부족 — 힌트 포함 재분석 요청' },
    { timestamp: '2026-04-01T04:30:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-01T03:45:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-01T02:00:00', type: 'created', actor: ACTORS.system, note: '수동 선정 (CRM 스키마)' },
  ],

  // ─── approval_pending 상태 ───
  'WI-2024-023': [
    { timestamp: '2026-04-02T03:10:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T02:40:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정' },
  ],
  'WI-2024-024': [
    { timestamp: '2026-04-02T02:55:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T02:25:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정' },
  ],
  'WI-2024-025': [
    { timestamp: '2026-04-02T03:40:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T03:00:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정' },
  ],
  'WI-2024-034': [
    { timestamp: '2026-04-03T15:00:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-03T14:35:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-03T14:30:00', type: 'created', actor: ACTORS.kimjs, note: '수동 선정 (TOP SQL)' },
  ],
  'WI-2024-035': [
    { timestamp: '2026-04-03T15:15:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-03T14:50:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-03T14:30:00', type: 'created', actor: ACTORS.kimjs, note: '수동 선정 (TOP SQL)' },
  ],
  'WI-2024-049': [
    { timestamp: '2026-04-02T02:40:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T02:10:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정' },
  ],
  'WI-2024-051': [
    { timestamp: '2026-04-02T04:00:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T03:20:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정' },
  ],

  // ─── apply_pending 상태 ───
  'WI-2024-026': [
    { timestamp: '2026-04-02T09:00:00', type: 'approved', actor: ACTORS.kimjs },
    { timestamp: '2026-04-02T02:50:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T02:20:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정' },
  ],
  'WI-2024-027': [
    { timestamp: '2026-04-02T09:15:00', type: 'approved', actor: ACTORS.leejw },
    { timestamp: '2026-04-02T03:00:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T02:30:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정' },
  ],
  'WI-2024-028': [
    { timestamp: '2026-04-02T09:20:00', type: 'approved', actor: ACTORS.parksh },
    { timestamp: '2026-04-02T03:15:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T02:45:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정' },
  ],
  'WI-2024-029': [
    { timestamp: '2026-04-02T09:30:00', type: 'approved', actor: ACTORS.kimjs },
    { timestamp: '2026-04-02T02:30:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T02:00:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정' },
  ],
  'WI-2024-030': [
    { timestamp: '2026-04-02T09:45:00', type: 'approved', actor: ACTORS.leejw },
    { timestamp: '2026-04-02T03:30:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T03:00:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정' },
  ],
  'WI-2024-036': [
    { timestamp: '2026-04-01T15:00:00', type: 'approved', actor: ACTORS.leejw },
    { timestamp: '2026-04-01T10:30:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-01T10:00:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-01T09:30:00', type: 'created', actor: ACTORS.kimjs, note: '수동 선정 (TOP SQL)' },
  ],
  'WI-2024-037': [
    { timestamp: '2026-04-01T16:00:00', type: 'approved', actor: ACTORS.kimjs },
    { timestamp: '2026-04-01T10:45:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-01T10:15:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-01T09:30:00', type: 'created', actor: ACTORS.kimjs, note: '수동 선정 (TOP SQL)' },
  ],
  'WI-2024-038': [
    { timestamp: '2026-04-01T17:00:00', type: 'approved', actor: ACTORS.leejw },
    { timestamp: '2026-04-01T11:00:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-01T10:30:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-01T10:00:00', type: 'created', actor: ACTORS.parksh, note: '수동 선정 (TOP SQL)' },
  ],
  'WI-2024-046': [
    { timestamp: '2026-04-02T10:00:00', type: 'approved', actor: ACTORS.kimjs },
    { timestamp: '2026-04-02T03:00:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T02:30:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정' },
  ],
  'WI-2024-047': [
    { timestamp: '2026-04-02T10:15:00', type: 'approved', actor: ACTORS.leejw },
    { timestamp: '2026-04-02T03:10:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T02:40:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정' },
  ],
  'WI-2024-048': [
    { timestamp: '2026-04-02T10:30:00', type: 'approved', actor: ACTORS.parksh },
    { timestamp: '2026-04-02T03:20:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T02:50:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정' },
  ],
  'WI-2024-050': [
    { timestamp: '2026-04-02T10:45:00', type: 'approved', actor: ACTORS.kimjs },
    { timestamp: '2026-04-02T03:35:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T03:05:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정' },
  ],
  'WI-2024-052': [
    { timestamp: '2026-04-03T09:00:00', type: 'approved', actor: ACTORS.kimjs, note: '스칼라서브쿼리 인라인뷰 변환 확인' },
    { timestamp: '2026-04-03T04:00:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-03T03:00:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-03T02:00:00', type: 'created', actor: ACTORS.kimjs, note: '수동 선정' },
  ],
  'WI-2024-053': [
    { timestamp: '2026-04-03T09:30:00', type: 'approved', actor: ACTORS.leejw },
    { timestamp: '2026-04-03T04:30:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-03T03:30:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-03T02:00:00', type: 'created', actor: ACTORS.kimjs, note: '수동 선정' },
  ],
  'WI-2024-054': [
    { timestamp: '2026-04-03T10:00:00', type: 'approved', actor: ACTORS.parksh },
    { timestamp: '2026-04-03T05:00:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-03T04:00:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-03T02:00:00', type: 'created', actor: ACTORS.kimjs, note: '수동 선정' },
  ],

  // ─── applied 상태 ───
  'WI-2024-002': [
    { timestamp: '2026-04-01T14:00:00', type: 'applied', actor: ACTORS.parksh, note: 'PRD 반영 완료' },
    { timestamp: '2026-04-01T10:00:00', type: 'exported', actor: ACTORS.kimjs, note: '개발팀 전달' },
    { timestamp: '2026-03-31T11:00:00', type: 'approved', actor: ACTORS.kimjs },
    { timestamp: '2026-03-31T02:00:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-03-31T01:30:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-03-31T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정' },
  ],
  'WI-2024-018': [
    { timestamp: '2026-04-02T15:00:00', type: 'applied', actor: ACTORS.leejw, note: 'PRD 반영 완료' },
    { timestamp: '2026-04-02T12:00:00', type: 'approved', actor: ACTORS.kimjs },
    { timestamp: '2026-04-02T03:00:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T02:30:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정' },
  ],
  'WI-2024-031': [
    { timestamp: '2026-04-02T07:00:00', type: 'applied', actor: ACTORS.parksh, note: 'PRD 반영 완료' },
    { timestamp: '2026-04-02T06:30:00', type: 'exported', actor: ACTORS.kimjs },
    { timestamp: '2026-04-02T06:00:00', type: 'approved', actor: ACTORS.kimjs },
    { timestamp: '2026-04-02T03:00:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T02:30:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정' },
  ],
  'WI-2024-032': [
    { timestamp: '2026-04-02T07:30:00', type: 'applied', actor: ACTORS.leejw, note: 'PRD 반영 완료' },
    { timestamp: '2026-04-02T06:30:00', type: 'approved', actor: ACTORS.leejw },
    { timestamp: '2026-04-02T03:30:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-04-02T03:00:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-04-02T01:00:00', type: 'created', actor: ACTORS.system, note: '자동 선정' },
  ],
  'WI-2024-039': [
    { timestamp: '2026-03-31T14:00:00', type: 'applied', actor: ACTORS.parksh, note: 'PRD 반영 완료' },
    { timestamp: '2026-03-31T10:00:00', type: 'approved', actor: ACTORS.kimjs },
    { timestamp: '2026-03-31T03:00:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-03-31T02:30:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-03-31T02:00:00', type: 'created', actor: ACTORS.kimjs, note: '수동 선정 (TOP SQL)' },
  ],
  'WI-2024-040': [
    { timestamp: '2026-03-30T15:00:00', type: 'applied', actor: ACTORS.leejw, note: 'DEV 반영 완료' },
    { timestamp: '2026-03-30T11:00:00', type: 'approved', actor: ACTORS.leejw },
    { timestamp: '2026-03-30T04:00:00', type: 'tuning_completed', actor: ACTORS.ai },
    { timestamp: '2026-03-30T03:30:00', type: 'tuning_started', actor: ACTORS.ai },
    { timestamp: '2026-03-30T03:00:00', type: 'created', actor: ACTORS.kimjs, note: '수동 선정 (TOP SQL)' },
  ],
}
