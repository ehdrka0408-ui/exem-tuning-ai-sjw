import { useState, useMemo, useEffect, useRef } from 'react'
import { FileText } from 'lucide-react'
import { highlightSQL } from '../utils/sqlHighlight'
import {
  type DiffLine, DIFF_STYLES, DIFF_TEXT,
  computeLineDiff, computePlanDiff, formatSQLText,
} from '../utils/sqlDiff'

function getStoredData(): { sqlBefore: string; sqlAfter: string; planBefore: string; planAfter: string } | null {
  try {
    const raw = sessionStorage.getItem('compareAllView')
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

// ─── PlanDiffTable ───────────────���────────────
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
        if (inTable || foundHeader) tableLines.push({ ...line, isTable: true, cells: [] })
        continue
      }
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

// ─── Main ─────────────────────────────────────
export default function CompareAllPopupView() {
  const [data] = useState(getStoredData)
  const [formatted, setFormatted] = useState(true)
  const [activeTab, setActiveTab] = useState<'sql' | 'plan' | 'both'>('both')
  const [sqlPct, setSqlPct] = useState(20)
  const [userDragged, setUserDragged] = useState(false)
  const draggingDivider = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { document.title = '전체 비교 — SQL + Plan' }, [])

  const fmtSqlLeft = useMemo(() => data ? (formatted ? formatSQLText(data.sqlBefore) : data.sqlBefore) : '', [data, formatted])
  const fmtSqlRight = useMemo(() => data ? (formatted ? formatSQLText(data.sqlAfter) : data.sqlAfter) : '', [data, formatted])
  const sqlDiff = useMemo(() => computeLineDiff(fmtSqlLeft, fmtSqlRight), [fmtSqlLeft, fmtSqlRight])
  const planDiff = useMemo(() => data ? computePlanDiff(data.planBefore, data.planAfter) : { leftLines: [], rightLines: [] }, [data])

  useEffect(() => {
    if (userDragged) return
    const maxLines = Math.max(fmtSqlLeft.split('\n').length, fmtSqlRight.split('\n').length)
    setSqlPct(Math.max(12, Math.min(50, maxLines * 2 + 8)))
  }, [fmtSqlLeft, fmtSqlRight, userDragged])

  if (!data) {
    return <div className="flex items-center justify-center h-screen text-sm text-text-muted">표시할 내용이 없습니다.</div>
  }

  const renderLines = (lines: DiffLine[], highlight: boolean) => (
    <div className="font-mono text-[12px] leading-[1.5]">
      {lines.map((line, i) => (
        <div key={i} className={`flex ${DIFF_STYLES[line.type]} px-1 -mx-1 rounded-sm`}>
          <span className="shrink-0 w-8 text-right pr-2 text-text-muted text-[10px] select-none tabular-nums leading-[1.5]">{line.num || ''}</span>
          <span className={`flex-1 whitespace-pre-wrap ${DIFF_TEXT[line.type]}`}>
            {highlight ? highlightSQL(line.text) : line.text}
          </span>
        </div>
      ))}
    </div>
  )

  const renderPanel = (label: string, side: 'left' | 'right', lines: DiffLine[], highlight: boolean) => (
    <div className={`flex flex-col bg-white overflow-hidden min-h-0 ${side === 'left' ? 'border-r border-border' : ''}`}>
      <div className="flex items-center gap-1.5 px-3 py-1 border-b border-surface-muted bg-surface-alt">
        <span className="text-[11px] font-semibold text-text-secondary">{label}</span>
        <span className="text-[10px] text-text-muted ml-auto">{lines.length} lines</span>
      </div>
      <div className="flex-1 overflow-y-scroll p-3">
        {!highlight ? <PlanDiffTable lines={lines} /> : renderLines(lines, highlight)}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-1">
          {(['both', 'sql', 'plan'] as const).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === t ? 'bg-action text-white' : 'text-text-secondary hover:bg-surface-muted'}`}
            >
              {t === 'both' ? 'All' : t === 'sql' ? 'SQL' : 'Plan'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {(activeTab === 'sql' || activeTab === 'both') && (
            <button
              onClick={() => setFormatted(f => !f)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${formatted ? 'bg-code-bg text-code' : 'text-text-muted hover:bg-surface-muted hover:text-text-secondary'}`}
            >
              <FileText size={12} />
              Format
            </button>
          )}
          <div className="flex items-center gap-3 text-[10px] text-text-muted">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-100 border border-amber-300" />Modified</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-100 border border-emerald-300" />Added</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-100 border border-red-300" />Removed</span>
          </div>
        </div>
      </div>

      {/* Both */}
      {activeTab === 'both' && (
        <div ref={containerRef} className="flex-1 flex flex-col min-h-0">
          <div className="flex flex-col shrink-0" style={{ maxHeight: `${sqlPct}%`, minHeight: 60 }}>
            <div className="text-[11px] font-semibold text-text-secondary uppercase px-3 py-1 shrink-0">SQL</div>
            <div className="grid grid-cols-2 overflow-auto" style={{ minHeight: 0 }}>
              {renderPanel('Before', 'left', sqlDiff.leftLines, true)}
              {renderPanel('After', 'right', sqlDiff.rightLines, true)}
            </div>
          </div>
          <div
            className="h-1.5 shrink-0 flex items-center justify-center cursor-row-resize hover:bg-surface-muted bg-surface-alt border-y border-border transition-colors group select-none"
            onMouseDown={(e) => {
              e.preventDefault()
              draggingDivider.current = true
              setUserDragged(true)
              const startY = e.clientY
              const startPct = sqlPct
              const container = containerRef.current
              if (!container) return
              const onMove = (ev: MouseEvent) => {
                if (!draggingDivider.current) return
                const dy = ev.clientY - startY
                const totalH = container.clientHeight
                const newPct = Math.max(10, Math.min(80, startPct + (dy / totalH) * 100))
                setSqlPct(newPct)
              }
              const onUp = () => {
                draggingDivider.current = false
                document.removeEventListener('mousemove', onMove)
                document.removeEventListener('mouseup', onUp)
              }
              document.addEventListener('mousemove', onMove)
              document.addEventListener('mouseup', onUp)
            }}
          >
            <div className="w-8 h-[2px] rounded-full bg-border group-hover:bg-text-muted transition-colors" />
          </div>
          <div className="flex flex-col flex-1" style={{ minHeight: 60, overflow: 'hidden' }}>
            <div className="text-[11px] font-semibold text-text-secondary uppercase px-3 py-1 shrink-0">Plan</div>
            <div className="flex-1 grid grid-cols-2 overflow-hidden" style={{ minHeight: 0 }}>
              {renderPanel('Before', 'left', planDiff.leftLines, false)}
              {renderPanel('After', 'right', planDiff.rightLines, false)}
            </div>
          </div>
        </div>
      )}

      {/* SQL only */}
      {activeTab === 'sql' && (
        <div className="flex-1 grid grid-cols-2 min-h-0">
          {renderPanel('Before', 'left', sqlDiff.leftLines, true)}
          {renderPanel('After', 'right', sqlDiff.rightLines, true)}
        </div>
      )}

      {/* Plan only */}
      {activeTab === 'plan' && (
        <div className="flex-1 grid grid-cols-2 min-h-0">
          {renderPanel('Before', 'left', planDiff.leftLines, false)}
          {renderPanel('After', 'right', planDiff.rightLines, false)}
        </div>
      )}
    </div>
  )
}
