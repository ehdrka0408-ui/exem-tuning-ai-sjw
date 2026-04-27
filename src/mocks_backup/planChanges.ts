export type PlanChangeImpact = 'degraded' | 'improved' | 'neutral'

export interface PlanChangeItem {
  id: string
  sqlId: string
  schema: string
  instanceName: string
  prevPlanHash: string
  currPlanHash: string
  prevElapsed: number    // ms
  currElapsed: number    // ms
  changeRate: number     // % (양수=악화, 음수=개선)
  detectedAt: string
  impact: PlanChangeImpact
  sqlText: string
  prevPlan: string
  currPlan: string
  // 플랜 이력 (타임라인 차트용)
  planHistory: { time: string; elapsed: number; planHash: string }[]
  spmFixed: boolean
  tuningRequested: boolean
}

export const planChangeItems: PlanChangeItem[] = [
  {
    id: 'PC-001',
    sqlId: 'abc123def456',
    schema: 'APP',
    instanceName: 'PROD-DB1',
    prevPlanHash: '38291742',
    currPlanHash: '19283746',
    prevElapsed: 420,
    currElapsed: 3240,
    changeRate: 671.4,
    detectedAt: '2026-04-03T03:15:00Z',
    impact: 'degraded',
    sqlText: 'SELECT o.order_id, o.order_date, c.customer_name, o.total_amount\nFROM ORDERS o\nJOIN CUSTOMERS c ON o.customer_id = c.customer_id\nWHERE o.order_date BETWEEN :start_dt AND :end_dt\nORDER BY o.order_date DESC',
    prevPlan: `Plan hash value: 38291742
------------------------------------------------------------------
| Id | Operation                    | Name            | Rows | Cost |
------------------------------------------------------------------
|  0 | SELECT STATEMENT             |                 |  500 |  125 |
|  1 |  SORT ORDER BY               |                 |  500 |  125 |
|  2 |   NESTED LOOPS               |                 |  500 |   98 |
|  3 |    INDEX RANGE SCAN          | IDX_ORD_DATE    |  500 |   12 |
|  4 |    TABLE ACCESS BY INDEX ROWID| CUSTOMERS      |    1 |    1 |
------------------------------------------------------------------`,
    currPlan: `Plan hash value: 19283746
------------------------------------------------------------------
| Id | Operation                    | Name            | Rows | Cost |
------------------------------------------------------------------
|  0 | SELECT STATEMENT             |                 |  500 | 4820 |
|  1 |  SORT ORDER BY               |                 |  500 | 4820 |
|  2 |   HASH JOIN                  |                 |  500 | 4790 |
|  3 |    TABLE ACCESS FULL         | ORDERS          | 100K | 3200 |
|  4 |    TABLE ACCESS FULL         | CUSTOMERS       |  50K | 1580 |
------------------------------------------------------------------`,
    planHistory: [
      { time: '04-02 22:00', elapsed: 410, planHash: '38291742' },
      { time: '04-02 23:00', elapsed: 430, planHash: '38291742' },
      { time: '04-03 00:00', elapsed: 405, planHash: '38291742' },
      { time: '04-03 01:00', elapsed: 420, planHash: '38291742' },
      { time: '04-03 02:00', elapsed: 440, planHash: '38291742' },
      { time: '04-03 03:00', elapsed: 3100, planHash: '19283746' },
      { time: '04-03 04:00', elapsed: 3240, planHash: '19283746' },
      { time: '04-03 05:00', elapsed: 3180, planHash: '19283746' },
    ],
    spmFixed: false,
    tuningRequested: false,
  },
  {
    id: 'PC-002',
    sqlId: 'ghi789jkl012',
    schema: 'APP',
    instanceName: 'PROD-DB1',
    prevPlanHash: '55123890',
    currPlanHash: '77654321',
    prevElapsed: 180,
    currElapsed: 2450,
    changeRate: 1261.1,
    detectedAt: '2026-04-03T02:30:00Z',
    impact: 'degraded',
    sqlText: 'SELECT e.employee_id, e.first_name, e.last_name, d.department_name\nFROM EMPLOYEES e\nJOIN DEPARTMENTS d ON e.department_id = d.department_id\nWHERE e.salary > :min_salary\nAND e.hire_date > :cutoff_date',
    prevPlan: `Plan hash value: 55123890
------------------------------------------------------------------
| Id | Operation                    | Name            | Rows | Cost |
------------------------------------------------------------------
|  0 | SELECT STATEMENT             |                 |  120 |   45 |
|  1 |  NESTED LOOPS                |                 |  120 |   45 |
|  2 |   INDEX RANGE SCAN           | IDX_EMP_SAL     |  120 |    8 |
|  3 |   TABLE ACCESS BY INDEX ROWID| DEPARTMENTS     |    1 |    1 |
------------------------------------------------------------------`,
    currPlan: `Plan hash value: 77654321
------------------------------------------------------------------
| Id | Operation                    | Name            | Rows | Cost |
------------------------------------------------------------------
|  0 | SELECT STATEMENT             |                 |  120 | 2890 |
|  1 |  HASH JOIN                   |                 |  120 | 2890 |
|  2 |   TABLE ACCESS FULL          | EMPLOYEES       |  10K | 2100 |
|  3 |   TABLE ACCESS FULL          | DEPARTMENTS     |  200 |  780 |
------------------------------------------------------------------`,
    planHistory: [
      { time: '04-02 22:00', elapsed: 175, planHash: '55123890' },
      { time: '04-02 23:00', elapsed: 185, planHash: '55123890' },
      { time: '04-03 00:00', elapsed: 180, planHash: '55123890' },
      { time: '04-03 01:00', elapsed: 190, planHash: '55123890' },
      { time: '04-03 02:00', elapsed: 2300, planHash: '77654321' },
      { time: '04-03 03:00', elapsed: 2450, planHash: '77654321' },
      { time: '04-03 04:00', elapsed: 2520, planHash: '77654321' },
    ],
    spmFixed: false,
    tuningRequested: false,
  },
  {
    id: 'PC-003',
    sqlId: 'mno345pqr678',
    schema: 'FIN',
    instanceName: 'PROD-DB2',
    prevPlanHash: '44556677',
    currPlanHash: '88990011',
    prevElapsed: 950,
    currElapsed: 4100,
    changeRate: 331.6,
    detectedAt: '2026-04-03T04:20:00Z',
    impact: 'degraded',
    sqlText: 'SELECT a.account_no, a.balance, SUM(t.amount) total_txn\nFROM ACCOUNTS a\nLEFT JOIN TRANSACTIONS t ON a.account_id = t.account_id\nWHERE a.status = :status\nGROUP BY a.account_no, a.balance',
    prevPlan: `Plan hash value: 44556677
------------------------------------------------------------------
| Id | Operation                    | Name            | Rows | Cost |
------------------------------------------------------------------
|  0 | SELECT STATEMENT             |                 | 2000 |  340 |
|  1 |  HASH GROUP BY               |                 | 2000 |  340 |
|  2 |   NESTED LOOPS OUTER         |                 | 2000 |  280 |
|  3 |    INDEX RANGE SCAN          | IDX_ACCT_STAT   | 2000 |   15 |
|  4 |    INDEX RANGE SCAN          | IDX_TXN_ACCT    |    5 |    2 |
------------------------------------------------------------------`,
    currPlan: `Plan hash value: 88990011
------------------------------------------------------------------
| Id | Operation                    | Name            | Rows | Cost |
------------------------------------------------------------------
|  0 | SELECT STATEMENT             |                 | 2000 | 5200 |
|  1 |  HASH GROUP BY               |                 | 2000 | 5200 |
|  2 |   HASH JOIN OUTER            |                 | 2000 | 5100 |
|  3 |    TABLE ACCESS FULL         | ACCOUNTS        |  50K | 1800 |
|  4 |    TABLE ACCESS FULL         | TRANSACTIONS    | 500K | 3200 |
------------------------------------------------------------------`,
    planHistory: [
      { time: '04-02 22:00', elapsed: 940, planHash: '44556677' },
      { time: '04-03 00:00', elapsed: 960, planHash: '44556677' },
      { time: '04-03 02:00', elapsed: 950, planHash: '44556677' },
      { time: '04-03 04:00', elapsed: 4100, planHash: '88990011' },
      { time: '04-03 05:00', elapsed: 4050, planHash: '88990011' },
    ],
    spmFixed: false,
    tuningRequested: false,
  },
  {
    id: 'PC-004',
    sqlId: 'stu901vwx234',
    schema: 'APP',
    instanceName: 'PROD-DB1',
    prevPlanHash: '11223344',
    currPlanHash: '55667788',
    prevElapsed: 2800,
    currElapsed: 8500,
    changeRate: 203.6,
    detectedAt: '2026-04-03T01:45:00Z',
    impact: 'degraded',
    sqlText: 'SELECT p.product_id, p.product_name, SUM(oi.quantity) total_qty\nFROM PRODUCTS p\nJOIN ORDER_ITEMS oi ON p.product_id = oi.product_id\nJOIN ORDERS o ON oi.order_id = o.order_id\nWHERE o.order_date >= TRUNC(SYSDATE) - 30\nGROUP BY p.product_id, p.product_name\nORDER BY total_qty DESC',
    prevPlan: `Plan hash value: 11223344
------------------------------------------------------------------
| Id | Operation                    | Name            | Rows | Cost |
------------------------------------------------------------------
|  0 | SELECT STATEMENT             |                 | 5000 |  890 |
|  1 |  SORT ORDER BY               |                 | 5000 |  890 |
|  2 |   HASH GROUP BY              |                 | 5000 |  850 |
|  3 |    HASH JOIN                  |                 | 50K  |  620 |
|  4 |     INDEX RANGE SCAN         | IDX_ORD_DATE    |  10K |   25 |
|  5 |     HASH JOIN                |                 | 50K  |  580 |
|  6 |      TABLE ACCESS FULL       | ORDER_ITEMS     |  80K |  320 |
|  7 |      TABLE ACCESS FULL       | PRODUCTS        |  10K |  120 |
------------------------------------------------------------------`,
    currPlan: `Plan hash value: 55667788
------------------------------------------------------------------
| Id | Operation                    | Name            | Rows | Cost |
------------------------------------------------------------------
|  0 | SELECT STATEMENT             |                 | 5000 | 8200 |
|  1 |  SORT ORDER BY               |                 | 5000 | 8200 |
|  2 |   HASH GROUP BY              |                 | 5000 | 8100 |
|  3 |    HASH JOIN                  |                 | 500K | 7800 |
|  4 |     TABLE ACCESS FULL        | ORDERS          | 100K | 3200 |
|  5 |     HASH JOIN                |                 | 500K | 4500 |
|  6 |      TABLE ACCESS FULL       | ORDER_ITEMS     |  80K |  320 |
|  7 |      TABLE ACCESS FULL       | PRODUCTS        |  10K |  120 |
------------------------------------------------------------------`,
    planHistory: [
      { time: '04-02 20:00', elapsed: 2750, planHash: '11223344' },
      { time: '04-02 22:00', elapsed: 2820, planHash: '11223344' },
      { time: '04-03 00:00', elapsed: 2790, planHash: '11223344' },
      { time: '04-03 01:00', elapsed: 8200, planHash: '55667788' },
      { time: '04-03 02:00', elapsed: 8500, planHash: '55667788' },
      { time: '04-03 03:00', elapsed: 8400, planHash: '55667788' },
    ],
    spmFixed: false,
    tuningRequested: false,
  },
  {
    id: 'PC-005',
    sqlId: 'yza567bcd890',
    schema: 'HR',
    instanceName: 'PROD-DB2',
    prevPlanHash: '99001122',
    currPlanHash: '33445566',
    prevElapsed: 650,
    currElapsed: 1820,
    changeRate: 180.0,
    detectedAt: '2026-04-03T05:10:00Z',
    impact: 'degraded',
    sqlText: 'SELECT e.employee_id, e.first_name, m.first_name manager_name, d.department_name\nFROM EMPLOYEES e\nLEFT JOIN EMPLOYEES m ON e.manager_id = m.employee_id\nJOIN DEPARTMENTS d ON e.department_id = d.department_id\nWHERE d.location_id = :loc_id',
    prevPlan: `Plan hash value: 99001122
------------------------------------------------------------------
| Id | Operation                    | Name            | Rows | Cost |
------------------------------------------------------------------
|  0 | SELECT STATEMENT             |                 |  200 |  145 |
|  1 |  NESTED LOOPS OUTER          |                 |  200 |  145 |
|  2 |   NESTED LOOPS               |                 |  200 |   85 |
|  3 |    INDEX RANGE SCAN          | IDX_DEPT_LOC    |   10 |    3 |
|  4 |    INDEX RANGE SCAN          | IDX_EMP_DEPT    |   20 |    5 |
|  5 |   TABLE ACCESS BY INDEX ROWID| EMPLOYEES       |    1 |    1 |
------------------------------------------------------------------`,
    currPlan: `Plan hash value: 33445566
------------------------------------------------------------------
| Id | Operation                    | Name            | Rows | Cost |
------------------------------------------------------------------
|  0 | SELECT STATEMENT             |                 |  200 | 1950 |
|  1 |  HASH JOIN OUTER             |                 |  200 | 1950 |
|  2 |   HASH JOIN                  |                 |  200 | 1200 |
|  3 |    TABLE ACCESS FULL         | DEPARTMENTS     |  200 |  120 |
|  4 |    TABLE ACCESS FULL         | EMPLOYEES       |  10K | 1050 |
|  5 |   TABLE ACCESS FULL          | EMPLOYEES       |  10K | 1050 |
------------------------------------------------------------------`,
    planHistory: [
      { time: '04-03 01:00', elapsed: 640, planHash: '99001122' },
      { time: '04-03 02:00', elapsed: 660, planHash: '99001122' },
      { time: '04-03 03:00', elapsed: 650, planHash: '99001122' },
      { time: '04-03 04:00', elapsed: 1750, planHash: '33445566' },
      { time: '04-03 05:00', elapsed: 1820, planHash: '33445566' },
    ],
    spmFixed: false,
    tuningRequested: false,
  },
  // 개선됨 3건
  {
    id: 'PC-006',
    sqlId: 'efg123hij456',
    schema: 'APP',
    instanceName: 'PROD-DB1',
    prevPlanHash: '12345678',
    currPlanHash: '87654321',
    prevElapsed: 1200,
    currElapsed: 980,
    changeRate: -18.3,
    detectedAt: '2026-04-03T04:20:00Z',
    impact: 'improved',
    sqlText: 'SELECT c.customer_id, c.customer_name, COUNT(o.order_id) order_cnt\nFROM CUSTOMERS c\nLEFT JOIN ORDERS o ON c.customer_id = o.customer_id\nGROUP BY c.customer_id, c.customer_name\nHAVING COUNT(o.order_id) > :min_cnt',
    prevPlan: `Plan hash value: 12345678
------------------------------------------------------------------
| Id | Operation                    | Name            | Rows | Cost |
------------------------------------------------------------------
|  0 | SELECT STATEMENT             |                 | 1000 |  890 |
|  1 |  FILTER                      |                 | 1000 |  890 |
|  2 |   HASH GROUP BY              |                 | 1000 |  890 |
|  3 |    HASH JOIN OUTER           |                 |  50K |  650 |
|  4 |     TABLE ACCESS FULL        | CUSTOMERS       |  50K |  280 |
|  5 |     TABLE ACCESS FULL        | ORDERS          | 100K |  350 |
------------------------------------------------------------------`,
    currPlan: `Plan hash value: 87654321
------------------------------------------------------------------
| Id | Operation                    | Name            | Rows | Cost |
------------------------------------------------------------------
|  0 | SELECT STATEMENT             |                 | 1000 |  620 |
|  1 |  FILTER                      |                 | 1000 |  620 |
|  2 |   HASH GROUP BY              |                 | 1000 |  620 |
|  3 |    NESTED LOOPS OUTER        |                 |  50K |  480 |
|  4 |     TABLE ACCESS FULL        | CUSTOMERS       |  50K |  280 |
|  5 |     INDEX RANGE SCAN         | IDX_ORD_CUST    |    2 |    1 |
------------------------------------------------------------------`,
    planHistory: [
      { time: '04-03 00:00', elapsed: 1210, planHash: '12345678' },
      { time: '04-03 02:00', elapsed: 1190, planHash: '12345678' },
      { time: '04-03 04:00', elapsed: 980, planHash: '87654321' },
      { time: '04-03 05:00', elapsed: 970, planHash: '87654321' },
    ],
    spmFixed: false,
    tuningRequested: false,
  },
  {
    id: 'PC-007',
    sqlId: 'klm789nop012',
    schema: 'FIN',
    instanceName: 'PROD-DB2',
    prevPlanHash: '22334455',
    currPlanHash: '66778899',
    prevElapsed: 3500,
    currElapsed: 1200,
    changeRate: -65.7,
    detectedAt: '2026-04-03T03:50:00Z',
    impact: 'improved',
    sqlText: 'SELECT t.txn_id, t.txn_date, t.amount, a.account_no\nFROM TRANSACTIONS t\nJOIN ACCOUNTS a ON t.account_id = a.account_id\nWHERE t.txn_date BETWEEN :from_dt AND :to_dt\nAND t.amount > :min_amount',
    prevPlan: `Plan hash value: 22334455
------------------------------------------------------------------
| Id | Operation                    | Name            | Rows | Cost |
------------------------------------------------------------------
|  0 | SELECT STATEMENT             |                 | 5000 | 4200 |
|  1 |  HASH JOIN                   |                 | 5000 | 4200 |
|  2 |   TABLE ACCESS FULL          | TRANSACTIONS    | 500K | 3200 |
|  3 |   TABLE ACCESS FULL          | ACCOUNTS        |  50K |  980 |
------------------------------------------------------------------`,
    currPlan: `Plan hash value: 66778899
------------------------------------------------------------------
| Id | Operation                    | Name            | Rows | Cost |
------------------------------------------------------------------
|  0 | SELECT STATEMENT             |                 | 5000 |  850 |
|  1 |  NESTED LOOPS                |                 | 5000 |  850 |
|  2 |   INDEX RANGE SCAN           | IDX_TXN_DATE    | 5000 |  120 |
|  3 |   TABLE ACCESS BY INDEX ROWID| ACCOUNTS        |    1 |    1 |
------------------------------------------------------------------`,
    planHistory: [
      { time: '04-03 00:00', elapsed: 3480, planHash: '22334455' },
      { time: '04-03 01:00', elapsed: 3520, planHash: '22334455' },
      { time: '04-03 02:00', elapsed: 3500, planHash: '22334455' },
      { time: '04-03 03:00', elapsed: 1250, planHash: '66778899' },
      { time: '04-03 04:00', elapsed: 1200, planHash: '66778899' },
    ],
    spmFixed: false,
    tuningRequested: false,
  },
  {
    id: 'PC-008',
    sqlId: 'qrs345tuv678',
    schema: 'APP',
    instanceName: 'PROD-DB1',
    prevPlanHash: '11112222',
    currPlanHash: '33334444',
    prevElapsed: 890,
    currElapsed: 620,
    changeRate: -30.3,
    detectedAt: '2026-04-03T05:30:00Z',
    impact: 'improved',
    sqlText: 'SELECT s.ship_id, s.tracking_no, o.order_id, o.order_date\nFROM SHIPMENTS s\nJOIN ORDERS o ON s.order_id = o.order_id\nWHERE s.ship_date >= TRUNC(SYSDATE) - 7',
    prevPlan: `Plan hash value: 11112222
------------------------------------------------------------------
| Id | Operation                    | Name            | Rows | Cost |
------------------------------------------------------------------
|  0 | SELECT STATEMENT             |                 |  800 |  650 |
|  1 |  HASH JOIN                   |                 |  800 |  650 |
|  2 |   TABLE ACCESS FULL          | SHIPMENTS       |  20K |  420 |
|  3 |   TABLE ACCESS FULL          | ORDERS          | 100K |  220 |
------------------------------------------------------------------`,
    currPlan: `Plan hash value: 33334444
------------------------------------------------------------------
| Id | Operation                    | Name            | Rows | Cost |
------------------------------------------------------------------
|  0 | SELECT STATEMENT             |                 |  800 |  280 |
|  1 |  NESTED LOOPS                |                 |  800 |  280 |
|  2 |   INDEX RANGE SCAN           | IDX_SHIP_DATE   |  800 |   12 |
|  3 |   TABLE ACCESS BY INDEX ROWID| ORDERS          |    1 |    1 |
------------------------------------------------------------------`,
    planHistory: [
      { time: '04-03 02:00', elapsed: 880, planHash: '11112222' },
      { time: '04-03 03:00', elapsed: 900, planHash: '11112222' },
      { time: '04-03 04:00', elapsed: 890, planHash: '11112222' },
      { time: '04-03 05:00', elapsed: 620, planHash: '33334444' },
    ],
    spmFixed: false,
    tuningRequested: false,
  },
  // 변화없음 2건
  {
    id: 'PC-009',
    sqlId: 'wxy901zab234',
    schema: 'HR',
    instanceName: 'PROD-DB1',
    prevPlanHash: '55556666',
    currPlanHash: '77778888',
    prevElapsed: 340,
    currElapsed: 355,
    changeRate: 4.4,
    detectedAt: '2026-04-03T04:00:00Z',
    impact: 'neutral',
    sqlText: 'SELECT department_id, COUNT(*) emp_count, AVG(salary) avg_sal\nFROM EMPLOYEES\nWHERE status = :status\nGROUP BY department_id',
    prevPlan: `Plan hash value: 55556666
------------------------------------------------------------------
| Id | Operation                    | Name            | Rows | Cost |
------------------------------------------------------------------
|  0 | SELECT STATEMENT             |                 |   50 |  120 |
|  1 |  HASH GROUP BY               |                 |   50 |  120 |
|  2 |   INDEX RANGE SCAN           | IDX_EMP_STAT    | 8000 |   45 |
------------------------------------------------------------------`,
    currPlan: `Plan hash value: 77778888
------------------------------------------------------------------
| Id | Operation                    | Name            | Rows | Cost |
------------------------------------------------------------------
|  0 | SELECT STATEMENT             |                 |   50 |  135 |
|  1 |  HASH GROUP BY               |                 |   50 |  135 |
|  2 |   INDEX FAST FULL SCAN       | IDX_EMP_STAT2   | 8000 |   60 |
------------------------------------------------------------------`,
    planHistory: [
      { time: '04-03 01:00', elapsed: 335, planHash: '55556666' },
      { time: '04-03 02:00', elapsed: 345, planHash: '55556666' },
      { time: '04-03 03:00', elapsed: 340, planHash: '55556666' },
      { time: '04-03 04:00', elapsed: 355, planHash: '77778888' },
      { time: '04-03 05:00', elapsed: 350, planHash: '77778888' },
    ],
    spmFixed: false,
    tuningRequested: false,
  },
  {
    id: 'PC-010',
    sqlId: 'cde567fgh890',
    schema: 'APP',
    instanceName: 'PROD-DB2',
    prevPlanHash: '99990000',
    currPlanHash: '11110000',
    prevElapsed: 1500,
    currElapsed: 1480,
    changeRate: -1.3,
    detectedAt: '2026-04-03T03:40:00Z',
    impact: 'neutral',
    sqlText: 'SELECT o.order_id, o.total_amount, o.status\nFROM ORDERS o\nWHERE o.customer_id = :cust_id\nAND o.order_date >= ADD_MONTHS(SYSDATE, -12)\nORDER BY o.order_date DESC',
    prevPlan: `Plan hash value: 99990000
------------------------------------------------------------------
| Id | Operation                    | Name            | Rows | Cost |
------------------------------------------------------------------
|  0 | SELECT STATEMENT             |                 |   50 |  180 |
|  1 |  SORT ORDER BY               |                 |   50 |  180 |
|  2 |   INDEX RANGE SCAN           | IDX_ORD_CUST    |   50 |   12 |
------------------------------------------------------------------`,
    currPlan: `Plan hash value: 11110000
------------------------------------------------------------------
| Id | Operation                    | Name            | Rows | Cost |
------------------------------------------------------------------
|  0 | SELECT STATEMENT             |                 |   50 |  175 |
|  1 |  SORT ORDER BY               |                 |   50 |  175 |
|  2 |   INDEX RANGE SCAN           | IDX_ORD_CUST_DT |   50 |   10 |
------------------------------------------------------------------`,
    planHistory: [
      { time: '04-03 00:00', elapsed: 1510, planHash: '99990000' },
      { time: '04-03 01:00', elapsed: 1490, planHash: '99990000' },
      { time: '04-03 02:00', elapsed: 1505, planHash: '99990000' },
      { time: '04-03 03:00', elapsed: 1480, planHash: '11110000' },
      { time: '04-03 04:00', elapsed: 1485, planHash: '11110000' },
    ],
    spmFixed: false,
    tuningRequested: false,
  },
]
