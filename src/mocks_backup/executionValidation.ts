export interface ExecutionValidation {
  id: string
  workItemId: string
  sqlId: string
  originalPlanText: string
  tunedPlanText: string
  originalElapsed: number
  tunedElapsed: number
  originalBuffers: number
  tunedBuffers: number
  originalRows: number
  tunedRows: number
  originalDiskReads: number
  tunedDiskReads: number
  validatedAt: string
  validatedBy: string
  result: 'improved' | 'degraded' | 'neutral'
  recommendationType: 'rewrite' | 'hint' | 'index' | 'plan_restore'
  changeDescription: string
  tunedSqlText?: string
}

export interface BindVariable {
  name: string
  type: string
  value: string
  status: 'available' | 'sample_only' | 'unknown'
}

export interface WorkBindInfo {
  workItemId: string
  bindSensitive: boolean
  variables: BindVariable[]
}

// 바인드 변수 mock
export const workBinds: Record<string, WorkBindInfo> = {
  'WI-2024-001': {
    workItemId: 'WI-2024-001',
    bindSensitive: true,
    variables: [
      { name: ':CUST_ID', type: 'NUMBER', value: '10245', status: 'available' },
      { name: ':START_DATE', type: 'DATE', value: '2026-03-05', status: 'available' },
      { name: ':END_DATE', type: 'DATE', value: '2026-04-02', status: 'available' },
    ],
  },
  'WI-2024-011': {
    workItemId: 'WI-2024-011',
    bindSensitive: false,
    variables: [
      { name: ':TBL', type: 'VARCHAR2', value: 'ORDERS', status: 'available' },
      { name: ':OP', type: 'VARCHAR2', value: 'UPDATE', status: 'available' },
      { name: ':OLD', type: 'VARCHAR2', value: '', status: 'unknown' },
      { name: ':NEW', type: 'VARCHAR2', value: '', status: 'unknown' },
    ],
  },
  'WI-2024-012': {
    workItemId: 'WI-2024-012',
    bindSensitive: true,
    variables: [
      { name: ':CAT_ID', type: 'NUMBER', value: '42', status: 'sample_only' },
    ],
  },
  'WI-2024-017': {
    workItemId: 'WI-2024-017',
    bindSensitive: false,
    variables: [],
  },
}

// ─── 바인드셋 (튜닝안별 사용 바인드 + 대안 바인드셋) ───
export interface BindSetVariable {
  name: string
  type: string
  value: string
}

export interface BindSet {
  id: string
  capturedAt: string
  source: 'MaxGauge' | 'AWR' | 'V$SQL'
  variables: BindSetVariable[]
}

export interface WorkBindSets {
  workItemId: string
  bindSensitive: boolean
  sets: BindSet[]
}

export const workBindSets: Record<string, WorkBindSets> = {
  'WI-2024-004': {
    workItemId: 'WI-2024-004',
    bindSensitive: true,
    sets: [
      {
        id: 'BS-004-1',
        capturedAt: '2026-04-02T02:15:00',
        source: 'MaxGauge',
        variables: [
          { name: ':PROD_ID', type: 'NUMBER', value: '1842' },
          { name: ':QTY_MIN', type: 'NUMBER', value: '100' },
          { name: ':QTY_MAX', type: 'NUMBER', value: '9999' },
          { name: ':STATUS', type: 'VARCHAR2', value: 'ACTIVE' },
          { name: ':WAREHOUSE_ID', type: 'NUMBER', value: '15' },
          { name: ':CATEGORY', type: 'VARCHAR2', value: 'ELECTRONICS' },
          { name: ':SUPPLIER_CD', type: 'VARCHAR2', value: 'SUP-KR-042' },
          { name: ':PRICE_FROM', type: 'NUMBER', value: '10000' },
          { name: ':PRICE_TO', type: 'NUMBER', value: '500000' },
          { name: ':ORDER_DT', type: 'DATE', value: '2026-04-02' },
          { name: ':SHIP_METHOD', type: 'VARCHAR2', value: 'EXPRESS' },
          { name: ':INCLUDE_TAX', type: 'VARCHAR2', value: 'Y' },
        ],
      },
      {
        id: 'BS-004-2',
        capturedAt: '2026-04-01T14:30:00',
        source: 'MaxGauge',
        variables: [
          { name: ':PROD_ID', type: 'NUMBER', value: '305' },
          { name: ':QTY_MIN', type: 'NUMBER', value: '50' },
          { name: ':QTY_MAX', type: 'NUMBER', value: '2000' },
          { name: ':STATUS', type: 'VARCHAR2', value: 'ACTIVE' },
          { name: ':WAREHOUSE_ID', type: 'NUMBER', value: '8' },
          { name: ':CATEGORY', type: 'VARCHAR2', value: 'FURNITURE' },
          { name: ':SUPPLIER_CD', type: 'VARCHAR2', value: 'SUP-CN-118' },
          { name: ':PRICE_FROM', type: 'NUMBER', value: '50000' },
          { name: ':PRICE_TO', type: 'NUMBER', value: '2000000' },
          { name: ':ORDER_DT', type: 'DATE', value: '2026-04-01' },
          { name: ':SHIP_METHOD', type: 'VARCHAR2', value: 'STANDARD' },
          { name: ':INCLUDE_TAX', type: 'VARCHAR2', value: 'N' },
        ],
      },
      {
        id: 'BS-004-3',
        capturedAt: '2026-03-31T09:45:00',
        source: 'AWR',
        variables: [
          { name: ':PROD_ID', type: 'NUMBER', value: '7621' },
          { name: ':QTY_MIN', type: 'NUMBER', value: '200' },
          { name: ':QTY_MAX', type: 'NUMBER', value: '15000' },
          { name: ':STATUS', type: 'VARCHAR2', value: 'INACTIVE' },
          { name: ':WAREHOUSE_ID', type: 'NUMBER', value: '3' },
          { name: ':CATEGORY', type: 'VARCHAR2', value: 'CLOTHING' },
          { name: ':SUPPLIER_CD', type: 'VARCHAR2', value: 'SUP-VN-007' },
          { name: ':PRICE_FROM', type: 'NUMBER', value: '5000' },
          { name: ':PRICE_TO', type: 'NUMBER', value: '100000' },
          { name: ':ORDER_DT', type: 'DATE', value: '2026-03-31' },
          { name: ':SHIP_METHOD', type: 'VARCHAR2', value: 'ECONOMY' },
          { name: ':INCLUDE_TAX', type: 'VARCHAR2', value: 'Y' },
        ],
      },
      {
        id: 'BS-004-4',
        capturedAt: '2026-04-02T06:30:00',
        source: 'MaxGauge',
        variables: [
          { name: ':PROD_ID', type: 'NUMBER', value: '1842' },
          { name: ':QTY_MIN', type: 'NUMBER', value: '100' },
          { name: ':QTY_MAX', type: 'NUMBER', value: '9999' },
          { name: ':STATUS', type: 'VARCHAR2', value: 'ACTIVE' },
          { name: ':WAREHOUSE_ID', type: 'NUMBER', value: '15' },
          { name: ':CATEGORY', type: 'VARCHAR2', value: 'ELECTRONICS' },
          { name: ':SUPPLIER_CD', type: 'VARCHAR2', value: 'SUP-KR-042' },
          { name: ':PRICE_FROM', type: 'NUMBER', value: '10000' },
          { name: ':PRICE_TO', type: 'NUMBER', value: '500000' },
          { name: ':ORDER_DT', type: 'DATE', value: '2026-04-02' },
          { name: ':SHIP_METHOD', type: 'VARCHAR2', value: 'EXPRESS' },
          { name: ':INCLUDE_TAX', type: 'VARCHAR2', value: 'Y' },
        ],
      },
      {
        id: 'BS-004-5',
        capturedAt: '2026-04-02T10:05:00',
        source: 'MaxGauge',
        variables: [
          { name: ':PROD_ID', type: 'NUMBER', value: '305' },
          { name: ':QTY_MIN', type: 'NUMBER', value: '50' },
          { name: ':QTY_MAX', type: 'NUMBER', value: '2000' },
          { name: ':STATUS', type: 'VARCHAR2', value: 'ACTIVE' },
          { name: ':WAREHOUSE_ID', type: 'NUMBER', value: '8' },
          { name: ':CATEGORY', type: 'VARCHAR2', value: 'FURNITURE' },
          { name: ':SUPPLIER_CD', type: 'VARCHAR2', value: 'SUP-CN-118' },
          { name: ':PRICE_FROM', type: 'NUMBER', value: '50000' },
          { name: ':PRICE_TO', type: 'NUMBER', value: '2000000' },
          { name: ':ORDER_DT', type: 'DATE', value: '2026-04-02' },
          { name: ':SHIP_METHOD', type: 'VARCHAR2', value: 'STANDARD' },
          { name: ':INCLUDE_TAX', type: 'VARCHAR2', value: 'N' },
        ],
      },
      {
        id: 'BS-004-6',
        capturedAt: '2026-04-02T13:20:00',
        source: 'MaxGauge',
        variables: [
          { name: ':PROD_ID', type: 'NUMBER', value: '4490' },
          { name: ':QTY_MIN', type: 'NUMBER', value: '10' },
          { name: ':QTY_MAX', type: 'NUMBER', value: '500' },
          { name: ':STATUS', type: 'VARCHAR2', value: 'ACTIVE' },
          { name: ':WAREHOUSE_ID', type: 'NUMBER', value: '15' },
          { name: ':CATEGORY', type: 'VARCHAR2', value: 'ELECTRONICS' },
          { name: ':SUPPLIER_CD', type: 'VARCHAR2', value: 'SUP-KR-042' },
          { name: ':PRICE_FROM', type: 'NUMBER', value: '1000' },
          { name: ':PRICE_TO', type: 'NUMBER', value: '50000' },
          { name: ':ORDER_DT', type: 'DATE', value: '2026-04-02' },
          { name: ':SHIP_METHOD', type: 'VARCHAR2', value: 'EXPRESS' },
          { name: ':INCLUDE_TAX', type: 'VARCHAR2', value: 'Y' },
        ],
      },
      {
        id: 'BS-004-7',
        capturedAt: '2026-04-02T16:45:00',
        source: 'MaxGauge',
        variables: [
          { name: ':PROD_ID', type: 'NUMBER', value: '1842' },
          { name: ':QTY_MIN', type: 'NUMBER', value: '100' },
          { name: ':QTY_MAX', type: 'NUMBER', value: '9999' },
          { name: ':STATUS', type: 'VARCHAR2', value: 'ACTIVE' },
          { name: ':WAREHOUSE_ID', type: 'NUMBER', value: '15' },
          { name: ':CATEGORY', type: 'VARCHAR2', value: 'ELECTRONICS' },
          { name: ':SUPPLIER_CD', type: 'VARCHAR2', value: 'SUP-KR-042' },
          { name: ':PRICE_FROM', type: 'NUMBER', value: '10000' },
          { name: ':PRICE_TO', type: 'NUMBER', value: '500000' },
          { name: ':ORDER_DT', type: 'DATE', value: '2026-04-02' },
          { name: ':SHIP_METHOD', type: 'VARCHAR2', value: 'EXPRESS' },
          { name: ':INCLUDE_TAX', type: 'VARCHAR2', value: 'Y' },
        ],
      },
      {
        id: 'BS-004-8',
        capturedAt: '2026-04-02T19:10:00',
        source: 'AWR',
        variables: [
          { name: ':PROD_ID', type: 'NUMBER', value: '305' },
          { name: ':QTY_MIN', type: 'NUMBER', value: '50' },
          { name: ':QTY_MAX', type: 'NUMBER', value: '2000' },
          { name: ':STATUS', type: 'VARCHAR2', value: 'ACTIVE' },
          { name: ':WAREHOUSE_ID', type: 'NUMBER', value: '8' },
          { name: ':CATEGORY', type: 'VARCHAR2', value: 'FURNITURE' },
          { name: ':SUPPLIER_CD', type: 'VARCHAR2', value: 'SUP-CN-118' },
          { name: ':PRICE_FROM', type: 'NUMBER', value: '50000' },
          { name: ':PRICE_TO', type: 'NUMBER', value: '2000000' },
          { name: ':ORDER_DT', type: 'DATE', value: '2026-04-02' },
          { name: ':SHIP_METHOD', type: 'VARCHAR2', value: 'STANDARD' },
          { name: ':INCLUDE_TAX', type: 'VARCHAR2', value: 'N' },
        ],
      },
      {
        id: 'BS-004-9',
        capturedAt: '2026-04-02T21:30:00',
        source: 'MaxGauge',
        variables: [
          { name: ':PROD_ID', type: 'NUMBER', value: '9102' },
          { name: ':QTY_MIN', type: 'NUMBER', value: '1' },
          { name: ':QTY_MAX', type: 'NUMBER', value: '10' },
          { name: ':STATUS', type: 'VARCHAR2', value: 'ACTIVE' },
          { name: ':WAREHOUSE_ID', type: 'NUMBER', value: '22' },
          { name: ':CATEGORY', type: 'VARCHAR2', value: 'LUXURY' },
          { name: ':SUPPLIER_CD', type: 'VARCHAR2', value: 'SUP-IT-001' },
          { name: ':PRICE_FROM', type: 'NUMBER', value: '500000' },
          { name: ':PRICE_TO', type: 'NUMBER', value: '99999999' },
          { name: ':ORDER_DT', type: 'DATE', value: '2026-04-02' },
          { name: ':SHIP_METHOD', type: 'VARCHAR2', value: 'EXPRESS' },
          { name: ':INCLUDE_TAX', type: 'VARCHAR2', value: 'Y' },
        ],
      },
      {
        id: 'BS-004-10',
        capturedAt: '2026-04-02T23:55:00',
        source: 'MaxGauge',
        variables: [
          { name: ':PROD_ID', type: 'NUMBER', value: '1842' },
          { name: ':QTY_MIN', type: 'NUMBER', value: '100' },
          { name: ':QTY_MAX', type: 'NUMBER', value: '9999' },
          { name: ':STATUS', type: 'VARCHAR2', value: 'ACTIVE' },
          { name: ':WAREHOUSE_ID', type: 'NUMBER', value: '15' },
          { name: ':CATEGORY', type: 'VARCHAR2', value: 'ELECTRONICS' },
          { name: ':SUPPLIER_CD', type: 'VARCHAR2', value: 'SUP-KR-042' },
          { name: ':PRICE_FROM', type: 'NUMBER', value: '10000' },
          { name: ':PRICE_TO', type: 'NUMBER', value: '500000' },
          { name: ':ORDER_DT', type: 'DATE', value: '2026-04-02' },
          { name: ':SHIP_METHOD', type: 'VARCHAR2', value: 'EXPRESS' },
          { name: ':INCLUDE_TAX', type: 'VARCHAR2', value: 'Y' },
        ],
      },
    ],
  },
  'WI-2024-005': {
    workItemId: 'WI-2024-005',
    bindSensitive: false,
    sets: [
      {
        id: 'BS-005-1',
        capturedAt: '2026-04-02T03:10:00',
        source: 'MaxGauge',
        variables: [
          { name: ':DEPT_ID', type: 'NUMBER', value: '120' },
          { name: ':HIRE_FROM', type: 'DATE', value: '2020-01-01' },
          { name: ':HIRE_TO', type: 'DATE', value: '2026-04-02' },
          { name: ':EMP_STATUS', type: 'VARCHAR2', value: 'ACTIVE' },
          { name: ':GRADE', type: 'VARCHAR2', value: 'SENIOR' },
          { name: ':SALARY_MIN', type: 'NUMBER', value: '3000000' },
          { name: ':SALARY_MAX', type: 'NUMBER', value: '12000000' },
          { name: ':JOB_CD', type: 'VARCHAR2', value: 'IT_PROG' },
          { name: ':MGR_ID', type: 'NUMBER', value: '1045' },
          { name: ':LOCATION_ID', type: 'NUMBER', value: '1700' },
          { name: ':COMMISSION_PCT', type: 'NUMBER', value: '0.15' },
        ],
      },
      {
        id: 'BS-005-2',
        capturedAt: '2026-04-01T08:20:00',
        source: 'AWR',
        variables: [
          { name: ':DEPT_ID', type: 'NUMBER', value: '55' },
          { name: ':HIRE_FROM', type: 'DATE', value: '2022-06-01' },
          { name: ':HIRE_TO', type: 'DATE', value: '2026-04-01' },
          { name: ':EMP_STATUS', type: 'VARCHAR2', value: 'ACTIVE' },
          { name: ':GRADE', type: 'VARCHAR2', value: 'JUNIOR' },
          { name: ':SALARY_MIN', type: 'NUMBER', value: '2500000' },
          { name: ':SALARY_MAX', type: 'NUMBER', value: '6000000' },
          { name: ':JOB_CD', type: 'VARCHAR2', value: 'SA_REP' },
          { name: ':MGR_ID', type: 'NUMBER', value: '2080' },
          { name: ':LOCATION_ID', type: 'NUMBER', value: '2400' },
          { name: ':COMMISSION_PCT', type: 'NUMBER', value: '0.10' },
        ],
      },
    ],
  },
  'WI-2024-006': {
    workItemId: 'WI-2024-006',
    bindSensitive: true,
    sets: [
      {
        id: 'BS-006-1',
        capturedAt: '2026-04-02T01:45:00',
        source: 'MaxGauge',
        variables: [
          { name: ':CUST_ID', type: 'NUMBER', value: '88421' },
          { name: ':ORD_DATE', type: 'DATE', value: '2026-03-10' },
          { name: ':ORD_TYPE', type: 'VARCHAR2', value: 'STANDARD' },
          { name: ':PAYMENT_CD', type: 'VARCHAR2', value: 'CARD' },
          { name: ':DELIVERY_ADDR', type: 'VARCHAR2', value: 'GANGNAM' },
          { name: ':COUPON_ID', type: 'VARCHAR2', value: 'CP-2024-SPRING' },
          { name: ':TOTAL_AMT', type: 'NUMBER', value: '185000' },
          { name: ':DISCOUNT_RATE', type: 'NUMBER', value: '0.12' },
          { name: ':POINT_USE', type: 'NUMBER', value: '5000' },
          { name: ':GIFT_WRAP', type: 'VARCHAR2', value: 'N' },
          { name: ':SHIP_DT', type: 'DATE', value: '2024-03-02' },
        ],
      },
    ],
  },
  'WI-2024-007': {
    workItemId: 'WI-2024-007',
    bindSensitive: true,
    sets: [
      {
        id: 'BS-007-1',
        capturedAt: '2026-04-02T02:30:00',
        source: 'V$SQL',
        variables: [
          { name: ':TXN_TYPE', type: 'VARCHAR2', value: 'PAYMENT' },
          { name: ':AMOUNT', type: 'NUMBER', value: '50000' },
          { name: ':REG_DATE', type: 'DATE', value: '2026-04-02' },
          { name: ':MERCHANT_ID', type: 'NUMBER', value: '4521' },
          { name: ':CARD_TYPE', type: 'VARCHAR2', value: 'VISA' },
          { name: ':APPROVAL_NO', type: 'VARCHAR2', value: '20240324-0892' },
          { name: ':INSTALLMENT', type: 'NUMBER', value: '3' },
          { name: ':FEE_RATE', type: 'NUMBER', value: '0.025' },
          { name: ':BANK_CD', type: 'VARCHAR2', value: 'KB' },
          { name: ':TERMINAL_ID', type: 'VARCHAR2', value: 'POS-GN-042' },
          { name: ':CURRENCY_CD', type: 'VARCHAR2', value: 'KRW' },
          { name: ':AUTH_DT', type: 'DATE', value: '2026-04-02' },
        ],
      },
      {
        id: 'BS-007-2',
        capturedAt: '2026-04-01T22:15:00',
        source: 'MaxGauge',
        variables: [
          { name: ':TXN_TYPE', type: 'VARCHAR2', value: 'REFUND' },
          { name: ':AMOUNT', type: 'NUMBER', value: '12000' },
          { name: ':REG_DATE', type: 'DATE', value: '2026-04-01' },
          { name: ':MERCHANT_ID', type: 'NUMBER', value: '4521' },
          { name: ':CARD_TYPE', type: 'VARCHAR2', value: 'MASTER' },
          { name: ':APPROVAL_NO', type: 'VARCHAR2', value: '20240323-1204' },
          { name: ':INSTALLMENT', type: 'NUMBER', value: '1' },
          { name: ':FEE_RATE', type: 'NUMBER', value: '0.020' },
          { name: ':BANK_CD', type: 'VARCHAR2', value: 'SHINHAN' },
          { name: ':TERMINAL_ID', type: 'VARCHAR2', value: 'POS-GN-042' },
          { name: ':CURRENCY_CD', type: 'VARCHAR2', value: 'KRW' },
          { name: ':AUTH_DT', type: 'DATE', value: '2026-04-01' },
        ],
      },
      {
        id: 'BS-007-3',
        capturedAt: '2026-03-31T16:00:00',
        source: 'AWR',
        variables: [
          { name: ':TXN_TYPE', type: 'VARCHAR2', value: 'PAYMENT' },
          { name: ':AMOUNT', type: 'NUMBER', value: '230000' },
          { name: ':REG_DATE', type: 'DATE', value: '2026-03-31' },
          { name: ':MERCHANT_ID', type: 'NUMBER', value: '8810' },
          { name: ':CARD_TYPE', type: 'VARCHAR2', value: 'AMEX' },
          { name: ':APPROVAL_NO', type: 'VARCHAR2', value: '20240322-0561' },
          { name: ':INSTALLMENT', type: 'NUMBER', value: '6' },
          { name: ':FEE_RATE', type: 'NUMBER', value: '0.030' },
          { name: ':BANK_CD', type: 'VARCHAR2', value: 'HANA' },
          { name: ':TERMINAL_ID', type: 'VARCHAR2', value: 'WEB-MAIN' },
          { name: ':CURRENCY_CD', type: 'VARCHAR2', value: 'USD' },
          { name: ':AUTH_DT', type: 'DATE', value: '2026-03-31' },
        ],
      },
    ],
  },
  'WI-2024-001': {
    workItemId: 'WI-2024-001',
    bindSensitive: true,
    sets: [
      {
        id: 'BS-001-1',
        capturedAt: '2026-04-02T02:00:00',
        source: 'MaxGauge',
        variables: [
          { name: ':STORE_ID', type: 'NUMBER', value: '512' },
          { name: ':FROM_DT', type: 'DATE', value: '2026-03-10' },
          { name: ':TO_DT', type: 'DATE', value: '2026-04-02' },
          { name: ':STATUS_CD', type: 'VARCHAR2', value: 'SHIPPED' },
          { name: ':CARRIER_ID', type: 'NUMBER', value: '3' },
          { name: ':REGION', type: 'VARCHAR2', value: 'SEOUL' },
          { name: ':MIN_QTY', type: 'NUMBER', value: '10' },
          { name: ':MAX_QTY', type: 'NUMBER', value: '5000' },
          { name: ':PRIORITY', type: 'VARCHAR2', value: 'HIGH' },
          { name: ':CUST_TYPE', type: 'VARCHAR2', value: 'VIP' },
          { name: ':CHANNEL', type: 'VARCHAR2', value: 'ONLINE' },
          { name: ':CURRENCY', type: 'VARCHAR2', value: 'KRW' },
        ],
      },
      {
        id: 'BS-001-2',
        capturedAt: '2026-04-02T00:30:00',
        source: 'MaxGauge',
        variables: [
          { name: ':STORE_ID', type: 'NUMBER', value: '128' },
          { name: ':FROM_DT', type: 'DATE', value: '2026-03-10' },
          { name: ':TO_DT', type: 'DATE', value: '2026-04-02' },
          { name: ':STATUS_CD', type: 'VARCHAR2', value: 'DELIVERED' },
          { name: ':CARRIER_ID', type: 'NUMBER', value: '7' },
          { name: ':REGION', type: 'VARCHAR2', value: 'BUSAN' },
          { name: ':MIN_QTY', type: 'NUMBER', value: '1' },
          { name: ':MAX_QTY', type: 'NUMBER', value: '999' },
          { name: ':PRIORITY', type: 'VARCHAR2', value: 'NORMAL' },
          { name: ':CUST_TYPE', type: 'VARCHAR2', value: 'REGULAR' },
          { name: ':CHANNEL', type: 'VARCHAR2', value: 'OFFLINE' },
          { name: ':CURRENCY', type: 'VARCHAR2', value: 'KRW' },
        ],
      },
      {
        id: 'BS-001-3',
        capturedAt: '2026-04-01T22:15:00',
        source: 'AWR',
        variables: [
          { name: ':STORE_ID', type: 'NUMBER', value: '64' },
          { name: ':FROM_DT', type: 'DATE', value: '2026-03-05' },
          { name: ':TO_DT', type: 'DATE', value: '2026-04-01' },
          { name: ':STATUS_CD', type: 'VARCHAR2', value: 'PENDING' },
          { name: ':CARRIER_ID', type: 'NUMBER', value: '1' },
          { name: ':REGION', type: 'VARCHAR2', value: 'INCHEON' },
          { name: ':MIN_QTY', type: 'NUMBER', value: '50' },
          { name: ':MAX_QTY', type: 'NUMBER', value: '10000' },
          { name: ':PRIORITY', type: 'VARCHAR2', value: 'LOW' },
          { name: ':CUST_TYPE', type: 'VARCHAR2', value: 'WHOLESALE' },
          { name: ':CHANNEL', type: 'VARCHAR2', value: 'B2B' },
          { name: ':CURRENCY', type: 'VARCHAR2', value: 'USD' },
        ],
      },
      {
        id: 'BS-001-4',
        capturedAt: '2026-04-01T18:45:00',
        source: 'MaxGauge',
        variables: [
          { name: ':STORE_ID', type: 'NUMBER', value: '256' },
          { name: ':FROM_DT', type: 'DATE', value: '2026-03-19' },
          { name: ':TO_DT', type: 'DATE', value: '2026-04-01' },
          { name: ':STATUS_CD', type: 'VARCHAR2', value: 'SHIPPED' },
          { name: ':CARRIER_ID', type: 'NUMBER', value: '5' },
          { name: ':REGION', type: 'VARCHAR2', value: 'DAEGU' },
          { name: ':MIN_QTY', type: 'NUMBER', value: '20' },
          { name: ':MAX_QTY', type: 'NUMBER', value: '3000' },
          { name: ':PRIORITY', type: 'VARCHAR2', value: 'HIGH' },
          { name: ':CUST_TYPE', type: 'VARCHAR2', value: 'VIP' },
          { name: ':CHANNEL', type: 'VARCHAR2', value: 'MOBILE' },
          { name: ':CURRENCY', type: 'VARCHAR2', value: 'KRW' },
        ],
      },
      {
        id: 'BS-001-5',
        capturedAt: '2026-04-01T14:20:00',
        source: 'AWR',
        variables: [
          { name: ':STORE_ID', type: 'NUMBER', value: '900' },
          { name: ':FROM_DT', type: 'DATE', value: '2026-03-05' },
          { name: ':TO_DT', type: 'DATE', value: '2026-04-01' },
          { name: ':STATUS_CD', type: 'VARCHAR2', value: 'CANCELLED' },
          { name: ':CARRIER_ID', type: 'NUMBER', value: '2' },
          { name: ':REGION', type: 'VARCHAR2', value: 'SEOUL' },
          { name: ':MIN_QTY', type: 'NUMBER', value: '100' },
          { name: ':MAX_QTY', type: 'NUMBER', value: '50000' },
          { name: ':PRIORITY', type: 'VARCHAR2', value: 'URGENT' },
          { name: ':CUST_TYPE', type: 'VARCHAR2', value: 'ENTERPRISE' },
          { name: ':CHANNEL', type: 'VARCHAR2', value: 'API' },
          { name: ':CURRENCY', type: 'VARCHAR2', value: 'JPY' },
        ],
      },
      {
        id: 'BS-001-6',
        capturedAt: '2026-04-01T10:00:00',
        source: 'V$SQL',
        variables: [
          { name: ':STORE_ID', type: 'NUMBER', value: '77' },
          { name: ':FROM_DT', type: 'DATE', value: '2026-03-24' },
          { name: ':TO_DT', type: 'DATE', value: '2026-04-01' },
          { name: ':STATUS_CD', type: 'VARCHAR2', value: 'PROCESSING' },
          { name: ':CARRIER_ID', type: 'NUMBER', value: '4' },
          { name: ':REGION', type: 'VARCHAR2', value: 'GWANGJU' },
          { name: ':MIN_QTY', type: 'NUMBER', value: '5' },
          { name: ':MAX_QTY', type: 'NUMBER', value: '800' },
          { name: ':PRIORITY', type: 'VARCHAR2', value: 'NORMAL' },
          { name: ':CUST_TYPE', type: 'VARCHAR2', value: 'REGULAR' },
          { name: ':CHANNEL', type: 'VARCHAR2', value: 'POS' },
          { name: ':CURRENCY', type: 'VARCHAR2', value: 'KRW' },
        ],
      },
      {
        id: 'BS-001-7',
        capturedAt: '2026-04-01T06:30:00',
        source: 'MaxGauge',
        variables: [
          { name: ':STORE_ID', type: 'NUMBER', value: '1024' },
          { name: ':FROM_DT', type: 'DATE', value: '2026-03-06' },
          { name: ':TO_DT', type: 'DATE', value: '2026-04-01' },
          { name: ':STATUS_CD', type: 'VARCHAR2', value: 'RETURNED' },
          { name: ':CARRIER_ID', type: 'NUMBER', value: '6' },
          { name: ':REGION', type: 'VARCHAR2', value: 'JEJU' },
          { name: ':MIN_QTY', type: 'NUMBER', value: '1' },
          { name: ':MAX_QTY', type: 'NUMBER', value: '200' },
          { name: ':PRIORITY', type: 'VARCHAR2', value: 'LOW' },
          { name: ':CUST_TYPE', type: 'VARCHAR2', value: 'TRIAL' },
          { name: ':CHANNEL', type: 'VARCHAR2', value: 'PARTNER' },
          { name: ':CURRENCY', type: 'VARCHAR2', value: 'KRW' },
        ],
      },
      {
        id: 'BS-001-8',
        capturedAt: '2026-03-31T23:00:00',
        source: 'AWR',
        variables: [
          { name: ':STORE_ID', type: 'NUMBER', value: '333' },
          { name: ':FROM_DT', type: 'DATE', value: '2026-03-10' },
          { name: ':TO_DT', type: 'DATE', value: '2026-03-31' },
          { name: ':STATUS_CD', type: 'VARCHAR2', value: 'SHIPPED' },
          { name: ':CARRIER_ID', type: 'NUMBER', value: '8' },
          { name: ':REGION', type: 'VARCHAR2', value: 'SEJONG' },
          { name: ':MIN_QTY', type: 'NUMBER', value: '30' },
          { name: ':MAX_QTY', type: 'NUMBER', value: '7000' },
          { name: ':PRIORITY', type: 'VARCHAR2', value: 'HIGH' },
          { name: ':CUST_TYPE', type: 'VARCHAR2', value: 'VIP' },
          { name: ':CHANNEL', type: 'VARCHAR2', value: 'ONLINE' },
          { name: ':CURRENCY', type: 'VARCHAR2', value: 'EUR' },
        ],
      },
      {
        id: 'BS-001-9',
        capturedAt: '2026-03-31T19:30:00',
        source: 'MaxGauge',
        variables: [
          { name: ':STORE_ID', type: 'NUMBER', value: '45' },
          { name: ':FROM_DT', type: 'DATE', value: '2026-03-29' },
          { name: ':TO_DT', type: 'DATE', value: '2026-03-31' },
          { name: ':STATUS_CD', type: 'VARCHAR2', value: 'DELIVERED' },
          { name: ':CARRIER_ID', type: 'NUMBER', value: '3' },
          { name: ':REGION', type: 'VARCHAR2', value: 'SUWON' },
          { name: ':MIN_QTY', type: 'NUMBER', value: '15' },
          { name: ':MAX_QTY', type: 'NUMBER', value: '1500' },
          { name: ':PRIORITY', type: 'VARCHAR2', value: 'NORMAL' },
          { name: ':CUST_TYPE', type: 'VARCHAR2', value: 'REGULAR' },
          { name: ':CHANNEL', type: 'VARCHAR2', value: 'OFFLINE' },
          { name: ':CURRENCY', type: 'VARCHAR2', value: 'KRW' },
        ],
      },
      {
        id: 'BS-001-10',
        capturedAt: '2026-03-31T15:00:00',
        source: 'V$SQL',
        variables: [
          { name: ':STORE_ID', type: 'NUMBER', value: '612' },
          { name: ':FROM_DT', type: 'DATE', value: '2026-03-05' },
          { name: ':TO_DT', type: 'DATE', value: '2026-03-31' },
          { name: ':STATUS_CD', type: 'VARCHAR2', value: 'PENDING' },
          { name: ':CARRIER_ID', type: 'NUMBER', value: '9' },
          { name: ':REGION', type: 'VARCHAR2', value: 'ULSAN' },
          { name: ':MIN_QTY', type: 'NUMBER', value: '200' },
          { name: ':MAX_QTY', type: 'NUMBER', value: '20000' },
          { name: ':PRIORITY', type: 'VARCHAR2', value: 'URGENT' },
          { name: ':CUST_TYPE', type: 'VARCHAR2', value: 'ENTERPRISE' },
          { name: ':CHANNEL', type: 'VARCHAR2', value: 'EDI' },
          { name: ':CURRENCY', type: 'VARCHAR2', value: 'CNY' },
        ],
      },
      {
        id: 'BS-001-11',
        capturedAt: '2026-03-31T11:15:00',
        source: 'MaxGauge',
        variables: [
          { name: ':STORE_ID', type: 'NUMBER', value: '88' },
          { name: ':FROM_DT', type: 'DATE', value: '2026-03-10' },
          { name: ':TO_DT', type: 'DATE', value: '2026-03-31' },
          { name: ':STATUS_CD', type: 'VARCHAR2', value: 'SHIPPED' },
          { name: ':CARRIER_ID', type: 'NUMBER', value: '1' },
          { name: ':REGION', type: 'VARCHAR2', value: 'CHANGWON' },
          { name: ':MIN_QTY', type: 'NUMBER', value: '75' },
          { name: ':MAX_QTY', type: 'NUMBER', value: '4000' },
          { name: ':PRIORITY', type: 'VARCHAR2', value: 'HIGH' },
          { name: ':CUST_TYPE', type: 'VARCHAR2', value: 'VIP' },
          { name: ':CHANNEL', type: 'VARCHAR2', value: 'ONLINE' },
          { name: ':CURRENCY', type: 'VARCHAR2', value: 'KRW' },
        ],
      },
    ],
  },
  'WI-2024-008': {
    workItemId: 'WI-2024-008',
    bindSensitive: false,
    sets: [
      { id: 'BS-008-1', capturedAt: '2026-04-02T02:45:00', source: 'MaxGauge', variables: [
        { name: ':REGION', type: 'VARCHAR2', value: 'ASIA' },
        { name: ':YEAR', type: 'NUMBER', value: '2024' },
        { name: ':QUARTER', type: 'NUMBER', value: '1' },
        { name: ':COUNTRY_CD', type: 'VARCHAR2', value: 'KR' },
        { name: ':CURRENCY', type: 'VARCHAR2', value: 'KRW' },
        { name: ':MIN_AMT', type: 'NUMBER', value: '1000000' },
        { name: ':MAX_AMT', type: 'NUMBER', value: '99999999' },
        { name: ':STATUS', type: 'VARCHAR2', value: 'ACTIVE' },
        { name: ':CHANNEL', type: 'VARCHAR2', value: 'ONLINE' },
        { name: ':DEPT_ID', type: 'NUMBER', value: '120' },
        { name: ':MGR_ID', type: 'NUMBER', value: '5042' },
        { name: ':PROD_GRP', type: 'VARCHAR2', value: 'PREMIUM' },
        { name: ':START_DT', type: 'DATE', value: '2026-03-05' },
        { name: ':END_DT', type: 'DATE', value: '2024-03-31' },
        { name: ':INCLUDE_SUB', type: 'VARCHAR2', value: 'Y' },
        { name: ':SORT_KEY', type: 'VARCHAR2', value: 'AMT_DESC' },
        { name: ':PAGE_NO', type: 'NUMBER', value: '1' },
        { name: ':PAGE_SIZE', type: 'NUMBER', value: '50' },
        { name: ':LANG', type: 'VARCHAR2', value: 'KO' },
        { name: ':EXPORT_FMT', type: 'VARCHAR2', value: 'XLSX' },
      ]},
      { id: 'BS-008-2', capturedAt: '2026-04-01T10:00:00', source: 'AWR', variables: [
        { name: ':REGION', type: 'VARCHAR2', value: 'EUROPE' },
        { name: ':YEAR', type: 'NUMBER', value: '2023' },
        { name: ':QUARTER', type: 'NUMBER', value: '4' },
        { name: ':COUNTRY_CD', type: 'VARCHAR2', value: 'DE' },
        { name: ':CURRENCY', type: 'VARCHAR2', value: 'EUR' },
        { name: ':MIN_AMT', type: 'NUMBER', value: '500000' },
        { name: ':MAX_AMT', type: 'NUMBER', value: '50000000' },
        { name: ':STATUS', type: 'VARCHAR2', value: 'ACTIVE' },
        { name: ':CHANNEL', type: 'VARCHAR2', value: 'ALL' },
        { name: ':DEPT_ID', type: 'NUMBER', value: '200' },
        { name: ':MGR_ID', type: 'NUMBER', value: '3018' },
        { name: ':PROD_GRP', type: 'VARCHAR2', value: 'ALL' },
        { name: ':START_DT', type: 'DATE', value: '2023-10-01' },
        { name: ':END_DT', type: 'DATE', value: '2023-12-31' },
        { name: ':INCLUDE_SUB', type: 'VARCHAR2', value: 'N' },
        { name: ':SORT_KEY', type: 'VARCHAR2', value: 'DATE_DESC' },
        { name: ':PAGE_NO', type: 'NUMBER', value: '1' },
        { name: ':PAGE_SIZE', type: 'NUMBER', value: '100' },
        { name: ':LANG', type: 'VARCHAR2', value: 'EN' },
        { name: ':EXPORT_FMT', type: 'VARCHAR2', value: 'CSV' },
      ]},
    ],
  },
  'WI-2024-003': {
    workItemId: 'WI-2024-003',
    bindSensitive: true,
    sets: [
      { id: 'BS-003-1', capturedAt: '2026-04-02T01:30:00', source: 'MaxGauge', variables: [
        { name: ':EMP_ID', type: 'NUMBER', value: '30421' },
        { name: ':DEPT_CD', type: 'VARCHAR2', value: 'DEV' },
      ]},
    ],
  },
  'WI-2024-015': {
    workItemId: 'WI-2024-015',
    bindSensitive: true,
    sets: [
      { id: 'BS-015-1', capturedAt: '2026-04-02T03:00:00', source: 'V$SQL', variables: [
        { name: ':INV_NO', type: 'VARCHAR2', value: 'INV-20240301-0042' },
        { name: ':PAY_TYPE', type: 'VARCHAR2', value: 'CARD' },
        { name: ':AMT', type: 'NUMBER', value: '1250000' },
      ]},
      { id: 'BS-015-2', capturedAt: '2026-03-31T18:30:00', source: 'MaxGauge', variables: [
        { name: ':INV_NO', type: 'VARCHAR2', value: 'INV-20240228-0118' },
        { name: ':PAY_TYPE', type: 'VARCHAR2', value: 'TRANSFER' },
        { name: ':AMT', type: 'NUMBER', value: '3400000' },
      ]},
    ],
  },
  'WI-2024-019': {
    workItemId: 'WI-2024-019',
    bindSensitive: false,
    sets: [
      { id: 'BS-019-1', capturedAt: '2026-04-02T02:00:00', source: 'MaxGauge', variables: [
        { name: ':STORE_ID', type: 'NUMBER', value: '512' },
        { name: ':FROM_DT', type: 'DATE', value: '2026-03-10' },
        { name: ':TO_DT', type: 'DATE', value: '2026-04-02' },
      ]},
    ],
  },
  'WI-2024-020': {
    workItemId: 'WI-2024-020',
    bindSensitive: true,
    sets: [
      { id: 'BS-020-1', capturedAt: '2026-04-02T01:15:00', source: 'MaxGauge', variables: [
        { name: ':ACCT_NO', type: 'VARCHAR2', value: '110-2024-88421' },
        { name: ':TXN_DATE', type: 'DATE', value: '2026-04-02' },
      ]},
      { id: 'BS-020-2', capturedAt: '2026-04-01T09:45:00', source: 'AWR', variables: [
        { name: ':ACCT_NO', type: 'VARCHAR2', value: '110-2024-50012' },
        { name: ':TXN_DATE', type: 'DATE', value: '2026-04-01' },
      ]},
      { id: 'BS-020-3', capturedAt: '2026-03-31T14:20:00', source: 'MaxGauge', variables: [
        { name: ':ACCT_NO', type: 'VARCHAR2', value: '110-2023-31005' },
        { name: ':TXN_DATE', type: 'DATE', value: '2026-03-31' },
      ]},
    ],
  },
  'WI-2024-021': {
    workItemId: 'WI-2024-021',
    bindSensitive: false,
    sets: [
      { id: 'BS-021-1', capturedAt: '2026-04-02T02:50:00', source: 'MaxGauge', variables: [
        { name: ':BATCH_ID', type: 'NUMBER', value: '20240324001' },
        { name: ':PROC_TYPE', type: 'VARCHAR2', value: 'DAILY_CLOSE' },
      ]},
    ],
  },
  'WI-2024-022': {
    workItemId: 'WI-2024-022',
    bindSensitive: true,
    sets: [
      { id: 'BS-022-1', capturedAt: '2026-04-02T01:50:00', source: 'V$SQL', variables: [
        { name: ':USER_ID', type: 'NUMBER', value: '98712' },
        { name: ':SESSION_DT', type: 'DATE', value: '2026-04-02' },
        { name: ':CHANNEL', type: 'VARCHAR2', value: 'MOBILE' },
      ]},
      { id: 'BS-022-2', capturedAt: '2026-04-01T16:30:00', source: 'MaxGauge', variables: [
        { name: ':USER_ID', type: 'NUMBER', value: '45023' },
        { name: ':SESSION_DT', type: 'DATE', value: '2026-04-01' },
        { name: ':CHANNEL', type: 'VARCHAR2', value: 'WEB' },
      ]},
    ],
  },
  'WI-2024-023': {
    workItemId: 'WI-2024-023',
    bindSensitive: false,
    sets: [
      { id: 'BS-023-1', capturedAt: '2026-04-02T03:20:00', source: 'MaxGauge', variables: [
        { name: ':LOG_DATE', type: 'DATE', value: '2026-04-01' },
        { name: ':LEVEL', type: 'VARCHAR2', value: 'ERROR' },
      ]},
    ],
  },
  'WI-2024-024': {
    workItemId: 'WI-2024-024',
    bindSensitive: true,
    sets: [
      { id: 'BS-024-1', capturedAt: '2026-04-02T02:10:00', source: 'MaxGauge', variables: [
        { name: ':ORG_CD', type: 'VARCHAR2', value: 'HQ001' },
        { name: ':PERIOD', type: 'VARCHAR2', value: '202403' },
        { name: ':CURRENCY', type: 'VARCHAR2', value: 'KRW' },
      ]},
      { id: 'BS-024-2', capturedAt: '2026-03-31T20:00:00', source: 'AWR', variables: [
        { name: ':ORG_CD', type: 'VARCHAR2', value: 'BR015' },
        { name: ':PERIOD', type: 'VARCHAR2', value: '202402' },
        { name: ':CURRENCY', type: 'VARCHAR2', value: 'USD' },
      ]},
    ],
  },
  'WI-2024-025': {
    workItemId: 'WI-2024-025',
    bindSensitive: false,
    sets: [
      { id: 'BS-025-1', capturedAt: '2026-04-02T01:40:00', source: 'MaxGauge', variables: [
        { name: ':ITEM_CD', type: 'VARCHAR2', value: 'SKU-20240101' },
        { name: ':WH_ID', type: 'NUMBER', value: '3' },
      ]},
    ],
  },
  'WI-2024-034': {
    workItemId: 'WI-2024-034',
    bindSensitive: true,
    sets: [
      { id: 'BS-034-1', capturedAt: '2026-04-02T02:25:00', source: 'V$SQL', variables: [
        { name: ':POLICY_NO', type: 'VARCHAR2', value: 'POL-2024-88421' },
        { name: ':EFF_DATE', type: 'DATE', value: '2026-03-05' },
      ]},
      { id: 'BS-034-2', capturedAt: '2026-04-01T11:00:00', source: 'MaxGauge', variables: [
        { name: ':POLICY_NO', type: 'VARCHAR2', value: 'POL-2023-45100' },
        { name: ':EFF_DATE', type: 'DATE', value: '2023-07-01' },
      ]},
    ],
  },
  'WI-2024-035': {
    workItemId: 'WI-2024-035',
    bindSensitive: false,
    sets: [
      { id: 'BS-035-1', capturedAt: '2026-04-02T03:05:00', source: 'MaxGauge', variables: [
        { name: ':REPORT_TYPE', type: 'VARCHAR2', value: 'MONTHLY' },
        { name: ':BASE_DT', type: 'DATE', value: '2026-03-10' },
      ]},
    ],
  },
  'WI-2024-049': {
    workItemId: 'WI-2024-049',
    bindSensitive: true,
    sets: [
      { id: 'BS-049-1', capturedAt: '2026-04-02T02:35:00', source: 'MaxGauge', variables: [
        { name: ':CLAIM_ID', type: 'NUMBER', value: '2024030042' },
        { name: ':STATUS', type: 'VARCHAR2', value: 'PENDING' },
      ]},
      { id: 'BS-049-2', capturedAt: '2026-04-01T15:10:00', source: 'AWR', variables: [
        { name: ':CLAIM_ID', type: 'NUMBER', value: '2024020118' },
        { name: ':STATUS', type: 'VARCHAR2', value: 'APPROVED' },
      ]},
    ],
  },
  'WI-2024-026': {
    workItemId: 'WI-2024-026',
    bindSensitive: false,
    sets: [
      { id: 'BS-026-1', capturedAt: '2026-04-02T01:55:00', source: 'MaxGauge', variables: [
        { name: ':VENDOR_ID', type: 'NUMBER', value: '4210' },
        { name: ':PO_DATE', type: 'DATE', value: '2026-03-24' },
      ]},
    ],
  },
  'WI-2024-027': {
    workItemId: 'WI-2024-027',
    bindSensitive: true,
    sets: [
      { id: 'BS-027-1', capturedAt: '2026-04-02T02:40:00', source: 'V$SQL', variables: [
        { name: ':PATIENT_ID', type: 'NUMBER', value: '100245' },
        { name: ':VISIT_DT', type: 'DATE', value: '2026-04-02' },
        { name: ':DEPT', type: 'VARCHAR2', value: 'CARDIO' },
      ]},
      { id: 'BS-027-2', capturedAt: '2026-04-01T07:30:00', source: 'MaxGauge', variables: [
        { name: ':PATIENT_ID', type: 'NUMBER', value: '88012' },
        { name: ':VISIT_DT', type: 'DATE', value: '2026-04-01' },
        { name: ':DEPT', type: 'VARCHAR2', value: 'ORTHO' },
      ]},
    ],
  },
  'WI-2024-028': {
    workItemId: 'WI-2024-028',
    bindSensitive: false,
    sets: [
      { id: 'BS-028-1', capturedAt: '2026-04-02T03:15:00', source: 'MaxGauge', variables: [
        { name: ':SHIP_ID', type: 'NUMBER', value: '20240324001' },
        { name: ':CARRIER', type: 'VARCHAR2', value: 'CJ' },
      ]},
    ],
  },
  'WI-2024-029': {
    workItemId: 'WI-2024-029',
    bindSensitive: true,
    sets: [
      { id: 'BS-029-1', capturedAt: '2026-04-02T01:20:00', source: 'MaxGauge', variables: [
        { name: ':CONTRACT_NO', type: 'VARCHAR2', value: 'CT-2024-0042' },
        { name: ':SIGN_DT', type: 'DATE', value: '2026-03-06' },
      ]},
      { id: 'BS-029-2', capturedAt: '2026-03-31T21:00:00', source: 'AWR', variables: [
        { name: ':CONTRACT_NO', type: 'VARCHAR2', value: 'CT-2023-1205' },
        { name: ':SIGN_DT', type: 'DATE', value: '2023-12-01' },
      ]},
    ],
  },
  'WI-2024-030': {
    workItemId: 'WI-2024-030',
    bindSensitive: false,
    sets: [
      { id: 'BS-030-1', capturedAt: '2026-04-02T02:55:00', source: 'MaxGauge', variables: [
        { name: ':CATEGORY', type: 'VARCHAR2', value: 'ELECTRONICS' },
        { name: ':PRICE_MIN', type: 'NUMBER', value: '10000' },
        { name: ':PRICE_MAX', type: 'NUMBER', value: '500000' },
      ]},
      { id: 'BS-030-2', capturedAt: '2026-04-01T13:45:00', source: 'V$SQL', variables: [
        { name: ':CATEGORY', type: 'VARCHAR2', value: 'CLOTHING' },
        { name: ':PRICE_MIN', type: 'NUMBER', value: '5000' },
        { name: ':PRICE_MAX', type: 'NUMBER', value: '200000' },
      ]},
    ],
  },
  'WI-2024-036': {
    workItemId: 'WI-2024-036',
    bindSensitive: false,
    sets: [
      { id: 'BS-036-1', capturedAt: '2026-04-02T01:10:00', source: 'MaxGauge', variables: [
        { name: ':SURVEY_ID', type: 'NUMBER', value: '2024001' },
        { name: ':RESP_TYPE', type: 'VARCHAR2', value: 'COMPLETE' },
      ]},
    ],
  },
  'WI-2024-037': {
    workItemId: 'WI-2024-037',
    bindSensitive: true,
    sets: [
      { id: 'BS-037-1', capturedAt: '2026-04-02T02:20:00', source: 'MaxGauge', variables: [
        { name: ':ASSET_ID', type: 'NUMBER', value: '55042' },
        { name: ':EVAL_DT', type: 'DATE', value: '2026-04-02' },
        { name: ':ASSET_TYPE', type: 'VARCHAR2', value: 'REAL_ESTATE' },
      ]},
      { id: 'BS-037-2', capturedAt: '2026-03-31T19:00:00', source: 'AWR', variables: [
        { name: ':ASSET_ID', type: 'NUMBER', value: '42018' },
        { name: ':EVAL_DT', type: 'DATE', value: '2026-03-31' },
        { name: ':ASSET_TYPE', type: 'VARCHAR2', value: 'STOCK' },
      ]},
    ],
  },
  'WI-2024-038': {
    workItemId: 'WI-2024-038',
    bindSensitive: false,
    sets: [
      { id: 'BS-038-1', capturedAt: '2026-04-02T03:25:00', source: 'V$SQL', variables: [
        { name: ':TASK_ID', type: 'NUMBER', value: '8842' },
        { name: ':ASSIGN_TO', type: 'VARCHAR2', value: 'TEAM_A' },
      ]},
    ],
  },
  'WI-2024-046': {
    workItemId: 'WI-2024-046',
    bindSensitive: true,
    sets: [
      { id: 'BS-046-1', capturedAt: '2026-04-02T01:35:00', source: 'MaxGauge', variables: [
        { name: ':BRANCH_CD', type: 'VARCHAR2', value: 'BR-GANGNAM' },
        { name: ':TXN_DT', type: 'DATE', value: '2026-04-02' },
      ]},
      { id: 'BS-046-2', capturedAt: '2026-04-01T17:20:00', source: 'MaxGauge', variables: [
        { name: ':BRANCH_CD', type: 'VARCHAR2', value: 'BR-JONGRO' },
        { name: ':TXN_DT', type: 'DATE', value: '2026-04-01' },
      ]},
    ],
  },
  'WI-2024-047': {
    workItemId: 'WI-2024-047',
    bindSensitive: false,
    sets: [
      { id: 'BS-047-1', capturedAt: '2026-04-02T02:05:00', source: 'MaxGauge', variables: [
        { name: ':MENU_CD', type: 'VARCHAR2', value: 'M-DASHBOARD' },
        { name: ':ACCESS_DT', type: 'DATE', value: '2026-04-02' },
      ]},
    ],
  },
  'WI-2024-048': {
    workItemId: 'WI-2024-048',
    bindSensitive: true,
    sets: [
      { id: 'BS-048-1', capturedAt: '2026-04-02T01:05:00', source: 'MaxGauge', variables: [
        { name: ':ORDER_ID', type: 'NUMBER', value: '20240324100042' },
        { name: ':STATUS', type: 'VARCHAR2', value: 'SHIPPED' },
        { name: ':CUST_GRD', type: 'VARCHAR2', value: 'VIP' },
      ]},
      { id: 'BS-048-2', capturedAt: '2026-04-01T20:30:00', source: 'AWR', variables: [
        { name: ':ORDER_ID', type: 'NUMBER', value: '20240323080015' },
        { name: ':STATUS', type: 'VARCHAR2', value: 'PROCESSING' },
        { name: ':CUST_GRD', type: 'VARCHAR2', value: 'NORMAL' },
      ]},
    ],
  },
  'WI-2024-050': {
    workItemId: 'WI-2024-050',
    bindSensitive: false,
    sets: [
      { id: 'BS-050-1', capturedAt: '2026-04-02T02:15:00', source: 'V$SQL', variables: [
        { name: ':RPT_CD', type: 'VARCHAR2', value: 'FIN-Q1-2024' },
        { name: ':FISCAL_YR', type: 'NUMBER', value: '2024' },
      ]},
    ],
  },
  'WI-2024-051': {
    workItemId: 'WI-2024-051',
    bindSensitive: true,
    sets: [
      { id: 'BS-051-1', capturedAt: '2026-04-02T03:30:00', source: 'MaxGauge', variables: [
        { name: ':STUDENT_ID', type: 'NUMBER', value: '2024010042' },
        { name: ':COURSE_CD', type: 'VARCHAR2', value: 'CS101' },
        { name: ':SEMESTER', type: 'VARCHAR2', value: '2024-1' },
      ]},
      { id: 'BS-051-2', capturedAt: '2026-03-31T11:15:00', source: 'MaxGauge', variables: [
        { name: ':STUDENT_ID', type: 'NUMBER', value: '2023080118' },
        { name: ':COURSE_CD', type: 'VARCHAR2', value: 'EE201' },
        { name: ':SEMESTER', type: 'VARCHAR2', value: '2023-2' },
      ]},
    ],
  },
  'WI-2024-002': {
    workItemId: 'WI-2024-002',
    bindSensitive: false,
    sets: [
      { id: 'BS-002-1', capturedAt: '2026-04-02T01:25:00', source: 'MaxGauge', variables: [
        { name: ':SCHEMA_NM', type: 'VARCHAR2', value: 'HR' },
        { name: ':OBJ_TYPE', type: 'VARCHAR2', value: 'TABLE' },
      ]},
    ],
  },
  'WI-2024-018': {
    workItemId: 'WI-2024-018',
    bindSensitive: true,
    sets: [
      { id: 'BS-018-1', capturedAt: '2026-04-02T02:45:00', source: 'MaxGauge', variables: [
        { name: ':CUST_ID', type: 'NUMBER', value: '77421' },
        { name: ':PRODUCT', type: 'VARCHAR2', value: 'SAVINGS' },
        { name: ':OPEN_DT', type: 'DATE', value: '2023-06-15' },
      ]},
      { id: 'BS-018-2', capturedAt: '2026-04-01T06:40:00', source: 'AWR', variables: [
        { name: ':CUST_ID', type: 'NUMBER', value: '33012' },
        { name: ':PRODUCT', type: 'VARCHAR2', value: 'LOAN' },
        { name: ':OPEN_DT', type: 'DATE', value: '2024-01-10' },
      ]},
    ],
  },
  'WI-2024-031': {
    workItemId: 'WI-2024-031',
    bindSensitive: false,
    sets: [
      { id: 'BS-031-1', capturedAt: '2026-04-02T01:50:00', source: 'MaxGauge', variables: [
        { name: ':EVENT_CD', type: 'VARCHAR2', value: 'EVT-2024-SPRING' },
        { name: ':REG_DT', type: 'DATE', value: '2026-03-10' },
      ]},
    ],
  },
  'WI-2024-032': {
    workItemId: 'WI-2024-032',
    bindSensitive: true,
    sets: [
      { id: 'BS-032-1', capturedAt: '2026-04-02T03:10:00', source: 'MaxGauge', variables: [
        { name: ':DEVICE_ID', type: 'VARCHAR2', value: 'DEV-SENSOR-042' },
        { name: ':READ_DT', type: 'DATE', value: '2026-04-02' },
        { name: ':THRESHOLD', type: 'NUMBER', value: '85' },
      ]},
      { id: 'BS-032-2', capturedAt: '2026-04-01T12:45:00', source: 'V$SQL', variables: [
        { name: ':DEVICE_ID', type: 'VARCHAR2', value: 'DEV-SENSOR-118' },
        { name: ':READ_DT', type: 'DATE', value: '2026-04-01' },
        { name: ':THRESHOLD', type: 'NUMBER', value: '90' },
      ]},
    ],
  },
  'WI-2024-039': {
    workItemId: 'WI-2024-039',
    bindSensitive: false,
    sets: [
      { id: 'BS-039-1', capturedAt: '2026-04-02T02:30:00', source: 'MaxGauge', variables: [
        { name: ':CAMP_ID', type: 'NUMBER', value: '2024042' },
        { name: ':TARGET_SEG', type: 'VARCHAR2', value: 'HIGH_VALUE' },
      ]},
    ],
  },
  'WI-2024-040': {
    workItemId: 'WI-2024-040',
    bindSensitive: true,
    sets: [
      { id: 'BS-040-1', capturedAt: '2026-04-02T01:45:00', source: 'MaxGauge', variables: [
        { name: ':TICKET_ID', type: 'NUMBER', value: '88042' },
        { name: ':PRIORITY', type: 'VARCHAR2', value: 'HIGH' },
        { name: ':ASSIGN_DT', type: 'DATE', value: '2026-04-02' },
      ]},
      { id: 'BS-040-2', capturedAt: '2026-03-31T23:00:00', source: 'AWR', variables: [
        { name: ':TICKET_ID', type: 'NUMBER', value: '87550' },
        { name: ':PRIORITY', type: 'VARCHAR2', value: 'MEDIUM' },
        { name: ':ASSIGN_DT', type: 'DATE', value: '2026-03-31' },
      ]},
    ],
  },
  'WI-2024-052': {
    workItemId: 'WI-2024-052',
    bindSensitive: false,
    sets: [
      { id: 'BS-052-1', capturedAt: '2026-04-02T03:00:00', source: 'V$SQL', variables: [
        { name: ':PROJ_CD', type: 'VARCHAR2', value: 'PRJ-2024-AI' },
        { name: ':PHASE', type: 'VARCHAR2', value: 'DEV' },
      ]},
    ],
  },
  'WI-2024-053': {
    workItemId: 'WI-2024-053',
    bindSensitive: true,
    sets: [
      { id: 'BS-053-1', capturedAt: '2026-04-02T02:10:00', source: 'MaxGauge', variables: [
        { name: ':MEMBER_ID', type: 'NUMBER', value: '550042' },
        { name: ':GRADE', type: 'VARCHAR2', value: 'GOLD' },
        { name: ':JOIN_DT', type: 'DATE', value: '2022-05-20' },
      ]},
      { id: 'BS-053-2', capturedAt: '2026-04-01T14:00:00', source: 'MaxGauge', variables: [
        { name: ':MEMBER_ID', type: 'NUMBER', value: '410118' },
        { name: ':GRADE', type: 'VARCHAR2', value: 'SILVER' },
        { name: ':JOIN_DT', type: 'DATE', value: '2023-11-01' },
      ]},
    ],
  },
  'WI-2024-054': {
    workItemId: 'WI-2024-054',
    bindSensitive: false,
    sets: [
      { id: 'BS-054-1', capturedAt: '2026-04-02T01:30:00', source: 'MaxGauge', variables: [
        { name: ':ROUTE_CD', type: 'VARCHAR2', value: 'RT-ICN-NRT' },
        { name: ':FLT_DT', type: 'DATE', value: '2024-04-15' },
      ]},
    ],
  },
}

export const executionValidations: Record<string, ExecutionValidation> = {
  'WI-2024-001': {
    id: 'EV-001',
    workItemId: 'WI-2024-001',
    sqlId: 'a1b2c3d4e5f6g',
    originalPlanText: `SQL_ID  a1b2c3d4e5f6g, child number 0
-------------------------------------
SELECT /*+ FULL(o) */ o.order_id, o.order_date, c.customer_name,
SUM(oi.quantity * oi.unit_price) total
FROM ORDERS o, CUSTOMERS c, ORDER_ITEMS oi
WHERE o.customer_id = c.customer_id AND o.order_id = oi.order_id
GROUP BY o.order_id, o.order_date, c.customer_name

Plan hash value: 3829104756

----------------------------------------------------------------------------------
| Id  | Operation               | Name          | Rows  | Bytes  | Cost (%CPU)|
----------------------------------------------------------------------------------
|   0 | SELECT STATEMENT        |               |       |        | 12450  (3) |
|   1 |  SORT GROUP BY          |               |   500 |  32500 | 12450  (3) |
|*  2 |   HASH JOIN             |               |  5000 | 325000 | 12200  (2) |
|*  3 |    HASH JOIN            |               |  5000 | 195000 |  8400  (2) |
|   4 |     TABLE ACCESS FULL   | ORDERS        | 50000 |   1.2M |  2800  (1) |
|   5 |     TABLE ACCESS FULL   | CUSTOMERS     | 10000 | 400000 |  1200  (1) |
|   6 |    TABLE ACCESS FULL    | ORDER_ITEMS   |200000 |   5.2M |  3800  (1) |
----------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------
   2 - access("O"."ORDER_ID"="OI"."ORDER_ID")
   3 - access("O"."CUSTOMER_ID"="C"."CUSTOMER_ID")

Statistics
----------------------------------------------------------
   4870000  consistent gets
    450000  physical reads
     48200  elapsed time (ms)
      1240  executions`,
    tunedPlanText: `SQL_ID  a1b2c3d4e5f6g, child number 1
-------------------------------------
SELECT o.order_id, o.order_date, c.customer_name,
SUM(oi.quantity * oi.unit_price) total
FROM ORDERS o, CUSTOMERS c, ORDER_ITEMS oi
WHERE o.customer_id = c.customer_id AND o.order_id = oi.order_id
  AND o.order_date BETWEEN :START_DATE AND :END_DATE
GROUP BY o.order_id, o.order_date, c.customer_name

Plan hash value: 1927384650

------------------------------------------------------------------------------------
| Id  | Operation                       | Name          | Rows  | Bytes| Cost(%CPU)|
------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                |               |       |      |   380  (2)|
|   1 |  SORT GROUP BY                  |               |   500 | 32500|   380  (2)|
|   2 |   NESTED LOOPS                  |               |  5000 |325000|   350  (1)|
|   3 |    NESTED LOOPS                 |               |  5000 |195000|   200  (1)|
|*  4 |     INDEX RANGE SCAN            | IDX_ORD_DATE  |  5000 |  60K |    35  (0)|
|   5 |     TABLE ACCESS BY INDEX ROWID | ORDERS        |     1 |   26 |     1  (0)|
|*  6 |    TABLE ACCESS BY INDEX ROWID  | CUSTOMERS     |     1 |   26 |     1  (0)|
|   7 |   INDEX RANGE SCAN              | IDX_OI_ORDID  |     4 |  104 |     1  (0)|
|   8 |    TABLE ACCESS BY INDEX ROWID  | ORDER_ITEMS   |     4 |  104 |     2  (0)|
------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------
   4 - access("O"."ORDER_DATE">=:START_DATE AND "O"."ORDER_DATE"<=:END_DATE)
   6 - access("O"."CUSTOMER_ID"="C"."CUSTOMER_ID")

Statistics
----------------------------------------------------------
     45000  consistent gets
      3200  physical reads
      3200  elapsed time (ms)
      1240  executions`,
    originalElapsed: 48200,
    tunedElapsed: 3200,
    originalBuffers: 4870000,
    tunedBuffers: 45000,
    originalRows: 50000,
    tunedRows: 5000,
    originalDiskReads: 450000,
    tunedDiskReads: 3200,
    validatedAt: '2026-03-31T14:00:00Z',
    validatedBy: '김민수',
    result: 'improved',
    recommendationType: 'index',
    changeDescription: 'ORDERS 테이블에 IDX_ORD_DATE 인덱스 생성 + WHERE 조건 추가로 Full Table Scan → Index Range Scan 전환',
    tunedSqlText: `SELECT o.order_id, o.order_date, c.customer_name,
       SUM(oi.quantity * oi.unit_price) total
  FROM ORDERS o, CUSTOMERS c, ORDER_ITEMS oi
 WHERE o.customer_id = c.customer_id
   AND o.order_id = oi.order_id
   AND o.order_date BETWEEN :START_DATE AND :END_DATE
 GROUP BY o.order_id, o.order_date, c.customer_name`,
  },

  'WI-2024-002': {
    id: 'EV-002',
    workItemId: 'WI-2024-002',
    sqlId: 'f7g8h9i0j1k2l',
    originalPlanText: `SQL_ID  f7g8h9i0j1k2l, child number 0
Plan hash value: 2748193650
--------------------------------------------------------------------
| Id  | Operation                     | Name    | Rows  | Cost(%CPU)|
--------------------------------------------------------------------
|   0 | SELECT STATEMENT              |         |       |  4200  (2)|
|   1 |  HASH JOIN                    |         |  8500 |  4200  (2)|
|   2 |   TABLE ACCESS FULL           | DEPT    |    50 |    12  (0)|
|   3 |   TABLE ACCESS FULL           | EMP     | 10000 |  3800  (1)|
--------------------------------------------------------------------`,
    tunedPlanText: `SQL_ID  f7g8h9i0j1k2l, child number 1
Plan hash value: 5192837460
------------------------------------------------------------------------
| Id  | Operation                         | Name            | Rows  | Cost(%CPU)|
------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                 |       |   620  (1)|
|   1 |  NESTED LOOPS                     |                 |  8500 |   620  (1)|
|   2 |   TABLE ACCESS FULL               | DEPT            |    50 |    12  (0)|
|*  3 |   TABLE ACCESS BY INDEX ROWID     | EMP             |   170 |    12  (0)|
|*  4 |    INDEX RANGE SCAN               | IDX_EMP_DEPTID  |   170 |     2  (0)|
------------------------------------------------------------------------`,
    originalElapsed: 32100,
    tunedElapsed: 4800,
    originalBuffers: 3200000,
    tunedBuffers: 320000,
    originalRows: 10000,
    tunedRows: 8500,
    originalDiskReads: 360000,
    tunedDiskReads: 28000,
    validatedAt: '2026-03-30T15:30:00Z',
    validatedBy: '이영희',
    result: 'improved',
    recommendationType: 'rewrite',
    changeDescription: 'HASH JOIN → NESTED LOOPS 변환, EMP 테이블에 IDX_EMP_DEPTID 인덱스를 활용한 SQL Rewrite',
  },

  'WI-2024-003': {
    id: 'EV-003',
    workItemId: 'WI-2024-003',
    sqlId: 'm3n4o5p6q7r8s',
    originalPlanText: `SQL_ID  m3n4o5p6q7r8s, child number 0
Plan hash value: 4019283756
--------------------------------------------------------------------
| Id  | Operation                     | Name         | Rows  | Cost(%CPU)|
--------------------------------------------------------------------
|   0 | SELECT STATEMENT              |              |       |  9800  (2)|
|   1 |  HASH JOIN                    |              |  3200 |  9800  (2)|
|   2 |   TABLE ACCESS FULL           | ACCOUNTS     |  5000 |   800  (1)|
|   3 |   TABLE ACCESS FULL           | TRANSACTIONS |800000 |  8500  (1)|
--------------------------------------------------------------------`,
    tunedPlanText: `SQL_ID  m3n4o5p6q7r8s, child number 1
Plan hash value: 5028374619
------------------------------------------------------------------------
| Id  | Operation                         | Name            | Rows  | Cost(%CPU)|
------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                 |       |  1400  (1)|
|   1 |  NESTED LOOPS                     |                 |  3200 |  1400  (1)|
|   2 |   TABLE ACCESS BY INDEX ROWID     | ACCOUNTS        |  5000 |   800  (1)|
|   3 |    INDEX FULL SCAN                | PK_ACCOUNTS     |  5000 |   120  (0)|
|*  4 |   INDEX RANGE SCAN                | IDX_TXN_ACCTID  |     1 |     1  (0)|
|   5 |    TABLE ACCESS BY INDEX ROWID    | TRANSACTIONS    |     1 |     2  (0)|
------------------------------------------------------------------------`,
    originalElapsed: 41500,
    tunedElapsed: 6200,
    originalBuffers: 4100000,
    tunedBuffers: 410000,
    originalRows: 800000,
    tunedRows: 3200,
    originalDiskReads: 304000,
    tunedDiskReads: 35000,
    validatedAt: '2026-04-01T11:00:00Z',
    validatedBy: '박준호',
    result: 'improved',
    recommendationType: 'hint',
    changeDescription: '/*+ LEADING(a) USE_NL(t) INDEX(t IDX_TXN_ACCTID) */ 힌트 추가로 TRANSACTIONS Full Scan 제거',
  },

  'WI-2024-004': {
    id: 'EV-004',
    workItemId: 'WI-2024-004',
    sqlId: 't9u0v1w2x3y4z',
    originalPlanText: `SQL_ID  t9u0v1w2x3y4z, child number 0
Plan hash value: 3847261590
--------------------------------------------------------------------
| Id  | Operation                     | Name         | Rows  | Cost(%CPU)|
--------------------------------------------------------------------
|   0 | SELECT STATEMENT              |              |       |  7200  (3)|
|   1 |  VIEW                         |              |    50 |  7200  (3)|
|   2 |   WINDOW SORT                 |              | 50000 |  7200  (3)|
|   3 |    SORT GROUP BY              |              | 50000 |  6800  (2)|
|*  4 |     HASH JOIN                 |              |200000 |  5400  (2)|
|   5 |      TABLE ACCESS FULL        | PRODUCTS     |  5000 |   400  (1)|
|   6 |      TABLE ACCESS FULL        | ORDER_ITEMS  |200000 |  3800  (1)|
--------------------------------------------------------------------`,
    tunedPlanText: `SQL_ID  t9u0v1w2x3y4z, child number 1
Plan hash value: 8291034756
------------------------------------------------------------------------
| Id  | Operation                         | Name            | Rows  | Cost(%CPU)|
------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                 |       |  1200  (2)|
|   1 |  VIEW                             |                 |    50 |  1200  (2)|
|   2 |   WINDOW SORT PUSHED RANK         |                 |  5000 |  1200  (2)|
|   3 |    HASH GROUP BY                  |                 |  5000 |  1100  (1)|
|*  4 |     HASH JOIN                     |                 | 50000 |   900  (1)|
|   5 |      TABLE ACCESS FULL            | PRODUCTS        |  5000 |   400  (1)|
|*  6 |      INDEX FAST FULL SCAN         | IDX_OI_PROD_QTY |200000 |   350  (1)|
------------------------------------------------------------------------`,
    originalElapsed: 27800,
    tunedElapsed: 5500,
    originalBuffers: 2900000,
    tunedBuffers: 350000,
    originalRows: 200000,
    tunedRows: 50000,
    originalDiskReads: 175000,
    tunedDiskReads: 22000,
    validatedAt: '2026-04-01T09:30:00Z',
    validatedBy: '정수진',
    result: 'improved',
    recommendationType: 'rewrite',
    changeDescription: 'WINDOW SORT → WINDOW SORT PUSHED RANK 최적화 + ORDER_ITEMS 복합 인덱스 활용 Rewrite',
  },

  'WI-2024-005': {
    id: 'EV-005',
    workItemId: 'WI-2024-005',
    sqlId: 'b5c6d7e8f9g0h',
    originalPlanText: `SQL_ID  b5c6d7e8f9g0h, child number 0
Plan hash value: 1638472950
--------------------------------------------------------------------
| Id  | Operation                     | Name         | Rows  | Cost(%CPU)|
--------------------------------------------------------------------
|   0 | SELECT STATEMENT              |              |       |  6200  (2)|
|   1 |  TABLE ACCESS FULL            | CUSTOMERS    | 10000 |   200  (1)|
|*  2 |   SORT AGGREGATE              |              |     1 |          |
|*  3 |    TABLE ACCESS FULL          | ORDERS       | 50000 |  6000  (2)|
--------------------------------------------------------------------`,
    tunedPlanText: `SQL_ID  b5c6d7e8f9g0h, child number 1
Plan hash value: 7382914650
------------------------------------------------------------------------
| Id  | Operation                         | Name           | Rows  | Cost(%CPU)|
------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                |       |   850  (1)|
|   1 |  NESTED LOOPS                     |                | 10000 |   850  (1)|
|   2 |   TABLE ACCESS FULL               | CUSTOMERS      | 10000 |   200  (1)|
|*  3 |   INDEX RANGE SCAN                | IDX_ORD_CUST_DT|     1 |     1  (0)|
------------------------------------------------------------------------`,
    originalElapsed: 19500,
    tunedElapsed: 2900,
    originalBuffers: 1850000,
    tunedBuffers: 185000,
    originalRows: 10000,
    tunedRows: 10000,
    originalDiskReads: 252000,
    tunedDiskReads: 18000,
    validatedAt: '2026-04-01T15:00:00Z',
    validatedBy: '최동욱',
    result: 'improved',
    recommendationType: 'rewrite',
    changeDescription: 'Scalar Subquery → JOIN 변환 + 복합 인덱스 IDX_ORD_CUST_DT(customer_id, order_date) 생성',
  },

  'WI-2024-006': {
    id: 'EV-006',
    workItemId: 'WI-2024-006',
    sqlId: 'i1j2k3l4m5n6o',
    originalPlanText: `SQL_ID  i1j2k3l4m5n6o, child number 0
Plan hash value: 2957381640
--------------------------------------------------------------------
| Id  | Operation                          | Name  | Rows  | Cost(%CPU)|
--------------------------------------------------------------------
|   0 | SELECT STATEMENT                   |       |       |  4800  (2)|
|   1 |  SORT ORDER BY                     |       |   500 |  4800  (2)|
|*  2 |   CONNECT BY WITH FILTERING        |       |       |          |
|   3 |    TABLE ACCESS FULL               | EMP   | 10000 |  3800  (1)|
|   4 |    NESTED LOOPS                    |       |       |          |
|   5 |     CONNECT BY PUMP                |       |       |          |
|   6 |     TABLE ACCESS FULL              | EMP   | 10000 |  3800  (1)|
--------------------------------------------------------------------`,
    tunedPlanText: `SQL_ID  i1j2k3l4m5n6o, child number 1
Plan hash value: 8847291035
------------------------------------------------------------------------
| Id  | Operation                           | Name          | Rows  | Cost(%CPU)|
------------------------------------------------------------------------
|   0 | SELECT STATEMENT                    |               |       |  1200  (1)|
|   1 |  SORT ORDER BY                      |               |   500 |  1200  (1)|
|*  2 |   CONNECT BY WITH FILTERING         |               |       |          |
|*  3 |    INDEX RANGE SCAN                  | IDX_EMP_MGR   | 10000 |   200  (0)|
|   4 |     TABLE ACCESS BY INDEX ROWID      | EMP           |     1 |     1  (0)|
|   5 |    NESTED LOOPS                     |               |       |          |
|   6 |     CONNECT BY PUMP                 |               |       |          |
|*  7 |     INDEX RANGE SCAN                | IDX_EMP_MGR   |    10 |     1  (0)|
|   8 |      TABLE ACCESS BY INDEX ROWID    | EMP           |    10 |     2  (0)|
------------------------------------------------------------------------`,
    originalElapsed: 15200,
    tunedElapsed: 3800,
    originalBuffers: 1620000,
    tunedBuffers: 405000,
    originalRows: 500,
    tunedRows: 500,
    originalDiskReads: 168000,
    tunedDiskReads: 42000,
    validatedAt: '2026-04-01T17:00:00Z',
    validatedBy: '김민수',
    result: 'improved',
    recommendationType: 'hint',
    changeDescription: '/*+ INDEX(e IDX_EMP_MGR) */ 힌트 추가, CONNECT BY 탐색 시 Full Scan → Index 활용',
  },

  'WI-2024-007': {
    id: 'EV-007',
    workItemId: 'WI-2024-007',
    sqlId: 'p7q8r9s0t1u2v',
    originalPlanText: `SQL_ID  p7q8r9s0t1u2v, child number 0
Plan hash value: 3846192750
--------------------------------------------------------------------
| Id  | Operation                     | Name         | Rows  | Cost(%CPU)|
--------------------------------------------------------------------
|   0 | SELECT STATEMENT              |              |       |  5200  (2)|
|   1 |  SORT GROUP BY                |              |  5000 |  5200  (2)|
|*  2 |   HASH JOIN OUTER             |              | 50000 |  4800  (1)|
|   3 |    TABLE ACCESS FULL          | ACCOUNTS     |  5000 |   800  (1)|
|   4 |    TABLE ACCESS FULL          | TRANSACTIONS |800000 |  3800  (1)|
--------------------------------------------------------------------`,
    tunedPlanText: `SQL_ID  p7q8r9s0t1u2v, child number 1
Plan hash value: 9182734560
------------------------------------------------------------------------
| Id  | Operation                         | Name            | Rows  | Cost(%CPU)|
------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                 |       |   920  (1)|
|   1 |  SORT GROUP BY                    |                 |  5000 |   920  (1)|
|   2 |   NESTED LOOPS OUTER              |                 |  5000 |   850  (1)|
|   3 |    TABLE ACCESS FULL              | ACCOUNTS        |  5000 |   800  (1)|
|*  4 |    INDEX RANGE SCAN               | IDX_TXN_ACCTID  |    10 |     1  (0)|
------------------------------------------------------------------------`,
    originalElapsed: 12800,
    tunedElapsed: 2100,
    originalBuffers: 1340000,
    tunedBuffers: 168000,
    originalRows: 5000,
    tunedRows: 5000,
    originalDiskReads: 144000,
    tunedDiskReads: 15000,
    validatedAt: '2026-04-02T08:00:00Z',
    validatedBy: '이영희',
    result: 'improved',
    recommendationType: 'index',
    changeDescription: 'TRANSACTIONS 테이블에 IDX_TXN_ACCTID(account_id) 인덱스 생성, HASH JOIN → NESTED LOOPS OUTER',
  },

  'WI-2024-008': {
    id: 'EV-008',
    workItemId: 'WI-2024-008',
    sqlId: 'w3x4y5z6a7b8c',
    originalPlanText: `SQL_ID  w3x4y5z6a7b8c, child number 0
Plan hash value: 4738291560
--------------------------------------------------------------------
| Id  | Operation                     | Name         | Rows  | Cost(%CPU)|
--------------------------------------------------------------------
|   0 | UPDATE STATEMENT              |              |       |  4200  (2)|
|   1 |  UPDATE                       | ORDERS       |       |          |
|*  2 |   HASH JOIN SEMI              |              |  2000 |  4200  (2)|
|   3 |    TABLE ACCESS FULL          | ORDERS       | 50000 |  2800  (1)|
|   4 |    VIEW                       | VW_SQ_1      |  1000 |  1200  (1)|
|   5 |     SORT GROUP BY             |              |  1000 |  1200  (1)|
|   6 |      TABLE ACCESS FULL        | ORDER_ITEMS  |200000 |   800  (1)|
--------------------------------------------------------------------`,
    tunedPlanText: `SQL_ID  w3x4y5z6a7b8c, child number 1
Plan hash value: 2918374650
------------------------------------------------------------------------
| Id  | Operation                         | Name           | Rows  | Cost(%CPU)|
------------------------------------------------------------------------
|   0 | UPDATE STATEMENT                  |                |       |   580  (1)|
|   1 |  UPDATE                           | ORDERS         |       |          |
|*  2 |   NESTED LOOPS SEMI               |                |  2000 |   580  (1)|
|*  3 |    INDEX RANGE SCAN               | IDX_ORD_STATUS |  2000 |    15  (0)|
|   4 |     TABLE ACCESS BY INDEX ROWID   | ORDERS         |  2000 |    30  (0)|
|*  5 |    INDEX RANGE SCAN               | IDX_OI_ORDID   |     4 |     1  (0)|
------------------------------------------------------------------------`,
    originalElapsed: 8900,
    tunedElapsed: 1200,
    originalBuffers: 950000,
    tunedBuffers: 95000,
    originalRows: 2000,
    tunedRows: 2000,
    originalDiskReads: 96000,
    tunedDiskReads: 8000,
    validatedAt: '2026-04-02T10:00:00Z',
    validatedBy: '박준호',
    result: 'improved',
    recommendationType: 'plan_restore',
    changeDescription: 'SQL Profile을 통해 기존 최적 플랜(NESTED LOOPS SEMI + INDEX) 복구',
  },

  // ─── Tuned seed items (검증 대기) ───

  'WI-2024-019': {
    id: 'EV-019',
    workItemId: 'WI-2024-019',
    sqlId: 'aa1bb2cc3',
    originalPlanText: `SQL_ID  aa1bb2cc3, child number 0
Plan hash value: 4829103756
--------------------------------------------------------------------
| Id  | Operation                     | Name       | Rows  | Cost(%CPU)|
--------------------------------------------------------------------
|   0 | SELECT STATEMENT              |            |       |  5800  (2)|
|*  1 |  HASH JOIN SEMI               |            |  3000 |  5800  (2)|
|   2 |   TABLE ACCESS FULL           | SHIPMENTS  | 80000 |  3200  (1)|
|   3 |   TABLE ACCESS FULL           | ORDERS     | 50000 |  2800  (1)|
--------------------------------------------------------------------`,
    tunedPlanText: `SQL_ID  aa1bb2cc3, child number 1
Plan hash value: 7291834560
------------------------------------------------------------------------
| Id  | Operation                         | Name            | Rows  | Cost(%CPU)|
------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                 |       |   850  (1)|
|*  1 |  NESTED LOOPS SEMI               |                 |  3000 |   850  (1)|
|*  2 |   INDEX RANGE SCAN               | IDX_ORD_STATUS  |  5000 |    15  (0)|
|   3 |    TABLE ACCESS BY INDEX ROWID   | ORDERS          |  5000 |    30  (0)|
|*  4 |   INDEX RANGE SCAN               | IDX_SHIP_ORDID  |     1 |     1  (0)|
|   5 |    TABLE ACCESS BY INDEX ROWID   | SHIPMENTS       |     1 |     2  (0)|
------------------------------------------------------------------------`,
    originalElapsed: 18200,
    tunedElapsed: 2700,
    originalBuffers: 1920000,
    tunedBuffers: 192000,
    originalRows: 80000,
    tunedRows: 3000,
    originalDiskReads: 210000,
    tunedDiskReads: 21000,
    validatedAt: '2026-04-02T08:00:00Z',
    validatedBy: '김민수',
    result: 'improved',
    recommendationType: 'index',
    changeDescription: 'SHIPMENTS 테이블에 IDX_SHIP_ORDID(order_id) 인덱스 생성, HASH JOIN SEMI → NESTED LOOPS SEMI 전환',
  },

  'WI-2024-020': {
    id: 'EV-020',
    workItemId: 'WI-2024-020',
    sqlId: 'dd4ee5ff6',
    originalPlanText: `SQL_ID  dd4ee5ff6, child number 0
Plan hash value: 3918274650
--------------------------------------------------------------------
| Id  | Operation                     | Name        | Rows  | Cost(%CPU)|
--------------------------------------------------------------------
|   0 | SELECT STATEMENT              |             |       |  4200  (2)|
|   1 |  SORT GROUP BY                |             |   200 |  4200  (2)|
|*  2 |   HASH JOIN OUTER             |             | 80000 |  3800  (1)|
|   3 |    TABLE ACCESS FULL          | WAREHOUSES  |   200 |   100  (1)|
|   4 |    TABLE ACCESS FULL          | INVENTORY   | 80000 |  3400  (1)|
--------------------------------------------------------------------`,
    tunedPlanText: `SQL_ID  dd4ee5ff6, child number 1
Plan hash value: 5847291034
------------------------------------------------------------------------
| Id  | Operation                         | Name            | Rows  | Cost(%CPU)|
------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                 |       |   620  (1)|
|   1 |  TABLE ACCESS FULL               | WAREHOUSES      |   200 |   100  (1)|
|   2 |   SORT AGGREGATE                  |                 |     1 |          |
|*  3 |    INDEX RANGE SCAN               | IDX_INV_WHID    |   400 |     2  (0)|
------------------------------------------------------------------------`,
    originalElapsed: 9400,
    tunedElapsed: 1400,
    originalBuffers: 980000,
    tunedBuffers: 98000,
    originalRows: 200,
    tunedRows: 200,
    originalDiskReads: 105000,
    tunedDiskReads: 10500,
    validatedAt: '2026-04-02T08:15:00Z',
    validatedBy: '이영희',
    result: 'improved',
    recommendationType: 'rewrite',
    changeDescription: 'LEFT JOIN + COUNT → Scalar Subquery 변환으로 INVENTORY Full Scan 제거',
    tunedSqlText: `SELECT w.warehouse_id, w.warehouse_name,
       (SELECT COUNT(i.item_id) FROM INVENTORY i WHERE i.warehouse_id = w.warehouse_id) item_cnt
  FROM WAREHOUSES w`,
  },

  'WI-2024-021': {
    id: 'EV-021',
    workItemId: 'WI-2024-021',
    sqlId: 'gg7hh8ii9',
    originalPlanText: `SQL_ID  gg7hh8ii9, child number 0
Plan hash value: 2847391560
--------------------------------------------------------------------
| Id  | Operation                     | Name         | Rows  | Cost(%CPU)|
--------------------------------------------------------------------
|   0 | SELECT STATEMENT              |              |       |  8400  (2)|
|*  1 |  HASH JOIN                    |              | 15000 |  8400  (2)|
|*  2 |   HASH JOIN                   |              |  5000 |  5600  (2)|
|   3 |    TABLE ACCESS FULL          | RETURNS      |  5000 |   800  (1)|
|   4 |    TABLE ACCESS FULL          | ORDERS       | 50000 |  2800  (1)|
|   5 |   TABLE ACCESS FULL           | ORDER_ITEMS  |200000 |  3800  (1)|
--------------------------------------------------------------------`,
    tunedPlanText: `SQL_ID  gg7hh8ii9, child number 1
Plan hash value: 6291834750
------------------------------------------------------------------------
| Id  | Operation                         | Name            | Rows  | Cost(%CPU)|
------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                 |       |  1680  (1)|
|*  1 |  NESTED LOOPS                     |                 | 15000 |  1680  (1)|
|*  2 |   NESTED LOOPS                    |                 |  5000 |   880  (1)|
|   3 |    TABLE ACCESS FULL              | RETURNS         |  5000 |   800  (1)|
|*  4 |    TABLE ACCESS BY INDEX ROWID    | ORDERS          |     1 |     1  (0)|
|*  5 |     INDEX UNIQUE SCAN             | PK_ORDERS       |     1 |     0  (0)|
|*  6 |   INDEX RANGE SCAN                | IDX_OI_ORDID    |     3 |     1  (0)|
|   7 |    TABLE ACCESS BY INDEX ROWID    | ORDER_ITEMS     |     3 |     2  (0)|
------------------------------------------------------------------------`,
    originalElapsed: 22100,
    tunedElapsed: 4400,
    originalBuffers: 2310000,
    tunedBuffers: 462000,
    originalRows: 15000,
    tunedRows: 15000,
    originalDiskReads: 250000,
    tunedDiskReads: 50000,
    validatedAt: '2026-04-02T08:30:00Z',
    validatedBy: '박준호',
    result: 'improved',
    recommendationType: 'hint',
    changeDescription: '/*+ LEADING(r o) USE_NL(o oi) */ 힌트로 다중 HASH JOIN → NESTED LOOPS 전환',
    tunedSqlText: `SELECT /*+ LEADING(r o) USE_NL(o oi) INDEX(o PK_ORDERS) INDEX(oi IDX_OI_ORDID) */
       r.return_id, r.return_date, o.order_id, oi.product_name
  FROM RETURNS r
  JOIN ORDERS o ON r.order_id = o.order_id
  JOIN ORDER_ITEMS oi ON o.order_id = oi.order_id`,
  },

  'WI-2024-022': {
    id: 'EV-022',
    workItemId: 'WI-2024-022',
    sqlId: 'jj0kk1ll2',
    originalPlanText: `SQL_ID  jj0kk1ll2, child number 0
Plan hash value: 3847261590
--------------------------------------------------------------------
| Id  | Operation                     | Name      | Rows  | Cost(%CPU)|
--------------------------------------------------------------------
|   0 | SELECT STATEMENT              |           |       |  4800  (2)|
|*  1 |  TABLE ACCESS FULL            | PAYMENTS  |300000 |  4800  (2)|
--------------------------------------------------------------------`,
    tunedPlanText: `SQL_ID  jj0kk1ll2, child number 1
Plan hash value: 8291034756
------------------------------------------------------------------------
| Id  | Operation                         | Name              | Rows  | Cost(%CPU)|
------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                   |       |   720  (1)|
|*  1 |  TABLE ACCESS BY INDEX ROWID      | PAYMENTS          |   150 |   720  (1)|
|*  2 |   INDEX RANGE SCAN                | IDX_PAY_CUST_DT   |   150 |     3  (0)|
------------------------------------------------------------------------`,
    originalElapsed: 14300,
    tunedElapsed: 2100,
    originalBuffers: 1490000,
    tunedBuffers: 149000,
    originalRows: 300000,
    tunedRows: 150,
    originalDiskReads: 160000,
    tunedDiskReads: 16000,
    validatedAt: '2026-04-02T08:45:00Z',
    validatedBy: '정수진',
    result: 'improved',
    recommendationType: 'index',
    changeDescription: 'PAYMENTS 테이블에 IDX_PAY_CUST_DT(customer_id, pay_date) 복합 인덱스 생성으로 Full Scan 제거',
  },

  'WI-2024-023': {
    id: 'EV-023',
    workItemId: 'WI-2024-023',
    sqlId: 'mm3nn4oo5',
    originalPlanText: `SQL_ID  mm3nn4oo5, child number 0
Plan hash value: 2957381640
--------------------------------------------------------------------
| Id  | Operation                     | Name  | Rows  | Cost(%CPU)|
--------------------------------------------------------------------
|   0 | SELECT STATEMENT              |       |       |  3800  (2)|
|*  1 |  HASH JOIN OUTER              |       | 10000 |  3800  (2)|
|   2 |   TABLE ACCESS FULL           | EMP   | 10000 |  1800  (1)|
|   3 |   TABLE ACCESS FULL           | EMP   | 10000 |  1800  (1)|
--------------------------------------------------------------------`,
    tunedPlanText: `SQL_ID  mm3nn4oo5, child number 1
Plan hash value: 8847291035
------------------------------------------------------------------------
| Id  | Operation                         | Name     | Rows  | Cost(%CPU)|
------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |          |       |   580  (1)|
|   1 |  NESTED LOOPS OUTER               |          | 10000 |   580  (1)|
|*  2 |   TABLE ACCESS BY INDEX ROWID     | EMP      | 10000 |   500  (1)|
|*  3 |    INDEX RANGE SCAN               | IDX_DEPT |   200 |     2  (0)|
|*  4 |   TABLE ACCESS BY INDEX ROWID     | EMP      |     1 |     1  (0)|
|*  5 |    INDEX UNIQUE SCAN              | PK_EMP   |     1 |     0  (0)|
------------------------------------------------------------------------`,
    originalElapsed: 6700,
    tunedElapsed: 1000,
    originalBuffers: 710000,
    tunedBuffers: 71000,
    originalRows: 10000,
    tunedRows: 10000,
    originalDiskReads: 76000,
    tunedDiskReads: 7600,
    validatedAt: '2026-04-02T09:00:00Z',
    validatedBy: '최동욱',
    result: 'improved',
    recommendationType: 'hint',
    changeDescription: '/*+ USE_NL(m) INDEX(m PK_EMP) */ 힌트로 Self-Join 시 HASH JOIN → NESTED LOOPS 전환',
    tunedSqlText: `SELECT /*+ USE_NL(m) INDEX(m PK_EMP) */
       e.emp_id, e.hire_date, m.last_name mgr_name
  FROM EMP e
  LEFT JOIN EMP m ON e.manager_id = m.employee_id
 WHERE e.department_id = :dept_id`,
  },

  'WI-2024-024': {
    id: 'EV-024',
    workItemId: 'WI-2024-024',
    sqlId: 'pp6qq7rr8',
    originalPlanText: `SQL_ID  pp6qq7rr8, child number 0
Plan hash value: 4738291560
--------------------------------------------------------------------
| Id  | Operation                     | Name      | Rows  | Cost(%CPU)|
--------------------------------------------------------------------
|   0 | SELECT STATEMENT              |           |       |  3800  (2)|
|   1 |  FILTER                       |           |       |          |
|   2 |   SORT GROUP BY               |           |    50 |  3800  (2)|
|   3 |    TABLE ACCESS FULL          | PRODUCTS  | 50000 |  3400  (1)|
--------------------------------------------------------------------`,
    tunedPlanText: `SQL_ID  pp6qq7rr8, child number 1
Plan hash value: 9182734560
------------------------------------------------------------------------
| Id  | Operation                         | Name            | Rows  | Cost(%CPU)|
------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                 |       |   780  (1)|
|   1 |  FILTER                           |                 |       |          |
|   2 |   HASH GROUP BY                   |                 |    50 |   780  (1)|
|   3 |    INDEX FAST FULL SCAN           | IDX_PROD_CAT    | 50000 |   600  (1)|
------------------------------------------------------------------------`,
    originalElapsed: 11800,
    tunedElapsed: 2400,
    originalBuffers: 1230000,
    tunedBuffers: 246000,
    originalRows: 50,
    tunedRows: 50,
    originalDiskReads: 132000,
    tunedDiskReads: 26400,
    validatedAt: '2026-04-02T09:15:00Z',
    validatedBy: '김민수',
    result: 'improved',
    recommendationType: 'index',
    changeDescription: 'IDX_PROD_CAT 커버링 인덱스 생성 + HASH GROUP BY 전환으로 Full Scan 제거',
  },

  'WI-2024-025': {
    id: 'EV-025',
    workItemId: 'WI-2024-025',
    sqlId: 'ss9tt0uu1',
    originalPlanText: `SQL_ID  ss9tt0uu1, child number 0
Plan hash value: 3829104756
--------------------------------------------------------------------
| Id  | Operation                     | Name       | Rows  | Cost(%CPU)|
--------------------------------------------------------------------
|   0 | SELECT STATEMENT              |            |       |  9800  (2)|
|   1 |  SORT GROUP BY                |            | 10000 |  9800  (2)|
|*  2 |   HASH JOIN                   |            | 50000 |  8400  (2)|
|   3 |    TABLE ACCESS FULL          | CUSTOMERS  | 10000 |  1200  (1)|
|   4 |    TABLE ACCESS FULL          | ORDERS     | 50000 |  2800  (1)|
--------------------------------------------------------------------`,
    tunedPlanText: `SQL_ID  ss9tt0uu1, child number 1
Plan hash value: 1927384650
------------------------------------------------------------------------
| Id  | Operation                         | Name           | Rows  | Cost(%CPU)|
------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                |       |  1500  (2)|
|   1 |  HASH GROUP BY                    |                | 10000 |  1500  (2)|
|*  2 |   HASH JOIN                       |                | 12000 |  1350  (1)|
|   3 |    TABLE ACCESS FULL              | CUSTOMERS      | 10000 |  1200  (1)|
|*  4 |    INDEX RANGE SCAN               | IDX_ORD_DATE   | 12000 |    50  (0)|
|   5 |     TABLE ACCESS BY INDEX ROWID   | ORDERS         | 12000 |   100  (0)|
------------------------------------------------------------------------`,
    originalElapsed: 31200,
    tunedElapsed: 4700,
    originalBuffers: 3280000,
    tunedBuffers: 328000,
    originalRows: 50000,
    tunedRows: 12000,
    originalDiskReads: 350000,
    tunedDiskReads: 35000,
    validatedAt: '2026-04-02T09:30:00Z',
    validatedBy: '이영희',
    result: 'improved',
    recommendationType: 'rewrite',
    changeDescription: 'WHERE 조건 추가(연도 필터) + HASH GROUP BY 변환으로 ORDERS Full Scan 범위 축소',
    tunedSqlText: `SELECT c.cust_id, c.cust_name, SUM(o.total_amount) ytd_amount
  FROM CUSTOMERS c
  JOIN ORDERS o ON c.customer_id = o.customer_id
 WHERE o.order_date >= TRUNC(SYSDATE, 'YYYY')
 GROUP BY c.cust_id, c.cust_name`,
  },

  'WI-2024-034': {
    id: 'EV-034',
    workItemId: 'WI-2024-034',
    sqlId: 'mn6op7qr8',
    originalPlanText: `SQL_ID  mn6op7qr8, child number 0
Plan hash value: 5847201934
--------------------------------------------------------------------
| Id  | Operation                     | Name     | Rows  | Cost(%CPU)|
--------------------------------------------------------------------
|   0 | SELECT STATEMENT              |          |       |  3200  (2)|
|*  1 |  HASH JOIN                    |          |  1200 |  3200  (2)|
|*  2 |   TABLE ACCESS FULL           | TICKETS  | 30000 |  2400  (1)|
|   3 |   TABLE ACCESS FULL           | USERS    |  5000 |   600  (1)|
--------------------------------------------------------------------`,
    tunedPlanText: `SQL_ID  mn6op7qr8, child number 1
Plan hash value: 3918274650
------------------------------------------------------------------------
| Id  | Operation                         | Name             | Rows  | Cost(%CPU)|
------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                  |       |   480  (1)|
|   1 |  NESTED LOOPS                     |                  |  1200 |   480  (1)|
|*  2 |   INDEX RANGE SCAN                | IDX_TKT_STATUS   |  1200 |    10  (0)|
|   3 |    TABLE ACCESS BY INDEX ROWID    | TICKETS          |  1200 |    20  (0)|
|*  4 |   TABLE ACCESS BY INDEX ROWID     | USERS            |     1 |     1  (0)|
|*  5 |    INDEX UNIQUE SCAN              | PK_USERS         |     1 |     0  (0)|
------------------------------------------------------------------------`,
    originalElapsed: 8800,
    tunedElapsed: 1300,
    originalBuffers: 920000,
    tunedBuffers: 92000,
    originalRows: 1200,
    tunedRows: 1200,
    originalDiskReads: 98000,
    tunedDiskReads: 9800,
    validatedAt: '2026-04-02T09:45:00Z',
    validatedBy: '정수진',
    result: 'improved',
    recommendationType: 'index',
    changeDescription: 'TICKETS 테이블에 IDX_TKT_STATUS(status, assigned_to) 복합 인덱스 생성으로 Full Scan 제거',
  },

  'WI-2024-035': {
    id: 'EV-035',
    workItemId: 'WI-2024-035',
    sqlId: 'st9uv0wx1',
    originalPlanText: `SQL_ID  st9uv0wx1, child number 0
Plan hash value: 4019283756
--------------------------------------------------------------------
| Id  | Operation                     | Name               | Rows  | Cost(%CPU)|
--------------------------------------------------------------------
|   0 | SELECT STATEMENT              |                    |       |  2200  (2)|
|   1 |  SORT ORDER BY                |                    |   500 |  2200  (2)|
|*  2 |   TABLE ACCESS FULL           | CUSTOMER_FEEDBACK  | 50000 |  1800  (1)|
--------------------------------------------------------------------`,
    tunedPlanText: `SQL_ID  st9uv0wx1, child number 1
Plan hash value: 7382914650
------------------------------------------------------------------------
| Id  | Operation                         | Name               | Rows  | Cost(%CPU)|
------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                    |       |   330  (1)|
|*  1 |  TABLE ACCESS BY INDEX ROWID      | CUSTOMER_FEEDBACK  |   500 |   330  (1)|
|*  2 |   INDEX RANGE SCAN DESCENDING     | IDX_FB_PID_RATING  |   500 |    10  (0)|
------------------------------------------------------------------------`,
    originalElapsed: 5200,
    tunedElapsed: 780,
    originalBuffers: 540000,
    tunedBuffers: 54000,
    originalRows: 500,
    tunedRows: 500,
    originalDiskReads: 58000,
    tunedDiskReads: 5800,
    validatedAt: '2026-04-02T10:00:00Z',
    validatedBy: '최동욱',
    result: 'improved',
    recommendationType: 'index',
    changeDescription: 'IDX_FB_PID_RATING 인덱스 생성 + INDEX_DESC 힌트로 정렬 제거',
  },

  'WI-2024-049': {
    id: 'EV-049',
    workItemId: 'WI-2024-049',
    sqlId: 'yz1ab2cd3',
    originalPlanText: `SQL_ID  yz1ab2cd3, child number 0
Plan hash value: 2748193650
--------------------------------------------------------------------
| Id  | Operation                     | Name       | Rows  | Cost(%CPU)|
--------------------------------------------------------------------
|   0 | SELECT STATEMENT              |            |       |  1200  (2)|
|   1 |  SORT ORDER BY                |            |    50 |  1200  (2)|
|*  2 |   TABLE ACCESS FULL           | TAX_RULES  | 10000 |  1000  (1)|
--------------------------------------------------------------------`,
    tunedPlanText: `SQL_ID  yz1ab2cd3, child number 1
Plan hash value: 5192837460
------------------------------------------------------------------------
| Id  | Operation                         | Name             | Rows  | Cost(%CPU)|
------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                  |       |   180  (1)|
|*  1 |  TABLE ACCESS BY INDEX ROWID      | TAX_RULES        |    50 |   180  (1)|
|*  2 |   INDEX RANGE SCAN DESCENDING     | IDX_TAX_CC_DT    |    50 |     3  (0)|
------------------------------------------------------------------------`,
    originalElapsed: 3200,
    tunedElapsed: 480,
    originalBuffers: 340000,
    tunedBuffers: 34000,
    originalRows: 10000,
    tunedRows: 50,
    originalDiskReads: 36000,
    tunedDiskReads: 3600,
    validatedAt: '2026-04-02T10:15:00Z',
    validatedBy: '박준호',
    result: 'improved',
    recommendationType: 'index',
    changeDescription: 'TAX_RULES 테이블에 IDX_TAX_CC_DT(country_code, effective_date) 인덱스 생성으로 Full Scan 제거',
  },

  // ─── V2-specific tuned items (different sqlIds) ───

  'V2-012': {
    id: 'EV-V2-012',
    workItemId: 'V2-012',
    sqlId: 'aa1bb2cc3',
    originalPlanText: `SQL_ID  aa1bb2cc3dd4, child number 0
Plan hash value: 4829103756
--------------------------------------------------------------------
| Id  | Operation                     | Name       | Rows  | Cost(%CPU)|
--------------------------------------------------------------------
|   0 | SELECT STATEMENT              |            |       |  5800  (2)|
|*  1 |  HASH JOIN SEMI               |            |  3000 |  5800  (2)|
|   2 |   TABLE ACCESS FULL           | SHIPMENTS  | 80000 |  3200  (1)|
|   3 |   TABLE ACCESS FULL           | ORDERS     | 50000 |  2800  (1)|
--------------------------------------------------------------------`,
    tunedPlanText: `SQL_ID  aa1bb2cc3dd4, child number 1
Plan hash value: 7291834560
------------------------------------------------------------------------
| Id  | Operation                         | Name            | Rows  | Cost(%CPU)|
------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                 |       |   850  (1)|
|*  1 |  NESTED LOOPS SEMI               |                 |  3000 |   850  (1)|
|*  2 |   INDEX RANGE SCAN               | IDX_ORD_STATUS  |  5000 |    15  (0)|
|   3 |    TABLE ACCESS BY INDEX ROWID   | ORDERS          |  5000 |    30  (0)|
|*  4 |   INDEX RANGE SCAN               | IDX_SHIP_ORDID  |     1 |     1  (0)|
|   5 |    TABLE ACCESS BY INDEX ROWID   | SHIPMENTS       |     1 |     2  (0)|
------------------------------------------------------------------------`,
    originalElapsed: 18200,
    tunedElapsed: 2700,
    originalBuffers: 1920000,
    tunedBuffers: 192000,
    originalRows: 80000,
    tunedRows: 3000,
    originalDiskReads: 210000,
    tunedDiskReads: 21000,
    validatedAt: '2026-03-25T09:15:00Z',
    validatedBy: '정수진',
    result: 'improved',
    recommendationType: 'index',
    changeDescription: 'SHIPMENTS 테이블에 IDX_SHIP_ORDID(order_id) 인덱스 생성, HASH JOIN SEMI → NESTED LOOPS SEMI 전환',
  },

  'V2-013': {
    id: 'EV-V2-013',
    workItemId: 'V2-013',
    sqlId: 'jj0kk1ll2',
    originalPlanText: `SQL_ID  ee5ff6gg7hh8, child number 0
Plan hash value: 3847261590
--------------------------------------------------------------------
| Id  | Operation                     | Name      | Rows  | Cost(%CPU)|
--------------------------------------------------------------------
|   0 | SELECT STATEMENT              |           |       |  4800  (2)|
|   1 |  SORT ORDER BY                |           |   150 |  4800  (2)|
|*  2 |   TABLE ACCESS FULL           | PAYMENTS  |300000 |  4200  (1)|
--------------------------------------------------------------------`,
    tunedPlanText: `SQL_ID  ee5ff6gg7hh8, child number 1
Plan hash value: 8291034756
------------------------------------------------------------------------
| Id  | Operation                         | Name              | Rows  | Cost(%CPU)|
------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                   |       |   720  (1)|
|*  1 |  TABLE ACCESS BY INDEX ROWID      | PAYMENTS          |   150 |   720  (1)|
|*  2 |   INDEX RANGE SCAN                | IDX_PAY_CUST_DT   |   150 |     3  (0)|
------------------------------------------------------------------------`,
    originalElapsed: 14300,
    tunedElapsed: 2100,
    originalBuffers: 1490000,
    tunedBuffers: 149000,
    originalRows: 300000,
    tunedRows: 150,
    originalDiskReads: 160000,
    tunedDiskReads: 16000,
    validatedAt: '2026-03-25T09:30:00Z',
    validatedBy: '이영희',
    result: 'improved',
    recommendationType: 'index',
    changeDescription: 'PAYMENTS 테이블에 IDX_PAY_CUST_DT(customer_id, pay_date) 복합 인덱스 생성으로 Full Scan 제거',
  },

  'WI-2024-014': {
    id: 'EV-010',
    workItemId: 'WI-2024-014',
    sqlId: 'n9o0p1q2r3s4t',
    originalPlanText: `SQL_ID  n9o0p1q2r3s4t, child number 0
Plan hash value: 8271934650
--------------------------------------------------------------------
| Id  | Operation                     | Name         | Rows  | Cost(%CPU)|
--------------------------------------------------------------------
|   0 | MERGE STATEMENT               |              |       |  2800  (2)|
|   1 |  MERGE                        | INVENTORY    |       |          |
|   2 |   VIEW                        |              |       |          |
|*  3 |    HASH JOIN                  |              |  5000 |  2800  (2)|
|   4 |     TABLE ACCESS FULL         | INVENTORY    |  5000 |  1200  (1)|
|   5 |     VIEW                      |              |  1000 |  1400  (1)|
|   6 |      SORT GROUP BY            |              |  1000 |  1400  (1)|
|   7 |       TABLE ACCESS FULL       | ORDER_ITEMS  |200000 |   800  (1)|
--------------------------------------------------------------------`,
    tunedPlanText: `SQL_ID  n9o0p1q2r3s4t, child number 1
Plan hash value: 6291834750
--------------------------------------------------------------------
| Id  | Operation                     | Name         | Rows  | Cost(%CPU)|
--------------------------------------------------------------------
|   0 | MERGE STATEMENT               |              |       |  2650  (2)|
|   1 |  MERGE                        | INVENTORY    |       |          |
|   2 |   VIEW                        |              |       |          |
|*  3 |    HASH JOIN                  |              |  5000 |  2650  (2)|
|   4 |     TABLE ACCESS FULL         | INVENTORY    |  5000 |  1200  (1)|
|   5 |     VIEW                      |              |  1000 |  1250  (1)|
|   6 |      HASH GROUP BY            |              |  1000 |  1250  (1)|
|   7 |       TABLE ACCESS FULL       | ORDER_ITEMS  |200000 |   800  (1)|
--------------------------------------------------------------------`,
    originalElapsed: 3400,
    tunedElapsed: 3100,
    originalBuffers: 290000,
    tunedBuffers: 275000,
    originalRows: 1000,
    tunedRows: 1000,
    originalDiskReads: 28000,
    tunedDiskReads: 26000,
    validatedAt: '2026-03-27T10:00:00Z',
    validatedBy: '정수진',
    result: 'neutral',
    recommendationType: 'rewrite',
    changeDescription: 'SORT GROUP BY → HASH GROUP BY 변환 시도, 미미한 개선',
  },

  'WI-2024-015': {
    id: 'EV-011',
    workItemId: 'WI-2024-015',
    sqlId: 'u5v6w7x8y9z0a',
    originalPlanText: `SQL_ID  u5v6w7x8y9z0a, child number 0
Plan hash value: 4918273650
--------------------------------------------------------------------
| Id  | Operation                     | Name         | Rows  | Cost(%CPU)|
--------------------------------------------------------------------
|   0 | SELECT STATEMENT              |              |       |  5400  (2)|
|*  1 |  HASH JOIN                    |              |  2400 |  5400  (2)|
|   2 |   TABLE ACCESS FULL           | ORDERS       | 50000 |  2800  (1)|
|   3 |   TABLE ACCESS FULL           | CUSTOMERS    | 10000 |  1200  (1)|
--------------------------------------------------------------------`,
    tunedPlanText: `SQL_ID  u5v6w7x8y9z0a, child number 1
Plan hash value: 7381924650
------------------------------------------------------------------------
| Id  | Operation                         | Name            | Rows  | Cost(%CPU)|
------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                 |       |   420  (1)|
|   1 |  NESTED LOOPS                     |                 |  2400 |   420  (1)|
|*  2 |   INDEX RANGE SCAN                | IDX_ORD_TOTAL   |  2400 |    15  (0)|
|   3 |    TABLE ACCESS BY INDEX ROWID    | ORDERS          |  2400 |    50  (0)|
|   4 |   TABLE ACCESS BY INDEX ROWID     | CUSTOMERS       |     1 |     1  (0)|
|*  5 |    INDEX UNIQUE SCAN              | PK_CUSTOMERS    |     1 |     0  (0)|
------------------------------------------------------------------------`,
    originalElapsed: 11200,
    tunedElapsed: 1800,
    originalBuffers: 1100000,
    tunedBuffers: 132000,
    originalRows: 2400,
    tunedRows: 2400,
    originalDiskReads: 120000,
    tunedDiskReads: 12000,
    validatedAt: '2026-04-01T12:30:00Z',
    validatedBy: '최동욱',
    result: 'improved',
    recommendationType: 'index',
    changeDescription: 'ORDERS 테이블에 IDX_ORD_TOTAL(total_amount) 인덱스 생성, Full Scan 제거',
  },

  'WI-2024-018': {
    id: 'EV-012',
    workItemId: 'WI-2024-018',
    sqlId: 'p3q4r5s6t7u8v',
    originalPlanText: `SQL_ID  p3q4r5s6t7u8v, child number 0
Plan hash value: 6182934750
--------------------------------------------------------------------
| Id  | Operation                     | Name         | Rows  | Cost(%CPU)|
--------------------------------------------------------------------
|   0 | SELECT STATEMENT              |              |       |  8200  (3)|
|   1 |  VIEW                         |              | 10000 |  8200  (3)|
|   2 |   SORT GROUP BY               |              | 10000 |  8200  (3)|
|   3 |    TABLE ACCESS FULL          | ORDERS       | 50000 |  2800  (1)|
|   4 |  HASH JOIN                    |              | 10000 |  5000  (2)|
|   5 |   TABLE ACCESS FULL           | CUSTOMERS    | 10000 |  1200  (1)|
--------------------------------------------------------------------`,
    tunedPlanText: `SQL_ID  p3q4r5s6t7u8v, child number 1
Plan hash value: 2918473650
------------------------------------------------------------------------
| Id  | Operation                         | Name           | Rows  | Cost(%CPU)|
------------------------------------------------------------------------
|   0 | SELECT STATEMENT                  |                |       |  1350  (2)|
|   1 |  HASH JOIN                        |                | 10000 |  1350  (2)|
|   2 |   TABLE ACCESS FULL               | CUSTOMERS      | 10000 |  1200  (1)|
|   3 |   VIEW                            |                | 10000 |   150  (1)|
|   4 |    HASH GROUP BY                  |                | 10000 |   150  (1)|
|*  5 |     INDEX FAST FULL SCAN          | IDX_ORD_MON_CST| 50000 |    80  (1)|
------------------------------------------------------------------------`,
    originalElapsed: 22400,
    tunedElapsed: 3500,
    originalBuffers: 2350000,
    tunedBuffers: 280000,
    originalRows: 10000,
    tunedRows: 10000,
    originalDiskReads: 280000,
    tunedDiskReads: 22000,
    validatedAt: '2026-03-29T09:00:00Z',
    validatedBy: '박준호',
    result: 'improved',
    recommendationType: 'index',
    changeDescription: '복합 인덱스 IDX_ORD_MON_CST(order_date, customer_id, total_amount) 생성으로 CTE Full Scan 제거',
  },
}
