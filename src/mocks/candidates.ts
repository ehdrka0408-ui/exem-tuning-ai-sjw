/* ─── AWR Snapshots ─── */
export interface AwrSnapshot {
  snapId: number
  instanceName: string
  beginTime: string
  endTime: string
}

export const awrSnapshots: AwrSnapshot[] = [] /*Array.from({ length: 24 }, (_, i) => ({
  snapId: 12340 + i,
  instanceName: 'PROD-DB1',
  beginTime: `2026-04-02 ${String(i).padStart(2, '0')}:00`,
  endTime: `2026-04-02 ${String(i + 1).padStart(2, '0')}:00`,
}))*/.concat(
  Array.from({ length: 24 }, (_, i) => ({
    snapId: 12370 + i,
    instanceName: 'PROD-DB2',
    beginTime: `2026-04-02 ${String(i).padStart(2, '0')}:00`,
    endTime: `2026-04-02 ${String(i + 1).padStart(2, '0')}:00`,
  })),
  Array.from({ length: 24 }, (_, i) => ({
    snapId: 12400 + i,
    instanceName: 'DEV-DB1',
    beginTime: `2026-04-02 ${String(i).padStart(2, '0')}:00`,
    endTime: `2026-04-02 ${String(i + 1).padStart(2, '0')}:00`,
  })),
)

export interface Candidate {
  sqlId: string
  sqlText: string
  elapsed: number
  cpuTime: number
  logicalReads: number
  physicalReads: number
  buffers: number
  executions: number
  impact: number
  source: 'maxgauge' | 'awr' | 'v$sql'
  module: string
  instanceName: string
  schemaName: string
  alias?: string // 사용자 정의 SQL 별칭
  planHashValue: string
  firstSeen: string
  lastSeen: string
}

/* ── 시드 기반 난수 ── */
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

const SQL_TEMPLATES = [
  'SELECT /*+ FULL(o) */ o.order_id, o.order_date, c.customer_name, SUM(oi.quantity * oi.unit_price) total FROM ORDERS o JOIN CUSTOMERS c ON o.customer_id = c.customer_id JOIN ORDER_ITEMS oi ON o.order_id = oi.order_id WHERE o.order_date > :dt GROUP BY o.order_id, o.order_date, c.customer_name',
  'SELECT e.employee_id, e.first_name, e.last_name, d.department_name, NVL(e.commission_pct, 0) comm FROM EMP e JOIN DEPT d ON e.department_id = d.department_id WHERE e.status = :status',
  'SELECT t.txn_id, t.txn_date, a.account_no, DECODE(t.txn_type, \'C\', \'Credit\', \'D\', \'Debit\') txn_desc, t.amount FROM TRANSACTIONS t JOIN ACCOUNTS a ON t.account_id = a.account_id WHERE t.txn_date BETWEEN :from AND :to',
  'SELECT * FROM (SELECT p.product_name, RANK() OVER (ORDER BY SUM(oi.quantity) DESC) rnk FROM PRODUCTS p JOIN ORDER_ITEMS oi ON p.product_id = oi.product_id GROUP BY p.product_name) WHERE rnk <= :top_n',
  'SELECT customer_id, customer_name, (SELECT COUNT(*) FROM ORDERS o WHERE o.customer_id = c.customer_id AND o.order_date > SYSDATE - 90) recent_orders FROM CUSTOMERS c WHERE c.status = \'ACTIVE\'',
  'SELECT emp_id, manager_id, LEVEL, SYS_CONNECT_BY_PATH(last_name, \'/\') path FROM EMP START WITH manager_id IS NULL CONNECT BY PRIOR employee_id = manager_id ORDER SIBLINGS BY last_name',
  'SELECT a.account_no, a.balance, NVL(SUM(t.amount), 0) total_txn, COUNT(t.txn_id) txn_count FROM ACCOUNTS a LEFT JOIN TRANSACTIONS t ON a.account_id = t.account_id GROUP BY a.account_no, a.balance HAVING COUNT(t.txn_id) > :min_txn',
  'UPDATE ORDERS SET status = \'SHIPPED\', ship_date = SYSDATE WHERE order_id IN (SELECT order_id FROM ORDER_ITEMS oi WHERE oi.quantity > 0 GROUP BY order_id HAVING SUM(oi.quantity) >= :min_qty)',
  'SELECT d.department_name, COUNT(e.employee_id) emp_cnt, AVG(e.salary) avg_sal, MAX(e.salary) max_sal FROM DEPT d JOIN EMP e ON d.department_id = e.department_id GROUP BY d.department_name ORDER BY avg_sal DESC',
  'INSERT INTO AUDIT_LOG (log_id, table_name, operation, old_value, new_value, changed_by) SELECT seq_audit.NEXTVAL, :tbl, :op, :old, :new, USER FROM DUAL',
  'SELECT /*+ INDEX(inv idx_inv_wh) */ inv.item_id, inv.warehouse_id, inv.quantity_on_hand, w.warehouse_name FROM INVENTORY inv JOIN WAREHOUSES w ON inv.warehouse_id = w.warehouse_id WHERE inv.quantity_on_hand < :reorder_point',
  'WITH daily_sales AS (SELECT TRUNC(order_date) dt, SUM(total_amount) amt FROM ORDERS GROUP BY TRUNC(order_date)) SELECT dt, amt, AVG(amt) OVER (ORDER BY dt ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) moving_avg FROM daily_sales',
  'DELETE FROM SESSION_LOG WHERE created_at < SYSDATE - 30 AND session_status = \'EXPIRED\' AND user_id NOT IN (SELECT user_id FROM ACTIVE_USERS)',
  'SELECT s.staff_id, s.staff_name, COUNT(DISTINCT o.order_id) order_cnt, SUM(o.total_amount) revenue FROM STAFF s JOIN ORDERS o ON s.staff_id = o.assigned_staff_id WHERE o.order_date >= TRUNC(SYSDATE, \'MM\') GROUP BY s.staff_id, s.staff_name',
  'MERGE INTO CUSTOMER_SUMMARY cs USING (SELECT customer_id, COUNT(*) cnt, SUM(amount) total FROM ORDERS GROUP BY customer_id) src ON (cs.customer_id = src.customer_id) WHEN MATCHED THEN UPDATE SET cs.order_cnt = src.cnt',
  'SELECT /*+ PARALLEL(4) */ region_id, region_name, SUM(sales_amount) total_sales, COUNT(DISTINCT customer_id) unique_customers FROM REGIONAL_SALES rs JOIN REGIONS r ON rs.region_id = r.region_id GROUP BY region_id, region_name',
  'SELECT po.po_number, po.vendor_name, po.total_cost, (SELECT MAX(receipt_date) FROM PO_RECEIPTS r WHERE r.po_id = po.po_id) last_receipt FROM PURCHASE_ORDERS po WHERE po.status = :status ORDER BY po.total_cost DESC',
  'SELECT contract_id, client_name, contract_value, end_date, CASE WHEN end_date < SYSDATE THEN \'Expired\' WHEN end_date < SYSDATE + 30 THEN \'Expiring\' ELSE \'Active\' END status FROM CONTRACTS WHERE dept_id = :dept',
  'SELECT /*+ USE_HASH(a b) */ a.acct_id, b.branch_name, a.balance FROM ACCOUNTS a JOIN BRANCHES b ON a.branch_id = b.branch_id WHERE a.balance > :min_bal ORDER BY a.balance DESC',
  'SELECT DISTINCT u.user_id, u.user_name, r.role_name, p.privilege_name FROM USERS u JOIN USER_ROLES ur ON u.user_id = ur.user_id JOIN ROLES r ON ur.role_id = r.role_id JOIN ROLE_PRIVILEGES rp ON r.role_id = rp.role_id JOIN PRIVILEGES p ON rp.priv_id = p.priv_id',
  'SELECT TO_CHAR(txn_date, \'YYYY-MM\') month, txn_type, COUNT(*) cnt, SUM(amount) total_amt, RATIO_TO_REPORT(SUM(amount)) OVER (PARTITION BY TO_CHAR(txn_date, \'YYYY-MM\')) pct FROM TRANSACTIONS GROUP BY TO_CHAR(txn_date, \'YYYY-MM\'), txn_type',
  'SELECT order_id, line_no, product_id, quantity, unit_price, quantity * unit_price line_total FROM ORDER_LINES WHERE order_id = :oid ORDER BY line_no',
  'SELECT /*+ LEADING(w) USE_NL(w e) */ w.work_order_id, w.priority, e.emp_name, w.scheduled_date, w.status FROM WORK_ORDERS w JOIN EMPLOYEES e ON w.assigned_to = e.emp_id WHERE w.status IN (\'OPEN\', \'IN_PROGRESS\')',
  'INSERT INTO DAILY_SUMMARY (summary_date, metric_name, metric_value, instance_name) SELECT TRUNC(SYSDATE-1), metric_name, AVG(metric_value), instance_name FROM PERF_METRICS WHERE sample_time >= TRUNC(SYSDATE-1) GROUP BY metric_name, instance_name',
  'SELECT alert_id, alert_type, severity, message, created_at FROM SYSTEM_ALERTS WHERE acknowledged = \'N\' AND severity IN (\'CRITICAL\', \'HIGH\') ORDER BY created_at DESC FETCH FIRST 100 ROWS ONLY',
  'SELECT /*+ GATHER_PLAN_STATISTICS */ cust_segment, COUNT(*) cust_count, ROUND(AVG(lifetime_value), 2) avg_ltv, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY lifetime_value) median_ltv FROM CUSTOMER_ANALYTICS GROUP BY cust_segment',
  'SELECT emp_id, department_id, salary, DENSE_RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) sal_rank FROM EMPLOYEES WHERE hire_date >= :start_date',
  'SELECT warehouse_id, item_id, quantity_on_hand, reorder_point, CASE WHEN quantity_on_hand <= reorder_point THEN \'REORDER\' ELSE \'OK\' END stock_status FROM INVENTORY WHERE warehouse_id = :wh_id ORDER BY quantity_on_hand ASC',
  'SELECT req_id, requestor, request_type, priority, status, created_at, ROUND((SYSDATE - created_at) * 24, 1) hours_open FROM SERVICE_REQUESTS WHERE status != \'CLOSED\' AND priority <= 2 ORDER BY priority, created_at',
  'SELECT /*+ RESULT_CACHE */ config_key, config_value, description FROM APP_CONFIG WHERE app_name = :app AND env = :env AND is_active = 1',
  'SELECT batch_id, job_name, start_time, end_time, ROUND((end_time - start_time) * 86400, 0) elapsed_sec, status, rows_processed FROM BATCH_JOB_LOG WHERE start_time >= TRUNC(SYSDATE) ORDER BY start_time DESC',
  'UPDATE INVENTORY SET quantity_on_hand = quantity_on_hand - :qty, last_updated = SYSDATE WHERE item_id = :item_id AND warehouse_id = :wh_id AND quantity_on_hand >= :qty',
  'SELECT /*+ PARALLEL(8) */ fact.sale_date, dim_prod.category, dim_region.region_name, SUM(fact.revenue) FROM SALES_FACT fact JOIN DIM_PRODUCT dim_prod ON fact.prod_key = dim_prod.prod_key GROUP BY fact.sale_date, dim_prod.category, dim_region.region_name',
  'SELECT c.cust_id, c.cust_name, SUM(o.total_amount) ytd FROM CUSTOMERS c LEFT JOIN ORDERS o ON c.cust_id = o.customer_id WHERE o.order_date >= TRUNC(SYSDATE, \'YYYY\') GROUP BY c.cust_id, c.cust_name ORDER BY ytd DESC',
  'SELECT pay_id, pay_date, pay_amount, pay_method, CASE WHEN pay_status = \'R\' THEN \'Refunded\' ELSE \'Completed\' END status_desc FROM PAYMENTS WHERE customer_id = :cid AND pay_date >= :from_dt ORDER BY pay_date DESC',
  'SELECT /*+ INDEX_DESC(l idx_log_ts) */ log_id, log_level, message, created_at FROM APP_LOG l WHERE app_name = :app AND created_at >= SYSDATE - 1 ORDER BY created_at DESC',
  'WITH recursive_mgr AS (SELECT emp_id, mgr_id, 1 lvl FROM EMPLOYEES WHERE mgr_id IS NULL UNION ALL SELECT e.emp_id, e.mgr_id, r.lvl+1 FROM EMPLOYEES e JOIN recursive_mgr r ON e.mgr_id = r.emp_id) SELECT * FROM recursive_mgr WHERE lvl <= 5',
  'SELECT ship_id, carrier_name, tracking_no, ROUND(SYSDATE - ship_date, 1) days_in_transit FROM SHIPMENTS WHERE status = \'IN_TRANSIT\' AND ship_date < SYSDATE - 7',
  'SELECT v.vendor_id, v.vendor_name, COUNT(po.po_id) po_count, SUM(po.total_cost) total_spend FROM VENDORS v JOIN PURCHASE_ORDERS po ON v.vendor_id = po.vendor_id GROUP BY v.vendor_id, v.vendor_name HAVING SUM(po.total_cost) > :threshold',
  'SELECT s.store_id, s.store_name, SUM(t.sale_amount) total_sales FROM STORES s JOIN TRANSACTIONS t ON s.store_id = t.store_id WHERE t.txn_date >= TRUNC(SYSDATE) GROUP BY s.store_id, s.store_name ORDER BY total_sales DESC',
]

const CAND_MODULES = ['OMS_BATCH', 'OMS_ONLINE', 'OMS_TRIGGER', 'HR_WEB', 'HR_ADMIN', 'HR_RPT', 'HR_PERF', 'FIN_CORE', 'FIN_SETTLE', 'SALES_RPT', 'SALES_WEB', 'SALES_API', 'INV_BATCH', 'SYS_PURGE', 'ETL_NIGHTLY', 'BI_DASH', 'PROC_WEB', 'CRM_RPT']
const CAND_SCHEMAS = ['OMS', 'HR', 'FIN', 'SALES', 'INV', 'SYS', 'DW', 'BI', 'PROC', 'CRM']
const SOURCES: Candidate['source'][] = ['maxgauge', 'awr', 'v$sql']

// 기준일: 2026-04-09 (오늘)
const BASE_DATE = new Date('2026-04-09T12:00:00+09:00').getTime()
const ONE_DAY = 86400000

function generateCandidates(count: number): Candidate[] {
  const result: Candidate[] = []
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'

  for (let i = 0; i < count; i++) {
    const r1 = seededRandom(i * 31 + 7)
    const r2 = seededRandom(i * 47 + 13)
    const r3 = seededRandom(i * 61 + 19)
    const r4 = seededRandom(i * 79 + 23)
    const r5 = seededRandom(i * 89 + 29)
    const r6 = seededRandom(i * 97 + 37)
    const r7 = seededRandom(i * 101 + 41)
    const r8 = seededRandom(i * 107 + 43)
    const r9 = seededRandom(i * 113 + 53)

    // SQL ID: 13자리 영숫자
    let sqlId = ''
    for (let j = 0; j < 13; j++) {
      sqlId += chars[Math.floor(seededRandom(i * 200 + j * 17 + 3) * chars.length)]
    }

    const sqlText = SQL_TEMPLATES[Math.floor(r1 * SQL_TEMPLATES.length)]
    const module = CAND_MODULES[Math.floor(r2 * CAND_MODULES.length)]
    const schema = CAND_SCHEMAS[Math.floor(r3 * CAND_SCHEMAS.length)]
    const source = SOURCES[Math.floor(r4 * SOURCES.length)]

    // elapsed: 상위 10건은 고부하 (20~60s), 나머지는 분포 (0.1~25s)
    let elapsed: number
    if (i < 10) {
      elapsed = Math.round((20000 + r5 * 40000))
    } else if (i < 30) {
      elapsed = Math.round((5000 + r5 * 20000))
    } else {
      elapsed = Math.round((100 + r5 * 12000))
    }

    const cpuTime = Math.round(elapsed * (0.5 + r6 * 0.2))
    const logicalReads = Math.round(elapsed * (80 + r7 * 40))
    const physicalReads = Math.round(logicalReads * (0.08 + r8 * 0.07))
    const buffers = Math.round(logicalReads * (1.02 + r9 * 0.08))
    const executions = Math.max(1, Math.round(seededRandom(i * 131 + 59) * 50000))
    const impact = Math.min(99, Math.max(5, Math.round(100 - i * 0.8 - seededRandom(i * 137 + 61) * 15)))

    const planHash = String(Math.floor(1000000000 + seededRandom(i * 149 + 67) * 9000000000))

    // 날짜: lastSeen = 최근 1~2일, firstSeen = 1~7일 전
    const lastSeenOffset = Math.floor(seededRandom(i * 151 + 71) * 2 * ONE_DAY)
    const firstSeenOffset = Math.floor((2 + seededRandom(i * 157 + 73) * 5) * ONE_DAY)
    const lastSeen = new Date(BASE_DATE - lastSeenOffset).toISOString()
    const firstSeen = new Date(BASE_DATE - firstSeenOffset).toISOString()

    result.push({
      sqlId, sqlText, elapsed, cpuTime, logicalReads, physicalReads,
      buffers, executions, impact, source, module,
      instanceName: 'PROD-DB1',
      schemaName: schema,
      planHashValue: planHash,
      alias: '',
      firstSeen, lastSeen,
    })
  }

  // P13c 특수 케이스 3건 추가 (기존 유지)
  result.push(
    // P13c 케이스 A — 이미 활성 작업 존재
    {
      sqlId: 'abc1234567890', sqlText: 'SELECT e.emp_id, e.salary, d.dept_name FROM EMP e JOIN DEPT d ON e.dept_id = d.dept_id WHERE e.hire_date >= ADD_MONTHS(SYSDATE, -12) ORDER BY e.salary DESC',
      elapsed: 5400, cpuTime: 3500, logicalReads: 570000, physicalReads: 68400, buffers: 590000, executions: 4200, impact: 72,
      source: 'maxgauge', module: 'HR_WEB', instanceName: 'PROD-DB1', schemaName: 'HR', planHashValue: '2847391045',
      firstSeen: '2026-04-03T08:00:00Z', lastSeen: '2026-04-09T05:30:00Z',
    },
    // P13c 케이스 B — 기존 적용 완료 작업 존재
    {
      sqlId: 'def9876543210', sqlText: 'SELECT c.cust_id, c.cust_name, SUM(o.total_amount) ytd FROM CUSTOMERS c LEFT JOIN ORDERS o ON c.cust_id = o.customer_id WHERE o.order_date >= TRUNC(SYSDATE, \'YYYY\') GROUP BY c.cust_id, c.cust_name',
      elapsed: 12800, cpuTime: 8200, logicalReads: 1340000, physicalReads: 160800, buffers: 1380000, executions: 2100, impact: 81,
      source: 'maxgauge', module: 'CRM_RPT', instanceName: 'PROD-DB1', schemaName: 'CRM', planHashValue: '3948201756',
      firstSeen: '2026-04-04T10:00:00Z', lastSeen: '2026-04-09T04:00:00Z',
    },
    // P13c 케이스 C — 신규 SQL
    {
      sqlId: 'ccc_new_sql_001', sqlText: 'SELECT s.store_id, s.store_name, SUM(t.sale_amount) total_sales FROM STORES s JOIN TRANSACTIONS t ON s.store_id = t.store_id WHERE t.txn_date >= TRUNC(SYSDATE) GROUP BY s.store_id, s.store_name ORDER BY total_sales DESC',
      elapsed: 9200, cpuTime: 5900, logicalReads: 960000, physicalReads: 115200, buffers: 990000, executions: 1800, impact: 68,
      source: 'maxgauge', module: 'SALES_WEB', instanceName: 'PROD-DB1', schemaName: 'OMS', planHashValue: '1729384756',
      firstSeen: '2026-04-05T06:00:00Z', lastSeen: '2026-04-09T03:30:00Z',
    },
  )

  return result
}

export const candidates: Candidate[] = []
