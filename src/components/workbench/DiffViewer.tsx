import { useState, useRef, useCallback, useMemo } from 'react'
import { Copy, Check } from 'lucide-react'
import { highlightSQL } from '../../utils/sqlHighlight'
import {
  type DiffLine, DIFF_STYLES, DIFF_TEXT,
  computeLineDiff, computePlanDiff, computeDiffStats, formatSQLText,
} from '../../utils/sqlDiff'

export type ViewMode = 'sql+plan' | 'sql' | 'plan' | 'before' | 'after'

interface Props {
  sqlBefore: string
  sqlAfter: string
  planBefore: string
  planAfter: string
  viewMode: ViewMode
  formatted?: boolean
  diffOn?: boolean
}

/* ─── Render line content with word-level highlighting ─── */
function renderContent(line: DiffLine, isSql: boolean, showDiff: boolean) {
  if (!showDiff) {
    return isSql ? highlightSQL(line.text) : line.text
  }
  if (line.wordSegments && line.wordSegments.length > 0) {
    return line.wordSegments.map((seg, i) => {
      if (seg.type === 'equal') {
        return <span key={i}>{isSql ? highlightSQL(seg.text) : seg.text}</span>
      }
      const cls = seg.type === 'removed'
        ? 'bg-red-200/70 rounded-[2px] px-[1px]'
        : 'bg-emerald-200/70 rounded-[2px] px-[1px]'
      return <span key={i} className={cls}>{seg.text}</span>
    })
  }
  const textCls = DIFF_TEXT[line.type]
  if (textCls) {
    return <span className={textCls}>{isSql ? highlightSQL(line.text) : line.text}</span>
  }
  return isSql ? highlightSQL(line.text) : line.text
}

/* ─── Single line cell ─── */
function DiffLineCell({ line, isSql, showDiff }: {
  line?: DiffLine; isSql: boolean; showDiff: boolean
}) {
  if (!line || line.type === 'spacer') {
    return (
      <div className="flex min-h-[22px] bg-surface-alt/30">
        <span className="w-9 shrink-0" />
        <span className="whitespace-pre"> </span>
      </div>
    )
  }
  const bg = showDiff ? DIFF_STYLES[line.type] : ''
  const prefix = !showDiff ? ' '
    : line.type === 'removed' ? '−'
    : line.type === 'added' ? '+'
    : line.type === 'modified' ? '≠'
    : ' '
  const prefixCls = !showDiff ? 'text-transparent'
    : line.type === 'removed' ? 'text-red-400'
    : line.type === 'added' ? 'text-emerald-500'
    : line.type === 'modified' ? 'text-blue-400'
    : 'text-transparent'

  return (
    <div className={`flex min-h-[22px] ${bg}`}>
      <span className="w-[22px] shrink-0 text-right text-[10px] text-text-muted/40 leading-[22px] select-none pr-0.5 tabular-nums">
        {line.num || ''}
      </span>
      <span className={`w-3.5 shrink-0 text-center text-[10px] leading-[22px] select-none ${prefixCls}`}>
        {prefix}
      </span>
      <span className="pr-3 font-mono text-[11.5px] leading-[22px] whitespace-pre">
        {renderContent(line, isSql, showDiff)}
      </span>
    </div>
  )
}

/* ─── PlanTable: structured plan rendering ─── */
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
    <div className="text-xs font-mono p-2">
      {parsed.preLines.filter(l => l.trim()).length > 0 && (
        <div className="text-text-secondary mb-2 leading-relaxed">
          {parsed.preLines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
      {parsed.headers.length > 0 && (
        <div className="overflow-x-auto">
          <table className="border-collapse w-full min-w-max">
            <thead>
              <tr className="border-b border-border bg-surface-alt">
                {parsed.headers.map((h, i) => (
                  <th key={i} className={`px-2 py-1 text-left text-[11px] font-semibold text-text-secondary whitespace-nowrap ${i > 0 ? 'border-l border-border' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsed.rows.map((row, ri) => {
                const bar = getBarColor(row)
                return (
                  <tr key={ri} className="border-b border-surface-muted hover:bg-surface-alt/50">
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
          <div className="text-[11px] font-semibold text-text-secondary mb-1.5">Predicate Information:</div>
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

/* ─── DiffPane: Two-column layout with synchronized vertical scroll ─── */
function DiffPane({ title, leftLines, rightLines, rawLeft, rawRight, isSql, showDiff, planStructured }: {
  title: string
  leftLines: DiffLine[]
  rightLines: DiffLine[]
  rawLeft: string
  rawRight: string
  isSql: boolean
  showDiff: boolean
  planStructured?: boolean
}) {
  const [copied, setCopied] = useState<'left' | 'right' | null>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const syncing = useRef(false)

  const handleCopy = useCallback((side: 'left' | 'right') => {
    navigator.clipboard.writeText(side === 'left' ? rawLeft : rawRight)
    setCopied(side)
    setTimeout(() => setCopied(null), 1500)
  }, [rawLeft, rawRight])

  const handleScroll = useCallback((source: 'left' | 'right') => {
    if (syncing.current) return
    syncing.current = true
    const src = source === 'left' ? leftRef.current : rightRef.current
    const dst = source === 'left' ? rightRef.current : leftRef.current
    if (src && dst) {
      dst.scrollTop = src.scrollTop
    }
    requestAnimationFrame(() => { syncing.current = false })
  }, [])

  const stats = computeDiffStats(leftLines, rightLines)
  const usePlanTable = planStructured && !isSql && !showDiff

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Column headers */}
      <div className="flex shrink-0 border-b border-border text-[11px]">
        <div className="flex-1 flex items-center justify-between px-3 py-1.5 border-r border-border min-w-0">
          <span className="flex items-center gap-1.5 font-medium text-text-secondary">
            <span className="w-[3px] h-3 rounded-full bg-red-400 shrink-0" />
            Before {title}
            <span className="text-[11px] text-text-muted font-normal">{stats.totalLeft} lines</span>
          </span>
          <button onClick={() => handleCopy('left')} className="p-0.5 text-text-muted hover:text-text-primary transition-colors shrink-0 ml-1">
            {copied === 'left' ? <Check size={11} className="text-success" /> : <Copy size={11} />}
          </button>
        </div>
        <div className="flex-1 flex items-center justify-between px-3 py-1.5 min-w-0">
          <span className="flex items-center gap-1.5 font-medium text-text-secondary">
            <span className="w-[3px] h-3 rounded-full bg-emerald-500 shrink-0" />
            After {title}
            <span className="text-[11px] text-text-muted font-normal">{stats.totalRight} lines</span>
            {showDiff && (stats.added > 0 || stats.removed > 0 || stats.modified > 0) && (
              <span className="ml-0.5 flex items-center gap-1 text-[11px] font-normal">
                {stats.modified > 0 && <span className="text-blue-600">~{stats.modified}</span>}
                {stats.added > 0 && <span className="text-emerald-600">+{stats.added}</span>}
                {stats.removed > 0 && <span className="text-red-500">&minus;{stats.removed}</span>}
              </span>
            )}
          </span>
          <button onClick={() => handleCopy('right')} className="p-0.5 text-text-muted hover:text-text-primary transition-colors shrink-0 ml-1">
            {copied === 'right' ? <Check size={11} className="text-success" /> : <Copy size={11} />}
          </button>
        </div>
      </div>

      {/* Two-column scrollable */}
      <div className="flex flex-1 min-h-0">
        <div
          ref={leftRef}
          className="flex-1 overflow-auto min-w-0 border-r border-border"
          onScroll={() => !usePlanTable && handleScroll('left')}
        >
          {usePlanTable ? (
            <PlanTable text={rawLeft} />
          ) : (
            leftLines.map((line, i) => (
              <DiffLineCell key={i} line={line} isSql={isSql} showDiff={showDiff} />
            ))
          )}
        </div>
        <div
          ref={rightRef}
          className="flex-1 overflow-auto min-w-0"
          onScroll={() => !usePlanTable && handleScroll('right')}
        >
          {usePlanTable ? (
            <PlanTable text={rawRight} />
          ) : (
            rightLines.map((line, i) => (
              <DiffLineCell key={i} line={line} isSql={isSql} showDiff={showDiff} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── SinglePane: Before-only or After-only (SQL + Plan vertical stack) ─── */
function SinglePane({ planText, rawSql, isBefore, formatted }: {
  planText: string; rawSql: string; isBefore: boolean; formatted: boolean
}) {
  const [copied, setCopied] = useState<'sql' | 'plan' | null>(null)
  const label = isBefore ? 'Before' : 'After'
  const dotColor = isBefore ? 'bg-red-400' : 'bg-emerald-500'
  const displaySql = formatted ? formatSQLText(rawSql) : rawSql

  const handleCopy = useCallback((target: 'sql' | 'plan') => {
    navigator.clipboard.writeText(target === 'sql' ? rawSql : planText)
    setCopied(target)
    setTimeout(() => setCopied(null), 1500)
  }, [rawSql, planText])

  return (
    <div className="flex flex-col h-full">
      {/* SQL section */}
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-text-secondary">
            <span className={`w-[3px] h-3 rounded-full ${dotColor} shrink-0`} />
            {label} SQL
          </span>
          <button onClick={() => handleCopy('sql')} className="p-0.5 text-text-muted hover:text-text-primary transition-colors">
            {copied === 'sql' ? <Check size={11} className="text-success" /> : <Copy size={11} />}
          </button>
        </div>
        <div className="flex-1 overflow-auto p-3">
          <pre className="text-[11.5px] font-mono whitespace-pre-wrap leading-[22px] text-text-primary">{highlightSQL(displaySql)}</pre>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border shrink-0" />

      {/* Plan section */}
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-text-secondary">
            <span className={`w-[3px] h-3 rounded-full ${dotColor} shrink-0`} />
            {label} Plan
          </span>
          <button onClick={() => handleCopy('plan')} className="p-0.5 text-text-muted hover:text-text-primary transition-colors">
            {copied === 'plan' ? <Check size={11} className="text-success" /> : <Copy size={11} />}
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          <PlanTable text={planText} />
        </div>
      </div>
    </div>
  )
}

/* ─── Main DiffViewer ─────────────────────────────────── */
export default function DiffViewer({ sqlBefore, sqlAfter, planBefore, planAfter, viewMode, formatted = true, diffOn = true }: Props) {
  const [splitRatio, setSplitRatio] = useState(0.5)
  const dragRef = useRef<{ startY: number; startRatio: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const sqlDiff = useMemo(() => {
    const fB = formatted ? formatSQLText(sqlBefore) : sqlBefore
    const fA = formatted ? formatSQLText(sqlAfter) : sqlAfter
    return computeLineDiff(fB, fA)
  }, [sqlBefore, sqlAfter, formatted])

  const planDiff = useMemo(
    () => computePlanDiff(planBefore, planAfter),
    [planBefore, planAfter],
  )

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startY: e.clientY, startRatio: splitRatio }
    const move = (ev: MouseEvent) => {
      if (!dragRef.current || !containerRef.current) return
      const h = containerRef.current.getBoundingClientRect().height
      const dy = ev.clientY - dragRef.current.startY
      setSplitRatio(Math.max(0.15, Math.min(0.85, dragRef.current.startRatio + dy / h)))
    }
    const up = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }, [splitRatio])

  // Before-only / After-only
  if (viewMode === 'before') {
    return <SinglePane planText={planBefore} rawSql={sqlBefore} isBefore formatted={formatted} />
  }
  if (viewMode === 'after') {
    return <SinglePane planText={planAfter} rawSql={sqlAfter} isBefore={false} formatted={formatted} />
  }

  if (viewMode === 'sql') {
    return (
      <div className="flex flex-col h-full">
        <DiffPane title="SQL" leftLines={sqlDiff.leftLines} rightLines={sqlDiff.rightLines}
          rawLeft={formatted ? formatSQLText(sqlBefore) : sqlBefore}
          rawRight={formatted ? formatSQLText(sqlAfter) : sqlAfter}
          isSql showDiff={diffOn} />
      </div>
    )
  }
  if (viewMode === 'plan') {
    return (
      <div className="flex flex-col h-full">
        <DiffPane title="Execution Plan" leftLines={planDiff.leftLines} rightLines={planDiff.rightLines}
          rawLeft={planBefore} rawRight={planAfter} isSql={false} showDiff={diffOn} planStructured />
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      <div style={{ flex: `0 0 ${splitRatio * 100}%` }} className="min-h-0 flex flex-col">
        <DiffPane title="SQL" leftLines={sqlDiff.leftLines} rightLines={sqlDiff.rightLines}
          rawLeft={formatted ? formatSQLText(sqlBefore) : sqlBefore}
          rawRight={formatted ? formatSQLText(sqlAfter) : sqlAfter}
          isSql showDiff={diffOn} />
      </div>

      <div
        className="h-[5px] bg-surface-alt/80 hover:bg-code/10 cursor-row-resize transition-colors shrink-0 flex items-center justify-center border-y border-border"
        onMouseDown={onDragStart}
      >
        <div className="w-8 h-[2px] rounded-full bg-text-muted/20" />
      </div>

      <div style={{ flex: `0 0 ${(1 - splitRatio) * 100}%` }} className="min-h-0 flex flex-col">
        <DiffPane title="Execution Plan" leftLines={planDiff.leftLines} rightLines={planDiff.rightLines}
          rawLeft={planBefore} rawRight={planAfter} isSql={false} showDiff={diffOn} planStructured />
      </div>
    </div>
  )
}
