import { useMemo, useState, useEffect } from 'react'
import { useObjectInfo } from './ObjectInfoContext'
const API_BASE = import.meta.env.VITE_API_BASE || 'http://10.10.45.119:8000'
import { getObjectMeta } from '../../lib/object-info/objectMeta'
import { buildSyntheticMeta } from '../../lib/object-info/syntheticMeta'
import { findPredicatesForObject } from '../../lib/object-info/sqlHighlight'
import type { ObjectMeta, IndexMeta, PredicateRef } from '../../lib/object-info'

export const OBJECT_INFO_WIDTH = 640
export const OBJECT_INFO_COLLAPSED = 36

function fmtNum(n: number | null | undefined): string {
  if (n == null) return '-'
  return n.toLocaleString()
}

function planBadge(ix: IndexMeta) {
  const u = (ix.planUsage || '').toUpperCase()
  if (!u) return null
  const asisCls = 'px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700'
  const tobeCls = 'px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-100 text-sky-700'
  const newCls  = 'px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700'
  return (
    <span className="inline-flex gap-1 ml-2">
      {(u === 'ASIS' || u === 'BOTH') && <span className={asisCls} title="현재 플랜">AS-IS</span>}
      {(u === 'TOBE' || u === 'BOTH') && <span className={tobeCls} title="튜닝 후 플랜">TO-BE</span>}
      {ix.isNew && <span className={newCls} title="신규 생성 제안">NEW</span>}
    </span>
  )
}

function rowClass(ix: IndexMeta): string {
  const u = (ix.planUsage || '').toUpperCase()
  if (u === 'BOTH') return 'bg-gradient-to-r from-slate-50 to-sky-50'
  if (u === 'ASIS') return 'bg-slate-50'
  if (u === 'TOBE') return 'bg-sky-50'
  return ''
}

export default function ObjectInfoPanel() {
  const { isOpen, sql, term, aliasMap, resolved, colTerm, setColTerm, showToBe, close } = useObjectInfo()

  // API에서 실제 Oracle 메타 조회, 실패 시 기존 mock/synthetic fallback
  const key = resolved || term
  const [apiMeta, setApiMeta] = useState<ObjectMeta | null>(null)
  const [apiLoaded, setApiLoaded] = useState<string>('')

  useEffect(() => {
    if (!key) { setApiMeta(null); return }
    if (apiLoaded === key) return
    setApiLoaded(key)
    fetch(`${API_BASE}/api/object-info?name=${encodeURIComponent(key)}`)
      .then(r => r.ok ? r.json() : null)
      .then((data) => {
        if (data && data.columns) setApiMeta(data as ObjectMeta)
        else setApiMeta(null)
      })
      .catch(() => setApiMeta(null))
  }, [key, apiLoaded])

  const meta: ObjectMeta | null = useMemo(() => {
    if (apiMeta) return apiMeta
    if (!key) return null
    const catalog = getObjectMeta(key)
    if (catalog) return catalog
    return buildSyntheticMeta(sql, key, aliasMap)
  }, [apiMeta, key, sql, aliasMap])

  const preds: PredicateRef[] = useMemo(() => {
    const key = resolved || term
    if (!key) return []
    return findPredicatesForObject(sql, key, aliasMap, meta?.columns?.map((c) => c.name))
  }, [sql, resolved, term, aliasMap, meta])

  if (!isOpen) return null

  const width = OBJECT_INFO_WIDTH
  const outerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width,
    zIndex: 70,
    transition: 'width 200ms ease-out',
  }

  const filteredIndexes = meta ? meta.indexes.filter(ix => showToBe || (ix.planUsage || '').toUpperCase() !== 'TOBE') : []
  const sortedIndexes = meta
    ? filteredIndexes.slice().sort((a, b) => {
        const rank = (x: IndexMeta) => {
          const u = (x.planUsage || '').toUpperCase()
          if (u === 'BOTH') return 0
          if (u === 'ASIS') return 1
          if (u === 'TOBE') return 2
          return 3
        }
        return rank(a) - rank(b)
      })
    : []

  const hitCol = (name: string) => colTerm && name.toLowerCase() === colTerm.toLowerCase()

  return (
    <div
      style={outerStyle}
      className="bg-white shadow-2xl border-l border-slate-200 flex flex-col"
      onMouseUp={() => {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return
        const picked = sel.toString().trim()
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(picked)) return
        setColTerm(picked)
      }}
    >
      <header className="px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-slate-500">
            Selected term: <code className="font-mono">{term}</code>
            {resolved && <> → <code className="font-mono text-slate-800">{resolved}</code></>}
          </div>
          <h3 className="text-base font-semibold text-slate-900 mt-0.5 truncate">
            {meta ? `${meta.schema}.${meta.name}` : `Object: ${resolved ?? '(unknown)'}`}
          </h3>
          {meta && (
            <div className="mt-1 text-[11px] text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5">
              <span>Type <code className="text-slate-700">{meta.type}</code></span>
              <span>Rows <code className="text-slate-700">{fmtNum(meta.totalRows)}</code></span>
              <span>Avg <code className="text-slate-700">{meta.avgRowBytes != null ? `${fmtNum(meta.avgRowBytes)} B` : '-'}</code></span>
              <span>Analyzed <code className="text-slate-700">{meta.lastAnalyzed ?? '-'}</code></span>
            </div>
          )}
          {meta?.note && <div className="mt-1 text-xs text-amber-700">{meta.note}</div>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={close}
            className="px-2 py-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
            aria-label="닫기"
            title="닫기 (Esc)"
          >
            ✕
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-sm">
        <section>
          <h4 className="text-xs font-semibold text-slate-500 mb-2">
            Related Predicates <span className="text-slate-400">(WHERE / ON / HAVING)</span>
          </h4>
          {preds.length === 0 ? (
            <div className="text-xs text-slate-400">해당 오브젝트를 참조하는 조건절이 없습니다.</div>
          ) : (
            <div className="space-y-1">
              {preds.map((p, i) => {
                const predTokens = p.text.match(/([A-Za-z_][A-Za-z0-9_]*)|([^A-Za-z_]+)/g) || []
                return (
                  <div key={i} className="flex gap-2 text-xs">
                    <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 font-semibold min-w-[50px] text-center">
                      {p.clause}
                    </span>
                    <code className="font-mono text-slate-700 flex-1 break-all">
                      {predTokens.map((t, k) => {
                        const isIdent = /^[A-Za-z_][A-Za-z0-9_]*$/.test(t)
                        if (!isIdent) return <span key={k}>{t}</span>
                        const hit = colTerm && t.toLowerCase() === colTerm.toLowerCase()
                        return (
                          <span
                            key={k}
                            onClick={() => setColTerm(t === colTerm ? '' : t)}
                            style={hit ? { backgroundColor: '#FEF08A', color: '#78350F' } : undefined}
                            className={`cursor-pointer ${hit ? 'font-semibold' : 'hover:bg-sky-50'}`}
                          >
                            {t}
                          </span>
                        )
                      })}
                    </code>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-slate-500">Columns</h4>
            {colTerm && (
              <button
                onClick={() => setColTerm('')}
                className="text-[11px] text-slate-500 hover:text-slate-900"
              >
                해제 <code>{colTerm}</code> ✕
              </button>
            )}
          </div>
          {meta && meta.columns.length ? (
            <table className="w-full text-xs border border-slate-200 rounded overflow-hidden">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-right px-2 py-1 w-8">#</th>
                  <th className="text-left  px-2 py-1">Column</th>
                  <th className="text-left  px-2 py-1">Type</th>
                  <th className="text-left  px-2 py-1 w-14">Null</th>
                  <th className="text-right px-2 py-1 w-20">Distinct</th>
                </tr>
              </thead>
              <tbody>
                {meta.columns.map((c, i) => (
                  <tr
                    key={c.name}
                    onClick={() => setColTerm(c.name)}
                    style={hitCol(c.name) ? { backgroundColor: '#FEF08A' } : undefined}
                    className="border-t border-slate-100 cursor-pointer hover:bg-sky-50"
                  >
                    <td className="text-right px-2 py-1 text-slate-400">{i + 1}</td>
                    <td className="px-2 py-1 font-mono text-slate-800">{c.name}</td>
                    <td className="px-2 py-1 text-slate-600">{c.type}</td>
                    <td className={`px-2 py-1 ${c.nullable ? 'text-amber-600' : 'text-slate-400'}`}>{c.nullable ? 'YES' : 'NO'}</td>
                    <td className="text-right px-2 py-1 text-slate-600">{fmtNum(c.distinct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>

        <section>
          <h4 className="text-xs font-semibold text-slate-500 mb-2">
            Indexes <span className="text-[10px] text-slate-400">(AS-IS 현행 · TO-BE 제안)</span>
          </h4>
          {meta && sortedIndexes.length ? (
            <table className="w-full text-xs border border-slate-200 rounded overflow-hidden">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-2 py-1">Index</th>
                  <th className="text-left px-2 py-1 w-16">Type</th>
                  <th className="text-left px-2 py-1">Columns</th>
                </tr>
              </thead>
              <tbody>
                {sortedIndexes.map((ix) => (
                  <tr key={ix.name} className={`border-t border-slate-100 ${rowClass(ix)}`} title={ix.rationale}>
                    <td className="px-2 py-1">
                      <div className="font-mono text-slate-800 break-all">{ix.name}</div>
                      {planBadge(ix)}
                    </td>
                    <td className="px-2 py-1 text-slate-600">{ix.type}</td>
                    <td className="px-2 py-1">
                      {ix.columns.map((col) => (
                        <code
                          key={col}
                          onClick={(e) => { e.stopPropagation(); setColTerm(col) }}
                          className={`inline-block cursor-pointer px-1.5 py-0.5 mr-1 mb-0.5 rounded font-mono ${
                            hitCol(col)
                              ? 'bg-amber-200 text-amber-900'
                              : 'bg-slate-100 text-slate-700 hover:bg-sky-100'
                          }`}
                        >
                          {col}
                        </code>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>

        <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
          💡 <kbd>Esc</kbd> 닫기
        </div>
      </div>
    </div>
  )
}
