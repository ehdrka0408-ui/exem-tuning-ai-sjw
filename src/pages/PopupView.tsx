import { useState, useMemo, useEffect } from 'react'
import { Copy, Check } from 'lucide-react'
import { highlightSQL } from '../utils/sqlHighlight'
import { parsePlanText, type PlanRow } from '../utils/planParser'

function getStoredView(): { title: string; content: string; kind: 'sql' | 'plan' } | null {
  try {
    const raw = sessionStorage.getItem('popupView')
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

export default function PopupView() {
  const [data] = useState(getStoredView)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (data) document.title = data.title
  }, [data])

  if (!data) {
    return <div className="flex items-center justify-center h-screen text-sm text-text-muted">표시할 내용이 없습니다.</div>
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(data.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-col h-screen">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-white shrink-0">
        <span className="text-xs font-semibold text-text-secondary">{data.title}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium text-text-secondary hover:bg-surface-muted transition-colors"
        >
          {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {/* 내용 */}
      <div className="flex-1 overflow-auto p-4 bg-white">
        {data.kind === 'sql' ? (
          <pre className="text-sm font-mono whitespace-pre-wrap text-text-primary leading-relaxed">{highlightSQL(data.content)}</pre>
        ) : (
          <PlanView text={data.content} />
        )}
      </div>
    </div>
  )
}

// ─── Plan 렌더링 (PlanTable 재현) ──────────────
function PlanView({ text }: { text: string }) {
  const parsed = useMemo(() => parsePlanText(text), [text])
  const getBarColor = (row: PlanRow): string | null => {
    const op = row.cells[1] || ''
    if (op.includes('TABLE ACCESS FULL') || op.includes('INDEX FULL SCAN')) return 'bg-danger'
    if (op.includes('INDEX RANGE SCAN') || op.includes('INDEX UNIQUE SCAN') || op.includes('INDEX FAST FULL SCAN')) return 'bg-info'
    return null
  }

  return (
    <div className="text-sm font-mono">
      {parsed.preLines.filter(l => l.trim()).length > 0 && (
        <div className="text-text-secondary mb-3 leading-relaxed">
          {parsed.preLines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
      {parsed.headers.length > 0 && (
        <div className="overflow-x-auto">
          <table className="border-collapse w-full min-w-max">
            <thead>
              <tr className="border-b border-border bg-surface">
                {parsed.headers.map((h, i) => (
                  <th key={i} className={`px-3 py-1.5 text-left text-xs font-semibold text-text-secondary whitespace-nowrap ${i > 0 ? 'border-l border-border' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsed.rows.map((row, ri) => {
                const bar = getBarColor(row)
                return (
                  <tr key={ri} className="border-b border-surface-muted hover:bg-surface/50">
                    {row.cells.map((cell, ci) => (
                      <td key={ci} className={`px-3 py-1 whitespace-nowrap text-text-primary ${ci > 0 ? 'border-l border-border' : ''}`}>
                        <div className="flex items-center gap-1.5">
                          {ci === 1 && bar && <span className={`shrink-0 w-1.5 h-3 rounded-sm ${bar}`} />}
                          {ci === 1 ? <span className="whitespace-pre">{cell}</span> : cell}
                        </div>
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
        <div className="mt-3 pt-3 border-t border-border">
          <div className="text-xs font-semibold text-text-secondary mb-1.5">Predicate Information</div>
          {parsed.predicates.map((p, i) => (
            <div key={i} className="text-xs leading-relaxed">
              <span className="text-text-muted">{p.id} - </span>
              <span className={p.type === 'access' ? 'text-code font-medium' : 'text-text-primary'}>{p.type}</span>
              <span className="text-text-muted">(</span>{p.text}<span className="text-text-muted">)</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
