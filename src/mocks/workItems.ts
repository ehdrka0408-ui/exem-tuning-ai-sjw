export interface WorkItem {
  id: string
  sqlId: string
  sqlText: string
  status: 'scheduled' | 'pending' | 'tuning' | 'approval_pending' | 'apply_pending' | 'rejected' | 'applied' | 'cancelled' | 'no_improve' | 'failed'
  type: 'tuning' | 'verification'
  createdAt: string
  updatedAt: string
  assignee: string
  instanceName: string
  schemaName: string
  workName: string // AI 자동 생성 작업명
  alias?: string // 사용자 정의 SQL 별칭
  selectionSource: 'auto' | 'manual' | 'direct_verify' // 자동선정 / 수동선정 / 직접검증요청
  requestedBy?: string // 요청자 (개발자 직접검증 등)
  originalElapsed?: number
  originalBuffers?: number
  tunedElapsed?: number
  tunedBuffers?: number
  improvementRate?: number
  recommendationType?: 'rewrite' | 'hint' | 'index' | 'plan_restore'
  source: 'maxgauge' | 'awr' | 'v$sql'
  queuePosition?: number // 대기 순서 (pending 상태)
  executionContext?: 'OLTP' | 'Batch'
  estimatedDailyExec?: number
  // 승인/반려/재튜닝 정보
  verifiedBy?: string
  verifiedAt?: string
  rejectedBy?: string
  rejectedAt?: string
  rejectedReason?: string
  retuneCount?: number // 재튜닝 횟수 (0 = 최초, 1 = 1회 재튜닝, ...)
  retuneRequestedBy?: string
  retuneRequestedAt?: string
  retuneConditions?: string[]
  retuneReason?: string
  appliedAt?: string
  // 운영 실측
  operationalElapsed?: number
  operationalBuffers?: number
  operationalResult?: 'improved' | 'degraded' | 'monitoring' | 'stable' | 'regressed'
  operationalMeasuredAt?: string
  operationalSource?: 'maxgauge' | 'awr' | 'v$sql'
  operationalExecCount?: number
  // 튜닝중 분석 단계
  analysisStep?: 'sql_analysis' | 'plan_collection' | 'plan_generation' | 'verification'
  // Before 실행계획 (튜닝중 상태에서 Before Plan 표시용)
  originalPlanText?: string
  // 실행계획 수집 방식: memory=V$SQL_PLAN(실측), explain=EXPLAIN PLAN(예상)
  planSource?: 'memory' | 'explain'
  // 목록 표시용
  batchId: string
  batchMemo?: string
  groupId?: string | null
  groupName?: string | null
  groupRequestCount?: number | null
  requestSource?: string | null
  recommendationTypes?: ('index' | 'hint' | 'rewrite')[]
  // 실행결과 / 정합성결과 2축
  executionResult?: 'completed' | 'timeout' | 'estimated'
  integrityResult?: 'match' | 'mismatch' | 'pending'
  beforePlanHash?: string
  afterPlanHash?: string
  beforeExecutions?: number
  afterExecutions?: number
  // 취소 정보 (예외 SQL 정책 차단 등)
  cancelReason?: string
  cancelledAt?: string
  // 실패 정보
  tuningError?: string
  applyError?: string
  // 쿼리 실행 타임아웃 (초). 값이 있으면 요청별 오버라이드, 없으면 글로벌 default 사용.
  queryTimeoutSec?: number
  // scheduled (예약·반복)
  scheduleKind?: 'once' | 'recurring'
  scheduleCron?: string
  scheduleRunAt?: string
  // 재튜닝 트리 구조용 (백엔드 요청 체인)
  instanceId?: number | null  // backend instance_id (숫자), 재튜닝 요청 시 사용
  parentRequestId?: number | null
  sourceSqlKey?: string | number | null  // 동일 SQL 그룹핑 키 (backend asis_sql_id)
}

export type WorkStatus = WorkItem['status']

/** Owner 축 — 상태와 독립된 '공의 소유자' 분류 */
export type WorkOwner = 'scheduled' | 'ai' | 'human' | 'done' | 'error' | 'none'

/** 상태 → Owner 매핑 */
export const workStatusOwner: Record<WorkStatus, WorkOwner> = {
  scheduled: 'scheduled',
  pending: 'ai',
  tuning: 'ai',
  approval_pending: 'ai', // 2026-04-09 재정의: Owner 축 = 주체. AI 튜닝 완료 결과.
  apply_pending: 'human',
  applied: 'done',
  rejected: 'error',
  failed: 'error',
  cancelled: 'error',
  no_improve: 'none',
}

// ─── 기존 핵심 항목 (WorkDetail, recommendations 등과 연동) ───
const coreItems: WorkItem[] = [
  {
    id: 'WI-2024-001',
    sqlId: 'a1b2c3d4e5f6g',
    sqlText: 'SELECT /*+ FULL(o) */ o.order_id, o.order_date, c.customer_name, SUM(oi.quantity * oi.unit_price) total FROM ORDERS o, CUSTOMERS c, ORDER_ITEMS oi WHERE o.cust',
    status: 'applied',
    type: 'tuning',
    createdAt: '2026-03-19T08:00:00Z',
    updatedAt: '2026-03-31T14:30:00Z',
    assignee: '김민수',
    instanceName: 'PROD-DB1',
    schemaName: 'OMS',
    workName: 'ORDER_HIST 조인 최적화',
    alias: '주문 이력 조인 최적화',
    selectionSource: 'auto',
    originalElapsed: 48200,
    originalBuffers: 4870000,
    tunedElapsed: 3200,
    tunedBuffers: 45000,
    improvementRate: 93.4,
    recommendationType: 'index',
    source: 'maxgauge',
    executionContext: 'Batch',
    estimatedDailyExec: 1240,
    verifiedBy: '김민수',
    verifiedAt: '2026-03-31T10:00:00Z',
    appliedAt: '2026-03-31T14:30:00Z',
    operationalElapsed: 3100,
    operationalBuffers: 42000,
    operationalResult: 'improved',
    operationalMeasuredAt: '2026-04-01T08:00:00Z',
    operationalSource: 'maxgauge',
    operationalExecCount: 47,
    batchId: 'BATCH-2024-127',
    batchMemo: '4/2 새벽 · PROD-DB1·DB2 · 프리셋:야간배치 · 36건',
    recommendationTypes: ['index', 'rewrite'],
  },
  {
    id: 'WI-2024-002',
    sqlId: 'f7g8h9i0j1k2l',
    sqlText: 'SELECT e.employee_id, e.first_name, e.last_name, d.department_name, NVL(e.commission_pct, 0) comm FROM EMP e JOIN DEPT d ON e.department_id = d.department_id',
    status: 'applied',
    type: 'tuning',
    createdAt: '2026-03-20T09:15:00Z',
    updatedAt: '2026-03-30T16:00:00Z',
    assignee: '이영희',
    instanceName: 'PROD-DB1',
    schemaName: 'HR',
    workName: 'EMP-DEPT 조인 리라이트',
    alias: '사원-부서 조인 리라이트',
    selectionSource: 'auto',
    originalElapsed: 32100,
    originalBuffers: 3200000,
    tunedElapsed: 4800,
    tunedBuffers: 320000,
    improvementRate: 85.0,
    recommendationType: 'rewrite',
    source: 'awr',
    executionContext: 'OLTP',
    estimatedDailyExec: 8500,
    verifiedBy: '이영희',
    verifiedAt: '2026-03-30T11:00:00Z',
    appliedAt: '2026-03-30T16:00:00Z',
    operationalElapsed: 38000,
    operationalBuffers: 3500000,
    operationalResult: 'degraded',
    operationalMeasuredAt: '2026-04-01T09:00:00Z',
    operationalSource: 'awr',
    operationalExecCount: 12,
    batchId: 'BATCH-2024-127',
    batchMemo: '4/2 새벽 · PROD-DB1·DB2 · 프리셋:야간배치 · 36건',
    recommendationTypes: ['rewrite'],
  },
  {
    id: 'WI-2024-003',
    sqlId: 'm3n4o5p6q7r8s',
    sqlText: 'SELECT t.txn_id, t.txn_date, a.account_no, DECODE(t.txn_type, \'C\', \'Credit\', \'D\', \'Debit\', \'Unknown\') txn_desc, t.amount FROM TRANSACTIONS t, ACCOUNTS a WHERE',
    status: 'apply_pending',
    type: 'tuning',
    createdAt: '2026-03-21T10:00:00Z',
    updatedAt: '2026-04-01T11:20:00Z',
    assignee: '박준호',
    instanceName: 'PROD-DB2',
    schemaName: 'FIN',
    workName: 'TRANSACTIONS 조인 힌트 최적화',
    alias: '거래내역 힌트 최적화',
    selectionSource: 'auto',
    originalElapsed: 41500,
    originalBuffers: 4100000,
    tunedElapsed: 6200,
    tunedBuffers: 410000,
    improvementRate: 85.1,
    recommendationType: 'hint',
    source: 'v$sql',
    executionContext: 'OLTP',
    estimatedDailyExec: 12400,
    verifiedBy: '박준호',
    verifiedAt: '2026-04-01T11:20:00Z',
    batchId: 'BATCH-2024-127',
    batchMemo: '4/2 새벽 · PROD-DB1·DB2 · 프리셋:야간배치 · 36건',
    recommendationTypes: ['hint'],
  },
  {
    id: 'WI-2024-004',
    sqlId: 't9u0v1w2x3y4z',
    sqlText: 'SELECT * FROM (SELECT p.product_id, p.product_name, SUM(oi.quantity) total_qty, RANK() OVER (ORDER BY SUM(oi.quantity) DESC) rnk FROM PRODUCTS p JOIN ORDER_ITE',
    status: 'approval_pending',
    type: 'tuning',
    createdAt: '2026-03-22T07:30:00Z',
    updatedAt: '2026-04-01T09:45:00Z',
    assignee: '정수진',
    instanceName: 'PROD-DB1',
    schemaName: 'OMS',
    workName: '상품별 판매량 RANK 최적화',
    alias: '상품 판매량 랭킹 조회',
    selectionSource: 'auto',
    originalElapsed: 27800,
    originalBuffers: 2900000,
    tunedElapsed: 5500,
    tunedBuffers: 350000,
    improvementRate: 80.2,
    recommendationType: 'rewrite',
    source: 'maxgauge',
    executionContext: 'Batch',
    estimatedDailyExec: 48,
    batchId: 'BATCH-2024-127',
    batchMemo: '4/2 새벽 · PROD-DB1·DB2 · 프리셋:야간배치 · 36건',
    recommendationTypes: ['index', 'hint', 'rewrite'],
  },
  {
    id: 'WI-2024-005',
    sqlId: 'b5c6d7e8f9g0h',
    sqlText: 'SELECT customer_id, customer_name, (SELECT COUNT(*) FROM ORDERS o WHERE o.customer_id = c.customer_id AND o.order_date > SYSDATE - 90) recent_orders FROM CUST',
    status: 'approval_pending',
    type: 'tuning',
    createdAt: '2026-03-23T08:45:00Z',
    updatedAt: '2026-04-01T15:10:00Z',
    assignee: '최동욱',
    instanceName: 'PROD-DB2',
    schemaName: 'CRM',
    workName: '고객별 최근주문 Scalar Subquery 제거',
    alias: '고객 최근주문 서브쿼리 제거',
    selectionSource: 'manual',
    originalElapsed: 19500,
    originalBuffers: 1850000,
    tunedElapsed: 2900,
    tunedBuffers: 185000,
    improvementRate: 85.1,
    recommendationType: 'rewrite',
    source: 'awr',
    executionContext: 'OLTP',
    estimatedDailyExec: 3200,
    batchId: 'BATCH-2024-M01',
    batchMemo: '4/3 14:30 · PROD-DB1 · TOP SQL · 8건',
    recommendationTypes: ['index', 'rewrite'],
  },
  {
    id: 'WI-2024-006',
    sqlId: 'i1j2k3l4m5n6o',
    sqlText: 'SELECT emp_id, manager_id, LEVEL, SYS_CONNECT_BY_PATH(last_name, \'/\') path FROM EMP START WITH manager_id IS NULL CONNECT BY PRIOR employee_id = manager_id ORD',
    status: 'approval_pending',
    type: 'tuning',
    createdAt: '2026-03-24T11:00:00Z',
    updatedAt: '2026-04-01T17:30:00Z',
    assignee: '김민수',
    instanceName: 'DEV-DB1',
    schemaName: 'HR',
    workName: 'EMP 계층쿼리 CONNECT BY 최적화',
    selectionSource: 'auto',
    originalElapsed: 15200,
    originalBuffers: 1620000,
    tunedElapsed: 3800,
    tunedBuffers: 405000,
    improvementRate: 75.0,
    recommendationType: 'hint',
    source: 'v$sql',
    executionContext: 'OLTP',
    estimatedDailyExec: 560,
    batchId: 'BATCH-2024-127',
    batchMemo: '4/2 새벽 · PROD-DB1·DB2 · 프리셋:야간배치 · 36건',
    recommendationTypes: ['hint'],
  },
  {
    id: 'WI-2024-007',
    sqlId: 'p7q8r9s0t1u2v',
    sqlText: 'SELECT a.account_no, a.balance, NVL(SUM(t.amount), 0) total_txn, COUNT(t.txn_id) txn_count FROM ACCOUNTS a LEFT JOIN TRANSACTIONS t ON a.account_id = t.accoun',
    status: 'approval_pending',
    type: 'tuning',
    createdAt: '2026-03-25T13:20:00Z',
    updatedAt: '2026-04-02T08:00:00Z',
    assignee: '이영희',
    instanceName: 'PROD-DB1',
    schemaName: 'FIN',
    workName: 'ACCOUNTS-TRANSACTIONS 집계 최적화',
    selectionSource: 'auto',
    originalElapsed: 12800,
    originalBuffers: 1340000,
    tunedElapsed: 2100,
    tunedBuffers: 168000,
    improvementRate: 83.6,
    recommendationType: 'index',
    source: 'maxgauge',
    executionContext: 'Batch',
    estimatedDailyExec: 96,
    batchId: 'BATCH-2024-127',
    batchMemo: '4/2 새벽 · PROD-DB1·DB2 · 프리셋:야간배치 · 36건',
    recommendationTypes: ['index'],
  },
  {
    id: 'WI-2024-008',
    sqlId: 'w3x4y5z6a7b8c',
    sqlText: 'UPDATE ORDERS SET status = \'SHIPPED\', ship_date = SYSDATE WHERE order_id IN (SELECT order_id FROM ORDER_ITEMS oi WHERE oi.quantity > 0 GROUP BY order_id HAVING',
    status: 'approval_pending',
    type: 'verification',
    createdAt: '2026-03-26T09:00:00Z',
    updatedAt: '2026-04-02T10:15:00Z',
    assignee: '박준호',
    instanceName: 'PROD-DB2',
    schemaName: 'OMS',
    workName: 'ORDERS UPDATE 서브쿼리 Plan 복원',
    selectionSource: 'auto',
    originalElapsed: 8900,
    originalBuffers: 950000,
    tunedElapsed: 1200,
    tunedBuffers: 95000,
    improvementRate: 86.5,
    recommendationType: 'plan_restore',
    source: 'awr',
    executionContext: 'Batch',
    estimatedDailyExec: 12,
    batchId: 'BATCH-2024-127',
    batchMemo: '4/2 새벽 · PROD-DB1·DB2 · 프리셋:야간배치 · 36건',
    recommendationTypes: ['hint'],
  },
  {
    id: 'WI-2024-009',
    sqlId: 'd9e0f1g2h3i4j',
    sqlText: 'SELECT d.department_name, COUNT(e.employee_id) emp_cnt, AVG(e.salary) avg_sal, MAX(e.salary) max_sal FROM DEPT d, EMP e WHERE d.department_id = e.department_id',
    status: 'pending',
    type: 'tuning',
    createdAt: '2026-03-27T14:00:00Z',
    updatedAt: '2026-04-02T09:30:00Z',
    assignee: '정수진',
    instanceName: 'PROD-DB1',
    schemaName: 'HR',
    workName: '부서별 급여 집계 최적화',
    selectionSource: 'auto',
    originalElapsed: 5400,
    originalBuffers: 480000,
    source: 'v$sql',
    executionContext: 'OLTP',
    estimatedDailyExec: 2400,
    queuePosition: 1,
    batchId: 'BATCH-2024-127',
    batchMemo: '4/2 새벽 · PROD-DB1·DB2 · 프리셋:야간배치 · 36건',
  },
  {
    id: 'WI-2024-010',
    sqlId: 'k5l6m7n8o9p0q',
    sqlText: 'SELECT c.customer_name, o.order_id, o.order_date FROM CUSTOMERS c INNER JOIN ORDERS o ON c.customer_id = o.customer_id WHERE o.order_date BETWEEN :start_dt AND',
    status: 'pending',
    type: 'tuning',
    createdAt: '2026-03-28T08:30:00Z',
    updatedAt: '2026-04-02T10:00:00Z',
    assignee: '최동욱',
    instanceName: 'DEV-DB1',
    schemaName: 'CRM',
    workName: '고객-주문 기간조회 최적화',
    alias: '고객 주문 기간 조회',
    selectionSource: 'manual',
    originalElapsed: 2100,
    originalBuffers: 125000,
    source: 'maxgauge',
    executionContext: 'OLTP',
    estimatedDailyExec: 15000,
    queuePosition: 2,
    batchId: 'BATCH-2024-M01',
    batchMemo: '4/3 14:30 · PROD-DB1 · TOP SQL · 8건',
  },
  {
    id: 'WI-2024-011',
    sqlId: 'r1s2t3u4v5w6x',
    sqlText: 'INSERT INTO AUDIT_LOG (log_id, table_name, operation, old_value, new_value, changed_by, changed_at) SELECT seq_audit.NEXTVAL, :tbl, :op, :old, :new, USER, SYSD',
    status: 'pending',
    type: 'verification',
    createdAt: '2026-03-29T10:45:00Z',
    updatedAt: '2026-03-29T10:45:00Z',
    assignee: '김민수',
    instanceName: 'PROD-DB1',
    schemaName: 'AUDIT',
    workName: 'AUDIT_LOG INSERT 최적화',
    selectionSource: 'manual',
    originalElapsed: 450,
    originalBuffers: 3200,
    source: 'awr',
    queuePosition: 2,
    executionContext: 'OLTP',
    estimatedDailyExec: 45000,
    batchId: 'BATCH-2024-M02',
    batchMemo: '4/4 10:15 · PROD-DB2 · TOP SQL · 3건',
  },
  {
    id: 'WI-2024-012',
    sqlId: 'y7z8a9b0c1d2e',
    sqlText: 'SELECT ROWNUM rn, p.product_id, p.product_name, p.list_price FROM PRODUCTS p WHERE p.category_id = :cat_id AND ROWNUM <= 50 ORDER BY p.list_price DESC',
    status: 'pending',
    type: 'tuning',
    createdAt: '2026-03-30T07:00:00Z',
    updatedAt: '2026-03-30T07:00:00Z',
    assignee: '이영희',
    instanceName: 'DEV-DB1',
    schemaName: 'OMS',
    workName: 'PRODUCTS ROWNUM 페이징 최적화',
    selectionSource: 'auto',
    originalElapsed: 180,
    originalBuffers: 1800,
    source: 'v$sql',
    queuePosition: 3,
    executionContext: 'OLTP',
    estimatedDailyExec: 28000,
    batchId: 'BATCH-2024-127',
    batchMemo: '4/2 새벽 · PROD-DB1·DB2 · 프리셋:야간배치 · 36건',
  },
  {
    id: 'WI-2024-014',
    sqlId: 'n9o0p1q2r3s4t',
    sqlText: 'MERGE INTO INVENTORY i USING (SELECT product_id, SUM(quantity) qty FROM ORDER_ITEMS WHERE order_date = TRUNC(SYSDATE) GROUP BY product_id) s ON (i.product_id =',
    status: 'pending',
    type: 'tuning',
    createdAt: '2026-03-18T11:30:00Z',
    updatedAt: '2026-03-27T10:00:00Z',
    assignee: '정수진',
    instanceName: 'PROD-DB1',
    schemaName: 'OMS',
    workName: 'INVENTORY MERGE 재고반영 최적화',
    alias: '재고 MERGE 반영 최적화',
    selectionSource: 'auto',
    originalElapsed: 3400,
    originalBuffers: 290000,
    tunedElapsed: 3100,
    tunedBuffers: 275000,
    improvementRate: 5.3,
    recommendationType: 'rewrite',
    source: 'awr',
    executionContext: 'Batch',
    estimatedDailyExec: 1,
    retuneCount: 1,
    retuneRequestedBy: '정수진',
    retuneRequestedAt: '2026-03-27T10:00:00Z',
    retuneConditions: ['인덱스 포함 재분석'],
    retuneReason: 'Rewrite만으로는 개선 효과 5.3%로 미미. 인덱스 생성 포함하여 재분석 필요.',
    batchId: 'BATCH-2024-127',
    batchMemo: '4/2 새벽 · PROD-DB1·DB2 · 프리셋:야간배치 · 36건',
    recommendationTypes: ['rewrite'],
  },
  {
    id: 'WI-2024-015',
    sqlId: 'u5v6w7x8y9z0a',
    sqlText: 'SELECT o.order_id, o.order_date, o.total_amount, c.customer_name, c.credit_limit FROM ORDERS o JOIN CUSTOMERS c ON o.customer_id = c.customer_id WHERE o.total',
    status: 'apply_pending',
    type: 'verification',
    createdAt: '2026-03-23T15:00:00Z',
    updatedAt: '2026-04-01T13:00:00Z',
    assignee: '최동욱',
    instanceName: 'PROD-DB2',
    schemaName: 'OMS',
    workName: 'ORDERS 고액주문 조회 인덱스 최적화',
    alias: '고액 주문 인덱스 조회',
    selectionSource: 'auto',
    originalElapsed: 11200,
    originalBuffers: 1100000,
    tunedElapsed: 1800,
    tunedBuffers: 132000,
    improvementRate: 83.9,
    recommendationType: 'index',
    source: 'v$sql',
    executionContext: 'OLTP',
    estimatedDailyExec: 4800,
    verifiedBy: '최동욱',
    verifiedAt: '2026-04-01T13:00:00Z',
    batchId: 'BATCH-2024-127',
    batchMemo: '4/2 새벽 · PROD-DB1·DB2 · 프리셋:야간배치 · 36건',
    recommendationTypes: ['index'],
  },
  {
    id: 'WI-2024-016',
    sqlId: 'b1c2d3e4f5g6h',
    sqlText: 'SELECT department_id, employee_id, salary, SUM(salary) OVER (PARTITION BY department_id ORDER BY salary ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) run_t',
    status: 'tuning',
    type: 'tuning',
    createdAt: '2026-03-31T08:00:00Z',
    updatedAt: '2026-04-02T11:00:00Z',
    assignee: '김민수',
    instanceName: 'PROD-DB1',
    schemaName: 'HR',
    workName: '부서별 급여 누적합 윈도우 최적화',
    selectionSource: 'auto',
    originalElapsed: 7800,
    originalBuffers: 820000,
    source: 'maxgauge',
    executionContext: 'Batch',
    estimatedDailyExec: 24,
    analysisStep: 'verification',
    planSource: 'memory',
    originalPlanText: `SQL_ID  b1c2d3e4f5g6h, child number 0
Plan hash value: 2738461095

--------------------------------------------------------------------------------------------------------------
| Id  | Operation                      | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
--------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |               |    1 |       |  4200 |00:00:07.80 |   820K |
|   1 |  WINDOW SORT                  |               |    1 |  4200 |  4200 |00:00:07.80 |   820K |
|   2 |   TABLE ACCESS FULL           | EMPLOYEES     |    1 | 50000 | 50000 |00:00:04.20 |   820K |
--------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

   2 - filter("DEPARTMENT_ID" IS NOT NULL)`,
    batchId: 'BATCH-2024-127',
    batchMemo: '4/2 새벽 · PROD-DB1·DB2 · 프리셋:야간배치 · 36건',
  },
  {
    id: 'WI-2024-017',
    sqlId: 'i7j8k9l0m1n2o',
    sqlText: 'SELECT c.customer_id, c.customer_name, LISTAGG(p.product_name, \', \') WITHIN GROUP (ORDER BY p.product_name) purchased_products FROM CUSTOMERS c JOIN ORDERS o ON',
    status: 'pending',
    type: 'tuning',
    createdAt: '2026-04-01T16:00:00Z',
    updatedAt: '2026-04-01T16:00:00Z',
    assignee: '이영희',
    instanceName: 'PROD-DB2',
    schemaName: 'CRM',
    workName: '고객별 구매상품 LISTAGG 최적화',
    selectionSource: 'auto',
    originalElapsed: 14600,
    originalBuffers: 1520000,
    source: 'awr',
    queuePosition: 1,
    executionContext: 'Batch',
    estimatedDailyExec: 6,
    planSource: 'explain',
    originalPlanText: `SQL_ID  i7j8k9l0m1n2o, child number 0
Plan hash value: 4192837650

-----------------------------------------------------------------------------------------------------------------
| Id  | Operation                          | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |               |    1 |       |  2800 |00:00:14.60 |  1520K |
|   1 |  SORT GROUP BY                    |               |    1 |  2800 |  2800 |00:00:14.60 |  1520K |
|*  2 |   HASH JOIN                       |               |    1 | 85000 | 85000 |00:00:11.20 |  1520K |
|*  3 |    HASH JOIN                      |               |    1 | 85000 | 85000 |00:00:08.40 |  1200K |
|   4 |     TABLE ACCESS FULL             | CUSTOMERS     |    1 | 12000 | 12000 |00:00:00.80 |    95K |
|   5 |     TABLE ACCESS FULL             | ORDERS        |    1 | 85000 | 85000 |00:00:06.20 |  1100K |
|   6 |    TABLE ACCESS FULL              | PRODUCTS      |    1 |  5000 |  5000 |00:00:00.40 |   220K |
-----------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

   2 - access("O"."PRODUCT_ID"="P"."PRODUCT_ID")
   3 - access("C"."CUSTOMER_ID"="O"."CUSTOMER_ID")`,
    batchId: 'BATCH-2024-127',
    batchMemo: '4/2 새벽 · PROD-DB1·DB2 · 프리셋:야간배치 · 36건',
  },
  {
    id: 'WI-2024-018',
    sqlId: 'p3q4r5s6t7u8v',
    sqlText: 'WITH monthly_sales AS (SELECT TRUNC(order_date, \'MM\') mon, customer_id, SUM(total_amount) amt FROM ORDERS GROUP BY TRUNC(order_date, \'MM\'), customer_id) SELECT',
    status: 'applied',
    type: 'tuning',
    createdAt: '2026-03-16T10:00:00Z',
    updatedAt: '2026-03-29T09:30:00Z',
    assignee: '박준호',
    instanceName: 'PROD-DB1',
    schemaName: 'OMS',
    workName: '월별 고객매출 CTE 인덱스 최적화',
    selectionSource: 'auto',
    originalElapsed: 22400,
    originalBuffers: 2350000,
    tunedElapsed: 3500,
    tunedBuffers: 280000,
    improvementRate: 84.4,
    recommendationType: 'index',
    source: 'v$sql',
    executionContext: 'Batch',
    estimatedDailyExec: 4,
    verifiedBy: '박준호',
    verifiedAt: '2026-03-29T06:00:00Z',
    appliedAt: '2026-03-29T09:30:00Z',
    operationalElapsed: Math.round(22400 * 0.2),
    operationalBuffers: Math.round(2350000 * 0.2),
    operationalResult: 'stable',
    operationalMeasuredAt: '2026-03-31T08:00:00Z',
    operationalSource: 'maxgauge',
    operationalExecCount: 3,
    batchId: 'BATCH-2024-127',
    batchMemo: '4/2 새벽 · PROD-DB1·DB2 · 프리셋:야간배치 · 36건',
    recommendationTypes: ['index'],
  },
]

// ─── 추가 항목 생성 ──────────────────────────────────
const ASSIGNEES = ['김민수', '이영희', '박준호', '정수진', '최동욱']
const SOURCES: WorkItem['source'][] = ['maxgauge', 'awr', 'v$sql']
const EXEC_CONTEXTS: NonNullable<WorkItem['executionContext']>[] = ['OLTP', 'Batch']

interface ItemSeed {
  id: string; sqlId: string; sqlText: string; status: WorkItem['status']; workName: string
  instanceName: string; schemaName: string; selectionSource: 'auto' | 'manual' | 'direct_verify'
  requestedBy?: string
  originalElapsed: number; originalBuffers: number; tunedElapsed?: number; tunedBuffers?: number
  improvementRate?: number; recommendationType?: WorkItem['recommendationType']
  recommendationTypes?: WorkItem['recommendationTypes']
  batchId: string; batchMemo?: string; verifiedBy?: string; verifiedAt?: string; appliedAt?: string
  operationalElapsed?: number; operationalBuffers?: number; operationalResult?: WorkItem['operationalResult']; operationalMeasuredAt?: string
  rejectedBy?: string; rejectedAt?: string; rejectedReason?: string
  queuePosition?: number; analysisStep?: WorkItem['analysisStep']
  retuneRequestedBy?: string; retuneRequestedAt?: string; retuneConditions?: string[]; retuneReason?: string
  executionResult?: WorkItem['executionResult']; integrityResult?: WorkItem['integrityResult']
  originalPlanText?: string
  planSource?: 'memory' | 'explain'
  createdAt?: string
  updatedAt?: string
  tuningError?: string
  applyError?: string
  cancelReason?: string
  cancelledAt?: string
  queryTimeoutSec?: number
}

// 테이블명 풀, seed SQL에서 테이블명 추출 → 실행계획 자동 생성
const TABLE_PATTERNS = /FROM\s+(\w+)|JOIN\s+(\w+)/gi
function extractTables(sql: string): string[] {
  const tables: string[] = []
  let m: RegExpExecArray | null
  const r = new RegExp(TABLE_PATTERNS.source, TABLE_PATTERNS.flags)
  while ((m = r.exec(sql)) !== null) tables.push(m[1] || m[2])
  return [...new Set(tables)].slice(0, 3)
}

function generatePlanText(s: { sqlId: string; sqlText: string; originalElapsed: number; originalBuffers: number }): string {
  const tables = extractTables(s.sqlText)
  const mainTable = tables[0] || 'TABLE1'
  const bufK = Math.round(s.originalBuffers / 1000)
  const elapsed = (s.originalElapsed / 1000).toFixed(2)
  const eRows = Math.round(s.originalBuffers / 20)

  if (tables.length >= 2) {
    const t2 = tables[1]
    return `SQL_ID  ${s.sqlId}, child number 0
Plan hash value: ${Math.abs(s.sqlId.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0) % 9999999999)}

-----------------------------------------------------------------------------------------------------------------
| Id  | Operation                          | Name             | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                 |    1 |       | ${eRows} |00:00:${elapsed} |   ${bufK}K |
|   1 |  SORT ORDER BY                    |                 |    1 | ${eRows} | ${eRows} |00:00:${elapsed} |   ${bufK}K |
|*  2 |   HASH JOIN                       |                 |    1 | ${eRows} | ${eRows} |00:00:${(Number(elapsed) * 0.85).toFixed(2)} |   ${bufK}K |
|   3 |    TABLE ACCESS FULL              | ${t2.padEnd(16)} |    1 | ${Math.round(eRows / 5)} | ${Math.round(eRows / 5)} |00:00:${(Number(elapsed) * 0.15).toFixed(2)} |   ${Math.round(bufK * 0.2)}K |
|   4 |    TABLE ACCESS FULL              | ${mainTable.padEnd(16)} |    1 | ${eRows} | ${eRows} |00:00:${(Number(elapsed) * 0.7).toFixed(2)} |   ${Math.round(bufK * 0.8)}K |
-----------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

   2 - access("A"."ID"="B"."REF_ID")`
  }

  return `SQL_ID  ${s.sqlId}, child number 0
Plan hash value: ${Math.abs(s.sqlId.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0) % 9999999999)}

--------------------------------------------------------------------------------------------------------------
| Id  | Operation                      | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
--------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |               |    1 |       | ${eRows} |00:00:${elapsed} |   ${bufK}K |
|   1 |  SORT ORDER BY                |               |    1 | ${eRows} | ${eRows} |00:00:${elapsed} |   ${bufK}K |
|*  2 |   TABLE ACCESS FULL           | ${mainTable.padEnd(14)} |    1 | ${eRows} | ${eRows} |00:00:${(Number(elapsed) * 0.9).toFixed(2)} |   ${bufK}K |
--------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

   2 - filter(conditions on "${mainTable}")`
}

function seedToItem(s: ItemSeed, idx: number): WorkItem {
  // approval_pending 이후 상태면 기본 검증값 설정 (개별 seed에서 override 가능)
  const needsVerification = ['approval_pending', 'apply_pending', 'applied', 'rejected'].includes(s.status)
  // pending/tuning 아이템에 originalPlanText 자동 생성
  const needsPlan = ['pending', 'tuning'].includes(s.status) && !s.originalPlanText
  return {
    type: 'tuning',
    createdAt: '2026-04-02T02:00:00Z',
    updatedAt: '2026-04-02T08:00:00Z',
    assignee: ASSIGNEES[idx % 5],
    source: SOURCES[idx % 3],
    executionContext: EXEC_CONTEXTS[idx % 2],
    estimatedDailyExec: [120, 3400, 8900, 450, 15000, 22000, 680, 1200][idx % 8],
    ...(needsPlan ? { originalPlanText: generatePlanText(s) } : {}),
    ...s,
  }
}

// 추가 자동선정 항목 (BATCH-2024-127) — 총 35건이 되도록
const autoSeeds: ItemSeed[] = [
  // tuned (7건 추가 → 기존 4 + 7 = 11)
  { id: 'WI-2024-019', sqlId: 'aa1bb2cc3', sqlText: 'SELECT s.ship_id, s.ship_date, s.tracking_no FROM SHIPMENTS s WHERE s.order_id IN (SELECT order_id FROM ORDERS WHERE status)', status: 'approval_pending', workName: 'SHIPMENTS 배송조회 인덱스 최적화', instanceName: 'PROD-DB1', schemaName: 'OMS', selectionSource: 'auto', originalElapsed: 18200, originalBuffers: 1920000, tunedElapsed: 2700, tunedBuffers: 192000, improvementRate: 85.2, recommendationType: 'index', recommendationTypes: ['index'], batchId: 'BATCH-2024-127' },
  { id: 'WI-2024-020', sqlId: 'dd4ee5ff6', sqlText: 'SELECT w.warehouse_id, w.warehouse_name, COUNT(i.item_id) item_cnt FROM WAREHOUSES w LEFT JOIN INVENTORY i ON w.warehouse_id', status: 'approval_pending', workName: 'WAREHOUSE 재고집계 리라이트', instanceName: 'PROD-DB1', schemaName: 'OMS', selectionSource: 'auto', originalElapsed: 9400, originalBuffers: 980000, tunedElapsed: 1400, tunedBuffers: 98000, improvementRate: 85.1, recommendationType: 'rewrite', recommendationTypes: ['rewrite'], batchId: 'BATCH-2024-127' },
  { id: 'WI-2024-021', sqlId: 'gg7hh8ii9', sqlText: 'SELECT r.return_id, r.return_date, o.order_id, oi.product_name FROM RETURNS r JOIN ORDERS o ON r.order_id = o.order_id JOIN', status: 'approval_pending', workName: 'RETURNS-ORDERS 다중조인 힌트 최적화', instanceName: 'PROD-DB2', schemaName: 'OMS', selectionSource: 'auto', originalElapsed: 22100, originalBuffers: 2310000, tunedElapsed: 4400, tunedBuffers: 462000, improvementRate: 80.1, recommendationType: 'hint', recommendationTypes: ['hint', 'rewrite'], batchId: 'BATCH-2024-127' },
  { id: 'WI-2024-022', sqlId: 'jj0kk1ll2', sqlText: 'SELECT pay_id, pay_date, pay_amount, pay_method FROM PAYMENTS WHERE customer_id = :cust_id AND pay_date BETWEEN :from AND :to', status: 'approval_pending', workName: 'PAYMENTS 기간조회 인덱스 최적화', instanceName: 'PROD-DB1', schemaName: 'FIN', selectionSource: 'auto', originalElapsed: 14300, originalBuffers: 1490000, tunedElapsed: 2100, tunedBuffers: 149000, improvementRate: 85.3, recommendationType: 'index', recommendationTypes: ['index'], batchId: 'BATCH-2024-127' },
  { id: 'WI-2024-023', sqlId: 'mm3nn4oo5', sqlText: 'SELECT e.emp_id, e.hire_date, m.last_name mgr_name FROM EMP e LEFT JOIN EMP m ON e.manager_id = m.employee_id WHERE e.dept', status: 'approval_pending', workName: 'EMP Self-Join 매니저 조회 최적화', instanceName: 'PROD-DB1', schemaName: 'HR', selectionSource: 'auto', originalElapsed: 6700, originalBuffers: 710000, tunedElapsed: 1000, tunedBuffers: 71000, improvementRate: 85.1, recommendationType: 'hint', recommendationTypes: ['hint'], batchId: 'BATCH-2024-127' },
  { id: 'WI-2024-024', sqlId: 'pp6qq7rr8', sqlText: 'SELECT category_id, SUM(list_price * quantity_on_hand) total_value FROM PRODUCTS GROUP BY category_id HAVING SUM(list_price)', status: 'approval_pending', workName: 'PRODUCTS 카테고리별 재고가치 집계 최적화', instanceName: 'PROD-DB2', schemaName: 'OMS', selectionSource: 'auto', originalElapsed: 11800, originalBuffers: 1230000, tunedElapsed: 2400, tunedBuffers: 246000, improvementRate: 79.7, recommendationType: 'index', recommendationTypes: ['index', 'hint'], batchId: 'BATCH-2024-127' },
  { id: 'WI-2024-025', sqlId: 'ss9tt0uu1', sqlText: 'SELECT c.cust_id, c.cust_name, SUM(o.total_amount) ytd_amount FROM CUSTOMERS c JOIN ORDERS o ON c.customer_id = o.customer', status: 'approval_pending', workName: '고객별 연간매출 집계 리라이트', instanceName: 'PROD-DB1', schemaName: 'CRM', selectionSource: 'auto', originalElapsed: 31200, originalBuffers: 3280000, tunedElapsed: 4700, tunedBuffers: 328000, improvementRate: 84.9, recommendationType: 'rewrite', recommendationTypes: ['rewrite'], batchId: 'BATCH-2024-127' },
  // verified (5건 추가 → 기존 2 + 5 = 7)
  { id: 'WI-2024-026', sqlId: 'vv2ww3xx4', sqlText: 'SELECT invoice_id, invoice_date, total_amount FROM INVOICES WHERE status = \'UNPAID\' AND due_date < SYSDATE ORDER BY due_date', status: 'apply_pending', workName: 'INVOICES 미수금 조회 인덱스 최적화', instanceName: 'PROD-DB1', schemaName: 'FIN', selectionSource: 'auto', originalElapsed: 8900, originalBuffers: 930000, tunedElapsed: 1300, tunedBuffers: 93000, improvementRate: 85.4, recommendationType: 'index', recommendationTypes: ['index'], batchId: 'BATCH-2024-127', verifiedBy: '김민수', verifiedAt: '2026-04-02T09:00:00Z' },
  { id: 'WI-2024-027', sqlId: 'yy5zz6ab7', sqlText: 'SELECT p.promo_id, p.promo_name, COUNT(o.order_id) order_cnt FROM PROMOTIONS p LEFT JOIN ORDERS o ON p.promo_id = o.promo_id', status: 'apply_pending', workName: 'PROMOTIONS 프로모션효과 집계 최적화', instanceName: 'PROD-DB2', schemaName: 'OMS', selectionSource: 'auto', originalElapsed: 16500, originalBuffers: 1720000, tunedElapsed: 3300, tunedBuffers: 344000, improvementRate: 80.0, recommendationType: 'hint', recommendationTypes: ['hint'], batchId: 'BATCH-2024-127', verifiedBy: '이영희', verifiedAt: '2026-04-02T09:15:00Z' },
  { id: 'WI-2024-028', sqlId: 'cd8ef9gh0', sqlText: 'SELECT region_id, region_name, SUM(sales_amount) FROM REGIONAL_SALES WHERE sales_date >= ADD_MONTHS(SYSDATE, -12) GROUP BY', status: 'apply_pending', workName: 'REGIONAL_SALES 연간집계 최적화', instanceName: 'PROD-DB1', schemaName: 'OMS', selectionSource: 'auto', originalElapsed: 19800, originalBuffers: 2080000, tunedElapsed: 3000, tunedBuffers: 208000, improvementRate: 84.8, recommendationType: 'index', recommendationTypes: ['index', 'rewrite'], batchId: 'BATCH-2024-127', verifiedBy: '박준호', verifiedAt: '2026-04-02T09:20:00Z' },
  { id: 'WI-2024-029', sqlId: 'ij1kl2mn3', sqlText: 'SELECT l.log_id, l.action, l.created_at, u.username FROM ACTIVITY_LOG l JOIN USERS u ON l.user_id = u.user_id WHERE l.created', status: 'apply_pending', workName: 'ACTIVITY_LOG 사용자활동 조회 최적화', instanceName: 'PROD-DB2', schemaName: 'AUDIT', selectionSource: 'auto', originalElapsed: 7200, originalBuffers: 750000, tunedElapsed: 1100, tunedBuffers: 75000, improvementRate: 84.7, recommendationType: 'index', recommendationTypes: ['index'], batchId: 'BATCH-2024-127', verifiedBy: '정수진', verifiedAt: '2026-04-02T09:30:00Z' },
  { id: 'WI-2024-030', sqlId: 'op4qr5st6', sqlText: 'SELECT o.order_id, o.order_date, SUM(oi.unit_price * oi.quantity) FROM ORDERS o JOIN ORDER_ITEMS oi ON o.order_id = oi.order', status: 'apply_pending', workName: 'ORDERS-ITEMS 금액집계 힌트 최적화', instanceName: 'PROD-DB1', schemaName: 'OMS', selectionSource: 'auto', originalElapsed: 24600, originalBuffers: 2570000, tunedElapsed: 4900, tunedBuffers: 514000, improvementRate: 80.1, recommendationType: 'hint', recommendationTypes: ['hint', 'rewrite'], batchId: 'BATCH-2024-127', verifiedBy: '최동욱', verifiedAt: '2026-04-02T09:45:00Z' },
  // applied (2건 추가 → 기존 3 + 2 = 5)
  { id: 'WI-2024-031', sqlId: 'uv7wx8yz9', sqlText: 'SELECT c.contract_id, c.start_date, c.end_date, cu.customer_name FROM CONTRACTS c JOIN CUSTOMERS cu ON c.customer_id = cu.cust', status: 'applied', workName: 'CONTRACTS 만료예정 조회 최적화', instanceName: 'PROD-DB1', schemaName: 'CRM', selectionSource: 'auto', originalElapsed: 13400, originalBuffers: 1400000, tunedElapsed: 2000, tunedBuffers: 140000, improvementRate: 85.1, recommendationType: 'index', recommendationTypes: ['index'], batchId: 'BATCH-2024-127', verifiedBy: '김민수', verifiedAt: '2026-04-02T06:00:00Z', appliedAt: '2026-04-02T07:00:00Z', operationalElapsed: 1900, operationalBuffers: 135000, operationalResult: 'improved', operationalMeasuredAt: '2026-04-03T08:00:00Z' },
  { id: 'WI-2024-032', sqlId: 'ab0cd1ef2', sqlText: 'DELETE FROM TEMP_CALC WHERE calc_date < SYSDATE - 30 AND status = \'COMPLETED\'', status: 'applied', workName: 'TEMP_CALC 정리 배치 최적화', instanceName: 'PROD-DB2', schemaName: 'OMS', selectionSource: 'auto', originalElapsed: 45000, originalBuffers: 4700000, tunedElapsed: 6800, tunedBuffers: 470000, improvementRate: 84.9, recommendationType: 'rewrite', recommendationTypes: ['rewrite'], batchId: 'BATCH-2024-127', verifiedBy: '이영희', verifiedAt: '2026-04-02T06:30:00Z', appliedAt: '2026-04-02T07:30:00Z', operationalElapsed: Math.round(45000 * 1.3), operationalBuffers: Math.round(4700000 * 1.3), operationalResult: 'regressed', operationalMeasuredAt: '2026-04-03T07:30:00Z' },
  // retune_requested 추가 없음 (pending으로 통합됨)
  // tuning 추가 없음 (기존 2건 유지)
  // pending 추가 없음 (기존 2건 유지)
  // retune_requested 없음 (pending으로 통합됨)
]

// 추가 수동선정 항목
const manualSeeds: ItemSeed[] = [
  // tuned (2건)
  { id: 'WI-2024-034', sqlId: 'mn6op7qr8', sqlText: 'SELECT t.ticket_id, t.subject, t.priority, u.username FROM TICKETS t JOIN USERS u ON t.assigned_to = u.user_id WHERE t.status', status: 'approval_pending', workName: 'TICKETS 미처리 티켓 조회 최적화', instanceName: 'PROD-DB1', schemaName: 'CRM', selectionSource: 'manual', originalElapsed: 8800, originalBuffers: 920000, tunedElapsed: 1300, tunedBuffers: 92000, improvementRate: 85.2, recommendationType: 'index', recommendationTypes: ['index'], batchId: 'BATCH-2024-M01', batchMemo: '4/3 14:30 · PROD-DB1 · TOP SQL · 8건' },
  { id: 'WI-2024-035', sqlId: 'st9uv0wx1', sqlText: 'SELECT feedback_id, rating, comments FROM CUSTOMER_FEEDBACK WHERE product_id = :pid AND rating <= 2 ORDER BY created_at DESC', status: 'approval_pending', workName: 'FEEDBACK 저평가 조회 인덱스 최적화', instanceName: 'PROD-DB2', schemaName: 'CRM', selectionSource: 'manual', originalElapsed: 5200, originalBuffers: 540000, tunedElapsed: 780, tunedBuffers: 54000, improvementRate: 85.0, recommendationType: 'index', recommendationTypes: ['index', 'hint'], batchId: 'BATCH-2024-M01', batchMemo: '4/3 14:30 · PROD-DB1 · TOP SQL · 8건' },
  // verified (3건)
  { id: 'WI-2024-036', sqlId: 'yz2ab3cd4', sqlText: 'SELECT budget_id, dept_id, fiscal_year, amount_allocated, amount_spent FROM BUDGETS WHERE fiscal_year = :yr AND dept_id = :d', status: 'apply_pending', workName: 'BUDGETS 예산조회 힌트 최적화', instanceName: 'PROD-DB1', schemaName: 'FIN', selectionSource: 'manual', originalElapsed: 3400, originalBuffers: 350000, tunedElapsed: 510, tunedBuffers: 35000, improvementRate: 85.0, recommendationType: 'hint', recommendationTypes: ['hint'], batchId: 'BATCH-2024-M03', batchMemo: '4/5 09:00 · PROD-DB1 · TOP SQL · 4건', verifiedBy: '최동욱', verifiedAt: '2026-04-01T15:00:00Z' },
  { id: 'WI-2024-037', sqlId: 'ef5gh6ij7', sqlText: 'SELECT v.vendor_id, v.vendor_name, SUM(po.amount) total_po FROM VENDORS v JOIN PURCHASE_ORDERS po ON v.vendor_id = po.vendor', status: 'apply_pending', workName: 'VENDORS 구매집계 리라이트', instanceName: 'PROD-DB2', schemaName: 'FIN', selectionSource: 'manual', originalElapsed: 14200, originalBuffers: 1480000, tunedElapsed: 2800, tunedBuffers: 296000, improvementRate: 80.3, recommendationType: 'rewrite', recommendationTypes: ['rewrite'], batchId: 'BATCH-2024-M03', batchMemo: '4/5 09:00 · PROD-DB1 · TOP SQL · 4건', verifiedBy: '김민수', verifiedAt: '2026-04-01T16:00:00Z' },
  { id: 'WI-2024-038', sqlId: 'kl8mn9op0', sqlText: 'SELECT session_id, login_time, ip_address FROM USER_SESSIONS WHERE user_id = :uid AND logout_time IS NULL', status: 'apply_pending', workName: 'USER_SESSIONS 활성세션 조회 최적화', instanceName: 'PROD-DB1', schemaName: 'AUDIT', selectionSource: 'manual', originalElapsed: 1800, originalBuffers: 190000, tunedElapsed: 270, tunedBuffers: 19000, improvementRate: 85.0, recommendationType: 'index', recommendationTypes: ['index'], batchId: 'BATCH-2024-M02', batchMemo: '4/4 10:15 · PROD-DB2 · TOP SQL · 3건', verifiedBy: '이영희', verifiedAt: '2026-04-01T17:00:00Z' },
  // applied (2건)
  { id: 'WI-2024-039', sqlId: 'qr1st2uv3', sqlText: 'SELECT n.notification_id, n.message, n.sent_at FROM NOTIFICATIONS n WHERE n.user_id = :uid AND n.is_read = 0 ORDER BY sent_at', status: 'applied', workName: 'NOTIFICATIONS 미읽음 조회 최적화', instanceName: 'PROD-DB1', schemaName: 'CRM', selectionSource: 'manual', originalElapsed: 4500, originalBuffers: 470000, tunedElapsed: 680, tunedBuffers: 47000, improvementRate: 84.9, recommendationType: 'index', recommendationTypes: ['index'], batchId: 'BATCH-2024-M01', batchMemo: '4/3 14:30 · PROD-DB1 · TOP SQL · 8건', verifiedBy: '정수진', verifiedAt: '2026-03-31T10:00:00Z', appliedAt: '2026-03-31T14:00:00Z', operationalElapsed: 650, operationalBuffers: 44000, operationalResult: 'improved', operationalMeasuredAt: '2026-04-01T08:00:00Z' },
  { id: 'WI-2024-040', sqlId: 'wx4yz5ab6', sqlText: 'SELECT doc_id, doc_name, version, modified_by FROM DOCUMENTS WHERE folder_id = :fid AND is_deleted = 0 ORDER BY modified_at', status: 'applied', workName: 'DOCUMENTS 폴더내 문서조회 최적화', instanceName: 'DEV-DB1', schemaName: 'CRM', selectionSource: 'manual', originalElapsed: 3200, originalBuffers: 330000, tunedElapsed: 480, tunedBuffers: 33000, improvementRate: 85.0, recommendationType: 'hint', recommendationTypes: ['hint'], batchId: 'BATCH-2024-M01', batchMemo: '4/3 14:30 · PROD-DB1 · TOP SQL · 8건', verifiedBy: '최동욱', verifiedAt: '2026-03-30T11:00:00Z', appliedAt: '2026-03-30T15:00:00Z', operationalElapsed: 500, operationalBuffers: 34000, operationalResult: 'improved', operationalMeasuredAt: '2026-03-31T08:00:00Z' },
  // pending (2건)
  { id: 'WI-2024-041', sqlId: 'cd7ef8gh9', sqlText: 'SELECT task_id, task_name, assigned_to, due_date FROM PROJECT_TASKS WHERE project_id = :pid AND status != \'DONE\' ORDER BY due', status: 'pending', workName: 'PROJECT_TASKS 미완료 작업 조회 최적화', instanceName: 'PROD-DB1', schemaName: 'CRM', selectionSource: 'manual', originalElapsed: 2800, originalBuffers: 290000, batchId: 'BATCH-2024-M01', batchMemo: '4/3 14:30 · PROD-DB1 · TOP SQL · 8건', queuePosition: 4 },
  { id: 'WI-2024-042', sqlId: 'ij0kl1mn2', sqlText: 'SELECT approval_id, request_type, requested_by, status FROM APPROVAL_REQUESTS WHERE approver_id = :uid AND status = \'PENDING\'', status: 'pending', workName: 'APPROVAL_REQUESTS 대기 결재 조회 최적화', instanceName: 'PROD-DB2', schemaName: 'AUDIT', selectionSource: 'manual', originalElapsed: 1500, originalBuffers: 155000, batchId: 'BATCH-2024-M02', batchMemo: '4/4 10:15 · PROD-DB2 · TOP SQL · 3건', queuePosition: 5 },
  // tuning (1건)
  { id: 'WI-2024-043', sqlId: 'op3qr4st5', sqlText: 'SELECT report_id, report_name, generated_at, file_size FROM REPORTS WHERE dept_id = :did AND generated_at >= TRUNC(SYSDATE, \'MM\')', status: 'tuning', workName: 'REPORTS 월간보고서 조회 최적화', instanceName: 'PROD-DB1', schemaName: 'FIN', selectionSource: 'manual', originalElapsed: 6100, originalBuffers: 640000, batchId: 'BATCH-2024-M03', batchMemo: '4/5 09:00 · PROD-DB1 · TOP SQL · 4건', analysisStep: 'plan_collection', originalPlanText: `SQL_ID  op3qr4st5, child number 0
Plan hash value: 1847293650

--------------------------------------------------------------------------------------------------------------
| Id  | Operation                      | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
--------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |               |    1 |       |   380 |00:00:06.10 |   640K |
|   1 |  SORT ORDER BY                |               |    1 |   380 |   380 |00:00:06.10 |   640K |
|*  2 |   TABLE ACCESS FULL           | REPORTS       |    1 | 45000 | 45000 |00:00:05.40 |   640K |
--------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

   2 - filter("DEPT_ID"=:DID AND "GENERATED_AT">=TRUNC(SYSDATE,'MM'))` },
  // 재튜닝 (pending으로 복귀, retuneCount=1)
  { id: 'WI-2024-045', sqlId: 'ab9cd0ef1', sqlText: 'SELECT emp_id, attendance_date, check_in, check_out FROM ATTENDANCE WHERE emp_id = :eid AND attendance_date BETWEEN :from AND :to', status: 'pending', workName: 'ATTENDANCE 출결조회 인덱스 최적화', instanceName: 'PROD-DB1', schemaName: 'HR', selectionSource: 'manual', originalElapsed: 4200, originalBuffers: 440000, tunedElapsed: 3800, tunedBuffers: 410000, improvementRate: 6.8, recommendationType: 'index', recommendationTypes: ['index'], batchId: 'BATCH-2024-M01', batchMemo: '4/3 14:30 · PROD-DB1 · TOP SQL · 8건', retuneRequestedBy: '김민수', retuneRequestedAt: '2026-04-01T12:00:00Z', retuneConditions: ['힌트 포함 재분석'], retuneReason: '인덱스만으로는 개선 부족' },
]

// 추가 자동선정: BATCH-2024-127에 더 넣어서 총 auto=35건 맞추기
// 기존 auto: 15건 (WI-001~018 중 auto) + autoSeeds: 15건 = 30건 → 5건 더 필요
const extraAutoSeeds: ItemSeed[] = [
  { id: 'WI-2024-046', sqlId: 'gh2ij3kl4', sqlText: 'SELECT loc_id, loc_name, capacity, current_count FROM LOCATIONS WHERE warehouse_id = :wid AND current_count > capacity * 0.9', status: 'apply_pending', workName: 'LOCATIONS 과적 창고 조회 최적화', instanceName: 'PROD-DB1', schemaName: 'OMS', selectionSource: 'auto', originalElapsed: 5600, originalBuffers: 590000, tunedElapsed: 840, tunedBuffers: 59000, improvementRate: 85.0, recommendationType: 'index', recommendationTypes: ['index'], batchId: 'BATCH-2024-127', verifiedBy: '김민수', verifiedAt: '2026-04-02T10:00:00Z' },
  { id: 'WI-2024-047', sqlId: 'mn5op6qr7', sqlText: 'SELECT batch_id, job_name, start_time, end_time, status FROM BATCH_JOBS WHERE start_time >= TRUNC(SYSDATE) ORDER BY start_time', status: 'apply_pending', workName: 'BATCH_JOBS 당일 작업 조회 최적화', instanceName: 'PROD-DB2', schemaName: 'OMS', selectionSource: 'auto', originalElapsed: 4100, originalBuffers: 430000, tunedElapsed: 620, tunedBuffers: 43000, improvementRate: 84.9, recommendationType: 'hint', recommendationTypes: ['hint'], batchId: 'BATCH-2024-127', verifiedBy: '이영희', verifiedAt: '2026-04-02T10:15:00Z' },
  { id: 'WI-2024-048', sqlId: 'st8uv9wx0', sqlText: 'SELECT coupon_id, coupon_code, discount_rate, expiry_date FROM COUPONS WHERE expiry_date > SYSDATE AND is_active = 1 AND usage', status: 'apply_pending', workName: 'COUPONS 유효쿠폰 조회 리라이트', instanceName: 'PROD-DB1', schemaName: 'OMS', selectionSource: 'auto', originalElapsed: 7800, originalBuffers: 820000, tunedElapsed: 1200, tunedBuffers: 82000, improvementRate: 84.6, recommendationType: 'rewrite', recommendationTypes: ['rewrite'], batchId: 'BATCH-2024-127', verifiedBy: '박준호', verifiedAt: '2026-04-02T10:30:00Z' },
  { id: 'WI-2024-049', sqlId: 'yz1ab2cd3', sqlText: 'SELECT tax_id, tax_rate, effective_date FROM TAX_RULES WHERE country_code = :cc AND effective_date <= SYSDATE ORDER BY effective', status: 'approval_pending', workName: 'TAX_RULES 세율조회 인덱스 최적화', instanceName: 'PROD-DB2', schemaName: 'FIN', selectionSource: 'auto', originalElapsed: 3200, originalBuffers: 340000, tunedElapsed: 480, tunedBuffers: 34000, improvementRate: 85.0, recommendationType: 'index', recommendationTypes: ['index'], batchId: 'BATCH-2024-127' },
  { id: 'WI-2024-050', sqlId: 'ef4gh5ij6', sqlText: 'SELECT sku, product_name, reorder_level, quantity_on_hand FROM PRODUCTS WHERE quantity_on_hand < reorder_level AND is_active = 1', status: 'apply_pending', workName: 'PRODUCTS 재주문 대상 조회 최적화', instanceName: 'PROD-DB1', schemaName: 'OMS', selectionSource: 'auto', originalElapsed: 9200, originalBuffers: 960000, tunedElapsed: 1400, tunedBuffers: 96000, improvementRate: 84.8, recommendationType: 'index', recommendationTypes: ['index', 'hint'], batchId: 'BATCH-2024-127', verifiedBy: '정수진', verifiedAt: '2026-04-02T10:45:00Z' },
  { id: 'WI-2024-051', sqlId: 'kl9mn0op1', sqlText: 'SELECT c.customer_id, c.customer_name, SUM(s.amount) total_sales FROM CUSTOMERS c, SALES s WHERE c.customer_id = s.customer_id GROUP BY c.customer_id, c.customer_name ORDER BY total_sales DESC', status: 'approval_pending', workName: '고객별 매출집계 CTE 다단계 리라이트', instanceName: 'PROD-DB1', schemaName: 'OMS', selectionSource: 'auto', originalElapsed: 38500, originalBuffers: 4020000, tunedElapsed: 4200, tunedBuffers: 380000, improvementRate: 89.1, recommendationType: 'rewrite', recommendationTypes: ['index', 'hint', 'rewrite'], batchId: 'BATCH-2024-127' },
  { id: 'WI-2024-052', sqlId: 'mock_sql_052', sqlText: 'select inc_id -- 장애 ID\n     , inc_id as key\n     , inc_tas_id as tas_id -- 단계\n     , get_stepname(inc_tas_id) as tas_name  -- 단계명\n     , get_dept_name(inc_reg_emp_id) as empdpt_name   -- 요청부서\n     , get_emp_name(inc_reg_emp_id) as emp_name   -- 요청자\n     , get_code_label(inc_work_area_cd) as work_area_name -- 장애구분\n     , nvl(inc_req_title,\'제목없음\') as req_title -- 제목\n     , inc_grade_cd AS grade_cd   --장애등급\n     , get_code_label(inc_grade_cd) AS grade_name --장애등급명\n     , inc_med_cd as med_cd    -- 장애인지경로\n     , get_code_label(inc_med_cd) as med_name -- 장애인지경로명\n     , decode(inc_wor_yn,\'1\',\'가동\',\'미가동\') as wor_yn --장애처리반가동여부\n     , decode(inc_sol_cd,\'ICMSOL09\',get_dept_name(inc_prt_ass_emp_id),(SELECT DISTINCT get_dept_name(iwf_emp_id) FROM ops_incident_wf WHERE iwf_src_id = inc_id AND iwf_tas_id = \'TICM12010\' AND rownum =1)) AS ass_dpt_name\n     , decode(inc_sol_cd,\'ICMSOL09\',get_emp_name(inc_prt_ass_emp_id),(SELECT DISTINCT get_emp_name(iwf_emp_id) FROM ops_incident_wf WHERE iwf_src_id = inc_id AND iwf_tas_id = \'TICM12010\' AND rownum =1)) AS ass_emp_name\n     , fmt_datetime(inc_dcs_rec_dttm) as dec_rec_dttm -- 인지일시\n     , inc_imp_cd AS imp_cd -- 영향도\n     , get_code_label(inc_imp_cd) AS imp_name   -- 영향도명\n     , fmt_datetime(inc_actstart_dttm) as rec_dttm -- 장애발생일시\n     , fmt_datetime(inc_actfinish_dttm) as actfinish_dttm -- 조치완료일시\n     , decode(inc_rel_dttm,\'\',\'\',inc_rel_dttm||\'분\') as rel_dttm -- 총 장애시간\n     , decode(inc_svc_stop_yn,\'1\',\'중단\',\'무중단\') as svc_stop_yn\n     ,(select listagg(cm_name, \',\') within group(order by cm_name)\n       from ops_config where cm_id in (select wcf_cm_id from ops_wf_config where wcf_src_id = inc_id)) as cm_name\n     , inc_cas_cd as cas_cd -- 장애원인\n     , get_code_label(inc_cas_cd) as cas_name -- 장애원인명\n     , decode(inc_sol_yn,\'1\',\'완전해결\',\'임시해결\') as sol_yn\n     , inc_slo_cd as slo_cd -- 장애해결유형\n     , get_code_label(inc_slo_cd) as slo_name\n     , decode(inc_act_mh,\'\',\'\',inc_act_mh||\'(M/H)\') as act_mh\nfrom ops_incident icm\nwhere inc_tas_id not in (\'TAS03454\',\'TICM21020\',\'TICM21030\',\'TICM22010\',\'TICM23010\',\'TICM24010\',\'TICM25010\',\'TICM25030\')\n and INC_REQ_DTTM between :B1 || \'000000\' and :B2 || \'235959\'\norder by inc_actstart_dttm desc, inc_id desc', status: 'apply_pending', workName: '장애이력조회 스칼라서브쿼리 인라인뷰 변환', instanceName: 'PROD-OPS1', schemaName: 'OPS_ADMIN', selectionSource: 'manual', originalElapsed: 4380, originalBuffers: 858000, tunedElapsed: 50, tunedBuffers: 4944, improvementRate: 98.9, recommendationType: 'rewrite', recommendationTypes: ['rewrite'], batchId: 'BATCH-2024-128', verifiedBy: '김민수', verifiedAt: '2026-04-03T09:00:00Z' },
  { id: 'WI-2024-053', sqlId: 'mock_sql_053', sqlText: '/* TASK_TODO_Mail_Cond Created By STEG. */\nselect id as key, ent_id, tsk_req_emp_id as emp_id,\n       \'admin@example.com\' as emp_email, \'kr\' as user_charset\nfrom (\n  SELECT /* 메인 : 나의 할일 리스트 */\n    T.id AS ID, E.TAS_ENT_ID AS ENT_ID, t.tsk_cat_cd,\n    GET_EMP_NAME(tsk_req_emp_id) as req_emp_name,  -- function call 부하\n    GET_EMP_NAME(tsk_ass_emp_id) as ass_emp_name,  -- function call 부하\n    GET_CURRENT_TS() as sys_date                     -- function call 부하\n  FROM OPS_TASK T, WF_TASK E, WF_ACTIVITY A, WF_WORKFLOW W\n  WHERE T.TSK_TAS_ID = E.TAS_ID\n    AND E.TAS_ACT_ID = A.ACT_ID AND A.ACT_WOF_ID = W.WOF_ID\n    /* ... UNION ALL of 19 cond blocks ... */\n  ORDER BY id\n) WHERE ROWNUM <= 100', status: 'apply_pending', workName: 'TASK_TODO 메일조건 Function Call 제거', instanceName: 'PROD-OPS1', schemaName: 'OPS_ADMIN', selectionSource: 'manual', originalElapsed: 14960, originalBuffers: 540000, tunedElapsed: 4110, tunedBuffers: 262000, improvementRate: 72.5, recommendationType: 'rewrite', recommendationTypes: ['rewrite'], batchId: 'BATCH-2024-128', verifiedBy: '이영희', verifiedAt: '2026-04-03T09:30:00Z' },
  { id: 'WI-2024-054', sqlId: 'mock_sql_054', sqlText: 'SELECT /* 메인 : 나의 할일 리스트 */\n    T.TSK_SR_ID AS APR_ID,\n    T.TSK_SR_ID AS ID,\n    E.TAS_ENT_ID AS ENT_ID,\n    E.TAS_ID, E.TAS_NAME,\n    (SELECT FMT_DATETIME(T.TSK_REQ_DTTM) FROM DUAL) REQ_DTTM,\n    (SELECT GET_DEPT_NAME(T.TSK_REQ_EMP_ID) FROM DUAL) AS REQ_DPT_NAME,\n    (SELECT GET_EMP_NAME(T.TSK_REQ_EMP_ID) FROM DUAL) AS REQ_EMP_NAME,\n    (SELECT GET_EMP_NAME(TSK_ASS_EMP_ID) FROM DUAL) AS ASS_NAME\nFROM OPS_TASK T, WF_TASK E, WF_ACTIVITY A, WF_WORKFLOW W\nWHERE T.TSK_TAS_ID = E.TAS_ID\n  AND E.TAS_TYPE IN (\'1\',\'2\',\'4\')\n  AND E.TAS_ACT_ID = A.ACT_ID\n  AND A.ACT_WOF_ID = W.WOF_ID\n  AND T.TSK_ENT_ID NOT IN (\'PMS\',\'PTC\',\'PRSK\',\'PREQ\',\'PFAM\',\'PAI\')\n  AND ((TSK_ASS_EMP_ID = :1 AND TSK_TAS_ID NOT IN (\'TAS03165\',\'TCSR12010\'))\n    OR (TSK_ASS_WOG_ID IN (SELECT MEM_WOG_ID FROM HR_MEMBER WHERE MEM_EMP_ID = :2))\n    OR (TSK_ASS_EMP_ID IN (SELECT EMP_ID FROM HR_EMPLOYEE\n        WHERE GET_CURRENT_TS() BETWEEN EMP_AGCSTART_DTTM AND EMP_AGCFINISH_DTTM\n        AND EMP_AGC_EMP_ID = :7)))\nORDER BY REQ_DTTM DESC', status: 'apply_pending', workName: '메인 나의할일 Function/서브쿼리 최적화', instanceName: 'PROD-OPS1', schemaName: 'OPS_ADMIN', selectionSource: 'manual', originalElapsed: 1860, originalBuffers: 62350, tunedElapsed: 790, tunedBuffers: 61658, improvementRate: 57.5, recommendationType: 'rewrite', recommendationTypes: ['rewrite'], batchId: 'BATCH-2024-128', verifiedBy: '박준호', verifiedAt: '2026-04-03T10:00:00Z' },
]

// ─── 최근 작업 (시간축 필터용) — 오늘/어제 야간 배치 ───
const recentJobSeeds: ItemSeed[] = [
  // BATCH-2026-T01: 오늘(04-07) 새벽 1시 시작 → 진행중 (auto)
  { id: 'WI-2026-T01', sqlId: 't01_sql_001', sqlText: 'SELECT order_id, order_date, total_amount FROM ORDERS WHERE order_date >= TRUNC(SYSDATE) AND status = \'PENDING\'', status: 'tuning', workName: 'ORDERS 당일 미처리 조회 최적화', instanceName: 'PROD-DB1', schemaName: 'OMS', selectionSource: 'auto', originalElapsed: 8400, originalBuffers: 880000, batchId: 'BATCH-2026-T01', batchMemo: '4/7 새벽 · PROD-DB1 · 정기 자동 · 7건', analysisStep: 'plan_generation', createdAt: '2026-04-07T01:00:00Z', updatedAt: '2026-04-07T01:42:00Z' },
  { id: 'WI-2026-T02', sqlId: 't01_sql_002', sqlText: 'SELECT u.user_id, u.username, COUNT(s.session_id) session_cnt FROM USERS u LEFT JOIN USER_SESSIONS s ON u.user_id = s.user_id WHERE u.last_login >= SYSDATE - 7 GROUP BY u.user_id, u.username', status: 'pending', workName: 'USERS 활성 사용자 세션 집계', instanceName: 'PROD-DB1', schemaName: 'CRM', selectionSource: 'auto', originalElapsed: 12600, originalBuffers: 1320000, batchId: 'BATCH-2026-T01', batchMemo: '4/7 새벽 · PROD-DB1 · 정기 자동 · 7건', queuePosition: 1, createdAt: '2026-04-07T01:00:00Z', updatedAt: '2026-04-07T01:00:00Z' },
  { id: 'WI-2026-T03', sqlId: 't01_sql_003', sqlText: 'SELECT product_id, SUM(quantity) sold_qty FROM ORDER_ITEMS WHERE created_at >= SYSDATE - 1 GROUP BY product_id ORDER BY sold_qty DESC', status: 'pending', workName: '일일 상품 판매량 TOP 조회', instanceName: 'PROD-DB1', schemaName: 'OMS', selectionSource: 'auto', originalElapsed: 5800, originalBuffers: 610000, batchId: 'BATCH-2026-T01', batchMemo: '4/7 새벽 · PROD-DB1 · 정기 자동 · 7건', queuePosition: 2, createdAt: '2026-04-07T01:00:00Z', updatedAt: '2026-04-07T01:00:00Z' },
  { id: 'WI-2026-T04', sqlId: 't01_sql_004', sqlText: 'SELECT inv_id, inv_date, total FROM INVOICES WHERE due_date < SYSDATE AND status = \'UNPAID\'', status: 'pending', workName: 'INVOICES 연체건 조회', instanceName: 'PROD-DB1', schemaName: 'FIN', selectionSource: 'auto', originalElapsed: 4100, originalBuffers: 430000, batchId: 'BATCH-2026-T01', batchMemo: '4/7 새벽 · PROD-DB1 · 정기 자동 · 7건', queuePosition: 3, createdAt: '2026-04-07T01:00:00Z', updatedAt: '2026-04-07T01:00:00Z' },
  { id: 'WI-2026-T05', sqlId: 't01_sql_005', sqlText: 'SELECT log_id, action, user_id FROM ACTIVITY_LOG WHERE created_at >= SYSDATE - 1', status: 'pending', workName: 'ACTIVITY_LOG 24시간 활동 조회', instanceName: 'PROD-DB1', schemaName: 'AUDIT', selectionSource: 'auto', originalElapsed: 7200, originalBuffers: 750000, batchId: 'BATCH-2026-T01', batchMemo: '4/7 새벽 · PROD-DB1 · 정기 자동 · 7건', queuePosition: 4, createdAt: '2026-04-07T01:00:00Z', updatedAt: '2026-04-07T01:00:00Z' },

]

// 직접검증요청 (개발자가 SQL 텍스트를 직접 제출)
const directVerifySeeds: ItemSeed[] = [
  { id: 'WI-2024-DV03', sqlId: 'dv_pay_003', sqlText: 'SELECT COUNT(*) total_cnt, SUM(CASE WHEN status = \'SUCCESS\' THEN 1 ELSE 0 END) success_cnt, SUM(CASE WHEN status = \'FAIL\' THEN amount ELSE 0 END) fail_amount FROM PAYMENTS WHERE pay_date = TRUNC(SYSDATE) AND merchant_id = :mid', status: 'tuning', workName: '일일 결제 통계 집계 최적화', instanceName: 'PROD-DB1', schemaName: 'PAY', selectionSource: 'direct_verify', requestedBy: '이준혁 (결제팀)', originalElapsed: 8900, originalBuffers: 920000, batchId: 'BATCH-2024-DV01', batchMemo: '4/6 16:00 · PROD-DB1 · 직접등록 · 이준혁(결제팀) · 3건', analysisStep: 'plan_generation' },
]

// no_improve / cancelled 종착 상태 시드 (V1 신규 — QueryMedic 기준 분리)
const terminalSeeds: ItemSeed[] = [
  // no_improve: AI 분석 정상 완료, 개선 여지 없음
  { id: 'WI-2024-NI01', sqlId: 'ni_01_pkscan', sqlText: 'SELECT * FROM CUSTOMERS WHERE customer_id = :cid', status: 'no_improve', workName: 'CUSTOMERS PK 단건 조회 — 개선없음', instanceName: 'PROD-DB1', schemaName: 'CRM', selectionSource: 'auto', originalElapsed: 12, originalBuffers: 4, recommendationType: 'index', batchId: 'BATCH-2024-127', batchMemo: '4/2 새벽 · PROD-DB1·DB2 · 프리셋:야간배치 · 36건', cancelReason: 'PK 인덱스 단건 조회로 이미 최적 — 추가 개선 여지 없음' },
  { id: 'WI-2024-NI02', sqlId: 'ni_02_smalltbl', sqlText: 'SELECT code, name FROM CODE_MASTER WHERE code_group = :grp ORDER BY sort_no', status: 'no_improve', workName: 'CODE_MASTER 코드조회 — 개선없음', instanceName: 'PROD-DB2', schemaName: 'COMMON', selectionSource: 'auto', originalElapsed: 35, originalBuffers: 28, recommendationType: 'index', batchId: 'BATCH-2024-127', batchMemo: '4/2 새벽 · PROD-DB1·DB2 · 프리셋:야간배치 · 36건', cancelReason: '소량 테이블 풀스캔이 가장 효율적 — 인덱스 추가 효과 없음' },
  // cancelled: 사용자가 명시적으로 취소한 케이스
  { id: 'WI-2024-CN01', sqlId: 'cn_01_userstop', sqlText: 'SELECT o.order_id, o.order_date, c.customer_name FROM ORDERS o JOIN CUSTOMERS c ON o.customer_id = c.customer_id WHERE o.order_date BETWEEN :s AND :e', status: 'cancelled', workName: 'ORDERS 기간조회 — 사용자 취소', instanceName: 'PROD-DB1', schemaName: 'OMS', selectionSource: 'manual', originalElapsed: 4200, originalBuffers: 440000, batchId: 'BATCH-2024-M01', batchMemo: '4/3 14:30 · PROD-DB1 · TOP SQL · 8건', cancelReason: '사용자 취소 — 운영 점검 중', cancelledAt: '2026-04-03T15:10:00Z' },
  { id: 'WI-2024-CN02', sqlId: 'cn_02_userstop', sqlText: 'SELECT pay_id, pay_amount FROM PAYMENTS WHERE pay_date >= TRUNC(SYSDATE) - 1 AND status = :st', status: 'cancelled', workName: 'PAYMENTS 일별집계 — 사용자 취소', instanceName: 'PROD-DB2', schemaName: 'FIN', selectionSource: 'auto', originalElapsed: 2300, originalBuffers: 240000, batchId: 'BATCH-2024-127', batchMemo: '4/2 새벽 · PROD-DB1·DB2 · 프리셋:야간배치 · 36건', cancelReason: '사용자 취소 — 우선순위 변경', cancelledAt: '2026-04-02T03:45:00Z' },
]

// ─── 최근 1개월 반영대기 (2026-03-10 ~ 2026-04-10) ───
const recentApplyPendingSeeds: ItemSeed[] = [
  // BATCH-2026-B01: 3/12 새벽 · PROD-DB1 · 5건
  { id: 'WI-2026-AP01', sqlId: 'ap01_ord_del', sqlText: 'SELECT o.order_id, o.shipped_date, d.tracking_no, d.estimated_arrival FROM ORDERS o JOIN DELIVERIES d ON o.order_id = d.order_id WHERE d.status = \'DELAYED\' AND o.order_date >= SYSDATE - 7', status: 'apply_pending', workName: 'ORDERS 배송지연 조회 인덱스 최적화', instanceName: 'PROD-DB1', schemaName: 'OMS', selectionSource: 'auto', originalElapsed: 18400, originalBuffers: 1920000, tunedElapsed: 2760, tunedBuffers: 192000, improvementRate: 85.0, recommendationType: 'index', recommendationTypes: ['index'], batchId: 'BATCH-2026-B01', batchMemo: '3/12 새벽 · PROD-DB1 · 야간배치 · 5건', verifiedBy: '김민수', verifiedAt: '2026-03-14T10:00:00Z', createdAt: '2026-03-12T02:00:00Z', updatedAt: '2026-03-14T10:00:00Z' },
  { id: 'WI-2026-AP02', sqlId: 'ap02_pay_fail', sqlText: 'SELECT p.pay_id, p.pay_date, p.amount, p.fail_reason, m.merchant_name FROM PAYMENTS p JOIN MERCHANTS m ON p.merchant_id = m.merchant_id WHERE p.status = \'FAILED\' AND p.pay_date >= TRUNC(SYSDATE) - 1', status: 'apply_pending', workName: 'PAYMENT_LOG 결제실패 분석 힌트 추가', instanceName: 'PROD-DB1', schemaName: 'FIN', selectionSource: 'auto', originalElapsed: 9200, originalBuffers: 960000, tunedElapsed: 1840, tunedBuffers: 96000, improvementRate: 80.0, recommendationType: 'hint', recommendationTypes: ['hint'], batchId: 'BATCH-2026-B01', batchMemo: '3/12 새벽 · PROD-DB1 · 야간배치 · 5건', verifiedBy: '이영희', verifiedAt: '2026-03-14T11:00:00Z', createdAt: '2026-03-12T02:00:00Z', updatedAt: '2026-03-14T11:00:00Z' },
  { id: 'WI-2026-AP03', sqlId: 'ap03_mbr_stat', sqlText: 'SELECT m.member_id, m.grade, COUNT(o.order_id) order_cnt, SUM(o.total_amount) total_spend FROM MEMBERS m LEFT JOIN ORDERS o ON m.member_id = o.member_id WHERE o.order_date >= ADD_MONTHS(TRUNC(SYSDATE,\'MM\'),-1) GROUP BY m.member_id, m.grade', status: 'apply_pending', workName: 'MEMBER_STATS 월별집계 스칼라→조인 변환', instanceName: 'PROD-DB1', schemaName: 'CRM', selectionSource: 'auto', originalElapsed: 34500, originalBuffers: 3600000, tunedElapsed: 4140, tunedBuffers: 360000, improvementRate: 88.0, recommendationType: 'rewrite', recommendationTypes: ['rewrite', 'hint'], batchId: 'BATCH-2026-B01', batchMemo: '3/12 새벽 · PROD-DB1 · 야간배치 · 5건', verifiedBy: '박준호', verifiedAt: '2026-03-14T13:00:00Z', createdAt: '2026-03-12T02:00:00Z', updatedAt: '2026-03-14T13:00:00Z' },

  // BATCH-2026-B02: 3/18 새벽 · PROD-DB2 · 4건
  { id: 'WI-2026-AP04', sqlId: 'ap04_inv_low', sqlText: 'SELECT i.item_id, i.item_name, i.stock_qty, i.reorder_point, s.supplier_name FROM INVENTORY i JOIN SUPPLIERS s ON i.supplier_id = s.supplier_id WHERE i.stock_qty < i.reorder_point AND i.is_active = 1 ORDER BY i.stock_qty', status: 'apply_pending', workName: 'INVENTORY 재고부족 알림 인덱스 최적화', instanceName: 'PROD-DB2', schemaName: 'OMS', selectionSource: 'auto', originalElapsed: 11800, originalBuffers: 1240000, tunedElapsed: 1770, tunedBuffers: 124000, improvementRate: 85.0, recommendationType: 'index', recommendationTypes: ['index'], batchId: 'BATCH-2026-B02', batchMemo: '3/18 새벽 · PROD-DB2 · 야간배치 · 4건', verifiedBy: '정수진', verifiedAt: '2026-03-20T09:00:00Z', createdAt: '2026-03-18T02:00:00Z', updatedAt: '2026-03-20T09:00:00Z' },
  { id: 'WI-2026-AP05', sqlId: 'ap05_sess_log', sqlText: 'SELECT s.session_id, s.user_id, s.login_time, s.logout_time, s.ip_addr FROM SESSION_LOG s WHERE s.login_time >= SYSDATE - 30 AND s.user_id IN (SELECT user_id FROM BLOCKED_USERS)', status: 'apply_pending', workName: 'SESSION_LOG 차단사용자 접속이력 세미조인 변환', instanceName: 'PROD-DB2', schemaName: 'AUDIT', selectionSource: 'manual', originalElapsed: 22600, originalBuffers: 2380000, tunedElapsed: 3390, tunedBuffers: 238000, improvementRate: 85.0, recommendationType: 'rewrite', recommendationTypes: ['rewrite'], batchId: 'BATCH-2026-B02', batchMemo: '3/18 새벽 · PROD-DB2 · 야간배치 · 4건', verifiedBy: '김민수', verifiedAt: '2026-03-20T10:00:00Z', createdAt: '2026-03-18T02:00:00Z', updatedAt: '2026-03-20T10:00:00Z' },
  { id: 'WI-2026-AP06', sqlId: 'ap06_contract', sqlText: 'SELECT c.contract_id, c.customer_id, c.product_id, c.expire_date, ROUND(c.expire_date - SYSDATE) days_left FROM CONTRACTS c WHERE c.expire_date BETWEEN SYSDATE AND SYSDATE + 90 AND c.status = \'ACTIVE\'', status: 'apply_pending', workName: 'CONTRACT 만기예정 조회 힌트 최적화', instanceName: 'PROD-DB2', schemaName: 'CRM', selectionSource: 'auto', originalElapsed: 7400, originalBuffers: 780000, tunedElapsed: 1480, tunedBuffers: 78000, improvementRate: 80.0, recommendationType: 'hint', recommendationTypes: ['hint', 'index'], batchId: 'BATCH-2026-B02', batchMemo: '3/18 새벽 · PROD-DB2 · 야간배치 · 4건', verifiedBy: '이영희', verifiedAt: '2026-03-21T09:00:00Z', createdAt: '2026-03-18T02:00:00Z', updatedAt: '2026-03-21T09:00:00Z' },

  // BATCH-2026-B03: 3/25 새벽 · PROD-DB1·DB2 · 3건
  { id: 'WI-2026-AP07', sqlId: 'ap07_sales_dtl', sqlText: 'SELECT sd.sale_date, sd.channel, SUM(sd.quantity) qty, SUM(sd.amount) amt, SUM(sd.discount) disc FROM SALES_DETAIL sd WHERE sd.sale_date >= TRUNC(SYSDATE,\'MM\') GROUP BY sd.sale_date, sd.channel ORDER BY sd.sale_date, sd.channel', status: 'apply_pending', workName: 'SALES_DETAIL 일별채널 매출 집계 최적화', instanceName: 'PROD-DB1', schemaName: 'OMS', selectionSource: 'auto', originalElapsed: 41000, originalBuffers: 4300000, tunedElapsed: 6150, tunedBuffers: 430000, improvementRate: 85.0, recommendationType: 'index', recommendationTypes: ['index', 'hint'], batchId: 'BATCH-2026-B03', batchMemo: '3/25 새벽 · PROD-DB1·DB2 · 야간배치 · 3건', verifiedBy: '박준호', verifiedAt: '2026-03-27T10:00:00Z', createdAt: '2026-03-25T02:00:00Z', updatedAt: '2026-03-27T10:00:00Z' },
  { id: 'WI-2026-AP08', sqlId: 'ap08_alarm_pend', sqlText: 'SELECT a.alarm_id, a.alarm_type, a.severity, a.created_at, a.target_id FROM ALARM_HISTORY a WHERE a.status = \'PENDING\' AND a.severity IN (\'HIGH\',\'CRITICAL\') AND a.created_at >= SYSDATE - 3', status: 'apply_pending', workName: 'ALARM_HISTORY 미처리 고위험 알림 인덱스', instanceName: 'PROD-DB2', schemaName: 'MONITOR', selectionSource: 'auto', originalElapsed: 5200, originalBuffers: 545000, tunedElapsed: 780, tunedBuffers: 54500, improvementRate: 85.0, recommendationType: 'index', recommendationTypes: ['index'], batchId: 'BATCH-2026-B03', batchMemo: '3/25 새벽 · PROD-DB1·DB2 · 야간배치 · 3건', verifiedBy: '정수진', verifiedAt: '2026-03-27T11:00:00Z', createdAt: '2026-03-25T02:00:00Z', updatedAt: '2026-03-27T11:00:00Z' },

  // BATCH-2026-B04: 4/1 새벽 · PROD-DB1 · 3건
  { id: 'WI-2026-AP09', sqlId: 'ap09_usr_prof', sqlText: 'SELECT u.user_id, u.name, u.email, u.dept, r.role_name FROM USERS u JOIN USER_ROLES ur ON u.user_id = ur.user_id JOIN ROLES r ON ur.role_id = r.role_id WHERE u.is_active = 1 AND u.last_login >= SYSDATE - 90', status: 'apply_pending', workName: 'USER_PROFILE 활성사용자 권한 조회 최적화', instanceName: 'PROD-DB1', schemaName: 'AUTH', selectionSource: 'auto', originalElapsed: 8600, originalBuffers: 902000, tunedElapsed: 1290, tunedBuffers: 90200, improvementRate: 85.0, recommendationType: 'index', recommendationTypes: ['index', 'hint'], batchId: 'BATCH-2026-B04', batchMemo: '4/1 새벽 · PROD-DB1 · 야간배치 · 3건', verifiedBy: '김민수', verifiedAt: '2026-04-03T09:00:00Z', createdAt: '2026-04-01T02:00:00Z', updatedAt: '2026-04-03T09:00:00Z' },
  { id: 'WI-2026-AP10', sqlId: 'ap10_dlv_track', sqlText: 'SELECT t.track_id, t.order_id, t.carrier, t.current_location, t.updated_at FROM DELIVERY_TRACKING t WHERE t.status != \'DELIVERED\' AND t.updated_at < SYSDATE - 1 ORDER BY t.updated_at', status: 'apply_pending', workName: 'DELIVERY_TRACK 지연 배송 추적 힌트 추가', instanceName: 'PROD-DB1', schemaName: 'OMS', selectionSource: 'auto', originalElapsed: 13200, originalBuffers: 1380000, tunedElapsed: 2640, tunedBuffers: 138000, improvementRate: 80.0, recommendationType: 'hint', recommendationTypes: ['hint'], batchId: 'BATCH-2026-B04', batchMemo: '4/1 새벽 · PROD-DB1 · 야간배치 · 3건', verifiedBy: '이영희', verifiedAt: '2026-04-03T10:00:00Z', createdAt: '2026-04-01T02:00:00Z', updatedAt: '2026-04-03T10:00:00Z' },
  { id: 'WI-2026-AP11', sqlId: 'ap11_risk_score', sqlText: 'SELECT c.customer_id, c.customer_name, r.risk_score, r.risk_level, r.assessed_at FROM CUSTOMERS c JOIN RISK_ASSESSMENT r ON c.customer_id = r.customer_id WHERE r.risk_level IN (\'HIGH\',\'VERY_HIGH\') AND r.assessed_at >= ADD_MONTHS(SYSDATE,-1)', status: 'apply_pending', workName: 'RISK_SCORE 고위험 고객 평가 리라이트', instanceName: 'PROD-DB1', schemaName: 'CRM', selectionSource: 'manual', originalElapsed: 29800, originalBuffers: 3120000, tunedElapsed: 3576, tunedBuffers: 312000, improvementRate: 88.0, recommendationType: 'rewrite', recommendationTypes: ['rewrite', 'index'], batchId: 'BATCH-2026-B04', batchMemo: '4/1 새벽 · PROD-DB1 · 야간배치 · 3건', verifiedBy: '박준호', verifiedAt: '2026-04-03T11:00:00Z', createdAt: '2026-04-01T02:00:00Z', updatedAt: '2026-04-03T11:00:00Z' },

  // BATCH-2026-B05: 4/7 새벽 · PROD-DB2 · 2건
  { id: 'WI-2026-AP12', sqlId: 'ap12_notice', sqlText: 'SELECT n.notice_id, n.title, n.category, n.posted_at, n.view_count FROM NOTICES n WHERE n.is_published = 1 AND n.posted_at >= SYSDATE - 30 ORDER BY n.posted_at DESC', status: 'apply_pending', workName: 'NOTICE 공지사항 목록 인덱스 최적화', instanceName: 'PROD-DB2', schemaName: 'PORTAL', selectionSource: 'auto', originalElapsed: 4800, originalBuffers: 504000, tunedElapsed: 720, tunedBuffers: 50400, improvementRate: 85.0, recommendationType: 'index', recommendationTypes: ['index'], batchId: 'BATCH-2026-B05', batchMemo: '4/7 새벽 · PROD-DB2 · 야간배치 · 2건', verifiedBy: '정수진', verifiedAt: '2026-04-09T09:00:00Z', createdAt: '2026-04-07T02:00:00Z', updatedAt: '2026-04-09T09:00:00Z' },

  // ── 운영효과 탭 체험용 — applied + operationalElapsed 없음 (State A: After SQL 탐색 흐름) ──
  { id: 'WI-2026-OPS01', sqlId: 'ops01_ord_stat', sqlText: 'SELECT o.order_id, o.status, o.total_amount, c.customer_name FROM ORDERS o JOIN CUSTOMERS c ON o.customer_id = c.customer_id WHERE o.status = \'PROCESSING\' AND o.created_at >= SYSDATE - 7', status: 'applied', workName: 'ORDERS 처리중 주문 현황 힌트 추가', instanceName: 'PROD-DB1', schemaName: 'OMS', selectionSource: 'auto', originalElapsed: 15200, originalBuffers: 1600000, tunedElapsed: 2280, tunedBuffers: 160000, improvementRate: 85.0, recommendationType: 'hint', recommendationTypes: ['hint'], batchId: 'BATCH-2026-B04', batchMemo: '4/1 새벽 · PROD-DB1 · 야간배치 · 3건', verifiedBy: '김민수', verifiedAt: '2026-04-03T14:00:00Z', appliedAt: '2026-04-05T10:00:00Z', createdAt: '2026-04-01T02:00:00Z', updatedAt: '2026-04-05T10:00:00Z' },
  { id: 'WI-2026-OPS02', sqlId: 'ops02_pay_mon', sqlText: 'SELECT p.pay_id, p.amount, p.pay_method, p.pay_date, u.username FROM PAYMENTS p JOIN USERS u ON p.user_id = u.user_id WHERE p.pay_date >= TRUNC(SYSDATE,\'MM\') AND p.status = \'SUCCESS\' ORDER BY p.amount DESC', status: 'applied', workName: 'PAYMENTS 월별 성공 결제 리라이트', instanceName: 'PROD-DB2', schemaName: 'FIN', selectionSource: 'auto', originalElapsed: 28400, originalBuffers: 2980000, tunedElapsed: 3408, tunedBuffers: 298000, improvementRate: 88.0, recommendationType: 'rewrite', recommendationTypes: ['rewrite', 'index'], batchId: 'BATCH-2026-B05', batchMemo: '4/7 새벽 · PROD-DB2 · 야간배치 · 2건', verifiedBy: '이영희', verifiedAt: '2026-04-09T10:00:00Z', appliedAt: '2026-04-10T09:00:00Z', createdAt: '2026-04-07T02:00:00Z', updatedAt: '2026-04-10T09:00:00Z' },
  { id: 'WI-2026-OPS03', sqlId: 'ops03_emp_att', sqlText: 'SELECT e.emp_id, e.emp_name, a.work_date, a.check_in, a.check_out, a.work_hours FROM EMPLOYEES e JOIN ATTENDANCE a ON e.emp_id = a.emp_id WHERE a.work_date >= TRUNC(SYSDATE,\'MM\') AND a.dept_id = :deptId ORDER BY a.work_date, e.emp_name', status: 'applied', workName: 'ATTENDANCE 부서별 월간 근태 조회 인덱스', instanceName: 'PROD-DB1', schemaName: 'HR', selectionSource: 'auto', originalElapsed: 11600, originalBuffers: 1220000, tunedElapsed: 1740, tunedBuffers: 122000, improvementRate: 85.0, recommendationType: 'index', recommendationTypes: ['index'], batchId: 'BATCH-2026-B03', batchMemo: '3/25 새벽 · PROD-DB1·DB2 · 야간배치 · 3건', verifiedBy: '박준호', verifiedAt: '2026-03-28T09:00:00Z', appliedAt: '2026-03-30T10:00:00Z', createdAt: '2026-03-25T02:00:00Z', updatedAt: '2026-03-30T10:00:00Z' },
  { id: 'WI-2026-OPS04', sqlId: 'ops04_prod_view', sqlText: 'SELECT p.product_id, p.product_name, p.category, COUNT(v.view_id) view_cnt, COUNT(DISTINCT v.user_id) unique_users FROM PRODUCTS p LEFT JOIN PRODUCT_VIEWS v ON p.product_id = v.product_id WHERE v.viewed_at >= SYSDATE - 7 GROUP BY p.product_id, p.product_name, p.category ORDER BY view_cnt DESC', status: 'applied', workName: 'PRODUCT_VIEWS 주간 인기상품 집계 힌트', instanceName: 'PROD-DB1', schemaName: 'OMS', selectionSource: 'auto', originalElapsed: 22800, originalBuffers: 2390000, tunedElapsed: 4560, tunedBuffers: 239000, improvementRate: 80.0, recommendationType: 'hint', recommendationTypes: ['hint', 'index'], batchId: 'BATCH-2026-B02', batchMemo: '3/18 새벽 · PROD-DB2 · 야간배치 · 4건', verifiedBy: '정수진', verifiedAt: '2026-03-22T10:00:00Z', appliedAt: '2026-03-24T09:00:00Z', createdAt: '2026-03-18T02:00:00Z', updatedAt: '2026-03-24T09:00:00Z' },
  { id: 'WI-2026-OPS05', sqlId: 'ops05_claim_hist', sqlText: 'SELECT cl.claim_id, cl.claim_date, cl.claim_type, cl.status, cl.amount, c.customer_name FROM CLAIMS cl JOIN CUSTOMERS c ON cl.customer_id = c.customer_id WHERE cl.claim_date >= ADD_MONTHS(SYSDATE,-3) AND cl.status IN (\'OPEN\',\'IN_PROGRESS\')', status: 'applied', workName: 'CLAIMS 미결처리 청구 이력 리라이트', instanceName: 'PROD-DB2', schemaName: 'FIN', selectionSource: 'manual', originalElapsed: 33600, originalBuffers: 3520000, tunedElapsed: 4032, tunedBuffers: 352000, improvementRate: 88.0, recommendationType: 'rewrite', recommendationTypes: ['rewrite'], batchId: 'BATCH-2026-B02', batchMemo: '3/18 새벽 · PROD-DB2 · 야간배치 · 4건', verifiedBy: '김민수', verifiedAt: '2026-03-22T11:00:00Z', appliedAt: '2026-03-25T08:00:00Z', createdAt: '2026-03-18T02:00:00Z', updatedAt: '2026-03-25T08:00:00Z' },
  { id: 'WI-2026-OPS06', sqlId: 'ops06_sched_job', sqlText: 'SELECT j.job_id, j.job_name, j.schedule, j.last_run, j.next_run, j.status FROM SCHEDULE_JOBS j WHERE j.is_active = 1 AND j.next_run <= SYSDATE + 1 ORDER BY j.next_run', status: 'applied', workName: 'SCHEDULE_JOBS 예정 배치 조회 인덱스', instanceName: 'PROD-DB1', schemaName: 'BATCH', selectionSource: 'auto', originalElapsed: 6400, originalBuffers: 672000, tunedElapsed: 960, tunedBuffers: 67200, improvementRate: 85.0, recommendationType: 'index', recommendationTypes: ['index'], batchId: 'BATCH-2026-B01', batchMemo: '3/12 새벽 · PROD-DB1 · 야간배치 · 5건', verifiedBy: '이영희', verifiedAt: '2026-03-15T10:00:00Z', appliedAt: '2026-03-17T09:00:00Z', createdAt: '2026-03-12T02:00:00Z', updatedAt: '2026-03-17T09:00:00Z' },
  { id: 'WI-2026-OPS07', sqlId: 'ops07_voc_open', sqlText: 'SELECT v.voc_id, v.title, v.category, v.priority, v.created_at, v.assigned_to FROM VOC v WHERE v.status = \'OPEN\' AND v.created_at >= SYSDATE - 14 AND v.priority IN (\'HIGH\',\'URGENT\') ORDER BY v.priority DESC, v.created_at', status: 'applied', workName: 'VOC 미처리 고우선순위 조회 힌트', instanceName: 'PROD-DB2', schemaName: 'CRM', selectionSource: 'auto', originalElapsed: 9800, originalBuffers: 1030000, tunedElapsed: 1470, tunedBuffers: 103000, improvementRate: 85.0, recommendationType: 'hint', recommendationTypes: ['hint'], batchId: 'BATCH-2026-B03', batchMemo: '3/25 새벽 · PROD-DB1·DB2 · 야간배치 · 3건', verifiedBy: '박준호', verifiedAt: '2026-03-28T14:00:00Z', appliedAt: '2026-03-31T09:00:00Z', createdAt: '2026-03-25T02:00:00Z', updatedAt: '2026-03-31T09:00:00Z' },
  { id: 'WI-2026-OPS08', sqlId: 'ops08_stock_mv', sqlText: 'SELECT s.item_id, s.warehouse_id, s.move_date, s.quantity, s.move_type FROM STOCK_MOVEMENTS s WHERE s.move_date >= TRUNC(SYSDATE,\'MM\') AND s.warehouse_id = :wid ORDER BY s.move_date DESC', status: 'applied', workName: 'STOCK_MOVEMENTS 월별 재고이동 리라이트', instanceName: 'PROD-DB1', schemaName: 'OMS', selectionSource: 'auto', originalElapsed: 18200, originalBuffers: 1910000, tunedElapsed: 3640, tunedBuffers: 191000, improvementRate: 80.0, recommendationType: 'rewrite', recommendationTypes: ['rewrite', 'hint'], batchId: 'BATCH-2026-B04', batchMemo: '4/1 새벽 · PROD-DB1 · 야간배치 · 3건', verifiedBy: '정수진', verifiedAt: '2026-04-04T09:00:00Z', appliedAt: '2026-04-06T10:00:00Z', createdAt: '2026-04-01T02:00:00Z', updatedAt: '2026-04-06T10:00:00Z' },
  { id: 'WI-2026-OPS09', sqlId: 'ops09_login_fail', sqlText: 'SELECT l.user_id, l.ip_addr, COUNT(*) fail_cnt, MAX(l.attempt_time) last_attempt FROM LOGIN_ATTEMPTS l WHERE l.result = \'FAIL\' AND l.attempt_time >= SYSDATE - 1 GROUP BY l.user_id, l.ip_addr HAVING COUNT(*) >= 5 ORDER BY fail_cnt DESC', status: 'applied', workName: 'LOGIN_ATTEMPTS 연속실패 탐지 인덱스', instanceName: 'PROD-DB2', schemaName: 'AUTH', selectionSource: 'auto', originalElapsed: 7600, originalBuffers: 798000, tunedElapsed: 1140, tunedBuffers: 79800, improvementRate: 85.0, recommendationType: 'index', recommendationTypes: ['index'], batchId: 'BATCH-2026-B05', batchMemo: '4/7 새벽 · PROD-DB2 · 야간배치 · 2건', verifiedBy: '김민수', verifiedAt: '2026-04-09T14:00:00Z', appliedAt: '2026-04-10T08:00:00Z', createdAt: '2026-04-07T02:00:00Z', updatedAt: '2026-04-10T08:00:00Z' },
  { id: 'WI-2026-OPS10', sqlId: 'ops10_kpi_dash', sqlText: 'SELECT k.kpi_id, k.kpi_name, k.target_value, k.actual_value, k.achievement_rate, k.measured_at FROM KPI_METRICS k WHERE k.dept_id = :dept AND k.period = TO_CHAR(ADD_MONTHS(SYSDATE,-1),\'YYYYMM\') ORDER BY k.achievement_rate', status: 'applied', workName: 'KPI_METRICS 부서별 전월실적 조회 힌트', instanceName: 'PROD-DB1', schemaName: 'MGMT', selectionSource: 'manual', originalElapsed: 12400, originalBuffers: 1300000, tunedElapsed: 2480, tunedBuffers: 130000, improvementRate: 80.0, recommendationType: 'hint', recommendationTypes: ['hint', 'index'], batchId: 'BATCH-2026-B02', batchMemo: '3/18 새벽 · PROD-DB2 · 야간배치 · 4건', verifiedBy: '이영희', verifiedAt: '2026-03-23T10:00:00Z', appliedAt: '2026-03-26T09:00:00Z', createdAt: '2026-03-18T02:00:00Z', updatedAt: '2026-03-26T09:00:00Z' },
  { id: 'WI-2026-OPS11', sqlId: 'ops11_audit_log', sqlText: 'SELECT a.log_id, a.user_id, a.action_type, a.target_table, a.action_time, a.ip_addr FROM AUDIT_LOGS a WHERE a.action_time >= SYSDATE - 7 AND a.action_type IN (\'DELETE\',\'UPDATE\') ORDER BY a.action_time DESC', status: 'applied', workName: 'AUDIT_LOGS 변경이력 보안조회 인덱스', instanceName: 'PROD-DB2', schemaName: 'AUDIT', selectionSource: 'auto', originalElapsed: 16800, originalBuffers: 1760000, tunedElapsed: 2520, tunedBuffers: 176000, improvementRate: 85.0, recommendationType: 'index', recommendationTypes: ['index'], batchId: 'BATCH-2026-B01', batchMemo: '3/12 새벽 · PROD-DB1 · 야간배치 · 5건', verifiedBy: '박준호', verifiedAt: '2026-03-16T11:00:00Z', appliedAt: '2026-03-18T09:00:00Z', createdAt: '2026-03-12T02:00:00Z', updatedAt: '2026-03-18T09:00:00Z' },
  { id: 'WI-2026-OPS12', sqlId: 'ops12_fee_calc', sqlText: 'SELECT t.txn_id, t.amount, t.fee_type, ROUND(t.amount * f.rate / 100, 2) fee_amount FROM TRANSACTIONS t JOIN FEE_RULES f ON t.fee_type = f.fee_type AND t.txn_date BETWEEN f.effective_from AND NVL(f.effective_to, SYSDATE) WHERE t.txn_date >= TRUNC(SYSDATE,\'MM\')', status: 'applied', workName: 'FEE_RULES 수수료 계산 조인 리라이트', instanceName: 'PROD-DB1', schemaName: 'FIN', selectionSource: 'auto', originalElapsed: 25600, originalBuffers: 2680000, tunedElapsed: 3840, tunedBuffers: 268000, improvementRate: 85.0, recommendationType: 'rewrite', recommendationTypes: ['rewrite'], batchId: 'BATCH-2026-B04', batchMemo: '4/1 새벽 · PROD-DB1 · 야간배치 · 3건', verifiedBy: '정수진', verifiedAt: '2026-04-04T14:00:00Z', appliedAt: '2026-04-07T09:00:00Z', createdAt: '2026-04-01T02:00:00Z', updatedAt: '2026-04-07T09:00:00Z' },
]

// 모든 아이템 합치고, pending/tuning에 originalPlanText 없으면 자동 생성
const rawItems: WorkItem[] = [
  ...coreItems,
  ...autoSeeds.map((s, i) => seedToItem(s, i)),
  ...manualSeeds.map((s, i) => seedToItem(s, i + autoSeeds.length)),
  ...extraAutoSeeds.map((s, i) => seedToItem(s, i + autoSeeds.length + manualSeeds.length)),
  ...directVerifySeeds.map((s, i) => seedToItem(s, i + autoSeeds.length + manualSeeds.length + extraAutoSeeds.length)),
  ...recentJobSeeds.map((s, i) => seedToItem(s, i + autoSeeds.length + manualSeeds.length + extraAutoSeeds.length + directVerifySeeds.length)),
  ...terminalSeeds.map((s, i) => seedToItem(s, i + autoSeeds.length + manualSeeds.length + extraAutoSeeds.length + directVerifySeeds.length + recentJobSeeds.length)),
  ...recentApplyPendingSeeds.map((s, i) => seedToItem(s, i)),
]

export const workItems: WorkItem[] = [] /* rawItems.map((item, idx) => {
  const patched = { ...item }
  if (['pending', 'tuning'].includes(patched.status) && !patched.originalPlanText) {
    patched.originalPlanText = generatePlanText(patched)
  }
  if (['pending', 'tuning'].includes(patched.status) && !patched.planSource) {
    // mock: 짝수 idx → memory(SGA에 존재), 홀수 → explain(flush됨)
    patched.planSource = idx % 2 === 0 ? 'memory' : 'explain'
  }
  return patched
}) */
