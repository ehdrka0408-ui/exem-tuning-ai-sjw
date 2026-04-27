export interface ExplainPlanResult {
  planText: string
  cost: number
  rows: number
  warnings: { level: 'warning' | 'danger'; message: string }[]
}

export const mockExplainPlans: Record<string, ExplainPlanResult> = {
  // TABLE ACCESS FULL 포함
  default: {
    planText: `Plan hash value: 29384756
--------------------------------------------------------------------------
| Id | Operation                     | Name            | Rows  |  Cost |
--------------------------------------------------------------------------
|  0 | SELECT STATEMENT              |                 | 50000 | 12840 |
|  1 |  SORT ORDER BY                |                 | 50000 | 12840 |
|  2 |   HASH JOIN                   |                 | 50000 | 12200 |
|  3 |    TABLE ACCESS FULL          | ORDER_HIST      |  100K |  8200 |
|  4 |    TABLE ACCESS FULL          | CUSTOMERS       |   50K |  3800 |
--------------------------------------------------------------------------`,
    cost: 12840,
    rows: 50000,
    warnings: [
      { level: 'danger', message: 'TABLE ACCESS FULL on ORDER_HIST (100K rows)' },
      { level: 'danger', message: 'TABLE ACCESS FULL on CUSTOMERS (50K rows)' },
      { level: 'warning', message: 'HASH JOIN — 대량 조인으로 메모리 사용량 주의' },
    ],
  },

  // 양호한 실행계획
  good: {
    planText: `Plan hash value: 48291037
--------------------------------------------------------------------------
| Id | Operation                      | Name            | Rows  |  Cost |
--------------------------------------------------------------------------
|  0 | SELECT STATEMENT               |                 |   200 |    85 |
|  1 |  NESTED LOOPS                  |                 |   200 |    85 |
|  2 |   INDEX RANGE SCAN             | IDX_EMP_DEPT    |   200 |    12 |
|  3 |   TABLE ACCESS BY INDEX ROWID  | DEPARTMENTS     |     1 |     1 |
--------------------------------------------------------------------------`,
    cost: 85,
    rows: 200,
    warnings: [],
  },

  // Cartesian Product 포함
  cartesian: {
    planText: `Plan hash value: 77382910
--------------------------------------------------------------------------
| Id | Operation                     | Name            | Rows  |  Cost |
--------------------------------------------------------------------------
|  0 | SELECT STATEMENT              |                 |  500M | 99999 |
|  1 |  MERGE JOIN CARTESIAN         |                 |  500M | 99999 |
|  2 |   TABLE ACCESS FULL           | PRODUCTS        |   10K |   320 |
|  3 |   BUFFER SORT                 |                 |   50K | 99500 |
|  4 |    TABLE ACCESS FULL          | ORDER_ITEMS     |   50K |  1200 |
--------------------------------------------------------------------------`,
    cost: 99999,
    rows: 500000000,
    warnings: [
      { level: 'danger', message: 'MERGE JOIN CARTESIAN — 카테시안 곱 발생 (500M rows)' },
      { level: 'danger', message: 'TABLE ACCESS FULL on PRODUCTS' },
      { level: 'danger', message: 'TABLE ACCESS FULL on ORDER_ITEMS' },
    ],
  },
}
