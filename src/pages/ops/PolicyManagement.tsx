import { useState, useMemo, useEffect } from 'react'
import { Ban, Search, Trash2 } from 'lucide-react'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import {
  getSqlExceptions,
  removeSqlException,
  subscribeSqlExceptions,
  type SqlException,
} from '../../mocks/sqlExceptions'
import {
  getQueryTimeoutSec,
  setQueryTimeoutSec,
  isValidQueryTimeoutSec,
  subscribeSettings,
  QUERY_TIMEOUT_MIN_SEC,
  QUERY_TIMEOUT_MAX_SEC,
} from '../../mocks/settingsStore'

type TabKey = 'exceptions' | 'execution' | 'schedule' | 'thresholds'

const TABS: { key: TabKey; label: string; disabled?: boolean }[] = [
  { key: 'exceptions', label: '예외 SQL 목록' },
  { key: 'execution', label: '튜닝 실행' },
  { key: 'schedule', label: '자동 튜닝 스케줄', disabled: true },
  { key: 'thresholds', label: '임계치 설정', disabled: true },
]

export default function PolicyManagement() {
  const [tab, setTab] = useState<TabKey>('exceptions')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-text-primary">자동 튜닝 정책</h1>
        <p className="mt-0.5 text-xs text-text-muted">
          자동 튜닝 대상에서 제외할 SQL, 실행 스케줄, 임계치를 관리합니다.
        </p>
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-0.5 rounded-lg bg-surface-muted p-0.5 w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => !t.disabled && setTab(t.key)}
            disabled={t.disabled}
            className={`rounded-md px-4 py-1.5 text-xs font-medium transition-all ${
              tab === t.key
                ? 'bg-white text-text-primary shadow-sm'
                : t.disabled
                ? 'text-text-muted/50 cursor-not-allowed'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {t.label}
            {t.disabled && <span className="ml-1.5 text-[10px] text-text-muted/60">준비중</span>}
          </button>
        ))}
      </div>

      {tab === 'exceptions' && <ExceptionListSection />}
      {tab === 'execution' && <ExecutionSection />}
    </div>
  )
}

/* ─── 튜닝 실행 섹션 (글로벌 쿼리 타임아웃) ─── */
function ExecutionSection() {
  const [current, setCurrent] = useState<number>(() => getQueryTimeoutSec())
  const [draft, setDraft] = useState<string>(() => String(getQueryTimeoutSec()))
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    const unsub = subscribeSettings(() => {
      const v = getQueryTimeoutSec()
      setCurrent(v)
      setDraft(String(v))
    })
    return unsub
  }, [])

  const draftNum = Number(draft)
  const valid = isValidQueryTimeoutSec(draftNum)
  const dirty = valid && draftNum !== current

  const handleSave = () => {
    if (!valid) return
    setQueryTimeoutSec(draftNum)
    setSavedAt(Date.now())
  }

  const handleReset = () => setDraft(String(current))

  return (
    <div className="space-y-3 max-w-xl">
      <div className="rounded-lg border border-border bg-white p-5">
        <div className="mb-1 text-sm font-semibold text-text-primary">쿼리 실행 타임아웃 (기본값)</div>
        <p className="text-[11px] text-text-muted">
          튜닝 분석 시 쿼리 1건당 최대 실행 시간. 요청 시 개별 설정 가능.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <input
            type="number"
            min={QUERY_TIMEOUT_MIN_SEC}
            max={QUERY_TIMEOUT_MAX_SEC}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className={`w-32 rounded-md border px-3 py-1.5 text-sm font-mono bg-white focus:outline-none focus:ring-1 ${
              valid ? 'border-border focus:ring-action/30' : 'border-danger focus:ring-danger/40'
            }`}
          />
          <span className="text-xs text-text-muted">초</span>
          <div className="ml-auto flex items-center gap-2">
            {dirty && (
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] text-text-muted hover:text-text-secondary"
              >
                되돌리기
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                dirty
                  ? 'bg-action text-white hover:bg-action-hover'
                  : 'bg-surface-muted text-text-muted cursor-not-allowed'
              }`}
            >
              저장
            </button>
          </div>
        </div>
        {!valid && (
          <p className="mt-2 text-[11px] text-danger">
            {QUERY_TIMEOUT_MIN_SEC}~{QUERY_TIMEOUT_MAX_SEC} 사이의 정수를 입력하세요. (1분 ~ 10시간)
          </p>
        )}
        {savedAt && !dirty && (
          <p className="mt-2 text-[11px] text-success-dark">저장되었습니다 — 현재 기본값 {current}초</p>
        )}
      </div>
    </div>
  )
}

/* ─── 예외 SQL 목록 섹션 ─── */
function ExceptionListSection() {
  const [items, setItems] = useState<readonly SqlException[]>(() => getSqlExceptions())
  const [query, setQuery] = useState('')
  const [releaseTarget, setReleaseTarget] = useState<SqlException | null>(null)

  // 스토어 구독
  useEffect(() => {
    const unsub = subscribeSqlExceptions(() => {
      setItems([...getSqlExceptions()])
    })
    return () => { unsub() }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(x =>
      x.sqlId.toLowerCase().includes(q) ||
      x.sqlText.toLowerCase().includes(q) ||
      x.registeredBy.toLowerCase().includes(q) ||
      (x.reason ?? '').toLowerCase().includes(q)
    )
  }, [items, query])

  const handleRelease = () => {
    if (!releaseTarget) return
    removeSqlException(releaseTarget.sqlId)
    setReleaseTarget(null)
  }

  return (
    <div className="space-y-3">
      {/* 상단 요약 + 검색 */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <Ban className="h-4 w-4 text-warning" />
          총 <span className="font-semibold text-text-primary">{items.length}</span>건 등록됨
          {query && <span className="text-text-muted">(필터: {filtered.length}건)</span>}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="SQL ID / 본문 / 등록자 / 사유 검색"
            className="w-[320px] rounded-md border border-border bg-white pl-8 pr-3 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-action/30 placeholder:text-text-muted"
          />
        </div>
      </div>

      {/* 목록 */}
      <div className="rounded-lg border border-border bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Ban className="mx-auto h-8 w-8 text-text-muted/40" />
            <p className="mt-3 text-sm text-text-secondary">
              {items.length === 0 ? '등록된 예외 SQL이 없습니다.' : '검색 결과가 없습니다.'}
            </p>
            {items.length === 0 && (
              <p className="mt-1 text-[11px] text-text-muted">
                대상 선정 &gt; Top SQL에서 각 행의 예외 등록 버튼으로 추가할 수 있습니다.
              </p>
            )}
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-surface-alt border-b border-border">
                <th className="text-left font-medium text-text-muted px-3 py-2 w-[140px]">SQL ID</th>
                <th className="text-left font-medium text-text-muted px-3 py-2">SQL TEXT</th>
                <th className="text-left font-medium text-text-muted px-3 py-2 w-[100px]">등록자</th>
                <th className="text-left font-medium text-text-muted px-3 py-2 w-[110px]">등록일</th>
                <th className="text-left font-medium text-text-muted px-3 py-2 w-[220px]">사유</th>
                <th className="w-[60px] px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((x, idx) => (
                <tr key={x.sqlId} className={`border-b border-border/60 hover:bg-surface-alt transition-colors ${idx === filtered.length - 1 ? 'border-b-0' : ''}`}>
                  <td className="px-3 py-2 font-mono font-semibold text-text-primary">{x.sqlId}</td>
                  <td className="px-3 py-2 font-mono text-text-muted truncate max-w-0">
                    <span title={x.sqlText}>{x.sqlText.replace(/\s+/g, ' ').slice(0, 80)}{x.sqlText.length > 80 ? '…' : ''}</span>
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{x.registeredBy}</td>
                  <td className="px-3 py-2 text-text-muted">{new Date(x.registeredAt).toLocaleDateString('ko-KR')}</td>
                  <td className="px-3 py-2 text-text-secondary">
                    {x.reason ? <span className="truncate block" title={x.reason}>{x.reason}</span> : <span className="text-text-muted/60">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setReleaseTarget(x)}
                      className="rounded-md p-1 text-text-muted transition-all hover:bg-danger-light hover:text-danger"
                      title="예외 해제"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 해제 확인 */}
      <ConfirmDialog
        open={!!releaseTarget}
        onConfirm={handleRelease}
        onCancel={() => setReleaseTarget(null)}
        title="예외 해제"
        confirmLabel="해제"
        cancelLabel="취소"
        variant="danger"
      >
        {releaseTarget && (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-text-secondary">
              이 SQL이 다시 Top SQL 및 자동 튜닝 대상에 포함됩니다.
            </p>
            <div className="rounded-md border border-border bg-surface-alt px-3 py-2.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-text-muted w-14 shrink-0">SQL ID</span>
                <span className="font-mono text-[13px] font-semibold text-text-primary">{releaseTarget.sqlId}</span>
              </div>
              {releaseTarget.reason && (
                <div className="flex items-start gap-2 pt-0.5 border-t border-border">
                  <span className="text-[11px] text-text-muted w-14 shrink-0 pt-0.5">사유</span>
                  <span className="text-[12px] text-text-secondary leading-relaxed">{releaseTarget.reason}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}
