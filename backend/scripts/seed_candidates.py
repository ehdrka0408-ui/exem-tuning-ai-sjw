"""추가 mock SQL (candidates.ts) as-is plan만 저장. 기존 데이터는 유지."""
from __future__ import annotations

from app.db.session import SessionLocal
from app.models import TuningCase, Plan, BindVariable


CANDIDATE_CASES = [
    dict(
        title="EMP 고연봉 최근입사자 조회",
        category="top_sql_candidate",
        sql_id="abc1234567890",
        schema_name="HR",
        instance_name="PROD-DB2",
        status="pending",
        owner="ai",
        source="maxgauge",
        sql_text="""SELECT e.emp_id, e.salary, d.dept_name
FROM EMP e
JOIN DEPT d ON e.dept_id = d.dept_id
WHERE e.hire_date >= ADD_MONTHS(SYSDATE, -12)
ORDER BY e.salary DESC""",
        rationale="최근 1년 입사자 조회. EMP FULL SCAN + HASH JOIN 후 SORT. hire_date 인덱스 활용 여지 분석 필요.",
        plans=[
            dict(phase="before", plan_hash="3821104567", elapsed_sec=1.24, buffers=18520,
                 plan_text="""Plan hash value: 3821104567
-----------------------------------------------------------------------------
| Id  | Operation              | Name   | Rows  | Bytes | Cost (%CPU)| Time |
-----------------------------------------------------------------------------
|   0 | SELECT STATEMENT       |        |  8200 |   520K|  412   (2) | 00:00:01 |
|   1 |  SORT ORDER BY         |        |  8200 |   520K|  412   (2) | 00:00:01 |
|*  2 |   HASH JOIN            |        |  8200 |   520K|  398   (1) | 00:00:01 |
|   3 |    TABLE ACCESS FULL   | DEPT   |   120 |  2400 |    3   (0) | 00:00:01 |
|*  4 |    TABLE ACCESS FULL   | EMP    |  8200 |   360K|  394   (1) | 00:00:01 |
-----------------------------------------------------------------------------
Predicate Information:
   2 - access("E"."DEPT_ID"="D"."DEPT_ID")
   4 - filter("E"."HIRE_DATE">=ADD_MONTHS(SYSDATE@!,-12))"""),
        ],
        binds=[],
    ),
    dict(
        title="고객별 YTD 주문금액 집계",
        category="top_sql_candidate",
        sql_id="def9876543210",
        schema_name="SALES",
        instance_name="PROD-DB1",
        status="pending",
        owner="ai",
        source="awr",
        sql_text="""SELECT c.cust_id, c.cust_name, SUM(o.total_amount) ytd
FROM CUSTOMERS c
LEFT JOIN ORDERS o ON c.cust_id = o.customer_id
WHERE o.order_date >= TRUNC(SYSDATE, 'YYYY')
GROUP BY c.cust_id, c.cust_name""",
        rationale="LEFT JOIN + WHERE 절의 join 대상 필터로 OUTER 의미가 무력화됨(INNER로 해석). YTD 파티션 프루닝 여부 확인 필요.",
        plans=[
            dict(phase="before", plan_hash="1924857613", elapsed_sec=5.42, buffers=124800,
                 plan_text="""Plan hash value: 1924857613
---------------------------------------------------------------------------------
| Id  | Operation               | Name      | Rows | Bytes | Cost (%CPU)| Time  |
---------------------------------------------------------------------------------
|   0 | SELECT STATEMENT        |           |  45K | 3520K | 2310  (3)  | 00:00:28 |
|   1 |  HASH GROUP BY          |           |  45K | 3520K | 2310  (3)  | 00:00:28 |
|*  2 |   HASH JOIN             |           |  82K | 6400K | 2287  (2)  | 00:00:28 |
|   3 |    TABLE ACCESS FULL    | CUSTOMERS |  50K | 1200K |  128  (1)  | 00:00:02 |
|*  4 |    TABLE ACCESS FULL    | ORDERS    |  82K | 4800K | 2152  (2)  | 00:00:26 |
---------------------------------------------------------------------------------
Predicate Information:
   2 - access("C"."CUST_ID"="O"."CUSTOMER_ID")
   4 - filter("O"."ORDER_DATE">=TRUNC(SYSDATE@!,'fmyyyy'))"""),
        ],
        binds=[],
    ),
    dict(
        title="매장별 당일 매출 집계",
        category="top_sql_candidate",
        sql_id="ccc_new_sql_001",
        schema_name="RETAIL",
        instance_name="PROD-DB3",
        status="pending",
        owner="ai",
        source="vsql",
        sql_text="""SELECT s.store_id, s.store_name, SUM(t.sale_amount) total_sales
FROM STORES s
JOIN TRANSACTIONS t ON s.store_id = t.store_id
WHERE t.txn_date >= TRUNC(SYSDATE)
GROUP BY s.store_id, s.store_name
ORDER BY total_sales DESC""",
        rationale="당일 트랜잭션만 필터. TRANSACTIONS 일자 파티션/LOCAL 인덱스 필요 여부 확인.",
        plans=[
            dict(phase="before", plan_hash="2651087432", elapsed_sec=0.92, buffers=8340,
                 plan_text="""Plan hash value: 2651087432
----------------------------------------------------------------------------------
| Id  | Operation                | Name         | Rows | Cost (%CPU)| Pstart| Pstop|
----------------------------------------------------------------------------------
|   0 | SELECT STATEMENT         |              | 1200 |  285   (1) |       |      |
|   1 |  SORT ORDER BY           |              | 1200 |  285   (1) |       |      |
|   2 |   HASH GROUP BY          |              | 1200 |  285   (1) |       |      |
|*  3 |    HASH JOIN             |              | 18K  |  279   (1) |       |      |
|   4 |     TABLE ACCESS FULL    | STORES       | 1200 |    8   (0) |       |      |
|   5 |     PARTITION RANGE SINGLE|             | 18K  |  270   (1) |  KEY  |  KEY |
|*  6 |      TABLE ACCESS FULL   | TRANSACTIONS | 18K  |  270   (1) |  KEY  |  KEY |
----------------------------------------------------------------------------------
Predicate Information:
   3 - access("S"."STORE_ID"="T"."STORE_ID")
   6 - filter("T"."TXN_DATE">=TRUNC(SYSDATE@!))"""),
        ],
        binds=[],
    ),
]


def seed():
    db = SessionLocal()
    try:
        existing = {c.sql_id for c in db.query(TuningCase).filter(TuningCase.sql_id.isnot(None)).all()}
        added = 0
        for c in CANDIDATE_CASES:
            if c["sql_id"] in existing:
                continue
            plans = c.pop("plans", [])
            binds = c.pop("binds", [])
            case = TuningCase(**c)
            db.add(case)
            db.flush()
            for p in plans:
                db.add(Plan(case_id=case.id, **p))
            for i, b in enumerate(binds, start=1):
                b.setdefault("position", i)
                db.add(BindVariable(case_id=case.id, **b))
            added += 1
        db.commit()
        n_cases = db.query(TuningCase).count()
        n_plans = db.query(Plan).count()
        print(f"added {added} candidate cases. total: cases={n_cases}, plans={n_plans}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
