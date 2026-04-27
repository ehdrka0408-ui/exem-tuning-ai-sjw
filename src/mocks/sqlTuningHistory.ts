/**
 * SQL 튜닝 이력 — SQL ID + Instance 기준
 * Top SQL 슬라이드 패널에서 해당 SQL의 과거 튜닝 이력을 표시하기 위한 mock 데이터.
 * workItems/workHistory와 일관된 정보를 참조.
 */

export type TuningHistoryStatus = 'applied' | 'verified' | 'tuning' | 'rejected' | 'pending'

export interface SqlTuningRecord {
  workItemId: string
  workName: string
  status: TuningHistoryStatus
  batchId: string
  createdAt: string
  completedAt?: string
  recommendationType?: 'rewrite' | 'hint' | 'index' | 'plan_restore'
  improvementRate?: number
  assignee: string
  note?: string
}

/** Key: `${sqlId}::${instanceName}` */
export const sqlTuningHistory: Record<string, SqlTuningRecord[]> = {}

/** 키 생성 헬퍼 */
export function makeTuningHistoryKey(sqlId: string, instanceName: string): string {
  return `${sqlId}::${instanceName}`
}
