import { useEffect, useState } from 'react'
import { Activity, Search, TrendingDown } from 'lucide-react'
import { fetchTuningRequests, type TuningRequestSummary } from '../lib/api'

/* ── Helpers ─────────────────────────────────────────────── */
function fmtMs(ms: number | null | undefined) {
  if (ms == null) return '-'
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '-'
  return s.slice(0, 10)
}

interface AppliedRow {
  id: number
  sqlId: string
  tuningDate: string
  beforeMs: number | null
  afterMs: number | null
  improvement: number | null
}

function mapApplied(r: TuningRequestSummary): AppliedRow {
  return {
    id: r.id,
    sqlId: r.asis_sql_id_hash ?? `BE-${r.id}`,
    tuningDate: fmtDate(r.completed_at ?? r.requested_at),
    beforeMs: r.before_elapsed_sec != null ? Math.round(r.before_elapsed_sec * 1000) : null,
    afterMs: r.after_elapsed_sec != null ? Math.round(r.after_elapsed_sec * 1000) : null,
    improvement: r.improvement_pct != null ? r.improvement_pct * 100 : null,
  }
}

/* ═══════════════════════════════════════════════════════════
   OpsEffect Page
═══════════════════════════════════════════════════════════ */
export default function OpsEffect() {
  const [rows, setRows] = useState<AppliedRow[]>([])

  useEffect(() => {
    let stopped = false
    const refresh = () => {
      // status='applied' 인 row 만 — 적용된 튜닝의 운영 효과
      fetchTuningRequests({ status: 'applied', limit: 200 })
        .then(data => { if (!stopped) setRows(data.map(mapApplied)) })
        .catch(err => console.error('[OpsEffect fetch failed]', err))
    }
    refresh()
    const t = setInterval(refresh, 10000)
    return () => { stopped = true; clearInterval(t) }
  }, [])

  return (
    <div className="p-6 space-y-6 max-w-[1200px]">
      {/* Page title */}
      <h1 className="text-lg font-semibold text-text-primary">운영효과</h1>

      {/* ── Card 1: 튜닝건별 After SQL 추적 ── */}
      <div className="p-6 border border-border rounded-xl bg-white">
        <div className="flex items-center gap-2 mb-1">
          <Search size={16} className="text-code shrink-0" />
          <h2 className="text-base font-semibold text-text-primary">튜닝건별 After SQL 추적</h2>
        </div>
        <p className="text-sm text-text-secondary mb-4">
          반영 완료된 튜닝 요청의 운영 성능 변화를 추적합니다
        </p>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-alt text-text-secondary text-left">
                <th className="px-4 py-2 font-medium">SQL_ID</th>
                <th className="px-4 py-2 font-medium">튜닝일</th>
                <th className="px-4 py-2 font-medium text-right">Before Elapsed</th>
                <th className="px-4 py-2 font-medium text-right">After Elapsed</th>
                <th className="px-4 py-2 font-medium text-right">개선율</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-text-muted">
                    반영 완료된 튜닝 요청이 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-border hover:bg-surface-alt transition-colors"
                  >
                    <td className="px-4 py-2 font-mono text-code text-[13px]">{row.sqlId}</td>
                    <td className="px-4 py-2 text-text-secondary">{row.tuningDate}</td>
                    <td className="px-4 py-2 text-right text-text-primary">{fmtMs(row.beforeMs)}</td>
                    <td className="px-4 py-2 text-right text-text-primary">{fmtMs(row.afterMs)}</td>
                    <td className={`px-4 py-2 text-right font-medium ${row.improvement != null && row.improvement > 0 ? 'text-success' : 'text-text-muted'}`}>
                      {row.improvement != null ? (
                        <>
                          <TrendingDown size={13} className="inline mr-1 -mt-0.5" />
                          {row.improvement.toFixed(1)}%
                        </>
                      ) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Card 2: DB 성능 트렌드 (빈 상태) ── */}
      <div className="p-6 border border-border rounded-xl bg-white">
        <div className="flex items-center gap-2 mb-1">
          <Activity size={16} className="text-code shrink-0" />
          <h2 className="text-base font-semibold text-text-primary">DB 성능 트렌드</h2>
        </div>
        <p className="text-sm text-text-secondary mb-4">
          시계열 성능 차트
        </p>

        <div className="h-[200px] flex items-center justify-center rounded-lg border border-dashed border-border bg-surface-alt text-text-muted text-sm">
          데이터가 없습니다.
        </div>
      </div>
    </div>
  )
}
