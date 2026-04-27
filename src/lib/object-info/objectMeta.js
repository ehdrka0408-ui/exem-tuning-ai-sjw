// Mock object metadata.
//
// Plan-usage markers (per table, at most one of each):
//   planUsage: "ASIS"  — current execution plan accesses the table via this index
//   planUsage: "TOBE"  — proposed (post-tuning) plan would use this index
//   planUsage: "BOTH"  — same index used before and after (no change)
//   (absent)           — index exists but is not selected by either plan
//
// `isNew: true` marks a TO-BE index that does NOT currently exist.

export const OBJECT_META = {
  orders: {
    name: "ORDERS", type: "TABLE", schema: "SALES",
    totalRows: 12483217, avgRowBytes: 168, lastAnalyzed: "2026-04-08 02:14",
    columns: [
      { name: "ORDER_ID",     type: "NUMBER(12)",   nullable: false, distinct: 12483217, nullCount: 0 },
      { name: "ORDER_DATE",   type: "DATE",         nullable: false, distinct:     1095, nullCount: 0 },
      { name: "CUSTOMER_ID",  type: "NUMBER(10)",   nullable: false, distinct:   847219, nullCount: 0 },
      { name: "SALES_REP_ID", type: "NUMBER(10)",   nullable: true,  distinct:      482, nullCount: 312004 },
      { name: "STATUS",       type: "VARCHAR2(20)", nullable: false, distinct:        6, nullCount: 0 },
      { name: "PRIORITY",     type: "CHAR(1)",      nullable: false, distinct:        4, nullCount: 0 },
      { name: "TOTAL",        type: "NUMBER(14,2)", nullable: true,  distinct:  3912004, nullCount: 1204 },
      { name: "DISCOUNT_PCT", type: "NUMBER(5,2)",  nullable: true,  distinct:       41, nullCount: 8840021 },
      { name: "SHIPPED_AT",   type: "TIMESTAMP",    nullable: true,  distinct:  9104332, nullCount: 218442 },
      { name: "CREATED_AT",   type: "TIMESTAMP",    nullable: false, distinct: 12481044, nullCount: 0 },
    ],
    indexes: [
      { name: "PK_ORDERS",              type: "UNIQUE", columns: ["ORDER_ID"] },
      { name: "IDX_ORDERS_CUST_DATE",   type: "NORMAL", columns: ["CUSTOMER_ID", "ORDER_DATE"] },
      { name: "IDX_ORDERS_DATE_STATUS", type: "NORMAL", columns: ["ORDER_DATE", "STATUS"], planUsage: "ASIS",
        rationale: "현재 플랜: order_date BETWEEN + status 필터로 range scan" },
      { name: "IDX_ORDERS_STATUS",      type: "BITMAP", columns: ["STATUS"] },
      { name: "IDX_ORDERS_PRIORITY",    type: "BITMAP", columns: ["PRIORITY"] },
      { name: "IDX_ORDERS_REP",         type: "NORMAL", columns: ["SALES_REP_ID", "ORDER_DATE"] },
      { name: "IDX_ORDERS_SHIPPED",     type: "NORMAL", columns: ["SHIPPED_AT"] },
      { name: "IDX_ORDERS_CREATED",     type: "NORMAL", columns: ["CREATED_AT"] },
      { name: "IDX_ORDERS_DATE_STAT_CUST", type: "NORMAL", columns: ["ORDER_DATE", "STATUS", "CUSTOMER_ID"],
        planUsage: "TOBE", isNew: true,
        rationale: "제안 플랜: date/status 필터 + customer join 키를 커버링" },
    ],
  },

  order_items: {
    name: "ORDER_ITEMS", type: "TABLE", schema: "SALES",
    totalRows: 48921004, avgRowBytes: 94, lastAnalyzed: "2026-04-08 02:14",
    columns: [
      { name: "ORDER_ITEM_ID", type: "NUMBER(14)",   nullable: false, distinct: 48921004, nullCount: 0 },
      { name: "ORDER_ID",      type: "NUMBER(12)",   nullable: false, distinct: 12483217, nullCount: 0 },
      { name: "PRODUCT_ID",    type: "NUMBER(10)",   nullable: false, distinct:    82417, nullCount: 0 },
      { name: "WAREHOUSE_ID",  type: "NUMBER(6)",    nullable: false, distinct:      142, nullCount: 0 },
      { name: "QUANTITY",      type: "NUMBER(8)",    nullable: false, distinct:      512, nullCount: 0 },
      { name: "UNIT_PRICE",    type: "NUMBER(12,2)", nullable: false, distinct:   312049, nullCount: 0 },
      { name: "LINE_STATUS",   type: "VARCHAR2(20)", nullable: false, distinct:        5, nullCount: 0 },
      { name: "CREATED_AT",    type: "TIMESTAMP",    nullable: false, distinct: 48910022, nullCount: 0 },
    ],
    indexes: [
      { name: "PK_ORDER_ITEMS",   type: "UNIQUE", columns: ["ORDER_ITEM_ID"] },
      { name: "UK_OI_ORDER_PROD", type: "UNIQUE", columns: ["ORDER_ID", "PRODUCT_ID"], planUsage: "TOBE",
        rationale: "제안 플랜: 기존 UK로 order+product 동시 커버" },
      { name: "IDX_OI_ORDER",     type: "NORMAL", columns: ["ORDER_ID"], planUsage: "ASIS",
        rationale: "현재 플랜: order_id nested-loop lookup" },
      { name: "IDX_OI_PRODUCT",   type: "NORMAL", columns: ["PRODUCT_ID", "LINE_STATUS"] },
      { name: "IDX_OI_WAREHOUSE", type: "NORMAL", columns: ["WAREHOUSE_ID", "PRODUCT_ID"] },
      { name: "IDX_OI_PROD_QTY",  type: "NORMAL", columns: ["PRODUCT_ID", "QUANTITY"] },
      { name: "IDX_OI_STATUS",    type: "BITMAP", columns: ["LINE_STATUS"] },
    ],
  },

  customers: {
    name: "CUSTOMERS", type: "TABLE", schema: "SALES",
    totalRows: 847219, avgRowBytes: 248, lastAnalyzed: "2026-04-07 23:51",
    columns: [
      { name: "CUSTOMER_ID",   type: "NUMBER(10)",    nullable: false, distinct: 847219, nullCount: 0 },
      { name: "CUSTOMER_NAME", type: "VARCHAR2(120)", nullable: false, distinct: 842884, nullCount: 0 },
      { name: "EMAIL",         type: "VARCHAR2(200)", nullable: false, distinct: 847219, nullCount: 0 },
      { name: "REGION",        type: "VARCHAR2(10)",  nullable: false, distinct:      4, nullCount: 0 },
      { name: "COUNTRY_CODE",  type: "CHAR(2)",       nullable: false, distinct:    187, nullCount: 0 },
      { name: "SEGMENT",       type: "VARCHAR2(20)",  nullable: false, distinct:      5, nullCount: 0 },
      { name: "CREDIT_LIMIT",  type: "NUMBER(12,2)",  nullable: true,  distinct:  12044, nullCount: 88412 },
      { name: "CREATED_AT",    type: "DATE",          nullable: false, distinct:   2918, nullCount: 0 },
    ],
    indexes: [
      { name: "PK_CUSTOMERS",        type: "UNIQUE", columns: ["CUSTOMER_ID"] },
      { name: "UK_CUSTOMERS_EMAIL",  type: "UNIQUE", columns: ["EMAIL"] },
      { name: "IDX_CUST_REGION",     type: "BITMAP", columns: ["REGION"], planUsage: "ASIS",
        rationale: "현재 플랜: region='APAC' bitmap scan" },
      { name: "IDX_CUST_SEGMENT",    type: "BITMAP", columns: ["SEGMENT"] },
      { name: "IDX_CUST_COUNTRY",    type: "NORMAL", columns: ["COUNTRY_CODE"] },
      { name: "IDX_CUST_REGION_SEG", type: "NORMAL", columns: ["REGION", "SEGMENT", "CREDIT_LIMIT"] },
      { name: "IDX_CUST_NAME",       type: "NORMAL", columns: ["CUSTOMER_NAME"] },
      { name: "IDX_CUST_CREATED",    type: "NORMAL", columns: ["CREATED_AT"] },
      { name: "IDX_CUST_REGION_SEG_ID", type: "NORMAL", columns: ["REGION", "SEGMENT", "CUSTOMER_ID"],
        planUsage: "TOBE", isNew: true,
        rationale: "제안 플랜: region+segment+id 커버링" },
    ],
  },

  products: {
    name: "PRODUCTS", type: "TABLE", schema: "CATALOG",
    totalRows: 82417, avgRowBytes: 342, lastAnalyzed: "2026-04-05 14:02",
    columns: [
      { name: "PRODUCT_ID",   type: "NUMBER(10)",    nullable: false, distinct: 82417, nullCount: 0 },
      { name: "SKU",          type: "VARCHAR2(32)",  nullable: false, distinct: 82417, nullCount: 0 },
      { name: "PRODUCT_NAME", type: "VARCHAR2(200)", nullable: false, distinct: 81904, nullCount: 0 },
      { name: "CATEGORY_ID",  type: "NUMBER(6)",     nullable: false, distinct:   142, nullCount: 0 },
      { name: "SUPPLIER_ID",  type: "NUMBER(8)",     nullable: false, distinct:  1820, nullCount: 0 },
      { name: "PRICE",        type: "NUMBER(12,2)",  nullable: false, distinct: 11043, nullCount: 0 },
      { name: "COST",         type: "NUMBER(12,2)",  nullable: true,  distinct:  9844, nullCount: 410 },
      { name: "IS_ACTIVE",    type: "CHAR(1)",       nullable: false, distinct:     2, nullCount: 0 },
      { name: "WEIGHT_G",     type: "NUMBER(10,2)",  nullable: true,  distinct:  4102, nullCount: 1804 },
    ],
    indexes: [
      { name: "PK_PRODUCTS",     type: "UNIQUE", columns: ["PRODUCT_ID"], planUsage: "ASIS",
        rationale: "현재 플랜: order_items → products PK 단건 probe" },
      { name: "UK_PRODUCTS_SKU", type: "UNIQUE", columns: ["SKU"] },
      { name: "IDX_PROD_CATEGORY", type: "NORMAL", columns: ["CATEGORY_ID"] },
      { name: "IDX_PROD_SUPPLIER", type: "NORMAL", columns: ["SUPPLIER_ID"] },
      { name: "IDX_PROD_ACTIVE",   type: "BITMAP", columns: ["IS_ACTIVE"] },
      { name: "IDX_PROD_CAT_ACT",  type: "NORMAL", columns: ["CATEGORY_ID", "IS_ACTIVE", "PRICE"], planUsage: "TOBE",
        rationale: "제안 플랜: category+active 필터 push-down" },
      { name: "IDX_PROD_SUP_CAT",  type: "NORMAL", columns: ["SUPPLIER_ID", "CATEGORY_ID"] },
      { name: "IDX_PROD_PRICE",    type: "NORMAL", columns: ["PRICE"] },
      { name: "IDX_PROD_NAME",     type: "NORMAL", columns: ["PRODUCT_NAME"] },
    ],
  },

  categories: {
    name: "CATEGORIES", type: "TABLE", schema: "CATALOG",
    totalRows: 142, avgRowBytes: 116, lastAnalyzed: "2026-03-22 09:12",
    columns: [
      { name: "CATEGORY_ID",    type: "NUMBER(6)",    nullable: false, distinct: 142, nullCount: 0 },
      { name: "CATEGORY_CODE",  type: "VARCHAR2(20)", nullable: false, distinct: 142, nullCount: 0 },
      { name: "CATEGORY_NAME",  type: "VARCHAR2(80)", nullable: false, distinct: 142, nullCount: 0 },
      { name: "PARENT_ID",      type: "NUMBER(6)",    nullable: true,  distinct:  18, nullCount:  18 },
      { name: "CATEGORY_LEVEL", type: "NUMBER(2)",    nullable: false, distinct:   4, nullCount:   0 },
      { name: "DISPLAY_ORDER",  type: "NUMBER(4)",    nullable: false, distinct: 142, nullCount:   0 },
    ],
    indexes: [
      { name: "PK_CATEGORIES",     type: "UNIQUE", columns: ["CATEGORY_ID"], planUsage: "BOTH",
        rationale: "단건 조인 probe — 플랜 변경 없음" },
      { name: "UK_CAT_CODE",       type: "UNIQUE", columns: ["CATEGORY_CODE"] },
      { name: "IDX_CAT_PARENT",    type: "NORMAL", columns: ["PARENT_ID"] },
      { name: "IDX_CAT_LEVEL",     type: "BITMAP", columns: ["CATEGORY_LEVEL"] },
      { name: "IDX_CAT_PARENT_LV", type: "NORMAL", columns: ["PARENT_ID", "CATEGORY_LEVEL"] },
      { name: "IDX_CAT_NAME",      type: "NORMAL", columns: ["CATEGORY_NAME"] },
    ],
  },

  suppliers: {
    name: "SUPPLIERS", type: "TABLE", schema: "CATALOG",
    totalRows: 1820, avgRowBytes: 284, lastAnalyzed: "2026-04-01 18:30",
    columns: [
      { name: "SUPPLIER_ID",   type: "NUMBER(8)",     nullable: false, distinct: 1820, nullCount: 0 },
      { name: "SUPPLIER_CODE", type: "VARCHAR2(20)",  nullable: false, distinct: 1820, nullCount: 0 },
      { name: "SUPPLIER_NAME", type: "VARCHAR2(120)", nullable: false, distinct: 1804, nullCount: 0 },
      { name: "COUNTRY_CODE",  type: "CHAR(2)",       nullable: false, distinct:   64, nullCount: 0 },
      { name: "RATING",        type: "NUMBER(2,1)",   nullable: true,  distinct:   41, nullCount: 88 },
      { name: "STATUS",        type: "VARCHAR2(20)",  nullable: false, distinct:    3, nullCount: 0 },
      { name: "CONTRACT_FROM", type: "DATE",          nullable: false, distinct: 1204, nullCount: 0 },
      { name: "CONTRACT_TO",   type: "DATE",          nullable: true,  distinct:  982, nullCount: 204 },
    ],
    indexes: [
      { name: "PK_SUPPLIERS",           type: "UNIQUE", columns: ["SUPPLIER_ID"], planUsage: "ASIS",
        rationale: "현재 플랜: supplier_id 단건 probe" },
      { name: "UK_SUPP_CODE",           type: "UNIQUE", columns: ["SUPPLIER_CODE"] },
      { name: "IDX_SUPP_COUNTRY",       type: "NORMAL", columns: ["COUNTRY_CODE"] },
      { name: "IDX_SUPP_STATUS",        type: "BITMAP", columns: ["STATUS"] },
      { name: "IDX_SUPP_STATUS_RATING", type: "NORMAL", columns: ["STATUS", "RATING"], planUsage: "TOBE",
        rationale: "제안 플랜: status+rating 필터 push-down" },
      { name: "IDX_SUPP_RATING",        type: "NORMAL", columns: ["RATING"] },
      { name: "IDX_SUPP_NAME",          type: "NORMAL", columns: ["SUPPLIER_NAME"] },
      { name: "IDX_SUPP_CONTRACT",      type: "NORMAL", columns: ["CONTRACT_FROM", "CONTRACT_TO"] },
    ],
  },

  warehouses: {
    name: "WAREHOUSES", type: "TABLE", schema: "LOGISTICS",
    totalRows: 142, avgRowBytes: 196, lastAnalyzed: "2026-03-30 11:04",
    columns: [
      { name: "WAREHOUSE_ID",   type: "NUMBER(6)",    nullable: false, distinct: 142, nullCount: 0 },
      { name: "WAREHOUSE_CODE", type: "VARCHAR2(20)", nullable: false, distinct: 142, nullCount: 0 },
      { name: "WAREHOUSE_NAME", type: "VARCHAR2(80)", nullable: false, distinct: 142, nullCount: 0 },
      { name: "REGION",         type: "VARCHAR2(10)", nullable: false, distinct:   4, nullCount: 0 },
      { name: "COUNTRY_CODE",   type: "CHAR(2)",      nullable: false, distinct:  42, nullCount: 0 },
      { name: "CAPACITY_M3",    type: "NUMBER(10)",   nullable: true,  distinct: 108, nullCount: 4 },
      { name: "STATUS",         type: "VARCHAR2(20)", nullable: false, distinct:   3, nullCount: 0 },
    ],
    indexes: [
      { name: "PK_WAREHOUSES",         type: "UNIQUE", columns: ["WAREHOUSE_ID"], planUsage: "ASIS",
        rationale: "현재 플랜: warehouse_id 단건 probe" },
      { name: "UK_WH_CODE",            type: "UNIQUE", columns: ["WAREHOUSE_CODE"] },
      { name: "IDX_WH_COUNTRY",        type: "NORMAL", columns: ["COUNTRY_CODE"], planUsage: "TOBE",
        rationale: "제안 플랜: country_code IN 필터 push-down" },
      { name: "IDX_WH_REGION",         type: "BITMAP", columns: ["REGION"] },
      { name: "IDX_WH_STATUS",         type: "BITMAP", columns: ["STATUS"] },
      { name: "IDX_WH_REGION_COUNTRY", type: "NORMAL", columns: ["REGION", "COUNTRY_CODE"] },
    ],
  },

  shipments: {
    name: "SHIPMENTS", type: "TABLE", schema: "LOGISTICS",
    totalRows: 11842004, avgRowBytes: 124, lastAnalyzed: "2026-04-08 03:02",
    columns: [
      { name: "SHIPMENT_ID",    type: "NUMBER(14)",   nullable: false, distinct: 11842004, nullCount: 0 },
      { name: "ORDER_ID",       type: "NUMBER(12)",   nullable: false, distinct: 11842004, nullCount: 0 },
      { name: "TRACKING_NUMBER",type: "VARCHAR2(40)", nullable: true,  distinct: 11720882, nullCount: 121122 },
      { name: "CARRIER",        type: "VARCHAR2(30)", nullable: true,  distinct:       12, nullCount: 408102 },
      { name: "SHIPPED_AT",     type: "TIMESTAMP",    nullable: true,  distinct:  9420388, nullCount: 408102 },
      { name: "DELIVERED_AT",   type: "TIMESTAMP",    nullable: true,  distinct:  9101844, nullCount: 2912004 },
      { name: "STATUS",         type: "VARCHAR2(20)", nullable: false, distinct:        6, nullCount: 0 },
    ],
    indexes: [
      { name: "PK_SHIPMENTS",          type: "UNIQUE", columns: ["SHIPMENT_ID"] },
      { name: "UK_SHIP_TRACKING",      type: "UNIQUE", columns: ["TRACKING_NUMBER"] },
      { name: "IDX_SHIP_ORDER",        type: "NORMAL", columns: ["ORDER_ID"], planUsage: "ASIS",
        rationale: "현재 플랜: order_id LEFT JOIN lookup" },
      { name: "IDX_SHIP_STATUS",       type: "BITMAP", columns: ["STATUS"] },
      { name: "IDX_SHIP_CARRIER_DATE", type: "NORMAL", columns: ["CARRIER", "SHIPPED_AT"] },
      { name: "IDX_SHIP_SHIPPED",      type: "NORMAL", columns: ["SHIPPED_AT"] },
      { name: "IDX_SHIP_DELIVERED",    type: "NORMAL", columns: ["DELIVERED_AT"] },
      { name: "IDX_SHIP_ORDER_CARRIER",type: "NORMAL", columns: ["ORDER_ID", "CARRIER"],
        planUsage: "TOBE", isNew: true,
        rationale: "제안 플랜: order + carrier 필터 커버링" },
    ],
  },

  employees: {
    name: "EMPLOYEES", type: "TABLE", schema: "HR",
    totalRows: 12041, avgRowBytes: 312, lastAnalyzed: "2026-04-01 22:10",
    columns: [
      { name: "EMPLOYEE_ID",   type: "NUMBER(10)",    nullable: false, distinct: 12041, nullCount: 0 },
      { name: "FIRST_NAME",    type: "VARCHAR2(40)",  nullable: false, distinct:  3840, nullCount: 0 },
      { name: "LAST_NAME",     type: "VARCHAR2(40)",  nullable: false, distinct:  6102, nullCount: 0 },
      { name: "EMAIL",         type: "VARCHAR2(200)", nullable: false, distinct: 12041, nullCount: 0 },
      { name: "DEPARTMENT_ID", type: "NUMBER(6)",     nullable: false, distinct:    64, nullCount: 0 },
      { name: "MANAGER_ID",    type: "NUMBER(10)",    nullable: true,  distinct:  1204, nullCount: 84 },
      { name: "HIRE_DATE",     type: "DATE",          nullable: false, distinct:  4018, nullCount: 0 },
      { name: "STATUS",        type: "VARCHAR2(20)",  nullable: false, distinct:     4, nullCount: 0 },
      { name: "SALARY",        type: "NUMBER(12,2)",  nullable: true,  distinct:  6044, nullCount: 220 },
    ],
    indexes: [
      { name: "PK_EMPLOYEES",        type: "UNIQUE", columns: ["EMPLOYEE_ID"], planUsage: "BOTH",
        rationale: "LEFT JOIN 단건 probe — 플랜 변경 없음" },
      { name: "UK_EMP_EMAIL",        type: "UNIQUE", columns: ["EMAIL"] },
      { name: "IDX_EMP_DEPT",        type: "NORMAL", columns: ["DEPARTMENT_ID"] },
      { name: "IDX_EMP_MGR",         type: "NORMAL", columns: ["MANAGER_ID"] },
      { name: "IDX_EMP_HIRE",        type: "NORMAL", columns: ["HIRE_DATE"] },
      { name: "IDX_EMP_STATUS",      type: "BITMAP", columns: ["STATUS"] },
      { name: "IDX_EMP_NAME",        type: "NORMAL", columns: ["LAST_NAME", "FIRST_NAME"] },
      { name: "IDX_EMP_DEPT_STATUS", type: "NORMAL", columns: ["DEPARTMENT_ID", "STATUS"] },
    ],
  },

  users: {
    name: "USERS", type: "TABLE", schema: "APP",
    totalRows: 2104887, avgRowBytes: 198, lastAnalyzed: "2026-04-09 01:30",
    columns: [
      { name: "USER_ID",    type: "NUMBER(12)",    nullable: false, distinct: 2104887, nullCount: 0 },
      { name: "EMAIL",      type: "VARCHAR2(200)", nullable: false, distinct: 2104887, nullCount: 0 },
      { name: "STATUS",     type: "VARCHAR2(20)",  nullable: false, distinct:       4, nullCount: 0 },
      { name: "CREATED_AT", type: "DATE",          nullable: false, distinct:    3204, nullCount: 0 },
    ],
    indexes: [
      { name: "PK_USERS",               type: "UNIQUE", columns: ["USER_ID"] },
      { name: "UK_USERS_EMAIL",         type: "UNIQUE", columns: ["EMAIL"] },
      { name: "IDX_USERS_STAT",         type: "BITMAP", columns: ["STATUS"], planUsage: "ASIS",
        rationale: "현재 플랜: status='ACTIVE' bitmap scan" },
      { name: "IDX_USERS_STAT_CREATED", type: "NORMAL", columns: ["STATUS", "CREATED_AT"], planUsage: "TOBE",
        rationale: "제안 플랜: status + created_at 동시 필터" },
    ],
  },

  sessions: {
    name: "SESSIONS", type: "TABLE", schema: "APP",
    totalRows: 18442993, avgRowBytes: 64, lastAnalyzed: "2026-04-09 01:30",
    columns: [
      { name: "SESSION_ID",    type: "NUMBER(14)", nullable: false, distinct: 18442993, nullCount: 0 },
      { name: "USER_ID",       type: "NUMBER(12)", nullable: false, distinct:  2098441, nullCount: 0 },
      { name: "LAST_LOGIN",    type: "TIMESTAMP",  nullable: true,  distinct: 15094108, nullCount: 408882 },
      { name: "SESSION_COUNT", type: "NUMBER(8)",  nullable: false, distinct:     1204, nullCount: 0 },
    ],
    indexes: [
      { name: "PK_SESSIONS",        type: "UNIQUE", columns: ["SESSION_ID"] },
      { name: "IDX_SESSIONS_USR",   type: "NORMAL", columns: ["USER_ID", "LAST_LOGIN"], planUsage: "BOTH",
        rationale: "user_id+last_login 커버링 — 플랜 변경 없음" },
      { name: "IDX_SESSIONS_LOGIN", type: "NORMAL", columns: ["LAST_LOGIN"] },
    ],
  },

  monthly_sales: {
    name: "MONTHLY_SALES", type: "CTE", schema: "(inline)",
    totalRows: null, avgRowBytes: null, lastAnalyzed: null,
    note: "Common Table Expression — 런타임에 생성. 통계 없음.",
    columns: [
      { name: "MONTH",  type: "DATE",         nullable: false, distinct: null, nullCount: null },
      { name: "REGION", type: "VARCHAR2(10)", nullable: false, distinct: null, nullCount: null },
      { name: "AMOUNT", type: "NUMBER",       nullable: true,  distinct: null, nullCount: null },
    ],
    indexes: [],
  },
  ranked: {
    name: "RANKED", type: "CTE", schema: "(inline)",
    totalRows: null, avgRowBytes: null, lastAnalyzed: null,
    note: "Common Table Expression — 런타임에 생성. 통계 없음.",
    columns: [
      { name: "MONTH",  type: "DATE",         nullable: false, distinct: null, nullCount: null },
      { name: "REGION", type: "VARCHAR2(10)", nullable: false, distinct: null, nullCount: null },
      { name: "AMOUNT", type: "NUMBER",       nullable: true,  distinct: null, nullCount: null },
      { name: "RNK",    type: "NUMBER",       nullable: false, distinct: null, nullCount: null },
    ],
    indexes: [],
  },

  departments: {
    name: "DEPARTMENTS", type: "TABLE", schema: "HR",
    totalRows: 64, avgRowBytes: 124, lastAnalyzed: "2026-04-05 08:14",
    columns: [
      { name: "DEPARTMENT_ID",   type: "NUMBER(6)",    nullable: false, distinct: 64, nullCount: 0 },
      { name: "DEPARTMENT_NAME", type: "VARCHAR2(80)", nullable: false, distinct: 64, nullCount: 0 },
      { name: "MANAGER_ID",      type: "NUMBER(10)",   nullable: true,  distinct: 58, nullCount: 2 },
      { name: "LOCATION_ID",     type: "NUMBER(6)",    nullable: false, distinct: 12, nullCount: 0 },
    ],
    indexes: [
      { name: "PK_DEPARTMENTS",   type: "UNIQUE", columns: ["DEPARTMENT_ID"], planUsage: "BOTH",
        rationale: "단건 probe — 플랜 변경 없음" },
      { name: "UK_DEPT_NAME",     type: "UNIQUE", columns: ["DEPARTMENT_NAME"] },
      { name: "IDX_DEPT_LOC",     type: "NORMAL", columns: ["LOCATION_ID"], planUsage: "ASIS",
        rationale: "현재 플랜: location_id = :loc_id 단일 컬럼 range scan" },
      { name: "IDX_DEPT_LOC_MGR", type: "NORMAL", columns: ["LOCATION_ID", "MANAGER_ID"], planUsage: "TOBE", isNew: true,
        rationale: "제안 플랜: location + manager 커버링으로 self-join 해소" },
    ],
  },

  emp: {
    name: "EMP", type: "TABLE", schema: "HR",
    totalRows: 14204, avgRowBytes: 186, lastAnalyzed: "2026-04-06 23:40",
    columns: [
      { name: "EMP_ID",    type: "NUMBER(10)",   nullable: false, distinct: 14204, nullCount: 0 },
      { name: "DEPT_ID",   type: "NUMBER(6)",    nullable: false, distinct:   120, nullCount: 0 },
      { name: "HIRE_DATE", type: "DATE",         nullable: false, distinct:  4218, nullCount: 0 },
      { name: "SALARY",    type: "NUMBER(12,2)", nullable: true,  distinct:  6102, nullCount: 212 },
      { name: "GRADE",     type: "VARCHAR2(10)", nullable: false, distinct:     7, nullCount: 0 },
    ],
    indexes: [
      { name: "PK_EMP",            type: "UNIQUE", columns: ["EMP_ID"] },
      { name: "IDX_EMP_DEPT",      type: "NORMAL", columns: ["DEPT_ID"], planUsage: "ASIS",
        rationale: "현재 플랜: HASH JOIN 후 EMP FULL SCAN → ORDER BY" },
      { name: "IDX_EMP_HIRE_DATE", type: "NORMAL", columns: ["HIRE_DATE", "SALARY"], planUsage: "TOBE", isNew: true,
        rationale: "제안 플랜: hire_date 필터 push-down + salary 커버링으로 SORT 제거" },
      { name: "IDX_EMP_GRADE",     type: "BITMAP", columns: ["GRADE"] },
    ],
  },

  dept: {
    name: "DEPT", type: "TABLE", schema: "HR",
    totalRows: 120, avgRowBytes: 102, lastAnalyzed: "2026-04-06 23:40",
    columns: [
      { name: "DEPT_ID",   type: "NUMBER(6)",    nullable: false, distinct: 120, nullCount: 0 },
      { name: "DEPT_NAME", type: "VARCHAR2(80)", nullable: false, distinct: 120, nullCount: 0 },
      { name: "REGION",    type: "VARCHAR2(10)", nullable: false, distinct:   4, nullCount: 0 },
    ],
    indexes: [
      { name: "PK_DEPT",     type: "UNIQUE", columns: ["DEPT_ID"], planUsage: "BOTH",
        rationale: "단건 조인 probe — 플랜 변경 없음" },
      { name: "UK_DEPT_NM",  type: "UNIQUE", columns: ["DEPT_NAME"] },
      { name: "IDX_DEPT_RG", type: "BITMAP", columns: ["REGION"] },
    ],
  },

  accounts: {
    name: "ACCOUNTS", type: "TABLE", schema: "FIN",
    totalRows: 2048112, avgRowBytes: 196, lastAnalyzed: "2026-04-08 04:18",
    columns: [
      { name: "ACCOUNT_ID", type: "NUMBER(12)",   nullable: false, distinct: 2048112, nullCount: 0 },
      { name: "ACCOUNT_NO", type: "VARCHAR2(24)", nullable: false, distinct: 2048112, nullCount: 0 },
      { name: "BALANCE",    type: "NUMBER(16,2)", nullable: false, distinct:  984203, nullCount: 0 },
      { name: "STATUS",     type: "VARCHAR2(20)", nullable: false, distinct:       5, nullCount: 0 },
      { name: "OPENED_AT",  type: "DATE",         nullable: false, distinct:    3842, nullCount: 0 },
      { name: "CURRENCY",   type: "CHAR(3)",      nullable: false, distinct:      18, nullCount: 0 },
    ],
    indexes: [
      { name: "PK_ACCOUNTS",          type: "UNIQUE", columns: ["ACCOUNT_ID"] },
      { name: "UK_ACCOUNTS_NO",       type: "UNIQUE", columns: ["ACCOUNT_NO"] },
      { name: "IDX_ACC_STATUS",       type: "BITMAP", columns: ["STATUS"], planUsage: "ASIS",
        rationale: "현재 플랜: status='ACTIVE' bitmap access 후 HASH JOIN TRANSACTIONS" },
      { name: "IDX_ACC_STATUS_BAL",   type: "NORMAL", columns: ["STATUS", "BALANCE", "ACCOUNT_ID"], planUsage: "TOBE", isNew: true,
        rationale: "제안 플랜: status+balance+id 커버링으로 GROUP BY 전에 조인키 확보" },
      { name: "IDX_ACC_OPENED",       type: "NORMAL", columns: ["OPENED_AT"] },
      { name: "IDX_ACC_CURRENCY",     type: "BITMAP", columns: ["CURRENCY"] },
    ],
  },

  transactions: {
    name: "TRANSACTIONS", type: "TABLE", schema: "FIN",
    totalRows: 89410244, avgRowBytes: 108, lastAnalyzed: "2026-04-09 02:00",
    columns: [
      { name: "TXN_ID",       type: "NUMBER(14)",   nullable: false, distinct: 89410244, nullCount: 0 },
      { name: "ACCOUNT_ID",   type: "NUMBER(12)",   nullable: false, distinct:  2040882, nullCount: 0 },
      { name: "STORE_ID",     type: "NUMBER(8)",    nullable: true,  distinct:    12044, nullCount: 412003 },
      { name: "AMOUNT",       type: "NUMBER(14,2)", nullable: false, distinct:  8210334, nullCount: 0 },
      { name: "SALE_AMOUNT",  type: "NUMBER(14,2)", nullable: true,  distinct:  7018221, nullCount: 108442 },
      { name: "TXN_DATE",     type: "DATE",         nullable: false, distinct:     3650, nullCount: 0 },
      { name: "TXN_TYPE",     type: "VARCHAR2(20)", nullable: false, distinct:        8, nullCount: 0 },
      { name: "CURRENCY",     type: "CHAR(3)",      nullable: false, distinct:       18, nullCount: 0 },
    ],
    indexes: [
      { name: "PK_TRANSACTIONS",         type: "UNIQUE", columns: ["TXN_ID"] },
      { name: "IDX_TXN_ACCOUNT",         type: "NORMAL", columns: ["ACCOUNT_ID"], planUsage: "ASIS",
        rationale: "현재 플랜: account_id NL lookup — 파티션 프루닝 없음" },
      { name: "IDX_TXN_DATE_ACC",        type: "NORMAL", columns: ["TXN_DATE", "ACCOUNT_ID", "AMOUNT"], planUsage: "TOBE", isNew: true,
        rationale: "제안 플랜: 일자 파티션 키 + 금액 커버링" },
      { name: "IDX_TXN_STORE_DATE",      type: "NORMAL", columns: ["STORE_ID", "TXN_DATE"] },
      { name: "IDX_TXN_TYPE",            type: "BITMAP", columns: ["TXN_TYPE"] },
    ],
  },

  stores: {
    name: "STORES", type: "TABLE", schema: "RETAIL",
    totalRows: 12044, avgRowBytes: 204, lastAnalyzed: "2026-04-02 15:22",
    columns: [
      { name: "STORE_ID",    type: "NUMBER(8)",     nullable: false, distinct: 12044, nullCount: 0 },
      { name: "STORE_CODE",  type: "VARCHAR2(20)",  nullable: false, distinct: 12044, nullCount: 0 },
      { name: "STORE_NAME",  type: "VARCHAR2(120)", nullable: false, distinct: 11984, nullCount: 0 },
      { name: "REGION",      type: "VARCHAR2(10)",  nullable: false, distinct:     4, nullCount: 0 },
      { name: "COUNTRY",     type: "CHAR(2)",       nullable: false, distinct:    42, nullCount: 0 },
      { name: "STATUS",      type: "VARCHAR2(20)",  nullable: false, distinct:     3, nullCount: 0 },
    ],
    indexes: [
      { name: "PK_STORES",       type: "UNIQUE", columns: ["STORE_ID"], planUsage: "ASIS",
        rationale: "현재 플랜: store_id 단건 probe" },
      { name: "UK_STORES_CODE",  type: "UNIQUE", columns: ["STORE_CODE"] },
      { name: "IDX_STORES_RG",   type: "BITMAP", columns: ["REGION"] },
      { name: "IDX_STORES_STAT", type: "BITMAP", columns: ["STATUS"], planUsage: "TOBE",
        rationale: "제안 플랜: status='OPEN' bitmap 필터로 joined row 축소" },
      { name: "IDX_STORES_NM",   type: "NORMAL", columns: ["STORE_NAME"] },
    ],
  },

  payments: {
    name: "PAYMENTS", type: "TABLE", schema: "PAY",
    totalRows: 48200000, avgRowBytes: 124, lastAnalyzed: "2026-04-09 02:00",
    columns: [
      { name: "PAY_ID",      type: "NUMBER(14)",   nullable: false, distinct: 48200000, nullCount: 0 },
      { name: "MERCHANT_ID", type: "NUMBER(10)",   nullable: false, distinct:    82000, nullCount: 0 },
      { name: "PAY_DATE",    type: "DATE",         nullable: false, distinct:     3650, nullCount: 0 },
      { name: "AMOUNT",      type: "NUMBER(14,2)", nullable: false, distinct:  8100000, nullCount: 0 },
      { name: "STATUS",      type: "VARCHAR2(20)", nullable: false, distinct:        6, nullCount: 0 },
      { name: "PAY_TYPE",    type: "VARCHAR2(20)", nullable: false, distinct:        8, nullCount: 0 },
      { name: "CURRENCY",    type: "CHAR(3)",      nullable: false, distinct:       18, nullCount: 0 },
      { name: "CREATED_AT",  type: "TIMESTAMP",    nullable: false, distinct: 48200000, nullCount: 0 },
    ],
    indexes: [
      { name: "PK_PAYMENTS",           type: "UNIQUE",  columns: ["PAY_ID"] },
      { name: "IDX_PAY_MERCHANT_DATE", type: "NORMAL",  columns: ["MERCHANT_ID", "PAY_DATE"], planUsage: "ASIS",
        rationale: "merchant_id + pay_date range scan" },
      { name: "IDX_PAY_DATE",          type: "NORMAL",  columns: ["PAY_DATE"] },
      { name: "IDX_PAY_STATUS",        type: "BITMAP",  columns: ["STATUS"] },
    ],
  },
}

export function getObjectMeta(name) {
  if (!name) return null
  return OBJECT_META[name.toLowerCase()] || null
}
