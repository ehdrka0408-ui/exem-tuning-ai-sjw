// 복수 튜닝안 mock 데이터

export type TuningType = 'index' | 'hint' | 'rewrite'
export type VerifyType = 'actual' | 'estimated'

export interface TuningPlan {
  id: string
  label: string
  types: TuningType[]
  verifyType: VerifyType
  improvementRate: number
  summary: string
  rationale?: string[]  // AI 분석 근거 (단계별)
  // 검증 결과
  originalElapsed: number
  tunedElapsed: number
  originalBuffers: number
  tunedBuffers: number
  originalDiskReads: number
  tunedDiskReads: number
  // 실행계획
  originalPlanText: string
  tunedPlanText: string
  // SQL
  tunedSqlText?: string
  // 인덱스 관련
  indexDdl?: string
  indexDdls?: { name: string; ddl: string }[]
  // 바인드셋 참조
  bindSetId?: string
}

export interface WorkRecommendation {
  workItemId: string
  selectedPlanId: string
  plans: TuningPlan[]
}

export const workRecommendations: Record<string, WorkRecommendation> = {
  'WI-2024-004': {
    workItemId: 'WI-2024-004',
    selectedPlanId: 'WI-2024-004-A',
    plans: [
      {
        id: 'WI-2024-004-A',
        label: '인덱스안',
        types: ['index', 'hint', 'rewrite'],
        verifyType: 'estimated',
        improvementRate: -80,
        bindSetId: 'BS-004-1',
        summary: 'ORDER_ITEMS 테이블에 복합 인덱스 IDX_OI_PROD_QTY(product_id, quantity) 생성 + WINDOW SORT PUSHED RANK 최적화 Rewrite + 힌트 추가',
        rationale: [
          'ORDER_ITEMS(200,000건) FULL TABLE SCAN 후 PRODUCTS(5,000건)와 HASH JOIN 수행 — Cost 5,400으로 전체 비용의 75% 차지',
          'GROUP BY + RANK() 조합에서 WINDOW SORT가 50,000건 전체를 정렬 — Top 50만 필요하므로 PUSHED RANK 최적화 가능',
          'IDX_OI_PROD_QTY(product_id, quantity) 커버링 인덱스 생성 시 INDEX FAST FULL SCAN으로 테이블 액세스 제거, Cost 3,800 → 350 (91% 감소)',
          'WINDOW SORT → WINDOW SORT PUSHED RANK 전환으로 정렬 대상 50,000 → 5,000건 축소, 메모리 사용량 90% 감소',
          '종합 효과: Cost 7,200 → 1,200 (83% 감소), Buffer Gets 290만 → 35만으로 대폭 개선',
        ],
        originalElapsed: 27800,
        tunedElapsed: 5500,
        originalBuffers: 2900000,
        tunedBuffers: 350000,
        originalDiskReads: 175000,
        tunedDiskReads: 22000,
        originalPlanText: `SQL_ID  t9u0v1w2x3y4z, child number 0
Plan hash value: 3847261590

-----------------------------------------------------------------------------------------------------------
| Id  | Operation                      | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |               |    1 |       |    50 |00:00:03.60 |    81K |
|   1 |  VIEW                         |               |    1 |    50 |    50 |00:00:03.60 |     6K |
|   2 |   WINDOW SORT                 |               |    1 | 50000 | 50000 |00:00:03.60 |    11K |
|   3 |    SORT GROUP BY              |               |    1 | 50000 | 50000 |00:00:03.40 |    10K |
|*  4 |     HASH JOIN                 |               |    1 |200000 |200000 |00:00:02.70 |    24K |
|   5 |      TABLE ACCESS FULL        | PRODUCTS      |    1 |  5000 |  5000 |00:00:00.20 |    820 |
|   6 |      TABLE ACCESS FULL        | ORDER_ITEMS   |    1 |200000 |200000 |00:00:01.90 |    23K |
-----------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  4 - access("A"."ID"="B"."REF_ID")`,
        tunedPlanText: `SQL_ID  t9u0v1w2x3y4z, child number 1 (예상)
Plan hash value: 8291034756

-----------------------------------------------------------------------------------------------------------------
| Id  | Operation                          | Name             | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                 |    1 |       |    50 |00:00:00.60 |    32K |
|   1 |  VIEW                             |                 |    1 |    50 |    50 |00:00:00.60 |    965 |
|   2 |   WINDOW SORT PUSHED RANK         |                 |    1 |  5000 |  5000 |00:00:00.60 |     1K |
|   3 |    HASH GROUP BY                  |                 |    1 |  5000 |  5000 |00:00:00.55 |     1K |
|*  4 |     HASH JOIN                     |                 |    1 | 50000 | 50000 |00:00:00.45 |     6K |
|   5 |      TABLE ACCESS FULL            | PRODUCTS        |    1 |  5000 |  5000 |00:00:00.20 |    820 |
|*  6 |      INDEX FAST FULL SCAN         | IDX_OI_PROD_QTY |    1 |200000 |200000 |00:00:00.17 |    20K |
-----------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  4 - access("A"."ID"="B"."REF_ID")
  6 - access("IDX_OI_PROD_QTY"."STATUS"='Y')`,
        tunedSqlText: `SELECT * FROM (
  SELECT p.product_id, p.product_name,
         SUM(oi.quantity) total_qty,
         RANK() OVER (ORDER BY SUM(oi.quantity) DESC) rnk
    FROM PRODUCTS p
    JOIN ORDER_ITEMS oi ON p.product_id = oi.product_id
   GROUP BY p.product_id, p.product_name
) WHERE rnk <= 50`,
        indexDdl: 'CREATE INDEX IDX_OI_PROD_QTY ON ORDER_ITEMS(product_id, quantity) TABLESPACE IDX_TS ONLINE;',
        indexDdls: [
          { name: 'IDX_OI_PROD_QTY', ddl: 'CREATE INDEX IDX_OI_PROD_QTY ON ORDER_ITEMS(product_id, quantity) TABLESPACE IDX_TS ONLINE;' },
          { name: 'IDX_OI_STATUS', ddl: 'CREATE INDEX IDX_OI_STATUS ON ORDER_ITEMS(status, created_at) TABLESPACE IDX_TS ONLINE;' },
        ],
      },
      {
        id: 'WI-2024-004-B',
        label: '차선안',
        types: ['hint', 'rewrite'],
        verifyType: 'actual',
        improvementRate: -38,
        bindSetId: 'BS-004-2',
        summary: '힌트를 통한 HASH GROUP BY 변환 + WINDOW SORT PUSHED RANK 최적화 (기존 인덱스만 활용)',
        rationale: [
          'SORT GROUP BY 방식이 50,000건 정렬 수행 — 메모리 소비 과다, TEMP 사용 가능성 있음',
          'USE_HASH_GRP_BY 힌트로 HASH GROUP BY 전환 시 정렬 없이 해시 기반 집계 가능 — Cost 6,800 → 4,200',
          'WINDOW SORT PUSHED RANK 최적화로 상위 50건만 추적하여 정렬 비용 추가 절감',
          '인덱스 생성 없이 힌트만으로 38% 개선 — DDL 변경 불가 환경에 적합한 대안',
        ],
        originalElapsed: 27800,
        tunedElapsed: 17200,
        originalBuffers: 2900000,
        tunedBuffers: 1800000,
        originalDiskReads: 175000,
        tunedDiskReads: 108000,
        originalPlanText: `SQL_ID  t9u0v1w2x3y4z, child number 0
Plan hash value: 3847261590

-----------------------------------------------------------------------------------------------------------
| Id  | Operation                      | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |               |    1 |       |    50 |00:00:03.60 |    81K |
|   1 |  VIEW                         |               |    1 |    50 |    50 |00:00:03.60 |     6K |
|   2 |   WINDOW SORT                 |               |    1 | 50000 | 50000 |00:00:03.60 |    11K |
|   3 |    SORT GROUP BY              |               |    1 | 50000 | 50000 |00:00:03.40 |    10K |
|*  4 |     HASH JOIN                 |               |    1 |200000 |200000 |00:00:02.70 |    24K |
|   5 |      TABLE ACCESS FULL        | PRODUCTS      |    1 |  5000 |  5000 |00:00:00.20 |    820 |
|   6 |      TABLE ACCESS FULL        | ORDER_ITEMS   |    1 |200000 |200000 |00:00:01.90 |    23K |
-----------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  4 - access("A"."ID"="B"."REF_ID")`,
        tunedPlanText: `SQL_ID  t9u0v1w2x3y4z, child number 2
Plan hash value: 4192038756

-----------------------------------------------------------------------------------------------------------------
| Id  | Operation                          | Name             | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                 |    1 |       |    50 |00:00:02.20 |    62K |
|   1 |  VIEW                             |                 |    1 |    50 |    50 |00:00:02.20 |     4K |
|   2 |   WINDOW SORT PUSHED RANK         |                 |    1 |  5000 |  5000 |00:00:02.20 |     4K |
|   3 |    HASH GROUP BY                  |                 |    1 |  5000 |  5000 |00:00:02.10 |     4K |
|*  4 |     HASH JOIN                     |                 |    1 |200000 |200000 |00:00:01.90 |    23K |
|   5 |      TABLE ACCESS FULL            | PRODUCTS        |    1 |  5000 |  5000 |00:00:00.20 |    820 |
|   6 |      TABLE ACCESS FULL            | ORDER_ITEMS     |    1 |200000 |200000 |00:00:01.70 |    23K |
-----------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  4 - access("A"."ID"="B"."REF_ID")`,
        tunedSqlText: `SELECT /*+ USE_HASH_GRP_BY NO_INDEX(oi) */
       * FROM (
  SELECT p.product_id, p.product_name,
         SUM(oi.quantity) total_qty,
         RANK() OVER (ORDER BY SUM(oi.quantity) DESC) rnk
    FROM PRODUCTS p
    JOIN ORDER_ITEMS oi ON p.product_id = oi.product_id
   GROUP BY p.product_id, p.product_name
) WHERE rnk <= 50`,
      },
    ],
  },

  'WI-2024-005': {
    workItemId: 'WI-2024-005',
    selectedPlanId: 'WI-2024-005-A',
    plans: [
      {
        id: 'WI-2024-005-A',
        label: '인덱스안',
        types: ['index', 'rewrite'],
        verifyType: 'estimated',
        bindSetId: 'BS-005-1',
        improvementRate: -85,
        summary: 'Scalar Subquery → JOIN 변환 + 복합 인덱스 IDX_ORD_CUST_DT(customer_id, order_date) 생성',
        rationale: [
          'CUSTOMERS(10,000건) 각 행마다 ORDERS(50,000건) FULL TABLE SCAN을 스칼라 서브쿼리로 반복 수행 — 실질적 10,000 × 50,000 = 5억건 액세스',
          'ORDERS 테이블에 customer_id 기반 인덱스 부재로 매번 FULL SCAN 발생, Cost 6,000 반복',
          'Scalar Subquery → LEFT JOIN 변환으로 NESTED LOOPS 방식 적용, ORDERS 테이블 1회 스캔으로 전환',
          'IDX_ORD_CUST_DT(customer_id, order_date) 복합 인덱스로 INDEX RANGE SCAN 가능 — 고객당 평균 5건만 액세스',
          '종합 효과: Cost 6,200 → 850 (86% 감소), Elapsed 19.5초 → 2.9초',
        ],
        originalElapsed: 19500,
        tunedElapsed: 2900,
        originalBuffers: 1850000,
        tunedBuffers: 185000,
        originalDiskReads: 252000,
        tunedDiskReads: 18000,
        originalPlanText: `SQL_ID  b5c6d7e8f9g0h, child number 0
Plan hash value: 1638472950

-----------------------------------------------------------------------------------------------------------
| Id  | Operation                      | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |               |    1 |       | 10000 |00:00:03.10 |    16K |
|   1 |  TABLE ACCESS FULL            | CUSTOMERS     |    1 | 10000 | 10000 |00:00:00.10 |     1K |
|*  2 |   SORT AGGREGATE              |               |    1 |     1 |     1 |00:00:00.00 |      1 |
|*  3 |    TABLE ACCESS FULL          | ORDERS        |    1 | 50000 | 50000 |00:00:03.00 |    10K |
-----------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - filter(NULL IS NOT NULL)
  3 - filter("ORDERS"."DEL_YN"='N')`,
        tunedPlanText: `SQL_ID  b5c6d7e8f9g0h, child number 1 (예상)
Plan hash value: 7382914650

----------------------------------------------------------------------------------------------------------------
| Id  | Operation                          | Name            | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
----------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                |    1 |       | 10000 |00:00:00.42 |     4K |
|   1 |  NESTED LOOPS                     |                |    1 | 10000 | 10000 |00:00:00.42 |     2K |
|   2 |   TABLE ACCESS FULL               | CUSTOMERS      |    1 | 10000 | 10000 |00:00:00.10 |     1K |
|*  3 |   INDEX RANGE SCAN                | IDX_ORD_CUST_DT|    1 |     1 |     1 |00:00:00.00 |      1 |
----------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  3 - access("IDX_ORD_CUST_DT"."KEY_COL">=:B1)`,
        tunedSqlText: `SELECT c.customer_id, c.customer_name, COUNT(o.order_id) recent_orders
  FROM CUSTOMERS c
  LEFT JOIN ORDERS o ON o.customer_id = c.customer_id
                     AND o.order_date > SYSDATE - 90
 GROUP BY c.customer_id, c.customer_name`,
        indexDdl: 'CREATE INDEX IDX_ORD_CUST_DT ON ORDERS(customer_id, order_date) TABLESPACE IDX_TS ONLINE;',
      },
      {
        id: 'WI-2024-005-B',
        label: '차선안',
        types: ['rewrite'],
        verifyType: 'actual',
        improvementRate: -52,
        summary: 'Scalar Subquery → EXISTS 변환으로 불필요한 Full Scan 감소 (인덱스 미생성)',
        rationale: [
          '스칼라 서브쿼리가 CUSTOMERS 행마다 ORDERS FULL SCAN 반복 — 10,000회 × Cost 6,000',
          'LEFT JOIN + GROUP BY 방식으로 변환하여 ORDERS 1회 FULL SCAN으로 전환, VW_GBC_1 뷰 생성',
          'HASH JOIN OUTER로 CUSTOMERS와 집계 결과를 1회 조인 — Cost 6,200 → 3,200 (48% 감소)',
          '인덱스 없이 SQL 구조 변경만으로 52% 개선 — DDL 권한 없는 환경에서 적용 가능',
        ],
        originalElapsed: 19500,
        tunedElapsed: 9400,
        originalBuffers: 1850000,
        tunedBuffers: 890000,
        originalDiskReads: 252000,
        tunedDiskReads: 121000,
        originalPlanText: `SQL_ID  b5c6d7e8f9g0h, child number 0
Plan hash value: 1638472950

-----------------------------------------------------------------------------------------------------------
| Id  | Operation                      | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |               |    1 |       | 10000 |00:00:03.10 |    16K |
|   1 |  TABLE ACCESS FULL            | CUSTOMERS     |    1 | 10000 | 10000 |00:00:00.10 |     1K |
|*  2 |   SORT AGGREGATE              |               |    1 |     1 |     1 |00:00:00.00 |      1 |
|*  3 |    TABLE ACCESS FULL          | ORDERS        |    1 | 50000 | 50000 |00:00:03.00 |    10K |
-----------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - filter(NULL IS NOT NULL)
  3 - filter("ORDERS"."DEL_YN"='N')`,
        tunedPlanText: `SQL_ID  b5c6d7e8f9g0h, child number 3
Plan hash value: 2918374651

---------------------------------------------------------------------------------------------------------------
| Id  | Operation                          | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
---------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |               |    1 |       | 10000 |00:00:01.60 |    21K |
|   1 |  HASH JOIN OUTER                  |               |    1 | 10000 | 10000 |00:00:01.60 |     4K |
|   2 |   TABLE ACCESS FULL               | CUSTOMERS     |    1 | 10000 | 10000 |00:00:00.10 |     1K |
|   3 |   VIEW                            | VW_GBC_1      |    1 | 10000 | 10000 |00:00:01.40 |     3K |
|   4 |    HASH GROUP BY                  |               |    1 | 10000 | 10000 |00:00:01.40 |     3K |
|   5 |     TABLE ACCESS FULL             | ORDERS        |    1 | 50000 | 50000 |00:00:01.20 |     7K |
---------------------------------------------------------------------------------------------------------------`,
        tunedSqlText: `SELECT c.customer_id, c.customer_name,
       NVL(o_grp.cnt, 0) recent_orders
  FROM CUSTOMERS c
  LEFT JOIN (
    SELECT customer_id, COUNT(*) cnt
      FROM ORDERS
     WHERE order_date > SYSDATE - 90
     GROUP BY customer_id
  ) o_grp ON c.customer_id = o_grp.customer_id`,
      },
    ],
  },

  'WI-2024-006': {
    workItemId: 'WI-2024-006',
    selectedPlanId: 'WI-2024-006-A',
    plans: [
      {
        id: 'WI-2024-006-A',
        label: '튜닝안 A',
        types: ['hint'],
        verifyType: 'actual',
        bindSetId: 'BS-006-1',
        improvementRate: -75,
        summary: '/*+ INDEX(e IDX_EMP_MGR) */ 힌트 추가, CONNECT BY 탐색 시 Full Scan → Index 활용',
        rationale: [
          'CONNECT BY WITH FILTERING 수행 시 EMP(10,000건) FULL TABLE SCAN이 2회 발생 — 루트 탐색 1회 + 재귀 탐색 1회',
          '계층 깊이 평균 5레벨에서 매 레벨마다 EMP FULL SCAN 반복 — 실질 액세스 50,000건 이상',
          'INDEX(e IDX_EMP_MGR) 힌트로 manager_id 기반 INDEX RANGE SCAN 전환, 레벨당 평균 10건만 액세스',
          'CONNECT BY PUMP + INDEX RANGE SCAN 조합으로 Cost 4,800 → 1,200 (75% 감소), Buffer Gets 75% 절감',
        ],
        originalElapsed: 15200,
        tunedElapsed: 3800,
        originalBuffers: 1620000,
        tunedBuffers: 405000,
        originalDiskReads: 168000,
        tunedDiskReads: 42000,
        originalPlanText: `SQL_ID  i1j2k3l4m5n6o, child number 0
Plan hash value: 2957381640

----------------------------------------------------------------------------------------------------------------
| Id  | Operation                           | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
----------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                   |               |    1 |       |   500 |00:00:02.40 |    16K |
|   1 |  SORT ORDER BY                     |               |    1 |   500 |   500 |00:00:02.40 |     4K |
|*  2 |   CONNECT BY WITH FILTERING        |               |    1 |       |     1 |00:00:00.00 |      1 |
|   3 |    TABLE ACCESS FULL               | EMP           |    1 | 10000 | 10000 |00:00:01.90 |     4K |
|   4 |    NESTED LOOPS                    |               |    1 |       |     1 |00:00:00.00 |      1 |
|   5 |     CONNECT BY PUMP                |               |    1 |       |     1 |00:00:00.00 |      1 |
|   6 |     TABLE ACCESS FULL              | EMP           |    1 | 10000 | 10000 |00:00:01.90 |     4K |
----------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - filter(ROWNUM<=:B1)`,
        tunedPlanText: `SQL_ID  i1j2k3l4m5n6o, child number 1
Plan hash value: 8847291035

------------------------------------------------------------------------------------------------------------------
| Id  | Operation                             | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
------------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                     |               |    1 |       |   500 |00:00:00.60 |     3K |
|   1 |  SORT ORDER BY                       |               |    1 |   500 |   500 |00:00:00.60 |     1K |
|*  2 |   CONNECT BY WITH FILTERING          |               |    1 |       |     1 |00:00:00.00 |      1 |
|*  3 |    INDEX RANGE SCAN                  | IDX_EMP_MGR   |    1 | 10000 | 10000 |00:00:00.10 |     1K |
|   4 |     TABLE ACCESS BY INDEX ROWID      | EMP           |    1 |     1 |     1 |00:00:00.00 |      1 |
|   5 |    NESTED LOOPS                      |               |    1 |       |     1 |00:00:00.00 |      1 |
|   6 |     CONNECT BY PUMP                  |               |    1 |       |     1 |00:00:00.00 |      1 |
|*  7 |     INDEX RANGE SCAN                 | IDX_EMP_MGR   |    1 |    10 |    10 |00:00:00.00 |      2 |
|   8 |      TABLE ACCESS BY INDEX ROWID     | EMP           |    1 |    10 |    10 |00:00:00.00 |      3 |
------------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - filter(ROWNUM<=:B1)
  3 - access("IDX_EMP_MGR"."KEY_COL">=:B1)
  7 - access("IDX_EMP_MGR"."KEY_COL">=:B1)`,
        tunedSqlText: `SELECT /*+ INDEX(e IDX_EMP_MGR) */
       emp_id, manager_id, LEVEL,
       SYS_CONNECT_BY_PATH(last_name, '/') path
  FROM EMP e
 START WITH manager_id IS NULL
 CONNECT BY PRIOR employee_id = manager_id
 ORDER SIBLINGS BY last_name`,
      },
    ],
  },

  'WI-2024-007': {
    workItemId: 'WI-2024-007',
    selectedPlanId: 'WI-2024-007-A',
    plans: [
      {
        id: 'WI-2024-007-A',
        label: '인덱스안',
        types: ['index'],
        verifyType: 'estimated',
        improvementRate: -84,
        bindSetId: 'BS-007-1',
        summary: 'TRANSACTIONS 테이블에 IDX_TXN_ACCTID(account_id) 인덱스 생성, HASH JOIN → NESTED LOOPS OUTER 전환',
        rationale: [
          'TRANSACTIONS(800,000건) FULL TABLE SCAN 후 ACCOUNTS(5,000건)와 HASH JOIN OUTER — 빌드 테이블 대비 프로브 테이블 160배 과대',
          'account_id 기반 인덱스 부재로 HASH JOIN 강제 — PGA 메모리 대량 소비, TEMP 테이블스페이스 사용 위험',
          'IDX_TXN_ACCTID(account_id) 인덱스 생성으로 NESTED LOOPS OUTER 전환, 계정당 평균 160건만 INDEX RANGE SCAN',
          'HASH JOIN → NESTED LOOPS 전환으로 Cost 4,800 → 850 (82% 감소), 메모리 사용량 대폭 절감',
        ],
        originalElapsed: 12800,
        tunedElapsed: 2100,
        originalBuffers: 1340000,
        tunedBuffers: 168000,
        originalDiskReads: 144000,
        tunedDiskReads: 15000,
        originalPlanText: `SQL_ID  p7q8r9s0t1u2v, child number 0
Plan hash value: 3846192750

-----------------------------------------------------------------------------------------------------------
| Id  | Operation                      | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |               |    1 |       |  5000 |00:00:02.60 |   102K |
|   1 |  SORT GROUP BY                |               |    1 |  5000 |  5000 |00:00:02.60 |     5K |
|*  2 |   HASH JOIN OUTER             |               |    1 | 50000 | 50000 |00:00:02.40 |     9K |
|   3 |    TABLE ACCESS FULL          | ACCOUNTS      |    1 |  5000 |  5000 |00:00:00.40 |     1K |
|   4 |    TABLE ACCESS FULL          | TRANSACTIONS  |    1 |800000 |800000 |00:00:01.90 |    83K |
-----------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - access("A"."ID"="B"."REF_ID")`,
        tunedPlanText: `SQL_ID  p7q8r9s0t1u2v, child number 1 (예상)
Plan hash value: 9182734560

-----------------------------------------------------------------------------------------------------------------
| Id  | Operation                          | Name             | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                 |    1 |       |  5000 |00:00:00.46 |     4K |
|   1 |  SORT GROUP BY                    |                 |    1 |  5000 |  5000 |00:00:00.46 |     1K |
|   2 |   NESTED LOOPS OUTER              |                 |    1 |  5000 |  5000 |00:00:00.42 |     1K |
|   3 |    TABLE ACCESS FULL              | ACCOUNTS        |    1 |  5000 |  5000 |00:00:00.40 |     1K |
|*  4 |    INDEX RANGE SCAN               | IDX_TXN_ACCTID  |    1 |    10 |    10 |00:00:00.00 |      2 |
-----------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  4 - access("IDX_TXN_ACCTID"."KEY_COL">=:B1)`,
        indexDdl: 'CREATE INDEX IDX_TXN_ACCTID ON TRANSACTIONS(account_id) TABLESPACE IDX_TS ONLINE;',
        tunedSqlText: `/* 인덱스 생성 후 동일 SQL — 실행계획만 변경됨 */
SELECT a.account_no, a.balance,
       NVL(SUM(t.amount), 0) total_txn,
       COUNT(t.txn_id) txn_count
  FROM ACCOUNTS a
  LEFT JOIN TRANSACTIONS t ON a.account_id = t.account_id
 GROUP BY a.account_no, a.balance`,
      },
      {
        id: 'WI-2024-007-B',
        label: '차선안',
        types: ['hint'],
        verifyType: 'actual',
        improvementRate: -45,
        summary: '/*+ USE_HASH(a t) SWAP_JOIN_INPUTS(a) */ 힌트로 해시 조인 순서 최적화 (인덱스 미생성)',
        rationale: [
          '기존 HASH JOIN에서 ACCOUNTS(5,000건)가 빌드, TRANSACTIONS(800,000건)가 프로브 — 빌드 테이블은 작지만 프로브 스캔 비용 과대',
          'SWAP_JOIN_INPUTS(a) 힌트로 빌드/프로브 순서 유지하면서 해시 영역 크기 최적화',
          'SORT GROUP BY → HASH GROUP BY 전환으로 정렬 비용 추가 절감, Cost 5,200 → 2,900 (44% 감소)',
          '인덱스 생성 없이 힌트만으로 45% 개선 — 운영 중 DDL 변경 불가 시 적용 가능한 대안',
        ],
        originalElapsed: 12800,
        tunedElapsed: 7040,
        originalBuffers: 1340000,
        tunedBuffers: 737000,
        originalDiskReads: 144000,
        tunedDiskReads: 79000,
        originalPlanText: `SQL_ID  p7q8r9s0t1u2v, child number 0
Plan hash value: 3846192750

-----------------------------------------------------------------------------------------------------------
| Id  | Operation                      | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |               |    1 |       |  5000 |00:00:02.60 |   102K |
|   1 |  SORT GROUP BY                |               |    1 |  5000 |  5000 |00:00:02.60 |     5K |
|*  2 |   HASH JOIN OUTER             |               |    1 | 50000 | 50000 |00:00:02.40 |     9K |
|   3 |    TABLE ACCESS FULL          | ACCOUNTS      |    1 |  5000 |  5000 |00:00:00.40 |     1K |
|   4 |    TABLE ACCESS FULL          | TRANSACTIONS  |    1 |800000 |800000 |00:00:01.90 |    83K |
-----------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - access("A"."ID"="B"."REF_ID")`,
        tunedPlanText: `SQL_ID  p7q8r9s0t1u2v, child number 2
Plan hash value: 5019283746

-----------------------------------------------------------------------------------------------------------------
| Id  | Operation                          | Name             | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                 |    1 |       |  5000 |00:00:01.45 |    95K |
|   1 |  HASH GROUP BY                    |                 |    1 |  5000 |  5000 |00:00:01.45 |     3K |
|*  2 |   HASH JOIN OUTER                 |                 |    1 | 50000 | 50000 |00:00:01.30 |     7K |
|   3 |    TABLE ACCESS FULL              | ACCOUNTS        |    1 |  5000 |  5000 |00:00:00.40 |     1K |
|   4 |    TABLE ACCESS FULL              | TRANSACTIONS    |    1 |800000 |800000 |00:00:00.80 |    81K |
-----------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - access("A"."ID"="B"."REF_ID")`,
        tunedSqlText: `SELECT /*+ USE_HASH(a t) SWAP_JOIN_INPUTS(a) */
       a.account_no, a.balance,
       NVL(SUM(t.amount), 0) total_txn,
       COUNT(t.txn_id) txn_count
  FROM ACCOUNTS a
  LEFT JOIN TRANSACTIONS t ON a.account_id = t.account_id
 GROUP BY a.account_no, a.balance`,
      },
    ],
  },

  'WI-2024-008': {
    workItemId: 'WI-2024-008',
    selectedPlanId: 'WI-2024-008-A',
    plans: [
      {
        id: 'WI-2024-008-A',
        label: '튜닝안 A',
        types: ['hint'],
        verifyType: 'actual',
        improvementRate: -87,
        bindSetId: 'BS-008-1',
        summary: 'SQL Profile을 통해 기존 최적 플랜(NESTED LOOPS SEMI + INDEX) 복구',
        rationale: [
          '통계 정보 변경 후 실행계획이 HASH JOIN SEMI로 변경 — ORDERS(50,000건) FULL SCAN + ORDER_ITEMS(200,000건) FULL SCAN 발생',
          '기존 최적 플랜은 IDX_ORD_STATUS로 2,000건만 액세스 후 NESTED LOOPS SEMI — Cost 580 vs 현재 4,200',
          'SQL Profile 등록으로 LEADING(o) USE_NL(oi) INDEX(o IDX_ORD_STATUS) 힌트 세트 고정',
          '실행계획 복구로 Cost 4,200 → 580 (86% 감소), UPDATE 대상 행 직접 인덱스 접근으로 Lock 경합 감소',
          'SQL Profile 방식은 SQL 텍스트 변경 없이 적용 가능 — 애플리케이션 배포 불필요',
        ],
        originalElapsed: 8900,
        tunedElapsed: 1200,
        originalBuffers: 950000,
        tunedBuffers: 95000,
        originalDiskReads: 96000,
        tunedDiskReads: 8000,
        originalPlanText: `SQL_ID  w3x4y5z6a7b8c, child number 0
Plan hash value: 4738291560

-----------------------------------------------------------------------------------------------------------
| Id  | Operation                      | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------
|   0 | UPDATE STATEMENT              |               |    1 |       |     1 |00:00:02.10 |    37K |
|   1 |  UPDATE                       | ORDERS        |    1 |       |     1 |00:00:00.00 |      1 |
|*  2 |   HASH JOIN SEMI              |               |    1 |  2000 |  2000 |00:00:02.10 |     4K |
|   3 |    TABLE ACCESS FULL          | ORDERS        |    1 | 50000 | 50000 |00:00:01.40 |     7K |
|   4 |    VIEW                       | VW_SQ_1       |    1 |  1000 |  1000 |00:00:00.60 |     1K |
|   5 |     SORT GROUP BY             |               |    1 |  1000 |  1000 |00:00:00.60 |     1K |
|   6 |      TABLE ACCESS FULL        | ORDER_ITEMS   |    1 |200000 |200000 |00:00:00.40 |    21K |
-----------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - access("A"."ID"="B"."REF_ID")`,
        tunedPlanText: `SQL_ID  w3x4y5z6a7b8c, child number 1
Plan hash value: 2918374650

----------------------------------------------------------------------------------------------------------------
| Id  | Operation                          | Name            | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
----------------------------------------------------------------------------------------------------------------
|   0 | UPDATE STATEMENT                  |                |    1 |       |     1 |00:00:00.29 |     2K |
|   1 |  UPDATE                           | ORDERS         |    1 |       |     1 |00:00:00.00 |      1 |
|*  2 |   NESTED LOOPS SEMI               |                |    1 |  2000 |  2000 |00:00:00.29 |    664 |
|*  3 |    INDEX RANGE SCAN               | IDX_ORD_STATUS |    1 |  2000 |  2000 |00:00:00.00 |    212 |
|   4 |     TABLE ACCESS BY INDEX ROWID   | ORDERS         |    1 |  2000 |  2000 |00:00:00.01 |    224 |
|*  5 |    INDEX RANGE SCAN               | IDX_OI_ORDID   |    1 |     4 |     4 |00:00:00.00 |      1 |
----------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - access("OUTER"."ID"="INNER"."REF_ID")
  3 - access("IDX_ORD_STATUS"."KEY_COL">=:B1)
  5 - access("IDX_OI_ORDID"."KEY_COL">=:B1)`,
        tunedSqlText: `UPDATE /*+ LEADING(o) USE_NL(oi) INDEX(o IDX_ORD_STATUS) */
       ORDERS SET status = 'SHIPPED', ship_date = SYSDATE
 WHERE order_id IN (
         SELECT /*+ INDEX(oi IDX_OI_ORDID) */
                order_id
           FROM ORDER_ITEMS oi
          WHERE oi.quantity > 0
          GROUP BY order_id
         HAVING SUM(oi.quantity) > :min_qty
       )`,
      },
    ],
  },

  // 승인완료 작업들 (WI-2024-003, WI-2024-015)
  'WI-2024-003': {
    workItemId: 'WI-2024-003',
    selectedPlanId: 'WI-2024-003-A',
    plans: [
      {
        id: 'WI-2024-003-A',
        label: '튜닝안 A',
        types: ['hint'],
        verifyType: 'actual',
        improvementRate: -85,
        bindSetId: 'BS-003-1',
        summary: '/*+ LEADING(a) USE_NL(t) INDEX(t IDX_TXN_ACCTID) */ 힌트 추가로 TRANSACTIONS Full Scan 제거',
        rationale: [
          'TRANSACTIONS(800,000건) FULL TABLE SCAN 후 ACCOUNTS(5,000건)와 HASH JOIN — 프로브 테이블 비용 8,500으로 전체의 87%',
          '옵티마이저가 HASH JOIN 선택했으나, ACCOUNTS 드라이빙 시 계정당 160건만 필요 — NL 조인이 유리',
          'LEADING(a) USE_NL(t) 힌트로 ACCOUNTS → TRANSACTIONS 순서 강제, INDEX(t IDX_TXN_ACCTID)로 인덱스 액세스',
          'HASH JOIN → NESTED LOOPS 전환으로 Cost 9,800 → 1,400 (86% 감소), Buffer Gets 410만 → 41만',
          '대량 동시 실행 환경에서 PGA 메모리 절감 효과 — 세션당 해시 영역 할당 불필요',
        ],
        originalElapsed: 41500,
        tunedElapsed: 6200,
        originalBuffers: 4100000,
        tunedBuffers: 410000,
        originalDiskReads: 304000,
        tunedDiskReads: 35000,
        originalPlanText: `SQL_ID  m3n4o5p6q7r8s, child number 0
Plan hash value: 4019283756

-----------------------------------------------------------------------------------------------------------
| Id  | Operation                      | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |               |    1 |       |  3200 |00:00:04.90 |   104K |
|   1 |  HASH JOIN                    |               |    1 |  3200 |  3200 |00:00:04.90 |     8K |
|   2 |   TABLE ACCESS FULL           | ACCOUNTS      |    1 |  5000 |  5000 |00:00:00.40 |     1K |
|   3 |   TABLE ACCESS FULL           | TRANSACTIONS  |    1 |800000 |800000 |00:00:04.25 |    87K |
-----------------------------------------------------------------------------------------------------------`,
        tunedPlanText: `SQL_ID  m3n4o5p6q7r8s, child number 1
Plan hash value: 5028374619

-----------------------------------------------------------------------------------------------------------------
| Id  | Operation                          | Name             | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                 |    1 |       |  3200 |00:00:00.70 |     4K |
|   1 |  NESTED LOOPS                     |                 |    1 |  3200 |  3200 |00:00:00.70 |     1K |
|   2 |   TABLE ACCESS BY INDEX ROWID     | ACCOUNTS        |    1 |  5000 |  5000 |00:00:00.40 |     1K |
|   3 |    INDEX FULL SCAN                | PK_ACCOUNTS     |    1 |  5000 |  5000 |00:00:00.06 |    596 |
|*  4 |   INDEX RANGE SCAN                | IDX_TXN_ACCTID  |    1 |     1 |     1 |00:00:00.00 |      1 |
|   5 |    TABLE ACCESS BY INDEX ROWID    | TRANSACTIONS    |    1 |     1 |     1 |00:00:00.00 |      2 |
-----------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  4 - access("IDX_TXN_ACCTID"."KEY_COL">=:B1)`,
        tunedSqlText: `SELECT /*+ LEADING(a) USE_NL(t) INDEX(t IDX_TXN_ACCTID) */
       t.txn_id, t.txn_date, a.account_no,
       DECODE(t.txn_type, 'C', 'Credit', 'D', 'Debit', 'Unknown') txn_desc,
       t.amount
  FROM TRANSACTIONS t, ACCOUNTS a
 WHERE t.account_id = a.account_id`,
      },
    ],
  },

  'WI-2024-015': {
    workItemId: 'WI-2024-015',
    selectedPlanId: 'WI-2024-015-A',
    plans: [
      {
        id: 'WI-2024-015-A',
        label: '인덱스안',
        types: ['index'],
        verifyType: 'estimated',
        improvementRate: -84,
        bindSetId: 'BS-015-1',
        summary: 'ORDERS 테이블에 IDX_ORD_TOTAL(total_amount) 인덱스 생성, Full Scan 제거',
        rationale: [
          'ORDERS 테이블(50,000건) FULL SCAN 후 CUSTOMERS(10,000건)와 HASH JOIN 수행 — 빌드 테이블 크기 과도',
          'WHERE 조건 o.total_amount > :min_amount의 선택도 4.8% → 인덱스 활용 시 2,400건만 액세스 가능',
          'IDX_ORD_TOTAL(total_amount) 인덱스 생성으로 INDEX RANGE SCAN 전환, Cost 5,400 → 420 (92% 감소)',
          'HASH JOIN → NESTED LOOPS 전환으로 메모리 사용량 대폭 감소, 대량 동시 실행 환경에 적합',
        ],
        originalElapsed: 11200,
        tunedElapsed: 1800,
        originalBuffers: 1100000,
        tunedBuffers: 132000,
        originalDiskReads: 120000,
        tunedDiskReads: 12000,
        originalPlanText: `SQL_ID  u5v6w7x8y9z0a, child number 0
Plan hash value: 4918273650

-----------------------------------------------------------------------------------------------------------
| Id  | Operation                      | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |               |    1 |       |  2400 |00:00:02.70 |    18K |
|*  1 |  HASH JOIN                    |               |    1 |  2400 |  2400 |00:00:02.70 |     5K |
|   2 |   TABLE ACCESS FULL           | ORDERS        |    1 | 50000 | 50000 |00:00:01.40 |     7K |
|   3 |   TABLE ACCESS FULL           | CUSTOMERS     |    1 | 10000 | 10000 |00:00:00.60 |     2K |
-----------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  1 - access("A"."ID"="B"."REF_ID")`,
        tunedPlanText: `SQL_ID  u5v6w7x8y9z0a, child number 1 (예상)
Plan hash value: 7381924650

-----------------------------------------------------------------------------------------------------------------
| Id  | Operation                          | Name             | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                 |    1 |       |  2400 |00:00:00.21 |     1K |
|   1 |  NESTED LOOPS                     |                 |    1 |  2400 |  2400 |00:00:00.21 |    576 |
|*  2 |   INDEX RANGE SCAN                | IDX_ORD_TOTAL   |    1 |  2400 |  2400 |00:00:00.00 |    252 |
|   3 |    TABLE ACCESS BY INDEX ROWID    | ORDERS          |    1 |  2400 |  2400 |00:00:00.02 |    280 |
|   4 |   TABLE ACCESS BY INDEX ROWID     | CUSTOMERS       |    1 |     1 |     1 |00:00:00.00 |      1 |
|*  5 |    INDEX UNIQUE SCAN              | PK_CUSTOMERS    |    1 |     1 |     1 |00:00:00.00 |      1 |
-----------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - access("IDX_ORD_TOTAL"."KEY_COL">=:B1)
  5 - access("PK_CUSTOMERS"."ID"=:B1)`,
        indexDdl: 'CREATE INDEX IDX_ORD_TOTAL ON ORDERS(total_amount) TABLESPACE IDX_TS ONLINE;',
        tunedSqlText: `/* 인덱스 생성 후 동일 SQL — 실행계획만 변경됨 */
SELECT o.order_id, o.order_date, o.total_amount,
       c.customer_name, c.credit_limit
  FROM ORDERS o
  JOIN CUSTOMERS c ON o.customer_id = c.customer_id
 WHERE o.total_amount > :min_amount
 ORDER BY o.order_date DESC`,
      },
      {
        id: 'WI-2024-015-B',
        label: '차선안',
        types: ['hint'],
        verifyType: 'actual',
        improvementRate: -62,
        bindSetId: 'BS-015-2',
        summary: '/*+ LEADING(o) USE_NL(c) */ 힌트로 조인 순서 변경 (인덱스 미생성)',
        rationale: [
          'ORDERS(50,000건)와 CUSTOMERS(10,000건) HASH JOIN에서 양쪽 모두 FULL SCAN — Cost 5,400',
          'LEADING(o) USE_NL(c) 힌트로 ORDERS 드라이빙 후 CUSTOMERS PK_CUSTOMERS INDEX UNIQUE SCAN 유도',
          'HASH JOIN → NESTED LOOPS 전환으로 Cost 5,400 → 2,100 (61% 감소), CUSTOMERS 테이블 FULL SCAN 제거',
          '인덱스 생성 없이 기존 PK 인덱스만 활용 — 62% 개선으로 운영 환경 즉시 적용 가능',
        ],
        originalElapsed: 11200,
        tunedElapsed: 4250,
        originalBuffers: 1100000,
        tunedBuffers: 418000,
        originalDiskReads: 120000,
        tunedDiskReads: 45600,
        originalPlanText: `SQL_ID  u5v6w7x8y9z0a, child number 0
Plan hash value: 4918273650

-----------------------------------------------------------------------------------------------------------
| Id  | Operation                      | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |               |    1 |       |  2400 |00:00:02.70 |    18K |
|*  1 |  HASH JOIN                    |               |    1 |  2400 |  2400 |00:00:02.70 |     5K |
|   2 |   TABLE ACCESS FULL           | ORDERS        |    1 | 50000 | 50000 |00:00:01.40 |     7K |
|   3 |   TABLE ACCESS FULL           | CUSTOMERS     |    1 | 10000 | 10000 |00:00:00.60 |     2K |
-----------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  1 - access("A"."ID"="B"."REF_ID")`,
        tunedPlanText: `SQL_ID  u5v6w7x8y9z0a, child number 2
Plan hash value: 3827194650

-----------------------------------------------------------------------------------------------------------------
| Id  | Operation                          | Name             | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                 |    1 |       |  2400 |00:00:01.05 |    10K |
|   1 |  NESTED LOOPS                     |                 |    1 |  2400 |  2400 |00:00:01.05 |     2K |
|*  2 |   TABLE ACCESS FULL               | ORDERS          |    1 | 50000 | 50000 |00:00:01.00 |     7K |
|   3 |   TABLE ACCESS BY INDEX ROWID     | CUSTOMERS       |    1 |     1 |     1 |00:00:00.00 |      1 |
|*  4 |    INDEX UNIQUE SCAN              | PK_CUSTOMERS    |    1 |     1 |     1 |00:00:00.00 |      1 |
-----------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - filter("ORDERS"."DEL_YN"='N')
  4 - access("PK_CUSTOMERS"."ID"=:B1)`,
        tunedSqlText: `SELECT /*+ LEADING(o) USE_NL(c) */
       o.order_id, o.order_date, o.total_amount,
       c.customer_name, c.credit_limit
  FROM ORDERS o
  JOIN CUSTOMERS c ON o.customer_id = c.customer_id
 WHERE o.total_amount > :min_amount
 ORDER BY o.order_date DESC`,
      },
    ],
  },

  // ─── Tuned seed items (검증 대기) ───

  'WI-2024-019': {
    workItemId: 'WI-2024-019',
    selectedPlanId: 'WI-2024-019-A',
    plans: [
      {
        id: 'WI-2024-019-A',
        label: '튜닝안 A',
        types: ['index'],
        verifyType: 'estimated',
        improvementRate: -85,
        bindSetId: 'BS-019-1',
        summary: 'SHIPMENTS 테이블에 IDX_SHIP_ORDID(order_id) 인덱스 생성, IN 서브쿼리 → NESTED LOOPS SEMI 전환',
        rationale: [
          'IN 서브쿼리에서 SHIPMENTS(80,000건)와 ORDERS(50,000건) 모두 FULL SCAN 후 HASH JOIN SEMI — Cost 5,800',
          'SHIPMENTS에 order_id 인덱스 부재로 SEMI JOIN 시 해시 빌드 필수 — PGA 메모리 과다 사용',
          'IDX_SHIP_ORDID(order_id) 인덱스 생성으로 NESTED LOOPS SEMI 전환, ORDERS 드라이빙 후 SHIPMENTS 인덱스 프로브',
          'Cost 5,800 → 850 (85% 감소), SHIPMENTS FULL SCAN 제거로 Buffer Gets 192만 → 19.2만',
        ],
        originalElapsed: 18200,
        tunedElapsed: 2700,
        originalBuffers: 1920000,
        tunedBuffers: 192000,
        originalDiskReads: 210000,
        tunedDiskReads: 21000,
        originalPlanText: `SQL_ID  aa1bb2cc3, child number 0
Plan hash value: 4829103756

-----------------------------------------------------------------------------------------------------------
| Id  | Operation                      | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |               |    1 |       |  3000 |00:00:02.90 |    27K |
|*  1 |  HASH JOIN SEMI               |               |    1 |  3000 |  3000 |00:00:02.90 |     5K |
|   2 |   TABLE ACCESS FULL           | SHIPMENTS     |    1 | 80000 | 80000 |00:00:01.60 |    11K |
|   3 |   TABLE ACCESS FULL           | ORDERS        |    1 | 50000 | 50000 |00:00:01.40 |     7K |
-----------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  1 - access("A"."ID"="B"."REF_ID")`,
        tunedPlanText: `SQL_ID  aa1bb2cc3, child number 1
Plan hash value: 7291834560

-----------------------------------------------------------------------------------------------------------------
| Id  | Operation                          | Name             | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                 |    1 |       |  3000 |00:00:00.42 |     3K |
|*  1 |  NESTED LOOPS SEMI                |                 |    1 |  3000 |  3000 |00:00:00.42 |    980 |
|*  2 |   INDEX RANGE SCAN                | IDX_ORD_STATUS  |    1 |  5000 |  5000 |00:00:00.00 |    512 |
|   3 |    TABLE ACCESS BY INDEX ROWID    | ORDERS          |    1 |  5000 |  5000 |00:00:00.01 |    524 |
|*  4 |   INDEX RANGE SCAN                | IDX_SHIP_ORDID  |    1 |     1 |     1 |00:00:00.00 |      1 |
|   5 |    TABLE ACCESS BY INDEX ROWID    | SHIPMENTS       |    1 |     1 |     1 |00:00:00.00 |      2 |
-----------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  1 - access("OUTER"."ID"="INNER"."REF_ID")
  2 - access("IDX_ORD_STATUS"."KEY_COL">=:B1)
  4 - access("IDX_SHIP_ORDID"."KEY_COL">=:B1)`,
        indexDdl: 'CREATE INDEX IDX_SHIP_ORDID ON SHIPMENTS(order_id) TABLESPACE IDX_TS ONLINE;',
        tunedSqlText: `/* 인덱스 생성 후 동일 SQL — 실행계획만 변경됨 */
SELECT s.ship_id, s.ship_date, s.tracking_no
  FROM SHIPMENTS s
 WHERE s.order_id IN (
         SELECT order_id FROM ORDERS WHERE status = 'PENDING'
       )`,
      },
    ],
  },

  'WI-2024-020': {
    workItemId: 'WI-2024-020',
    selectedPlanId: 'WI-2024-020-A',
    plans: [
      {
        id: 'WI-2024-020-A',
        label: '튜닝안 A',
        types: ['rewrite'],
        verifyType: 'actual',
        improvementRate: -85,
        bindSetId: 'BS-020-1',
        summary: 'LEFT JOIN + COUNT → Scalar Subquery 변환으로 INVENTORY Full Scan 제거',
        rationale: [
          'INVENTORY(80,000건) FULL TABLE SCAN 후 WAREHOUSES(200건)와 HASH JOIN OUTER — 소형 마스터 테이블 대비 상세 테이블 400배',
          'SORT GROUP BY로 200개 그룹 집계 — HASH JOIN 빌드 비용이 불필요하게 높음',
          'Scalar Subquery 방식으로 변환: WAREHOUSES 200건 FULL SCAN 후 건별 IDX_INV_WHID INDEX RANGE SCAN',
          '기존 인덱스 IDX_INV_WHID 활용으로 INVENTORY FULL SCAN 제거, Cost 4,200 → 620 (85% 감소)',
        ],
        originalElapsed: 9400,
        tunedElapsed: 1400,
        originalBuffers: 980000,
        tunedBuffers: 98000,
        originalDiskReads: 105000,
        tunedDiskReads: 10500,
        originalPlanText: `SQL_ID  dd4ee5ff6, child number 0
Plan hash value: 3918274650

-----------------------------------------------------------------------------------------------------------
| Id  | Operation                      | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |               |    1 |       |   200 |00:00:02.10 |    29K |
|   1 |  SORT GROUP BY                |               |    1 |   200 |   200 |00:00:02.10 |     3K |
|*  2 |   HASH JOIN OUTER             |               |    1 | 80000 | 80000 |00:00:01.90 |    11K |
|   3 |    TABLE ACCESS FULL          | WAREHOUSES    |    1 |   200 |   200 |00:00:00.05 |    100 |
|   4 |    TABLE ACCESS FULL          | INVENTORY     |    1 | 80000 | 80000 |00:00:01.70 |    11K |
-----------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - access("A"."ID"="B"."REF_ID")`,
        tunedPlanText: `SQL_ID  dd4ee5ff6, child number 1
Plan hash value: 5847291034

-----------------------------------------------------------------------------------------------------------------
| Id  | Operation                          | Name             | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                 |    1 |       |   200 |00:00:00.31 |    639 |
|   1 |  TABLE ACCESS FULL                | WAREHOUSES      |    1 |   200 |   200 |00:00:00.05 |    100 |
|   2 |   SORT AGGREGATE                  |                 |    1 |     1 |     1 |00:00:00.00 |      1 |
|*  3 |    INDEX RANGE SCAN               | IDX_INV_WHID    |    1 |   400 |   400 |00:00:00.00 |     42 |
-----------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  3 - access("IDX_INV_WHID"."KEY_COL">=:B1)`,
        tunedSqlText: `SELECT w.warehouse_id, w.warehouse_name,
       (SELECT COUNT(i.item_id) FROM INVENTORY i WHERE i.warehouse_id = w.warehouse_id) item_cnt
  FROM WAREHOUSES w`,
      },
    ],
  },

  'WI-2024-021': {
    workItemId: 'WI-2024-021',
    selectedPlanId: 'WI-2024-021-A',
    plans: [
      {
        id: 'WI-2024-021-A',
        label: '인덱스안',
        types: ['index', 'hint', 'rewrite'],
        verifyType: 'estimated',
        improvementRate: -80,
        bindSetId: 'BS-021-1',
        summary: '/*+ LEADING(r o) USE_NL(oi) */ 힌트 + RETURNS 기준 NESTED LOOPS 전환',
        rationale: [
          '3개 테이블 HASH JOIN 체인: RETURNS(5,000) → ORDERS(50,000) → ORDER_ITEMS(200,000) — 전부 FULL SCAN, Cost 8,400',
          'RETURNS가 가장 작은 테이블(5,000건)이므로 드라이빙 테이블로 적합 — 1:1 조인으로 결과 집합 제한',
          'LEADING(r o) USE_NL(o oi) 힌트로 RETURNS 드라이빙, PK_ORDERS → IDX_OI_ORDID 순차 인덱스 접근',
          'HASH JOIN 2회 → NESTED LOOPS 2회 전환으로 Cost 8,400 → 1,680 (80% 감소)',
          'ORDER_ITEMS FULL SCAN 제거로 200,000건 불필요 액세스 방지, Buffer Gets 80% 절감',
        ],
        originalElapsed: 22100,
        tunedElapsed: 4400,
        originalBuffers: 2310000,
        tunedBuffers: 462000,
        originalDiskReads: 250000,
        tunedDiskReads: 50000,
        originalPlanText: `SQL_ID  gg7hh8ii9, child number 0
Plan hash value: 2847391560

-----------------------------------------------------------------------------------------------------------
| Id  | Operation                      | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |               |    1 |       | 15000 |00:00:04.20 |    51K |
|*  1 |  HASH JOIN                    |               |    1 | 15000 | 15000 |00:00:04.20 |     8K |
|*  2 |   HASH JOIN                   |               |    1 |  5000 |  5000 |00:00:02.80 |     5K |
|   3 |    TABLE ACCESS FULL          | RETURNS       |    1 |  5000 |  5000 |00:00:00.40 |     1K |
|   4 |    TABLE ACCESS FULL          | ORDERS        |    1 | 50000 | 50000 |00:00:01.40 |     7K |
|   5 |   TABLE ACCESS FULL           | ORDER_ITEMS   |    1 |200000 |200000 |00:00:01.90 |    23K |
-----------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  1 - access("A"."ID"="B"."REF_ID")
  2 - access("A"."ID"="B"."REF_ID")`,
        tunedPlanText: `SQL_ID  gg7hh8ii9, child number 1 (예상)
Plan hash value: 6291834750

-----------------------------------------------------------------------------------------------------------------
| Id  | Operation                          | Name             | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                 |    1 |       | 15000 |00:00:00.84 |     7K |
|*  1 |  NESTED LOOPS                     |                 |    1 | 15000 | 15000 |00:00:00.84 |     3K |
|*  2 |   NESTED LOOPS                    |                 |    1 |  5000 |  5000 |00:00:00.44 |     1K |
|   3 |    TABLE ACCESS FULL              | RETURNS         |    1 |  5000 |  5000 |00:00:00.40 |     1K |
|*  4 |    TABLE ACCESS BY INDEX ROWID    | ORDERS          |    1 |     1 |     1 |00:00:00.00 |      1 |
|*  5 |     INDEX UNIQUE SCAN             | PK_ORDERS       |    1 |     1 |     1 |00:00:00.00 |      1 |
|*  6 |   INDEX RANGE SCAN                | IDX_OI_ORDID    |    1 |     3 |     3 |00:00:00.00 |      1 |
|   7 |    TABLE ACCESS BY INDEX ROWID    | ORDER_ITEMS     |    1 |     3 |     3 |00:00:00.00 |      2 |
-----------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  1 - access("OUTER"."ID"="INNER"."REF_ID")
  2 - access("OUTER"."ID"="INNER"."REF_ID")
  4 - filter("ORDERS"."DEL_YN"='N')
  5 - access("PK_ORDERS"."ID"=:B1)
  6 - access("IDX_OI_ORDID"."KEY_COL">=:B1)`,
        tunedSqlText: `SELECT /*+ LEADING(r o) USE_NL(o oi) INDEX(o PK_ORDERS) INDEX(oi IDX_OI_ORDID) */
       r.return_id, r.return_date, o.order_id, oi.product_name
  FROM RETURNS r
  JOIN ORDERS o ON r.order_id = o.order_id
  JOIN ORDER_ITEMS oi ON o.order_id = oi.order_id`,
      },
      {
        id: 'WI-2024-021-B',
        label: '차선안',
        types: ['hint'],
        verifyType: 'actual',
        improvementRate: -55,
        bindSetId: 'BS-021-1',
        summary: '/*+ USE_HASH(r o) SWAP_JOIN_INPUTS(r) */ 해시 조인 순서 최적화만 적용',
        rationale: [
          '기존 HASH JOIN에서 RETURNS(5,000건) → ORDERS(50,000건) 빌드/프로브 순서가 비효율적',
          'SWAP_JOIN_INPUTS(r) 힌트로 RETURNS를 빌드 테이블로 고정 — 해시 영역 크기 최소화',
          'HASH JOIN 순서 최적화로 Cost 8,400 → 3,780 (55% 감소), 해시 빌드 비용 절감',
          '인덱스 없이 힌트만으로 55% 개선 — NL 전환 대비 효과는 낮지만 DDL 변경 불필요',
        ],
        originalElapsed: 22100,
        tunedElapsed: 9950,
        originalBuffers: 2310000,
        tunedBuffers: 1040000,
        originalDiskReads: 250000,
        tunedDiskReads: 112500,
        originalPlanText: `SQL_ID  gg7hh8ii9, child number 0
Plan hash value: 2847391560

-----------------------------------------------------------------------------------------------------------
| Id  | Operation                      | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |               |    1 |       | 15000 |00:00:04.20 |    51K |
|*  1 |  HASH JOIN                    |               |    1 | 15000 | 15000 |00:00:04.20 |     8K |
|*  2 |   HASH JOIN                   |               |    1 |  5000 |  5000 |00:00:02.80 |     5K |
|   3 |    TABLE ACCESS FULL          | RETURNS       |    1 |  5000 |  5000 |00:00:00.40 |     1K |
|   4 |    TABLE ACCESS FULL          | ORDERS        |    1 | 50000 | 50000 |00:00:01.40 |     7K |
|   5 |   TABLE ACCESS FULL           | ORDER_ITEMS   |    1 |200000 |200000 |00:00:01.90 |    23K |
-----------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  1 - access("A"."ID"="B"."REF_ID")
  2 - access("A"."ID"="B"."REF_ID")`,
        tunedPlanText: `SQL_ID  gg7hh8ii9, child number 2
Plan hash value: 4918273650

-----------------------------------------------------------------------------------------------------------------
| Id  | Operation                          | Name             | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                 |    1 |       | 15000 |00:00:01.89 |    38K |
|*  1 |  HASH JOIN                        |                 |    1 | 15000 | 15000 |00:00:01.89 |     5K |
|*  2 |   HASH JOIN                       |                 |    1 |  5000 |  5000 |00:00:01.10 |     2K |
|   3 |    TABLE ACCESS FULL              | RETURNS         |    1 |  5000 |  5000 |00:00:00.40 |     1K |
|   4 |    TABLE ACCESS FULL              | ORDERS          |    1 | 50000 | 50000 |00:00:00.60 |     6K |
|   5 |   TABLE ACCESS FULL               | ORDER_ITEMS     |    1 |200000 |200000 |00:00:00.70 |    21K |
-----------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  1 - access("A"."ID"="B"."REF_ID")
  2 - access("A"."ID"="B"."REF_ID")`,
        tunedSqlText: `SELECT /*+ USE_HASH(r o) SWAP_JOIN_INPUTS(r) */
       r.return_id, r.return_date, o.order_id, oi.product_name
  FROM RETURNS r
  JOIN ORDERS o ON r.order_id = o.order_id
  JOIN ORDER_ITEMS oi ON o.order_id = oi.order_id`,
      },
    ],
  },

  'WI-2024-022': {
    workItemId: 'WI-2024-022',
    selectedPlanId: 'WI-2024-022-A',
    plans: [
      {
        id: 'WI-2024-022-A',
        label: '튜닝안 A',
        types: ['index'],
        verifyType: 'estimated',
        improvementRate: -85,
        bindSetId: 'BS-022-1',
        summary: 'PAYMENTS 테이블에 IDX_PAY_CUST_DT(customer_id, pay_date) 복합 인덱스 생성',
        rationale: [
          'PAYMENTS(300,000건) FULL TABLE SCAN — customer_id, pay_date 조건이 filter로만 처리되어 전체 테이블 스캔',
          'WHERE 조건 customer_id = :cust_id AND pay_date BETWEEN 선택도 0.05% → 인덱스 시 150건만 액세스',
          'IDX_PAY_CUST_DT(customer_id, pay_date) 복합 인덱스로 두 조건 모두 access predicate 전환',
          'FULL SCAN → INDEX RANGE SCAN 전환으로 Cost 4,800 → 720 (85% 감소), 300,000건 → 150건 액세스',
        ],
        originalElapsed: 14300,
        tunedElapsed: 2100,
        originalBuffers: 1490000,
        tunedBuffers: 149000,
        originalDiskReads: 160000,
        tunedDiskReads: 16000,
        originalPlanText: `SQL_ID  jj0kk1ll2, child number 0
Plan hash value: 3847261590

-----------------------------------------------------------------------------------------------------------
| Id  | Operation                      | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |               |    1 |       |300000 |00:00:02.40 |    38K |
|*  1 |  TABLE ACCESS FULL            | PAYMENTS      |    1 |300000 |300000 |00:00:02.40 |    34K |
-----------------------------------------------------------------------------------------------------------

Predicate Information:
   1 - filter("CUSTOMER_ID"=:CUST_ID AND "PAY_DATE">=:FROM AND "PAY_DATE"<=:TO)`,
        tunedPlanText: `SQL_ID  jj0kk1ll2, child number 1
Plan hash value: 8291034756

-------------------------------------------------------------------------------------------------------------------
| Id  | Operation                          | Name               | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-------------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                   |    1 |       |   150 |00:00:00.36 |     1K |
|*  1 |  TABLE ACCESS BY INDEX ROWID      | PAYMENTS          |    1 |   150 |   150 |00:00:00.36 |    591 |
|*  2 |   INDEX RANGE SCAN                | IDX_PAY_CUST_DT   |    1 |   150 |   150 |00:00:00.00 |     17 |
-------------------------------------------------------------------------------------------------------------------

Predicate Information:
   2 - access("CUSTOMER_ID"=:CUST_ID AND "PAY_DATE">=:FROM AND "PAY_DATE"<=:TO)`,
        indexDdl: 'CREATE INDEX IDX_PAY_CUST_DT ON PAYMENTS(customer_id, pay_date) TABLESPACE IDX_TS ONLINE;',
        tunedSqlText: `/* 인덱스 생성 후 동일 SQL — 실행계획만 변경됨 */
SELECT pay_id, pay_date, pay_amount, pay_method
  FROM PAYMENTS
 WHERE customer_id = :cust_id
   AND pay_date BETWEEN :from_dt AND :to_dt`,
      },
    ],
  },

  'WI-2024-023': {
    workItemId: 'WI-2024-023',
    selectedPlanId: 'WI-2024-023-A',
    plans: [
      {
        id: 'WI-2024-023-A',
        label: '튜닝안 A',
        types: ['hint'],
        verifyType: 'actual',
        improvementRate: -85,
        bindSetId: 'BS-023-1',
        summary: '/*+ USE_NL(m) INDEX(m PK_EMP) */ 힌트로 Self-Join 시 매니저 테이블 NESTED LOOPS 전환',
        rationale: [
          'EMP(10,000건) Self-Join에서 양쪽 모두 FULL TABLE SCAN 후 HASH JOIN OUTER — Cost 3,800',
          'manager_id 기반 조인에서 매니저 조회는 PK(employee_id) 1건 — NESTED LOOPS가 최적',
          'USE_NL(m) INDEX(m PK_EMP) 힌트로 매니저 테이블 INDEX UNIQUE SCAN 전환, 건당 Cost 1',
          'HASH JOIN OUTER → NESTED LOOPS OUTER 전환으로 Cost 3,800 → 580 (85% 감소), EMP 2회 FULL SCAN → 1회로 축소',
        ],
        originalElapsed: 6700,
        tunedElapsed: 1000,
        originalBuffers: 710000,
        tunedBuffers: 71000,
        originalDiskReads: 76000,
        tunedDiskReads: 7600,
        originalPlanText: `SQL_ID  mm3nn4oo5, child number 0
Plan hash value: 2957381640

-----------------------------------------------------------------------------------------------------------
| Id  | Operation                      | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |               |    1 |       | 10000 |00:00:01.90 |    12K |
|*  1 |  HASH JOIN OUTER              |               |    1 | 10000 | 10000 |00:00:01.90 |     4K |
|   2 |   TABLE ACCESS FULL           | EMP           |    1 | 10000 | 10000 |00:00:00.90 |     2K |
|   3 |   TABLE ACCESS FULL           | EMP           |    1 | 10000 | 10000 |00:00:00.90 |     2K |
-----------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  1 - access("A"."ID"="B"."REF_ID")`,
        tunedPlanText: `SQL_ID  mm3nn4oo5, child number 1
Plan hash value: 8847291035

---------------------------------------------------------------------------------------------------------------
| Id  | Operation                          | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
---------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |               |    1 |       | 10000 |00:00:00.29 |     3K |
|   1 |  NESTED LOOPS OUTER               |               |    1 | 10000 | 10000 |00:00:00.29 |     1K |
|*  2 |   TABLE ACCESS BY INDEX ROWID     | EMP           |    1 | 10000 | 10000 |00:00:00.25 |     1K |
|*  3 |    INDEX RANGE SCAN               | IDX_DEPT      |    1 |   200 |   200 |00:00:00.00 |     22 |
|*  4 |   TABLE ACCESS BY INDEX ROWID     | EMP           |    1 |     1 |     1 |00:00:00.00 |      1 |
|*  5 |    INDEX UNIQUE SCAN              | PK_EMP        |    1 |     1 |     1 |00:00:00.00 |      1 |
---------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - filter("EMP"."DEL_YN"='N')
  3 - access("IDX_DEPT"."KEY_COL">=:B1)
  4 - filter("EMP"."DEL_YN"='N')
  5 - access("PK_EMP"."ID"=:B1)`,
        tunedSqlText: `SELECT /*+ USE_NL(m) INDEX(m PK_EMP) */
       e.emp_id, e.hire_date, m.last_name mgr_name
  FROM EMP e
  LEFT JOIN EMP m ON e.manager_id = m.employee_id
 WHERE e.department_id = :dept_id`,
      },
    ],
  },

  'WI-2024-024': {
    workItemId: 'WI-2024-024',
    selectedPlanId: 'WI-2024-024-A',
    plans: [
      {
        id: 'WI-2024-024-A',
        label: '인덱스안',
        types: ['index', 'hint'],
        verifyType: 'estimated',
        improvementRate: -80,
        bindSetId: 'BS-024-1',
        summary: 'IDX_PROD_CAT(category_id, list_price, quantity_on_hand) 커버링 인덱스 생성 + GROUP BY 힌트',
        rationale: [
          'PRODUCTS(50,000건) FULL TABLE SCAN 후 SORT GROUP BY — category_id 50개 그룹에 비해 정렬 비용 과다',
          'SELECT 절에 category_id, list_price, quantity_on_hand만 사용 — 커버링 인덱스로 테이블 액세스 완전 제거 가능',
          'IDX_PROD_CAT(category_id, list_price, quantity_on_hand) 생성으로 INDEX FAST FULL SCAN 전환',
          'USE_HASH_GRP_BY 힌트로 SORT GROUP BY → HASH GROUP BY 전환, 정렬 없이 해시 기반 집계',
          '종합 효과: Cost 3,800 → 780 (79% 감소), 테이블 블록 I/O 완전 제거',
        ],
        originalElapsed: 11800,
        tunedElapsed: 2400,
        originalBuffers: 1230000,
        tunedBuffers: 246000,
        originalDiskReads: 132000,
        tunedDiskReads: 26400,
        originalPlanText: `SQL_ID  pp6qq7rr8, child number 0
Plan hash value: 4738291560

-----------------------------------------------------------------------------------------------------------
| Id  | Operation                      | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |               |    1 |       |     1 |00:00:01.90 |    14K |
|   1 |  FILTER                       |               |    1 |       |     1 |00:00:00.00 |      1 |
|   2 |   SORT GROUP BY               |               |    1 |    50 |    50 |00:00:01.90 |     3K |
|   3 |    TABLE ACCESS FULL          | PRODUCTS      |    1 | 50000 | 50000 |00:00:01.70 |     8K |
-----------------------------------------------------------------------------------------------------------`,
        tunedPlanText: `SQL_ID  pp6qq7rr8, child number 1 (예상)
Plan hash value: 9182734560

-----------------------------------------------------------------------------------------------------------------
| Id  | Operation                          | Name             | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                 |    1 |       |     1 |00:00:00.39 |     7K |
|   1 |  FILTER                           |                 |    1 |       |     1 |00:00:00.00 |      1 |
|   2 |   HASH GROUP BY                   |                 |    1 |    50 |    50 |00:00:00.39 |    629 |
|   3 |    INDEX FAST FULL SCAN           | IDX_PROD_CAT    |    1 | 50000 | 50000 |00:00:00.30 |     5K |
-----------------------------------------------------------------------------------------------------------------`,
        indexDdl: 'CREATE INDEX IDX_PROD_CAT ON PRODUCTS(category_id, list_price, quantity_on_hand) TABLESPACE IDX_TS ONLINE;',
        tunedSqlText: `SELECT /*+ INDEX(p IDX_PROD_CAT) USE_HASH_GRP_BY */
       p.category_id,
       SUM(p.list_price * p.quantity_on_hand) total_value
  FROM PRODUCTS p
 GROUP BY p.category_id
HAVING SUM(p.list_price * p.quantity_on_hand) > :min_value`,
      },
      {
        id: 'WI-2024-024-B',
        label: '차선안',
        types: ['hint'],
        verifyType: 'actual',
        improvementRate: -45,
        bindSetId: 'BS-024-2',
        summary: '/*+ HASH_GROUP_BY */ 힌트로 SORT GROUP BY → HASH GROUP BY 전환 (인덱스 미생성)',
        rationale: [
          'SORT GROUP BY가 50,000건 전체 정렬 수행 — 50개 그룹 대비 정렬 비용 과다, TEMP 사용 가능성',
          'USE_HASH_GRP_BY 힌트로 해시 기반 집계 전환 — 정렬 없이 해시 테이블에 직접 집계',
          'SORT GROUP BY → HASH GROUP BY 전환으로 Cost 3,800 → 2,090 (45% 감소)',
          '인덱스 없이 힌트만으로 45% 개선 — 커버링 인덱스 생성 불가 시 적용 가능한 대안',
        ],
        originalElapsed: 11800,
        tunedElapsed: 6490,
        originalBuffers: 1230000,
        tunedBuffers: 676500,
        originalDiskReads: 132000,
        tunedDiskReads: 72600,
        originalPlanText: `SQL_ID  pp6qq7rr8, child number 0
Plan hash value: 4738291560

-----------------------------------------------------------------------------------------------------------
| Id  | Operation                      | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |               |    1 |       |     1 |00:00:01.90 |    14K |
|   1 |  FILTER                       |               |    1 |       |     1 |00:00:00.00 |      1 |
|   2 |   SORT GROUP BY               |               |    1 |    50 |    50 |00:00:01.90 |     3K |
|   3 |    TABLE ACCESS FULL          | PRODUCTS      |    1 | 50000 | 50000 |00:00:01.70 |     8K |
-----------------------------------------------------------------------------------------------------------`,
        tunedPlanText: `SQL_ID  pp6qq7rr8, child number 2
Plan hash value: 5019283746

---------------------------------------------------------------------------------------------------------------
| Id  | Operation                          | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
---------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |               |    1 |       |     1 |00:00:01.04 |    10K |
|   1 |  FILTER                           |               |    1 |       |     1 |00:00:00.00 |      1 |
|   2 |   HASH GROUP BY                   |               |    1 |    50 |    50 |00:00:01.04 |     2K |
|   3 |    TABLE ACCESS FULL              | PRODUCTS      |    1 | 50000 | 50000 |00:00:00.90 |     6K |
---------------------------------------------------------------------------------------------------------------`,
        tunedSqlText: `SELECT /*+ USE_HASH_GRP_BY */
       category_id,
       SUM(list_price * quantity_on_hand) total_value
  FROM PRODUCTS
 GROUP BY category_id
HAVING SUM(list_price * quantity_on_hand) > :min_value`,
      },
    ],
  },

  'WI-2024-025': {
    workItemId: 'WI-2024-025',
    selectedPlanId: 'WI-2024-025-A',
    plans: [
      {
        id: 'WI-2024-025-A',
        label: '튜닝안 A',
        types: ['rewrite'],
        verifyType: 'actual',
        improvementRate: -85,
        bindSetId: 'BS-025-1',
        summary: 'WHERE 조건 추가(연도 필터) + HASH GROUP BY 변환으로 ORDERS Full Scan 범위 축소',
        rationale: [
          'ORDERS(50,000건) 전체 FULL SCAN + CUSTOMERS(10,000건) HASH JOIN — WHERE 절 누락으로 전 기간 데이터 스캔',
          '실제 필요한 데이터는 당해 연도분(약 12,000건) — 연도 필터 추가로 76% 스캔 범위 축소 가능',
          'WHERE o.order_date >= TRUNC(SYSDATE, \'YYYY\') 조건 추가로 IDX_ORD_DATE INDEX RANGE SCAN 활용',
          'SORT GROUP BY → HASH GROUP BY 자동 전환, Cost 9,800 → 1,500 (85% 감소)',
          '쿼리 리라이트만으로 85% 개선 — 누락된 필터 조건 보완이 핵심',
        ],
        originalElapsed: 31200,
        tunedElapsed: 4700,
        originalBuffers: 3280000,
        tunedBuffers: 328000,
        originalDiskReads: 350000,
        tunedDiskReads: 35000,
        originalPlanText: `SQL_ID  ss9tt0uu1, child number 0
Plan hash value: 3829104756

-----------------------------------------------------------------------------------------------------------
| Id  | Operation                      | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |               |    1 |       | 10000 |00:00:04.90 |    38K |
|   1 |  SORT GROUP BY                |               |    1 | 10000 | 10000 |00:00:04.90 |     9K |
|*  2 |   HASH JOIN                   |               |    1 | 50000 | 50000 |00:00:04.20 |    12K |
|   3 |    TABLE ACCESS FULL          | CUSTOMERS     |    1 | 10000 | 10000 |00:00:00.60 |     2K |
|   4 |    TABLE ACCESS FULL          | ORDERS        |    1 | 50000 | 50000 |00:00:01.40 |     7K |
-----------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - access("A"."ID"="B"."REF_ID")`,
        tunedPlanText: `SQL_ID  ss9tt0uu1, child number 1
Plan hash value: 1927384650

----------------------------------------------------------------------------------------------------------------
| Id  | Operation                          | Name            | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
----------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                |    1 |       | 10000 |00:00:00.75 |    10K |
|   1 |  HASH GROUP BY                    |                |    1 | 10000 | 10000 |00:00:00.75 |     2K |
|*  2 |   HASH JOIN                       |                |    1 | 12000 | 12000 |00:00:00.67 |     2K |
|   3 |    TABLE ACCESS FULL              | CUSTOMERS      |    1 | 10000 | 10000 |00:00:00.60 |     2K |
|*  4 |    INDEX RANGE SCAN               | IDX_ORD_DATE   |    1 | 12000 | 12000 |00:00:00.02 |     1K |
|   5 |     TABLE ACCESS BY INDEX ROWID   | ORDERS         |    1 | 12000 | 12000 |00:00:00.05 |     1K |
----------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - access("A"."ID"="B"."REF_ID")
  4 - access("IDX_ORD_DATE"."KEY_COL">=:B1)`,
        tunedSqlText: `SELECT c.cust_id, c.cust_name, SUM(o.total_amount) ytd_amount
  FROM CUSTOMERS c
  JOIN ORDERS o ON c.customer_id = o.customer_id
 WHERE o.order_date >= TRUNC(SYSDATE, 'YYYY')
 GROUP BY c.cust_id, c.cust_name`,
      },
    ],
  },

  'WI-2024-034': {
    workItemId: 'WI-2024-034',
    selectedPlanId: 'WI-2024-034-A',
    plans: [
      {
        id: 'WI-2024-034-A',
        label: '튜닝안 A',
        types: ['index'],
        verifyType: 'estimated',
        improvementRate: -85,
        bindSetId: 'BS-034-1',
        summary: 'TICKETS 테이블에 IDX_TKT_STATUS(status, assigned_to) 복합 인덱스 생성',
        rationale: [
          'TICKETS(30,000건) FULL TABLE SCAN — status = \'OPEN\' 필터가 filter predicate로만 처리',
          'OPEN 상태 티켓 비율 4% (1,200건) — 높은 선택도로 인덱스 활용 시 대폭 효율 개선 가능',
          'IDX_TKT_STATUS(status, assigned_to) 복합 인덱스로 status 조건 access + assigned_to 조인 키 커버',
          'FULL SCAN + HASH JOIN → INDEX RANGE SCAN + NESTED LOOPS 전환, Cost 3,200 → 480 (85% 감소)',
        ],
        originalElapsed: 8800,
        tunedElapsed: 1300,
        originalBuffers: 920000,
        tunedBuffers: 92000,
        originalDiskReads: 98000,
        tunedDiskReads: 9800,
        originalPlanText: `SQL_ID  mn6op7qr8, child number 0
Plan hash value: 5847201934

-----------------------------------------------------------------------------------------------------------
| Id  | Operation                      | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |               |    1 |       |  1200 |00:00:01.60 |    11K |
|*  1 |  HASH JOIN                    |               |    1 |  1200 |  1200 |00:00:01.60 |     3K |
|*  2 |   TABLE ACCESS FULL           | TICKETS       |    1 | 30000 | 30000 |00:00:01.20 |     5K |
|   3 |   TABLE ACCESS FULL           | USERS         |    1 |  5000 |  5000 |00:00:00.30 |    980 |
-----------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  1 - access("A"."ID"="B"."REF_ID")
  2 - filter("TICKETS"."DEL_YN"='N')`,
        tunedPlanText: `SQL_ID  mn6op7qr8, child number 1
Plan hash value: 3918274650

------------------------------------------------------------------------------------------------------------------
| Id  | Operation                          | Name              | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
------------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                  |    1 |       |  1200 |00:00:00.24 |     1K |
|   1 |  NESTED LOOPS                     |                  |    1 |  1200 |  1200 |00:00:00.24 |    504 |
|*  2 |   INDEX RANGE SCAN                | IDX_TKT_STATUS   |    1 |  1200 |  1200 |00:00:00.00 |    128 |
|   3 |    TABLE ACCESS BY INDEX ROWID    | TICKETS          |    1 |  1200 |  1200 |00:00:00.01 |    136 |
|*  4 |   TABLE ACCESS BY INDEX ROWID     | USERS            |    1 |     1 |     1 |00:00:00.00 |      1 |
|*  5 |    INDEX UNIQUE SCAN              | PK_USERS         |    1 |     1 |     1 |00:00:00.00 |      1 |
------------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - access("IDX_TKT_STATUS"."KEY_COL">=:B1)
  4 - filter("USERS"."DEL_YN"='N')
  5 - access("PK_USERS"."ID"=:B1)`,
        indexDdl: 'CREATE INDEX IDX_TKT_STATUS ON TICKETS(status, assigned_to) TABLESPACE IDX_TS ONLINE;',
        tunedSqlText: `/* 인덱스 생성 후 동일 SQL — 실행계획만 변경됨 */
SELECT t.ticket_id, t.subject, t.priority, u.username
  FROM TICKETS t
  JOIN USERS u ON t.assigned_to = u.user_id
 WHERE t.status = 'OPEN'`,
      },
    ],
  },

  'WI-2024-035': {
    workItemId: 'WI-2024-035',
    selectedPlanId: 'WI-2024-035-A',
    plans: [
      {
        id: 'WI-2024-035-A',
        label: '튜닝안 A',
        types: ['index', 'hint'],
        verifyType: 'estimated',
        improvementRate: -85,
        bindSetId: 'BS-035-1',
        summary: 'IDX_FB_PID_RATING(product_id, rating, created_at) 인덱스 생성 + INDEX_DESC 힌트로 정렬 제거',
        rationale: [
          'CUSTOMER_FEEDBACK(50,000건) FULL TABLE SCAN 후 SORT ORDER BY — product_id 필터 + created_at 정렬 비용 과다',
          'product_id = :pid AND rating <= 2 조건의 선택도 1% (500건) — 인덱스 활용 시 극소 범위만 액세스',
          'IDX_FB_PID_RATING(product_id, rating, created_at DESC) 내림차순 인덱스로 정렬 연산 완전 제거',
          'INDEX_DESC 힌트로 INDEX RANGE SCAN DESCENDING 수행, SORT ORDER BY 제거 — Cost 2,200 → 330 (85% 감소)',
        ],
        originalElapsed: 5200,
        tunedElapsed: 780,
        originalBuffers: 540000,
        tunedBuffers: 54000,
        originalDiskReads: 58000,
        tunedDiskReads: 5800,
        originalPlanText: `SQL_ID  st9uv0wx1, child number 0
Plan hash value: 4019283756

----------------------------------------------------------------------------------------------------------------
| Id  | Operation                      | Name                | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
----------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |                    |    1 |       |   500 |00:00:01.10 |    10K |
|   1 |  SORT ORDER BY                |                    |    1 |   500 |   500 |00:00:01.10 |     2K |
|*  2 |   TABLE ACCESS FULL           | CUSTOMER_FEEDBACK  |    1 | 50000 | 50000 |00:00:00.90 |     6K |
----------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - filter("CUSTOMER_FEEDBACK"."DEL_YN"='N')`,
        tunedPlanText: `SQL_ID  st9uv0wx1, child number 1 (예상)
Plan hash value: 7382914650

--------------------------------------------------------------------------------------------------------------------
| Id  | Operation                          | Name                | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
--------------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                    |    1 |       |   500 |00:00:00.16 |    636 |
|*  1 |  TABLE ACCESS BY INDEX ROWID      | CUSTOMER_FEEDBACK  |    1 |   500 |   500 |00:00:00.16 |    314 |
|*  2 |   INDEX RANGE SCAN DESCENDING     | IDX_FB_PID_RATING  |    1 |   500 |   500 |00:00:00.00 |     58 |
--------------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  1 - filter("CUSTOMER_FEEDBACK"."DEL_YN"='N')
  2 - access("IDX_FB_PID_RATING"."KEY_COL">=:B1)`,
        indexDdl: 'CREATE INDEX IDX_FB_PID_RATING ON CUSTOMER_FEEDBACK(product_id, rating, created_at DESC) TABLESPACE IDX_TS ONLINE;',
        tunedSqlText: `SELECT /*+ INDEX_DESC(f IDX_FB_PID_RATING) */
       f.feedback_id, f.rating, f.comments
  FROM CUSTOMER_FEEDBACK f
 WHERE f.product_id = :pid
   AND f.rating <= 2
 ORDER BY f.created_at DESC`,
      },
    ],
  },

  'WI-2024-049': {
    workItemId: 'WI-2024-049',
    selectedPlanId: 'WI-2024-049-A',
    plans: [
      {
        id: 'WI-2024-049-A',
        label: '튜닝안 A',
        types: ['index'],
        verifyType: 'estimated',
        improvementRate: -85,
        bindSetId: 'BS-049-1',
        summary: 'TAX_RULES 테이블에 IDX_TAX_CC_DT(country_code, effective_date) 인덱스 생성',
        rationale: [
          'TAX_RULES(10,000건) FULL TABLE SCAN + SORT ORDER BY — country_code 필터가 filter predicate로 처리',
          'country_code = :cc 조건 선택도 0.5% (50건) — 인덱스 시 극소 범위만 액세스 가능',
          'IDX_TAX_CC_DT(country_code, effective_date) 복합 인덱스로 access predicate 전환 + 정렬 제거',
          'INDEX RANGE SCAN DESCENDING으로 effective_date 역순 정렬 자동 보장, Cost 1,200 → 180 (85% 감소)',
        ],
        originalElapsed: 3200,
        tunedElapsed: 480,
        originalBuffers: 340000,
        tunedBuffers: 34000,
        originalDiskReads: 36000,
        tunedDiskReads: 3600,
        originalPlanText: `SQL_ID  yz1ab2cd3, child number 0
Plan hash value: 2748193650

-----------------------------------------------------------------------------------------------------------
| Id  | Operation                      | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |               |    1 |       |    50 |00:00:00.60 |     4K |
|   1 |  SORT ORDER BY                |               |    1 |    50 |    50 |00:00:00.60 |    965 |
|*  2 |   TABLE ACCESS FULL           | TAX_RULES     |    1 | 10000 | 10000 |00:00:00.50 |     2K |
-----------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - filter("TAX_RULES"."DEL_YN"='N')`,
        tunedPlanText: `SQL_ID  yz1ab2cd3, child number 1
Plan hash value: 5192837460

------------------------------------------------------------------------------------------------------------------
| Id  | Operation                          | Name              | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
------------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                  |    1 |       |    50 |00:00:00.10 |    300 |
|*  1 |  TABLE ACCESS BY INDEX ROWID      | TAX_RULES        |    1 |    50 |    50 |00:00:00.10 |    149 |
|*  2 |   INDEX RANGE SCAN DESCENDING     | IDX_TAX_CC_DT    |    1 |    50 |    50 |00:00:00.00 |      7 |
------------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  1 - filter("TAX_RULES"."DEL_YN"='N')
  2 - access("IDX_TAX_CC_DT"."KEY_COL">=:B1)`,
        indexDdl: 'CREATE INDEX IDX_TAX_CC_DT ON TAX_RULES(country_code, effective_date) TABLESPACE IDX_TS ONLINE;',
        tunedSqlText: `/* 인덱스 생성 후 동일 SQL — 실행계획만 변경됨 */
SELECT tax_id, tax_rate, effective_date
  FROM TAX_RULES
 WHERE country_code = :cc
   AND effective_date <= SYSDATE
 ORDER BY effective_date DESC`,
      },
    ],
  },

  // Applied 작업들 (WI-2024-001, WI-2024-002, WI-2024-018)
  'WI-2024-001': {
    workItemId: 'WI-2024-001',
    selectedPlanId: 'WI-2024-001-A',
    plans: [
      {
        id: 'WI-2024-001-A',
        label: '튜닝안 A',
        types: ['index', 'rewrite'],
        verifyType: 'estimated',
        bindSetId: 'BS-001-1',
        improvementRate: -93.4,
        summary: 'ORDERS 테이블에 IDX_ORD_DATE 인덱스 생성 + WHERE 조건 추가로 Full Table Scan → Index Range Scan 전환',
        rationale: [
          'ORDERS(50,000건), CUSTOMERS(10,000건), ORDER_ITEMS(200,000건) 3개 테이블 모두 FULL TABLE SCAN — Cost 12,450',
          'order_date 범위 조건이 WHERE 절에 누락되어 전 기간 데이터 스캔 — 실제 필요한 범위는 10% 미만',
          'IDX_ORD_DATE(order_date) 인덱스 생성으로 날짜 범위 기반 INDEX RANGE SCAN 전환, 5,000건만 액세스',
          'WHERE o.order_date BETWEEN :START_DATE AND :END_DATE 조건 추가로 조인 대상 데이터 90% 축소',
          '종합 효과: Cost 12,450 → 380 (97% 감소), Buffer Gets 487만 → 4.5만, Elapsed 48.2초 → 3.2초',
        ],
        originalElapsed: 48200,
        tunedElapsed: 3200,
        originalBuffers: 4870000,
        tunedBuffers: 45000,
        originalDiskReads: 450000,
        tunedDiskReads: 3200,
        originalPlanText: `SQL_ID  a1b2c3d4e5f6g, child number 0
Plan hash value: 3829104756

-----------------------------------------------------------------------------------------------------
| Id  | Operation                | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT        |               |    1 |       |   500 |00:00:06.22 |    70K |
|   1 |  SORT GROUP BY          |               |    1 |   500 |   500 |00:00:06.22 |    10K |
|*  2 |   HASH JOIN             |               |    1 |  5000 |  5000 |00:00:06.10 |    10K |
|*  3 |    HASH JOIN            |               |    1 |  5000 |  5000 |00:00:04.20 |     7K |
|   4 |     TABLE ACCESS FULL   | ORDERS        |    1 | 50000 | 50000 |00:00:01.40 |     7K |
|   5 |     TABLE ACCESS FULL   | CUSTOMERS     |    1 | 10000 | 10000 |00:00:00.60 |     2K |
|   6 |    TABLE ACCESS FULL    | ORDER_ITEMS   |    1 |200000 |200000 |00:00:01.90 |    23K |
-----------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - access("A"."ID"="B"."REF_ID")
  3 - access("A"."ID"="B"."REF_ID")`,
        tunedPlanText: `SQL_ID  a1b2c3d4e5f6g, child number 1
Plan hash value: 1927384650

-------------------------------------------------------------------------------------------------------------
| Id  | Operation                        | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                |               |    1 |       |   500 |00:00:00.19 |     3K |
|   1 |  SORT GROUP BY                  |               |    1 |   500 |   500 |00:00:00.19 |    354 |
|   2 |   NESTED LOOPS                  |               |    1 |  5000 |  5000 |00:00:00.17 |    780 |
|   3 |    NESTED LOOPS                 |               |    1 |  5000 |  5000 |00:00:00.10 |    660 |
|*  4 |     INDEX RANGE SCAN            | IDX_ORD_DATE  |    1 |  5000 |  5000 |00:00:00.01 |    528 |
|   5 |     TABLE ACCESS BY INDEX ROWID | ORDERS        |    1 |     1 |     1 |00:00:00.00 |      1 |
|*  6 |    TABLE ACCESS BY INDEX ROWID  | CUSTOMERS     |    1 |     1 |     1 |00:00:00.00 |      1 |
|   7 |   INDEX RANGE SCAN              | IDX_OI_ORDID  |    1 |     4 |     4 |00:00:00.00 |      1 |
|   8 |    TABLE ACCESS BY INDEX ROWID  | ORDER_ITEMS   |    1 |     4 |     4 |00:00:00.00 |      2 |
-------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  4 - access("IDX_ORD_DATE"."KEY_COL">=:B1)
  6 - filter("CUSTOMERS"."DEL_YN"='N')`,
        tunedSqlText: `SELECT o.order_id, o.order_date, c.customer_name,
       SUM(oi.quantity * oi.unit_price) total
  FROM ORDERS o, CUSTOMERS c, ORDER_ITEMS oi
 WHERE o.customer_id = c.customer_id
   AND o.order_id = oi.order_id
   AND o.order_date BETWEEN :START_DATE AND :END_DATE
 GROUP BY o.order_id, o.order_date, c.customer_name`,
        indexDdl: 'CREATE INDEX IDX_ORD_DATE ON ORDERS(order_date) TABLESPACE IDX_TS ONLINE;',
      },
    ],
  },

  'WI-2024-026': {
    workItemId: 'WI-2024-026',
    selectedPlanId: 'WI-2024-026-A',
    plans: [
      {
        id: 'WI-2024-026-A',
        label: '튜닝안 A',
        types: ['index'],
        verifyType: 'estimated',
        improvementRate: -85.4,
        bindSetId: 'BS-026-1',
        summary: 'INVOICES 테이블 미수금 조회에 복합 인덱스 IDX_INV_STATUS_DUE(status, due_date) 생성으로 FULL SCAN 제거',
        rationale: [
          'INVOICES(15,000건) FULL TABLE SCAN — status, due_date 조건이 filter predicate로 처리, 전체 블록 스캔',
          'status = \'UNPAID\' AND due_date < SYSDATE 조건의 선택도 10% (1,500건) — 인덱스 활용 적합',
          'IDX_INV_STATUS_DUE(status, due_date) 복합 인덱스로 두 조건 모두 access predicate 전환',
          'TABLE ACCESS FULL → INDEX RANGE SCAN + TABLE ACCESS BY INDEX ROWID, Cost 2,300 → 230 (90% 감소)',
        ],
        originalElapsed: 8900,
        tunedElapsed: 1300,
        originalBuffers: 930000,
        tunedBuffers: 93000,
        originalDiskReads: 93000,
        tunedDiskReads: 9300,
        originalPlanText: `SQL_ID  vv2ww3xx4, child number 0
Plan hash value: 2183746510

-----------------------------------------------------------------------------------------------------
| Id  | Operation                | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT        |               |    1 |       | 15000 |00:00:01.15 |     5K |
|*  1 |  TABLE ACCESS FULL      | INVOICES      |    1 | 15000 | 15000 |00:00:01.15 |     3K |
-----------------------------------------------------------------------------------------------------

Predicate Information:
   1 - filter("STATUS"='UNPAID' AND "DUE_DATE" < SYSDATE)`,
        tunedPlanText: `SQL_ID  vv2ww3xx4, child number 1
Plan hash value: 3927481065

--------------------------------------------------------------------------------------------------------------
| Id  | Operation                    | Name                | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
--------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT            |                    |    1 |       | 15000 |00:00:00.11 |     2K |
|   1 |  TABLE ACCESS BY INDEX ROWID| INVOICES           |    1 | 15000 | 15000 |00:00:00.11 |     2K |
|*  2 |   INDEX RANGE SCAN          | IDX_INV_STATUS_DUE |    1 |  1500 |  1500 |00:00:00.00 |    164 |
--------------------------------------------------------------------------------------------------------------

Predicate Information:
   2 - access("STATUS"='UNPAID' AND "DUE_DATE" < SYSDATE)`,
        indexDdl: 'CREATE INDEX IDX_INV_STATUS_DUE ON INVOICES(status, due_date) TABLESPACE IDX_TS ONLINE;',
        tunedSqlText: `/* 인덱스 생성 후 동일 SQL — 실행계획만 변경됨 */
SELECT invoice_id, invoice_date, total_amount
  FROM INVOICES
 WHERE status = 'UNPAID'
   AND due_date < SYSDATE
 ORDER BY due_date`,
      },
    ],
  },

  'WI-2024-027': {
    workItemId: 'WI-2024-027',
    selectedPlanId: 'WI-2024-027-A',
    plans: [
      {
        id: 'WI-2024-027-A',
        label: '튜닝안 A',
        types: ['hint'],
        verifyType: 'actual',
        improvementRate: -80,
        bindSetId: 'BS-027-1',
        summary: 'PROMOTIONS 테이블 프로모션 효과 분석에 USE_NL 힌트 적용으로 HASH JOIN 방식 변경',
        rationale: [
          'PROMOTIONS(2,000건) → ORDERS(200,000건) HASH JOIN에서 ORDERS FULL SCAN Cost 3,400이 전체의 81%',
          'PROMOTIONS 드라이빙 시 프로모션당 평균 40건만 ORDERS에서 조회 — NESTED LOOPS가 유리한 구조',
          'LEADING(p) USE_NL(o) INDEX(o IDX_ORD_PROMO_ID) 힌트로 프로모션별 인덱스 프로브 전환',
          'HASH JOIN → NESTED LOOPS 전환으로 Cost 4,200 → 820 (80% 감소), ORDERS FULL SCAN 제거',
        ],
        originalElapsed: 16500,
        tunedElapsed: 3300,
        originalBuffers: 1720000,
        tunedBuffers: 344000,
        originalDiskReads: 172000,
        tunedDiskReads: 34400,
        originalPlanText: `SQL_ID  yy5zz6ab7, child number 0
Plan hash value: 1847362950

-----------------------------------------------------------------------------------------------------
| Id  | Operation                | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT        |               |    1 |       |  2000 |00:00:02.10 |    41K |
|   1 |  SORT GROUP BY          |               |    1 |  2000 |  2000 |00:00:02.10 |     4K |
|*  2 |   HASH JOIN             |               |    1 | 80000 | 80000 |00:00:01.95 |    11K |
|   3 |    TABLE ACCESS FULL    | PROMOTIONS    |    1 |  2000 |  2000 |00:00:00.16 |    456 |
|   4 |    TABLE ACCESS FULL    | ORDERS        |    1 |200000 |200000 |00:00:01.70 |    23K |
-----------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - access("A"."ID"="B"."REF_ID")`,
        tunedPlanText: `SQL_ID  yy5zz6ab7, child number 1
Plan hash value: 2938471065

-------------------------------------------------------------------------------------------------------------
| Id  | Operation                    | Name               | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT            |                   |    1 |       |  2000 |00:00:00.41 |    11K |
|   1 |  SORT GROUP BY              |                   |    1 |  2000 |  2000 |00:00:00.41 |    856 |
|*  2 |   NESTED LOOPS              |                   |    1 | 80000 | 80000 |00:00:00.39 |     9K |
|   3 |    TABLE ACCESS FULL        | PROMOTIONS        |    1 |  2000 |  2000 |00:00:00.16 |    456 |
|*  4 |    INDEX RANGE SCAN         | IDX_ORD_PROMO_ID  |    1 |    40 |    40 |00:00:00.00 |      6 |
-------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - access("OUTER"."ID"="INNER"."REF_ID")
  4 - access("IDX_ORD_PROMO_ID"."KEY_COL">=:B1)`,
        tunedSqlText: `SELECT /*+ LEADING(p) USE_NL(o) INDEX(o IDX_ORD_PROMO_ID) */
       p.promo_id, p.promo_name, COUNT(o.order_id) order_cnt
  FROM PROMOTIONS p
  LEFT JOIN ORDERS o ON p.promo_id = o.promo_id
 GROUP BY p.promo_id, p.promo_name
 ORDER BY order_cnt DESC`,
      },
    ],
  },

  'WI-2024-028': {
    workItemId: 'WI-2024-028',
    selectedPlanId: 'WI-2024-028-A',
    plans: [
      {
        id: 'WI-2024-028-A',
        label: '튜닝안 A',
        types: ['index', 'rewrite'],
        verifyType: 'estimated',
        improvementRate: -84.8,
        bindSetId: 'BS-028-1',
        summary: 'REGIONAL_SALES 연간 집계 쿼리 리라이트 + 복합 인덱스 IDX_RS_REGION_YEAR(region_id, sale_year) 생성',
        rationale: [
          'REGIONAL_SALES(500,000건) FULL TABLE SCAN — sale_year 조건이 filter로 처리, 전체 블록 스캔 후 필터링',
          'sale_year = :YEAR 선택도 10% (50,000건) — 인덱스 활용 시 90% 불필요 액세스 제거 가능',
          'IDX_RS_REGION_YEAR(region_id, sale_year) 복합 인덱스로 region 그룹핑 + 연도 필터 동시 처리',
          'REGIONS 테이블 조인 추가로 region_name 조회 최적화, Cost 5,100 → 590 (88% 감소)',
        ],
        originalElapsed: 19800,
        tunedElapsed: 3000,
        originalBuffers: 2080000,
        tunedBuffers: 208000,
        originalDiskReads: 208000,
        tunedDiskReads: 20800,
        originalPlanText: `SQL_ID  cd8ef9gh0, child number 0
Plan hash value: 3748261590

-----------------------------------------------------------------------------------------------------
| Id  | Operation                | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT        |               |    1 |       | 10000 |00:00:02.55 |    63K |
|   1 |  SORT GROUP BY          |               |    1 | 10000 | 10000 |00:00:02.55 |     5K |
|*  2 |   TABLE ACCESS FULL     | REGIONAL_SALES|    1 |500000 |500000 |00:00:02.40 |    54K |
-----------------------------------------------------------------------------------------------------

Predicate Information:
   2 - filter("SALE_YEAR"=:YEAR)`,
        tunedPlanText: `SQL_ID  cd8ef9gh0, child number 1
Plan hash value: 4829371065

---------------------------------------------------------------------------------------------------------------
| Id  | Operation                     | Name                | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
---------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT             |                    |    1 |       | 10000 |00:00:00.29 |    12K |
|   1 |  SORT GROUP BY               |                    |    1 | 10000 | 10000 |00:00:00.29 |     1K |
|   2 |   TABLE ACCESS BY INDEX ROWID| REGIONAL_SALES     |    1 | 50000 | 50000 |00:00:00.26 |     5K |
|*  3 |    INDEX RANGE SCAN          | IDX_RS_REGION_YEAR |    1 | 50000 | 50000 |00:00:00.04 |     5K |
---------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  3 - access("IDX_RS_REGION_YEAR"."KEY_COL">=:B1)`,
        tunedSqlText: `SELECT r.region_id, r.region_name,
       SUM(rs.sale_amount) total_sales,
       COUNT(*) cnt
  FROM REGIONAL_SALES rs
  JOIN REGIONS r ON rs.region_id = r.region_id
 WHERE rs.sale_year = :YEAR
 GROUP BY r.region_id, r.region_name
 ORDER BY total_sales DESC`,
        indexDdl: 'CREATE INDEX IDX_RS_REGION_YEAR ON REGIONAL_SALES(region_id, sale_year) TABLESPACE IDX_TS ONLINE;',
      },
    ],
  },

  'WI-2024-029': {
    workItemId: 'WI-2024-029',
    selectedPlanId: 'WI-2024-029-A',
    plans: [
      {
        id: 'WI-2024-029-A',
        label: '튜닝안 A',
        types: ['index'],
        verifyType: 'estimated',
        improvementRate: -84.7,
        bindSetId: 'BS-029-1',
        summary: 'ACTIVITY_LOG 사용자 활동 조회에 복합 인덱스 IDX_AL_USER_DATE(user_id, activity_date) 생성',
        rationale: [
          'ACTIVITY_LOG(300,000건) FULL TABLE SCAN — user_id, activity_date 조건이 filter predicate로 전체 스캔',
          'user_id = :uid AND activity_date >= SYSDATE-30 선택도 1% (3,000건) — 높은 선택도로 인덱스 효과 극대화',
          'IDX_AL_USER_DATE(user_id, activity_date) 복합 인덱스로 두 조건 모두 access predicate 전환',
          'FULL SCAN → INDEX RANGE SCAN 전환, Cost 1,900 → 180 (91% 감소), 300,000건 → 3,000건 액세스',
        ],
        originalElapsed: 7200,
        tunedElapsed: 1100,
        originalBuffers: 750000,
        tunedBuffers: 75000,
        originalDiskReads: 75000,
        tunedDiskReads: 7500,
        originalPlanText: `SQL_ID  ij1kl2mn3, child number 0
Plan hash value: 2847361590

-----------------------------------------------------------------------------------------------------
| Id  | Operation                | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT        |               |    1 |       |300000 |00:00:00.95 |    33K |
|*  1 |  TABLE ACCESS FULL      | ACTIVITY_LOG  |    1 |300000 |300000 |00:00:00.95 |    32K |
-----------------------------------------------------------------------------------------------------

Predicate Information:
   1 - filter("USER_ID"=:USER_ID AND "ACTIVITY_DATE" >= SYSDATE-30)`,
        tunedPlanText: `SQL_ID  ij1kl2mn3, child number 1
Plan hash value: 3918274650

-------------------------------------------------------------------------------------------------------------
| Id  | Operation                    | Name               | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT            |                   |    1 |       |  3000 |00:00:00.10 |    900 |
|   1 |  TABLE ACCESS BY INDEX ROWID| ACTIVITY_LOG      |    1 |  3000 |  3000 |00:00:00.10 |    444 |
|*  2 |   INDEX RANGE SCAN          | IDX_AL_USER_DATE  |    1 |  3000 |  3000 |00:00:00.00 |    312 |
-------------------------------------------------------------------------------------------------------------

Predicate Information:
   2 - access("USER_ID"=:USER_ID AND "ACTIVITY_DATE" >= SYSDATE-30)`,
        indexDdl: 'CREATE INDEX IDX_AL_USER_DATE ON ACTIVITY_LOG(user_id, activity_date) TABLESPACE IDX_TS ONLINE;',
        tunedSqlText: `/* 인덱스 생성 후 동일 SQL — 실행계획만 변경됨 */
SELECT l.log_id, l.action, l.created_at, u.username
  FROM ACTIVITY_LOG l
  JOIN USERS u ON l.user_id = u.user_id
 WHERE l.user_id = :uid
   AND l.created_at >= SYSDATE - 30`,
      },
    ],
  },

  'WI-2024-030': {
    workItemId: 'WI-2024-030',
    selectedPlanId: 'WI-2024-030-A',
    plans: [
      {
        id: 'WI-2024-030-A',
        label: '튜닝안 A',
        types: ['hint', 'rewrite'],
        verifyType: 'actual',
        improvementRate: -80.1,
        bindSetId: 'BS-030-1',
        summary: 'ORDERS-ITEMS 금액 집계 쿼리 CTE 기반 리라이트 + USE_HASH 힌트 적용으로 중복 스캔 제거',
        rationale: [
          'ORDERS(100,000건) + ORDER_ITEMS(400,000건) FULL SCAN 후 HASH JOIN — Cost 5,800, 양쪽 모두 전체 스캔',
          '날짜 범위 조건이 조인 후 필터링되어 불필요한 데이터까지 HASH BUILD에 포함',
          'CTE(WITH 절)로 ORDERS 선 필터링 — IDX_ORD_DATE INDEX RANGE SCAN으로 10,000건만 추출',
          '선 필터링된 order_id 기준 ORDER_ITEMS IDX_OI_ORDID INDEX RANGE SCAN — 40,000건만 액세스',
          '종합 효과: Cost 6,300 → 1,250 (80% 감소), 500,000건 → 50,000건 액세스로 Buffer Gets 80% 절감',
        ],
        originalElapsed: 24600,
        tunedElapsed: 4900,
        originalBuffers: 2570000,
        tunedBuffers: 514000,
        originalDiskReads: 257000,
        tunedDiskReads: 51400,
        originalPlanText: `SQL_ID  op4qr5st6, child number 0
Plan hash value: 3948271650

-----------------------------------------------------------------------------------------------------
| Id  | Operation                | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT        |               |    1 |       |  1000 |00:00:03.15 |   114K |
|   1 |  SORT ORDER BY          |               |    1 |  1000 |  1000 |00:00:03.15 |     5K |
|   2 |   HASH GROUP BY         |               |    1 |  1000 |  1000 |00:00:03.10 |     5K |
|*  3 |    HASH JOIN            |               |    1 |400000 |400000 |00:00:02.90 |    45K |
|   4 |     TABLE ACCESS FULL   | ORDERS        |    1 |100000 |100000 |00:00:00.85 |    11K |
|   5 |     TABLE ACCESS FULL   | ORDER_ITEMS   |    1 |400000 |400000 |00:00:01.90 |    43K |
-----------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  3 - access("A"."ID"="B"."REF_ID")`,
        tunedPlanText: `SQL_ID  op4qr5st6, child number 1
Plan hash value: 5039482765

-------------------------------------------------------------------------------------------------------------
| Id  | Operation                       | Name            | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT               |                |    1 |       |  1000 |00:00:00.62 |    22K |
|   1 |  SORT ORDER BY                 |                |    1 |  1000 |  1000 |00:00:00.62 |     1K |
|   2 |   HASH GROUP BY                |                |    1 |  1000 |  1000 |00:00:00.60 |     1K |
|*  3 |    HASH JOIN                   |                |    1 | 80000 | 80000 |00:00:00.55 |     9K |
|*  4 |     INDEX RANGE SCAN           | IDX_ORD_DATE   |    1 | 10000 | 10000 |00:00:00.06 |     1K |
|   5 |     TABLE ACCESS BY INDEX ROWID| ORDER_ITEMS    |    1 | 40000 | 40000 |00:00:00.40 |     5K |
|*  6 |      INDEX RANGE SCAN          | IDX_OI_ORDID   |    1 | 40000 | 40000 |00:00:00.10 |     4K |
-------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  3 - access("A"."ID"="B"."REF_ID")
  4 - access("IDX_ORD_DATE"."KEY_COL">=:B1)
  6 - access("IDX_OI_ORDID"."KEY_COL">=:B1)`,
        tunedSqlText: `WITH order_base AS (
  SELECT /*+ INDEX(o IDX_ORD_DATE) */ o.order_id, o.customer_id, o.order_date
    FROM ORDERS o
   WHERE o.order_date BETWEEN :START_DATE AND :END_DATE
)
SELECT ob.customer_id,
       SUM(oi.quantity * oi.unit_price) total_amount,
       COUNT(DISTINCT ob.order_id) order_cnt
  FROM order_base ob
  JOIN ORDER_ITEMS oi ON ob.order_id = oi.order_id
 GROUP BY ob.customer_id
 ORDER BY total_amount DESC`,
      },
    ],
  },

  'WI-2024-036': {
    workItemId: 'WI-2024-036',
    selectedPlanId: 'WI-2024-036-A',
    plans: [
      {
        id: 'WI-2024-036-A',
        label: '튜닝안 A',
        types: ['hint'],
        verifyType: 'actual',
        improvementRate: -85,
        bindSetId: 'BS-036-1',
        summary: 'BUDGETS 예산 조회에 INDEX 힌트 적용으로 옵티마이저 인덱스 선택 유도',
        rationale: [
          'BUDGETS(20,000건) FULL TABLE SCAN — 기존 IDX_BGT_DEPT_YEAR 인덱스 존재하나 옵티마이저가 선택하지 않음',
          'dept_id = :dept_id AND fiscal_year = :year 선택도 10% (2,000건) — 인덱스 사용이 유리한 조건',
          'INDEX(b IDX_BGT_DEPT_YEAR) 힌트로 인덱스 강제 사용 — filter → access predicate 전환',
          'FULL SCAN → INDEX RANGE SCAN 전환, Cost 890 → 90 (90% 감소), 통계 정보 부정확에 의한 플랜 오선택 보정',
        ],
        originalElapsed: 3400,
        tunedElapsed: 510,
        originalBuffers: 350000,
        tunedBuffers: 35000,
        originalDiskReads: 35000,
        tunedDiskReads: 3500,
        originalPlanText: `SQL_ID  yz2ab3cd4, child number 0
Plan hash value: 1847362590

-----------------------------------------------------------------------------------------------------
| Id  | Operation                | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT        |               |    1 |       | 20000 |00:00:00.44 |     3K |
|*  1 |  TABLE ACCESS FULL      | BUDGETS       |    1 | 20000 | 20000 |00:00:00.44 |     3K |
-----------------------------------------------------------------------------------------------------

Predicate Information:
   1 - filter("DEPT_ID"=:DEPT_ID AND "FISCAL_YEAR"=:YEAR)`,
        tunedPlanText: `SQL_ID  yz2ab3cd4, child number 1
Plan hash value: 2938471590

-------------------------------------------------------------------------------------------------------------
| Id  | Operation                    | Name               | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT            |                   |    1 |       |  2000 |00:00:00.10 |    550 |
|   1 |  TABLE ACCESS BY INDEX ROWID| BUDGETS           |    1 |  2000 |  2000 |00:00:00.10 |    272 |
|*  2 |   INDEX RANGE SCAN          | IDX_BGT_DEPT_YEAR |    1 |  2000 |  2000 |00:00:00.00 |    206 |
-------------------------------------------------------------------------------------------------------------

Predicate Information:
   2 - access("DEPT_ID"=:DEPT_ID AND "FISCAL_YEAR"=:YEAR)`,
        tunedSqlText: `SELECT /*+ INDEX(b IDX_BGT_DEPT_YEAR) */
       b.budget_id, b.dept_id, b.fiscal_year,
       b.amount_allocated, b.amount_spent
  FROM BUDGETS b
 WHERE b.fiscal_year = :yr
   AND b.dept_id = :dept_id`,
      },
    ],
  },

  'WI-2024-037': {
    workItemId: 'WI-2024-037',
    selectedPlanId: 'WI-2024-037-A',
    plans: [
      {
        id: 'WI-2024-037-A',
        label: '튜닝안 A',
        types: ['rewrite'],
        verifyType: 'actual',
        improvementRate: -80.3,
        bindSetId: 'BS-037-1',
        summary: 'VENDORS 구매 집계 쿼리를 EXISTS → JOIN 방식으로 리라이트하여 서브쿼리 반복 수행 제거',
        rationale: [
          'HASH JOIN SEMI에서 VENDORS(5,000건) + PURCHASE_ORDERS(200,000건) 모두 FULL SCAN — Cost 3,500',
          'EXISTS 방식은 매칭 여부만 확인 가능하여 집계(SUM, COUNT) 수행 불가 — 별도 서브쿼리 반복 필요',
          'JOIN 방식으로 변환하여 1회 조인으로 매칭 + 집계 동시 수행, IDX_PO_VENDOR INDEX FAST FULL SCAN 활용',
          '종합 효과: Cost 3,700 → 700 (81% 감소), PURCHASE_ORDERS FULL SCAN → INDEX FAST FULL SCAN 전환',
        ],
        originalElapsed: 14200,
        tunedElapsed: 2800,
        originalBuffers: 1480000,
        tunedBuffers: 296000,
        originalDiskReads: 148000,
        tunedDiskReads: 29600,
        originalPlanText: `SQL_ID  ef5gh6ij7, child number 0
Plan hash value: 3748271590

------------------------------------------------------------------------------------------------------
| Id  | Operation                | Name            | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT        |                |    1 |       |   500 |00:00:01.85 |    37K |
|   1 |  SORT GROUP BY          |                |    1 |   500 |   500 |00:00:01.85 |     3K |
|*  2 |   HASH JOIN SEMI        |                |    1 | 50000 | 50000 |00:00:01.75 |     8K |
|   3 |    TABLE ACCESS FULL    | VENDORS        |    1 |  5000 |  5000 |00:00:00.15 |    740 |
|   4 |    TABLE ACCESS FULL    | PURCHASE_ORDERS|    1 |200000 |200000 |00:00:01.50 |    22K |
------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - access("A"."ID"="B"."REF_ID")`,
        tunedPlanText: `SQL_ID  ef5gh6ij7, child number 1
Plan hash value: 4829371590

-----------------------------------------------------------------------------------------------------------
| Id  | Operation                     | Name            | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT             |                |    1 |       |   500 |00:00:00.35 |    28K |
|   1 |  SORT GROUP BY               |                |    1 |   500 |   500 |00:00:00.35 |    610 |
|*  2 |   HASH JOIN                  |                |    1 | 50000 | 50000 |00:00:00.32 |     6K |
|   3 |    TABLE ACCESS FULL         | VENDORS        |    1 |  5000 |  5000 |00:00:00.15 |    740 |
|*  4 |    INDEX FAST FULL SCAN      | IDX_PO_VENDOR  |    1 |200000 |200000 |00:00:00.14 |    20K |
-----------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - access("A"."ID"="B"."REF_ID")
  4 - access("IDX_PO_VENDOR"."STATUS"='Y')`,
        tunedSqlText: `SELECT v.vendor_id, v.vendor_name,
       SUM(po.amount) total_purchase,
       COUNT(po.po_id) po_cnt
  FROM VENDORS v
  JOIN PURCHASE_ORDERS po ON v.vendor_id = po.vendor_id
 WHERE po.po_date BETWEEN :START_DATE AND :END_DATE
 GROUP BY v.vendor_id, v.vendor_name
 ORDER BY total_purchase DESC`,
      },
    ],
  },

  'WI-2024-038': {
    workItemId: 'WI-2024-038',
    selectedPlanId: 'WI-2024-038-A',
    plans: [
      {
        id: 'WI-2024-038-A',
        label: '튜닝안 A',
        types: ['index'],
        verifyType: 'estimated',
        improvementRate: -85,
        bindSetId: 'BS-038-1',
        summary: 'USER_SESSIONS 활성 세션 조회에 인덱스 IDX_US_STATUS_START(status, start_time) 생성으로 FULL SCAN 제거',
        rationale: [
          'USER_SESSIONS(80,000건) FULL TABLE SCAN — status, start_time 조건이 filter predicate로 전체 스캔',
          'status = \'ACTIVE\' AND start_time >= SYSDATE-1 선택도 10% (8,000건) — 인덱스 활용으로 72,000건 스캔 제거',
          'IDX_US_STATUS_START(status, start_time) 복합 인덱스로 두 조건 모두 access predicate 전환',
          'FULL SCAN → INDEX RANGE SCAN 전환, Cost 490 → 50 (90% 감소), 실시간 모니터링에 적합한 응답 속도',
        ],
        originalElapsed: 1800,
        tunedElapsed: 270,
        originalBuffers: 190000,
        tunedBuffers: 19000,
        originalDiskReads: 19000,
        tunedDiskReads: 1900,
        originalPlanText: `SQL_ID  kl8mn9op0, child number 0
Plan hash value: 1938274590

-----------------------------------------------------------------------------------------------------
| Id  | Operation                | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT        |               |    1 |       | 80000 |00:00:00.24 |     9K |
|*  1 |  TABLE ACCESS FULL      | USER_SESSIONS |    1 | 80000 | 80000 |00:00:00.24 |     8K |
-----------------------------------------------------------------------------------------------------

Predicate Information:
   1 - filter("STATUS"='ACTIVE' AND "START_TIME" >= SYSDATE-1)`,
        tunedPlanText: `SQL_ID  kl8mn9op0, child number 1
Plan hash value: 2938471650

--------------------------------------------------------------------------------------------------------------
| Id  | Operation                    | Name                | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
--------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT            |                    |    1 |       |  8000 |00:00:00.10 |     2K |
|   1 |  TABLE ACCESS BY INDEX ROWID| USER_SESSIONS      |    1 |  8000 |  8000 |00:00:00.10 |    840 |
|*  2 |   INDEX RANGE SCAN          | IDX_US_STATUS_START|    1 |  8000 |  8000 |00:00:00.01 |    805 |
--------------------------------------------------------------------------------------------------------------

Predicate Information:
   2 - access("STATUS"='ACTIVE' AND "START_TIME" >= SYSDATE-1)`,
        indexDdl: 'CREATE INDEX IDX_US_STATUS_START ON USER_SESSIONS(status, start_time) TABLESPACE IDX_TS ONLINE;',
        tunedSqlText: `/* 인덱스 생성 후 동일 SQL — 실행계획만 변경됨 */
SELECT session_id, login_time, ip_address
  FROM USER_SESSIONS
 WHERE user_id = :uid
   AND logout_time IS NULL`,
      },
    ],
  },

  'WI-2024-046': {
    workItemId: 'WI-2024-046',
    selectedPlanId: 'WI-2024-046-A',
    plans: [
      {
        id: 'WI-2024-046-A',
        label: '튜닝안 A',
        types: ['index'],
        verifyType: 'estimated',
        improvementRate: -85,
        bindSetId: 'BS-046-1',
        summary: 'LOCATIONS 과적 창고 조회에 인덱스 IDX_LOC_WAREHOUSE_LOAD(warehouse_id, load_ratio) 생성',
        rationale: [
          'LOCATIONS(50,000건) FULL TABLE SCAN — load_ratio > 90 AND status = \'ACTIVE\' 조건이 filter로 처리',
          'load_ratio > 90 선택도 10% (5,000건), status = \'ACTIVE\' 추가 필터로 최종 결과 더 축소',
          'IDX_LOC_WAREHOUSE_LOAD(load_ratio, status) 복합 인덱스로 load_ratio access + status filter 최적화',
          'FULL SCAN → INDEX RANGE SCAN 전환, Cost 1,500 → 150 (90% 감소), 과적 알림 실시간 조회에 적합',
        ],
        originalElapsed: 5600,
        tunedElapsed: 840,
        originalBuffers: 590000,
        tunedBuffers: 59000,
        originalDiskReads: 59000,
        tunedDiskReads: 5900,
        originalPlanText: `SQL_ID  gh2ij3kl4, child number 0
Plan hash value: 2847372590

-----------------------------------------------------------------------------------------------------
| Id  | Operation                | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT        |               |    1 |       | 50000 |00:00:00.75 |     7K |
|*  1 |  TABLE ACCESS FULL      | LOCATIONS     |    1 | 50000 | 50000 |00:00:00.75 |     6K |
-----------------------------------------------------------------------------------------------------

Predicate Information:
   1 - filter("LOAD_RATIO" > 90 AND "STATUS"='ACTIVE')`,
        tunedPlanText: `SQL_ID  gh2ij3kl4, child number 1
Plan hash value: 3948271590

-------------------------------------------------------------------------------------------------------------------
| Id  | Operation                    | Name                     | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-------------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT            |                         |    1 |       |  5000 |00:00:00.10 |     1K |
|   1 |  TABLE ACCESS BY INDEX ROWID| LOCATIONS               |    1 |  5000 |  5000 |00:00:00.10 |    620 |
|*  2 |   INDEX RANGE SCAN          | IDX_LOC_WAREHOUSE_LOAD  |    1 |  5000 |  5000 |00:00:00.00 |    510 |
-------------------------------------------------------------------------------------------------------------------

Predicate Information:
   2 - access("LOAD_RATIO" > 90)
       filter("STATUS"='ACTIVE')`,
        indexDdl: 'CREATE INDEX IDX_LOC_WAREHOUSE_LOAD ON LOCATIONS(load_ratio, status) TABLESPACE IDX_TS ONLINE;',
        tunedSqlText: `/* 인덱스 생성 후 동일 SQL — 실행계획만 변경됨 */
SELECT loc_id, loc_name, capacity, current_count
  FROM LOCATIONS
 WHERE warehouse_id = :wid
   AND current_count > capacity * 0.9`,
      },
    ],
  },

  'WI-2024-047': {
    workItemId: 'WI-2024-047',
    selectedPlanId: 'WI-2024-047-A',
    plans: [
      {
        id: 'WI-2024-047-A',
        label: '튜닝안 A',
        types: ['hint'],
        verifyType: 'actual',
        improvementRate: -84.9,
        bindSetId: 'BS-047-1',
        summary: 'BATCH_JOBS 당일 작업 조회에 INDEX 힌트로 IDX_BJ_SCHED_DATE 인덱스 강제 사용',
        rationale: [
          'BATCH_JOBS(40,000건) FULL TABLE SCAN — TRUNC(scheduled_date) 함수 적용으로 인덱스 사용 불가 (Non-Sargable)',
          'TRUNC(scheduled_date) = TRUNC(SYSDATE) → scheduled_date >= TRUNC(SYSDATE) AND < TRUNC(SYSDATE)+1 변환으로 Sargable 조건화',
          'INDEX(bj IDX_BJ_SCHED_DATE) 힌트로 범위 조건 기반 INDEX RANGE SCAN 강제',
          'Non-Sargable → Sargable 변환 + 힌트 적용으로 Cost 1,100 → 110 (90% 감소), 당일분 4,000건만 액세스',
        ],
        originalElapsed: 4100,
        tunedElapsed: 620,
        originalBuffers: 430000,
        tunedBuffers: 43000,
        originalDiskReads: 43000,
        tunedDiskReads: 4300,
        originalPlanText: `SQL_ID  mn5op6qr7, child number 0
Plan hash value: 1847261590

-----------------------------------------------------------------------------------------------------
| Id  | Operation                | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT        |               |    1 |       | 40000 |00:00:00.55 |     6K |
|*  1 |  TABLE ACCESS FULL      | BATCH_JOBS    |    1 | 40000 | 40000 |00:00:00.55 |     5K |
-----------------------------------------------------------------------------------------------------

Predicate Information:
   1 - filter(TRUNC("SCHEDULED_DATE")=TRUNC(SYSDATE))`,
        tunedPlanText: `SQL_ID  mn5op6qr7, child number 1
Plan hash value: 2938471590

------------------------------------------------------------------------------------------------------------
| Id  | Operation                    | Name              | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT            |                  |    1 |       |  4000 |00:00:00.10 |    984 |
|   1 |  TABLE ACCESS BY INDEX ROWID| BATCH_JOBS       |    1 |  4000 |  4000 |00:00:00.10 |    488 |
|*  2 |   INDEX RANGE SCAN          | IDX_BJ_SCHED_DATE|    1 |  4000 |  4000 |00:00:00.00 |    408 |
------------------------------------------------------------------------------------------------------------

Predicate Information:
   2 - access("SCHEDULED_DATE" >= TRUNC(SYSDATE) AND "SCHEDULED_DATE" < TRUNC(SYSDATE)+1)`,
        tunedSqlText: `SELECT /*+ INDEX(bj IDX_BJ_SCHED_DATE) */
       bj.batch_id, bj.job_name, bj.start_time,
       bj.end_time, bj.status
  FROM BATCH_JOBS bj
 WHERE bj.scheduled_date >= TRUNC(SYSDATE)
   AND bj.scheduled_date < TRUNC(SYSDATE) + 1
 ORDER BY bj.start_time`,
      },
    ],
  },

  'WI-2024-048': {
    workItemId: 'WI-2024-048',
    selectedPlanId: 'WI-2024-048-A',
    plans: [
      {
        id: 'WI-2024-048-A',
        label: '튜닝안 A',
        types: ['rewrite'],
        verifyType: 'actual',
        improvementRate: -84.6,
        bindSetId: 'BS-048-1',
        summary: 'COUPONS 유효 쿠폰 조회 쿼리를 NOT EXISTS → NOT IN 방식으로 리라이트하여 처리 효율 개선',
        rationale: [
          'COUPONS(50,000건) + COUPON_USAGES(200,000건) FULL SCAN 후 HASH JOIN ANTI — 양쪽 모두 전체 스캔',
          'NOT EXISTS 방식에서 COUPONS 필터 조건(expiry_date, status)이 HASH JOIN 전에 적용되지 않음',
          'NOT IN 방식 변환 + IDX_CPN_STATUS_EXP 인덱스 활용으로 COUPONS 선 필터링 10,000건으로 축소',
          'COUPON_USAGES도 IDX_CU_COUPON_ID INDEX FAST FULL SCAN 전환, Cost 2,000 → 300 (85% 감소)',
        ],
        originalElapsed: 7800,
        tunedElapsed: 1200,
        originalBuffers: 820000,
        tunedBuffers: 82000,
        originalDiskReads: 82000,
        tunedDiskReads: 8200,
        originalPlanText: `SQL_ID  st8uv9wx0, child number 0
Plan hash value: 3748261590

-----------------------------------------------------------------------------------------------------
| Id  | Operation                | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT        |               |    1 |       | 10000 |00:00:01.00 |    31K |
|*  1 |  HASH JOIN ANTI         |               |    1 | 10000 | 10000 |00:00:01.00 |     3K |
|*  2 |   TABLE ACCESS FULL     | COUPONS       |    1 | 50000 | 50000 |00:00:00.40 |     6K |
|   3 |   TABLE ACCESS FULL     | COUPON_USAGES |    1 |200000 |200000 |00:00:00.50 |    21K |
-----------------------------------------------------------------------------------------------------

Predicate Information:
   1 - access("C"."COUPON_ID"="CU"."COUPON_ID")
   2 - filter("C"."EXPIRY_DATE" >= SYSDATE AND "C"."STATUS"='ACTIVE')`,
        tunedPlanText: `SQL_ID  st8uv9wx0, child number 1
Plan hash value: 4829471590

--------------------------------------------------------------------------------------------------------------
| Id  | Operation                     | Name               | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
--------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT             |                   |    1 |       | 10000 |00:00:00.15 |    23K |
|*  1 |  HASH JOIN ANTI              |                   |    1 | 10000 | 10000 |00:00:00.15 |     1K |
|*  2 |   INDEX RANGE SCAN           | IDX_CPN_STATUS_EXP|    1 | 10000 | 10000 |00:00:00.06 |     1K |
|   3 |   INDEX FAST FULL SCAN       | IDX_CU_COUPON_ID  |    1 |200000 |200000 |00:00:00.06 |    20K |
--------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  1 - access("A"."ID"="B"."REF_ID")
  2 - access("IDX_CPN_STATUS_EXP"."KEY_COL">=:B1)`,
        tunedSqlText: `SELECT c.coupon_id, c.coupon_code, c.discount_rate, c.expiry_date
  FROM COUPONS c
 WHERE c.expiry_date >= SYSDATE
   AND c.status = 'ACTIVE'
   AND c.coupon_id NOT IN (
         SELECT coupon_id FROM COUPON_USAGES WHERE used_date >= SYSDATE - 90
       )`,
      },
    ],
  },

  'WI-2024-050': {
    workItemId: 'WI-2024-050',
    selectedPlanId: 'WI-2024-050-A',
    plans: [
      {
        id: 'WI-2024-050-A',
        label: '튜닝안 A',
        types: ['index', 'hint'],
        verifyType: 'estimated',
        improvementRate: -84.8,
        bindSetId: 'BS-050-1',
        summary: 'PRODUCTS 재주문 대상 조회에 복합 인덱스 IDX_PRD_STOCK_REORDER(stock_qty, reorder_point) 생성 + INDEX 힌트 추가',
        rationale: [
          'PRODUCTS(80,000건) FULL TABLE SCAN — stock_qty <= reorder_point 조건이 filter로 전체 스캔',
          '재주문 대상 비율 10% (8,000건) — 인덱스 활용 시 72,000건 불필요 스캔 제거 가능',
          'IDX_PRD_STOCK_REORDER(stock_qty, reorder_point, status) 복합 인덱스로 stock_qty access + status filter',
          'INDEX(p IDX_PRD_STOCK_REORDER) 힌트로 강제 적용, Cost 2,400 → 240 (90% 감소)',
        ],
        originalElapsed: 9200,
        tunedElapsed: 1400,
        originalBuffers: 960000,
        tunedBuffers: 96000,
        originalDiskReads: 96000,
        tunedDiskReads: 9600,
        originalPlanText: `SQL_ID  ef4gh5ij6, child number 0
Plan hash value: 2938271590

-----------------------------------------------------------------------------------------------------
| Id  | Operation                | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT        |               |    1 |       | 80000 |00:00:01.20 |    12K |
|*  1 |  TABLE ACCESS FULL      | PRODUCTS      |    1 | 80000 | 80000 |00:00:01.20 |    10K |
-----------------------------------------------------------------------------------------------------

Predicate Information:
   1 - filter("STOCK_QTY" <= "REORDER_POINT" AND "STATUS"='ACTIVE')`,
        tunedPlanText: `SQL_ID  ef4gh5ij6, child number 1
Plan hash value: 3948372650

-----------------------------------------------------------------------------------------------------------------
| Id  | Operation                    | Name                   | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT            |                       |    1 |       |  8000 |00:00:00.12 |     2K |
|   1 |  TABLE ACCESS BY INDEX ROWID| PRODUCTS              |    1 |  8000 |  8000 |00:00:00.12 |    992 |
|*  2 |   INDEX RANGE SCAN          | IDX_PRD_STOCK_REORDER |    1 |  8000 |  8000 |00:00:00.01 |    816 |
-----------------------------------------------------------------------------------------------------------------

Predicate Information:
   2 - access("STOCK_QTY" <= "REORDER_POINT")
       filter("STATUS"='ACTIVE')`,
        indexDdl: 'CREATE INDEX IDX_PRD_STOCK_REORDER ON PRODUCTS(stock_qty, reorder_point, status) TABLESPACE IDX_TS ONLINE;',
        tunedSqlText: `SELECT /*+ INDEX(p IDX_PRD_STOCK_REORDER) */
       p.sku, p.product_name, p.reorder_level, p.quantity_on_hand
  FROM PRODUCTS p
 WHERE p.quantity_on_hand < p.reorder_level
   AND p.is_active = 1
 ORDER BY p.quantity_on_hand ASC`,
      },
    ],
  },

  'WI-2024-051': {
    workItemId: 'WI-2024-051',
    selectedPlanId: 'WI-2024-051-A',
    plans: [
      {
        id: 'WI-2024-051-A',
        label: '튜닝안 A',
        types: ['index', 'hint', 'rewrite'],
        verifyType: 'estimated',
        improvementRate: -89,
        bindSetId: 'BS-051-1',
        summary: '단순 매출 집계 쿼리를 날짜 파티션 프루닝 + CTE 다단계 분리 + 윈도우 함수로 전면 리라이트하여 FULL SCAN 제거',
        rationale: [
          'SALES 테이블(2,000만건) FULL TABLE SCAN → CUSTOMERS(50,000건) HASH JOIN 후 GROUP BY — Cost 전체의 92% 차지',
          'SALES.sale_date 파티션 프루닝 미활용: WHERE 조건 없이 전 기간 집계하여 전체 파티션 스캔',
          '최근 12개월 데이터만 필요한 비즈니스 요건 확인 → 날짜 범위 조건 추가로 스캔 범위 92% 축소',
          'GROUP BY + ORDER BY 동시 수행으로 SORT 2회 발생 → CTE 분리 + HASH GROUP BY 힌트로 1회로 축소',
          '고객 등급별 매출 비중 산출 필요 → RATIO_TO_REPORT 윈도우 함수 추가하여 별도 쿼리 제거',
        ],
        originalElapsed: 38500,
        tunedElapsed: 4200,
        originalBuffers: 4020000,
        tunedBuffers: 380000,
        originalDiskReads: 420000,
        tunedDiskReads: 38000,
        originalPlanText: `SQL_ID  kl9mn0op1, child number 0
Plan hash value: 3847261590

-----------------------------------------------------------------------------------------------------
| Id  | Operation                | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT        |               |    1 |       | 50000 |00:00:06.20 |    63K |
|   1 |  SORT ORDER BY          |               |    1 | 50000 | 50000 |00:00:06.20 |    15K |
|   2 |   HASH GROUP BY         |               |    1 | 50000 | 50000 |00:00:06.10 |    15K |
|*  3 |    HASH JOIN            |               |    1 |     2 |     2 |00:00:05.90 |     9K |
|   4 |     TABLE ACCESS FULL   | CUSTOMERS     |    1 | 50000 | 50000 |00:00:00.40 |     6K |
|   5 |     TABLE ACCESS FULL   | SALES         |    1 |     2 |     2 |00:00:05.10 |     8K |
-----------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  3 - access("A"."ID"="B"."REF_ID")`,
        tunedPlanText: `SQL_ID  kl9mn0op1, child number 1
Plan hash value: 5928371650

---------------------------------------------------------------------------------------------------------------------
| Id  | Operation                          | Name                 | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
---------------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                     |    1 |       | 50000 |00:00:00.67 |    80K |
|   1 |  WINDOW SORT                      |                     |    1 | 50000 | 50000 |00:00:00.67 |     6K |
|   2 |   HASH GROUP BY                   |                     |    1 | 50000 | 50000 |00:00:00.60 |     6K |
|*  3 |    HASH JOIN                      |                     |    1 |200000 |200000 |00:00:00.55 |    21K |
|   4 |     TABLE ACCESS FULL             | CUSTOMERS           |    1 | 50000 | 50000 |00:00:00.40 |     6K |
|   5 |     PARTITION RANGE ITERATOR      |                     |    1 |       |     1 |00:00:00.00 |      1 |
|*  6 |      TABLE ACCESS BY LOCAL INDEX  | SALES               |    1 |200000 |200000 |00:00:00.12 |    20K |
|*  7 |       INDEX RANGE SCAN            | IDX_SALES_DATE_CUST |    1 |200000 |200000 |00:00:00.02 |    20K |
---------------------------------------------------------------------------------------------------------------------

Predicate Information:
   3 - access("C"."CUSTOMER_ID"="S"."CUSTOMER_ID")
   6 - filter("S"."STATUS"='COMPLETED')
   7 - access("S"."SALE_DATE">=ADD_MONTHS(TRUNC(SYSDATE,'YYYY'),-12)
              AND "S"."SALE_DATE"<TRUNC(SYSDATE))`,
        tunedSqlText: `WITH
  /* Step 1: 최근 12개월 매출 데이터만 추출 (파티션 프루닝 활용) */
  recent_sales AS (
    SELECT /*+ INDEX(s IDX_SALES_DATE_CUST) */
           s.customer_id,
           s.amount,
           s.sale_date,
           s.product_category,
           s.channel
      FROM SALES s
     WHERE s.sale_date >= ADD_MONTHS(TRUNC(SYSDATE, 'YYYY'), -12)
       AND s.sale_date < TRUNC(SYSDATE)
       AND s.status = 'COMPLETED'
  ),
  /* Step 2: 고객별 매출 집계 */
  customer_totals AS (
    SELECT /*+ USE_HASH_GRP_BY */
           rs.customer_id,
           SUM(rs.amount)                                     AS total_sales,
           COUNT(*)                                            AS txn_count,
           COUNT(DISTINCT rs.product_category)                 AS category_count,
           COUNT(DISTINCT rs.channel)                          AS channel_count,
           MIN(rs.sale_date)                                   AS first_sale_date,
           MAX(rs.sale_date)                                   AS last_sale_date,
           TRUNC(MAX(rs.sale_date)) - TRUNC(MIN(rs.sale_date)) AS active_days
      FROM recent_sales rs
     GROUP BY rs.customer_id
  ),
  /* Step 3: 고객 정보 조인 + 등급별 매출 비중 산출 */
  enriched AS (
    SELECT c.customer_id,
           c.customer_name,
           c.customer_grade,
           c.region,
           ct.total_sales,
           ct.txn_count,
           ct.category_count,
           ct.channel_count,
           ct.first_sale_date,
           ct.last_sale_date,
           ct.active_days,
           ROUND(ct.total_sales / NULLIF(ct.txn_count, 0), 2) AS avg_ticket,
           RATIO_TO_REPORT(ct.total_sales) OVER ()             AS sales_pct,
           RANK() OVER (ORDER BY ct.total_sales DESC)          AS sales_rank
      FROM customer_totals ct
      JOIN CUSTOMERS c ON ct.customer_id = c.customer_id
  )
/* Step 4: 최종 결과 (상위 매출 고객순) */
SELECT customer_id,
       customer_name,
       customer_grade,
       region,
       total_sales,
       txn_count,
       avg_ticket,
       category_count,
       channel_count,
       active_days,
       ROUND(sales_pct * 100, 2) AS sales_pct,
       sales_rank
  FROM enriched
 ORDER BY sales_rank`,
        indexDdl: 'CREATE INDEX IDX_SALES_DATE_CUST ON SALES(sale_date, customer_id, amount, status) LOCAL TABLESPACE IDX_TS ONLINE;',
      },
    ],
  },

  'WI-2024-002': {
    workItemId: 'WI-2024-002',
    selectedPlanId: 'WI-2024-002-A',
    plans: [
      {
        id: 'WI-2024-002-A',
        label: '튜닝안 A',
        types: ['rewrite'],
        verifyType: 'actual',
        improvementRate: -85,
        bindSetId: 'BS-002-1',
        summary: 'EMP-DEPT 조인 쿼리를 스칼라 서브쿼리 방식에서 ANSI JOIN 방식으로 리라이트하여 반복 수행 제거',
        rationale: [
          'EMPLOYEES(200,000건) FULL SCAN 후 각 행마다 DEPARTMENTS 스칼라 서브쿼리 반복 — 200,000회 PK 조회',
          '스칼라 서브쿼리 캐시 효과가 있으나 dept_id 종류 200개로 캐시 미스율 높음 — 실질 반복 수행 과다',
          'ANSI JOIN 방식으로 변환하여 HASH JOIN 1회 수행 — DEPARTMENTS(200건) 빌드 후 EMPLOYEES 프로브',
          'IDX_EMP_DEPT INDEX FAST FULL SCAN 활용으로 테이블 액세스 제거, Cost 8,200 → 1,100 (87% 감소)',
          'SORT ORDER BY 유지하되 HASH JOIN으로 조인 비용 대폭 절감, Elapsed 32.1초 → 4.8초',
        ],
        originalElapsed: 32100,
        tunedElapsed: 4800,
        originalBuffers: 3200000,
        tunedBuffers: 320000,
        originalDiskReads: 320000,
        tunedDiskReads: 32000,
        originalPlanText: `SQL_ID  f7g8h9i0j1k2l, child number 0
Plan hash value: 3847261590

-----------------------------------------------------------------------------------------------------
| Id  | Operation                | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT        |               |    1 |       | 50000 |00:00:04.10 |    41K |
|   1 |  SORT ORDER BY          |               |    1 | 50000 | 50000 |00:00:04.10 |    12K |
|*  2 |   TABLE ACCESS FULL     | EMPLOYEES     |    1 |200000 |200000 |00:00:02.05 |    23K |
|   3 |    TABLE ACCESS BY ROWID| DEPARTMENTS   |    1 |     1 |     1 |00:00:00.00 |      1 |
|*  4 |     INDEX UNIQUE SCAN   | PK_DEPT_ID    |    1 |     1 |     1 |00:00:00.00 |      1 |
-----------------------------------------------------------------------------------------------------

Note: scalar subquery repeated for each row

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - filter("EMPLOYEES"."DEL_YN"='N')
  4 - access("PK_DEPT_ID"."ID"=:B1)`,
        tunedPlanText: `SQL_ID  f7g8h9i0j1k2l, child number 1
Plan hash value: 4928371065

----------------------------------------------------------------------------------------------------------
| Id  | Operation                     | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
----------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT             |               |    1 |       | 50000 |00:00:00.55 |    33K |
|   1 |  SORT ORDER BY               |               |    1 | 50000 | 50000 |00:00:00.55 |     6K |
|*  2 |   HASH JOIN                  |               |    1 | 50000 | 50000 |00:00:00.49 |     6K |
|   3 |    TABLE ACCESS FULL         | DEPARTMENTS   |    1 |   200 |   200 |00:00:00.00 |     28 |
|*  4 |    INDEX FAST FULL SCAN      | IDX_EMP_DEPT  |    1 |200000 |200000 |00:00:00.42 |    21K |
----------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - access("A"."ID"="B"."REF_ID")
  4 - access("IDX_EMP_DEPT"."STATUS"='Y')`,
        tunedSqlText: `SELECT e.emp_id, e.emp_name, e.salary,
       d.dept_id, d.dept_name, d.location
  FROM EMPLOYEES e
  JOIN DEPARTMENTS d ON e.dept_id = d.dept_id
 WHERE e.hire_date >= :HIRE_DATE
   AND e.status = 'ACTIVE'
 ORDER BY d.dept_name, e.emp_name`,
      },
    ],
  },

  'WI-2024-018': {
    workItemId: 'WI-2024-018',
    selectedPlanId: 'WI-2024-018-A',
    plans: [
      {
        id: 'WI-2024-018-A',
        label: '튜닝안 A',
        types: ['index'],
        verifyType: 'estimated',
        improvementRate: -84.4,
        bindSetId: 'BS-018-1',
        summary: '월별 고객 매출 CTE 쿼리에 복합 인덱스 IDX_SALES_CUST_DATE(customer_id, sale_date) 생성으로 반복 FULL SCAN 제거',
        rationale: [
          'SALES(500,000건) FULL TABLE SCAN — sale_date 12개월 필터가 filter predicate로 처리, 전체 블록 스캔',
          '12개월 데이터 비율 약 10% (50,000건) — 인덱스 활용 시 450,000건 불필요 액세스 제거',
          'IDX_SALES_CUST_DATE(customer_id, sale_date) 복합 인덱스로 날짜 범위 access + 고객별 그룹핑 최적화',
          'CTE 내부에서 INDEX RANGE SCAN으로 50,000건만 추출, WINDOW 함수 running_total 계산 효율화',
          'Cost 5,800 → 700 (88% 감소), Buffer Gets 235만 → 28만으로 대폭 절감',
        ],
        originalElapsed: 22400,
        tunedElapsed: 3500,
        originalBuffers: 2350000,
        tunedBuffers: 280000,
        originalDiskReads: 235000,
        tunedDiskReads: 28000,
        originalPlanText: `SQL_ID  p3q4r5s6t7u8v, child number 0
Plan hash value: 2847271590

-----------------------------------------------------------------------------------------------------
| Id  | Operation                | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT        |               |    1 |       |  5000 |00:00:02.90 |    64K |
|   1 |  SORT GROUP BY          |               |    1 |  5000 |  5000 |00:00:02.90 |     5K |
|*  2 |   TABLE ACCESS FULL     | SALES         |    1 |500000 |500000 |00:00:02.75 |    54K |
-----------------------------------------------------------------------------------------------------

Predicate Information:
   2 - filter("SALE_DATE" >= ADD_MONTHS(TRUNC(SYSDATE,'MM'),-12))`,
        tunedPlanText: `SQL_ID  p3q4r5s6t7u8v, child number 1
Plan hash value: 3928471590

------------------------------------------------------------------------------------------------------------------
| Id  | Operation                     | Name                   | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
------------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT             |                       |    1 |       |  5000 |00:00:00.35 |    12K |
|   1 |  SORT GROUP BY               |                       |    1 |  5000 |  5000 |00:00:00.35 |     1K |
|   2 |   TABLE ACCESS BY INDEX ROWID| SALES                 |    1 | 50000 | 50000 |00:00:00.32 |     6K |
|*  3 |    INDEX RANGE SCAN          | IDX_SALES_CUST_DATE   |    1 | 50000 | 50000 |00:00:00.02 |     5K |
------------------------------------------------------------------------------------------------------------------

Predicate Information:
   3 - access("SALE_DATE" >= ADD_MONTHS(TRUNC(SYSDATE,'MM'),-12))`,
        indexDdl: 'CREATE INDEX IDX_SALES_CUST_DATE ON SALES(customer_id, sale_date) TABLESPACE IDX_TS ONLINE;',
        tunedSqlText: `/* 인덱스 생성 후 동일 SQL — 실행계획만 변경됨 */
WITH monthly_sales AS (
  SELECT TRUNC(sale_date, 'MM') mon,
         customer_id,
         SUM(sale_amount) amt
    FROM SALES
   WHERE sale_date >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -12)
   GROUP BY TRUNC(sale_date, 'MM'), customer_id
)
SELECT mon, customer_id, amt,
       SUM(amt) OVER (PARTITION BY customer_id ORDER BY mon) running_total
  FROM monthly_sales
 ORDER BY customer_id, mon`,
      },
    ],
  },

  'WI-2024-031': {
    workItemId: 'WI-2024-031',
    selectedPlanId: 'WI-2024-031-A',
    plans: [
      {
        id: 'WI-2024-031-A',
        label: '튜닝안 A',
        types: ['index'],
        verifyType: 'estimated',
        improvementRate: -85.1,
        bindSetId: 'BS-031-1',
        summary: 'CONTRACTS 만료 예정 계약 조회에 복합 인덱스 IDX_CON_STATUS_EXP(status, expiry_date) 생성',
        rationale: [
          'CONTRACTS(60,000건) FULL TABLE SCAN — status, expiry_date 조건이 filter predicate로 전체 스캔',
          'status = \'ACTIVE\' AND expiry_date BETWEEN SYSDATE AND SYSDATE+90 선택도 10% (6,000건)',
          'IDX_CON_STATUS_EXP(status, expiry_date) 복합 인덱스로 두 조건 모두 access predicate 전환',
          'FULL SCAN → INDEX RANGE SCAN 전환, Cost 3,500 → 350 (90% 감소), 만료 알림 배치에 적합한 성능',
        ],
        originalElapsed: 13400,
        tunedElapsed: 2000,
        originalBuffers: 1400000,
        tunedBuffers: 140000,
        originalDiskReads: 140000,
        tunedDiskReads: 14000,
        originalPlanText: `SQL_ID  uv7wx8yz9, child number 0
Plan hash value: 3847261950

-----------------------------------------------------------------------------------------------------
| Id  | Operation                | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT        |               |    1 |       | 60000 |00:00:01.75 |    12K |
|*  1 |  TABLE ACCESS FULL      | CONTRACTS     |    1 | 60000 | 60000 |00:00:01.75 |     9K |
-----------------------------------------------------------------------------------------------------

Predicate Information:
   1 - filter("STATUS"='ACTIVE' AND "EXPIRY_DATE" BETWEEN SYSDATE AND SYSDATE+90)`,
        tunedPlanText: `SQL_ID  uv7wx8yz9, child number 1
Plan hash value: 4928371590

--------------------------------------------------------------------------------------------------------------
| Id  | Operation                    | Name                | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
--------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT            |                    |    1 |       |  6000 |00:00:00.17 |     2K |
|   1 |  TABLE ACCESS BY INDEX ROWID| CONTRACTS          |    1 |  6000 |  6000 |00:00:00.17 |    880 |
|*  2 |   INDEX RANGE SCAN          | IDX_CON_STATUS_EXP |    1 |  6000 |  6000 |00:00:00.01 |    622 |
--------------------------------------------------------------------------------------------------------------

Predicate Information:
   2 - access("STATUS"='ACTIVE' AND "EXPIRY_DATE" BETWEEN SYSDATE AND SYSDATE+90)`,
        indexDdl: 'CREATE INDEX IDX_CON_STATUS_EXP ON CONTRACTS(status, expiry_date) TABLESPACE IDX_TS ONLINE;',
        tunedSqlText: `/* 인덱스 생성 후 동일 SQL — 실행계획만 변경됨 */
SELECT c.contract_id, c.start_date, c.end_date,
       cu.customer_name
  FROM CONTRACTS c
  JOIN CUSTOMERS cu ON c.customer_id = cu.customer_id
 WHERE c.status = 'ACTIVE'
   AND c.expiry_date BETWEEN SYSDATE AND SYSDATE + 90
 ORDER BY c.expiry_date`,
      },
    ],
  },

  'WI-2024-032': {
    workItemId: 'WI-2024-032',
    selectedPlanId: 'WI-2024-032-A',
    plans: [
      {
        id: 'WI-2024-032-A',
        label: '튜닝안 A',
        types: ['rewrite'],
        verifyType: 'actual',
        improvementRate: -84.9,
        bindSetId: 'BS-032-1',
        summary: 'TEMP_CALC 정리 배치 쿼리를 TRUNCATE + INSERT SELECT 방식으로 리라이트하여 DELETE 비효율 제거',
        rationale: [
          'DELETE 문이 800,000건 중 90% (720,000건) 삭제 — 행 단위 DELETE로 UNDO 생성량 과다, 롤백 세그먼트 부담',
          '보존 대상 10% (80,000건)만 남기는 구조 — DELETE보다 보존 데이터 추출 후 TRUNCATE가 효율적',
          'TRUNCATE는 DDL로 UNDO 미생성, 즉시 공간 반환 — DELETE 대비 10배 이상 빠름',
          'INSERT /*+ APPEND */ 다이렉트 로드로 보존 데이터 고속 적재, Elapsed 45초 → 6.8초 (85% 감소)',
          '주의: TRUNCATE는 롤백 불가 — 임시 테이블 백업 단계로 안전성 확보',
        ],
        originalElapsed: 45000,
        tunedElapsed: 6800,
        originalBuffers: 4700000,
        tunedBuffers: 470000,
        originalDiskReads: 470000,
        tunedDiskReads: 47000,
        originalPlanText: `SQL_ID  ab0cd1ef2, child number 0
Plan hash value: 1938274590

-----------------------------------------------------------------------------------------------------
| Id  | Operation                | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------
|   0 | DELETE STATEMENT        |               |    1 |       |     1 |00:00:05.80 |    99K |
|*  1 |  DELETE                 | TEMP_CALC     |    1 |       |     1 |00:00:00.00 |      1 |
|*  2 |   TABLE ACCESS FULL     | TEMP_CALC     |    1 |800000 |800000 |00:00:05.80 |    89K |
-----------------------------------------------------------------------------------------------------

Predicate Information:
   2 - filter("CREATED_DATE" < SYSDATE - 7)`,
        tunedPlanText: `SQL_ID  ab0cd1ef2, child number 1
Plan hash value: 2938471590

----------------------------------------------------------------------------------------------------------
| Id  | Operation                     | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
----------------------------------------------------------------------------------------------------------
|   0 | INSERT STATEMENT             |               |    1 |       |     1 |00:00:00.85 |    11K |
|   1 |  LOAD AS SELECT              | TEMP_CALC     |    1 |       |     1 |00:00:00.00 |      1 |
|*  2 |   TABLE ACCESS FULL          | TEMP_CALC     |    1 | 80000 | 80000 |00:00:00.85 |     9K |
----------------------------------------------------------------------------------------------------------

Note: TRUNCATE applied before INSERT SELECT (DDL operation)

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - filter("TEMP_CALC"."DEL_YN"='N')`,
        tunedSqlText: `-- Step 1: 보존 데이터를 임시 테이블에 백업
CREATE TABLE TEMP_CALC_KEEP AS
  SELECT * FROM TEMP_CALC WHERE CREATED_DATE >= SYSDATE - 7;

-- Step 2: 원본 테이블 TRUNCATE
TRUNCATE TABLE TEMP_CALC;

-- Step 3: 보존 데이터 복원
INSERT /*+ APPEND */ INTO TEMP_CALC
  SELECT * FROM TEMP_CALC_KEEP;
COMMIT;

DROP TABLE TEMP_CALC_KEEP;`,
      },
    ],
  },

  'WI-2024-039': {
    workItemId: 'WI-2024-039',
    selectedPlanId: 'WI-2024-039-A',
    plans: [
      {
        id: 'WI-2024-039-A',
        label: '튜닝안 A',
        types: ['index'],
        verifyType: 'estimated',
        improvementRate: -84.9,
        bindSetId: 'BS-039-1',
        summary: 'NOTIFICATIONS 미읽음 조회에 복합 인덱스 IDX_NOTIF_USER_READ(user_id, is_read) 생성으로 FULL SCAN 제거',
        rationale: [
          'NOTIFICATIONS(50,000건) FULL TABLE SCAN — user_id, is_read 조건이 filter predicate로 전체 스캔',
          'user_id = :uid AND is_read = 0 선택도 10% (5,000건) — 미읽음 알림만 조회하므로 인덱스 효과 높음',
          'IDX_NOTIF_USER_READ(user_id, is_read) 복합 인덱스로 두 조건 모두 access predicate 전환',
          'FULL SCAN → INDEX RANGE SCAN 전환, Cost 1,200 → 120 (90% 감소), 알림 목록 실시간 조회에 적합',
        ],
        originalElapsed: 4500,
        tunedElapsed: 680,
        originalBuffers: 470000,
        tunedBuffers: 47000,
        originalDiskReads: 47000,
        tunedDiskReads: 4700,
        originalPlanText: `SQL_ID  qr1st2uv3, child number 0
Plan hash value: 2847261590

-----------------------------------------------------------------------------------------------------
| Id  | Operation                | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT        |               |    1 |       | 50000 |00:00:00.60 |     7K |
|*  1 |  TABLE ACCESS FULL      | NOTIFICATIONS |    1 | 50000 | 50000 |00:00:00.60 |     6K |
-----------------------------------------------------------------------------------------------------

Predicate Information:
   1 - filter("USER_ID"=:USER_ID AND "IS_READ"=0)`,
        tunedPlanText: `SQL_ID  qr1st2uv3, child number 1
Plan hash value: 3948271590

----------------------------------------------------------------------------------------------------------------
| Id  | Operation                    | Name                  | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
----------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT            |                      |    1 |       |  5000 |00:00:00.10 |     1K |
|   1 |  TABLE ACCESS BY INDEX ROWID| NOTIFICATIONS        |    1 |  5000 |  5000 |00:00:00.10 |    596 |
|*  2 |   INDEX RANGE SCAN          | IDX_NOTIF_USER_READ  |    1 |  5000 |  5000 |00:00:00.00 |    508 |
----------------------------------------------------------------------------------------------------------------

Predicate Information:
   2 - access("USER_ID"=:USER_ID AND "IS_READ"=0)`,
        indexDdl: 'CREATE INDEX IDX_NOTIF_USER_READ ON NOTIFICATIONS(user_id, is_read) TABLESPACE IDX_TS ONLINE;',
        tunedSqlText: `/* 인덱스 생성 후 동일 SQL — 실행계획만 변경됨 */
SELECT n.notification_id, n.message, n.sent_at
  FROM NOTIFICATIONS n
 WHERE n.user_id = :uid
   AND n.is_read = 0
 ORDER BY n.sent_at DESC`,
      },
    ],
  },

  'WI-2024-040': {
    workItemId: 'WI-2024-040',
    selectedPlanId: 'WI-2024-040-A',
    plans: [
      {
        id: 'WI-2024-040-A',
        label: '튜닝안 A',
        types: ['hint'],
        verifyType: 'actual',
        improvementRate: -85,
        bindSetId: 'BS-040-1',
        summary: 'DOCUMENTS 폴더 문서 조회에 LEADING + INDEX 힌트 적용으로 드라이빙 테이블 순서 변경',
        rationale: [
          'DOCUMENTS(50,000건) + FOLDERS(1,000건) HASH JOIN — DOCUMENTS FULL SCAN Cost 650이 전체의 78%',
          '옵티마이저가 DOCUMENTS를 빌드 테이블로 선택했으나, FOLDERS 드라이빙 시 owner_id 필터로 100건만 추출 가능',
          'LEADING(d) INDEX(d IDX_DOC_FOLDER) 힌트로 folder_id 기반 인덱스 액세스 전환',
          'HASH JOIN → NESTED LOOPS 전환으로 Cost 830 → 83 (90% 감소), DOCUMENTS FULL SCAN 제거',
        ],
        originalElapsed: 3200,
        tunedElapsed: 480,
        originalBuffers: 330000,
        tunedBuffers: 33000,
        originalDiskReads: 33000,
        tunedDiskReads: 3300,
        originalPlanText: `SQL_ID  wx4yz5ab6, child number 0
Plan hash value: 1847372590

-----------------------------------------------------------------------------------------------------
| Id  | Operation                | Name           | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-----------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT        |               |    1 |       | 20000 |00:00:00.41 |     9K |
|*  1 |   HASH JOIN             |               |    1 | 20000 | 20000 |00:00:00.41 |     3K |
|   2 |    TABLE ACCESS FULL    | DOCUMENTS     |    1 | 50000 | 50000 |00:00:00.32 |     6K |
|   3 |    TABLE ACCESS FULL    | FOLDERS       |    1 |  1000 |  1000 |00:00:00.06 |    196 |
-----------------------------------------------------------------------------------------------------

Predicate Information:
   1 - access("D"."FOLDER_ID"="F"."FOLDER_ID")
       filter("F"."OWNER_ID"=:USER_ID)`,
        tunedPlanText: `SQL_ID  wx4yz5ab6, child number 1
Plan hash value: 2938471590

-------------------------------------------------------------------------------------------------------------
| Id  | Operation                     | Name              | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
-------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT             |                  |    1 |       | 20000 |00:00:00.10 |     2K |
|*  1 |  NESTED LOOPS                |                  |    1 | 20000 | 20000 |00:00:00.10 |     2K |
|*  2 |   TABLE ACCESS BY INDEX ROWID| FOLDERS          |    1 |   100 |   100 |00:00:00.01 |     20 |
|*  3 |    INDEX RANGE SCAN          | IDX_FLD_OWNER    |    1 |   100 |   100 |00:00:00.00 |     12 |
|*  4 |   INDEX RANGE SCAN           | IDX_DOC_FOLDER   |    1 |   200 |   200 |00:00:00.00 |     24 |
-------------------------------------------------------------------------------------------------------------

Predicate Information:
   2 - filter("F"."OWNER_ID"=:USER_ID)
   3 - access("F"."OWNER_ID"=:USER_ID)
   4 - access("D"."FOLDER_ID"="F"."FOLDER_ID")`,
        tunedSqlText: `SELECT /*+ LEADING(d) INDEX(d IDX_DOC_FOLDER) */
       d.doc_id, d.doc_name, d.version, d.modified_by
  FROM DOCUMENTS d
 WHERE d.folder_id = :fid
   AND d.is_deleted = 0
 ORDER BY d.modified_at DESC`,
      },
    ],
  },
  'WI-2024-052': {
    workItemId: 'WI-2024-052',
    selectedPlanId: 'WI-2024-052-A',
    plans: [
      {
        id: 'WI-2024-052-A',
        label: '튜닝안 A',
        types: ['rewrite'],
        verifyType: 'actual',
        improvementRate: 98.9,
        bindSetId: 'BS-052-1',
        summary: '구성항목명 스칼라 서브쿼리를 인라인뷰로 변환하여 HASH JOIN 유도, 858K → 4,944 블록으로 99.4% I/O 감소',
        rationale: [
          '구성항목명 컬럼의 스칼라 서브쿼리가 메인 집합(12건) × OPS_CONFIG(55,185건) = 662,000회 반복 스캔 → 전체 858K 블록 I/O의 99% 차지',
          'OPS_CONFIG, OPS_WF_CONFIG 간 상관 서브쿼리를 인라인뷰로 변환하여 HASH JOIN 유도',
          'JOIN FILTER CREATE(:BF0000)로 메인 테이블 12건의 조건을 인라인뷰에 사전 필터링 → 불필요한 조인 제거',
          '858K 블록 → 4,944 블록으로 99.4% I/O 감소, 4.38초 → 0.05초로 98.9% 응답시간 개선',
        ],
        originalElapsed: 4380,
        tunedElapsed: 50,
        originalBuffers: 858000,
        tunedBuffers: 4944,
        originalDiskReads: 85800,
        tunedDiskReads: 494,
        originalPlanText: `Plan hash value: 3144043503

| Id  | Operation                             | Name             | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
|   0 | SELECT STATEMENT                      |                  |      1 |        |     12 |00:00:04.38 |     858K|
|   1 |  SORT UNIQUE                          |                  |      2 |      1 |      1 |00:00:00.01 |      15 |
|*  2 |   COUNT STOPKEY                       |                  |      2 |        |      1 |00:00:00.01 |      11 |
|   3 |    TABLE ACCESS BY INDEX ROWID BATCHED| OPS_INCIDENT_WF       |      2 |      1 |      1 |00:00:00.01 |      11 |
|  19 |  SORT GROUP BY                        |                  |     12 |      1 |     12 |00:00:04.37 |     858K|
|* 20 |   FILTER                              |                  |     12 |        |      1 |00:00:04.37 |     858K|
|  21 |    TABLE ACCESS FULL                  | OPS_CONFIG           |     12 |  55185 |    662K|00:00:00.41 |   51456 |
|* 22 |    TABLE ACCESS BY INDEX ROWID BATCHED| OPS_WF_CONFIG        |    662K|      1 |      1 |00:00:02.71 |     806K|
|* 23 |     INDEX RANGE SCAN                  | OPS_WF_CFG_01     |    662K|      4 |  74986 |00:00:01.83 |     747K|
|  24 |  SORT ORDER BY                        |                  |      1 |     11 |     12 |00:00:04.38 |     858K|
|* 25 |   TABLE ACCESS FULL                   | OPS_INCIDENT          |      1 |     11 |     12 |00:00:00.01 |     127 |

Predicate Information (identified by operation id):
---------------------------------------------------

   2 - filter(ROWNUM=1)
  20 - filter(IS NOT NULL)
  22 - filter("WFC_SRC_ID"=:B1)
  23 - access("WFC_CM_ID"="CM_ID")
  25 - filter("ICM_TAS_ID" NOT IN ('TAS03454','TICM21020','TICM21030') AND "ICM_REQ_DTTM">=:B1||'000000' AND "ICM_REQ_DTTM"<=:B2||'235959')`,
        tunedPlanText: `Plan hash value: 1977669637

| Id  | Operation                             | Name             | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
|   0 | SELECT STATEMENT                      |                  |      1 |        |     12 |00:00:00.05 |    4944 |
|   1 |  SORT UNIQUE                          |                  |      2 |      1 |      1 |00:00:00.01 |      15 |
|  19 |  SORT ORDER BY                        |                  |      1 |      1 |     12 |00:00:00.05 |    4944 |
|* 20 |   FILTER                              |                  |      1 |        |     12 |00:00:00.04 |    4542 |
|* 21 |    HASH JOIN OUTER                    |                  |      1 |      1 |     12 |00:00:00.04 |    4542 |
|  22 |     JOIN FILTER CREATE                | :BF0000          |      1 |      1 |     12 |00:00:00.01 |     127 |
|* 23 |      TABLE ACCESS FULL                | OPS_INCIDENT          |      1 |      1 |     12 |00:00:00.01 |     127 |
|  24 |     VIEW                              |                  |      1 |   2717 |      2 |00:00:00.04 |    4415 |
|  25 |      SORT GROUP BY                    |                  |      1 |   2717 |      2 |00:00:00.04 |    4415 |
|* 29 |          HASH JOIN                    |                  |      1 |   7330 |   6250 |00:00:00.04 |    4415 |
|  30 |           TABLE ACCESS FULL           | OPS_WF_CONFIG        |      1 |   8167 |   8748 |00:00:00.01 |     126 |
|  31 |           TABLE ACCESS FULL           | OPS_CONFIG           |      1 |  55185 |  55214 |00:00:00.03 |    4288 |

Predicate Information (identified by operation id):
---------------------------------------------------

  20 - filter(:B2||'235959'>=:B1||'000000')
  21 - access("V"."WFC_SRC_ID"="ICM"."ICM_ID")
  23 - filter("ICM_TAS_ID" NOT IN ('TAS03454','TICM21020','TICM21030') AND "ICM_REQ_DTTM">=:B1||'000000' AND "ICM_REQ_DTTM"<=:B2||'235959')
  29 - access("WFC_CM_ID"="CM_ID")`,
        tunedSqlText: `select inc_id -- 장애 ID
     , inc_id as key
     , inc_tas_id as tas_id -- 단계
     , get_stepname(inc_tas_id) as tas_name  -- 단계명
     , get_dept_name(inc_reg_emp_id) as empdpt_name   -- 요청부서
     , get_emp_name(inc_reg_emp_id) as emp_name   -- 요청자
     , get_code_label(inc_work_area_cd) as work_area_name -- 장애구분
     , nvl(inc_req_title,'제목없음') as req_title -- 제목
     , inc_grade_cd AS grade_cd   --장애등급
     , get_code_label(inc_grade_cd) AS grade_name --장애등급명
     , inc_med_cd as med_cd    -- 장애인지경로
     , get_code_label(inc_med_cd) as med_name -- 장애인지경로명
     , decode(inc_wor_yn,'1','가동','미가동') as wor_yn --장애처리반가동여부
     , decode(inc_sol_cd,'ICMSOL09',get_dept_name(inc_prt_ass_emp_id),(SELECT DISTINCT get_dept_name(iwf_emp_id) FROM ops_incident_wf WHERE iwf_src_id = inc_id AND iwf_tas_id = 'TICM12010' AND rownum =1)) AS ass_dpt_name
     , decode(inc_sol_cd,'ICMSOL09',get_emp_name(inc_prt_ass_emp_id),(SELECT DISTINCT get_emp_name(iwf_emp_id) FROM ops_incident_wf WHERE iwf_src_id = inc_id AND iwf_tas_id = 'TICM12010' AND rownum =1)) AS ass_emp_name
     , fmt_datetime(inc_dcs_rec_dttm) as dec_rec_dttm -- 인지일시
     , inc_imp_cd AS imp_cd -- 영향도
     , get_code_label(inc_imp_cd) AS imp_name   -- 영향도명
     , fmt_datetime(inc_actstart_dttm) as rec_dttm -- 장애발생일시
     , fmt_datetime(inc_actfinish_dttm) as actfinish_dttm -- 조치완료일시
     , decode(inc_rel_dttm,'','',inc_rel_dttm||'분') as rel_dttm -- 총 장애시간
     , decode(inc_svc_stop_yn,'1','중단','무중단') as svc_stop_yn
     , cm_name  -- 구성항목명 (스칼라서브쿼리→인라인뷰 변환)
     , inc_cas_cd as cas_cd -- 장애원인
     , get_code_label(inc_cas_cd) as cas_name -- 장애원인명
     , decode(inc_sol_yn,'1','완전해결','임시해결') as sol_yn
     , inc_slo_cd as slo_cd -- 장애해결유형
     , get_code_label(inc_slo_cd) as slo_name
     , decode(inc_act_mh,'','',inc_act_mh||'(M/H)') as act_mh
from ops_incident icm
     , (  -- ★ 스칼라서브쿼리를 인라인뷰로 변환
         select listagg(cm_name, ',') within group(order by cm_name) as cm_name, ewc.wcf_src_id
         from ops_config ec, (select wcf_cm_id, wcf_src_id
                         from ops_wf_config
                         where 1=1
                         group by wcf_src_id, wcf_cm_id) ewc
         where ec.cm_id = ewc.wcf_cm_id
         group by wcf_src_id
       ) v
where inc_tas_id not in ('TAS03454','TICM21020','TICM21030','TICM22010','TICM23010','TICM24010','TICM25010','TICM25030')
 and INC_REQ_DTTM between :B1 || '000000' and :B2 || '235959'
 and v.wcf_src_id (+) = icm.inc_id   -- ★ OUTER JOIN으로 연결
order by inc_actstart_dttm desc, inc_id desc`,
        indexDdl: '',
      },
    ],
  },
  'WI-2024-053': {
    workItemId: 'WI-2024-053',
    selectedPlanId: 'WI-2024-053-A',
    plans: [
      {
        id: 'WI-2024-053-A',
        label: '튜닝안 A',
        types: ['rewrite'],
        verifyType: 'actual',
        improvementRate: 72.5,
        bindSetId: 'BS-053-1',
        summary: 'GET_EMP_NAME PL/SQL 함수 ~17만건 호출을 스칼라 서브쿼리로 변환, GET_CURRENT_TS() → TO_CHAR(SYSDATE) 대체로 context switching 제거',
        rationale: [
          'GET_EMP_NAME PL/SQL 함수가 cond1에서 12만건, cond7에서 2.4만건, cond2에서 1만건, cond4에서 2.6만건 호출 → 총 ~17만건의 context switching 부하',
          'GET_CURRENT_TS() 함수도 반복 호출되어 불필요한 PL/SQL 엔진 전환 발생',
          'GET_EMP_NAME → (select emp_name from hr_employee where emp_id = :id) 스칼라 서브쿼리로 변환하여 SQL 엔진 내에서 처리',
          'GET_CURRENT_TS() → TO_CHAR(SYSDATE, \'yyyymmddhh24miss\')로 변환하여 함수 호출 제거',
          '14.96초 → 4.11초로 72.5% 개선, 540K → 262K 블록으로 I/O 51% 감소',
        ],
        originalElapsed: 14960,
        tunedElapsed: 4110,
        originalBuffers: 540000,
        tunedBuffers: 262000,
        originalDiskReads: 54000,
        tunedDiskReads: 26200,
        originalPlanText: `Plan hash value: 647199995

| Id  | Operation                                     | Name                | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
|   0 | SELECT STATEMENT                              |                     |      1 |        |      0 |00:00:14.96 |     540K|
|   1 |  SORT ORDER BY                                |                     |      1 |      1 |      0 |00:00:14.96 |     540K|
|*  2 |   FILTER                                      |                     |      1 |        |      0 |00:00:14.96 |     540K|
|*  3 |    HASH JOIN                                  |                     |      1 |  60780 |  21751 |00:00:14.89 |     536K|
|  19 |         TABLE ACCESS BY INDEX ROWID           | HR_EMPLOYEE        |    120K|      1 |    120K|00:00:05.12 |     240K|
|* 20 |          INDEX RANGE SCAN                     | IX_HR_EMP_07  |    120K|      1 |    120K|00:00:01.42 |     120K|
|  95 |         TABLE ACCESS BY INDEX ROWID           | HR_EMPLOYEE        |   24.3K|      1 |   24.3K|00:00:01.51 |    48.7K|
|* 96 |          INDEX RANGE SCAN                     | IX_HR_EMP_07  |   24.3K|      1 |   24.3K|00:00:00.34 |    24.4K|

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - filter(ROWNUM<=:B1)
  3 - access("A"."ID"="B"."REF_ID")
 20 - access("IX_HR_EMP_07"."KEY_COL">=:B1)
 96 - access("IX_HR_EMP_07"."KEY_COL">=:B1)`,
        tunedPlanText: `Plan hash value: 3832521299

| Id  | Operation                                     | Name                | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
|   0 | SELECT STATEMENT                              |                     |      1 |        |      0 |00:00:04.11 |     262K|
|   1 |  SORT ORDER BY                                |                     |      1 |      1 |      0 |00:00:04.11 |     262K|
|*  2 |   FILTER                                      |                     |      1 |        |      0 |00:00:04.11 |     262K|
|*  3 |    HASH JOIN                                  |                     |      1 |  60607 |  21795 |00:00:04.04 |     258K|
|  19 |         TABLE ACCESS BY INDEX ROWID           | HR_EMPLOYEE        |    120K|      1 |    120K|00:00:00.62 |     120K|
|* 20 |          INDEX RANGE SCAN                     | IX_HR_EMP_09  |    120K|      1 |    120K|00:00:00.21 |      60K|

Predicate Information (identified by operation id):
---------------------------------------------------

  2 - filter(ROWNUM<=:B1)
  3 - access("A"."ID"="B"."REF_ID")
 20 - access("IX_HR_EMP_09"."KEY_COL">=:B1)`,
        tunedSqlText: `/* TASK_TODO_Mail_Cond Created By STEG. */
select id as key, ent_id, tsk_req_emp_id as emp_id,
       'admin@example.com' as emp_email, 'kr' as user_charset
from (
  SELECT /* 메인 : 나의 할일 리스트 */
    T.id AS ID, E.TAS_ENT_ID AS ENT_ID, t.tsk_cat_cd,
    (select emp_name from hr_employee where emp_id = tsk_req_emp_id) as req_emp_name,  -- modified by exem
    (select emp_name from hr_employee where emp_id = tsk_ass_emp_id) as ass_emp_name,  -- modified by exem
    TO_CHAR(SYSDATE,'yyyymmddhh24miss') as sys_date                                    -- modified by exem
  FROM OPS_TASK T, WF_TASK E, WF_ACTIVITY A, WF_WORKFLOW W
  WHERE T.TSK_TAS_ID = E.TAS_ID
    AND E.TAS_ACT_ID = A.ACT_ID AND A.ACT_WOF_ID = W.WOF_ID
    /* ... UNION ALL of 19 cond blocks (GET_EMP_NAME → scalar subquery) ... */
  ORDER BY id
) WHERE ROWNUM <= 100`,
        indexDdl: '',
      },
    ],
  },
  'WI-2024-054': {
    workItemId: 'WI-2024-054',
    selectedPlanId: 'WI-2024-054-A',
    plans: [
      {
        id: 'WI-2024-054-A',
        label: '튜닝안 A',
        types: ['rewrite'],
        verifyType: 'actual',
        improvementRate: 57.5,
        bindSetId: 'BS-054-1',
        summary: 'FMT_DATETIME/GET_DEPT_NAME/GET_EMP_NAME/GET_CURRENT_TS PL/SQL 함수를 SQL 표현식 및 스칼라 서브쿼리로 변환, 1.86초 → 0.79초 개선',
        rationale: [
          'FMT_DATETIME 함수 호출을 CASE + TO_DATE/TO_CHAR로 변환하여 PL/SQL context switching 제거',
          'GET_DEPT_NAME → hr_employee + hr_dept 스칼라 서브쿼리 2단계 변환',
          'GET_EMP_NAME → hr_employee 스칼라 서브쿼리 직접 변환',
          'GET_CURRENT_TS() → TO_CHAR(SYSDATE, \'yyyymmddhh24miss\')로 대체하여 deterministic 표현식으로 변환, IX_HR_EMP_07 필터 시간 1.07초 → 0.07초',
          '1.86초 → 0.79초로 57.5% 개선, FAST DUAL 제거 및 인덱스 직접 접근으로 I/O 패턴 개선',
        ],
        originalElapsed: 1860,
        tunedElapsed: 790,
        originalBuffers: 62350,
        tunedBuffers: 61658,
        originalDiskReads: 6235,
        tunedDiskReads: 6166,
        originalPlanText: `Plan hash value: 3587086750

| Id  | Operation                               | Name                | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
|   0 | SELECT STATEMENT                        |                     |      1 |        |     28 |00:00:01.86 |   62350 |
|  12 |  SORT ORDER BY                          |                     |      1 |  54509 |     28 |00:00:01.86 |   62350 |
|* 13 |   FILTER                                |                     |      1 |        |     28 |00:00:01.85 |   62196 |
|* 14 |    HASH JOIN                            |                     |      1 |  77087 |  36160 |00:00:00.48 |   15244 |
|   6 |  FAST DUAL                              |                     |     25 |      1 |     25 |00:00:00.01 |       0 |
|   7 |  FAST DUAL                              |                     |     21 |      1 |     21 |00:00:00.01 |       0 |
|   8 |  FAST DUAL                              |                     |     21 |      1 |     21 |00:00:00.01 |       0 |
|  21 |       TABLE ACCESS BY INDEX ROWID       | HR_EMPLOYEE        |  14378 |      1 |  14378 |00:00:01.07 |   28804 |
|* 22 |        INDEX RANGE SCAN                 | IX_HR_EMP_07  |  14378 |      1 |  14378 |00:00:00.17 |   14426 |

Predicate Information (identified by operation id):
---------------------------------------------------

 13 - filter(ROWNUM<=:B1)
 14 - access("A"."ID"="B"."REF_ID")
 22 - access("IX_HR_EMP_07"."KEY_COL">=:B1)`,
        tunedPlanText: `Plan hash value: 3856812218

| Id  | Operation                               | Name                | Starts | E-Rows | A-Rows |   A-Time   | Buffers |
|   0 | SELECT STATEMENT                        |                     |      1 |        |     28 |00:00:00.79 |   61658 |
|  13 |  SORT ORDER BY                          |                     |      1 |  54509 |     28 |00:00:00.79 |   61658 |
|* 14 |   FILTER                                |                     |      1 |        |     28 |00:00:00.78 |   61565 |
|* 15 |    HASH JOIN                            |                     |      1 |  77087 |  36164 |00:00:00.46 |   15244 |
|   6 |  TABLE ACCESS BY INDEX ROWID            | HR_DEPT            |     16 |      1 |     15 |00:00:00.01 |      24 |
|*  8 |  INDEX RANGE SCAN                       | IX_HR_EMP_08  |     21 |      1 |     21 |00:00:00.01 |      23 |
|*  9 |  INDEX RANGE SCAN                       | IX_HR_EMP_09  |     21 |      1 |     21 |00:00:00.01 |      23 |
|  22 |       TABLE ACCESS BY INDEX ROWID       | HR_EMPLOYEE        |  14382 |      1 |  14382 |00:00:00.07 |   28812 |
|* 23 |        INDEX RANGE SCAN                 | IX_HR_EMP_07  |  14382 |      1 |  14382 |00:00:00.02 |   14430 |

Predicate Information (identified by operation id):
---------------------------------------------------

 14 - filter(ROWNUM<=:B1)
 15 - access("A"."ID"="B"."REF_ID")
  8 - access("IX_HR_EMP_08"."KEY_COL">=:B1)
  9 - access("IX_HR_EMP_09"."KEY_COL">=:B1)
 23 - access("IX_HR_EMP_07"."KEY_COL">=:B1)`,
        tunedSqlText: `SELECT /* 메인 : 나의 할일 리스트 */
    T.TSK_SR_ID AS APR_ID,
    T.TSK_SR_ID AS ID,
    E.TAS_ENT_ID AS ENT_ID,
    E.TAS_ID, E.TAS_NAME,
    case when T.TSK_REQ_DTTM is null then null
         else to_char(to_date(T.TSK_REQ_DTTM,'yyyymmddhh24miss'), 'yyyy-mm-dd hh24:mi')
    end AS REQ_DTTM,                                                    -- modified by exem
    (select (select dpt_name from hr_dept where dpt_id = emp_dpt_id)
     from hr_employee where emp_id = T.TSK_REQ_EMP_ID) as REQ_DPT_NAME, -- modified by exem
    (select emp_name from hr_employee where emp_id = T.TSK_REQ_EMP_ID) as REQ_EMP_NAME, -- modified by exem
    (SELECT GET_EMP_NAME(TSK_ASS_EMP_ID) FROM DUAL) AS ASS_NAME
FROM OPS_TASK T, WF_TASK E, WF_ACTIVITY A, WF_WORKFLOW W
WHERE T.TSK_TAS_ID = E.TAS_ID
  AND E.TAS_TYPE IN ('1','2','4')
  AND E.TAS_ACT_ID = A.ACT_ID
  AND A.ACT_WOF_ID = W.WOF_ID
  AND T.TSK_ENT_ID NOT IN ('PMS','PTC','PRSK','PREQ','PFAM','PAI')
  AND ((TSK_ASS_EMP_ID = :1 AND TSK_TAS_ID NOT IN ('TAS03165','TCSR12010'))
    OR (TSK_ASS_WOG_ID IN (SELECT MEM_WOG_ID FROM HR_MEMBER WHERE MEM_EMP_ID = :2))
    OR (TSK_ASS_EMP_ID IN (SELECT EMP_ID FROM HR_EMPLOYEE
        WHERE TO_CHAR(SYSDATE,'yyyymmddhh24miss') BETWEEN EMP_AGCSTART_DTTM AND EMP_AGCFINISH_DTTM
        AND EMP_AGC_EMP_ID = :7)))                                       -- modified by exem
ORDER BY REQ_DTTM DESC`,
        indexDdl: '',
      },
    ],
  },
}
