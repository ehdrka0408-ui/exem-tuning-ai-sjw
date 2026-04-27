import { useEffect, useState } from 'react'
import SqlBlock from '../../components/object-info/SqlBlock'
import {
  fetchCases, fetchCase,
  type TuningCaseSummary, type TuningCaseDetail,
} from '../../lib/api'

function fmt(ms: number | null) {
  if (ms == null) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

export default function CasesDbPage() {
  const [cases, setCases] = useState<TuningCaseSummary[]>([])
  const [selected, setSelected] = useState<TuningCaseDetail | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCases()
      .then((d) => { setCases(d); setLoading(false) })
      .catch((e) => { setErr(String(e)); setLoading(false) })
  }, [])

  const open = (id: number) => {
    fetchCase(id).then(setSelected).catch((e) => setErr(String(e)))
  }

  if (loading) return <div className="p-6 text-slate-600">Loading from DB...</div>
  if (err) return <div className="p-6 text-red-600">Error: {err}</div>

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Tuning Cases (PostgreSQL)</h1>
        <p className="text-sm text-slate-500">
          {cases.length} cases — live from FastAPI + PostgreSQL (backend :8000 → pg :5432)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-slate-200 rounded bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2 w-10">#</th>
                <th className="text-left px-3 py-2">Title</th>
                <th className="text-left px-3 py-2">Category</th>
                <th className="text-left px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => open(c.id)}
                  className={`border-t border-slate-100 cursor-pointer hover:bg-sky-50 ${
                    selected?.id === c.id ? 'bg-sky-100' : ''
                  }`}
                >
                  <td className="px-3 py-2 text-slate-500">{c.id}</td>
                  <td className="px-3 py-2 text-slate-900">{c.title ?? '(no title)'}</td>
                  <td className="px-3 py-2 text-slate-600">{c.category ?? '-'}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700">
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border border-slate-200 rounded bg-white p-4 space-y-4">
          {!selected && (
            <div className="text-slate-500 text-sm">Select a case on the left to see SQL / Plan / Binds.</div>
          )}
          {selected && (
            <>
              <div>
                <div className="text-xs text-slate-500">
                  #{selected.id} · {selected.schema_name ?? '-'} · {selected.instance_name ?? '-'} · {selected.sql_id ?? '-'}
                </div>
                <div className="text-base font-semibold text-slate-900">{selected.title}</div>
                {selected.rationale && (
                  <div className="mt-2 text-sm text-slate-600">{selected.rationale}</div>
                )}
              </div>

              <div>
                <div className="text-xs font-medium text-slate-500 mb-1">SQL (Before) — 드래그 + F4로 Object Info</div>
                <SqlBlock sql={selected.sql_text}>
                  <pre className="text-xs bg-slate-50 p-3 rounded overflow-x-auto font-mono whitespace-pre select-text">
{selected.sql_text}
                  </pre>
                </SqlBlock>
              </div>

              {selected.tuned_sql_text && (
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-1">SQL (After)</div>
                  <SqlBlock sql={selected.tuned_sql_text}>
                    <pre className="text-xs bg-emerald-50 p-3 rounded overflow-x-auto font-mono whitespace-pre select-text">
{selected.tuned_sql_text}
                    </pre>
                  </SqlBlock>
                </div>
              )}

              <div>
                <div className="text-xs font-medium text-slate-500 mb-1">
                  Execution Plans ({selected.plans.length})
                </div>
                <div className="space-y-2">
                  {selected.plans.map((p) => (
                    <details key={p.id} className="border border-slate-200 rounded">
                      <summary className="cursor-pointer px-3 py-2 text-xs bg-slate-50 flex gap-3">
                        <span className={`font-semibold ${p.phase === 'after' ? 'text-emerald-700' : 'text-slate-700'}`}>
                          [{p.phase}]
                        </span>
                        <span className="text-slate-500">hash {p.plan_hash ?? '-'}</span>
                        <span className="text-slate-500">elapsed {p.elapsed_sec != null ? p.elapsed_sec.toFixed(3) + " s" : "-"}</span>
                        {p.buffers != null && <span className="text-slate-500">buf {p.buffers.toLocaleString()}</span>}
                      </summary>
                      <pre className="text-[11px] font-mono p-3 overflow-x-auto">
{p.plan_text}
                      </pre>
                      {p.note && <div className="px-3 pb-2 text-xs text-slate-500">{p.note}</div>}
                    </details>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-slate-500 mb-1">
                  Bind Variables ({selected.bind_variables.length})
                </div>
                {selected.bind_variables.length === 0 ? (
                  <div className="text-xs text-slate-400">none</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="text-left py-1">Name</th>
                        <th className="text-left py-1">Type</th>
                        <th className="text-left py-1">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.bind_variables.map((b) => (
                        <tr key={b.id} className="border-t border-slate-100">
                          <td className="py-1 font-mono text-slate-800">{b.name}</td>
                          <td className="py-1 text-slate-600">{b.data_type}</td>
                          <td className="py-1 font-mono text-slate-800">{b.value ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
