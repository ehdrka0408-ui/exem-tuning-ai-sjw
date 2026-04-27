export interface PlanHistoryItem {
  id: string
  sqlId: string
  sqlText: string
  instanceName: string
  detectedAt: string
  previousPlanHash: string
  currentPlanHash: string
  previousCost: number
  currentCost: number
  costChangeRate: number
  status: 'new' | 'investigating' | 'resolved' | 'ignored'
}

export const planHistory: PlanHistoryItem[] = [
  {
    id: 'PH-001',
    sqlId: 'a1b2c3d4e5f6g',
    sqlText: 'SELECT /*+ FULL(o) */ o.order_id, o.order_date, c.customer_name, SUM(oi.quantity * oi.unit_price) total FROM ORDERS o, CUSTOMERS c, ORDER_ITEMS oi WHERE o.cust',
    instanceName: 'PROD-DB1',
    detectedAt: '2026-03-31T03:15:00Z',
    previousPlanHash: '3829174650',
    currentPlanHash: '1047283956',
    previousCost: 1250,
    currentCost: 48700,
    costChangeRate: 3796.0,
    status: 'investigating',
  },
  {
    id: 'PH-002',
    sqlId: 'f7g8h9i0j1k2l',
    sqlText: 'SELECT e.employee_id, e.first_name, e.last_name, d.department_name, NVL(e.commission_pct, 0) comm FROM EMP e JOIN DEPT d ON e.department_id = d.department_id',
    instanceName: 'PROD-DB1',
    detectedAt: '2026-03-30T22:30:00Z',
    previousPlanHash: '2748103965',
    currentPlanHash: '8391047256',
    previousCost: 340,
    currentCost: 12800,
    costChangeRate: 3664.7,
    status: 'resolved',
  },
  {
    id: 'PH-003',
    sqlId: 'm3n4o5p6q7r8s',
    sqlText: 'SELECT t.txn_id, t.txn_date, a.account_no, DECODE(t.txn_type, \'C\', \'Credit\', \'D\', \'Debit\', \'Unknown\') txn_desc, t.amount FROM TRANSACTIONS t, ACCOUNTS a WHERE',
    instanceName: 'PROD-DB2',
    detectedAt: '2026-04-01T01:45:00Z',
    previousPlanHash: '5620184739',
    currentPlanHash: '9374028156',
    previousCost: 890,
    currentCost: 34200,
    costChangeRate: 3742.7,
    status: 'new',
  },
  {
    id: 'PH-004',
    sqlId: 'k5l6m7n8o9p0q',
    sqlText: 'SELECT c.customer_name, o.order_id, o.order_date FROM CUSTOMERS c INNER JOIN ORDERS o ON c.customer_id = o.customer_id WHERE o.order_date BETWEEN :start_dt AND',
    instanceName: 'DEV-DB1',
    detectedAt: '2026-03-29T14:00:00Z',
    previousPlanHash: '4185029367',
    currentPlanHash: '7293041856',
    previousCost: 210,
    currentCost: 850,
    costChangeRate: 304.8,
    status: 'ignored',
  },
  {
    id: 'PH-005',
    sqlId: 'u5v6w7x8y9z0a',
    sqlText: 'SELECT o.order_id, o.order_date, o.total_amount, c.customer_name, c.credit_limit FROM ORDERS o JOIN CUSTOMERS c ON o.customer_id = c.customer_id WHERE o.total',
    instanceName: 'PROD-DB2',
    detectedAt: '2026-04-01T06:20:00Z',
    previousPlanHash: '6038291745',
    currentPlanHash: '2847103965',
    previousCost: 520,
    currentCost: 15600,
    costChangeRate: 2900.0,
    status: 'new',
  },
  {
    id: 'PH-006',
    sqlId: 'p3q4r5s6t7u8v',
    sqlText: 'WITH monthly_sales AS (SELECT TRUNC(order_date, \'MM\') mon, customer_id, SUM(total_amount) amt FROM ORDERS GROUP BY TRUNC(order_date, \'MM\'), customer_id) SELECT',
    instanceName: 'PROD-DB1',
    detectedAt: '2026-03-28T11:00:00Z',
    previousPlanHash: '8174029365',
    currentPlanHash: '3920184756',
    previousCost: 1800,
    currentCost: 2100,
    costChangeRate: 16.7,
    status: 'resolved',
  },
  {
    id: 'PH-007',
    sqlId: 'b1c2d3e4f5g6h',
    sqlText: 'SELECT department_id, employee_id, salary, SUM(salary) OVER (PARTITION BY department_id ORDER BY salary ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) run_t',
    instanceName: 'PROD-DB1',
    detectedAt: '2026-04-02T02:10:00Z',
    previousPlanHash: '1293847560',
    currentPlanHash: '5748291036',
    previousCost: 680,
    currentCost: 9400,
    costChangeRate: 1282.4,
    status: 'investigating',
  },
]
