import type { ComponentType } from 'react'
import { Clock, BotMessageSquare, User, CheckCircle2, AlertCircle, Minus, CalendarClock } from 'lucide-react'

export type V2Status =
  | 'scheduled'
  | 'pending'
  | 'tuning'
  | 'approval_pending'
  | 'apply_pending'
  | 'applied'
  | 'rejected'
  | 'failed'
  | 'cancelled'
  | 'no_improve'

/** Owner axis — 이 작업의 현재 '공' 소유자. 상태값과 독립된 축 */
export type V2Owner = 'scheduled' | 'ai' | 'human' | 'done' | 'error' | 'none'

export interface V2WorkItem {
  id: string
  sqlId: string
  sqlText: string
  status: V2Status
  type: 'tuning' | 'verification'
  createdAt: string
  updatedAt: string
  assignee: string
  instanceName: string
  schemaName: string
  workName: string
  alias?: string // 사용자 정의 SQL 별칭
  selectionSource: 'auto' | 'manual'
  originalElapsed: number
  originalBuffers: number
  tunedElapsed?: number
  tunedBuffers?: number
  improvementRate?: number
  recommendationType?: 'rewrite' | 'hint' | 'index' | 'plan_restore'
  source: 'maxgauge' | 'awr' | 'v$sql'
  executionContext?: 'OLTP' | 'Batch'
  estimatedDailyExec?: number
  // tuning
  analysisStep?: 'structure' | 'plan_collection' | 'comparison' | 'recommendation'
  analysisEstimatedRemaining?: number
  // apply_pending (승인 완료)
  approvedBy?: string
  approvedAt?: string
  // apply_pending (검토 완료)
  verifiedBy?: string
  verifiedAt?: string
  // applied
  appliedBy?: string
  appliedAt?: string
  operationalResult?: 'improved' | 'degraded' | 'monitoring'
  operationalElapsed?: number
  operationalBuffers?: number
  operationalMeasuredAt?: string
  // rejected (반려)
  rejectedBy?: string
  rejectedAt?: string
  rejectedReason?: string
  retuneConditions?: string[]
  // failed (AI 분석 실패 / 적용 실패)
  tuningError?: string
  applyError?: string
  // scheduled (예약·반복)
  scheduleKind?: 'once' | 'recurring'
  scheduleCron?: string        // recurring일 때
  scheduleRunAt?: string       // once일 때
  // batch/request grouping
  batchId: string
  batchMemo?: string
  // bind
  executionContextType?: 'OLTP' | 'Batch'
  // 쿼리 실행 타임아웃 (초). 값이 있으면 요청별 오버라이드.
  queryTimeoutSec?: number
}

/**
 * 상태값 라벨 — 2026-04-09 용어 정비
 *
 * 핵심 원칙
 * - **튜닝완료** (approval_pending): AI가 튜닝을 완료해서 사람이 확인해야 하는 상태.
 *   과거 "승인대기"·"검토대기" 모두 이 라벨로 통일.
 * - **반영대기** (apply_pending): 사람이 확인(승인)을 마치고 운영 반영만 남은 상태.
 * - **반영완료** (applied): 운영 환경에 반영된 종결 상태.
 *
 * 상태 전이 동사
 * - 사람 → '확인' (approval_pending → apply_pending)
 * - 시스템/사람 → '반영' (apply_pending → applied)
 */
export const v2StatusLabels: Record<V2Status, string> = {
  scheduled: '예약중',
  pending: '튜닝대기',
  tuning: '튜닝중',
  approval_pending: '튜닝완료',
  apply_pending: '반영대기',
  applied: '반영완료',
  rejected: '반려',
  failed: '실패',
  cancelled: '취소',
  no_improve: '개선없음',
}

export const v2StatusColors: Record<V2Status, string> = {
  scheduled: 'bg-slate-100 text-slate-600',
  pending: 'bg-slate-100 text-slate-600',
  // 2026-04-09: tuning은 진행중 → cool blue. approval_pending은 AI 성공 마일스톤 → green.
  tuning: 'bg-blue-50 text-blue-700',
  approval_pending: 'bg-emerald-50 text-emerald-700',
  apply_pending: 'bg-sky-100 text-sky-700',
  applied: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-red-100 text-red-700',
  no_improve: 'bg-slate-100 text-slate-500',
}

/** 상태 → Owner(공의 소유자) 매핑 */
export const v2StatusOwner: Record<V2Status, V2Owner> = {
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

/** 상태 → lucide 아이콘 컴포넌트. Owner 축 시각화 전용 */
export const v2StatusIcon: Record<V2Status, ComponentType<{ className?: string; size?: number }>> = {
  scheduled: CalendarClock,
  pending: Clock,
  tuning: BotMessageSquare,
  approval_pending: BotMessageSquare, // 2026-04-09 재정의: AI 작품
  apply_pending: User,
  applied: CheckCircle2,
  rejected: AlertCircle,
  failed: AlertCircle,
  cancelled: AlertCircle,
  no_improve: Minus,
}

export const v2WorkItems: V2WorkItem[] = [
  // pending: 3건
  {
    id: 'V2-001', sqlId: 'a1b2c3d4e5f6g', status: 'pending', type: 'tuning',
    sqlText: 'SELECT /*+ FULL(o) */ o.order_id, o.order_date, c.customer_name, SUM(oi.quantity * oi.unit_price) total FROM ORDERS o, CUSTOMERS c, ORDER_ITEMS oi WHERE o.cust_id = c.customer_id AND o.order_id = oi.order_id GROUP BY o.order_id, o.order_date, c.customer_name',
    workName: 'ORDER_HIST 조인 최적화', instanceName: 'PROD-DB1', schemaName: 'OMS',
    alias: '주문 이력 조인 최적화',
    selectionSource: 'auto', originalElapsed: 48200, originalBuffers: 4870000,
    source: 'maxgauge', executionContext: 'Batch', estimatedDailyExec: 1240,
    batchId: 'BATCH-0402-AUTO', batchMemo: '4/2 야간 자동튜닝',
    createdAt: '2026-04-02T08:00:00Z', updatedAt: '2026-04-02T08:00:00Z', assignee: '김민수',
  },
  {
    id: 'V2-002', sqlId: 'zz1yy2xx3ww4', status: 'pending', type: 'tuning',
    sqlText: 'SELECT e.employee_id, e.first_name, e.last_name, d.department_name, NVL(e.commission_pct, 0) comm FROM EMP e JOIN DEPT d ON e.department_id = d.department_id WHERE e.hire_date > SYSDATE - 365',
    workName: 'EMP-DEPT 신입사원 조회 최적화', instanceName: 'PROD-DB2', schemaName: 'HR',
    selectionSource: 'manual', originalElapsed: 12500, originalBuffers: 1300000,
    source: 'awr', executionContext: 'OLTP', estimatedDailyExec: 8500,
    batchId: 'REQ-0402-01', batchMemo: 'HR/AUDIT 수동 튜닝 요청',
    createdAt: '2026-04-02T09:30:00Z', updatedAt: '2026-04-02T09:30:00Z', assignee: '이영희',
  },
  {
    id: 'V2-003', sqlId: 'vv5uu6tt7ss8', status: 'pending', type: 'verification',
    sqlText: 'INSERT INTO AUDIT_LOG (log_id, table_name, operation, old_value, new_value, changed_by, changed_at) SELECT seq_audit.NEXTVAL, :tbl, :op, :old, :new, USER, SYSDATE FROM DUAL',
    workName: 'AUDIT_LOG INSERT 검증', instanceName: 'PROD-DB1', schemaName: 'AUDIT',
    selectionSource: 'manual', originalElapsed: 450, originalBuffers: 3200,
    source: 'awr', executionContext: 'OLTP', estimatedDailyExec: 45000,
    batchId: 'REQ-0402-01', batchMemo: 'HR/AUDIT 수동 튜닝 요청',
    createdAt: '2026-04-02T10:00:00Z', updatedAt: '2026-04-02T10:00:00Z', assignee: '박준호',
  },

  // tuning: 2건
  {
    id: 'V2-004', sqlId: 'rr9qq0pp1oo2', status: 'tuning', type: 'tuning',
    sqlText: 'SELECT d.department_name, COUNT(e.employee_id) emp_cnt, AVG(e.salary) avg_sal, MAX(e.salary) max_sal FROM DEPT d, EMP e WHERE d.department_id = e.department_id GROUP BY d.department_name ORDER BY avg_sal DESC',
    workName: '부서별 급여 집계 최적화', instanceName: 'PROD-DB1', schemaName: 'HR',
    alias: '부서별 급여 집계',
    selectionSource: 'auto', originalElapsed: 5400, originalBuffers: 480000,
    source: 'v$sql', executionContext: 'OLTP', estimatedDailyExec: 2400,
    analysisStep: 'comparison', analysisEstimatedRemaining: 45,
    batchId: 'BATCH-0402-AUTO', batchMemo: '4/2 야간 자동튜닝',
    createdAt: '2026-04-02T07:00:00Z', updatedAt: '2026-04-02T11:00:00Z', assignee: '정수진',
  },
  {
    id: 'V2-005', sqlId: 'nn3mm4ll5kk6', status: 'tuning', type: 'tuning',
    sqlText: 'SELECT c.customer_name, o.order_id, o.order_date FROM CUSTOMERS c INNER JOIN ORDERS o ON c.customer_id = o.customer_id WHERE o.order_date BETWEEN :start_dt AND :end_dt ORDER BY o.order_date DESC',
    workName: '고객-주문 기간조회 최적화', instanceName: 'DEV-DB1', schemaName: 'CRM',
    alias: '고객 주문 기간 조회',
    selectionSource: 'manual', originalElapsed: 2100, originalBuffers: 125000,
    source: 'maxgauge', executionContext: 'OLTP', estimatedDailyExec: 15000,
    analysisStep: 'structure', analysisEstimatedRemaining: 120,
    batchId: 'REQ-0402-02', batchMemo: 'CRM 기간조회 긴급 튜닝',
    createdAt: '2026-04-02T09:00:00Z', updatedAt: '2026-04-02T11:30:00Z', assignee: '최동욱',
  },

  // approval_pending: 4건
  {
    id: 'V2-006', sqlId: 't9u0v1w2x3y4z', status: 'approval_pending', type: 'tuning',
    sqlText: 'SELECT * FROM (SELECT p.product_id, p.product_name, SUM(oi.quantity) total_qty, RANK() OVER (ORDER BY SUM(oi.quantity) DESC) rnk FROM PRODUCTS p JOIN ORDER_ITEMS oi ON p.product_id = oi.product_id GROUP BY p.product_id, p.product_name) WHERE rnk <= 50',
    workName: '상품별 판매량 RANK 최적화', instanceName: 'PROD-DB1', schemaName: 'OMS',
    alias: '상품 판매량 랭킹 조회',
    selectionSource: 'auto', originalElapsed: 27800, originalBuffers: 2900000,
    tunedElapsed: 5500, tunedBuffers: 350000, improvementRate: 80.2,
    recommendationType: 'rewrite', source: 'maxgauge', executionContext: 'Batch', estimatedDailyExec: 48,
    batchId: 'BATCH-0401-AUTO', batchMemo: '4/1 야간 자동튜닝',
    createdAt: '2026-04-01T22:00:00Z', updatedAt: '2026-04-02T06:00:00Z', assignee: '정수진',
  },
  {
    id: 'V2-007', sqlId: 'b5c6d7e8f9g0h', status: 'approval_pending', type: 'tuning',
    sqlText: 'SELECT customer_id, customer_name, (SELECT COUNT(*) FROM ORDERS o WHERE o.customer_id = c.customer_id AND o.order_date > SYSDATE - 90) recent_orders FROM CUSTOMERS c',
    workName: '고객별 최근주문 Scalar Subquery 제거', instanceName: 'PROD-DB2', schemaName: 'CRM',
    alias: '고객 최근주문 서브쿼리 제거',
    selectionSource: 'manual', originalElapsed: 19500, originalBuffers: 1850000,
    tunedElapsed: 2900, tunedBuffers: 185000, improvementRate: 85.1,
    recommendationType: 'rewrite', source: 'awr', executionContext: 'OLTP', estimatedDailyExec: 3200,
    batchId: 'REQ-0401-01', batchMemo: 'CRM Scalar Subquery 개선 요청',
    createdAt: '2026-04-01T22:00:00Z', updatedAt: '2026-04-02T06:00:00Z', assignee: '최동욱',
  },
  {
    id: 'V2-008', sqlId: 'i1j2k3l4m5n6o', status: 'approval_pending', type: 'tuning',
    sqlText: "SELECT emp_id, manager_id, LEVEL, SYS_CONNECT_BY_PATH(last_name, '/') path FROM EMP START WITH manager_id IS NULL CONNECT BY PRIOR employee_id = manager_id ORDER SIBLINGS BY last_name",
    workName: 'EMP 계층쿼리 CONNECT BY 최적화', instanceName: 'DEV-DB1', schemaName: 'HR',
    alias: '조직도 계층 쿼리 최적화',
    selectionSource: 'auto', originalElapsed: 15200, originalBuffers: 1620000,
    tunedElapsed: 3800, tunedBuffers: 405000, improvementRate: 75.0,
    recommendationType: 'hint', source: 'v$sql', executionContext: 'OLTP', estimatedDailyExec: 560,
    batchId: 'BATCH-0401-AUTO', batchMemo: '4/1 야간 자동튜닝',
    createdAt: '2026-04-01T22:00:00Z', updatedAt: '2026-04-02T06:00:00Z', assignee: '김민수',
  },
  {
    id: 'V2-009', sqlId: 'p7q8r9s0t1u2v', status: 'approval_pending', type: 'tuning',
    sqlText: 'SELECT a.account_no, a.balance, NVL(SUM(t.amount), 0) total_txn, COUNT(t.txn_id) txn_count FROM ACCOUNTS a LEFT JOIN TRANSACTIONS t ON a.account_id = t.account_id GROUP BY a.account_no, a.balance',
    workName: 'ACCOUNTS-TRANSACTIONS 집계 최적화', instanceName: 'PROD-DB1', schemaName: 'FIN',
    alias: '계좌-거래 집계 최적화',
    selectionSource: 'auto', originalElapsed: 12800, originalBuffers: 1340000,
    tunedElapsed: 2100, tunedBuffers: 168000, improvementRate: 83.6,
    recommendationType: 'index', source: 'maxgauge', executionContext: 'Batch', estimatedDailyExec: 96,
    batchId: 'BATCH-0401-AUTO', batchMemo: '4/1 야간 자동튜닝',
    createdAt: '2026-04-01T22:00:00Z', updatedAt: '2026-04-02T06:00:00Z', assignee: '이영희',
  },

  // approval_pending: 4건 (추가)
  {
    id: 'V2-010', sqlId: 'm3n4o5p6q7r8s', status: 'approval_pending', type: 'tuning',
    sqlText: "SELECT t.txn_id, t.txn_date, a.account_no, DECODE(t.txn_type, 'C', 'Credit', 'D', 'Debit', 'Unknown') txn_desc, t.amount FROM TRANSACTIONS t, ACCOUNTS a WHERE t.account_id = a.account_id",
    workName: 'TRANSACTIONS 조인 힌트 최적화', instanceName: 'PROD-DB2', schemaName: 'FIN',
    alias: '거래내역 힌트 최적화',
    selectionSource: 'auto', originalElapsed: 41500, originalBuffers: 4100000,
    tunedElapsed: 6200, tunedBuffers: 410000, improvementRate: 85.1,
    recommendationType: 'hint', source: 'v$sql', executionContext: 'OLTP', estimatedDailyExec: 12400,
    batchId: 'BATCH-0401-AUTO', batchMemo: '4/1 야간 자동튜닝',
    createdAt: '2026-04-01T22:00:00Z', updatedAt: '2026-04-02T09:00:00Z', assignee: '박준호',
  },
  {
    id: 'V2-011', sqlId: 'w3x4y5z6a7b8c', status: 'approval_pending', type: 'verification',
    sqlText: "UPDATE ORDERS SET status = 'SHIPPED', ship_date = SYSDATE WHERE order_id IN (SELECT order_id FROM ORDER_ITEMS oi WHERE oi.quantity > 0 GROUP BY order_id HAVING SUM(oi.quantity) > 10)",
    workName: 'ORDERS UPDATE 서브쿼리 Plan 복원', instanceName: 'PROD-DB2', schemaName: 'OMS',
    alias: '주문 업데이트 실행계획 복원',
    selectionSource: 'auto', originalElapsed: 8900, originalBuffers: 950000,
    tunedElapsed: 1200, tunedBuffers: 95000, improvementRate: 86.5,
    recommendationType: 'plan_restore', source: 'awr', executionContext: 'Batch', estimatedDailyExec: 12,
    batchId: 'BATCH-0401-AUTO', batchMemo: '4/1 야간 자동튜닝',
    createdAt: '2026-04-01T22:00:00Z', updatedAt: '2026-04-02T08:30:00Z', assignee: '박준호',
  },
  {
    id: 'V2-012', sqlId: 'aa1bb2cc3', status: 'approval_pending', type: 'tuning',
    sqlText: 'SELECT s.ship_id, s.ship_date, s.tracking_no FROM SHIPMENTS s WHERE s.order_id IN (SELECT order_id FROM ORDERS WHERE status = \'COMPLETED\')',
    workName: 'SHIPMENTS 배송조회 인덱스 최적화', instanceName: 'PROD-DB1', schemaName: 'OMS',
    selectionSource: 'auto', originalElapsed: 18200, originalBuffers: 1920000,
    tunedElapsed: 2700, tunedBuffers: 192000, improvementRate: 85.2,
    recommendationType: 'index', source: 'maxgauge', executionContext: 'OLTP', estimatedDailyExec: 3400,
    batchId: 'BATCH-0401-AUTO', batchMemo: '4/1 야간 자동튜닝',
    createdAt: '2026-04-01T22:00:00Z', updatedAt: '2026-04-02T09:15:00Z', assignee: '정수진',
  },
  {
    id: 'V2-013', sqlId: 'jj0kk1ll2', status: 'approval_pending', type: 'tuning',
    sqlText: 'SELECT pay_id, pay_date, pay_amount, pay_method FROM PAYMENTS WHERE customer_id = :cust_id AND pay_date BETWEEN :from AND :to ORDER BY pay_date DESC',
    workName: 'PAYMENTS 기간조회 인덱스 최적화', instanceName: 'PROD-DB1', schemaName: 'FIN',
    selectionSource: 'auto', originalElapsed: 14300, originalBuffers: 1490000,
    tunedElapsed: 2100, tunedBuffers: 149000, improvementRate: 85.3,
    recommendationType: 'index', source: 'awr', executionContext: 'OLTP', estimatedDailyExec: 8900,
    batchId: 'BATCH-0401-AUTO', batchMemo: '4/1 야간 자동튜닝',
    createdAt: '2026-04-01T22:00:00Z', updatedAt: '2026-04-02T09:30:00Z', assignee: '이영희',
  },

  // apply_pending: 2건
  {
    id: 'V2-014', sqlId: 'ii9jj0kk1ll2', status: 'apply_pending', type: 'tuning',
    sqlText: 'SELECT o.order_id, o.order_date, o.total_amount, c.customer_name, c.credit_limit FROM ORDERS o JOIN CUSTOMERS c ON o.customer_id = c.customer_id WHERE o.total_amount > 100000',
    workName: 'ORDERS 고액주문 조회 인덱스 최적화', instanceName: 'PROD-DB2', schemaName: 'OMS',
    selectionSource: 'auto', originalElapsed: 11200, originalBuffers: 1100000,
    tunedElapsed: 1800, tunedBuffers: 132000, improvementRate: 83.9,
    recommendationType: 'index', source: 'v$sql', executionContext: 'OLTP', estimatedDailyExec: 4800,
    verifiedBy: '최동욱', verifiedAt: '2026-04-02T10:00:00Z',
    batchId: 'BATCH-0401-AUTO', batchMemo: '4/1 야간 자동튜닝',
    createdAt: '2026-04-01T22:00:00Z', updatedAt: '2026-04-02T10:00:00Z', assignee: '최동욱',
  },
  {
    id: 'V2-015', sqlId: 'mm3nn4oo5pp6', status: 'apply_pending', type: 'tuning',
    sqlText: 'SELECT invoice_id, invoice_date, total_amount FROM INVOICES WHERE status = \'UNPAID\' AND due_date < SYSDATE ORDER BY due_date ASC',
    workName: 'INVOICES 미수금 조회 인덱스 최적화', instanceName: 'PROD-DB1', schemaName: 'FIN',
    selectionSource: 'auto', originalElapsed: 8900, originalBuffers: 930000,
    tunedElapsed: 1300, tunedBuffers: 93000, improvementRate: 85.4,
    recommendationType: 'index', source: 'maxgauge', executionContext: 'OLTP', estimatedDailyExec: 1200,
    verifiedBy: '김민수', verifiedAt: '2026-04-02T10:15:00Z',
    batchId: 'BATCH-0401-AUTO', batchMemo: '4/1 야간 자동튜닝',
    createdAt: '2026-04-01T22:00:00Z', updatedAt: '2026-04-02T10:15:00Z', assignee: '김민수',
  },

  // applied: 5건
  {
    id: 'V2-016', sqlId: 'f7g8h9i0j1k2l', status: 'applied', type: 'tuning',
    sqlText: 'SELECT e.employee_id, e.first_name, e.last_name, d.department_name, NVL(e.commission_pct, 0) comm FROM EMP e JOIN DEPT d ON e.department_id = d.department_id',
    workName: 'EMP-DEPT 조인 리라이트', instanceName: 'PROD-DB1', schemaName: 'HR',
    alias: '사원-부서 조인 리라이트',
    selectionSource: 'auto', originalElapsed: 32100, originalBuffers: 3200000,
    tunedElapsed: 4800, tunedBuffers: 320000, improvementRate: 85.0,
    recommendationType: 'rewrite', source: 'awr', executionContext: 'OLTP', estimatedDailyExec: 8500,
    verifiedBy: '이영희', verifiedAt: '2026-04-01T11:00:00Z',
    appliedBy: '이영희', appliedAt: '2026-04-01T16:00:00Z', operationalResult: 'improved',
    operationalElapsed: 4500, operationalBuffers: 300000, operationalMeasuredAt: '2026-04-02T08:00:00Z',
    batchId: 'BATCH-0331-AUTO', batchMemo: '3/31 야간 자동튜닝',
    createdAt: '2026-03-31T22:00:00Z', updatedAt: '2026-04-01T16:00:00Z', assignee: '이영희',
  },
  {
    id: 'V2-017', sqlId: 'qq7rr8ss9tt0', status: 'applied', type: 'tuning',
    sqlText: "WITH monthly_sales AS (SELECT TRUNC(order_date, 'MM') mon, customer_id, SUM(total_amount) amt FROM ORDERS GROUP BY TRUNC(order_date, 'MM'), customer_id) SELECT mon, COUNT(*) cust_cnt, SUM(amt) total FROM monthly_sales GROUP BY mon",
    workName: '월별 고객매출 CTE 인덱스 최적화', instanceName: 'PROD-DB1', schemaName: 'OMS',
    selectionSource: 'auto', originalElapsed: 22400, originalBuffers: 2350000,
    tunedElapsed: 3500, tunedBuffers: 280000, improvementRate: 84.4,
    recommendationType: 'index', source: 'v$sql', executionContext: 'Batch', estimatedDailyExec: 4,
    verifiedBy: '박준호', verifiedAt: '2026-03-31T06:00:00Z',
    appliedBy: '박준호', appliedAt: '2026-03-31T09:30:00Z', operationalResult: 'improved',
    operationalElapsed: 3300, operationalBuffers: 265000, operationalMeasuredAt: '2026-04-01T08:00:00Z',
    batchId: 'BATCH-0330-AUTO', batchMemo: '3/30 야간 자동튜닝',
    createdAt: '2026-03-30T22:00:00Z', updatedAt: '2026-03-31T09:30:00Z', assignee: '박준호',
  },
  {
    id: 'V2-018', sqlId: 'uu1vv2ww3xx4', status: 'applied', type: 'tuning',
    sqlText: 'SELECT c.contract_id, c.start_date, c.end_date, cu.customer_name FROM CONTRACTS c JOIN CUSTOMERS cu ON c.customer_id = cu.customer_id WHERE c.end_date BETWEEN SYSDATE AND SYSDATE + 30',
    workName: 'CONTRACTS 만료예정 조회 최적화', instanceName: 'PROD-DB1', schemaName: 'CRM',
    selectionSource: 'auto', originalElapsed: 13400, originalBuffers: 1400000,
    tunedElapsed: 2000, tunedBuffers: 140000, improvementRate: 85.1,
    recommendationType: 'index', source: 'maxgauge', executionContext: 'OLTP', estimatedDailyExec: 680,
    verifiedBy: '김민수', verifiedAt: '2026-04-01T06:00:00Z',
    appliedBy: '김민수', appliedAt: '2026-04-01T07:00:00Z', operationalResult: 'degraded',
    operationalElapsed: 15000, operationalBuffers: 1600000, operationalMeasuredAt: '2026-04-03T10:00:00Z',
    batchId: 'BATCH-0331-AUTO', batchMemo: '3/31 야간 자동튜닝',
    createdAt: '2026-03-31T22:00:00Z', updatedAt: '2026-04-01T07:00:00Z', assignee: '김민수',
  },
  {
    id: 'V2-019', sqlId: 'yy5zz6ab7cd8', status: 'applied', type: 'tuning',
    sqlText: "DELETE FROM TEMP_CALC WHERE calc_date < SYSDATE - 30 AND status = 'COMPLETED'",
    workName: 'TEMP_CALC 정리 배치 최적화', instanceName: 'PROD-DB2', schemaName: 'OMS',
    selectionSource: 'auto', originalElapsed: 45000, originalBuffers: 4700000,
    tunedElapsed: 6800, tunedBuffers: 470000, improvementRate: 84.9,
    recommendationType: 'rewrite', source: 'awr', executionContext: 'Batch', estimatedDailyExec: 1,
    verifiedBy: '이영희', verifiedAt: '2026-04-01T06:30:00Z',
    appliedBy: '이영희', appliedAt: '2026-04-01T07:30:00Z', operationalResult: 'degraded',
    operationalElapsed: 52000, operationalBuffers: 5100000, operationalMeasuredAt: '2026-04-03T09:00:00Z',
    batchId: 'BATCH-0331-AUTO', batchMemo: '3/31 야간 자동튜닝',
    createdAt: '2026-03-31T22:00:00Z', updatedAt: '2026-04-01T07:30:00Z', assignee: '이영희',
  },
  {
    id: 'V2-020', sqlId: 'ef9gh0ij1kl2', status: 'applied', type: 'verification',
    sqlText: 'SELECT n.notification_id, n.message, n.sent_at FROM NOTIFICATIONS n WHERE n.user_id = :uid AND n.is_read = 0 ORDER BY sent_at DESC',
    workName: 'NOTIFICATIONS 미읽음 조회 최적화', instanceName: 'PROD-DB1', schemaName: 'CRM',
    selectionSource: 'manual', originalElapsed: 4500, originalBuffers: 470000,
    tunedElapsed: 680, tunedBuffers: 47000, improvementRate: 84.9,
    recommendationType: 'index', source: 'v$sql', executionContext: 'OLTP', estimatedDailyExec: 12000,
    verifiedBy: '정수진', verifiedAt: '2026-03-31T10:00:00Z',
    appliedBy: '정수진', appliedAt: '2026-03-31T14:00:00Z', operationalResult: 'monitoring',
    operationalElapsed: 700, operationalBuffers: 48000, operationalMeasuredAt: '2026-04-01T08:00:00Z',
    batchId: 'REQ-0330-01', batchMemo: 'CRM 알림 조회 검증 요청',
    createdAt: '2026-03-30T22:00:00Z', updatedAt: '2026-03-31T14:00:00Z', assignee: '정수진',
  },

  // rejected: 1건
  {
    id: 'V2-021', sqlId: 'g3h4i5j6k7l8m', status: 'rejected', type: 'tuning',
    sqlText: 'SELECT /*+ INDEX(t IDX_TXN_DATE) */ t.txn_id, t.amount, a.account_no FROM TRANSACTIONS t JOIN ACCOUNTS a ON t.account_id = a.account_id WHERE t.txn_date >= TRUNC(SYSDATE)',
    workName: 'TRANSACTIONS 날짜조회 힌트 개선', instanceName: 'PROD-DB2', schemaName: 'FIN',
    selectionSource: 'auto', originalElapsed: 6700, originalBuffers: 720000,
    tunedElapsed: 6100, tunedBuffers: 690000, improvementRate: 8.9,
    recommendationType: 'hint', source: 'maxgauge', executionContext: 'OLTP', estimatedDailyExec: 5600,
    rejectedBy: '박준호', rejectedAt: '2026-04-02T08:00:00Z',
    rejectedReason: '개선 효과가 8.9%로 미미하여 튜닝 효과 부족. 구조적으로 추가 개선 불가.',
    batchId: 'BATCH-0401-AUTO', batchMemo: '4/1 야간 자동튜닝',
    createdAt: '2026-04-01T22:00:00Z', updatedAt: '2026-04-02T08:00:00Z', assignee: '박준호',
  },

  // 재튜닝 (pending으로 통합)
  {
    id: 'V2-022', sqlId: 'mn3op4qr5st6', status: 'pending', type: 'tuning',
    sqlText: 'SELECT NVL(bonus, 0) + salary total_comp FROM EMP WHERE department_id = :dept_id ORDER BY total_comp DESC',
    workName: 'EMP 보상총액 정렬 최적화', instanceName: 'PROD-DB1', schemaName: 'HR',
    selectionSource: 'auto', originalElapsed: 2100, originalBuffers: 220000,
    tunedElapsed: 1900, tunedBuffers: 210000, improvementRate: 4.5,
    recommendationType: 'hint', source: 'awr', executionContext: 'OLTP', estimatedDailyExec: 450,
    retuneConditions: ['인덱스 포함 재분석 필요', '파티션 전략 검토'],
    batchId: 'BATCH-0401-AUTO', batchMemo: '4/1 야간 자동튜닝',
    createdAt: '2026-04-01T22:00:00Z', updatedAt: '2026-04-02T07:30:00Z', assignee: '정수진',
  },

  // scheduled: 2건 (예약·반복 탭 전용 — 기본 작업함에서는 숨김)
  {
    id: 'V2-023', sqlId: 'sc1sc2sc3sc4', status: 'scheduled', type: 'tuning',
    sqlText: 'SELECT /*+ PARALLEL(8) */ order_date, SUM(total_amount) FROM ORDERS WHERE order_date >= TRUNC(SYSDATE) - 1 GROUP BY order_date',
    workName: '[반복] 일일 주문집계 튜닝 — 매일 02:00', instanceName: 'PROD-DB1', schemaName: 'OMS',
    selectionSource: 'auto', originalElapsed: 38200, originalBuffers: 3650000,
    source: 'maxgauge', executionContext: 'Batch', estimatedDailyExec: 1,
    batchId: 'SCHED-NIGHTLY', batchMemo: '야간 배치 반복 튜닝 (매일 02:00)',
    createdAt: '2026-04-08T18:00:00Z', updatedAt: '2026-04-09T02:00:00Z', assignee: '김민수',
  },
  {
    id: 'V2-024', sqlId: 'sc5sc6sc7sc8', status: 'scheduled', type: 'tuning',
    sqlText: "SELECT customer_id, COUNT(*) FROM SUPPORT_TICKETS WHERE status = 'OPEN' GROUP BY customer_id",
    workName: '[1회성] 주간 티켓 집계 튜닝 — 4/10 06:00 예약',
    instanceName: 'PROD-DB2', schemaName: 'CRM',
    selectionSource: 'manual', originalElapsed: 15700, originalBuffers: 1420000,
    source: 'awr', executionContext: 'OLTP', estimatedDailyExec: 240,
    batchId: 'SCHED-ONESHOT-0410', batchMemo: '4/10 06:00 1회성 예약',
    createdAt: '2026-04-09T09:00:00Z', updatedAt: '2026-04-09T09:00:00Z', assignee: '이영희',
  },

  // failed: 2건 (AI 분석 실패 / 적용 실패)
  {
    id: 'V2-025', sqlId: 'fa1fa2fa3fa4', status: 'failed', type: 'tuning',
    sqlText: 'SELECT * FROM LARGE_FACT_TABLE WHERE complex_udf_call(col_a, col_b, col_c) = :target_value AND ROWNUM <= 100',
    workName: 'LARGE_FACT_TABLE UDF 조건 튜닝', instanceName: 'PROD-DB1', schemaName: 'OMS',
    selectionSource: 'auto', originalElapsed: 125800, originalBuffers: 12500000,
    source: 'maxgauge', executionContext: 'Batch', estimatedDailyExec: 12,
    tuningError: 'AI 분석 타임아웃 (15분 초과) — 사용자 정의 함수(UDF)가 포함된 WHERE 절로 인해 대안 플랜 생성 실패',
    batchId: 'BATCH-0409-AUTO', batchMemo: '4/9 야간 자동튜닝',
    createdAt: '2026-04-09T02:00:00Z', updatedAt: '2026-04-09T02:17:00Z', assignee: '정수진',
  },
  {
    id: 'V2-026', sqlId: 'fa5fa6fa7fa8', status: 'failed', type: 'tuning',
    sqlText: 'UPDATE INVENTORY SET stock_qty = stock_qty - :qty WHERE product_id = :pid AND warehouse_id = :wid',
    workName: 'INVENTORY UPDATE 인덱스 힌트 적용', instanceName: 'PROD-DB2', schemaName: 'WMS',
    selectionSource: 'auto', originalElapsed: 4200, originalBuffers: 380000,
    tunedElapsed: 620, tunedBuffers: 38000, improvementRate: 85.2,
    recommendationType: 'hint', source: 'v$sql', executionContext: 'OLTP', estimatedDailyExec: 28000,
    verifiedBy: '박준호', verifiedAt: '2026-04-08T15:00:00Z',
    approvedBy: '박준호', approvedAt: '2026-04-08T15:30:00Z',
    applyError: '운영 DB 적용 중 ORA-01403: no data found — 대상 인덱스(IDX_INVENTORY_PW) 가 DDL 변경으로 인해 불일치 상태. 재검증 필요.',
    batchId: 'BATCH-0408-AUTO', batchMemo: '4/8 야간 자동튜닝',
    createdAt: '2026-04-08T02:00:00Z', updatedAt: '2026-04-09T06:30:00Z', assignee: '박준호',
  },
]
