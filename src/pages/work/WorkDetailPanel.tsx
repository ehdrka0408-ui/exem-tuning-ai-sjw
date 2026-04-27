import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useObjectInfo } from '../../components/object-info/ObjectInfoContext'
import { highlightSQL } from '../../utils/sqlHighlight'
import { createPortal } from 'react-dom'
import {
  CheckCircle2, XCircle, Undo2, Clock, FileText, Maximize2, Minimize2,
  ChevronDown, ChevronUp, X, Copy, Check, Ban,
  TrendingUp, AlertCircle,
} from 'lucide-react'
import { BarChart, Bar, XAxis, Cell, LabelList } from 'recharts'

import { type WorkItem } from '../../mocks/workItems'
import { workRecommendations, type TuningType } from '../../mocks/recommendations'
import { fetchTuningRequestDetail, type TuningRequestDetail } from '../../lib/api'
import { workBindSets, type BindSet, type BindSetVariable } from '../../mocks/executionValidation'
import { workHistory } from '../../mocks/workHistory'
import { useNotifications } from '../../contexts/NotificationContext'
import {
  type DiffLine, DIFF_STYLES, DIFF_TEXT,
  computeLineDiff, computePlanDiff, formatSQLText,
} from '../../utils/sqlDiff'
import ComparePanel, { type ComparePanelMode } from '../../components/common/ComparePanel'
import FloatingPopup from '../../components/common/FloatingPopup'
// Badge removed — status shown in SlidePanel header
import Button from '../../components/common/Button'
import SourceBadge from '../../components/common/SourceBadge'
import MaxGaugeNotConnected from '../../components/common/MaxGaugeNotConnected'
import { useMaxGaugeStatus } from '../../hooks/useMaxGaugeStatus'
import TuningInProgressCard from '../../components/common/TuningInProgressCard'
import { type ProgressStepNumber } from '../../components/common/ProgressStepBar'

// AnalysisStep(4) → ProgressStep(5) 매핑
function analysisStepToProgress(key?: string): ProgressStepNumber {
  switch (key) {
    case 'sql_analysis':
    case 'plan_collection':
      return 1
    case 'plan_generation':
      return 2
    case 'verification':
      return 3
    default:
      return 1
  }
}

// 단계별 한 줄 설명 — ProgressStepBar의 stepDescription slot 용
const ANALYSIS_STEP_DESC: Record<string, string> = {
  sql_analysis:    'SQL 구조와 파싱 정보를 분석하고 있습니다',
  plan_collection: '기존 실행계획을 수집하고 있습니다',
  plan_generation: 'AI가 대안 SQL을 생성하고 있습니다',
  verification:    '검증 환경에서 실행해 성능을 측정하고 있습니다',
}

import { showToast } from '../../components/common/Toast'
import { useEscStack } from '../../utils/escStack'
import { getViewport } from '../../utils/viewport'
// ImprovementBadge, SourceBadge removed — inlined as text

// ─── 상수 ─────────────────────────────────────────
// STATUS_LABELS / STATUS_BADGE_VARIANT removed — status shown in SlidePanel header

const TYPE_COLORS: Record<TuningType, { bg: string; text: string; label: string }> = {
  index: { bg: 'bg-surface-alt', text: 'text-text-secondary', label: '인덱스' },
  hint: { bg: 'bg-surface-alt', text: 'text-text-secondary', label: '힌트' },
  rewrite: { bg: 'bg-surface-alt', text: 'text-text-secondary', label: '리라이트' },
}

// ─── 헬퍼 ─────────────────────────────────────────
function formatNumber(n: number | null | undefined): string { if (n == null) return '—'; return n.toLocaleString() }
function formatMs(ms: number | null | undefined): string { if (ms == null) return '—'; return `${(ms / 1000).toFixed(2)}s` }
function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function calcChangeRate(original: number, tuned: number | undefined) {
  if (tuned == null) return { rate: null, improved: false }
  if (original === 0) return { rate: null, improved: false }
  const rate = Math.round(((original - tuned) / original) * 100)
  return { rate, improved: rate > 0 }
}

// ─── SQL 구문 하이라이팅 ──────────────────────────
const SQL_KEYWORDS = /\b(SELECT|FROM|WHERE|AND|OR|NOT|IN|EXISTS|BETWEEN|LIKE|IS|NULL|AS|ON|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|FULL|UNION|ALL|INSERT|INTO|UPDATE|SET|DELETE|CREATE|ALTER|DROP|TABLE|INDEX|VIEW|WITH|HAVING|GROUP\s+BY|ORDER\s+BY|PARTITION\s+BY|OVER|CASE|WHEN|THEN|ELSE|END|DISTINCT|TOP|LIMIT|OFFSET|FETCH|FIRST|NEXT|ROWS|ONLY|ASC|DESC|USING|VALUES|COUNT|SUM|AVG|MIN|MAX|ROUND|NVL|NVL2|DECODE|TO_CHAR|TO_DATE|TO_NUMBER|TRUNC|ADD_MONTHS|SYSDATE|ROWNUM|ROWID|SUBSTR|INSTR|LENGTH|REPLACE|TRIM|UPPER|LOWER|COALESCE|NULLIF|CAST|EXTRACT|RANK|DENSE_RANK|ROW_NUMBER|LAG|LEAD|LISTAGG|RATIO_TO_REPORT)\b/gi
const SQL_STRINGS = /('[^']*')/g
const SQL_NUMBERS = /\b(\d+\.?\d*)\b/g
const SQL_COMMENTS = /(--.*$|\/\*[\s\S]*?\*\/)/gm
const SQL_HINTS = /(\/\*\+[\s\S]*?\*\/)/g


// ─── 실행계획 테이블 파싱 & 렌더링 ──────────────
type PlanRow = { id: string; starred: boolean; cells: string[] }
type PredicateEntry = { id: string; type: 'access' | 'filter'; text: string }

function parsePlanText(text: string) {
  const lines = text.split('\n')
  const preLines: string[] = []
  const headers: string[] = []
  const rows: PlanRow[] = []
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
  const parsed = useMemo(() => parsePlanText(text), [text])
  const getBarColor = (row: PlanRow): string | null => {
    const op = row.cells[1] || ''
    if (op.includes('TABLE ACCESS FULL') || op.includes('INDEX FULL SCAN')) return 'bg-danger'
    if (op.includes('INDEX RANGE SCAN') || op.includes('INDEX UNIQUE SCAN') || op.includes('INDEX FAST FULL SCAN')) return 'bg-info'
    return null
  }

  return (
    <div className="text-xs font-mono">
      {parsed.preLines.filter(l => l.trim()).length > 0 && (
        <div className="text-text-secondary mb-2 leading-relaxed">
          {parsed.preLines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
      {parsed.headers.length > 0 && (
        <div className="overflow-x-auto">
          <table className="border-collapse w-full min-w-max">
            <thead>
              <tr className="border-b border-border bg-surface">
                {parsed.headers.map((h, i) => (
                  <th key={i} className={`px-2 py-1 text-left text-xs font-semibold text-text-secondary whitespace-nowrap ${i > 0 ? 'border-l border-border' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsed.rows.map((row, ri) => {
                const bar = getBarColor(row)
                return (
                  <tr key={ri} className="border-b border-surface-muted hover:bg-surface/50">
                    {parsed.headers.map((_, ci) => (
                      <td key={ci} className={`py-0.5 whitespace-pre px-2 ${ci > 0 ? 'border-l border-surface-muted' : ''} ${
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
      )}
      {parsed.predicates.length > 0 && (
        <div className="mt-3 pt-2 border-t border-border">
          <div className="text-[10px] font-semibold text-text-secondary mb-1.5">Predicate Information:</div>
          <div className="space-y-0.5">
            {parsed.predicates.map((p, i) => (
              <div key={i} className="flex gap-1.5 text-[11px] leading-relaxed">
                <span className="shrink-0 text-warning font-medium w-6 text-right">{p.id}</span>
                <span className="shrink-0 text-text-muted">-</span>
                <span className={`shrink-0 font-medium ${p.type === 'access' ? 'text-code' : 'text-warning'}`}>{p.type}</span>
                <span className="text-text-secondary break-all">({p.text})</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="pb-4" />
    </div>
  )
}

// ─── 리사이즈 패널 ──────────────────────────────
function ResizablePanel({ children, defaultHeight = 160, minHeight = 80, maxHeight = 600 }: {
  children: React.ReactNode; defaultHeight?: number; minHeight?: number; maxHeight?: number
}) {
  const [height, setHeight] = useState(defaultHeight)
  const dragging = useRef(false)
  const startY = useRef(0)
  const startH = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startY.current = e.clientY
    startH.current = height
    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      setHeight(Math.max(minHeight, Math.min(maxHeight, startH.current + (ev.clientY - startY.current))))
    }
    const onMouseUp = () => {
      dragging.current = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [height, minHeight, maxHeight])

  return (
    <div>
      <div style={{ height }} className="overflow-auto">{children}</div>
      <div onMouseDown={onMouseDown} className="h-3 flex items-center justify-center cursor-row-resize hover:bg-surface-muted transition-colors group border-t border-dashed border-border" title="드래그하여 높이 조절">
        <div className="w-6 h-[2px] rounded-full bg-border group-hover:bg-text-secondary transition-colors" />
      </div>
    </div>
  )
}



// ─── diff (shared from utils/sqlDiff) ──────────────

// computePlanDiff, computeLineDiff, formatSQLText → imported from utils/sqlDiff

// ─── PlanDiffTable (실행계획 diff 테이블) ────────────
function PlanDiffTable({ lines }: { lines: DiffLine[] }) {
  const parsed = useMemo(() => {
    const preLines: (DiffLine & { isTable: false })[] = []
    const headerCols: string[] = []
    const tableLines: (DiffLine & { isTable: true; cells: string[] })[] = []
    const predicateLines: DiffLine[] = []
    let foundHeader = false
    let inTable = false
    let inPredicate = false
    for (const line of lines) {
      if (line.type === 'spacer') {
        if (inTable || foundHeader) {
          tableLines.push({ ...line, isTable: true, cells: [] })
        }
        continue
      }
      if (/^Predicate Information/i.test(line.text.trim())) { inPredicate = true; inTable = false; continue }
      if (inPredicate) { if (/^-+$/.test(line.text.trim())) continue; if (line.text.trim()) predicateLines.push(line); continue }
      if (!foundHeader && /^\|\s*Id\s*\|/.test(line.text)) {
        const parts = line.text.split('|').filter(p => p.trim() !== '')
        headerCols.push(...parts.map(p => p.trim()))
        foundHeader = true; inTable = true; continue
      }
      if (inTable && /^-+$/.test(line.text)) continue
      if (inTable && /^\|/.test(line.text)) {
        const parts = line.text.split('|').filter(p => p !== '')
        tableLines.push({ ...line, isTable: true, cells: parts.map((p, ci) => ci === 1 ? p.replace(/\s+$/, '') : p.trim()) })
      } else if (!foundHeader) { preLines.push({ ...line, isTable: false }) }
    }
    return { preLines, headerCols, tableLines, predicateLines }
  }, [lines])

  const diffColor: Record<DiffLine['type'], string> = { equal: '', added: 'bg-emerald-50', removed: 'bg-red-50', modified: 'bg-amber-50', spacer: '' }
  const diffTextColor: Record<DiffLine['type'], string> = { equal: '', added: 'text-emerald-700', removed: 'text-red-700', modified: 'text-amber-800', spacer: '' }

  return (
    <div className="text-xs font-mono">
      {parsed.preLines.map((line, i) => (
        <div key={i} className={`px-1 ${diffColor[line.type]} ${diffTextColor[line.type]} rounded-sm`}>{line.text}</div>
      ))}
      {parsed.headerCols.length > 0 && (
        <div className="overflow-x-auto mt-1">
          <table className="border-collapse w-full min-w-max">
            <thead>
              <tr className="border-b border-border bg-surface-muted">
                {parsed.headerCols.map((h, i) => (
                  <th key={i} className="px-2 py-0.5 text-left text-[10px] font-semibold text-text-secondary whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsed.tableLines.map((row, ri) => (
                <tr key={ri} className={`border-b border-surface-muted ${diffColor[row.type]}`}>
                  {row.type === 'spacer' ? (
                    <td colSpan={parsed.headerCols.length} className="px-2 py-0.5">&nbsp;</td>
                  ) : parsed.headerCols.map((_, ci) => (
                    <td key={ci} className={`px-2 py-0.5 whitespace-pre ${ci === 0 ? 'text-right w-8' : ''} ${
                      row.type !== 'equal' && ci === 1 ? `font-semibold ${diffTextColor[row.type]}` :
                      row.type !== 'equal' ? diffTextColor[row.type] : ''
                    }`}>
                      {ci === 1 && row.type !== 'equal' ? (
                        <div className="flex items-center">
                          <div className={`w-[3px] h-4 rounded-full mr-1.5 shrink-0 ${
                            row.type === 'added' ? 'bg-emerald-500' : row.type === 'removed' ? 'bg-red-500' : 'bg-amber-500'
                          }`} />
                          {row.cells[ci] || ''}
                        </div>
                      ) : (row.cells[ci] || '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {parsed.predicateLines.length > 0 && (
        <div className="mt-2 pt-1.5 border-t border-border">
          <div className="text-[9px] font-semibold text-text-muted mb-1">Predicate Information:</div>
          {parsed.predicateLines.map((line, i) => (
            <div key={i} className={`text-[10px] leading-relaxed px-1 rounded-sm ${diffColor[line.type]} ${diffTextColor[line.type]}`}>{line.text}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── SQL + Plan (폭에 따라 탭/좌우 전환) ────
const WIDE_THRESHOLD = 900

function CompareSection({ item, selectedPlan }: {
  item: WorkItem
  selectedPlan: { tunedSqlText?: string; originalPlanText: string; tunedPlanText: string; bindSetId?: string }
}) {
  const { colTerm: __ctxColTerm } = useObjectInfo()

  const wrapperRef = useRef<HTMLDivElement>(null)
  const [isWide, setIsWide] = useState(false)
  const isWideRef = useRef(false)
  const [tab, setTab] = useState<'after' | 'before'>('after')
  const [inlineFmt, setInlineFmt] = useState(true)
  const [sqlDiffOn, setSqlDiffOn] = useState(false)
  const [planDiffOn, setPlanDiffOn] = useState(false)
  const [panelMode, setPanelMode] = useState<ComparePanelMode | null>(null)
  const bindData = workBindSets[item.id]
  const isAfter = tab === 'after'
  const planDiff = useMemo(() => computePlanDiff(selectedPlan.originalPlanText, selectedPlan.tunedPlanText), [selectedPlan.originalPlanText, selectedPlan.tunedPlanText])
  const fmtOrigSql = useMemo(() => inlineFmt ? formatSQLText(item.sqlText) : item.sqlText, [item.sqlText, inlineFmt])
  const fmtTunedSql = useMemo(() => inlineFmt ? formatSQLText(selectedPlan.tunedSqlText || item.sqlText) : (selectedPlan.tunedSqlText || item.sqlText), [item.sqlText, selectedPlan.tunedSqlText, inlineFmt])
  const sqlDiff = useMemo(() => computeLineDiff(fmtOrigSql, fmtTunedSql), [fmtOrigSql, fmtTunedSql])

  // 폭 감지: wrapper 자체를 관찰, hysteresis로 oscillation 방지
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width
        // 넓어질 때는 700 이상, 좁아질 때는 650 미만 (50px hysteresis)
        const shouldBeWide = w >= WIDE_THRESHOLD
        const shouldBeNarrow = w < WIDE_THRESHOLD - 50
        if (shouldBeWide && !isWideRef.current) {
          isWideRef.current = true
          setIsWide(true)
        } else if (shouldBeNarrow && isWideRef.current) {
          isWideRef.current = false
          setIsWide(false)
        }
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={wrapperRef} className="relative border border-border rounded-lg bg-white overflow-hidden">
      {/* ── 전체 비교 (카드 우상단 floating) ── */}
      <button
        onClick={() => setPanelMode({ type: 'compare', scope: 'all' })}
        className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-text-muted bg-white/80 backdrop-blur-sm hover:bg-surface-muted hover:text-text-secondary transition-colors"
        title="전체 비교 패널 열기"
      >
        <Maximize2 size={10} /> 전체 비교
      </button>

      {/* ── 좌우 대조 (넓을 때) ── */}
      <div style={{ display: isWide ? 'block' : 'none' }} className="space-y-3 p-4">
        {/* SQL */}
        <div>
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-border">
            <div className="flex items-center gap-1.5">
              <div className="w-0.5 h-3.5 rounded-full bg-text-muted shrink-0" />
              <span className="text-[11px] font-semibold text-text-secondary uppercase">SQL</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setInlineFmt(f => !f)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${inlineFmt ? 'bg-code-bg text-code' : 'text-text-muted hover:bg-surface-muted hover:text-text-secondary'}`}
              >
                <FileText size={10} /> Format
              </button>
              <button
                onClick={() => setSqlDiffOn(d => !d)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${sqlDiffOn ? 'bg-code-bg text-code' : 'text-text-muted hover:bg-surface-muted hover:text-text-secondary'}`}
              >
                Diff
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 border border-border rounded-lg overflow-hidden">
            <div className="border-r border-border">
              <div className="flex items-center justify-between px-3 py-1 border-b border-surface-muted">
                <span className="text-[11px] font-semibold text-text-secondary">Before</span>
                <div className="flex items-center gap-0.5">
                  <CopyButton text={item.sqlText} />
                  <button onClick={() => setPanelMode({ type: 'single', target: 'sql-before' })} className="p-1 rounded text-text-muted hover:text-text-secondary hover:bg-surface-muted transition-colors" title="크게 보기"><Maximize2 size={11} /></button>
                </div>
              </div>
              <ResizablePanel defaultHeight={320} minHeight={120} maxHeight={1200}>
                <div className="h-full overflow-auto p-3">
                  {sqlDiffOn ? (
                    <div className="text-xs font-mono leading-relaxed">
                      {sqlDiff.leftLines.map((line, i) => (
                        <div key={i} className={`px-1 -mx-1 rounded-sm whitespace-pre-wrap ${DIFF_STYLES[line.type]}`}>
                          <span className={DIFF_TEXT[line.type]}>{line.type === 'equal' ? highlightSQL(line.text, __ctxColTerm) : line.text}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <pre className="text-xs font-mono whitespace-pre-wrap text-text-primary">{highlightSQL(fmtOrigSql, __ctxColTerm)}</pre>
                  )}
                </div>
              </ResizablePanel>
            </div>
            <div>
              <div className="flex items-center justify-between px-3 py-1 border-b border-surface-muted">
                <span className="text-[11px] font-semibold text-text-secondary">After</span>
                <div className="flex items-center gap-0.5">
                  <CopyButton text={selectedPlan.tunedSqlText || item.sqlText} />
                  <button onClick={() => setPanelMode({ type: 'single', target: 'sql-after' })} className="p-1 rounded text-text-muted hover:text-text-secondary hover:bg-surface-muted transition-colors" title="크게 보기"><Maximize2 size={11} /></button>
                </div>
              </div>
              <ResizablePanel defaultHeight={320} minHeight={120} maxHeight={1200}>
                <div className="h-full overflow-auto p-3">
                  {sqlDiffOn ? (
                    <div className="text-xs font-mono leading-relaxed">
                      {sqlDiff.rightLines.map((line, i) => (
                        <div key={i} className={`px-1 -mx-1 rounded-sm whitespace-pre-wrap ${DIFF_STYLES[line.type]}`}>
                          <span className={DIFF_TEXT[line.type]}>{line.type === 'equal' ? highlightSQL(line.text, __ctxColTerm) : line.text}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <pre className="text-xs font-mono whitespace-pre-wrap text-text-primary">{highlightSQL(fmtTunedSql, __ctxColTerm)}</pre>
                  )}
                </div>
              </ResizablePanel>
            </div>
          </div>
        </div>

        {/* Plan */}
        <div>
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-border">
            <div className="flex items-center gap-1.5">
              <div className="w-0.5 h-3.5 rounded-full bg-text-muted shrink-0" />
              <span className="text-[11px] font-semibold text-text-secondary uppercase">Plan</span>
            </div>
            <button
              onClick={() => setPlanDiffOn(d => !d)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${planDiffOn ? 'bg-code-bg text-code' : 'text-text-muted hover:bg-surface-muted hover:text-text-secondary'}`}
            >
              Diff
            </button>
          </div>
          <div className="grid grid-cols-2 border border-border rounded-lg overflow-hidden">
            <div className="border-r border-border">
              <div className="flex items-center justify-between px-3 py-1 border-b border-surface-muted">
                <span className="text-[11px] font-semibold text-text-secondary">Before</span>
                <div className="flex items-center gap-0.5">
                  <CopyButton text={selectedPlan.originalPlanText} />
                  <button onClick={() => setPanelMode({ type: 'single', target: 'plan-before' })} className="p-1 rounded text-text-muted hover:text-text-secondary hover:bg-surface-muted transition-colors" title="크게 보기"><Maximize2 size={11} /></button>
                </div>
              </div>
              <ResizablePanel defaultHeight={240} minHeight={120} maxHeight={600}>
                <div className="h-full overflow-auto p-3">
                  {planDiffOn ? <PlanDiffTable lines={planDiff.leftLines} /> : <PlanTable text={selectedPlan.originalPlanText} />}
                </div>
              </ResizablePanel>
            </div>
            <div>
              <div className="flex items-center justify-between px-3 py-1 border-b border-surface-muted">
                <span className="text-[11px] font-semibold text-text-secondary">After</span>
                <div className="flex items-center gap-0.5">
                  <CopyButton text={selectedPlan.tunedPlanText} />
                  <button onClick={() => setPanelMode({ type: 'single', target: 'plan-after' })} className="p-1 rounded text-text-muted hover:text-text-secondary hover:bg-surface-muted transition-colors" title="크게 보기"><Maximize2 size={11} /></button>
                </div>
              </div>
              <ResizablePanel defaultHeight={240} minHeight={120} maxHeight={600}>
                <div className="h-full overflow-auto p-3">
                  {planDiffOn ? <PlanDiffTable lines={planDiff.rightLines} /> : <PlanTable text={selectedPlan.tunedPlanText} />}
                </div>
              </ResizablePanel>
            </div>
          </div>
        </div>
      </div>

      {/* ── 전/후 탭 (좁을 때) ── */}
      <div style={{ display: isWide ? 'none' : 'block' }}>
        {/* 탭 헤더 */}
        <div className="flex border-b border-border items-center">
          {(['before', 'after'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-1.5 text-[11px] font-semibold transition-colors ${
                tab === t
                  ? 'text-code border-b-2 border-code bg-code-bg'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-alt'
              }`}
            >
              {t === 'after' ? 'After' : 'Before'}
            </button>
          ))}
        </div>

        {/* SQL */}
        <div className="border-b border-surface-muted">
          <div className="px-3 py-1.5 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-0.5 h-3.5 rounded-full bg-text-muted shrink-0" />
              <span className="text-[11px] font-semibold text-text-secondary uppercase">SQL</span>
              <button
                onClick={() => setInlineFmt(f => !f)}
                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${inlineFmt ? 'bg-code-bg text-code' : 'text-text-muted hover:bg-surface-muted hover:text-text-secondary'}`}
              >
                <FileText size={9} /> Format
              </button>
              <button
                onClick={() => setSqlDiffOn(d => !d)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${sqlDiffOn ? 'bg-code-bg text-code' : 'text-text-muted hover:bg-surface-muted hover:text-text-secondary'}`}
              >
                Diff
              </button>
            </div>
            <div className="flex items-center gap-0.5">
              <CopyButton text={isAfter ? (selectedPlan.tunedSqlText || item.sqlText) : item.sqlText} />
              <button onClick={() => setPanelMode({ type: 'single', target: isAfter ? 'sql-after' : 'sql-before' })} className="p-1 rounded text-text-muted hover:text-text-secondary hover:bg-surface-muted transition-colors" title="크게 보기"><Maximize2 size={11} /></button>
            </div>
          </div>
          <ResizablePanel defaultHeight={180} minHeight={60} maxHeight={500}>
            <div className="p-3">
              {sqlDiffOn ? (
                <div className="text-xs font-mono leading-relaxed">
                  {(isAfter ? sqlDiff.rightLines : sqlDiff.leftLines).map((line, i) => (
                    <div key={i} className={`px-1 -mx-1 rounded-sm whitespace-pre-wrap ${DIFF_STYLES[line.type]}`}>
                      <span className={DIFF_TEXT[line.type]}>{line.type === 'equal' ? highlightSQL(line.text, __ctxColTerm) : line.text}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <pre className="text-xs font-mono whitespace-pre-wrap text-text-primary leading-relaxed">
                  {highlightSQL(isAfter ? fmtTunedSql : fmtOrigSql, __ctxColTerm)}
                </pre>
              )}
            </div>
          </ResizablePanel>
        </div>

        {/* Plan */}
        <div>
          <div className="px-3 py-1.5 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-0.5 h-3.5 rounded-full bg-text-muted shrink-0" />
              <span className="text-[11px] font-semibold text-text-secondary uppercase">Plan</span>
              <button
                onClick={() => setPlanDiffOn(d => !d)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${planDiffOn ? 'bg-code-bg text-code' : 'text-text-muted hover:bg-surface-muted hover:text-text-secondary'}`}
              >
                Diff
              </button>
            </div>
            <div className="flex items-center gap-0.5">
              <CopyButton text={isAfter ? selectedPlan.tunedPlanText : selectedPlan.originalPlanText} />
              <button onClick={() => setPanelMode({ type: 'single', target: isAfter ? 'plan-after' : 'plan-before' })} className="p-1 rounded text-text-muted hover:text-text-secondary hover:bg-surface-muted transition-colors" title="크게 보기"><Maximize2 size={11} /></button>
            </div>
          </div>
          <ResizablePanel defaultHeight={240} minHeight={80} maxHeight={600}>
            <div className="p-3">
              {planDiffOn
                ? <PlanDiffTable lines={isAfter ? planDiff.rightLines : planDiff.leftLines} />
                : <PlanTable text={isAfter ? selectedPlan.tunedPlanText : selectedPlan.originalPlanText} />
              }
            </div>
          </ResizablePanel>
        </div>
      </div>

      {/* ComparePanel (floating, portaled to body) */}
      {panelMode && (
        <ComparePanel
          key={JSON.stringify(panelMode)}
          onClose={() => setPanelMode(null)}
          mode={panelMode}
          data={{
            sqlBefore: item.sqlText,
            sqlAfter: selectedPlan.tunedSqlText || item.sqlText,
            planBefore: selectedPlan.originalPlanText,
            planAfter: selectedPlan.tunedPlanText,
          }}
          bindSets={bindData?.sets}
          usedBindSetId={selectedPlan.bindSetId}
        />
      )}
    </div>
  )
}

// ─── AI 분석 근거 (요약 + 접기/펼치기) ──────────
// ─── 복사 버튼 헬퍼 ───────────────────────────
function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }).catch(() => fallbackCopy())
    } else {
      fallbackCopy()
    }
  }
  const fallbackCopy = () => {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={handleCopy} className="inline-flex items-center gap-1 p-1 rounded text-text-muted hover:text-text-secondary hover:bg-surface-muted transition-colors" title="Copy">
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {label && <span className="text-[11px] font-medium">{label}</span>}
    </button>
  )
}

// ─── 적용 탭 ──────────────────────────────────

function ApplyTab({ item, selectedPlan }: { item: WorkItem; selectedPlan: { types: TuningType[]; indexDdl?: string; indexDdls?: { name: string; ddl: string }[]; tunedSqlText?: string; bindSetId?: string; originalElapsed: number; tunedElapsed: number; originalBuffers: number; tunedBuffers: number; label: string; originalPlanText: string; tunedPlanText: string; summary: string; rationale?: string[] } }) {
  const { colTerm: __ctxColTerm } = useObjectInfo()

  const hasIndex = selectedPlan.types.includes('index')
  const hasSqlChange = selectedPlan.types.includes('hint') || selectedPlan.types.includes('rewrite')
  const needsBothSteps = hasIndex && hasSqlChange

  const ddls = selectedPlan.indexDdls ?? (selectedPlan.indexDdl ? [{ name: selectedPlan.indexDdl.match(/(\w+)\s+ON/)?.[1] ?? 'NEW_INDEX', ddl: selectedPlan.indexDdl }] : [])

  const bindData = workBindSets[item.id]
  const usedSet = selectedPlan.bindSetId && bindData ? bindData.sets.find(s => s.id === selectedPlan.bindSetId) : bindData?.sets[0]

  const { addNotification } = useNotifications()

  // 인덱스 적용 상태
  const [indexStatuses, setIndexStatuses] = useState<Record<number, 'pending' | 'scheduled' | 'applied'>>({})
  const [scheduledTimes, setScheduledTimes] = useState<Record<number, { date: string; time: string }>>({})
  const [schedulingIdx, setSchedulingIdx] = useState<number | null>(null)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('02:00')

  const pendingIndexCount = ddls.filter((_, i) => (indexStatuses[i] ?? 'pending') === 'pending').length

  return (
    <div className="space-y-4">
      {/* Step 1: 인덱스 생성 */}
      {hasIndex && ddls.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            {needsBothSteps && <span className="flex items-center justify-center w-5 h-5 rounded-full bg-action text-white text-[10px] font-bold shrink-0">1</span>}
            <span className="text-[11px] font-semibold text-text-secondary">인덱스 생성</span>
            {needsBothSteps && <span className="text-[10px] text-text-muted">SQL 변경 적용 전 선행 필요</span>}
          </div>
          <div className="space-y-2">
            {ddls.map((d, i) => {
              const st = indexStatuses[i] ?? 'pending'
              return (
                <div key={i} className={`border rounded-lg overflow-hidden ${st === 'applied' ? 'border-applied/30' : st === 'scheduled' ? 'border-action/30' : 'border-border'}`}>
                  {/* 헤더 */}
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`size-2 rounded-full shrink-0 ${st === 'applied' ? 'bg-applied' : st === 'scheduled' ? 'bg-action' : 'bg-warning'}`} />
                      <span className="text-xs font-mono font-medium text-code">{d.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {st === 'applied' && <span className="text-[10px] font-medium text-applied-dark">반영 완료</span>}
                      {st === 'scheduled' && scheduledTimes[i] && (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-action">
                          <Clock size={11} />
                          <span className="font-mono">{scheduledTimes[i].date} {scheduledTimes[i].time}</span>
                          예약됨
                        </span>
                      )}
                      {st === 'pending' && (
                        <>
                          <CopyButton text={d.ddl} />
                          <button
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-text-muted hover:text-text-secondary hover:bg-surface-muted transition-colors"
                            onClick={() => {
                              setIndexStatuses(prev => ({ ...prev, [i]: 'applied' }))
                              showToast({ message: `${d.name} 인덱스 생성 실행`, variant: 'success' })
                              // Mock PoC: 적용 완료 알림 push — 90% 성공 / 10% 실패
                              const isFail = Math.random() < 0.1
                              const instanceType = item.instanceName?.includes('검증') ? 'dev' : 'production'
                              if (isFail) {
                                addNotification({
                                  type: 'apply_failure',
                                  instance: item.instanceName,
                                  instanceType,
                                  requestLabel: item.workName ?? '튜닝 작업',
                                  sqlText: item.sqlText,
                                  applyErrorMsg: `ORA-00955: name is already used by an existing object (${d.name})`,
                                  workId: item.id,
                                })
                              } else {
                                addNotification({
                                  type: 'apply_complete',
                                  instance: item.instanceName,
                                  instanceType,
                                  requestLabel: item.workName ?? '튜닝 작업',
                                  sqlText: item.sqlText,
                                  applyObjects: [d.name],
                                  workId: item.id,
                                })
                              }
                            }}
                          >
                            즉시실행
                          </button>
                          <button
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-action text-white hover:bg-action-hover transition-colors"
                            onClick={() => {
                              if (schedulingIdx === i) { setSchedulingIdx(null); return }
                              const tmrw = new Date(Date.now() + 86400000)
                              setScheduleDate(`${tmrw.getFullYear()}-${String(tmrw.getMonth() + 1).padStart(2, '0')}-${String(tmrw.getDate()).padStart(2, '0')}`)
                              setScheduleTime('02:00')
                              setSchedulingIdx(i)
                            }}
                          >
                            예약
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {/* 예약 UI */}
                  {schedulingIdx === i && st === 'pending' && (
                    <div className="px-3 py-2.5 bg-surface border-t border-border space-y-2">
                      <div className="text-[11px] font-medium text-text-secondary">실행 예약</div>
                      <div className="flex items-center gap-2">
                        <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                          className="text-xs border border-border rounded px-2 py-1 bg-white" />
                        <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                          className="text-xs border border-border rounded px-2 py-1 bg-white" />
                        <button
                          className={`text-xs px-3 py-1 rounded font-medium text-white transition-colors ${scheduleDate ? 'bg-action hover:bg-action-hover' : 'bg-action/40 cursor-not-allowed'}`}
                          disabled={!scheduleDate}
                          onClick={() => {
                            setIndexStatuses(prev => ({ ...prev, [i]: 'scheduled' }))
                            setScheduledTimes(prev => ({ ...prev, [i]: { date: scheduleDate, time: scheduleTime } }))
                            setSchedulingIdx(null)
                            showToast({ message: `${d.name} 예약 완료 (${scheduleDate} ${scheduleTime})`, variant: 'info' })
                          }}
                        >예약 확정</button>
                        <button className="text-xs text-text-muted hover:text-text-secondary px-2 py-1" onClick={() => setSchedulingIdx(null)}>취소</button>
                      </div>
                      <div className="text-[10px] text-text-muted">지정 시간에 자동으로 인덱스 생성이 실행됩니다</div>
                    </div>
                  )}
                  {/* DDL 코드 */}
                  <div className="border-t border-surface-muted px-3 py-2">
                    <pre className="text-xs font-mono whitespace-pre-wrap text-text-primary">{highlightSQL(d.ddl, __ctxColTerm)}</pre>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* SQL 변경 (Hint / Rewrite) */}
      {hasSqlChange && (
        <SqlChangePanel
          item={item}
          selectedPlan={selectedPlan}
          usedSet={usedSet}
          needsBothSteps={needsBothSteps}
          pendingIndexCount={pendingIndexCount}
          ddls={ddls}
        />
      )}

      {/* 인덱스만 있고 SQL 변경 없는 경우 */}
      {hasIndex && !hasSqlChange && (
        <div className="text-xs text-text-muted border border-border rounded-lg px-3 py-2">
          SQL 변경 없이 인덱스 생성만으로 개선됩니다.
        </div>
      )}
    </div>
  )
}

// ─── SQL 변경 패널 (Hint / Rewrite) ──────────────────────────
function SqlChangePanel({ item, selectedPlan, usedSet, needsBothSteps, pendingIndexCount, ddls }: {
  item: WorkItem
  selectedPlan: { types: TuningType[]; tunedSqlText?: string; label: string; originalElapsed: number; tunedElapsed: number; originalBuffers: number; tunedBuffers: number; originalPlanText: string; tunedPlanText: string; summary: string; rationale?: string[] }
  usedSet?: BindSet
  needsBothSteps: boolean
  pendingIndexCount: number
  ddls: { name: string; ddl: string }[]
}) {
  const { colTerm: __ctxColTerm } = useObjectInfo()

  const [copied, setCopied] = useState(false)

  const changeTypes = selectedPlan.types.filter(t => t !== 'index')
  const hintCount = changeTypes.filter(t => t === 'hint').length
  const rewriteCount = changeTypes.filter(t => t === 'rewrite').length

  // SQL 내용 생성
  const buildSqlContent = () => {
    const er = calcChangeRate(selectedPlan.originalElapsed, selectedPlan.tunedElapsed)
    const br = calcChangeRate(selectedPlan.originalBuffers, selectedPlan.tunedBuffers)
    const L: string[] = []
    L.push('-- ============================================================')
    L.push('-- SQL 튜닝 권고사항')
    L.push('-- ============================================================')
    L.push(`-- 작업 ID    : ${item.id}`)
    L.push(`-- SQL ID     : ${item.sqlId}`)
    L.push(`-- 인스턴스   : ${item.instanceName}`)
    L.push(`-- 스키마     : ${item.schemaName}`)
    L.push(`-- 튜닝안     : ${selectedPlan.label}`)
    L.push(`-- 생성일     : ${new Date().toISOString().slice(0, 10)}`)
    L.push('--')
    L.push('-- [성능 비교]')
    L.push(`-- Elapsed Time : ${formatMs(selectedPlan.originalElapsed)} → ${selectedPlan.tunedElapsed != null ? formatMs(selectedPlan.tunedElapsed) : '—'} (${er.rate != null ? (er.improved ? '-' : '+') + Math.abs(er.rate) + '%' : '미수집'})`)
    L.push(`-- Buffer Gets  : ${formatNumber(selectedPlan.originalBuffers)} → ${selectedPlan.tunedBuffers != null ? formatNumber(selectedPlan.tunedBuffers) : '—'} (${br.rate != null ? (br.improved ? '-' : '+') + Math.abs(br.rate) + '%' : '미수집'})`)
    L.push('--')
    L.push('-- [변경사항]')
    L.push(`-- ${selectedPlan.summary}`)
    if (selectedPlan.rationale && selectedPlan.rationale.length > 0) {
      L.push('--')
      L.push('-- [근거]')
      selectedPlan.rationale.slice(0, 5).forEach((line, i) => L.push(`-- ${i + 1}. ${line}`))
    }
    if (pendingIndexCount > 0) {
      L.push('--')
      L.push('-- ⚠ 선행 조건: 아래 인덱스 생성 완료 후 적용하세요')
      ddls.forEach(d => L.push(`--   - ${d.name}`))
    }
    if (usedSet && usedSet.variables.length > 0) {
      L.push('--')
      L.push('-- [바인드 변수]')
      usedSet.variables.forEach((v: BindSetVariable) => {
        L.push(`-- :${v.name} = '${v.value}'`)
      })
    }
    L.push('-- ============================================================')
    L.push('')
    L.push('-- [튜닝 전 SQL]')
    L.push(item.sqlText.trim().replace(/;?\s*$/, ';'))
    L.push('')
    if (selectedPlan.originalPlanText && selectedPlan.originalPlanText.trim()) {
      L.push('-- [실행계획 — Before]')
      L.push(selectedPlan.originalPlanText.trim())
      L.push('')
    }
    L.push('-- ------------------------------------------------------------')
    L.push(`-- [튜닝 후 SQL] ${changeTypes.map(t => t === 'hint' ? '힌트 변경' : '리라이트').join(' + ')}`)
    L.push('-- ▼ 복사하여 사용')
    L.push('-- ------------------------------------------------------------')
    L.push('')
    L.push((selectedPlan.tunedSqlText || item.sqlText).trim().replace(/;?\s*$/, ';'))
    L.push('')
    if (selectedPlan.tunedPlanText && selectedPlan.tunedPlanText.trim()) {
      L.push('-- [실행계획 — After]')
      L.push(selectedPlan.tunedPlanText.trim())
      L.push('')
    }
    L.push('-- ============================================================')
    L.push('-- 본 권고는 AI 튜닝 시스템에서 자동 생성되었습니다.')
    L.push('-- 적용 전 반드시 개발/DBA 검토 후 진행하세요.')
    L.push('-- ============================================================')
    return L.join('\n')
  }

  const sqlContent = buildSqlContent()

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([sqlContent], { type: 'text/x-sql;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${item.id}-recommend.sql`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      {/* 섹션 헤더 */}
      <div className="flex items-center gap-2 mb-2">
        {needsBothSteps && <span className="flex items-center justify-center w-5 h-5 rounded-full bg-action text-white text-[10px] font-bold shrink-0">2</span>}
        <span className="text-[11px] font-semibold text-text-secondary">SQL 변경</span>
        <span className="text-[10px] text-text-muted">
          {hintCount > 0 && `Hint`}{hintCount > 0 && rewriteCount > 0 && ' + '}{rewriteCount > 0 && `Rewrite`}
        </span>
      </div>

      {/* 인덱스 의존성 경고 */}
      {pendingIndexCount > 0 && (
        <div className="rounded-md bg-warning-bg px-3 py-2 mb-2 text-[11px] text-warning-dark flex items-center gap-1.5">
          <span className="font-semibold">선행 조건:</span> 인덱스 {pendingIndexCount}개 생성이 완료되지 않았습니다.
        </div>
      )}

      {/* SQL 카드 */}
      <div className="border rounded-lg overflow-hidden border-border">
        {/* 파일명 */}
        <div className="flex items-center gap-2 px-3 py-2 bg-surface-alt border-b border-border">
          <span className="text-xs font-mono text-text-primary font-medium flex-1 truncate">{item.id}-recommend.sql</span>
        </div>

        {/* .sql 전체 내용 — 기본 펼침 */}
        <pre className="bg-white text-xs font-mono px-3 py-2.5 overflow-auto max-h-[400px] leading-5 m-0 whitespace-pre-wrap border-b border-border">{
          sqlContent.split('\n').map((line, i) => {
            if (line.startsWith('-- [튜닝 전') || line.startsWith('-- [튜닝 후') || line.startsWith('-- [실행계획') || line.startsWith('-- [변경사항') || line.startsWith('-- [근거') || line.startsWith('-- [성능') || line.startsWith('-- [바인드')) {
              return <span key={i} className="text-action font-medium">{line}{'\n'}</span>
            }
            if (line.startsWith('-- ⚠')) return <span key={i} className="text-danger">{line}{'\n'}</span>
            if (line.startsWith('-- ▼')) return <span key={i} className="text-success font-medium">{line}{'\n'}</span>
            if (line.startsWith('-- ==') || line.startsWith('-- --')) return <span key={i} className="text-text-muted/40">{line}{'\n'}</span>
            if (line.startsWith('--')) return <span key={i} className="text-text-muted">{line}{'\n'}</span>
            return <span key={i}>{highlightSQL(line, __ctxColTerm)}{'\n'}</span>
          })
        }</pre>

        {/* 액션 바 */}
        <div className="flex items-center gap-1 px-3 py-2 bg-surface-alt">
          <button className="text-[11px] text-text-muted hover:text-text-secondary px-2 py-1 rounded hover:bg-surface-muted transition-colors" onClick={handleCopy}>
            {copied ? '복사됨 ✓' : '전체 복사'}
          </button>
          <button className="text-[11px] text-text-muted hover:text-text-secondary px-2 py-1 rounded hover:bg-surface-muted transition-colors" onClick={handleDownload}>
            .sql 다운로드
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 이력 탭 ──────────────────────────────────
const HISTORY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  created: { label: '작업 생성', color: 'bg-border', icon: '○' },
  tuning_started: { label: '튜닝 시작', color: 'bg-border', icon: '○' },
  tuning_completed: { label: '튜닝 완료', color: 'bg-code', icon: '●' },
  approved: { label: '확인(승인)', color: 'bg-success', icon: '●' },
  retune_requested: { label: '재튜닝 요청', color: 'bg-warning', icon: '●' },
  rejected: { label: '반려', color: 'bg-danger', icon: '●' },
  exported: { label: 'SQL 전달', color: 'bg-info', icon: '●' },
  applied: { label: '반영 완료', color: 'bg-applied', icon: '●' },
  failed: { label: '실패', color: 'bg-danger', icon: '●' },
  cancelled: { label: '취소', color: 'bg-danger/60', icon: '●' },
  no_improve: { label: '개선없음', color: 'bg-text-muted', icon: '●' },
}

function RejectReasonBlock({ reason }: { reason?: string }) {
  const [expanded, setExpanded] = useState(false)
  if (!reason || !reason.trim()) {
    return (
      <div className="mt-1.5 rounded border border-border bg-surface-alt px-2.5 py-1.5">
        <div className="text-[10px] font-semibold text-text-muted mb-0.5">반려 사유</div>
        <p className="text-xs text-text-muted italic">사유 없음</p>
      </div>
    )
  }
  // 3줄 초과 또는 200자 초과 시 토글 노출
  const lineCount = reason.split('\n').length
  const isLong = lineCount > 3 || reason.length > 200
  return (
    <div className="mt-1.5 rounded border border-border bg-surface-alt px-2.5 py-1.5">
      <div className="text-[10px] font-semibold text-text-secondary mb-0.5">반려 사유</div>
      <p
        className={`text-xs text-text-secondary whitespace-pre-wrap break-words ${
          isLong && !expanded ? 'line-clamp-3' : ''
        }`}
      >
        {reason}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="mt-1 text-[10px] font-medium text-text-muted hover:text-text-primary transition-colors"
        >
          {expanded ? '접기' : '더 보기'}
        </button>
      )}
    </div>
  )
}

// ─── MaxGauge After SQL 후보 검색 mock ───────────
interface AfterSqlCandidate {
  sqlId: string
  sqlText: string      // MaxGauge가 보유한 SQL TEXT
  execCount: number    // 반영일 이후 누적 실행 횟수
  avgElapsed: number   // 반영일 이후 누적 평균 elapsed (ms)
}

function mockMaxGaugeSearch(itemId: string): Promise<AfterSqlCandidate[]> {
  const HAS_RESULTS = ['WI-2024-001', 'WI-2024-002', 'WI-2024-018']
  return new Promise(resolve => setTimeout(() => {
    if (HAS_RESULTS.includes(itemId)) {
      resolve([
        {
          sqlId: 'abc12345678f',
          sqlText: '/* EXEM_TUNING_ID=' + itemId + ' */ SELECT /*+ INDEX(o ORDER_IDX) */ o.order_id, o.customer_id, o.total_amount FROM ORDERS o WHERE o.status = :status AND o.created_at >= :dt',
          execCount: 24,
          avgElapsed: 400,
        },
        {
          sqlId: 'def98765432a',
          sqlText: '/* EXEM_TUNING_ID=' + itemId + ' */ SELECT /*+ INDEX(o ORDER_IDX) */ o.order_id, o.customer_id, o.total_amount FROM ORDERS o WHERE o.status = :status AND o.created_at >= :dt AND o.region = :r',
          execCount: 3,
          avgElapsed: 820,
        },
      ])
    } else {
      resolve([])
    }
  }, 800))
}

// ─── After SQL 검색 패널 ─────────────────────────
function AfterSqlSearchPanel({ item, onFound }: {
  item: WorkItem
  onFound: (updates: Partial<WorkItem>) => void
}) {
  const [loading, setLoading] = useState(true)
  const [candidates, setCandidates] = useState<AfterSqlCandidate[]>([])
  const [selected, setSelected] = useState<string>('')
  const [retrying, setRetrying] = useState(false)

  const doSearch = useCallback(() => {
    setLoading(true)
    mockMaxGaugeSearch(item.id).then(result => {
      setCandidates(result)
      if (result.length > 0) setSelected(result[0].sqlId)
      setLoading(false)
      setRetrying(false)
    })
  }, [item.id])

  useEffect(() => { doSearch() }, [doSearch])

  // 탐색 중
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 px-1 text-xs text-text-muted">
        <svg className="animate-spin h-3.5 w-3.5 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {retrying ? 'MaxGauge 재탐색 중...' : 'EXEM_TUNING_ID 주석으로 MaxGauge 탐색 중...'}
      </div>
    )
  }

  // 후보 없음
  if (candidates.length === 0) {
    return (
      <div className="space-y-2 rounded-lg border border-dashed border-border bg-white px-4 py-5">
        <p className="text-xs font-medium text-text-secondary">MaxGauge에서 After SQL을 찾지 못했습니다</p>
        <p className="text-[11px] text-text-muted leading-relaxed">
          EXEM_TUNING_ID 주석이 달린 SQL이 아직 운영에서 실행되지 않았거나,
          MaxGauge 수집 주기가 지나지 않았을 수 있습니다.
        </p>
        <button
          onClick={() => { setRetrying(true); doSearch() }}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-code hover:text-code-dark transition-colors"
        >
          <svg className="h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          다시 탐색
        </button>
      </div>
    )
  }

  // 후보 목록
  const selectedCandidate = candidates.find(c => c.sqlId === selected)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-xs font-medium text-text-secondary">MaxGauge에서 후보를 찾았습니다</p>
        <SourceBadge source="maxgauge" />
      </div>
      <p className="text-[11px] text-text-muted">반영일 이후 누적 기준 · EXEM_TUNING_ID 주석 매칭</p>
      <div className="space-y-2">
        {candidates.map(c => (
          <label
            key={c.sqlId}
            className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${selected === c.sqlId ? 'border-code bg-code-bg/40' : 'border-border hover:border-text-muted'}`}
          >
            <input
              type="radio"
              name="after-sql-candidate"
              value={c.sqlId}
              checked={selected === c.sqlId}
              onChange={() => setSelected(c.sqlId)}
              className="mt-0.5 shrink-0 accent-[var(--color-code)]"
            />
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-mono font-semibold text-code">{c.sqlId}</span>
                <span className="text-[10px] text-text-muted">실행 {c.execCount?.toLocaleString() ?? '—'}회 · 평균 {c.avgElapsed?.toLocaleString() ?? '—'}ms</span>
              </div>
              <p className="text-[10px] font-mono text-text-secondary leading-relaxed line-clamp-2 break-all">
                {c.sqlText}
              </p>
            </div>
          </label>
        ))}
      </div>
      <button
        disabled={!selectedCandidate}
        onClick={() => {
          if (!selectedCandidate) return
          onFound({
            operationalElapsed: selectedCandidate.avgElapsed,
            operationalExecCount: selectedCandidate.execCount,
            operationalResult: 'stable',
            operationalMeasuredAt: new Date().toISOString(),
            operationalSource: 'maxgauge',
          })
          showToast({ message: 'After SQL 등록 완료 — 운영 실측 데이터가 반영되었습니다', variant: 'success' })
        }}
        className={`text-xs px-3 py-1.5 rounded font-medium text-white transition-colors ${selectedCandidate ? 'bg-action hover:bg-action-hover' : 'bg-action/40 cursor-not-allowed'}`}
      >
        이걸로 등록
      </button>
    </div>
  )
}

// ─── 운영효과 탭 ──────────────────────────────────
function OpsEffectTab({ item, onAfterSqlFound }: {
  item: WorkItem
  onAfterSqlFound: (updates: Partial<WorkItem>) => void
}) {
  const [searchOpen, setSearchOpen] = useState(false)
  const isMaxGaugeConnected = useMaxGaugeStatus()

  if (!isMaxGaugeConnected) {
    return <MaxGaugeNotConnected feature="운영효과" />
  }

  const hasOps = item.operationalElapsed != null
  const before = item.originalElapsed
  const after = hasOps ? item.operationalElapsed! : before
  const isRegressed = item.operationalResult === 'regressed' || item.operationalResult === 'degraded'

  if (!hasOps) {
    const data = [
      { name: 'Before', value: before },
      { name: 'After', value: before },
    ]
    return (
      <div className="rounded-lg border border-dashed border-border bg-white py-8 px-6 flex flex-col items-center gap-4">
        <BarChart width={200} height={120} data={data} barCategoryGap="30%">
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            <Cell fill="var(--color-action)" />
            <Cell fill="var(--color-surface-muted)" />
          </Bar>
        </BarChart>
        <span className="text-sm font-semibold text-text-primary">운영 효과를 확인하려면</span>
        <p className="text-xs text-text-muted text-center max-w-xs">
          반영 완료 후 After SQL 후보를 찾아 등록하면 실제 운영 수치가 채워집니다.
        </p>

        <button
          onClick={() => setSearchOpen(s => !s)}
          className="inline-flex items-center gap-1.5 bg-action px-3 py-1.5 text-xs font-medium text-white rounded-md hover:bg-action-hover transition-colors"
        >
          <TrendingUp size={12} />
          After SQL 후보 찾기
        </button>
        {searchOpen && (
          <div className="w-full">
            <AfterSqlSearchPanel item={item} onFound={updates => { onAfterSqlFound(updates); setSearchOpen(false) }} />
          </div>
        )}
      </div>
    )
  }

  // 상태 B — 등록됨
  const data = [
    { name: 'Before', value: before, label: formatMs(before) },
    { name: 'After', value: after, label: formatMs(after) },
  ]
  const rate = before > 0 ? Math.round(((before - after) / before) * 100) : 0
  const improved = rate > 0

  const resultConfig: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    stable: { label: '안정', icon: <CheckCircle2 size={11} />, cls: 'text-success' },
    improved: { label: '안정', icon: <CheckCircle2 size={11} />, cls: 'text-success' },
    regressed: { label: '회귀감지', icon: <AlertCircle size={11} />, cls: 'text-danger' },
    degraded: { label: '회귀감지', icon: <AlertCircle size={11} />, cls: 'text-danger' },
    monitoring: { label: '모니터링중', icon: <Clock size={11} />, cls: 'text-text-muted' },
  }
  const rc = resultConfig[item.operationalResult ?? 'monitoring']

  return (
    <div className="rounded-lg border border-border bg-white py-8 px-6 flex flex-col items-center gap-4">
      <BarChart width={200} height={120} data={data} barCategoryGap="30%">
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          <Cell fill="var(--color-action)" />
          <Cell fill={isRegressed ? 'var(--color-danger)' : 'var(--color-success)'} />
          <LabelList dataKey="label" position="top" style={{ fontSize: 9, fill: 'var(--color-text-muted)' }} />
        </Bar>
      </BarChart>
      <div className="flex items-center gap-3 flex-wrap justify-center">
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${improved ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'}`}>
          {improved ? '-' : '+'}{Math.abs(rate)}%
        </span>
        <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${rc.cls}`}>
          {rc.icon} {rc.label}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {item.operationalSource && <SourceBadge source={item.operationalSource} />}
      </div>
      <div className="text-[11px] text-text-muted text-center space-y-0.5">
        {(() => {
          const appliedAt = item.appliedAt ? new Date(item.appliedAt) : null
          const measuredAt = item.operationalMeasuredAt ? new Date(item.operationalMeasuredAt) : null
          const days = appliedAt && measuredAt
            ? Math.max(1, Math.round((measuredAt.getTime() - appliedAt.getTime()) / (1000 * 60 * 60 * 24)))
            : null
          return (
            <>
              {days != null && item.operationalExecCount != null && (
                <p>반영 후 {days}일간 · {item.operationalExecCount?.toLocaleString() ?? '—'}회 실행 기준</p>
              )}
              {days != null && item.operationalExecCount == null && (
                <p>반영 후 {days}일 기준</p>
              )}
              {measuredAt && (
                <p className="text-[10px]">측정일 {formatDate(item.operationalMeasuredAt!)}</p>
              )}
            </>
          )
        })()}
      </div>
    </div>
  )
}

function HistoryTab({ workItemId }: { workItemId: string }) {
  const events = workHistory[workItemId]

  const formatTs = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div className="space-y-5">
      {/* 타임라인 */}
      {events && events.length > 0 && (
        <div className="relative pl-5">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
          <div className="space-y-4">
            {events.map((ev, i) => {
              const config = HISTORY_CONFIG[ev.type] ?? { label: ev.type, color: 'bg-border', icon: '○' }
              return (
                <div key={i} className="relative">
                  <div className={`absolute -left-5 top-0.5 w-[14px] h-[14px] rounded-full border-2 border-white ${config.color}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-text-primary">{config.label}</span>
                      {ev.actor && <span className="text-[10px] text-text-muted">{ev.actor}</span>}
                    </div>
                    <div className="text-[10px] text-text-muted mt-0.5">{formatTs(ev.timestamp)}</div>
                    {ev.note && <p className="text-xs text-text-secondary mt-1">{ev.note}</p>}
                    {ev.type === 'rejected' && <RejectReasonBlock reason={ev.reason} />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!events?.length && (
        <div className="text-xs text-text-muted py-4 text-center">이력 정보가 없습니다.</div>
      )}
    </div>
  )
}

// ─── 바인드 변수 섹션 ────────────────────────────
function BindSection({ planBindSetId, workItemId }: { planBindSetId?: string; workItemId: string }) {
  const [showFullView, setShowFullView] = useState(false)
  useEscStack(showFullView, useCallback(() => setShowFullView(false), []))
  const bindData = workBindSets[workItemId]
  if (!bindData || bindData.sets.length === 0) return null

  const usedSet = planBindSetId ? bindData.sets.find(s => s.id === planBindSetId) : bindData.sets[0]
  const otherSets = bindData.sets.filter(s => s.id !== usedSet?.id)
  const allSets = bindData.sets

  const formatCapturedAt = (iso: string) => {
    const d = new Date(iso)
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const bindSetToText = (set: BindSet) =>
    set.variables.map(v => `${v.name}\t${v.type}\t${v.value}`).join('\n')


  const renderBindTable = (set: BindSet, maxRows?: number) => {
    const vars = maxRows ? set.variables.slice(0, maxRows) : set.variables
    const overflow = maxRows && set.variables.length > maxRows ? set.variables.length - maxRows : 0
    return (
      <div>
        <table className="w-full text-xs font-mono">
          <tbody>
            {vars.map((v, i) => (
              <tr key={i} className="leading-relaxed">
                <td className="text-code font-medium pr-4 whitespace-nowrap">{v.name}</td>
                <td className="text-text-muted pr-4 whitespace-nowrap">{v.type}</td>
                <td className="text-text-primary">{v.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {overflow > 0 && (
          <span className="text-[10px] text-text-muted mt-0.5 inline-block">+{overflow}개 더</span>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-text-secondary">Bind Variables</span>
              {usedSet && (
                <>
                  <span className="text-[10px] text-text-muted">{formatCapturedAt(usedSet.capturedAt)}</span>
                  <span className="px-1 py-0.5 rounded bg-surface-alt text-[10px] text-text-secondary font-medium">{usedSet.source}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              {usedSet && <CopyButton text={bindSetToText(usedSet)} />}
              <button onClick={() => setShowFullView(true)} className="p-1 rounded text-text-muted hover:text-text-secondary hover:bg-surface-muted transition-colors" title="전체보기">
                <Maximize2 size={12} />
              </button>
            </div>
          </div>
          {usedSet && renderBindTable(usedSet, 3)}
        </div>
        {otherSets.length > 0 && (
          <div className="border-t border-surface-muted px-3 py-1.5">
            <span className="text-[10px] text-text-muted">+{otherSets.length}세트 수집됨</span>
          </div>
        )}
      </div>

      {/* 피벗 테이블 플로팅 패널 */}
      {showFullView && (
        <BindPivotPanel
          sets={allSets}
          usedSetId={usedSet?.id}
          onClose={() => setShowFullView(false)}
          formatCapturedAt={formatCapturedAt}
        />
      )}
    </>
  )
}

// ─── 바인드 피벗 플로팅 패널 ──────────────────────
const PIVOT_EDGE = 6
const PIVOT_MIN_W = 500
const PIVOT_MIN_H = 300

function BindPivotPanel({ sets, usedSetId, onClose, formatCapturedAt }: {
  sets: BindSet[]
  usedSetId?: string
  onClose: () => void
  formatCapturedAt: (iso: string) => string
}) {
  const { w: vw, h: vh } = getViewport()
  const initW = Math.min(1000, vw * 0.8)
  const initH = Math.min(600, vh * 0.7)

  const [pos, setPos] = useState({ x: Math.round((vw - initW) / 2), y: Math.round((vh - initH) / 2) })
  const [size, setSize] = useState({ w: initW, h: initH })
  const [maximized, setMaximized] = useState(false)
  const prevGeo = useRef({ pos: { x: Math.round((vw - initW) / 2), y: Math.round((vh - initH) / 2) }, size: { w: initW, h: initH } })
  const dragRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null)
  const resizeRef = useRef<{ sx: number; sy: number; ox: number; oy: number; ow: number; oh: number; dir: string } | null>(null)

  const toggleMax = useCallback(() => {
    if (maximized) {
      setPos(prevGeo.current.pos)
      setSize(prevGeo.current.size)
      setMaximized(false)
    } else {
      prevGeo.current = { pos, size }
      const v = getViewport()
      setPos({ x: 0, y: 0 })
      setSize({ w: v.w, h: v.h })
      setMaximized(true)
    }
  }, [maximized, pos, size])

  useEscStack(true, useCallback(() => onClose(), [onClose]))

  // Pivot: 행 = 변수명, 열 = 캡처 시점
  const varNames = useMemo(() => {
    if (sets.length === 0) return []
    return sets[0].variables.map(v => v.name)
  }, [sets])

  // 변수별 고유값 수 계산 → 값이 변하는 변수 상단 정렬
  const sortedVarNames = useMemo(() => {
    const uniqueCounts = varNames.map(name => {
      const vals = new Set(sets.map(s => s.variables.find(v => v.name === name)?.value || ''))
      return { name, unique: vals.size }
    })
    return uniqueCounts.sort((a, b) => b.unique - a.unique).map(x => x.name)
  }, [varNames, sets])

  const varUniqueCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const name of varNames) {
      const vals = new Set(sets.map(s => s.variables.find(v => v.name === name)?.value || ''))
      map[name] = vals.size
    }
    return map
  }, [varNames, sets])

  // Drag
  const onDrag = useCallback((e: React.MouseEvent) => {
    if (maximized) return
    e.preventDefault()
    dragRef.current = { sx: e.clientX, sy: e.clientY, px: pos.x, py: pos.y }
    const move = (ev: MouseEvent) => {
      if (!dragRef.current) return
      setPos({ x: Math.max(0, dragRef.current.px + (ev.clientX - dragRef.current.sx)), y: Math.max(0, dragRef.current.py + (ev.clientY - dragRef.current.sy)) })
    }
    const up = () => { dragRef.current = null; document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }, [pos])

  // Edge resize
  const onEdge = useCallback((dir: string, e: React.MouseEvent) => {
    if (maximized) return
    e.preventDefault(); e.stopPropagation()
    resizeRef.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, ow: size.w, oh: size.h, dir }
    const move = (ev: MouseEvent) => {
      if (!resizeRef.current) return
      const r = resizeRef.current, dx = ev.clientX - r.sx, dy = ev.clientY - r.sy
      let nx = r.ox, ny = r.oy, nw = r.ow, nh = r.oh
      if (r.dir.includes('e')) nw = Math.max(PIVOT_MIN_W, r.ow + dx)
      if (r.dir.includes('s')) nh = Math.max(PIVOT_MIN_H, r.oh + dy)
      if (r.dir.includes('w')) { const w2 = Math.max(PIVOT_MIN_W, r.ow - dx); nx = r.ox + (r.ow - w2); nw = w2 }
      if (r.dir.includes('n')) { const h2 = Math.max(PIVOT_MIN_H, r.oh - dy); ny = r.oy + (r.oh - h2); nh = h2 }
      setPos({ x: nx, y: ny }); setSize({ w: nw, h: nh })
    }
    const up = () => { resizeRef.current = null; document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }, [pos, size])

  return createPortal(
    <div
      className={`fixed flex flex-col bg-white shadow-2xl ${maximized ? '' : 'rounded-lg border border-border'}`}
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h, zIndex: 70 }}
    >
      {/* Header */}
      <div className={`flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2 ${maximized ? '' : 'cursor-move'}`} onMouseDown={onDrag}>
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-3.5 bg-action rounded-full" />
          <span className="text-[12px] font-semibold text-text-primary">바인드 변수 시계열</span>
          <span className="text-[10px] text-text-muted">{sets.length}세트 · {sortedVarNames.length}변수</span>
        </div>
        <div className="flex items-center gap-1" onMouseDown={e => e.stopPropagation()}>
          <div className="flex items-center gap-1.5 mr-2 text-[10px] text-text-muted">
            <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-sm bg-code-bg border border-code/30" />AI 테스트</span>
            <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-sm bg-warning-bg border border-warning/30" />값 변동</span>
          </div>
          <button onClick={toggleMax} className="rounded-md p-1.5 text-text-muted hover:bg-surface-muted hover:text-text-secondary transition-colors" title={maximized ? '원래 크기' : '전체화면'}>
            {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button onClick={onClose} className="rounded-md p-1.5 text-text-muted hover:bg-surface-muted hover:text-text-secondary transition-colors" title="닫기 (Esc)">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Pivot Table */}
      <div className="flex-1 overflow-auto">
        <table className="text-xs font-mono border-collapse min-w-max">
          <thead className="sticky top-0 z-10 bg-white">
            <tr>
              <th className="sticky left-0 z-20 bg-surface-alt px-3 py-1.5 text-left text-[10px] font-semibold text-text-secondary border-b border-r border-border whitespace-nowrap">
                변수명
              </th>
              {sets.map(set => {
                const isUsed = set.id === usedSetId
                return (
                  <th
                    key={set.id}
                    className={`px-2.5 py-1.5 text-center text-[10px] font-medium border-b border-border whitespace-nowrap ${
                      isUsed ? 'bg-code-bg text-code' : 'bg-surface-alt text-text-secondary'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-0.5">
                      <span>{formatCapturedAt(set.capturedAt)}</span>
                      <CopyButton text={set.variables.map(v => `:${v.name} = '${v.value}'`).join('\n')} />
                    </div>
                    <div className={`text-[9px] ${isUsed ? 'text-code/70' : 'text-text-muted'}`}>{set.source}{isUsed ? ' ★' : ''}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sortedVarNames.map(name => {
              const isVariable = varUniqueCounts[name] > 1
              return (
                <tr key={name} className={`border-b border-surface-muted ${isVariable ? '' : 'opacity-50'}`}>
                  <td className={`sticky left-0 z-10 px-3 py-1 border-r border-border whitespace-nowrap font-medium ${
                    isVariable ? 'bg-warning-bg/30 text-text-primary' : 'bg-surface-alt text-text-muted'
                  }`}>
                    {name}
                    {isVariable && <span className="ml-1 text-[9px] text-warning-dark">({varUniqueCounts[name]})</span>}
                  </td>
                  {sets.map(set => {
                    const v = set.variables.find(x => x.name === name)
                    const val = v?.value || ''
                    const isUsed = set.id === usedSetId
                    // 값이 AI 테스트에 사용된 세트의 값과 다른지 확인
                    const usedVal = sets.find(s => s.id === usedSetId)?.variables.find(x => x.name === name)?.value || ''
                    const isDiff = isVariable && val !== usedVal
                    return (
                      <td
                        key={set.id}
                        className={`px-2.5 py-1 text-center whitespace-nowrap ${
                          isUsed ? 'bg-code-bg/30' :
                          isDiff ? 'bg-warning-bg/40 text-warning-dark font-medium' :
                          ''
                        }`}
                      >
                        {val}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Resize handles */}
      {!maximized && (
        <>
          <div className="absolute" style={{ top: 0, left: PIVOT_EDGE, right: PIVOT_EDGE, height: PIVOT_EDGE, cursor: 'ns-resize' }} onMouseDown={e => onEdge('n', e)} />
          <div className="absolute" style={{ bottom: 0, left: PIVOT_EDGE, right: PIVOT_EDGE, height: PIVOT_EDGE, cursor: 'ns-resize' }} onMouseDown={e => onEdge('s', e)} />
          <div className="absolute" style={{ left: 0, top: PIVOT_EDGE, bottom: PIVOT_EDGE, width: PIVOT_EDGE, cursor: 'ew-resize' }} onMouseDown={e => onEdge('w', e)} />
          <div className="absolute" style={{ right: 0, top: PIVOT_EDGE, bottom: PIVOT_EDGE, width: PIVOT_EDGE, cursor: 'ew-resize' }} onMouseDown={e => onEdge('e', e)} />
          <div className="absolute" style={{ top: 0, left: 0, width: PIVOT_EDGE, height: PIVOT_EDGE, cursor: 'nwse-resize' }} onMouseDown={e => onEdge('nw', e)} />
          <div className="absolute" style={{ top: 0, right: 0, width: PIVOT_EDGE, height: PIVOT_EDGE, cursor: 'nesw-resize' }} onMouseDown={e => onEdge('ne', e)} />
          <div className="absolute" style={{ bottom: 0, left: 0, width: PIVOT_EDGE, height: PIVOT_EDGE, cursor: 'nesw-resize' }} onMouseDown={e => onEdge('sw', e)} />
          <div className="absolute" style={{ bottom: 0, right: 0, width: PIVOT_EDGE, height: PIVOT_EDGE, cursor: 'nwse-resize' }} onMouseDown={e => onEdge('se', e)} />
        </>
      )}
    </div>,
    document.body
  )
}

function AIRationale({ summary, rationale, planMeta }: {
  summary: string
  rationale?: string[]
  planMeta?: { types: TuningType[]; improvementRate: number; verifyType: string; hasIndex: boolean }
}) {
  const [expanded, setExpanded] = useState(false)
  const hasDetail = rationale && rationale.length > 0

  return (
    <div className="rounded-lg border border-border bg-white overflow-hidden flex">
      <div className="w-1 bg-action shrink-0" />
      <div className="flex-1 min-w-0">
        {planMeta && (
          <div className="px-3 pt-2.5 pb-1 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="font-semibold text-text-primary">{planMeta.types.map(t => TYPE_COLORS[t].label).join(' · ')}</span>
              <span className="text-text-muted">·</span>
              <span className={planMeta.verifyType === 'actual' ? 'text-success-dark font-medium' : 'text-text-secondary'}>{planMeta.verifyType === 'actual' ? '실측 검증' : '예상치 기준'}</span>
              {planMeta.hasIndex && <><span className="text-text-muted">·</span><span className="text-text-muted">인덱스 생성 필요</span></>}
            </div>
            {planMeta.improvementRate != null && planMeta.improvementRate !== 0 ? (
              <span className={`text-sm font-bold ${planMeta.improvementRate > 0 ? 'text-success-dark' : 'text-danger-dark'}`}>
                {planMeta.improvementRate > 0 ? '↓' : '↑'}{Math.abs(planMeta.improvementRate)}%
              </span>
            ) : null}
          </div>
        )}
        <button
          onClick={() => hasDetail && setExpanded(!expanded)}
          className="w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-surface transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold text-text-muted uppercase mb-0.5">AI 분석 근거</div>
            <p className="text-xs text-text-primary leading-relaxed">{summary}</p>
          </div>
          {hasDetail && (
            <span className="shrink-0 text-text-muted mt-0.5">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          )}
        </button>
        {expanded && hasDetail && (
          <div className="border-t border-surface-muted px-3 py-2.5 space-y-1.5 bg-surface/50">
            {rationale.map((line, i) => (
              <div key={i} className="flex gap-2 text-xs text-text-secondary">
                <span className="shrink-0 text-text-muted font-mono text-[10px] mt-px">{i + 1}.</span>
                <p className="leading-relaxed">{line}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// WorkflowSteps removed — now rendered as MiniStepper in SlidePanel header

// ─── Before 정보 (튜닝대기/튜닝중 공용) ──────────────────────
function BeforeInfoSection({ item, wide = false }: { item: WorkItem; wide?: boolean }) {
  const { colTerm: __ctxColTerm } = useObjectInfo()

  const [inlineFmt, setInlineFmt] = useState(true)
  const [panelMode, setPanelMode] = useState<ComparePanelMode | null>(null)
  const fmtSql = useMemo(() => inlineFmt ? formatSQLText(item.sqlText) : item.sqlText, [item.sqlText, inlineFmt])

  return (
    <div className="space-y-3">
      {/* Before 성능수치 */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-border">
          <div className="px-3 py-2.5">
            <div className="text-[10px] text-text-muted font-medium mb-0.5">Elapsed</div>
            <span className="font-mono text-sm font-semibold text-text-primary">{formatMs(item.originalElapsed)}</span>
          </div>
          <div className="px-3 py-2.5">
            <div className="text-[10px] text-text-muted font-medium mb-0.5">Buffer Gets</div>
            <span className="font-mono text-sm font-semibold text-text-primary">{formatNumber(item.originalBuffers)}</span>
          </div>
        </div>
      </div>

      {/* SQL + Plan — 넓게보기 시 2-col, 좁을 때 stack */}
      <div className={wide ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>

      {/* Before SQL */}
      <div className="border border-border rounded-lg bg-white overflow-hidden">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
          <div className="flex items-center gap-1.5">
            <div className="w-0.5 h-3.5 rounded-full bg-text-muted shrink-0" />
            <span className="text-[11px] font-semibold text-text-secondary">Before SQL</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setInlineFmt(f => !f)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${inlineFmt ? 'bg-code-bg text-code' : 'text-text-muted hover:bg-surface-muted hover:text-text-secondary'}`}
            >
              <FileText size={10} /> Format
            </button>
            <CopyButton text={item.sqlText} />
            <button onClick={() => setPanelMode({ type: 'single', target: 'sql-before' })} className="p-1 rounded text-text-muted hover:text-text-secondary hover:bg-surface-muted transition-colors" title="크게 보기"><Maximize2 size={11} /></button>
          </div>
        </div>
        <ResizablePanel defaultHeight={320} minHeight={120} maxHeight={1200}>
          <div className="h-full overflow-auto p-3">
            <pre className="text-xs font-mono whitespace-pre-wrap text-text-primary leading-relaxed">{highlightSQL(fmtSql, __ctxColTerm)}</pre>
          </div>
        </ResizablePanel>
      </div>

      {/* Before Plan */}
      {item.originalPlanText && (() => {
        const isMemory = item.planSource === 'memory'
        return (
        <div className="border border-border rounded-lg bg-white overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
            <div className="flex items-center gap-1.5">
              <div className="w-0.5 h-3.5 rounded-full bg-text-muted shrink-0" />
              <span className="text-[11px] font-semibold text-text-secondary">Before Plan</span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${isMemory ? 'bg-success-bg text-success-dark' : 'bg-surface-alt text-text-secondary'}`}>
                {isMemory ? '실측 (V$SQL_PLAN)' : '예상 (EXPLAIN PLAN)'}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              <CopyButton text={item.originalPlanText} />
              <button onClick={() => setPanelMode({ type: 'single', target: 'plan-before' })} className="p-1 rounded text-text-muted hover:text-text-secondary hover:bg-surface-muted transition-colors" title="크게 보기"><Maximize2 size={11} /></button>
            </div>
          </div>
          <ResizablePanel defaultHeight={240} minHeight={120} maxHeight={600}>
            <div className="h-full overflow-auto p-3">
              <PlanTable text={item.originalPlanText} />
            </div>
          </ResizablePanel>
        </div>
        )
      })()}

      </div>

      {/* ComparePanel (floating) — before-only mode */}
      {panelMode && (
        <ComparePanel
          key={JSON.stringify(panelMode)}
          onClose={() => setPanelMode(null)}
          mode={panelMode}
          data={{
            sqlBefore: item.sqlText,
            sqlAfter: item.sqlText,
            planBefore: item.originalPlanText || '',
            planAfter: item.originalPlanText || '',
          }}
        />
      )}
    </div>
  )
}

// ─── 튜닝중 프로그레스 카드 ──────────────────────
function TuningProgressCard({ item, onCancel, wide = false }: { item: WorkItem; onCancel?: () => void; wide?: boolean }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = new Date(item.updatedAt).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [item.updatedAt])

  const fmtElapsed = (s: number | null | undefined) => s == null ? '—' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const cancelBtn = onCancel ? (
    <button
      onClick={onCancel}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-danger hover:bg-danger-bg transition-colors shrink-0"
    >
      <Ban size={12} /> 중단
    </button>
  ) : null

  return (
    <TuningInProgressCard
      variant={wide ? 'expanded' : 'narrow'}
      currentStep={analysisStepToProgress(item.analysisStep)}
      elapsed={fmtElapsed(elapsed)}
      stepDescription={ANALYSIS_STEP_DESC[item.analysisStep || ''] ?? ''}
      footer={
        wide ? cancelBtn : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted min-w-0">
              <span>
                <span className="text-text-muted">인스턴스</span>{' '}
                <span className="font-medium text-text-primary">{item.instanceName}</span>
              </span>
              <span className="text-border">·</span>
              <span>
                <span className="text-text-muted">스키마</span>{' '}
                <span className="font-medium text-text-primary">{item.schemaName}</span>
              </span>
            </div>
            {cancelBtn}
          </div>
        )
      }
    />
  )
}

// ─── 메인 패널 컴포넌트 ──────────────────────────
export default function WorkDetailPanel({ item, onVerify, onReject, onRetune, onCancel, panelMode, onOpenWorkbench }: {
  item: WorkItem
  onVerify?: () => void
  onReject?: (onConfirmed?: () => void) => void
  onRetune?: () => void
  onCancel?: () => void
  panelMode?: 'slide' | 'maximized'
  onOpenWorkbench?: () => void
}) {
  const { colTerm: __ctxColTerm } = useObjectInfo()
  const wide = panelMode === 'maximized'
  const recommendation = workRecommendations[item.id]
  const plans = recommendation?.plans ?? []
  const [selectedPlanId, setSelectedPlanId] = useState(() => plans[0]?.id ?? '')
  // 백엔드 요청(BE-xxx)인 경우, detail API 에서 SQL/plan/성능 로드 후 workRecommendations 에 주입
  const [beDetailTick, setBeDetailTick] = useState(0)
  void beDetailTick
  useEffect(() => {
    if (!item.id.startsWith('BE-')) return
    if (workRecommendations[item.id]) return  // 이미 로드됨
    const numericId = item.id.slice(3)
    fetchTuningRequestDetail(numericId)
      .then((d: TuningRequestDetail) => {
        const perfBefore = d.performance.find(p => p.phase === 'before')
        const perfAfter = d.performance.find(p => p.phase === 'after' || p.phase === 'applied')
        const planBefore = d.plans.find(p => p.phase === 'before')
        const planAfter = d.plans.find(p => p.phase === 'after' || p.phase === 'applied')
        const origMs = perfBefore?.elapsed_time_sec != null ? Math.round(perfBefore.elapsed_time_sec * 1000) : 0
        const tunedMs = perfAfter?.elapsed_time_sec != null ? Math.round(perfAfter.elapsed_time_sec * 1000) : undefined
        const improvement = origMs > 0 && tunedMs != null ? Math.round(((origMs - tunedMs) / origMs) * 100) : 0
        const planId = `${item.id}-A`
        workRecommendations[item.id] = {
          workItemId: item.id,
          selectedPlanId: planId,
          plans: [{
            id: planId,
            label: 'AI 튜닝안',
            types: (() => {
            const r = (d.rationale || '').toLowerCase()
            const tuned = d.tuned_sql_text || ''
            const ts: ('index' | 'hint' | 'rewrite')[] = []
            if (r.includes('인덱스') || /\bindex\b/i.test(r)) ts.push('index')
            if (tuned.includes('/*+') || r.includes('힌트') || /\bhint\b/i.test(r)) ts.push('hint')
            if (ts.length === 0) ts.push('rewrite')
            return ts
          })(),
            improvementRate: -improvement,
            summary: d.rationale?.slice(0, 200) || `${improvement}% 성능 개선`,
            rationale: d.rationale ? [d.rationale] : [],
            originalElapsed: origMs,
            tunedElapsed: tunedMs,
            originalBuffers: perfBefore?.buffer_gets_count ?? undefined,
            tunedBuffers: perfAfter?.buffer_gets_count ?? undefined,
            originalDiskReads: perfBefore?.disk_reads_count ?? undefined,
            tunedDiskReads: perfAfter?.disk_reads_count ?? undefined,
            originalPlanText: planBefore?.plan_text ?? '',
            tunedPlanText: planAfter?.plan_text ?? '',
            tunedSqlText: d.tuned_sql_text ?? '',
          }],
        }
        // 원본 SQL 도 item.sqlText 가 preview(100자) 이므로 본문으로 교체할 수 있게 전역 플래그 업데이트
        setBeDetailTick(t => t + 1)
      })
      .catch(err => console.error('[fetchTuningRequestDetail]', err))
  }, [item.id])
  // plans 가 재로드되면 selectedPlanId 도 동기화 (백엔드 detail 로드 직후 첫 plan 자동 선택)
  useEffect(() => {
    if (!selectedPlanId && plans.length > 0) setSelectedPlanId(plans[0].id)
  }, [plans, selectedPlanId])
  const selectedPlan = useMemo(() => plans.find(p => p.id === selectedPlanId), [plans, selectedPlanId])
  const [sqlModalOpen, setSqlModalOpen] = useState(false)
  useEscStack(sqlModalOpen, useCallback(() => setSqlModalOpen(false), []))

  const status = item.status
  const hasTuningData = ['approval_pending', 'apply_pending', 'applied', 'failed', 'no_improve', 'rejected'].includes(status)

  const defaultTab =
    status === 'applied'       ? 'ops'   :
    status === 'apply_pending' ? 'apply' : 'review'
  const [activeDetailTab, setActiveDetailTab] = useState(defaultTab)
  const detailTabs = hasTuningData
    ? [
        { key: 'review', label: '검토' },
        { key: 'apply', label: '반영' },
        { key: 'ops', label: '운영효과' },
        { key: 'history', label: '이력' },
      ] as const
    : []

  // localItem: onAfterSqlFound 콜백으로 운영효과 데이터를 mutation 없이 관리
  const [localItem, setLocalItem] = useState<WorkItem>(item)
  const handleAfterSqlFound = useCallback((updates: Partial<WorkItem>) => {
    setLocalItem(prev => ({ ...prev, ...updates }))
  }, [])

  return (
    <div className="space-y-3">
      {/* ① 기본 정보 — 1줄 메타 + SQL 미리보기 */}
      <div>
        <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-text-muted mb-0.5 overflow-hidden">
          <span className="truncate shrink min-w-0">{item.instanceName} · {item.schemaName} · {formatDate(item.createdAt)}</span>
          {item.executionContext && <span className="truncate shrink min-w-0">· {item.executionContext}{item.estimatedDailyExec != null && ` · 일 ${formatNumber(item.estimatedDailyExec)}회`}</span>}
          <span className="shrink-0 px-1 py-px rounded bg-surface-alt text-text-secondary font-medium">{item.source === 'maxgauge' ? 'MaxGauge' : item.source === 'awr' ? 'AWR' : 'V$SQL'}</span>
          {hasTuningData && item.executionResult && (
            item.executionResult === 'timeout'
              ? <span className="px-1 py-px rounded bg-warning-bg text-warning font-medium inline-flex items-center gap-0.5"><Clock size={10} />실측(T/O)</span>
              : item.executionResult === 'completed'
                ? <span className="px-1 py-px rounded bg-success-bg text-success-dark font-medium">실측</span>
                : <span className="px-1 py-px rounded bg-surface-alt text-text-secondary font-medium">예상</span>
          )}
          {hasTuningData && item.integrityResult === 'mismatch' && (
            <span className="px-1 py-px rounded bg-danger-bg text-danger font-medium">⚠ 정합성 불일치</span>
          )}
          {item.queryTimeoutSec != null && (
            <span className="px-1 py-px rounded bg-surface-alt text-text-secondary font-medium" title="이 요청에만 적용된 쿼리 타임아웃">⏱ {item.queryTimeoutSec}초</span>
          )}
        </div>
        <div className="flex items-start gap-1.5">
          <pre className="text-[12px] font-mono text-text-secondary whitespace-pre-wrap break-all bg-surface-alt rounded-md border border-border px-2 py-1.5 max-h-[180px] overflow-y-auto flex-1 leading-[1.6] cursor-pointer hover:text-code transition-colors" onClick={() => setSqlModalOpen(true)} title="클릭하면 전체 화면 보기">{item.sqlText}</pre>
          <button onClick={() => setSqlModalOpen(true)} className="shrink-0 text-[10px] text-code hover:text-code-dark font-medium mt-1">전체</button>
        </div>
      </div>

      {/* SQL 전체보기 — FloatingPopup (드래그+리사이즈 가능) */}
      {sqlModalOpen && createPortal(
        <FloatingPopup
          id={`sql-view-${item.id}`}
          title={`SQL — ${item.sqlId}`}
          initialX={80}
          initialY={60}
          onClose={() => setSqlModalOpen(false)}
          onFocus={() => {}}
          zIndex={60}
        >
          <pre className="font-mono text-xs text-text-primary leading-relaxed whitespace-pre-wrap">{highlightSQL(item.sqlText, __ctxColTerm)}</pre>
        </FloatingPopup>,
        document.body,
      )}

      {/* ── 탭 ── */}
      {detailTabs.length > 0 && (
        <div className="flex border-b border-border">
          {detailTabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveDetailTab(t.key)}
              className={`px-4 py-2 text-xs font-semibold transition-colors ${
                activeDetailTab === t.key
                  ? 'text-action border-b-2 border-action'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ══════ 검토 탭 ══════ */}
      {(activeDetailTab === 'review' || !hasTuningData) && <>

      {/* ── 복수 튜닝안 선택 카드 (2개 이상일 때만) ── */}
      {plans.length > 1 && (
        <div className="grid grid-cols-2 gap-3">
          {plans.map((plan, pi) => {
            const isSelected = plan.id === selectedPlanId
            const hasIndex = plan.types.includes('index')
            const isRecommended = pi === 0
            return (
              <button
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className={`text-left rounded-lg overflow-hidden transition-all flex w-full ${
                  isSelected
                    ? 'border-2 border-action shadow-sm'
                    : 'border border-border hover:border-text-muted opacity-70 hover:opacity-100'
                }`}
              >
                <div className={`w-1 shrink-0 ${isSelected ? 'bg-action' : 'bg-transparent'}`} />
                <div className="flex-1 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-text-primary">{plan.label}</span>
                      {isRecommended && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-action text-white leading-none">추천</span>
                      )}
                    </div>
                    {plan.improvementRate != null && plan.improvementRate !== 0 ? (
                      <span className={`text-sm font-bold ${plan.improvementRate > 0 ? 'text-success-dark' : 'text-danger-dark'}`}>
                        {plan.improvementRate > 0 ? '↓' : '↑'}{Math.abs(plan.improvementRate)}%
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[11px] text-text-secondary">
                    <span className="font-semibold text-text-secondary">{plan.types.map(t => TYPE_COLORS[t].label).join(' · ')}</span>
                    <span className="text-text-muted mx-1">|</span>
                    <span className={plan.verifyType === 'actual' ? 'text-success-dark font-medium' : ''}>{plan.verifyType === 'actual' ? '실측 검증' : '예상치 기준'}</span>
                    {hasIndex && <span className="text-text-muted"> · 인덱스 생성 필요</span>}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* ── AI 분석 근거 (단일안: 메타 인라인 포함) ── */}
      {hasTuningData && selectedPlan && (
        <AIRationale
          summary={selectedPlan.summary}
          rationale={selectedPlan.rationale}
          planMeta={plans.length === 1 ? {
            types: selectedPlan.types,
            improvementRate: selectedPlan.improvementRate,
            verifyType: selectedPlan.verifyType,
            hasIndex: selectedPlan.types.includes('index'),
          } : undefined}
        />
      )}

      {/* ── 메트릭 요약 (튜닝 데이터 있을 때) ── */}
      {hasTuningData && selectedPlan && (() => {
        const metrics = [
          { label: 'Buffer Gets', orig: selectedPlan.originalBuffers, tuned: selectedPlan.tunedBuffers, format: formatNumber },
          { label: 'Elapsed', orig: selectedPlan.originalElapsed, tuned: selectedPlan.tunedElapsed, format: formatMs },
        ]
        return (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-border">
              {metrics.map(row => {
                const { rate, improved } = calcChangeRate(row.orig, row.tuned)
                return (
                  <div key={row.label} className="px-3 py-2.5">
                    <div className="text-[10px] text-text-muted font-medium mb-0.5">{row.label}</div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-xs text-text-muted line-through">{row.format(row.orig)}</span>
                      <span className={`font-mono text-sm font-semibold ${row.tuned == null ? 'text-text-muted' : 'text-text-primary'}`}>{row.tuned == null ? '—' : row.format(row.tuned)}</span>
                      {rate !== null && rate !== 0 && (
                        <span className={`text-[10px] font-semibold ${improved ? 'text-success-dark' : 'text-danger'}`}>
                          {improved ? '↓' : '↑'}{Math.abs(rate)}%
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ── 바인드 변수 ── */}
      {hasTuningData && selectedPlan && (
        <BindSection planBindSetId={selectedPlan.bindSetId} workItemId={item.id} />
      )}

      {/* ── SQL + Plan ── */}
      {hasTuningData && selectedPlan && (
        <CompareSection
          item={item}
          selectedPlan={selectedPlan}
        />
      )}

      {/* ── 반려 상태 정보 ── */}
      {status === 'rejected' && item.rejectedReason && (
        <div className="bg-danger-bg border border-danger rounded-lg p-3">
          <div className="text-xs font-semibold text-danger-dark mb-1">반려 사유</div>
          <p className="text-xs text-danger">{item.rejectedReason}</p>
        </div>
      )}

      {/* ── 튜닝 실패 정보 ── */}
      {item.tuningError && (
        <div className="bg-danger-bg border border-danger/40 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-danger mb-1">
            <XCircle className="h-3.5 w-3.5" />
            튜닝 실패
          </div>
          <p className="text-xs text-danger">{item.tuningError}</p>
        </div>
      )}

      {/* ── 반영 실패 정보 ── */}
      {item.applyError && (
        <div className="bg-danger-bg border border-danger/40 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-danger mb-1">
            <XCircle className="h-3.5 w-3.5" />
            반영 실패
          </div>
          <p className="text-xs text-danger">{item.applyError}</p>
        </div>
      )}

      {/* ── 개선없음 정보 ── */}
      {status === 'no_improve' && (
        <div className="bg-surface-alt border border-border rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-1">
            <Ban className="h-3.5 w-3.5" />
            개선없음
          </div>
          <p className="text-xs text-text-secondary">{item.cancelReason ?? 'AI 분석 완료 — 추가 개선 여지가 없습니다.'}</p>
        </div>
      )}

      {/* ── 취소 상태 정보 (예외 SQL 정책 / 사용자 취소) ── */}
      {status === 'cancelled' && item.cancelReason && (
        <div className="bg-warning-bg border border-warning/40 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-warning mb-1">
            <Ban className="h-3.5 w-3.5" />
            취소 사유
          </div>
          <p className="text-xs text-text-secondary">{item.cancelReason}</p>
          {item.cancelledAt && (
            <p className="mt-1 text-[11px] text-text-muted">
              {new Date(item.cancelledAt).toLocaleString('ko-KR')}
            </p>
          )}
        </div>
      )}

      {/* ── 튜닝대기: Before 정보 ── */}
      {status === 'pending' && (
        <BeforeInfoSection item={item} wide={wide} />
      )}

      {/* ── 튜닝중: 프로그레스 UI + Before 정보 ── */}
      {status === 'tuning' && <>
        <TuningProgressCard item={item} onCancel={onCancel} wide={wide} />
        <BeforeInfoSection item={item} wide={wide} />
      </>}

      {/* ── 스티키 바 여백 + 액션 버튼 (튜닝완료 상태 · 사람 확인) ── */}
      {status === 'approval_pending' && selectedPlan && <>
        <div className="h-14" />
        <div className="sticky bottom-0 bg-white border-t border-border shadow-[0_-2px_8px_rgba(0,0,0,0.06)] -mx-6 px-6 py-3 flex items-center gap-2 z-10">
          <Button size="sm" onClick={() => { onVerify?.(); setActiveDetailTab('apply'); showToast({ message: '확인 완료 — 반영대기로 전환되었습니다', variant: 'success' }) }}>
            <CheckCircle2 size={13} className="mr-1" /> 확인
          </Button>
          <Button size="sm" variant="secondary" onClick={() => { onRetune?.(); setActiveDetailTab('history') }}>
            <Undo2 size={13} className="mr-1" /> 재튜닝
          </Button>
          <Button size="sm" variant="danger" onClick={() => { onReject?.(() => setActiveDetailTab('history')) }}>
            <XCircle size={13} className="mr-1" /> 반려
          </Button>
          {onOpenWorkbench && (
            <button
              onClick={onOpenWorkbench}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-code hover:bg-code-bg transition-colors"
            >
              <Maximize2 size={13} /> 상세 검토
            </button>
          )}
        </div>
      </>}

      </>}

      {/* ══════ 반영 탭 ══════ */}
      {activeDetailTab === 'apply' && hasTuningData && selectedPlan && (
        <ApplyTab item={item} selectedPlan={selectedPlan} />
      )}

      {/* ══════ 이력 탭 ══════ */}
      {activeDetailTab === 'history' && (
        <HistoryTab workItemId={item.id} />
      )}

      {/* ══════ 운영효과 탭 ══════ */}
      {activeDetailTab === 'ops' && (
        <OpsEffectTab item={localItem} onAfterSqlFound={handleAfterSqlFound} />
      )}

      {/* 상세 검토 버튼 — approval_pending 외 상태 (approval_pending은 스티키바에 포함) */}
      {onOpenWorkbench && status !== 'approval_pending' && (
        <div className="mt-6 -mx-6 px-6 py-3 border-t border-border">
          <button
            onClick={onOpenWorkbench}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-code hover:bg-code-bg transition-colors"
          >
            <Maximize2 size={13} /> 상세 검토
          </button>
        </div>
      )}

    </div>
  )
}

// ─── 워크벤치용 named exports ──────────────────────
export {
  AIRationale,
  BindSection,
  CompareSection,
  ApplyTab,
  HistoryTab,
  OpsEffectTab,
  BeforeInfoSection,
  TuningProgressCard,
  highlightSQL,
  PlanTable,
  PlanDiffTable,
  CopyButton as WdCopyButton,
  TYPE_COLORS as TUNING_TYPE_COLORS,
  formatNumber as wdFormatNumber,
  formatMs as wdFormatMs,
  calcChangeRate as wdCalcChangeRate,
}
