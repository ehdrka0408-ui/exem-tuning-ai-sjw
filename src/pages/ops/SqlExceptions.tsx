import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { fetchExceptionSqls, deleteExceptionSql, type ExceptionSql } from '../../lib/api'

export default function SqlExceptions() {
  const [items, setItems] = useState<ExceptionSql[]>([])
  const [search, setSearch] = useState('')

  const refresh = () => {
    fetchExceptionSqls()
      .then(setItems)
      .catch(err => console.error('[fetchExceptionSqls failed]', err))
  }

  useEffect(() => { refresh() }, [])

  const filtered = items.filter((e) =>
    search === '' ||
    (e.sqlId ?? e.sql_id ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (e.sqlText ?? e.sql_text ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (e.reason ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (e.alias ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const handleRemove = async (id: string) => {
    if (!confirm('예외 SQL을 해제하시겠습니까?')) return
    try {
      await deleteExceptionSql(id)
      refresh()
    } catch (err) {
      alert('삭제 실패: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-text-primary">예외 SQL 목록</h1>
        <p className="mt-0.5 text-xs text-text-muted">등록된 SQL은 AI 튜닝 자동 선정 및 직접 등록 시 차단됩니다.</p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-text-secondary">
          총 <span className="font-semibold text-text-primary">{items.length}</span>건 등록됨
          {search && <span className="text-text-muted ml-1">(필터: {filtered.length}건)</span>}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="SQL ID / SQL Text / 사유"
            className="rounded-md border border-border bg-white pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-action/30 w-[280px] placeholder:text-text-muted"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-white overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-surface-alt border-b border-border text-left text-text-muted font-medium">
              <th className="w-[140px] px-3 py-2">SQL ID</th>
              <th className="w-[130px] px-3 py-2">별칭</th>
              <th className="px-3 py-2">SQL Text</th>
              <th className="w-[200px] px-3 py-2">사유</th>
              <th className="w-[110px] px-3 py-2">등록일</th>
              <th className="w-[100px] px-3 py-2">등록자</th>
              <th className="w-[72px] px-3 py-2 text-center">해제</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-text-muted">
                  {search ? '검색 결과가 없습니다.' : '등록된 예외 SQL이 없습니다.'}
                </td>
              </tr>
            ) : (
              filtered.map((e, idx) => {
                const sqlText = e.sqlText ?? e.sql_text ?? ''
                const sqlId = e.sqlId ?? e.sql_id ?? ''
                const registeredAt = e.registered_at ?? e.addedAt ?? ''
                const registeredBy = e.registered_by ?? e.addedBy ?? ''
                return (
                  <tr key={e.id} className={`border-b border-border/60 hover:bg-surface-alt ${idx === filtered.length - 1 ? 'border-b-0' : ''}`}>
                    <td className="px-3 py-2 font-mono text-[11px] font-semibold text-text-primary">{sqlId}</td>
                    <td className="px-3 py-2 text-[11px] text-text-secondary">{e.alias ?? <span className="text-text-muted/50">—</span>}</td>
                    <td className="px-3 py-2 max-w-0">
                      <span className="block truncate font-mono text-[11px] text-text-muted" title={sqlText}>
                        {sqlText.replace(/\s+/g, ' ').slice(0, 80)}{sqlText.length > 80 ? '…' : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-text-secondary">
                      {e.reason ? <span className="truncate block" title={e.reason}>{e.reason}</span> : <span className="text-text-muted/60">—</span>}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-text-muted whitespace-nowrap">
                      {registeredAt}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-text-muted">{registeredBy}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleRemove(e.id)}
                        className="rounded px-2 py-0.5 text-[11px] font-medium text-danger hover:bg-danger-light border border-danger/30 transition-colors"
                        title="예외 해제"
                      >
                        해제
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
