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
export const sqlTuningHistory: Record<string, SqlTuningRecord[]> = {
  // a1b2c3d4e5f6g @ PROD-DB1 — 2회 튜닝 이력
  'a1b2c3d4e5f6g::PROD-DB1': [
    {
      workItemId: 'WI-2024-001',
      workName: 'ORDER_HIST 조인 최적화',
      status: 'applied',
      batchId: 'BATCH-2024-127',
      createdAt: '2026-04-02T00:30:00',
      completedAt: '2026-04-03T11:00:00',
      recommendationType: 'index',
      improvementRate: 93.4,
      assignee: '김정수',
      note: '인덱스 IDX_TAX_CC_DT 생성 후 적용',
    },
    {
      workItemId: 'WI-2024-050',
      workName: 'ORDER_HIST Full Scan 제거',
      status: 'applied',
      batchId: 'BATCH-2024-098',
      createdAt: '2026-03-06T01:00:00',
      completedAt: '2026-03-01T14:00:00',
      recommendationType: 'hint',
      improvementRate: 72.1,
      assignee: '박상현',
      note: 'FULL 힌트 제거, NL 조인 유도',
    },
  ],

  // f7g8h9i0j1k2l @ PROD-DB1 — 1회 이력
  'f7g8h9i0j1k2l::PROD-DB1': [
    {
      workItemId: 'WI-2024-002',
      workName: 'EMP-DEPT 조인 리라이트',
      status: 'applied',
      batchId: 'BATCH-2024-127',
      createdAt: '2026-04-02T01:00:00',
      completedAt: '2026-04-03T16:00:00',
      recommendationType: 'rewrite',
      improvementRate: 85.0,
      assignee: '김정수',
    },
  ],

  // m3n4o5p6q7r8s @ PROD-DB2 — 1회 이력 (적용대기)
  'm3n4o5p6q7r8s::PROD-DB2': [
    {
      workItemId: 'WI-2024-003',
      workName: 'TRANSACTIONS 조인 힌트 최적화',
      status: 'verified',
      batchId: 'BATCH-2024-127',
      createdAt: '2026-04-02T01:00:00',
      completedAt: '2026-04-03T11:00:00',
      recommendationType: 'hint',
      improvementRate: 85.1,
      assignee: '박준호',
    },
  ],

  // t9u0v1w2x3y4z @ PROD-DB1 — 2회 (1회 반려, 1회 진행중)
  't9u0v1w2x3y4z::PROD-DB1': [
    {
      workItemId: 'WI-2024-004',
      workName: '상품별 판매량 RANK 최적화',
      status: 'verified',
      batchId: 'BATCH-2024-127',
      createdAt: '2026-04-02T01:00:00',
      completedAt: '2026-04-02T09:30:00',
      recommendationType: 'index',
      improvementRate: 80.2,
      assignee: '김정수',
    },
    {
      workItemId: 'WI-2024-051',
      workName: '상품별 판매량 쿼리 리라이트',
      status: 'rejected',
      batchId: 'BATCH-2024-090',
      createdAt: '2026-03-05T01:00:00',
      completedAt: '2026-03-05T10:00:00',
      recommendationType: 'rewrite',
      assignee: '김정수',
      note: '리라이트 결과 집합 불일치',
    },
  ],

  // b5c6d7e8f9g0h @ PROD-DB2 — 재튜닝 이력
  'b5c6d7e8f9g0h::PROD-DB2': [
    {
      workItemId: 'WI-2024-007',
      workName: '고객 매출 집계 조인 최적화',
      status: 'tuning',
      batchId: 'BATCH-2024-127',
      createdAt: '2026-04-02T01:00:00',
      recommendationType: 'hint',
      assignee: '김정수',
      note: '바인드 민감 — 재검증 중',
    },
    {
      workItemId: 'WI-2024-052',
      workName: '고객 매출 집계 인덱스 추가',
      status: 'applied',
      batchId: 'BATCH-2024-085',
      createdAt: '2026-03-04T01:00:00',
      completedAt: '2026-03-06T14:00:00',
      recommendationType: 'index',
      improvementRate: 65.3,
      assignee: '박상현',
    },
  ],

  // k5l6m7n8o9p0q @ PROD-DB1
  'k5l6m7n8o9p0q::PROD-DB1': [
    {
      workItemId: 'WI-2024-008',
      workName: '월별 매출 리포트 최적화',
      status: 'verified',
      batchId: 'BATCH-2024-127',
      createdAt: '2026-04-02T01:00:00',
      completedAt: '2026-04-02T10:00:00',
      recommendationType: 'rewrite',
      improvementRate: 78.5,
      assignee: '이지원',
    },
  ],
}

/** 키 생성 헬퍼 */
export function makeTuningHistoryKey(sqlId: string, instanceName: string): string {
  return `${sqlId}::${instanceName}`
}
