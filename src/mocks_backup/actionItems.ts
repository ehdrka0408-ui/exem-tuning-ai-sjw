// 액션 항목 mock 데이터 (승인완료 후 2레이어)

export type ActionItemType = 'auto_apply' | 'recommendation'
export type AutoApplyStatus = 'pending' | 'running' | 'completed' | 'failed'
export type RecommendationStatus = 'pending' | 'delivered' | 'dev_confirmed' | 'applied'

export interface ActionItem {
  id: number
  workItemId: string
  label: string
  type: ActionItemType
  status: AutoApplyStatus | RecommendationStatus
  detail?: string
  deliveryMethod?: 'email' | 'slack' | 'jira' | 'copy' | null
  deliveredAt?: string
  deliveredTo?: string
  completedAt?: string
  // 인덱스 관련
  ddl?: string
  scheduledTime?: string // 예약 시간 (정책에 의한)
}

export const workActionItems: Record<string, ActionItem[]> = {
  // WI-2024-003 (승인완료, 힌트만)
  'WI-2024-003': [
    {
      id: 1,
      workItemId: 'WI-2024-003',
      label: '힌트 변경 권고',
      type: 'recommendation',
      status: 'pending',
      detail: '/*+ LEADING(a) USE_NL(t) INDEX(t IDX_TXN_ACCTID) */ 힌트 추가',
    },
  ],

  // WI-2024-015 (승인완료, 인덱스 포함)
  'WI-2024-015': [
    {
      id: 1,
      workItemId: 'WI-2024-015',
      label: '인덱스 생성: IDX_ORD_TOTAL',
      type: 'auto_apply',
      status: 'pending',
      ddl: 'CREATE INDEX IDX_ORD_TOTAL ON ORDERS(total_amount) TABLESPACE IDX_TS ONLINE;',
      scheduledTime: '22:00~06:00',
      detail: 'ORDERS 테이블에 total_amount 컬럼 인덱스 생성',
    },
    {
      id: 2,
      workItemId: 'WI-2024-015',
      label: '힌트 변경 권고',
      type: 'recommendation',
      status: 'pending',
      detail: '/*+ INDEX(o IDX_ORD_TOTAL) USE_NL(c) */ 힌트 추가 권고',
    },
  ],

  // WI-2024-001 (적용됨, 인덱스 + 리라이트)
  'WI-2024-001': [
    {
      id: 1,
      workItemId: 'WI-2024-001',
      label: '인덱스 생성: IDX_ORD_DATE',
      type: 'auto_apply',
      status: 'completed',
      ddl: 'CREATE INDEX IDX_ORD_DATE ON ORDERS(order_date) TABLESPACE IDX_TS ONLINE;',
      detail: 'ORDERS 테이블에 order_date 인덱스 생성',
      completedAt: '2026-03-31T02:15:00Z',
    },
    {
      id: 2,
      workItemId: 'WI-2024-001',
      label: 'SQL 리라이트 권고',
      type: 'recommendation',
      status: 'applied',
      detail: 'WHERE 조건에 o.order_date BETWEEN 절 추가',
      deliveryMethod: 'email',
      deliveredAt: '2026-03-31T09:00:00Z',
      deliveredTo: '개발팀 (dev-team@company.com)',
      completedAt: '2026-03-31T14:00:00Z',
    },
  ],

  // WI-2024-002 (적용됨, 리라이트)
  'WI-2024-002': [
    {
      id: 1,
      workItemId: 'WI-2024-002',
      label: 'SQL 리라이트 권고',
      type: 'recommendation',
      status: 'applied',
      detail: 'HASH JOIN → NESTED LOOPS 전환 SQL Rewrite',
      deliveryMethod: 'slack',
      deliveredAt: '2026-03-30T10:00:00Z',
      deliveredTo: '#dev-sql-review',
      completedAt: '2026-03-30T15:30:00Z',
    },
  ],

  // WI-2024-018 (적용됨, 인덱스)
  'WI-2024-018': [
    {
      id: 1,
      workItemId: 'WI-2024-018',
      label: '인덱스 생성: IDX_ORD_MON_CST',
      type: 'auto_apply',
      status: 'completed',
      ddl: 'CREATE INDEX IDX_ORD_MON_CST ON ORDERS(order_date, customer_id, total_amount) TABLESPACE IDX_TS ONLINE;',
      detail: 'ORDERS 테이블에 복합 인덱스 생성',
      completedAt: '2026-03-29T03:30:00Z',
    },
  ],
}
