import React, { useState, useRef, useEffect, useCallback } from 'react'
import { format as sqlFormat } from 'sql-formatter'
import { useObjectInfo } from '../object-info/ObjectInfoContext'
import { highlightSQL } from '../../utils/sqlHighlight'
import {
  Play,
  Square,
  RotateCcw,
  Database,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  Ban,
  Copy,
  X,
  Maximize2,
  Check,
  AlignLeft,
  ChevronRight,
  ChevronLeft,
  Plus,
  TrendingDown,
  Layers,
  Download,
} from 'lucide-react'
import { showToast } from './Toast'
import ConfirmDialog from './ConfirmDialog'
import TuningRequestDialog from './TuningRequestDialog'
import CostSweepHero from './CostSweepHero'
import ProgressStepBar, { type ProgressStepNumber, stepToPercent } from './ProgressStepBar'
import { useQueue, fmtElapsed } from '../../contexts/QueueContext'
import { addNewWorkItem } from '../../mocks/newItemsStore'
import { buildDefaultGroupName } from '../../lib/group-name'
import { isSqlTextException } from '../../mocks/sqlExceptions'
import { findActiveWorkItemByText } from '../../mocks/duplicateCheck'
import { getViewport } from '../../utils/viewport'
import type { WorkItem } from '../../mocks/workItems'
import ComparePanel, { type ComparePanelMode, type ComparePanelData } from './ComparePanel'
import { type TuningSessionResult } from './TuningResultView'

// ─── Types ───────────────────────────────────────────────────────────────────
type TuningPhase = 'input' | 'waiting' | 'result'

const TUNING_STEP_DESCS = [
  'SQL 구문 분석 중...',
  '실행계획 수집 중...',
  '힌트 조합 탐색 중...',
  'Cost 비교 분석 중...',
  '최적안 도출 완료',
]

function generateMockTuningResult(workItemId: string, originalSql: string, inst: string, sch: string): TuningSessionResult {
  const hint = '/*+ LEADING(c o) USE_NL(o) INDEX(o IDX_ORDERS_CUST_DATE) */'
  const recommendedSql = originalSql.replace(/(SELECT)/i, `$1 ${hint}`)
  const elapsed1 = (1.2 + Math.random() * 3).toFixed(3)
  const elapsed2 = (0.1 + Math.random() * 0.5).toFixed(3)
  const buf1 = Math.floor(20000 + Math.random() * 30000)
  const buf2 = Math.floor(buf1 * (0.2 + Math.random() * 0.3))
  const rows = Math.floor(100 + Math.random() * 2000)
  const originalPlan = `SQL_ID  g3yc1qns2azyy\nPlan hash value: 3821947056\n\n----------------------------------------------------\n| Id  | Operation              | Name     | Rows | Cost |\n----------------------------------------------------\n|   0 | SELECT STATEMENT       |          | ${rows} | ${Math.floor(buf1/100)} |\n|   1 |  SORT ORDER BY         |          | ${rows} | ${Math.floor(buf1/100)} |\n|*  2 |   HASH JOIN            |          | ${rows} | ${Math.floor(buf1/110)} |\n|   3 |    TABLE ACCESS FULL   | TABLE_A  | ${rows*2} | ${Math.floor(buf1/200)} |\n|   4 |    TABLE ACCESS FULL   | TABLE_B  | ${rows*3} | ${Math.floor(buf1/150)} |\n----------------------------------------------------\n\nStatistics\n  ${buf1} buffer gets\n  ${elapsed1} elapsed time`
  const recommendedPlan = `SQL_ID  g3yc1qns2azyy\nPlan hash value: 1547290182\n\n----------------------------------------------------\n| Id  | Operation                    | Name              | Rows | Cost |\n----------------------------------------------------\n|   0 | SELECT STATEMENT             |                   | ${rows} | ${Math.floor(buf2/100)} |\n|   1 |  SORT ORDER BY               |                   | ${rows} | ${Math.floor(buf2/100)} |\n|   2 |   NESTED LOOPS               |                   | ${rows} | ${Math.floor(buf2/110)} |\n|   3 |    TABLE ACCESS FULL         | TABLE_A           | ${rows*2} | ${Math.floor(buf2/200)} |\n|*  4 |    TABLE ACCESS BY INDEX ROWID| TABLE_B           | ${Math.floor(rows*0.5)} | ${Math.floor(buf2/300)} |\n|*  5 |     INDEX RANGE SCAN         | IDX_ORDERS_CUST_DATE | ${Math.floor(rows*0.5)} | ${Math.floor(buf2/500)} |\n----------------------------------------------------\n\nStatistics\n  ${buf2} buffer gets\n  ${elapsed2} elapsed time`
  return {
    workItemId,
    originalSql,
    recommendedSql,
    originalPlan,
    recommendedPlan,
    improvement: {
      elapsed: -Math.floor(30 + Math.random() * 50),
      buffers: -Math.floor(40 + Math.random() * 40),
      cost: -Math.floor(25 + Math.random() * 45),
    },
    instance: inst,
    schema: sch,
  }
}

interface BindVar {
  name: string
  value: string
  dataType: 'VARCHAR2' | 'NUMBER' | 'DATE' | 'TIMESTAMP' | 'TIMESTAMP_WITH_TZ' | 'CHAR' | 'CLOB' | 'RAW'
}

const BIND_TYPE_OPTIONS: BindVar['dataType'][] = [
  'NUMBER', 'VARCHAR2', 'CHAR', 'DATE', 'TIMESTAMP', 'TIMESTAMP_WITH_TZ', 'CLOB', 'RAW',
]
const BIND_TYPE_LABELS: Record<BindVar['dataType'], string> = {
  NUMBER: 'NUMBER',
  VARCHAR2: 'VARCHAR2',
  CHAR: 'CHAR',
  DATE: 'DATE',
  TIMESTAMP: 'TIMESTAMP',
  TIMESTAMP_WITH_TZ: 'TIMESTAMP W/TZ',
  CLOB: 'CLOB',
  RAW: 'RAW',
}

interface SqlTab {
  id: string
  name: string
  sql: string
  bindVars: BindVar[]
  phase: TuningPhase
  tuningStep: ProgressStepNumber
  tuningStepDesc: string
  tuningElapsed: number
  tuningResult: TuningSessionResult | null
  workItemId?: string
}

const DEFAULT_TAB_SESSION: Pick<SqlTab, 'phase' | 'tuningStep' | 'tuningStepDesc' | 'tuningElapsed' | 'tuningResult'> = {
  phase: 'input',
  tuningStep: 1 as ProgressStepNumber,
  tuningStepDesc: '',
  tuningElapsed: 0,
  tuningResult: null,
}

type ExecStatus = 'idle' | 'running' | 'success' | 'error' | 'cancelled'

interface ExecResultRow { [col: string]: string | number }

interface ExecResult {
  status: 'success' | 'error'
  elapsed: number
  rows: number
  message: string
  plan?: string
  data?: { columns: string[]; rows: ExecResultRow[] }
}

type SqlWorkloadType = 'oltp' | 'batch' | 'adhoc'

const STATUS_LABELS: Record<WorkItem['status'], string> = {
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


function extractBindVars(sql: string): string[] {
  const matches = sql.match(/:[a-zA-Z_][a-zA-Z0-9_]*/g) ?? []
  return [...new Set(matches)]
}

function validateSql(sql: string): { valid: boolean; error?: string } {
  const t = sql.trim()
  if (!t) return { valid: false, error: 'SQL을 입력하세요' }
  const singleQuotes = (t.match(/'/g) || []).length
  if (singleQuotes % 2 !== 0) return { valid: false, error: "따옴표(')가 닫히지 않았습니다" }
  let depth = 0
  for (const ch of t) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (depth < 0) return { valid: false, error: "닫는 괄호 ')'가 여는 괄호보다 많습니다" }
  }
  if (depth > 0) return { valid: false, error: `여는 괄호가 ${depth}개 닫히지 않았습니다` }
  return { valid: true }
}

// WHERE 조건절을 파싱하여 selectivity factor(0~1)를 반환.
// bind 변수 플레이스홀더를 입력값으로 치환한 SQL 반환
// :name, :1, :2, ? 형식 지원
function applyBindVars(sql: string, bindVars: BindVar[]): string {
  let result = sql
  // :name 형식 — 이름 기반 (가장 흔한 Oracle 스타일)
  for (const bv of bindVars) {
    if (!bv.value.trim()) continue
    const escaped = bv.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const isNum = bv.dataType === 'NUMBER' || /^\d+(\.\d+)?$/.test(bv.value.trim())
    const replacement = isNum ? bv.value.trim() : `'${bv.value.trim()}'`
    // :varName (대소문자 무관)
    result = result.replace(new RegExp(':' + bv.name + '\\b', 'gi'), replacement)
  }
  // :1, :2 ... 위치 기반 — 순서대로 치환
  let posIdx = 0
  result = result.replace(/:(\d+)\b/g, () => {
    const bv = bindVars[posIdx++]
    if (!bv || !bv.value.trim()) return `:${posIdx}`
    const isNum = bv.dataType === 'NUMBER' || /^\d+(\.\d+)?$/.test(bv.value.trim())
    return isNum ? bv.value.trim() : `'${bv.value.trim()}'`
  })
  // ? 위치 기반 (JDBC 스타일)
  posIdx = 0
  result = result.replace(/\?/g, () => {
    const bv = bindVars[posIdx++]
    if (!bv || !bv.value.trim()) return '?'
    const isNum = bv.dataType === 'NUMBER' || /^\d+(\.\d+)?$/.test(bv.value.trim())
    return isNum ? bv.value.trim() : `'${bv.value.trim()}'`
  })
  return result
}

// 조건이 많고 구체적일수록 낮은 값(적은 rows)을 반환.
function estimateSelectivity(sql: string): number {
  const upper = sql.toUpperCase()

  // WHERE 절이 없으면 full scan → 1.0
  if (!/\bWHERE\b/.test(upper)) return 1.0

  let factor = 1.0

  // ROWNUM / FETCH FIRST / LIMIT
  const rownumMatch = upper.match(/ROWNUM\s*[<<=]\s*(\d+)/)
  const fetchMatch = upper.match(/FETCH\s+FIRST\s+(\d+)/)
  const limitMatch = upper.match(/LIMIT\s+(\d+)/)
  const rnVal = rownumMatch ? parseInt(rownumMatch[1]) : fetchMatch ? parseInt(fetchMatch[1]) : limitMatch ? parseInt(limitMatch[1]) : null
  if (rnVal !== null) {
    // ROWNUM <= N → rows는 최대 N
    factor = Math.min(factor, rnVal / 5000)
  }

  // = 조건 개수 (each halves result size)
  const eqCount = (upper.match(/\b\w+\s*=\s*(?:'[^']*'|\d+|:\w+)/g) || []).length
  factor *= Math.pow(0.5, Math.min(eqCount, 6))

  // IN (...) 조건: IN 목록 크기에 비례
  const inMatches = upper.match(/\bIN\s*\(([^)]+)\)/g) || []
  for (const m of inMatches) {
    const items = m.split(',').length
    factor *= Math.min(1, items * 0.1)
  }

  // LIKE '%...%' → 광범위 (factor 크게 유지), LIKE 'X%' → 선택적
  const likeMatches = upper.match(/\bLIKE\s*'([^']*)'/g) || []
  for (const m of likeMatches) {
    if (m.startsWith("LIKE '%")) {
      factor *= 0.8 // %로 시작: 광범위
    } else {
      factor *= 0.3 // 접두어 검색: 선택적
    }
  }

  // BETWEEN → 범위 조건
  const betweenCount = (upper.match(/\bBETWEEN\b/g) || []).length
  factor *= Math.pow(0.4, Math.min(betweenCount, 3))

  // AND 조건 추가 개수
  const andCount = (upper.match(/\bAND\b/g) || []).length
  factor *= Math.pow(0.75, Math.min(andCount, 5))

  return Math.max(0.001, Math.min(1.0, factor))
}

// bind 값에서 컬럼 힌트 추출: {colName, value} 배열
function extractBindHints(sql: string, bindVars: BindVar[]): { col: string; value: string }[] {
  const hints: { col: string; value: string }[] = []
  // col = :name 패턴
  const eqRe = /(\w+)\s*=\s*:(\w+)/gi
  let m
  while ((m = eqRe.exec(sql)) !== null) {
    const colName = m[1].toUpperCase()
    const bindName = m[2]
    const bv = bindVars.find(b => b.name.toLowerCase() === bindName.toLowerCase())
    if (bv?.value.trim()) hints.push({ col: colName, value: bv.value.trim() })
  }
  return hints
}

function simulateExecution(sql: string, bindVars: BindVar[] = []): Promise<ExecResult> {
  // bind 변수를 실제 값으로 치환한 SQL로 selectivity 계산
  const resolvedSql = applyBindVars(sql, bindVars)
  const sel = estimateSelectivity(resolvedSql)
  const maxRows = 5000
  const baseRows = Math.max(1, Math.floor(maxRows * sel))
  const rows = Math.max(1, Math.floor(baseRows * (0.7 + Math.random() * 0.6)))
  const baseBuffers = Math.max(500, Math.floor(50000 * sel))
  const buffers = Math.max(100, Math.floor(baseBuffers * (0.8 + Math.random() * 0.4)))
  const elapsed = parseFloat((Math.max(0.05, sel * 4.5) * (0.7 + Math.random() * 0.6)).toFixed(3))
  const reads = Math.floor(buffers * 0.3)

  // mock 결과 row 생성: bind 값이 해당 컬럼에 반영되도록
  const bindHints = extractBindHints(sql, bindVars)
  const fromMatch = sql.toUpperCase().match(/\bFROM\s+(\w+)/)
  const tableName = fromMatch ? fromMatch[1] : 'TABLE'
  const columns = ['#', `${tableName}_ID`, 'NAME', 'STATUS', 'CREATED_AT', 'AMOUNT']
  const statuses = ['ACTIVE', 'INACTIVE', 'PENDING', 'CLOSED']
  const mockData = {
    columns,
    rows: Array.from({ length: Math.min(rows, 100) }, (_, i): ExecResultRow => {
      const base: ExecResultRow = {
        '#': i + 1,
        [`${tableName}_ID`]: 10000 + Math.floor(Math.random() * 90000),
        NAME: `ITEM_${String(i + 1).padStart(4, '0')}`,
        STATUS: statuses[Math.floor(Math.random() * statuses.length)],
        CREATED_AT: `2026-0${1 + (i % 3)}-${String(1 + (i % 28)).padStart(2, '0')}`,
        AMOUNT: Math.floor(Math.random() * 1000000),
      }
      // bind 힌트 컬럼 값 반영
      for (const hint of bindHints) {
        const col = columns.find(c => c.toUpperCase() === hint.col || c.toUpperCase().endsWith('_' + hint.col))
        if (col) base[col] = isNaN(Number(hint.value)) ? hint.value : Number(hint.value)
      }
      return base
    }),
  }
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        status: 'success',
        elapsed: parseFloat(elapsed.toFixed(3)),
        rows,
        message: `${rows}개 행 조회 완료 (${elapsed.toFixed(3)}s)`,
        plan: `-- Session prelude: ALTER SESSION SET statistics_level = ALL
SQL_ID  g3yc1qns2azyy, child number 0
-------------------------------------
Plan hash value: 3821947056

-----------------------------------------------------------------------------------------------------------------------
| Id  | Operation                     | Name              | Starts | E-Rows | A-Rows |   A-Time   | Buffers | Reads  |
-----------------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT              |                   |      1 |        |   ${String(rows).padStart(4)} |00:00:0${elapsed.toFixed(2).padStart(4, '0')} |   ${String(buffers).padStart(5)} |  ${String(reads).padStart(5)} |
|   1 |  SORT ORDER BY                |                   |      1 |   ${String(rows).padStart(4)} |   ${String(rows).padStart(4)} |00:00:0${(elapsed * 0.95).toFixed(2).padStart(4, '0')} |   ${String(buffers).padStart(5)} |  ${String(reads).padStart(5)} |
|   2 |   HASH GROUP BY               |                   |      1 |   ${String(Math.floor(rows * 0.8)).padStart(4)} |   ${String(rows).padStart(4)} |00:00:0${(elapsed * 0.9).toFixed(2).padStart(4, '0')} |   ${String(buffers).padStart(5)} |  ${String(reads).padStart(5)} |
|*  3 |    HASH JOIN                  |                   |      1 |  ${String(Math.floor(rows * 1.5)).padStart(5)} |  ${String(Math.floor(rows * 1.2)).padStart(5)} |00:00:0${(elapsed * 0.8).toFixed(2).padStart(4, '0')} |   ${String(Math.floor(buffers * 0.9)).padStart(5)} |  ${String(Math.floor(reads * 0.9)).padStart(5)} |
|   4 |     TABLE ACCESS FULL         | TABLE_A           |      1 |  ${String(Math.floor(rows * 2)).padStart(5)} |  ${String(Math.floor(rows * 2.1)).padStart(5)} |00:00:0${(elapsed * 0.5).toFixed(2).padStart(4, '0')} |   ${String(Math.floor(buffers * 0.6)).padStart(5)} |  ${String(Math.floor(reads * 0.7)).padStart(5)} |
|*  5 |     INDEX RANGE SCAN          | IDX_TABLE_B_01    |      1 |  ${String(Math.floor(rows * 1.5)).padStart(5)} |  ${String(Math.floor(rows * 1.2)).padStart(5)} |00:00:0${(elapsed * 0.3).toFixed(2).padStart(4, '0')} |   ${String(Math.floor(buffers * 0.3)).padStart(5)} |  ${String(Math.floor(reads * 0.2)).padStart(5)} |
-----------------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

   3 - access("A"."ID"="B"."TABLE_A_ID")
   5 - access("B"."CREATED_AT">=:B1 AND "B"."STATUS"='ACTIVE')`,
        data: mockData,
      })
    }, 1500 + Math.random() * 2000)
  })
}

const MOCK_PLAN_ROWS = [
  { id: 0, indent: 0, operation: 'SELECT STATEMENT', object: '', rows: 1, bytes: 52, cost: 8 },
  { id: 1, indent: 1, operation: 'SORT ORDER BY', object: '', rows: 1, bytes: 52, cost: 8 },
  { id: 2, indent: 2, operation: 'HASH JOIN', object: '', rows: 1, bytes: 52, cost: 7 },
  { id: 3, indent: 3, operation: 'TABLE ACCESS FULL', object: 'ORDERS', rows: 1000, bytes: 26000, cost: 3 },
  { id: 4, indent: 3, operation: 'TABLE ACCESS BY INDEX', object: 'CUSTOMERS', rows: 500, bytes: 13000, cost: 4 },
  { id: 5, indent: 4, operation: 'INDEX RANGE SCAN', object: 'IDX_CUST_ID', rows: 500, bytes: 0, cost: 2 },
]

// ─── SQL syntax highlighting (same as WorkDetailPanel) ───────────────────────
const SQL_KEYWORDS = /\b(SELECT|FROM|WHERE|AND|OR|NOT|IN|EXISTS|BETWEEN|LIKE|IS|NULL|AS|ON|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|FULL|UNION|ALL|INSERT|INTO|UPDATE|SET|DELETE|CREATE|ALTER|DROP|TABLE|INDEX|VIEW|WITH|HAVING|GROUP\s+BY|ORDER\s+BY|PARTITION\s+BY|OVER|CASE|WHEN|THEN|ELSE|END|DISTINCT|TOP|LIMIT|OFFSET|FETCH|FIRST|NEXT|ROWS|ONLY|ASC|DESC|USING|VALUES|COUNT|SUM|AVG|MIN|MAX|ROUND|NVL|NVL2|DECODE|TO_CHAR|TO_DATE|TO_NUMBER|TRUNC|ADD_MONTHS|SYSDATE|ROWNUM|ROWID|SUBSTR|INSTR|LENGTH|REPLACE|TRIM|UPPER|LOWER|COALESCE|NULLIF|CAST|EXTRACT|RANK|DENSE_RANK|ROW_NUMBER|LAG|LEAD|LISTAGG|RATIO_TO_REPORT)\b/gi
const SQL_STRINGS_RE = /('[^']*')/g
const SQL_NUMBERS_RE = /\b(\d+\.?\d*)\b/g
const SQL_COMMENTS_RE = /(--.*$|\/\*[\s\S]*?\*\/)/gm
const SQL_HINTS_RE = /(\/\*\+[\s\S]*?\*\/)/g


// ─── Target DB/Schema 메타 (backend API) ────────────────────────────────────
// DBMS agnostic: instance_id 는 문자열, 실제 db_type 은 백엔드에서 관리.
const TARGET_API_BASE = (import.meta as unknown as { env: { VITE_API_BASE?: string } }).env.VITE_API_BASE || 'http://10.10.45.119:8000'
interface TargetSchemaMeta { id: number; schema_name: string; display_name?: string | null }
interface TargetDatabaseMeta { id: number; instance_id: string; db_name: string; display_name?: string | null; schemas: TargetSchemaMeta[] }
interface TargetInstanceMeta { instance_id: string; databases: TargetDatabaseMeta[] }

// Fallback 상수 — 백엔드 실패 시에만 사용.
const INSTANCES = ['PROD-DB1', 'PROD-DB2', 'DEV-DB1']
const SCHEMAS = ['APP', 'OMS', 'HR', 'FIN', 'CRM', 'AUDIT']
const MODULES = ['ORDER_API', 'ORDER_BATCH', 'BILLING', 'REPORT', 'AUTH', 'CUSTOMER', 'INVENTORY', 'PAYMENT']

/* ─── Searchable single select (combobox) ─── */
function SearchableSelect({
  label, value, options, onChange, required, placeholder, width = 160, allowFree = false,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
  required?: boolean
  placeholder?: string
  width?: number
  allowFree?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        if (allowFree && query.trim()) onChange(query.trim())
        setQuery('')
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open, query, allowFree, onChange])

  const q = query.trim().toLowerCase()
  const filtered = q ? options.filter(o => o.toLowerCase().includes(q)) : options

  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={ref} className="relative" style={{ width }}>
      <label className="block text-[11px] text-text-secondary mb-1">
        {label}{required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {open ? (
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (filtered.length > 0) pick(filtered[0])
              else if (allowFree && query.trim()) pick(query.trim())
            } else if (e.key === 'Escape') { setOpen(false); setQuery('') }
          }}
          placeholder={placeholder || '검색...'}
          className="w-full px-2.5 py-1.5 rounded-md bg-white border border-action text-[12px] text-text-primary focus:outline-none focus:ring-1 focus:ring-action/30"
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md bg-white border border-border text-[12px] text-left text-text-primary hover:border-text-muted transition-colors"
        >
          <span className={value ? '' : 'text-text-muted'}>{value || placeholder || '선택'}</span>
          <ChevronDown size={12} className="ml-2 shrink-0 text-text-muted" />
        </button>
      )}
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-[240px] overflow-auto rounded-md border border-border bg-white py-1 shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-[11px] text-text-muted">
              {allowFree && query.trim() ? `"${query.trim()}" 직접 입력 (Enter)` : '일치 항목 없음'}
            </div>
          ) : (
            filtered.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => pick(o)}
                className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-surface-muted ${value === o ? 'text-text-primary font-medium' : 'text-text-secondary'}`}
              >
                {o}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
const WORKLOAD_OPTIONS: { value: SqlWorkloadType; label: string; desc: string; defaultDaily: string }[] = [
  { value: 'oltp', label: 'OLTP', desc: '실시간 트랜잭션 — 응답시간 최적화', defaultDaily: '1500' },
  { value: 'batch', label: 'BATCH', desc: '대량 처리 — 처리량(throughput) 최적화', defaultDaily: '50' },
  { value: 'adhoc', label: 'AD HOC', desc: '일회성 조회 — 리소스 소모 최소화', defaultDaily: '5' },
]

// ─── Dropdown component ─────────────────────────────────────────────────────
function FieldDropdown({
  label,
  value,
  options,
  onChange,
  required,
}: {
  label: string
  value: string
  options: { value: string; label: string; desc?: string }[]
  onChange: (v: string) => void
  required?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)
  return (
    <div className="relative">
      <label className="block text-[10px] uppercase tracking-[0.06em] text-text-muted font-medium mb-1">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-md bg-white border border-border text-[12px] text-text-primary hover:border-text-muted transition-colors text-left"
      >
        <span>{selected?.label || value || '선택'}</span>
        <ChevronDown size={12} className={`text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-full bg-white border border-border rounded-lg shadow-lg z-50 max-h-[240px] overflow-auto">
            {options.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
                className={`w-full text-left px-3 py-2 text-[12px] transition-colors ${
                  o.value === value ? 'bg-code-bg text-action font-medium' : 'text-text-primary hover:bg-surface-alt'
                }`}
              >
                <div>{o.label}</div>
                {o.desc && <div className="text-[10px] text-text-muted mt-0.5">{o.desc}</div>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Plan Grid Table ─────────────────────────────────────────────────────────
// ─── Plan renderer (same as WorkDetailPanel) ─────────────────────────────────
type PlanRowParsed = { id: string; starred: boolean; cells: string[] }
type PredicateEntry = { id: string; type: 'access' | 'filter'; text: string }

function parsePlanText(text: string) {
  const lines = text.split('\n')
  const preLines: string[] = []
  const headers: string[] = []
  const rows: PlanRowParsed[] = []
  const predicates: PredicateEntry[] = []
  let phase: 'pre' | 'header' | 'data' | 'post' | 'predicate' = 'pre'
  for (const line of lines) {
    if (/^Predicate Information/i.test(line.trim())) { phase = 'predicate'; continue }
    if (phase === 'predicate') {
      if (/^-+$/.test(line.trim())) continue
      const m = line.match(/^\s*(\d+)\s*-\s*(access|filter)\s*\((.+)\)\s*$/)
      if (m) predicates.push({ id: m[1], type: m[2] as 'access' | 'filter', text: m[3] })
      else if (line.trim() && predicates.length > 0 && /^\s{10,}/.test(line)) predicates[predicates.length - 1].text += ' ' + line.trim()
      continue
    }
    if (phase === 'pre') {
      if (/^\|\s*Id\s*\|/.test(line)) {
        headers.push(...line.split('|').filter(p => p.trim() !== '').map(p => p.trim()))
        phase = 'header'
      } else if (!/^-+$/.test(line)) preLines.push(line)
    } else if (phase === 'header') {
      if (/^-+$/.test(line)) phase = 'data'
      else if (/^\|/.test(line)) {
        phase = 'data'
        const parts = line.split('|').filter(p => p !== '')
        rows.push({ id: parts[0]?.replace('*', '').trim() || '', starred: parts[0]?.includes('*') || false, cells: parts.map((p, ci) => ci === 0 ? p.replace(/\*/g, '').trim() : ci === 1 ? p.replace(/\s+$/, '') : p.trim()) })
      }
    } else if (phase === 'data') {
      if (/^-+$/.test(line)) phase = 'post'
      else if (/^\|/.test(line)) {
        const parts = line.split('|').filter(p => p !== '')
        rows.push({ id: parts[0]?.replace('*', '').trim() || '', starred: parts[0]?.includes('*') || false, cells: parts.map((p, ci) => ci === 0 ? p.replace(/\*/g, '').trim() : ci === 1 ? p.replace(/\s+$/, '') : p.trim()) })
      }
    }
  }
  return { preLines, headers, rows, predicates }
}

function PlanTable({ text }: { text: string }) {
  const parsed = React.useMemo(() => parsePlanText(text), [text])
  const getBarColor = (row: PlanRowParsed): string | null => {
    const op = row.cells[1] || ''
    if (op.includes('TABLE ACCESS FULL') || op.includes('INDEX FULL SCAN')) return 'bg-danger'
    if (op.includes('INDEX RANGE SCAN') || op.includes('INDEX UNIQUE SCAN') || op.includes('INDEX FAST FULL SCAN')) return 'bg-info'
    return null
  }
  return (
    <div className="text-xs font-mono px-4 py-3">
      {parsed.preLines.filter(l => l.trim()).length > 0 && (
        <div className="text-text-secondary mb-2 leading-relaxed">
          {parsed.preLines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
      {parsed.headers.length > 0 && (
        <div className="relative">
          <div className="overflow-x-auto [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-400 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-track]:bg-gray-100">
          <table className="border-collapse w-full min-w-max">
            <thead>
              <tr className="border-b border-border bg-bg-alt">
                {parsed.headers.map((h, i) => (
                  <th key={i} className={`px-2 py-1 text-left text-xs font-semibold text-text-secondary whitespace-nowrap ${i > 0 ? 'border-l border-border' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsed.rows.map((row, ri) => {
                const bar = getBarColor(row)
                return (
                  <tr key={ri} className="border-b border-bg-muted hover:bg-bg-alt/50">
                    {parsed.headers.map((_, ci) => (
                      <td key={ci} className={`py-0.5 whitespace-pre px-2 ${ci > 0 ? 'border-l border-bg-muted' : ''} ${
                        ci === 0 ? 'text-right text-warning w-8' :
                        ci === 1 ? 'text-code' :
                        ci === 2 ? 'text-text-secondary' :
                        'text-warning'
                      }`}>
                        {ci === 1 ? (
                          <div className="flex items-center">
                            <div className={`w-[3px] h-4 rounded-full mr-1.5 shrink-0 ${bar || 'bg-transparent'}`} />
                            {row.cells[ci] || ''}
                          </div>
                        ) : (
                          ci === 0 ? (row.starred ? <><span className="text-code">*</span>{row.cells[ci] || ''}</> : row.cells[ci] || '') : (row.cells[ci] || '')
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/80 to-transparent" />
        </div>
      )}
      {parsed.predicates.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">Predicate Information</div>
          {parsed.predicates.map((p, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="text-text-muted w-4 shrink-0 text-right">{p.id}</span>
              <span className={p.type === 'access' ? 'text-code font-medium' : 'text-teal-600 font-medium'}>{p.type}</span>
              <span className="text-text-secondary">({p.text})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PlanGrid({ execType, execResult }: { execType: 'actual' | 'explain' | null; execResult: ExecResult | null }) {
  const [tab, setTab] = React.useState<'data' | 'plan'>('data')
  const planText = execResult?.plan ?? MOCK_PLAN_ROWS.map(r => `${'  '.repeat(r.indent)}${r.operation} ${r.object}`).join('\n')
  const hasData = execType === 'actual' && execResult?.data && execResult.data.rows.length > 0

  return (
    <div>
      <div className="flex items-center gap-2 px-4 pt-2 pb-1">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="text-emerald-500">&#9654;</span>
          session: statistics_level = ALL
        </span>
      </div>
      {hasData && (
        <div className="flex items-center gap-0 border-b border-border px-4 pt-2">
          <button
            onClick={() => setTab('data')}
            className={`px-3 py-1.5 text-[11px] font-medium border-b-2 transition-colors -mb-px ${tab === 'data' ? 'border-action text-action' : 'border-transparent text-text-muted hover:text-text-secondary'}`}
          >
            결과 데이터
          </button>
          <button
            onClick={() => setTab('plan')}
            className={`px-3 py-1.5 text-[11px] font-medium border-b-2 transition-colors -mb-px ${tab === 'plan' ? 'border-action text-action' : 'border-transparent text-text-muted hover:text-text-secondary'}`}
          >
            실행계획
          </button>
        </div>
      )}
      {hasData && tab === 'data' ? (
        <div className="overflow-x-auto max-h-64">
          <table className="w-full text-xs min-w-max">
            <thead>
              <tr className="bg-surface-alt border-b border-border">
                {execResult!.data!.columns.map(col => (
                  <th key={col} className="px-3 py-2 text-left text-text-muted font-medium whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {execResult!.data!.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-border/40 hover:bg-surface-alt/50">
                  {execResult!.data!.columns.map(col => (
                    <td key={col} className="px-3 py-1.5 font-mono text-[11px] text-text-primary whitespace-nowrap">
                      {String(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <PlanTable text={planText} />
      )}
    </div>
  )
}

interface Props {
  onCreated?: (workItemId: string) => void
  onNavigateToExisting?: (workItemId: string) => void
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function DirectInputForm({ onCreated, onNavigateToExisting }: Props) {

  const { colTerm: __ctxColTerm } = useObjectInfo()
  // Metadata
  const [instance, setInstance] = useState(INSTANCES[0])
  const [schema, setSchema] = useState(SCHEMAS[0])
  const [targetTree, setTargetTree] = useState<TargetInstanceMeta[]>([])
  const [databaseId, setDatabaseId] = useState<number | null>(null)
  useEffect(() => {
    let aborted = false
    fetch(`${TARGET_API_BASE}/api/targets/tree`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data: TargetInstanceMeta[]) => {
        if (aborted || !Array.isArray(data) || data.length === 0) return
        setTargetTree(data)
        const first = data[0]
        setInstance(first.instance_id)
        const firstDb = first.databases[0]
        if (firstDb) {
          setDatabaseId(firstDb.id)
          if (firstDb.schemas[0]) setSchema(firstDb.schemas[0].schema_name)
        }
      })
      .catch(() => { /* fetch 실패 시 fallback 상수 유지 */ })
    return () => { aborted = true }
  }, [])
  // 선택된 instance 기반 database 목록, database 기반 schema 목록
  const instanceDatabases = React.useMemo(() => {
    const inst = targetTree.find((t) => t.instance_id === instance)
    return inst?.databases ?? []
  }, [targetTree, instance])
  const selectedDatabase = React.useMemo(() => {
    return instanceDatabases.find((d) => d.id === databaseId) ?? instanceDatabases[0]
  }, [instanceDatabases, databaseId])
  const availableSchemas = selectedDatabase?.schemas.map((s) => s.schema_name) ?? SCHEMAS
  const availableInstances = targetTree.length > 0 ? targetTree.map((t) => t.instance_id) : INSTANCES
  // instance 변경 시 해당 instance 의 첫 database/schema 자동 선택
  useEffect(() => {
    if (instanceDatabases.length === 0) return
    if (!instanceDatabases.find((d) => d.id === databaseId)) {
      const fd = instanceDatabases[0]
      setDatabaseId(fd.id)
      if (fd.schemas[0]) setSchema(fd.schemas[0].schema_name)
    }
  }, [instance, instanceDatabases])
  const [workloadType, setWorkloadType] = useState<SqlWorkloadType>('oltp')

  // Tuning request fields
  const [dialogOpen, setDialogOpen] = useState(false)
  const [sqlAlias, setSqlAlias] = useState('')
  const [moduleName, setModuleName] = useState('')
  const [dailyExecs, setDailyExecs] = useState(WORKLOAD_OPTIONS[0].defaultDaily ?? '1500')
  const [dailyExecTouched, setDailyExecTouched] = useState(false)
  const [remark, setRemark] = useState('')

  // Queue context (used to detect whether 실행큐 is active after submission)
  const { currentRunning, elapsed, openPanel, setActiveTab, addScheduledRequest } = useQueue()

  // Inline "joined queue" state — shown when immediate submission happens while queue is busy
  const [joinedQueue, setJoinedQueue] = useState(false)

  // ─── Tuning state (derived from active tab) ──────────────────────────────
  const tuningTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const [comparePanel, setComparePanel] = useState<{ mode: ComparePanelMode; data: ComparePanelData } | null>(null)

  const clearTuningTimers = useCallback(() => {
    tuningTimersRef.current.forEach(clearTimeout)
    tuningTimersRef.current = []
  }, [])

  const updateTab = useCallback((tabId: string, updates: Partial<SqlTab>) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, ...updates } : t))
  }, [])

  const startTuningSimulation = useCallback((tabId: string, workItemId: string, origSql: string) => {
    clearTuningTimers()
    updateTab(tabId, { phase: 'waiting', tuningStep: 1 as ProgressStepNumber, tuningStepDesc: TUNING_STEP_DESCS[0], tuningElapsed: 0, workItemId })

    let sec = 0
    const tick = () => {
      sec++
      updateTab(tabId, { tuningElapsed: sec })
      tuningTimersRef.current.push(setTimeout(tick, 1000))
    }
    tuningTimersRef.current.push(setTimeout(tick, 1000))

    const delays = [2000, 3000, 4000, 3000, 1500]
    let cumulative = 0
    for (let i = 1; i < 5; i++) {
      cumulative += delays[i - 1]
      const step = (i + 1) as ProgressStepNumber
      const desc = TUNING_STEP_DESCS[i]
      tuningTimersRef.current.push(setTimeout(() => {
        updateTab(tabId, { tuningStep: step, tuningStepDesc: desc })
      }, cumulative))
    }

    cumulative += delays[4]
    tuningTimersRef.current.push(setTimeout(() => {
      clearTuningTimers()
      updateTab(tabId, {
        phase: 'result',
        tuningResult: generateMockTuningResult(workItemId, origSql, instance, schema),
      })
    }, cumulative))
  }, [instance, schema, clearTuningTimers, updateTab])

  useEffect(() => () => clearTuningTimers(), [clearTuningTimers])

  // ─── Tabs ────────────────────────────────────────────────────────────────
  const [tabs, setTabs] = useState<SqlTab[]>([{ id: '1', name: 'SQL 1', sql: '', bindVars: [], ...DEFAULT_TAB_SESSION }])
  const [activeTabId, setActiveTabId] = useState('1')
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingTabName, setEditingTabName] = useState('')
  const tabInputRef = useRef<HTMLInputElement>(null)

  const activeTab = tabs.find(tb => tb.id === activeTabId) ?? tabs[0]
  const tuningPhase = activeTab.phase
  const tuningStep = activeTab.tuningStep
  const tuningStepDesc = activeTab.tuningStepDesc
  const tuningElapsed = activeTab.tuningElapsed
  const tuningResult = activeTab.tuningResult
  const sql = activeTab.sql
  const bindVars = activeTab.bindVars

  const setSql = (val: string, skipHistory = false) => {
    setTabs(prev => prev.map(tb => tb.id === activeTabId ? { ...tb, sql: val } : tb))
    if (!skipHistory) scheduleSnapshot(activeTabId, val)
  }

  const setBindVars = (updater: BindVar[] | ((prev: BindVar[]) => BindVar[])) => {
    setTabs(prev => prev.map(tb => {
      if (tb.id !== activeTabId) return tb
      const next = typeof updater === 'function' ? updater(tb.bindVars) : updater
      return { ...tb, bindVars: next }
    }))
  }

  const addTab = () => {
    const newId = String(Date.now())
    const newName = `SQL ${tabs.length + 1}`
    setTabs(prev => [...prev, { id: newId, name: newName, sql: '', bindVars: [], ...DEFAULT_TAB_SESSION }])
    setActiveTabId(newId)
  }

  const closeTab = (id: string) => {
    if (tabs.length <= 1) return
    const idx = tabs.findIndex(tb => tb.id === id)
    const removed = tabs[idx]
    const nextTabs = tabs.filter(tb => tb.id !== id)
    setTabs(nextTabs)
    if (activeTabId === id) {
      const nextIdx = Math.max(0, idx - 1)
      setActiveTabId(nextTabs[nextIdx].id)
    }
    // 복원 토스트 (5초)
    showToast({
      message: `'${removed.name}' 탭을 닫았습니다`,
      variant: 'info',
      action: {
        label: '복원',
        onClick: () => {
          setTabs(prev => {
            const insertAt = Math.min(idx, prev.length)
            const next = [...prev]
            next.splice(insertAt, 0, removed)
            return next
          })
          setActiveTabId(removed.id)
        },
      },
    })
  }

  const startEditTab = (id: string, name: string) => {
    setEditingTabId(id)
    setEditingTabName(name)
    setTimeout(() => tabInputRef.current?.select(), 0)
  }

  const confirmEditTab = () => {
    if (!editingTabId) return
    const name = editingTabName.trim() || tabs.find(tb => tb.id === editingTabId)?.name || ''
    setTabs(prev => prev.map(tb => tb.id === editingTabId ? { ...tb, name } : tb))
    setEditingTabId(null)
  }

  // ─── Exec type ───────────────────────────────────────────────────────────
  const [execType, setExecType] = useState<'actual' | 'explain' | null>(null)

  // Editor state
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Undo/Redo 히스토리 (탭별 독립) ────────────────────────────────────
  // 구조: { undo: string[], redo: string[] } per tabId
  const historyRef = useRef<Record<string, { undo: string[]; redo: string[] }>>({})
  const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const SNAPSHOT_DELAY = 400 // ms — 입력 멈춘 뒤 스냅샷 저장

  const getHistory = (tabId: string) => {
    if (!historyRef.current[tabId]) historyRef.current[tabId] = { undo: [], redo: [] }
    return historyRef.current[tabId]
  }

  // 명시적 스냅샷 저장 (대규모 변경용: 파일 불러오기, 붙여넣기 등)
  const pushSnapshot = (tabId: string, value: string) => {
    const h = getHistory(tabId)
    if (h.undo[h.undo.length - 1] === value) return
    h.undo.push(value)
    if (h.undo.length > 200) h.undo.shift()
    h.redo = []
  }

  // debounce 기반 자동 스냅샷 (일반 타이핑)
  const scheduleSnapshot = (tabId: string, value: string) => {
    if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current)
    snapshotTimerRef.current = setTimeout(() => {
      pushSnapshot(tabId, value)
    }, SNAPSHOT_DELAY)
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      pushSnapshot(activeTabId, sql)  // 불러오기 전 현재 상태 저장
      setSql(text, true)
      pushSnapshot(activeTabId, text) // 불러온 상태도 즉시 저장
      setExecStatus('idle')
      setExecResult(null)
      showToast(`${file.name} 불러옴 (${text.length.toLocaleString()}자)`, 'success')
    }
    reader.onerror = () => showToast('파일을 읽는 중 오류가 발생했습니다', 'error')
    reader.readAsText(file)
    e.target.value = ''
  }
  const lineCountRef = useRef<HTMLDivElement>(null)

  // Execution state
  const [execStatus, setExecStatus] = useState<ExecStatus>('idle')
  const [execResult, setExecResult] = useState<ExecResult | null>(null)
  const execAbortRef = useRef(false)

  // Block modals
  const [blockedException, setBlockedException] = useState<null | {
    sqlId: string
    reason?: string
    registeredBy: string
    registeredAt: string
  }>(null)
  const [blockedDuplicate, setBlockedDuplicate] = useState<null | {
    id: string
    sqlId: string
    workName: string
    status: WorkItem['status']
    createdAt: string
    assignee: string
  }>(null)

  // ─── Editor expand modal ─────────────────────────────────────────────────
  const [editorExpanded, setEditorExpanded] = useState(false)

  // ─── Result expand modal ─────────────────────────────────────────────────
  const [resultExpanded, setResultExpanded] = useState(false)

  // ─── Rail collapsed ──────────────────────────────────────────────────────
  const [railCollapsed, setRailCollapsed] = useState(true)
  const [bindConfirm, setBindConfirm] = useState<{ type: 'actual' | 'explain' } | null>(null)

  const validation = validateSql(sql)
  const detectedBinds = extractBindVars(sql)
  const lineCount = sql.split('\n').length
  const metaValid = !!workloadType && !!dailyExecs

  // SQL 변경 시 bindVars 자동 초기화 + 레일 자동 펼침
  useEffect(() => {
    if (detectedBinds.length === 0) return
    setTabs(prev => prev.map(tb => {
      if (tb.id !== activeTabId) return tb
      const existingNames = new Set(tb.bindVars.map(b => b.name))
      const needsInit = detectedBinds.some(n => !existingNames.has(n))
      if (!needsInit) return tb
      return {
        ...tb,
        bindVars: detectedBinds.map(name => {
          const existing = tb.bindVars.find(b => b.name === name)
          return existing ?? { name, value: '', dataType: 'VARCHAR2' as const }
        }),
      }
    }))
    setRailCollapsed(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectedBinds.join(','), activeTabId])

  // Resize: editor / result split (px). Default 35% of formH.
  const resultHeightInitRef = useRef(false)
  const [resultHeight, setResultHeight] = useState(220)
  const resizeDragRef = useRef<{ startY: number; startH: number } | null>(null)
  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    resizeDragRef.current = { startY: e.clientY, startH: resultHeight }
    const onMove = (ev: MouseEvent) => {
      if (!resizeDragRef.current) return
      const delta = resizeDragRef.current.startY - ev.clientY
      const maxH = Math.max(200, getViewport().h - 280)
      const next = Math.max(120, Math.min(maxH, resizeDragRef.current.startH + delta))
      setResultHeight(next)
    }
    const onUp = () => {
      resizeDragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // Resize: bind rail width (px). Drag left → rail grows.
  const [railWidth, setRailWidth] = useState(280)
  const railDragRef = useRef<{ startX: number; startW: number } | null>(null)
  const onRailResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    railDragRef.current = { startX: e.clientX, startW: railWidth }
    const onMove = (ev: MouseEvent) => {
      if (!railDragRef.current) return
      const delta = railDragRef.current.startX - ev.clientX
      const next = Math.max(200, Math.min(560, railDragRef.current.startW + delta))
      setRailWidth(next)
    }
    const onUp = () => {
      railDragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const highlightOverlayRef = useRef<HTMLPreElement>(null)
  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineCountRef.current) {
      lineCountRef.current.scrollTop = textareaRef.current.scrollTop
    }
    if (textareaRef.current && highlightOverlayRef.current) {
      highlightOverlayRef.current.scrollTop = textareaRef.current.scrollTop
      highlightOverlayRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ctrl = e.ctrlKey || e.metaKey

    // ── Undo: Ctrl+Z ────────────────────────────────────────────────────────
    if (ctrl && !e.shiftKey && e.key === 'z') {
      e.preventDefault()
      if (snapshotTimerRef.current) {
        clearTimeout(snapshotTimerRef.current)
        snapshotTimerRef.current = null
      }
      const h = getHistory(activeTabId)
      // 현재 값이 아직 스냅샷에 없으면 먼저 push (마지막 미저장 편집 보존)
      if (h.undo[h.undo.length - 1] !== sql) h.undo.push(sql)
      if (h.undo.length <= 1) return
      const current = h.undo.pop()!
      h.redo.push(current)
      const prev = h.undo[h.undo.length - 1]
      setSql(prev, true)
      return
    }

    // ── Redo: Ctrl+Shift+Z 또는 Ctrl+Y ──────────────────────────────────────
    if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'z') || (e.shiftKey && e.key === 'Z'))) {
      e.preventDefault()
      const h = getHistory(activeTabId)
      if (h.redo.length === 0) return
      const next = h.redo.pop()!
      h.undo.push(next)
      setSql(next, true)
      return
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.currentTarget
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const newVal = sql.substring(0, start) + '  ' + sql.substring(end)
      setSql(newVal)
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2
      })
    }
    if (ctrl && e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        handleRun('explain')
      } else {
        handleRun('actual')
      }
    }
  }

  // Escape: 내부 모달 닫기 → 없으면 포커스 해제 (다음 ESC에서 escStack이 패널 닫음)
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (joinedQueue) { setJoinedQueue(false); return }
        if (editorExpanded) { setEditorExpanded(false); return }
        if (resultExpanded) { setResultExpanded(false); return }
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur()
        }
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [editorExpanded, resultExpanded, joinedQueue])

  const initBindVars = (binds: string[]) => {
    const existingNames = new Set(bindVars.map((b) => b.name))
    const needsInit = binds.some((b) => !existingNames.has(b))
    if (needsInit) {
      setBindVars(
        binds.map((name) => {
          const existing = bindVars.find((b) => b.name === name)
          return existing || { name, value: '', dataType: 'VARCHAR2' as const }
        }),
      )
    }
  }

  const handleRun = (type: 'actual' | 'explain') => {
    if (!validation.valid) return
    const binds = extractBindVars(sql)
    if (binds.length > 0) {
      initBindVars(binds)
      const unfilled = binds.filter(name => {
        const bv = bindVars.find(b => b.name === name)
        return !bv || !bv.value.trim()
      })
      if (unfilled.length > 0) {
        setBindConfirm({ type })
        return
      }
    }
    setExecType(type)
    executeQuery()
  }

  const executeQuery = async () => {
    setExecStatus('running')
    setExecResult(null)
    execAbortRef.current = false
    try {
      const result = await simulateExecution(sql, bindVars)
      if (execAbortRef.current) {
        setExecStatus('cancelled')
        setExecResult({ status: 'error', elapsed: 0, rows: 0, message: '실행이 취소되었습니다' })
        return
      }
      setExecStatus('success')
      setExecResult(result)
    } catch {
      setExecStatus('error')
      setExecResult({ status: 'error', elapsed: 0, rows: 0, message: '실행 중 오류가 발생했습니다' })
    }
  }

  const preflightBlockCheck = (): boolean => {
    const duplicate = findActiveWorkItemByText(sql)
    if (duplicate) {
      setBlockedDuplicate({
        id: duplicate.id,
        sqlId: duplicate.sqlId,
        workName: duplicate.workName,
        status: duplicate.status,
        createdAt: duplicate.createdAt,
        assignee: duplicate.assignee,
      })
      return true
    }
    const exception = isSqlTextException(sql)
    if (exception) {
      setBlockedException({
        sqlId: exception.sqlId,
        reason: exception.reason,
        registeredBy: exception.registeredBy,
        registeredAt: exception.registeredAt,
      })
      return true
    }
    return false
  }

  const handleStop = () => {
    execAbortRef.current = true
    setExecStatus('cancelled')
    setExecResult({ status: 'error', elapsed: 0, rows: 0, message: '실행이 취소되었습니다' })
  }

  const resetForm = () => {
    setTabs([{ id: '1', name: 'SQL 1', sql: '', bindVars: [], ...DEFAULT_TAB_SESSION }])
    setActiveTabId('1')
    setExecStatus('idle')
    setExecResult(null)
    setExecType(null)
    setDailyExecs(WORKLOAD_OPTIONS[0].defaultDaily)
    setDailyExecTouched(false)
    setRemark('')
    setModuleName('')
    setSqlAlias('')
  }

  const handleReset = () => {
    resetForm()
    setJoinedQueue(false)
    textareaRef.current?.focus()
  }

  const updateBindVar = (index: number, field: keyof BindVar, value: string) => {
    setBindVars((prev) => prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)))
  }

  const handleOpenDialog = () => {
    if (!sql.trim()) return
    if (preflightBlockCheck()) return
    const binds = extractBindVars(sql)
    if (binds.length > 0) {
      initBindVars(binds)
    }
    setDialogOpen(true)
  }

  const handleDialogSubmit = (opts: { scheduledAt?: string; queryTimeoutSec?: number; groupName: string }) => {
    const instanceType: 'production' | 'dev' = instance.toLowerCase().includes('dev') ? 'dev' : 'production'

    // ── Scheduled path ─────────────────────────────────────────────
    if (opts.scheduledAt) {
      addScheduledRequest({
        label: '(새 SQL) 튜닝 요청',
        instance,
        instanceType,
        sqlCount: 1,
        scheduledAt: opts.scheduledAt,
      })
      setDialogOpen(false)
      showToast({
        message: '예약이 접수되었습니다.',
        variant: 'success',
        action: {
          label: '예약 탭 열기 →',
          onClick: () => {
            setActiveTab('schedule')
            openPanel('slide')
          },
        },
      })
      resetForm()
      return
    }

    // ── Immediate path — inline tuning simulation ──────────────────
    const sqlId = `direct_${Date.now().toString(36)}`
    const executionContext: 'OLTP' | 'Batch' = workloadType === 'batch' ? 'Batch' : 'OLTP'
    const { v1Id } = addNewWorkItem({
      sqlId,
      sqlText: sql.trim(),
      instanceName: instance,
      schemaName: schema,
      source: 'v$sql',
      alias: sqlAlias.trim(),
      executionContext,
      estimatedDailyExec: parseInt(dailyExecs) || 1000,
      selectionSource: 'manual',
      queryTimeoutSec: opts.queryTimeoutSec,
    })

    setDialogOpen(false)
    startTuningSimulation(activeTabId, v1Id, sql.trim())
  }

  const handleNewSql = () => {
    clearTuningTimers()
    addTab()
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const openCompare = () => {
    const r = activeTab.tuningResult
    if (!r) return
    setComparePanel({
      mode: { type: 'compare', scope: 'all' },
      data: { sqlBefore: r.originalSql, sqlAfter: r.recommendedSql, planBefore: r.originalPlan, planAfter: r.recommendedPlan },
    })
  }

  // ── Self-measure: viewport 기반으로 폼 높이를 직접 산출 ──
  const formRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = formRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      const h = Math.max(400, rect.height)
      if (!resultHeightInitRef.current) {
        resultHeightInitRef.current = true
        setResultHeight(Math.round(h * 0.35))
      }
    }
    requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Textarea fills its flex container; no auto-height.

  const statusIcon = {
    idle: null,
    running: <Clock size={14} className="animate-spin text-code" />,
    success: <CheckCircle2 size={14} className="text-success" />,
    error: <XCircle size={14} className="text-danger" />,
    cancelled: <AlertTriangle size={14} className="text-warning" />,
  }

  const aiDisabledReason =
    tuningPhase !== 'input'
      ? 'AI 튜닝 진행 중'
      : !sql.trim() || !validation.valid
      ? 'SQL을 입력하세요'
      : !metaValid
      ? '필수 항목을 입력하세요'
      : execStatus === 'running'
      ? '실행 중입니다'
      : ''
  const aiDisabled = !!aiDisabledReason

  // Plan text for copy
  const planText = execResult?.plan ?? MOCK_PLAN_ROWS.map(r => `${'  '.repeat(r.indent)}${r.operation} ${r.object}`).join('\n')

  return (
    <div ref={formRef} className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
      {/* Joined queue state — full overlay replacing editor area */}
      {joinedQueue && currentRunning && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="w-full max-w-sm mx-6 rounded-lg border border-border bg-white shadow-sm">
            {/* 헤더 + 닫기 */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2.5">
                <CostSweepHero size="sm" />
                <span className="text-[13px] font-semibold text-text-primary">AI 튜닝 진행 중</span>
              </div>
              <button
                onClick={() => setJoinedQueue(false)}
                className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-muted transition-colors"
                title="닫기 (ESC)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 진행 바 */}
            <div className="px-4 pb-3 space-y-2">
              <ProgressStepBar
                currentStep={(Math.min(currentRunning.currentStep + 1, 5)) as ProgressStepNumber}
                className="h-2"
              />
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-text-secondary">
                  {currentRunning.stepDesc || '분석 준비 중'}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-mono tabular-nums font-semibold text-code">
                    {stepToPercent((Math.min(currentRunning.currentStep + 1, 5)) as ProgressStepNumber)}%
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-text-muted">{fmtElapsed(elapsed)}</span>
                </div>
              </div>
            </div>

            {/* 액션 */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
              <button
                onClick={handleReset}
                className="text-[12px] text-text-muted hover:text-text-secondary transition-colors"
              >
                새 SQL 등록
              </button>
              <button
                onClick={() => onCreated?.('')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-action text-white text-[12px] font-medium hover:bg-action-hover transition-colors"
              >
                작업함에서 확인 →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab bar — above header row */}
      <div className="bg-bg-alt border-b border-border flex items-end px-2 gap-1 flex-shrink-0">
        {tabs.map((tb) => {
          const isActive = tb.id === activeTabId
          return (
            <div
              key={tb.id}
              className={`flex items-center px-3 pt-1.5 pb-1 cursor-pointer group ${
                isActive
                  ? 'bg-white border border-border border-b-white -mb-px text-text-primary text-[12px]'
                  : 'text-text-muted text-[12px] hover:text-text-secondary'
              }`}
              onClick={() => {
                // 탭 전환 전 현재 SQL 상태 즉시 저장
                if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current)
                pushSnapshot(activeTabId, sql)
                setActiveTabId(tb.id)
              }}
              onDoubleClick={() => startEditTab(tb.id, tb.name)}
            >
              {editingTabId === tb.id ? (
                <input
                  ref={tabInputRef}
                  autoFocus
                  value={editingTabName}
                  onChange={(e) => setEditingTabName(e.target.value)}
                  onBlur={confirmEditTab}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmEditTab()
                    if (e.key === 'Escape') setEditingTabId(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-16 text-[12px] bg-transparent border-b border-text-primary focus:outline-none"
                />
              ) : (
                <span className="select-none pr-3 flex items-center gap-1.5">
                  {tb.phase === 'waiting' && <Clock size={10} className="animate-spin text-code" />}
                  {tb.phase === 'result' && <CheckCircle2 size={10} className="text-success" />}
                  {tb.name}
                </span>
              )}
              {tabs.length > 1 && isActive && (
                <button
                  onClick={(e) => { e.stopPropagation(); closeTab(tb.id) }}
                  className="p-0.5 rounded hover:bg-bg-muted text-text-muted hover:text-danger transition-colors"
                  title="탭 닫기 (복원 가능)"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          )
        })}
        <button
          onClick={addTab}
          className="flex items-center justify-center w-6 h-6 mb-1 text-text-muted hover:text-text-secondary hover:bg-bg-muted rounded transition-colors"
          title="새 탭 추가"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Header Row: 실행 대상 + 요청 메타 + AI 튜닝 요청 */}
      <div className="bg-white border-b border-border px-5 py-2.5 flex items-end gap-3 flex-shrink-0 flex-wrap">
        <div className="flex flex-col gap-1" style={{ minWidth: 200 }}>
          <label className="block text-[10px] uppercase tracking-[0.06em] text-text-muted font-medium mb-1">
            별칭<span className="text-danger ml-0.5">*</span>
          </label>
          <input
            type="text"
            value={sqlAlias}
            onChange={e => setSqlAlias(e.target.value)}
            placeholder="식별하기 좋은 SQL별칭을 입력해주세요."
            className={"w-full px-2.5 py-1.5 rounded-md bg-white text-[12px] text-text-primary focus:outline-none focus:ring-1 border " + (!sqlAlias.trim() ? "border-warning/60 focus:ring-warning/30" : "border-border focus:ring-action/30")}
          />
        </div>
        <div className="w-[160px]">
          <FieldDropdown
            label="인스턴스"
            value={instance}
            options={availableInstances.map((i) => ({ value: i, label: i }))}
            onChange={setInstance}
            required
          />
        </div>
        {instanceDatabases.length > 0 && (
          <div className="w-[160px]">
            <FieldDropdown
              label="Database"
              value={databaseId != null ? String(databaseId) : (instanceDatabases[0]?.id != null ? String(instanceDatabases[0].id) : "")}
              options={instanceDatabases.map((d) => ({ value: String(d.id), label: d.display_name || d.db_name }))}
              onChange={(v) => {
                const id = Number(v)
                setDatabaseId(id)
                const d = instanceDatabases.find((x) => x.id === id)
                if (d?.schemas[0]) setSchema(d.schemas[0].schema_name)
              }}
              required
            />
          </div>
        )}
        <SearchableSelect
          label="스키마"
          value={schema}
          options={availableSchemas}
          onChange={setSchema}
          required
          width={140}
          placeholder="검색/선택"
        />

        {/* SQL 유형 segmented */}
        <div>
          <label className="block text-[11px] text-text-secondary mb-1">
            SQL 유형<span className="text-danger ml-0.5">*</span>
          </label>
          <div className="inline-flex border border-border rounded-md overflow-hidden">
            {WORKLOAD_OPTIONS.map((o) => {
              const active = workloadType === o.value
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    setWorkloadType(o.value)
                    if (!dailyExecTouched) setDailyExecs(o.defaultDaily)
                  }}
                  title={o.desc}
                  className={`px-3 py-1.5 text-[12px] transition-colors ${
                    active
                      ? 'bg-action text-white'
                      : 'bg-white text-text-secondary hover:bg-surface-muted'
                  }`}
                >
                  {o.value === 'oltp' ? 'OLTP' : o.value === 'batch' ? 'Batch' : 'Adhoc'}
                </button>
              )
            })}
          </div>
        </div>

        {/* 모듈명 — optional, searchable + 직접 입력 */}
        <SearchableSelect
          label="모듈명"
          value={moduleName}
          options={MODULES}
          onChange={setModuleName}
          width={160}
          placeholder="검색/입력"
          allowFree
        />

        {/* 일평균 수행횟수 */}
        <div>
          <label className="block text-[11px] text-text-secondary mb-1">
            일평균<span className="text-danger ml-0.5">*</span>
          </label>
          <div className="relative w-[110px]">
            <input
              type="number"
              min="0"
              value={dailyExecs}
              onChange={(e) => { setDailyExecs(e.target.value); setDailyExecTouched(true) }}
              placeholder="1500"
              className="w-full px-2.5 py-1.5 pr-7 rounded-md bg-white border border-border text-[12px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-action/30 transition-colors"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-text-muted pointer-events-none">
              회
            </span>
          </div>
        </div>

        {/* 비고 — optional, 줄임 */}
        <div className="w-[180px]">
          <label className="block text-[11px] text-text-secondary mb-1">비고</label>
          <input
            type="text"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="참고사항"
            className="w-full px-2.5 py-1.5 rounded-md bg-white border border-border text-[12px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-action/30 transition-colors"
          />
        </div>

        {/* AI 튜닝 요청 — pinned right */}
        <button
          onClick={handleOpenDialog}
          disabled={aiDisabled}
          title={aiDisabled ? aiDisabledReason : undefined}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-action text-white text-[12px] font-medium hover:bg-action-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          AI 튜닝 요청
        </button>
      </div>

      {/* Editor + Rail split */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">

          {/* Toolbar — hidden during tuning */}
          {tuningPhase === 'input' && (
          <div
            className="flex items-center gap-2 px-4 py-2 bg-surface-alt border-b border-border flex-shrink-0"
          >
            {execStatus === 'running' ? (
              <button
                onClick={handleStop}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-danger text-white text-[12px] font-medium hover:bg-danger-dark transition-colors"
              >
                <Square size={12} />
                중지
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleRun('actual')}
                  disabled={!validation.valid || !sql.trim()}
                  title="Ctrl+Enter"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-action text-white text-[12px] font-medium hover:bg-action-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play size={12} />
                  실제 실행계획 조회
                </button>
                <button
                  onClick={() => handleRun('explain')}
                  disabled={!validation.valid || !sql.trim()}
                  title="Ctrl+Shift+Enter"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-text-secondary text-[12px] hover:border-text-primary hover:text-text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  예상 실행계획 조회
                </button>
              </>
            )}

            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] text-text-muted hover:text-text-primary hover:bg-surface-muted transition-colors"
            >
              <RotateCcw size={12} />
              초기화
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              title=".txt / .sql 파일에서 불러오기"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] text-text-muted hover:text-text-primary hover:bg-surface-muted transition-colors"
            >
              <Download size={12} />
              파일 불러오기
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".sql,.txt,text/plain,application/sql"
              onChange={handleImportFile}
              className="hidden"
            />

            <div className="flex-1" />

            {execStatus !== 'idle' && (
              <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                {statusIcon[execStatus]}
                {execStatus === 'running' && '실행 중...'}
                {execStatus === 'success' && `${execResult?.elapsed}s · ${execResult?.rows}행`}
                {execStatus === 'error' && '오류'}
                {execStatus === 'cancelled' && '취소됨'}
              </div>
            )}

          </div>
          )}

          {/* Editor body — collapses during tuning phases */}
          <div className={`flex flex-col overflow-hidden ${tuningPhase === 'input' ? 'flex-1 min-h-0' : 'flex-shrink-0'}`}
            style={tuningPhase !== 'input' ? { maxHeight: '120px' } : undefined}
          >
            <div className="flex-1 flex bg-white min-h-0 overflow-hidden relative">
              <div
                ref={lineCountRef}
                className="flex-shrink-0 select-none overflow-hidden bg-surface-alt border-r border-border pt-3 pr-1"
                style={{ width: '48px' }}
              >
                {Array.from({ length: Math.max(lineCount, 15) }, (_, i) => (
                  <div
                    key={i}
                    className="text-right pr-2 text-[12px] font-mono leading-[20px] text-text-muted"
                  >
                    {i + 1}
                  </div>
                ))}
              </div>

              <div className="flex-1 relative min-w-0">
                {/* Syntax highlight overlay — behind transparent textarea */}
                <pre
                  ref={highlightOverlayRef}
                  aria-hidden="true"
                  className="absolute inset-0 font-mono text-[13px] leading-[20px] p-3 m-0 whitespace-pre overflow-hidden pointer-events-none select-none text-text-primary"
                  style={{ tabSize: 2 }}
                >
                  {sql ? highlightSQL(sql, __ctxColTerm) : null}
                </pre>
                <textarea
                  ref={textareaRef}
                  value={sql}
                  onChange={(e) => {
                    setSql(e.target.value)
                    setExecStatus('idle')
                    setExecResult(null)
                  }}
                  onPaste={() => {
                    // 붙여넣기 직전 현재 상태를 즉시 스냅샷으로 저장
                    if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current)
                    pushSnapshot(activeTabId, sql)
                  }}
                  onScroll={handleScroll}
                  onKeyDown={handleKeyDown}
                  readOnly={tuningPhase !== 'input'}
                  spellCheck={false}
                  placeholder={`-- SQL을 입력하세요 (Ctrl+Enter로 실행)
-- 예시:
SELECT c.customer_id, c.name, SUM(o.amount) total_amount
FROM customers c
JOIN orders o ON c.id = o.customer_id
WHERE o.created_at >= :start_date
  AND c.company_name LIKE :company || '%'
GROUP BY c.customer_id, c.name
ORDER BY total_amount DESC`}
                  className="relative w-full h-full bg-transparent font-mono text-[13px] leading-[20px] p-3 resize-none focus:outline-none placeholder:text-text-muted"
                  style={{ tabSize: 2, caretColor: '#202124', color: 'transparent' }}
                />
                {/* Editor action buttons — top right, always visible */}
                <div className="absolute top-2 right-2 flex items-center gap-0.5">
                  <FormatButton sql={sql} onChange={setSql} disabled={tuningPhase !== 'input'} />
                  <CopyButton text={sql} />
                  <button
                    onClick={() => setEditorExpanded(true)}
                    className="p-1 rounded text-text-muted hover:text-text-secondary hover:bg-surface-muted transition-colors"
                    title="편집기 확대"
                  >
                    <Maximize2 size={12} />
                  </button>
                </div>
              </div>
            </div>

            {sql.trim() && !validation.valid && (
              <div
                className="flex items-center gap-2 px-4 py-1.5 bg-danger-bg border-t border-danger-light text-[12px] text-danger"
              >
                <XCircle size={13} />
                {validation.error}
              </div>
            )}
          </div>

          {/* Resize handle between editor and result — hidden during tuning */}
            {tuningPhase === 'input' && (
              <div
                onMouseDown={onResizeStart}
                className="relative h-px cursor-row-resize bg-border hover:bg-action/10 transition-colors flex-shrink-0 z-10"
                title="드래그하여 크기 조절"
              >
                <div className="absolute inset-x-0 -top-2 -bottom-2" />
              </div>
            )}

            {/* Result panel — phase-conditional */}
            <div
              className={`border-t border-border bg-white overflow-auto flex flex-col ${
                tuningPhase !== 'input' ? 'flex-1' : 'flex-shrink-0'
              }`}
              style={tuningPhase === 'input' ? { height: `${resultHeight}px` } : undefined}
            >
              {tuningPhase === 'result' && tuningResult ? (
                <>
                  {/* Compact result header */}
                  <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-white">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={15} className="text-success" />
                      <span className="text-[13px] font-semibold text-text-primary">AI 튜닝 완료</span>
                      <span className="text-[11px] text-text-muted">{tuningResult.instance} · {tuningResult.schema}</span>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        onClick={openCompare}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-[12px] text-text-secondary hover:bg-surface-muted hover:text-text-primary transition-colors"
                      >
                        <Layers size={12} />
                        전체 비교
                      </button>
                      <button
                        onClick={handleNewSql}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] text-action bg-code-bg hover:bg-[#D2E3FC] transition-colors"
                      >
                        새 SQL 입력
                      </button>
                    </div>
                  </div>

                  {/* Metrics row */}
                  <div className="px-5 py-4 flex items-center gap-6 border-b border-border bg-white">
                    <div className="flex items-center gap-1.5">
                      <TrendingDown size={13} className="text-success" />
                      <span className="text-[11px] text-text-muted">개선 지표</span>
                    </div>
                    {[
                      { label: 'Elapsed', value: tuningResult.improvement.elapsed },
                      { label: 'Buffer Gets', value: tuningResult.improvement.buffers },
                      { label: 'Cost', value: tuningResult.improvement.cost },
                    ].map(m => {
                      const improved = m.value < 0
                      return (
                        <div key={m.label} className="flex items-center gap-2">
                          <span className="text-[11px] text-text-muted">{m.label}</span>
                          <span className={`text-[13px] font-bold tabular-nums ${improved ? 'text-success' : 'text-danger'}`}>
                            {improved ? '' : '+'}{m.value}%
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Recommended SQL preview */}
                  <div className="overflow-auto bg-code-bg/30" style={{ maxHeight: "200px" }}>
                    <div className="px-5 py-2 flex items-center gap-2 border-b border-border">
                      <span className="text-[11px] font-medium text-text-secondary">추천 SQL</span>
                    </div>
                    <pre className="px-5 py-3 text-[12px] font-mono leading-[20px] text-text-primary whitespace-pre-wrap break-all">
                      {tuningResult.recommendedSql}
                    </pre>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-white">
                    <button
                      onClick={() => { showToast({ message: '반려 처리되었습니다', variant: 'info' }); updateTab(activeTabId, { phase: 'input', tuningResult: null }) }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-[12px] text-text-secondary hover:bg-surface-muted transition-colors"
                    >
                      <XCircle size={13} />
                      반려
                    </button>
                    <button
                      onClick={() => { showToast({ message: '확인 처리되었습니다', variant: 'success' }) }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-action text-white text-[12px] font-medium hover:bg-action-hover transition-colors"
                    >
                      <CheckCircle2 size={13} />
                      확인
                    </button>
                  </div>
                </>
              ) : tuningPhase === 'waiting' ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                  <CostSweepHero size="lg" />
                  <div className="text-[13px] font-medium text-text-primary">AI 튜닝 진행 중</div>
                  <div className="w-72 space-y-2">
                    <ProgressStepBar currentStep={tuningStep} className="h-2.5" />
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-text-secondary">{tuningStepDesc}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-mono tabular-nums font-bold text-code">{stepToPercent(tuningStep)}%</span>
                        <span className="text-[11px] font-mono tabular-nums text-text-muted">{tuningElapsed}s</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 px-5 py-2 border-b border-border bg-bg-alt">
                    <span className="text-[11px] uppercase tracking-wider text-text-muted">실행 결과</span>
                    {execStatus === 'idle' && null}
                    {execStatus === 'running' && (
                      <span className="text-[11px] text-text-secondary flex items-center gap-1.5">
                        <Clock size={11} className="animate-spin" />
                        실행 중...
                      </span>
                    )}
                    {execStatus === 'success' && execResult?.status === 'success' && (
                      <>
                        <span className="flex items-center gap-1.5 text-[12px] text-success">
                          <CheckCircle2 size={13} />
                        </span>
                        {execType === 'actual' && (
                          <div className="flex items-center gap-4 font-mono text-[12px] text-text-primary">
                            <span>
                              <span className="text-[10px] uppercase text-text-muted mr-1">Elapsed</span>
                              {execResult.elapsed}s
                            </span>
                            <span className="text-text-muted">·</span>
                            <span>
                              <span className="text-[10px] uppercase text-text-muted mr-1">Rows</span>
                              {execResult.rows.toLocaleString()}
                            </span>
                            <span className="text-text-muted">·</span>
                            <span>
                              {instance} / {schema}
                            </span>
                            {bindVars.length > 0 && (
                              <>
                                <span className="text-text-muted">·</span>
                                <span>{bindVars.length} binds</span>
                              </>
                            )}
                          </div>
                        )}
                        {execType === 'explain' && (
                          <span className="text-[11px] text-text-secondary">예상 실행계획</span>
                        )}
                      </>
                    )}
                    {execStatus === 'error' && (
                      <span className="flex items-center gap-1.5 text-[12px] text-danger">
                        <XCircle size={13} />
                        {execResult?.message || '오류'}
                      </span>
                    )}
                    {execStatus === 'cancelled' && (
                      <span className="flex items-center gap-1.5 text-[12px] text-warning">
                        <AlertTriangle size={13} />
                        취소됨
                      </span>
                    )}
                    {/* Result panel action buttons */}
                    <div className="ml-auto flex items-center gap-0.5">
                      {execStatus === 'success' && <CopyButton text={planText} />}
                      <button
                        onClick={() => setResultExpanded(true)}
                        className="p-1 rounded text-text-muted hover:text-text-secondary hover:bg-surface-muted transition-colors"
                        title="결과 확대"
                      >
                        <Maximize2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Body */}
                  {execStatus === 'idle' && (
                    <div className="py-8 text-center text-[12px] text-text-muted flex flex-col items-center gap-2">
                      <Play size={16} />
                      <div>실행계획 조회 버튼을 눌러 결과집합과 실행계획을 확인하세요</div>
                    </div>
                  )}
                  {execStatus === 'running' && (
                    <div className="px-5 py-4 flex flex-col gap-2">
                      <div className="animate-pulse bg-bg-muted h-3 rounded" />
                      <div className="animate-pulse bg-bg-muted h-3 rounded w-[85%]" />
                      <div className="animate-pulse bg-bg-muted h-3 rounded w-[70%]" />
                    </div>
                  )}
                  {execStatus === 'success' && execResult && (
                    <PlanGrid execType={execType} execResult={execResult} />
                  )}
                  {execStatus === 'error' && (
                    <div className="border-l-2 border-danger mx-5 my-3 px-5 py-3 text-[12px] text-danger">
                      {execResult?.message || '실행 중 오류가 발생했습니다'}
                    </div>
                  )}
                </>
              )}
            </div>

        </div>

        {/* Rail resize handle — only when not collapsed */}
        {tuningPhase === 'input' && !railCollapsed && (
          <div
            onMouseDown={onRailResizeStart}
            className="relative w-px cursor-col-resize bg-border hover:bg-action/10 transition-colors flex-shrink-0 z-10"
            title="드래그하여 크기 조절"
          >
            <div className="absolute inset-y-0 -left-2 -right-2" />
          </div>
        )}

        {/* Bind variables rail — collapsible */}
        {tuningPhase !== 'input' ? null : railCollapsed ? (
          (() => {
            const unfilledCount = detectedBinds.filter(name => {
              const bv = bindVars.find(b => b.name === name)
              return !bv || !bv.value.trim()
            }).length
            const hasUnfilled = detectedBinds.length > 0 && unfilledCount > 0
            return (
              <div
                className="bg-white border-l border-border flex flex-col items-center flex-shrink-0 cursor-pointer hover:bg-bg-alt transition-colors"
                style={{ width: 28 }}
                onClick={() => setRailCollapsed(false)}
                title={hasUnfilled ? `바인드 변수 ${unfilledCount}개 미입력 — 클릭하여 펼치기` : '바인드 변수 펼치기'}
              >
                {/* 아이콘 위치를 헤더 높이에 맞춰 고정 */}
                <div className="flex flex-col items-center justify-center gap-1" style={{ height: 37 }}>
                  <ChevronRight size={12} className={hasUnfilled ? 'text-warning' : 'text-text-muted'} />
                  {detectedBinds.length > 0 && (
                    <span className={`text-[9px] font-medium leading-none ${hasUnfilled ? 'text-warning' : 'text-text-muted'}`}>
                      {detectedBinds.length}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] select-none mt-1 ${hasUnfilled ? 'text-warning' : 'text-text-muted'}`}
                  style={{ writingMode: 'vertical-rl' }}
                >
                  바인드 변수
                </span>
              </div>
            )
          })()
        ) : (
          <div
            className="border-l border-border bg-white flex flex-col flex-shrink-0"
            style={{ width: `${railWidth}px` }}
          >
            <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
              {(() => {
                const uf = detectedBinds.filter(n => { const bv = bindVars.find(b => b.name === n); return !bv || !bv.value.trim() }).length
                return (
                  <>
                    <Database size={13} className={uf > 0 ? 'text-warning' : 'text-text-secondary'} />
                    <span className="text-[11px] text-text-primary">
                      바인드 변수 {detectedBinds.length}개
                      {uf > 0 && (
                        <span className="ml-1.5 text-[10px] text-warning font-medium">미입력 {uf}개</span>
                      )}
                    </span>
                  </>
                )
              })()}
              <button
                onClick={() => setRailCollapsed(true)}
                className="ml-auto p-1 rounded text-text-muted hover:text-text-secondary hover:bg-surface-muted transition-colors"
                title="바인드 변수 접기"
              >
                <ChevronLeft size={12} />
              </button>
            </div>
            {detectedBinds.length === 0 ? (
              <div className="flex-1 flex items-center justify-center px-4 py-6 text-center">
                <p className="text-[11px] text-text-muted leading-relaxed">
                  SQL에 <code className="font-mono text-code">:변수명</code> 형식을<br />
                  입력하면 자동으로 감지됩니다
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-auto divide-y divide-border">
                {bindVars.map((b, i) => (
                  <div key={b.name} className="px-3 py-2 flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-[11px] text-code shrink-0 truncate" title={b.name}>{b.name}</span>
                      <select
                        value={b.dataType}
                        onChange={(e) => updateBindVar(i, 'dataType', e.target.value as BindVar['dataType'])}
                        className="ml-auto text-[10px] border border-border bg-white text-text-secondary px-1 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-action/30 cursor-pointer"
                        style={{ maxWidth: 114 }}
                      >
                        {BIND_TYPE_OPTIONS.map(t => (
                          <option key={t} value={t}>{BIND_TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="text"
                      value={b.value}
                      onChange={(e) => updateBindVar(i, 'value', e.target.value)}
                      placeholder="값 입력"
                      className={`w-full font-mono text-[12px] px-2 py-1 rounded-md border bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 transition-colors ${
                        b.value.trim() ? 'border-border focus:ring-action/30' : 'border-warning bg-warning-bg focus:ring-warning/30'
                      }`}
                    />
                  </div>
                ))}
              </div>
            )}
            {detectedBinds.length > 0 && (
              <div className="border-t border-border">
                <BindHistPanel bindVars={bindVars} setBindVars={setBindVars} />
                <div className="px-4 py-2 border-t border-border">
                  <BulkPasteSection bindVars={bindVars} setBindVars={setBindVars} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ComparePanel floating */}
      {comparePanel && (
        <ComparePanel
          mode={comparePanel.mode}
          data={comparePanel.data}
          onClose={() => setComparePanel(null)}
        />
      )}

      {/* Bind confirm dialog */}
      <ConfirmDialog
        open={!!bindConfirm}
        variant="warning"
        title="바인드 변수 미입력"
        message={`일부 바인드 변수 값이 입력되지 않았습니다. 값 없이 계속 실행하시겠습니까?`}
        confirmLabel="계속 실행"
        cancelLabel="취소"
        onConfirm={() => {
          if (!bindConfirm) return
          setExecType(bindConfirm.type)
          setBindConfirm(null)
          executeQuery()
        }}
        onCancel={() => setBindConfirm(null)}
      />

      {/* Tuning Request Dialog — immediate primary */}
      <TuningRequestDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleDialogSubmit}
        primaryAction="immediate"
        mode="single"
        target={{
          sqlId: '(새 SQL)',
          instanceName: instance,
          schemaName: schema,
          sqlText: sql,
        }}
        defaultGroupName={buildDefaultGroupName('USER_INPUT', 'admin', 1)}
      />

      {/* Blocked duplicate modal */}
      {blockedDuplicate && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setBlockedDuplicate(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-light">
                  <Copy className="h-5 w-5 text-warning" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-text-primary">이미 작업이 존재합니다</h3>
                  <p className="mt-1 text-sm text-text-secondary">
                    이 SQL은 이미 작업함에 등록되어 진행 중입니다. 기존 작업을 먼저 확인해 주세요.
                  </p>
                  <div className="mt-3 rounded-md border border-border bg-surface-alt px-3 py-2.5 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-text-muted w-14 shrink-0">작업 ID</span>
                      <span className="font-mono text-[12px] font-semibold text-text-primary">
                        {blockedDuplicate.id}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-text-muted w-14 shrink-0">SQL ID</span>
                      <span className="font-mono text-[12px] text-text-secondary">
                        {blockedDuplicate.sqlId}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-text-muted w-14 shrink-0">작업명</span>
                      <span className="text-[12px] text-text-secondary truncate">
                        {blockedDuplicate.workName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-text-muted w-14 shrink-0">상태</span>
                      <span className="text-[12px] text-text-secondary">
                        {STATUS_LABELS[blockedDuplicate.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-text-muted w-14 shrink-0">담당자</span>
                      <span className="text-[12px] text-text-secondary">{blockedDuplicate.assignee}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-text-muted w-14 shrink-0">생성일</span>
                      <span className="text-[12px] text-text-secondary">
                        {new Date(blockedDuplicate.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] text-text-muted">
                    중복 생성 방지를 위해 튜닝 요청을 생성할 수 없습니다.
                  </p>
                </div>
                <button
                  onClick={() => setBlockedDuplicate(null)}
                  className="rounded p-1 text-text-muted hover:bg-surface-muted hover:text-text-primary transition-colors"
                  aria-label="닫기"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setBlockedDuplicate(null)}
                  className="rounded-md border border-border bg-white px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-muted transition-colors"
                >
                  닫기
                </button>
                <button
                  onClick={() => {
                    const target = blockedDuplicate.id
                    setBlockedDuplicate(null)
                    onNavigateToExisting?.(target)
                  }}
                  className="rounded-md bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover transition-colors"
                >
                  기존 작업 보기 →
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Blocked exception modal */}
      {blockedException && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setBlockedException(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-light">
                  <Ban className="h-5 w-5 text-warning" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-text-primary">예외 등록된 SQL</h3>
                  <p className="mt-1 text-sm text-text-secondary">
                    이 SQL은 예외 목록에 등록되어 있어 튜닝 요청을 생성할 수 없습니다.
                  </p>
                  <div className="mt-3 rounded-md border border-border bg-surface-alt px-3 py-2.5 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-text-muted w-14 shrink-0">SQL ID</span>
                      <span className="font-mono text-[12px] font-semibold text-text-primary">
                        {blockedException.sqlId}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-text-muted w-14 shrink-0">등록자</span>
                      <span className="text-[12px] text-text-secondary">
                        {blockedException.registeredBy}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-text-muted w-14 shrink-0">등록일</span>
                      <span className="text-[12px] text-text-secondary">
                        {new Date(blockedException.registeredAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    {blockedException.reason && (
                      <div className="flex items-start gap-2 pt-0.5 border-t border-border">
                        <span className="text-[11px] text-text-muted w-14 shrink-0 pt-0.5">사유</span>
                        <span className="text-[12px] text-text-secondary leading-relaxed">
                          {blockedException.reason}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-[11px] text-text-muted">
                    해제가 필요하면 <span className="font-medium text-text-secondary">설정 &gt; 예외 SQL 목록</span>에서 관리자가 해제해야 합니다.
                  </p>
                </div>
                <button
                  onClick={() => setBlockedException(null)}
                  className="rounded p-1 text-text-muted hover:bg-surface-muted hover:text-text-primary transition-colors"
                  aria-label="닫기"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setBlockedException(null)}
                  className="rounded-md bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover transition-colors"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Editor Expand Modal */}
      {editorExpanded && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setEditorExpanded(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-8">
            <div className="w-full max-w-5xl bg-white flex flex-col rounded shadow-xl" style={{ height: 'calc(90vh / 1.1)' }}>
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-bg-alt flex-shrink-0">
                <span className="text-[13px] font-medium text-text-primary">SQL 편집</span>
                <div className="flex items-center gap-1">
                  <FormatButton sql={sql} onChange={setSql} />
                  <CopyButton text={sql} />
                  <button
                    onClick={() => setEditorExpanded(false)}
                    className="p-1 rounded text-text-muted hover:text-text-secondary hover:bg-surface-muted transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              <textarea
                autoFocus
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                spellCheck={false}
                className="flex-1 w-full font-mono text-[13px] leading-[20px] p-4 resize-none focus:outline-none text-text-primary"
                style={{ height: 'calc(80vh / 1.1)' }}
              />
            </div>
          </div>
        </>
      )}

      {/* Result Expand Modal */}
      {resultExpanded && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setResultExpanded(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-8">
            <div className="w-full max-w-5xl bg-white flex flex-col rounded shadow-xl" style={{ height: 'calc(90vh / 1.1)' }}>
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-bg-alt flex-shrink-0">
                <span className="text-[13px] font-medium text-text-primary">실행 결과</span>
                <div className="flex items-center gap-1">
                  {execStatus === 'success' && <CopyButton text={planText} />}
                  <button
                    onClick={() => setResultExpanded(false)}
                    className="p-1 rounded text-text-muted hover:text-text-secondary hover:bg-surface-muted transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                {execStatus === 'idle' && (
                  <div className="py-8 text-center text-[12px] text-text-muted flex flex-col items-center gap-2">
                    <Play size={16} />
                    <div>실행계획 조회 버튼을 눌러 결과집합과 실행계획을 확인하세요</div>
                  </div>
                )}
                {execStatus === 'success' && execResult && (
                  <PlanGrid execType={execType} execResult={execResult} />
                )}
                {execStatus === 'error' && (
                  <div className="border-l-2 border-danger mx-5 my-3 px-5 py-3 text-[12px] text-danger">
                    {execResult?.message || '실행 중 오류가 발생했습니다'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── CopyButton helper ───────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    })
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      className="p-1 rounded text-text-muted hover:text-text-secondary hover:bg-surface-muted transition-colors"
      title="복사"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  )
}

// ─── FormatButton helper ─────────────────────────────────────────────────────
function FormatButton({ sql, onChange, disabled }: { sql: string; onChange: (s: string) => void; disabled?: boolean }) {
  const [flash, setFlash] = useState(false)
  const run = () => {
    if (!sql || !sql.trim() || disabled) return
    try {
      const out = sqlFormat(sql, { language: 'plsql', keywordCase: 'upper', indentStyle: 'standard', linesBetweenQueries: 1 })
      onChange(out)
      setFlash(true)
      setTimeout(() => setFlash(false), 800)
    } catch {
      // sql-formatter 실패 시 무시
    }
  }
  return (
    <button
      type="button"
      onClick={run}
      disabled={disabled || !sql?.trim()}
      className="p-1 rounded text-text-muted hover:text-text-secondary hover:bg-surface-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      title="포맷"
      aria-label="SQL 포맷"
    >
      {flash ? <Check size={12} /> : <AlignLeft size={12} />}
    </button>
  )
}

// ─── Bind history panel ──────────────────────────────────────────────────────
interface BindHistRow { name: string; type: string; value: string; capturedAt: string }

function BindHistPanel({
  bindVars,
  setBindVars,
}: {
  bindVars: BindVar[]
  setBindVars: React.Dispatch<React.SetStateAction<BindVar[]>>
}) {
  const [expanded, setExpanded] = useState(false)
  const [sqlId, setSqlId] = useState('')
  const [source, setSource] = useState<'v$sql' | 'awr'>('v$sql')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<BindHistRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const BASE = (import.meta as unknown as { env: { VITE_API_BASE?: string } }).env.VITE_API_BASE || 'http://10.10.45.119:8000'

  const handleFetch = async () => {
    if (!sqlId.trim()) return
    setLoading(true)
    setError(null)
    setRows([])
    try {
      const res = await fetch(`${BASE}/api/sql-binds?sql_id=${encodeURIComponent(sqlId.trim())}&source=${source}`)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const data: { name: string; type: string; value: string; capturedAt: string }[] = await res.json()
      const normalized = data.map(r => ({
        name: r.name.startsWith(':') ? r.name : `:${r.name}`,
        type: r.type || '—',
        value: r.value === null || r.value === '' ? 'NULL' : r.value,
        capturedAt: r.capturedAt || '—',
      }))
      setRows(normalized)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'fetch 실패')
    } finally {
      setLoading(false)
    }
  }

  const applyRow = (row: BindHistRow) => {
    setBindVars(prev => prev.map(b =>
      b.name === row.name ? { ...b, value: row.value === 'NULL' ? '' : row.value } : b
    ))
  }

  const applyAll = () => {
    if (!rows.length) return
    setBindVars(prev => prev.map(b => {
      const match = rows.find(r => r.name === b.name)
      if (!match) return b
      return { ...b, value: match.value === 'NULL' ? '' : match.value }
    }))
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-[11px] text-text-muted hover:text-text-secondary transition-colors"
      >
        <span>과거 Bind 이력 조회</span>
        <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={sqlId}
              onChange={e => setSqlId(e.target.value)}
              placeholder="SQL_ID 입력"
              className="flex-1 font-mono text-[11px] px-2 py-1 border border-border bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-action/30 rounded"
            />
            <select
              value={source}
              onChange={e => setSource(e.target.value as 'v$sql' | 'awr')}
              className="text-[10px] border border-border bg-white text-text-secondary px-1 py-1 rounded focus:outline-none"
            >
              <option value="v$sql">V$SQL</option>
              <option value="awr">AWR</option>
            </select>
            <button
              onClick={handleFetch}
              disabled={!sqlId.trim() || loading}
              className="px-2 py-1 text-[11px] border border-border text-text-secondary hover:bg-surface-muted disabled:opacity-40 rounded transition-colors whitespace-nowrap"
            >
              {loading ? '조회중…' : '조회'}
            </button>
          </div>
          {error && <p className="text-[10px] text-danger">{error}</p>}
          {rows.length > 0 && (
            <div className="space-y-1">
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-[10px] font-mono min-w-max">
                  <thead>
                    <tr className="bg-surface-alt border-b border-border">
                      <th className="px-2 py-1 text-left text-text-muted font-medium whitespace-nowrap">Name</th>
                      <th className="px-2 py-1 text-left text-text-muted font-medium whitespace-nowrap">Type</th>
                      <th className="px-2 py-1 text-left text-text-muted font-medium whitespace-nowrap">Value</th>
                      <th className="px-2 py-1 text-left text-text-muted font-medium whitespace-nowrap">Captured</th>
                      <th className="px-2 py-1 text-left text-text-muted font-medium whitespace-nowrap"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-b border-border/40 hover:bg-surface-alt/50">
                        <td className="px-2 py-1 text-code whitespace-nowrap">{r.name}</td>
                        <td className="px-2 py-1 text-text-secondary whitespace-nowrap">{r.type}</td>
                        <td className="px-2 py-1 text-text-primary whitespace-nowrap max-w-[120px] truncate" title={r.value}>
                          {r.value === 'NULL' ? <span className="text-text-muted italic">NULL</span> : r.value}
                        </td>
                        <td className="px-2 py-1 text-text-muted whitespace-nowrap">{r.capturedAt}</td>
                        <td className="px-2 py-1">
                          <button
                            onClick={() => applyRow(r)}
                            className="text-[10px] text-action hover:underline whitespace-nowrap"
                          >
                            적용
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={applyAll}
                className="text-[11px] px-3 py-1 border border-action text-action hover:bg-action/5 rounded transition-colors"
              >
                전체 적용
              </button>
            </div>
          )}
          {!loading && !error && rows.length === 0 && sqlId.trim() && (
            <div>
              <p className="text-[10px] text-text-muted">조회 결과 없음</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {source === 'v$sql'
                  ? 'AWR로 소스를 전환하거나 SQL_ID가 메모리에 있는지 확인하세요'
                  : 'AWR 보존 기간 내 수집 이력이 없습니다'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Bulk paste sub-component ───────────────────────────────────────────────
function BulkPasteSection({
  bindVars,
  setBindVars,
}: {
  bindVars: BindVar[]
  setBindVars: React.Dispatch<React.SetStateAction<BindVar[]>>
}) {
  const [expanded, setExpanded] = useState(false)
  const [text, setText] = useState('')
  const [result, setResult] = useState<string | null>(null)
  void bindVars

  const handleApply = () => {
    const t = text.trim()
    if (!t) return
    try {
      const obj = JSON.parse(t)
      if (typeof obj === 'object' && obj !== null) {
        setBindVars((prev) =>
          prev.map((b) => {
            const val = obj[b.name]
            return val !== undefined ? { ...b, value: String(val) } : b
          }),
        )
        setResult(`${Object.keys(obj).length}개 변수 적용 완료`)
        return
      }
    } catch {}
    const lines = t.split(/\n|,/)
    let count = 0
    const map: Record<string, string> = {}
    for (const line of lines) {
      const eq = line.indexOf('=')
      if (eq > 0) {
        map[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
        count++
      }
    }
    if (count > 0) {
      setBindVars((prev) =>
        prev.map((b) => {
          const val = map[b.name]
          return val !== undefined ? { ...b, value: val } : b
        }),
      )
      setResult(`${count}개 변수 적용 완료`)
    } else {
      setResult('형식을 인식할 수 없습니다')
    }
  }

  return (
    <div className="border border-border bg-surface-alt">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-[11px] text-text-muted hover:text-text-secondary transition-colors"
      >
        <span>JSON / CSV 일괄 붙여넣기</span>
        <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setResult(null)
            }}
            placeholder={`{":b1": "2026-01-01", ":b2": "SAMSUNG"}\n또는\n:b1=2026-01-01\n:b2=SAMSUNG`}
            rows={4}
            className="w-full font-mono text-[12px] px-3 py-2 border border-border bg-white text-text-primary focus:outline-none focus:border-text-primary transition-colors resize-none placeholder:text-text-muted"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={handleApply}
              disabled={!text.trim()}
              className={`px-3 py-1.5 text-[12px] border transition-colors ${
                text.trim()
                  ? 'border-text-primary text-text-primary hover:bg-surface-muted'
                  : 'border-border text-text-muted cursor-not-allowed'
              }`}
            >
              적용
            </button>
            {result && <span className="text-[11px] text-success">{result}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
