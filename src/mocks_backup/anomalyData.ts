export type SqlType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'

export interface AnomalyPoint {
  id: string
  timestamp: string      // ISO
  sqlId: string
  elapsed: number        // ms
  buffers: number
  waitEvent: string
  schemaName: string
  userName: string
  program: string
  module: string
  instance: string
  sqlType: SqlType
  sqlText: string
  hasPlanChange: boolean
  x: number              // time offset in seconds (0–7200)
  y: number              // elapsed in seconds
}

const WAIT_EVENTS = ['CPU', 'db file sequential read', 'db file scattered read', 'log file sync', 'latch free', 'buffer busy waits', 'direct path read']
const SCHEMAS = ['APP', 'OMS', 'FIN', 'HR', 'CRM', 'DW']
const INSTANCES = ['PROD-DB1', 'PROD-DB2', 'DEV-DB1']
const USERS = ['APP_USER', 'OMS_BATCH', 'FIN_USER', 'HR_ADMIN', 'CRM_SVC', 'DW_ETL', 'SYS_MONITOR', 'SALES_API']
const PROGRAMS = ['sqlplus.exe', 'JDBC Thin Client', 'python3', 'java.exe', 'OMS_BatchJob', 'ETL_Scheduler', 'apache-tomcat', 'node']
const MODULES = ['OMS_BATCH', 'OMS_ONLINE', 'FIN_CORE', 'FIN_SETTLE', 'HR_WEB', 'HR_ADMIN', 'CRM_API', 'DW_ETL', 'SALES_RPT', 'SYS_PURGE']
const SQL_IDS = [
  'sql_a001', 'sql_a002', 'sql_a003', 'sql_a004', 'sql_a005',
  'sql_a006', 'sql_a007', 'sql_a008', 'sql_a009', 'sql_a010',
  'sql_b001', 'sql_b002', 'sql_b003', 'sql_b004', 'sql_b005',
  'sql_c001', 'sql_c002', 'sql_c003', 'sql_c004', 'sql_c005',
]

const SQL_TEXTS: Record<string, { text: string; type: SqlType }> = {
  sql_a001: { text: 'SELECT o.order_id, c.customer_name FROM ORDERS o JOIN CUSTOMERS c ON o.customer_id = c.customer_id WHERE o.order_date > :dt', type: 'SELECT' },
  sql_a002: { text: 'SELECT e.employee_id, d.department_name FROM EMPLOYEES e JOIN DEPARTMENTS d ON e.department_id = d.department_id', type: 'SELECT' },
  sql_a003: { text: 'SELECT product_id, SUM(quantity) FROM ORDER_ITEMS GROUP BY product_id ORDER BY SUM(quantity) DESC', type: 'SELECT' },
  sql_a004: { text: 'SELECT account_no, balance FROM ACCOUNTS WHERE status = :status AND balance > :min_bal', type: 'SELECT' },
  sql_a005: { text: 'SELECT t.txn_id, t.amount FROM TRANSACTIONS t WHERE t.txn_date BETWEEN :from AND :to', type: 'SELECT' },
  sql_a006: { text: 'SELECT ship_id, tracking_no FROM SHIPMENTS WHERE order_id = :oid', type: 'SELECT' },
  sql_a007: { text: "SELECT invoice_id, total_amount FROM INVOICES WHERE due_date < SYSDATE AND status = 'UNPAID'", type: 'SELECT' },
  sql_a008: { text: 'SELECT pay_id, pay_amount FROM PAYMENTS WHERE customer_id = :cid ORDER BY pay_date DESC', type: 'SELECT' },
  sql_a009: { text: 'SELECT contract_id, end_date FROM CONTRACTS WHERE end_date BETWEEN SYSDATE AND SYSDATE + 30', type: 'SELECT' },
  sql_a010: { text: 'SELECT n.notification_id, n.message FROM NOTIFICATIONS n WHERE n.user_id = :uid AND n.is_read = 0', type: 'SELECT' },
  sql_b001: { text: 'SELECT COUNT(*) FROM ORDERS WHERE order_date = TRUNC(SYSDATE)', type: 'SELECT' },
  sql_b002: { text: 'SELECT AVG(salary) FROM EMPLOYEES WHERE department_id = :dept_id', type: 'SELECT' },
  sql_b003: { text: 'INSERT INTO AUDIT_LOG (log_id, table_name, operation) VALUES (seq_audit.NEXTVAL, :tbl, :op)', type: 'INSERT' },
  sql_b004: { text: "UPDATE ORDERS SET status = 'SHIPPED' WHERE order_id = :oid", type: 'UPDATE' },
  sql_b005: { text: 'DELETE FROM TEMP_CALC WHERE calc_date < SYSDATE - 30', type: 'DELETE' },
  sql_c001: { text: 'SELECT customer_name, (SELECT COUNT(*) FROM ORDERS o WHERE o.customer_id = c.customer_id) cnt FROM CUSTOMERS c', type: 'SELECT' },
  sql_c002: { text: 'SELECT * FROM (SELECT p.product_name, RANK() OVER (ORDER BY SUM(oi.quantity) DESC) rnk FROM PRODUCTS p JOIN ORDER_ITEMS oi ON p.product_id = oi.product_id GROUP BY p.product_name) WHERE rnk <= 10', type: 'SELECT' },
  sql_c003: { text: 'INSERT INTO ORDER_ITEMS (item_id, order_id, product_id, quantity) VALUES (:iid, :oid, :pid, :qty)', type: 'INSERT' },
  sql_c004: { text: 'UPDATE ACCOUNTS SET balance = balance + :amt WHERE account_id = :aid', type: 'UPDATE' },
  sql_c005: { text: 'SELECT DISTINCT schema_name FROM ALL_TABLES WHERE owner = :owner', type: 'SELECT' },
}

// 시드 기반 난수
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function generatePoints(): AnomalyPoint[] {
  const points: AnomalyPoint[] = []
  const baseTime = new Date('2026-04-03T06:00:00+09:00').getTime()
  const X_DOMAIN = 7200 // 2시간 (초)

  for (let i = 0; i < 80; i++) {
    const r = seededRandom(i * 31 + 7)
    const r2 = seededRandom(i * 47 + 13)
    const r3 = seededRandom(i * 61 + 19)
    const r4 = seededRandom(i * 79 + 23)
    const r5 = seededRandom(i * 89 + 29)
    const r6 = seededRandom(i * 101 + 31)
    const r7 = seededRandom(i * 107 + 53)

    const sqlIdKey = SQL_IDS[Math.floor(r * SQL_IDS.length)]
    const sqlInfo = SQL_TEXTS[sqlIdKey]
    const xOffset = Math.floor(r2 * X_DOMAIN) // 0-7200초
    const waitEvent = WAIT_EVENTS[Math.floor(r3 * WAIT_EVENTS.length)]
    const schema = SCHEMAS[Math.floor(r4 * SCHEMAS.length)]
    const instance = INSTANCES[Math.floor(r5 * INSTANCES.length)]
    const userName = USERS[Math.floor(r6 * USERS.length)]
    const program = PROGRAMS[Math.floor(r7 * PROGRAMS.length)]
    const moduleName = MODULES[Math.floor(seededRandom(i * 131 + 59) * MODULES.length)]

    // 이상치: 첫 12개는 고 elapsed, 나머지는 정상
    let elapsedSec: number
    if (i < 12) {
      elapsedSec = 3 + seededRandom(i * 97 + 37) * 17 // 3~20초
    } else {
      elapsedSec = 0.05 + seededRandom(i * 113 + 41) * 2.5 // 0.05~2.5초
    }
    elapsedSec = Math.round(elapsedSec * 100) / 100

    const elapsedMs = Math.round(elapsedSec * 1000)
    const buffers = Math.floor(elapsedMs * (50 + seededRandom(i * 127 + 43) * 200))
    const hasPlanChange = i < 8 // 첫 8개만 plan change

    points.push({
      id: `AP-${String(i + 1).padStart(3, '0')}`,
      timestamp: new Date(baseTime + xOffset * 1000).toISOString(),
      sqlId: sqlIdKey,
      elapsed: elapsedMs,
      buffers,
      waitEvent,
      schemaName: schema,
      userName,
      program,
      module: moduleName,
      instance,
      sqlType: sqlInfo.type,
      sqlText: sqlInfo.text,
      hasPlanChange,
      x: xOffset,
      y: elapsedSec,
    })
  }

  return points.sort((a, b) => a.x - b.x)
}

export const anomalyPoints = generatePoints()

export { INSTANCES, SCHEMAS, WAIT_EVENTS, USERS, PROGRAMS, MODULES }
