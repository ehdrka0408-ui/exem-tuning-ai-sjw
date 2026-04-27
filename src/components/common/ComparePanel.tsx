import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Maximize2, Minimize2, FileText, Copy, Check, Braces } from 'lucide-react'
import { highlightSQL } from '../../utils/sqlHighlight'
import {
  type DiffLine, DIFF_STYLES, DIFF_TEXT,
  computeLineDiff, computePlanDiff, formatSQLText,
} from '../../utils/sqlDiff'
import { useEscStack } from '../../utils/escStack'
import { getViewport } from '../../utils/viewport'
import { type BindSet } from '../../mocks/executionValidation'

// ─── Types ─────────────────────────────────────
export type CompareScope = 'sql' | 'plan' | 'before' | 'after' | 'all'

export type ComparePanelMode =
  | { type: 'single'; target: 'sql-before' | 'sql-after' | 'plan-before' | 'plan-after' }
  | { type: 'compare'; scope: CompareScope }

export interface ComparePanelData {
  sqlBefore: string
  sqlAfter: string
  planBefore: string
  planAfter: string
}

interface Props {
  onClose: () => void
  mode: ComparePanelMode
  data: ComparePanelData
  bindSets?: BindSet[]
  usedBindSetId?: string
}

// ─── Constants ─────────────────────────────────
const EDGE = 6
const MIN_W = 400
const MIN_H = 350
type EdgeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const SCOPE_GROUPS: { key: CompareScope; label: string }[][] = [
  [{ key: 'sql', label: 'SQL' }, { key: 'plan', label: 'Plan' }],
  [{ key: 'before', label: 'Before' }, { key: 'after', label: 'After' }],
  [{ key: 'all', label: 'All' }],
]

const SINGLE_LABELS: Record<string, string> = {
  'sql-before': 'SQL — Before',
  'sql-after': 'SQL — After',
  'plan-before': 'Plan — Before',
  'plan-after': 'Plan — After',
}

function getInitialGeometry(mode: ComparePanelMode) {
  const { w: vw, h: vh } = getViewport()
  if (mode.type === 'single') {
    const w = Math.min(700, vw * 0.5)
    const h = Math.min(550, vh * 0.7)
    return { w, h, x: (vw - w) / 2, y: (vh - h) / 2, maximized: false }
  }
  if (mode.scope === 'all') {
    const w = Math.round(vw * 0.9)
    const h = Math.round(vh * 0.9)
    return { w, h, x: Math.round((vw - w) / 2), y: Math.round((vh - h) / 2), maximized: false }
  }
  const w = Math.min(1100, vw * 0.75)
  const h = Math.min(700, vh * 0.8)
  return { w, h, x: (vw - w) / 2, y: (vh - h) / 2, maximized: false }
}

// ─── Plan parsing ──────────────────────────────
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

// ─── PlanTable ─────────────────────────────────
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
    </div>
  )
}

// ─── PlanDiffTable ─────────────────────────────
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
      if (line.type === 'spacer') { if (inTable || foundHeader) tableLines.push({ ...line, isTable: true, cells: [] }); continue }
      if (/^Predicate Information/i.test(line.text.trim())) { inPredicate = true; inTable = false; continue }
      if (inPredicate) { if (/^-+$/.test(line.text.trim())) continue; if (line.text.trim()) predicateLines.push(line); continue }
      if (!foundHeader && /^\|\s*Id\s*\|/.test(line.text)) {
        headerCols.push(...line.text.split('|').filter(p => p.trim() !== '').map(p => p.trim()))
        foundHeader = true; inTable = true; continue
      }
      if (inTable && /^-+$/.test(line.text)) continue
      if (inTable && /^\|/.test(line.text)) {
        const parts = line.text.split('|').filter(p => p !== '')
        tableLines.push({ ...line, isTable: true, cells: parts.map((p, ci) => ci === 1 ? p.replace(/\s+$/, '') : p.trim()) })
      } else if (!foundHeader) preLines.push({ ...line, isTable: false })
    }
    return { preLines, headerCols, tableLines, predicateLines }
  }, [lines])

  return (
    <div className="text-xs font-mono">
      {parsed.preLines.map((line, i) => (
        <div key={i} className={`px-1 ${DIFF_STYLES[line.type]} ${DIFF_TEXT[line.type]} rounded-sm`}>{line.text}</div>
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
                <tr key={ri} className={`border-b border-surface-muted ${DIFF_STYLES[row.type]}`}>
                  {row.type === 'spacer' ? (
                    <td colSpan={parsed.headerCols.length} className="px-2 py-0.5">&nbsp;</td>
                  ) : parsed.headerCols.map((_, ci) => (
                    <td key={ci} className={`px-2 py-0.5 whitespace-pre ${ci === 0 ? 'text-right w-8' : ''} ${
                      row.type !== 'equal' && ci === 1 ? `font-semibold ${DIFF_TEXT[row.type]}` :
                      row.type !== 'equal' ? DIFF_TEXT[row.type] : ''
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
            <div key={i} className={`text-[10px] leading-relaxed px-1 rounded-sm ${DIFF_STYLES[line.type]} ${DIFF_TEXT[line.type]}`}>{line.text}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ────────────────────────────
export default function ComparePanel({ onClose, mode, data, bindSets, usedBindSetId }: Props) {
  // Geometry
  const initial = useMemo(() => getInitialGeometry(mode), [])
  const [pos, setPos] = useState({ x: initial.x, y: initial.y })
  const [size, setSize] = useState({ w: initial.w, h: initial.h })
  const [maximized, setMaximized] = useState(initial.maximized)
  const prevGeo = useRef({ pos: { x: initial.x, y: initial.y }, size: { w: initial.w, h: initial.h } })

  // Content state
  const [scope, setScope] = useState<CompareScope>(mode.type === 'compare' ? mode.scope : 'sql')
  const [singleTarget, setSingleTarget] = useState<'sql-before' | 'sql-after' | 'plan-before' | 'plan-after' | null>(null)
  const [formatted, setFormatted] = useState(true)
  const [sqlDiffOn, setSqlDiffOn] = useState(false)
  const [planDiffOn, setPlanDiffOn] = useState(false)
  const [aiInsightOpen, setAiInsightOpen] = useState(false)
  const [bindOpen, setBindOpen] = useState(false)
  const [aiSize, setAiSize] = useState({ w: 380, h: 0 })
  const [bindSize, setBindSize] = useState({ w: 480, h: 0 })
  const aiResizeRef = useRef<{ sx: number; sy: number; ow: number; oh: number; dir: string } | null>(null)
  const bindResizeRef = useRef<{ sx: number; sy: number; ow: number; oh: number; dir: string } | null>(null)
  const aiUseAutoH = aiSize.h === 0 // h=0 means auto (fit content / max-h-full)
  const bindUseAutoH = bindSize.h === 0

  // Split divider (for vertical layouts)
  const [splitPct, setSplitPct] = useState(40)
  const [userDragged, setUserDragged] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Computed
  const fmtBefore = useMemo(() => formatted ? formatSQLText(data.sqlBefore) : data.sqlBefore, [data.sqlBefore, formatted])
  const fmtAfter = useMemo(() => formatted ? formatSQLText(data.sqlAfter) : data.sqlAfter, [data.sqlAfter, formatted])
  const sqlDiff = useMemo(() => computeLineDiff(fmtBefore, fmtAfter), [fmtBefore, fmtAfter])
  const planDiff = useMemo(() => computePlanDiff(data.planBefore, data.planAfter), [data.planBefore, data.planAfter])

  const showSql = singleTarget ? singleTarget.startsWith('sql') : mode.type === 'single' ? mode.target.startsWith('sql') : scope !== 'plan'
  const showPlan = singleTarget ? singleTarget.startsWith('plan') : mode.type === 'single' ? mode.target.startsWith('plan') : scope !== 'sql'

  // Bind pivot data
  const bindVarNames = useMemo(() => bindSets?.[0]?.variables.map(v => v.name) || [], [bindSets])
  const bindSortedVars = useMemo(() => {
    if (!bindSets || bindSets.length === 0) return []
    const counts = bindVarNames.map(name => {
      const vals = new Set(bindSets.map(s => s.variables.find(v => v.name === name)?.value || ''))
      return { name, unique: vals.size }
    })
    return counts.sort((a, b) => b.unique - a.unique)
  }, [bindVarNames, bindSets])
  const formatBindTime = (iso: string) => {
    const d = new Date(iso)
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  // Auto-split for "all" scope
  useEffect(() => {
    if (userDragged || scope !== 'all') return
    const maxLines = Math.max(fmtBefore.split('\n').length, fmtAfter.split('\n').length)
    setSplitPct(Math.max(12, Math.min(50, maxLines * 2 + 8)))
  }, [fmtBefore, fmtAfter, scope, userDragged])

  // Esc: drill-down 단계가 있으면 먼저 빠져나가고, 없으면 패널 닫기
  useEscStack(true, useCallback(() => {
    if (singleTarget) setSingleTarget(null)
    else onClose()
  }, [singleTarget, onClose]))

  // Maximize toggle
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

  // Drag
  const dragRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null)
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
  }, [pos, maximized])

  // Edge resize
  const edgeRef = useRef<{ sx: number; sy: number; ox: number; oy: number; ow: number; oh: number; dir: EdgeDir } | null>(null)
  const onEdge = useCallback((dir: EdgeDir, e: React.MouseEvent) => {
    if (maximized) return
    e.preventDefault(); e.stopPropagation()
    edgeRef.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, ow: size.w, oh: size.h, dir }
    const move = (ev: MouseEvent) => {
      if (!edgeRef.current) return
      const r = edgeRef.current, dx = ev.clientX - r.sx, dy = ev.clientY - r.sy
      let nx = r.ox, ny = r.oy, nw = r.ow, nh = r.oh
      if (r.dir.includes('e')) nw = Math.max(MIN_W, r.ow + dx)
      if (r.dir.includes('s')) nh = Math.max(MIN_H, r.oh + dy)
      if (r.dir.includes('w')) { const w2 = Math.max(MIN_W, r.ow - dx); nx = r.ox + (r.ow - w2); nw = w2 }
      if (r.dir.includes('n')) { const h2 = Math.max(MIN_H, r.oh - dy); ny = r.oy + (r.oh - h2); nh = h2 }
      setPos({ x: nx, y: ny }); setSize({ w: nw, h: nh })
    }
    const up = () => { edgeRef.current = null; document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }, [pos, size, maximized])

  // ─── Copy helper ────────────────────────────
  const CopyBtn = ({ text: copyText }: { text: string }) => {
    const [copied, setCopied] = useState(false)
    const handleCopy = () => {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(copyText).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => fallback())
      } else fallback()
    }
    const fallback = () => {
      const ta = document.createElement('textarea')
      ta.value = copyText; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
      setCopied(true); setTimeout(() => setCopied(false), 1500)
    }
    return (
      <button onClick={handleCopy} className="p-1 rounded text-text-muted hover:text-text-secondary hover:bg-surface-muted transition-colors" title="Copy">
        {copied ? <Check size={11} /> : <Copy size={11} />}
      </button>
    )
  }

  // ─── Panel renderers ─────────────────────────
  const renderSqlPanel = (label: string, text: string, diffLines?: DiffLine[], target?: 'sql-before' | 'sql-after') => (
    <div className="flex flex-col bg-white overflow-hidden min-h-0">
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-surface-muted">
        <div className="w-0.5 h-3.5 rounded-full bg-border shrink-0" />
        <span className="text-[11px] font-semibold text-text-secondary">{label}</span>
        <div className="flex items-center gap-0.5 ml-auto">
          <CopyBtn text={formatted ? text : data.sqlBefore === text ? data.sqlBefore : data.sqlAfter} />
          {mode.type === 'compare' && target && !singleTarget && (
            <button onClick={() => setSingleTarget(target)} className="p-1 rounded text-text-muted hover:text-text-secondary hover:bg-surface-muted transition-colors" title="전체 보기">
              <Maximize2 size={11} />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {sqlDiffOn && diffLines ? (
          <div className="text-xs font-mono leading-relaxed">
            {diffLines.map((line, i) => (
              <div key={i} className={`px-1 -mx-1 rounded-sm whitespace-pre-wrap ${DIFF_STYLES[line.type]}`}>
                <span className={DIFF_TEXT[line.type]}>{line.type === 'equal' ? highlightSQL(line.text) : line.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <pre className="text-xs font-mono whitespace-pre-wrap text-text-primary">{highlightSQL(text)}</pre>
        )}
      </div>
    </div>
  )

  const renderPlanPanel = (label: string, text: string, diffLines?: DiffLine[], target?: 'plan-before' | 'plan-after') => (
    <div className="flex flex-col bg-white overflow-hidden min-h-0">
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-surface-muted">
        <div className="w-0.5 h-3.5 rounded-full bg-border shrink-0" />
        <span className="text-[11px] font-semibold text-text-secondary">{label}</span>
        <div className="flex items-center gap-0.5 ml-auto">
          <CopyBtn text={text} />
          {mode.type === 'compare' && target && !singleTarget && (
            <button onClick={() => setSingleTarget(target)} className="p-1 rounded text-text-muted hover:text-text-secondary hover:bg-surface-muted transition-colors" title="전체 보기">
              <Maximize2 size={11} />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {planDiffOn && diffLines ? <PlanDiffTable lines={diffLines} /> : <PlanTable text={text} />}
      </div>
    </div>
  )

  // ─── Divider for vertical splits ─────────────
  const renderDivider = () => (
    <div
      className="h-1.5 shrink-0 flex items-center justify-center cursor-row-resize hover:bg-surface-muted bg-surface-alt border-y border-border transition-colors group select-none"
      onMouseDown={(e) => {
        e.preventDefault()
        setUserDragged(true)
        const startY = e.clientY, startPct = splitPct
        const container = containerRef.current
        if (!container) return
        const move = (ev: MouseEvent) => { setSplitPct(Math.max(10, Math.min(80, startPct + ((ev.clientY - startY) / container.clientHeight) * 100))) }
        const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }
        document.addEventListener('mousemove', move)
        document.addEventListener('mouseup', up)
      }}
    >
      <div className="w-8 h-[2px] rounded-full bg-border group-hover:bg-text-muted transition-colors" />
    </div>
  )

  // ─── Content by scope ────────────────────────
  const renderContent = () => {
    // Drill-down: single panel within compare (or original single mode)
    if (singleTarget || mode.type === 'single') {
      const t = singleTarget || (mode.type === 'single' ? mode.target : null)
      if (t === 'sql-before') return <div className="flex-1 min-h-0 overflow-hidden">{renderSqlPanel('SQL — Before', fmtBefore)}</div>
      if (t === 'sql-after') return <div className="flex-1 min-h-0 overflow-hidden">{renderSqlPanel('SQL — After', fmtAfter)}</div>
      if (t === 'plan-before') return <div className="flex-1 min-h-0 overflow-hidden">{renderPlanPanel('Plan — Before', data.planBefore)}</div>
      if (t === 'plan-after') return <div className="flex-1 min-h-0 overflow-hidden">{renderPlanPanel('Plan — After', data.planAfter)}</div>
      return null
    }

    // Compare: side by side (type-grouped)
    if (scope === 'sql') {
      return (
        <div className="flex-1 grid grid-cols-2 min-h-0 divide-x divide-border">
          {renderSqlPanel('Before', fmtBefore, sqlDiff?.leftLines, 'sql-before')}
          {renderSqlPanel('After', fmtAfter, sqlDiff?.rightLines, 'sql-after')}
        </div>
      )
    }
    if (scope === 'plan') {
      return (
        <div className="flex-1 grid grid-cols-2 min-h-0 divide-x divide-border">
          {renderPlanPanel('Before', data.planBefore, planDiff?.leftLines, 'plan-before')}
          {renderPlanPanel('After', data.planAfter, planDiff?.rightLines, 'plan-after')}
        </div>
      )
    }

    // Compare: top/bottom (time-grouped)
    if (scope === 'before') {
      return (
        <div ref={containerRef} className="flex-1 flex flex-col min-h-0">
          <div className="flex flex-col shrink-0 overflow-hidden" style={{ height: `${splitPct}%`, minHeight: 60 }}>
            {renderSqlPanel('SQL', fmtBefore, sqlDiff?.leftLines, 'sql-before')}
          </div>
          {renderDivider()}
          <div className="flex flex-col flex-1 overflow-hidden" style={{ minHeight: 60 }}>
            {renderPlanPanel('Plan', data.planBefore, planDiff?.leftLines, 'plan-before')}
          </div>
        </div>
      )
    }
    if (scope === 'after') {
      return (
        <div ref={containerRef} className="flex-1 flex flex-col min-h-0">
          <div className="flex flex-col shrink-0 overflow-hidden" style={{ height: `${splitPct}%`, minHeight: 60 }}>
            {renderSqlPanel('SQL', fmtAfter, sqlDiff?.rightLines, 'sql-after')}
          </div>
          {renderDivider()}
          <div className="flex flex-col flex-1 overflow-hidden" style={{ minHeight: 60 }}>
            {renderPlanPanel('Plan', data.planAfter, planDiff?.rightLines, 'plan-after')}
          </div>
        </div>
      )
    }

    // Compare: 4-panel (all)
    return (
      <div ref={containerRef} className="flex-1 flex flex-col min-h-0">
        <div className="flex flex-col shrink-0" style={{ height: `${splitPct}%`, minHeight: 60 }}>
          <div className="flex items-center gap-1.5 px-3 py-1 shrink-0 border-b border-border">
            <div className="w-0.5 h-3.5 rounded-full bg-text-muted shrink-0" />
            <span className="text-[11px] font-semibold text-text-secondary uppercase">SQL</span>
          </div>
          <div className="flex-1 grid grid-cols-2 overflow-hidden divide-x divide-border" style={{ minHeight: 0 }}>
            {renderSqlPanel('Before', fmtBefore, sqlDiff?.leftLines, 'sql-before')}
            {renderSqlPanel('After', fmtAfter, sqlDiff?.rightLines, 'sql-after')}
          </div>
        </div>
        {renderDivider()}
        <div className="flex flex-col flex-1" style={{ minHeight: 60, overflow: 'hidden' }}>
          <div className="flex items-center gap-1.5 px-3 py-1 shrink-0 border-b border-border">
            <div className="w-0.5 h-3.5 rounded-full bg-text-muted shrink-0" />
            <span className="text-[11px] font-semibold text-text-secondary uppercase">Plan</span>
          </div>
          <div className="flex-1 grid grid-cols-2 overflow-hidden divide-x divide-border" style={{ minHeight: 0 }}>
            {renderPlanPanel('Before', data.planBefore, planDiff?.leftLines, 'plan-before')}
            {renderPlanPanel('After', data.planAfter, planDiff?.rightLines, 'plan-after')}
          </div>
        </div>
      </div>
    )
  }

  // ─── Render ──────────────────────────────────
  return createPortal(
    <div
      className={`fixed flex flex-col bg-white shadow-2xl ${maximized ? '' : 'rounded-lg border border-border'}`}
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h, zIndex: 70 }}
    >
      {/* Header */}
      <div
        className={`flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2 ${maximized ? '' : 'cursor-move'}`}
        onMouseDown={onDrag}
      >
        {/* Left: scope toggle or title */}
        {mode.type === 'compare' ? (
          <div className="flex items-center gap-3" onMouseDown={e => e.stopPropagation()}>
            {SCOPE_GROUPS.map((group, gi) => (
              <div key={gi} className="flex items-center gap-1">
                {group.map(s => (
                  <button
                    key={s.key}
                    onClick={() => { setSingleTarget(null); setScope(s.key) }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      !singleTarget && scope === s.key ? 'bg-action text-white' : 'text-text-secondary hover:bg-surface-muted'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            ))}
            {(sqlDiffOn || planDiffOn) && !singleTarget && (
              <div className="flex items-center gap-2 text-[10px] text-text-muted">
                <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-sm bg-amber-100 border border-amber-300" />변경</span>
                <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-sm bg-emerald-100 border border-emerald-300" />추가</span>
                <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-sm bg-red-100 border border-red-300" />삭제</span>
              </div>
            )}
            {singleTarget && (
              <>
                <div className="w-px h-4 bg-border" />
                <span className="text-xs font-medium text-text-primary">{SINGLE_LABELS[singleTarget]}</span>
              </>
            )}
          </div>
        ) : (
          <h2 className="text-sm font-semibold text-text-primary select-none">{SINGLE_LABELS[mode.target] || ''}</h2>
        )}

        {/* Right: controls */}
        <div className="flex items-center gap-2 shrink-0" onMouseDown={e => e.stopPropagation()}>
          {showSql && (
            <button
              onClick={() => setFormatted(f => !f)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${formatted ? 'bg-code-bg text-code' : 'text-text-muted hover:bg-surface-muted hover:text-text-secondary'}`}
            >
              <FileText size={12} /> Format
            </button>
          )}
          {mode.type === 'compare' && !singleTarget && showSql && (
            <button
              onClick={() => setSqlDiffOn(d => !d)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${sqlDiffOn ? 'bg-code-bg text-code' : 'text-text-muted hover:bg-surface-muted hover:text-text-secondary'}`}
            >
              SQL Diff
            </button>
          )}
          {mode.type === 'compare' && !singleTarget && showPlan && (
            <button
              onClick={() => setPlanDiffOn(d => !d)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${planDiffOn ? 'bg-code-bg text-code' : 'text-text-muted hover:bg-surface-muted hover:text-text-secondary'}`}
            >
              Plan Diff
            </button>
          )}
          <div className="w-px h-4 bg-border" />
          <button
            onClick={() => { setAiInsightOpen(v => !v); setBindOpen(false) }}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              aiInsightOpen ? 'bg-code-bg text-code' : 'text-text-muted hover:bg-surface-muted hover:text-text-secondary'
            }`}
            title="AI 분석"
          >
            <div className="relative inline-flex items-center justify-center size-3.5 overflow-hidden">
              <svg className="size-3.5" viewBox="0 0 100 100" fill="none">
                <rect y="22" x="15" width="60" height="10" rx="3" fill="currentColor" />
                <rect y="45" x="15" width="40" height="10" rx="3" fill="currentColor" opacity="0.65" />
                <rect y="68" x="15" width="50" height="10" rx="3" fill="currentColor" opacity="0.4" />
              </svg>
            </div>
            AI 분석
          </button>
          {bindSets && bindSets.length > 0 && (
            <button
              onClick={() => { setBindOpen(v => !v); setAiInsightOpen(false) }}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                bindOpen ? 'bg-code-bg text-code' : 'text-text-muted hover:bg-surface-muted hover:text-text-secondary'
              }`}
              title="바인드 변수"
            >
              <Braces size={12} />
              바인드
            </button>
          )}
          <button onClick={toggleMax} className="rounded-md p-1.5 text-text-muted hover:bg-surface-muted hover:text-text-secondary transition-colors" title={maximized ? '원래 크기' : '전체화면'}>
            {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button onClick={onClose} className="rounded-md p-1.5 text-text-muted hover:bg-surface-muted hover:text-text-secondary transition-colors" title="닫기 (Esc)">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="relative flex-1 flex flex-col overflow-hidden">
        {renderContent()}

        {/* AI 분석 드롭다운 — 우측 가장자리, 리사이즈 가능 */}
        {aiInsightOpen && (
          <div
            className="absolute right-0 top-0 flex flex-col rounded-bl-lg border-l border-b border-border bg-white shadow-lg animate-[slideDown_150ms_ease-out] z-20"
            style={{ width: aiSize.w, ...(aiUseAutoH ? { maxHeight: '100%' } : { height: aiSize.h }) }}
          >
            {/* 리사이즈 핸들: 좌측 */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-code/10 transition-colors z-10"
              onMouseDown={e => {
                e.preventDefault(); e.stopPropagation()
                aiResizeRef.current = { sx: e.clientX, sy: e.clientY, ow: aiSize.w, oh: aiSize.h, dir: 'w' }
                const move = (ev: MouseEvent) => {
                  if (!aiResizeRef.current) return
                  const dx = aiResizeRef.current.sx - ev.clientX
                  setAiSize(prev => ({ ...prev, w: Math.max(280, Math.min(800, aiResizeRef.current!.ow + dx)) }))
                }
                const up = () => { aiResizeRef.current = null; document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }
                document.addEventListener('mousemove', move); document.addEventListener('mouseup', up)
              }}
            />
            {/* 리사이즈 핸들: 하단 */}
            <div
              className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-code/10 transition-colors z-10"
              onMouseDown={e => {
                e.preventDefault(); e.stopPropagation()
                const container = e.currentTarget.parentElement
                const startH = container?.clientHeight || 400
                aiResizeRef.current = { sx: e.clientX, sy: e.clientY, ow: aiSize.w, oh: startH, dir: 's' }
                const move = (ev: MouseEvent) => {
                  if (!aiResizeRef.current) return
                  const dy = ev.clientY - aiResizeRef.current.sy
                  setAiSize(prev => ({ ...prev, h: Math.max(200, aiResizeRef.current!.oh + dy) }))
                }
                const up = () => { aiResizeRef.current = null; document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }
                document.addEventListener('mousemove', move); document.addEventListener('mouseup', up)
              }}
            />
            {/* 리사이즈 핸들: 좌하단 코너 */}
            <div
              className="absolute left-0 bottom-0 w-3 h-3 cursor-nesw-resize z-20"
              onMouseDown={e => {
                e.preventDefault(); e.stopPropagation()
                const container = e.currentTarget.parentElement
                const startH = container?.clientHeight || 400
                aiResizeRef.current = { sx: e.clientX, sy: e.clientY, ow: aiSize.w, oh: startH, dir: 'sw' }
                const move = (ev: MouseEvent) => {
                  if (!aiResizeRef.current) return
                  const dx = aiResizeRef.current.sx - ev.clientX
                  const dy = ev.clientY - aiResizeRef.current.sy
                  setAiSize({
                    w: Math.max(280, Math.min(800, aiResizeRef.current.ow + dx)),
                    h: Math.max(200, aiResizeRef.current.oh + dy),
                  })
                }
                const up = () => { aiResizeRef.current = null; document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }
                document.addEventListener('mousemove', move); document.addEventListener('mouseup', up)
              }}
            />
            {/* 헤더 */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
              <div className="relative inline-flex items-center justify-center size-4 overflow-hidden text-code shrink-0">
                <svg className="size-4" viewBox="0 0 100 100" fill="none">
                  <rect y="22" x="15" width="60" height="10" rx="3" fill="currentColor" />
                  <rect y="45" x="15" width="40" height="10" rx="3" fill="currentColor" opacity="0.65" />
                  <rect y="68" x="15" width="50" height="10" rx="3" fill="currentColor" opacity="0.4" />
                </svg>
              </div>
              <span className="text-[13px] font-semibold text-text-primary">AI 튜닝 분석</span>
              <span className="rounded-full bg-code-bg px-2 py-0.5 text-[10px] font-medium text-code">자동 생성</span>
              <button
                onClick={() => setAiInsightOpen(false)}
                className="ml-auto rounded-md p-1 text-text-muted hover:bg-surface-muted hover:text-text-secondary transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* 본문 */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              <div className="rounded-lg bg-surface-alt px-3 py-2.5">
                <p className="text-[12px] font-medium text-text-primary leading-relaxed">
                  Full Table Scan → Index Range Scan 전환으로 논리적 I/O를 <span className="font-bold text-code">87%</span> 절감.
                  힌트 추가 및 조건절 순서 변경.
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">변경 포인트</span>
                <div className="rounded-md border border-border px-3 py-2 space-y-1">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[9px] font-bold text-emerald-700">1</span>
                    <div>
                      <p className="text-[12px] font-medium text-text-primary">INDEX 힌트 추가</p>
                      <p className="text-[11px] text-text-muted leading-relaxed mt-0.5">
                        <code className="text-code bg-code-bg px-1 rounded text-[10px]">/*+ INDEX(e idx_dept_id) */</code> 추가. dept_id 조건에 대해 Full Scan 회피.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-md border border-border px-3 py-2 space-y-1">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[9px] font-bold text-amber-700">2</span>
                    <div>
                      <p className="text-[12px] font-medium text-text-primary">WHERE 조건 순서 변경</p>
                      <p className="text-[11px] text-text-muted leading-relaxed mt-0.5">
                        선택도가 높은 <code className="text-code bg-code-bg px-1 rounded text-[10px]">dept_id = :1</code>을 앞으로 이동하여 옵티마이저 판단 유도.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-md border border-border px-3 py-2 space-y-1">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[9px] font-bold text-emerald-700">3</span>
                    <div>
                      <p className="text-[12px] font-medium text-text-primary">서브쿼리 → 조인 변환</p>
                      <p className="text-[11px] text-text-muted leading-relaxed mt-0.5">
                        IN 서브쿼리를 INNER JOIN으로 변환. Nested Loop 제거 → Hash Join.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">예상 효과</span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-surface-alt px-2.5 py-2 text-center">
                    <div className="text-[10px] text-text-muted">수행시간</div>
                    <div className="text-[15px] font-bold text-code">-72%</div>
                    <div className="text-[10px] text-text-muted mt-0.5">1.82s → 0.51s</div>
                  </div>
                  <div className="rounded-md bg-surface-alt px-2.5 py-2 text-center">
                    <div className="text-[10px] text-text-muted">블록 I/O</div>
                    <div className="text-[15px] font-bold text-code">-87%</div>
                    <div className="text-[10px] text-text-muted mt-0.5">24,310 → 3,160</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 바인드 변수 피벗 드롭다운 — 우측 가장자리 */}
        {bindOpen && bindSets && bindSets.length > 0 && (
          <div
            className="absolute right-0 top-0 flex flex-col rounded-bl-lg border-l border-b border-border bg-white shadow-lg animate-[slideDown_150ms_ease-out] z-20"
            style={{ width: bindSize.w, ...(bindUseAutoH ? { maxHeight: '100%' } : { height: bindSize.h }) }}
          >
            {/* 리사이즈 핸들: 좌측 */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-code/10 transition-colors z-10"
              onMouseDown={e => {
                e.preventDefault(); e.stopPropagation()
                bindResizeRef.current = { sx: e.clientX, sy: e.clientY, ow: bindSize.w, oh: bindSize.h, dir: 'w' }
                const move = (ev: MouseEvent) => {
                  if (!bindResizeRef.current) return
                  const dx = bindResizeRef.current.sx - ev.clientX
                  setBindSize(prev => ({ ...prev, w: Math.max(320, Math.min(900, bindResizeRef.current!.ow + dx)) }))
                }
                const up = () => { bindResizeRef.current = null; document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }
                document.addEventListener('mousemove', move); document.addEventListener('mouseup', up)
              }}
            />
            {/* 리사이즈 핸들: 하단 */}
            <div
              className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-code/10 transition-colors z-10"
              onMouseDown={e => {
                e.preventDefault(); e.stopPropagation()
                const container = e.currentTarget.parentElement
                const startH = container?.clientHeight || 400
                bindResizeRef.current = { sx: e.clientX, sy: e.clientY, ow: bindSize.w, oh: startH, dir: 's' }
                const move = (ev: MouseEvent) => {
                  if (!bindResizeRef.current) return
                  const dy = ev.clientY - bindResizeRef.current.sy
                  setBindSize(prev => ({ ...prev, h: Math.max(200, bindResizeRef.current!.oh + dy) }))
                }
                const up = () => { bindResizeRef.current = null; document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }
                document.addEventListener('mousemove', move); document.addEventListener('mouseup', up)
              }}
            />
            {/* 리사이즈 핸들: 좌하단 코너 */}
            <div
              className="absolute left-0 bottom-0 w-3 h-3 cursor-nesw-resize z-20"
              onMouseDown={e => {
                e.preventDefault(); e.stopPropagation()
                const container = e.currentTarget.parentElement
                const startH = container?.clientHeight || 400
                bindResizeRef.current = { sx: e.clientX, sy: e.clientY, ow: bindSize.w, oh: startH, dir: 'sw' }
                const move = (ev: MouseEvent) => {
                  if (!bindResizeRef.current) return
                  const dx = bindResizeRef.current.sx - ev.clientX
                  const dy = ev.clientY - bindResizeRef.current.sy
                  setBindSize({
                    w: Math.max(320, Math.min(900, bindResizeRef.current.ow + dx)),
                    h: Math.max(200, bindResizeRef.current.oh + dy),
                  })
                }
                const up = () => { bindResizeRef.current = null; document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }
                document.addEventListener('mousemove', move); document.addEventListener('mouseup', up)
              }}
            />
            {/* 헤더 */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
              <Braces size={14} className="text-code shrink-0" />
              <span className="text-[13px] font-semibold text-text-primary">바인드 변수 시계열</span>
              <span className="text-[10px] text-text-muted">{bindSets.length}세트 · {bindSortedVars.length}변수</span>
              <div className="flex items-center gap-1.5 ml-auto mr-2 text-[10px] text-text-muted">
                <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-sm bg-code-bg border border-code/30" />AI 테스트</span>
                <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-sm bg-warning-bg border border-warning/30" />값 변동</span>
              </div>
              <button
                onClick={() => setBindOpen(false)}
                className="rounded-md p-1 text-text-muted hover:bg-surface-muted hover:text-text-secondary transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* 피벗 테이블 */}
            <div className="flex-1 overflow-auto">
              <table className="text-xs font-mono border-collapse min-w-max">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr>
                    <th className="sticky left-0 z-20 bg-surface-alt px-3 py-1.5 text-left text-[10px] font-semibold text-text-secondary border-b border-r border-border whitespace-nowrap">
                      변수명
                    </th>
                    {bindSets.map(set => {
                      const isUsed = set.id === usedBindSetId
                      return (
                        <th
                          key={set.id}
                          className={`px-2.5 py-1.5 text-center text-[10px] font-medium border-b border-border whitespace-nowrap ${
                            isUsed ? 'bg-code-bg text-code' : 'bg-surface-alt text-text-secondary'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>{formatBindTime(set.capturedAt)}</span>
                            <CopyBtn text={set.variables.map(v => `:${v.name} = '${v.value}'`).join('\n')} />
                          </div>
                          <div className={`text-[9px] ${isUsed ? 'text-code/70' : 'text-text-muted'}`}>{set.source}{isUsed ? ' ★' : ''}</div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {bindSortedVars.map(({ name, unique }) => {
                    const isVariable = unique > 1
                    const usedVal = bindSets.find(s => s.id === usedBindSetId)?.variables.find(x => x.name === name)?.value || ''
                    return (
                      <tr key={name} className={`border-b border-surface-muted ${isVariable ? '' : 'opacity-50'}`}>
                        <td className={`sticky left-0 z-10 px-3 py-1 border-r border-border whitespace-nowrap font-medium ${
                          isVariable ? 'bg-warning-bg/30 text-text-primary' : 'bg-surface-alt text-text-muted'
                        }`}>
                          {name}
                          {isVariable && <span className="ml-1 text-[9px] text-warning-dark">({unique})</span>}
                        </td>
                        {bindSets.map(set => {
                          const v = set.variables.find(x => x.name === name)
                          const val = v?.value || ''
                          const isUsed = set.id === usedBindSetId
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
          </div>
        )}
      </div>

      {/* Resize handles */}
      {!maximized && (
        <>
          <div className="absolute" style={{ top: 0, left: EDGE, right: EDGE, height: EDGE, cursor: 'ns-resize' }} onMouseDown={e => onEdge('n', e)} />
          <div className="absolute" style={{ bottom: 0, left: EDGE, right: EDGE, height: EDGE, cursor: 'ns-resize' }} onMouseDown={e => onEdge('s', e)} />
          <div className="absolute" style={{ left: 0, top: EDGE, bottom: EDGE, width: EDGE, cursor: 'ew-resize' }} onMouseDown={e => onEdge('w', e)} />
          <div className="absolute" style={{ right: 0, top: EDGE, bottom: EDGE, width: EDGE, cursor: 'ew-resize' }} onMouseDown={e => onEdge('e', e)} />
          <div className="absolute" style={{ top: 0, left: 0, width: EDGE, height: EDGE, cursor: 'nwse-resize' }} onMouseDown={e => onEdge('nw', e)} />
          <div className="absolute" style={{ top: 0, right: 0, width: EDGE, height: EDGE, cursor: 'nesw-resize' }} onMouseDown={e => onEdge('ne', e)} />
          <div className="absolute" style={{ bottom: 0, left: 0, width: EDGE, height: EDGE, cursor: 'nesw-resize' }} onMouseDown={e => onEdge('sw', e)} />
          <div className="absolute" style={{ bottom: 0, right: 0, width: EDGE, height: EDGE, cursor: 'nwse-resize' }} onMouseDown={e => onEdge('se', e)} />
        </>
      )}
    </div>,
    document.body
  )
}
