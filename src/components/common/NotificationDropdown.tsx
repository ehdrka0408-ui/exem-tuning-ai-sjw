import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, ChevronRight, Square, RotateCcw, Play } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import { instCls, useQueue } from '../../contexts/QueueContext'
import { useNotifications } from '../../contexts/NotificationContext'
import type { Notif, NotifType } from '../../contexts/NotificationContext'
import { showToast } from './Toast'
import { setGlobalStatusOverride } from '../../mocks/newItemsStore'

/* ─── Helpers ────────────────────────────────────────────── */

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function fmtRelTime(ts: Date): string {
  const diffMs = Date.now() - ts.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return '방금'
  if (diffMin < 60) return `${diffMin}분 전`
  const diffH = Math.floor(diffMin / 3600)
  if (isSameDay(ts, new Date())) return `${diffH}시간 전`
  return `${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}`
}

function fmtGroupLabel(ts: Date): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (isSameDay(ts, today)) return '오늘'
  if (isSameDay(ts, yesterday)) return '어제'
  const DOW = ['일', '월', '화', '수', '목', '금', '토']
  return `${ts.getMonth() + 1}/${ts.getDate()} (${DOW[ts.getDay()]})`
}

function groupNotifs(notifs: Notif[]): Array<{ label: string; items: Notif[] }> {
  const sorted = [...notifs].sort((a, b) => b.ts.getTime() - a.ts.getTime())
  const map = new Map<string, Notif[]>()
  for (const n of sorted) {
    const label = fmtGroupLabel(n.ts)
    if (!map.has(label)) map.set(label, [])
    map.get(label)!.push(n)
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }))
}

const UNREAD_DOT_COLOR: Partial<Record<NotifType, string>> = {
  failure:            'bg-danger',
  apply_failure:      'bg-danger',
  // 2026-04-09: 튜닝/자동튜닝 완료 = AI 성공 마일스톤 → success(에메랄드)
  tuning_complete:    'bg-success',
  batch_complete:     'bg-success',
  recurring_complete: 'bg-success',
  // apply_complete = applied 상태 = 운영 반영 종결 → success(에메랄드)
  apply_complete:     'bg-success',
  // 진짜 주의가 필요한 경우만 warning amber 사용
  auto_stopped:       'bg-warning',
  manual_stopped:     'bg-warning',
}
function unreadDotColor(type: NotifType): string {
  return UNREAD_DOT_COLOR[type] ?? 'bg-code'
}

const TYPE_META: Record<NotifType, { label: string; color: string }> = {
  running_start:      { label: '실행 시작',         color: 'text-code' },
  // 2026-04-09: 튜닝/자동튜닝 완료 = AI 성공 마일스톤 → success
  tuning_complete:    { label: '튜닝 완료',          color: 'text-success-dark' },
  batch_complete:     { label: '자동튜닝 완료',       color: 'text-success-dark' },
  recurring_complete: { label: '반복 자동튜닝 완료',  color: 'text-success-dark' },
  failure:            { label: '튜닝 실패',          color: 'text-danger' },
  // 반영 완료 = 운영 반영 종결 → success
  apply_complete:     { label: '반영 완료',          color: 'text-success-dark' },
  apply_failure:      { label: '반영 실패',          color: 'text-danger' },
  // 자동 중단·큐 일시정지는 진짜 주의 → warning amber 유지
  auto_stopped:       { label: '자동 중단',          color: 'text-warning-dark' },
  manual_stopped:     { label: '큐 일시정지',        color: 'text-warning-dark' },
  queue_resumed:      { label: '큐 재개',            color: 'text-code' },
}

function fmtElapsed(sec: number) {
  const m = Math.floor(sec / 60), s = sec % 60
  return m === 0 ? `${s}초` : `${m}분 ${String(s).padStart(2, '0')}초`
}

/* ─── Notification Card ──────────────────────────────────── */

function NotifCard({
  notif,
  onStop,
  onRetry,
  onResume,
  onNavigate,
}: {
  notif: Notif
  onStop: (id: string) => void
  onRetry: (id: string) => void
  onResume: (id: string) => void
  onNavigate: (id: string, path: string) => void
}) {
  const meta = TYPE_META[notif.type]
  const targetPath = notif.workId ? `/work/${notif.workId}` : '/work'

  const actionLink = (label: string, path: string) => (
    <button
      onClick={() => onNavigate(notif.id, path)}
      className="inline-flex items-center gap-0.5 text-[10px] font-medium text-code hover:text-code-dark transition-colors"
    >
      {label} <ChevronRight size={10} />
    </button>
  )

  return (
    <div className={`flex gap-2.5 px-4 py-3 hover:bg-surface-alt transition-colors ${!notif.read ? 'bg-white' : ''}`}>
      {/* Unread dot */}
      <div className="shrink-0 pt-[5px]">
        <span className={`block h-1.5 w-1.5 rounded-full ${notif.read ? 'bg-transparent' : unreadDotColor(notif.type)}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Type + time */}
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[11px] font-semibold ${meta.color}`}>{meta.label}</span>
          <span className="text-[10px] text-text-muted tabular-nums shrink-0">{fmtRelTime(notif.ts)}</span>
        </div>

        {/* SQL text or preset + instance row */}
        {notif.sqlText ? (
          <p className="truncate font-mono text-[11px] text-text-primary">{notif.sqlText}</p>
        ) : (
          <p className="text-[11px] font-medium text-text-primary">
            {notif.requestLabel}
            {notif.recurringLabel && <span className="ml-1 text-text-muted font-normal">{notif.recurringLabel}</span>}
          </p>
        )}

        {/* Instance + request label */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${instCls(notif.instanceType)}`}>
            {notif.instance}
          </span>
          {notif.sqlText && (
            <span className="text-[10px] text-text-muted">{notif.requestLabel}</span>
          )}
        </div>

        {/* Type-specific 4th line */}
        {notif.type === 'tuning_complete' && notif.beforeTime && (
          <p className="text-[10px] text-text-secondary">
            응답시간 {notif.beforeTime} → {notif.afterTime}
            <span className="ml-1 text-success-dark font-medium">▼{notif.improvePct}%</span>
          </p>
        )}
        {notif.type === 'failure' && notif.errorMsg && (
          <p className="truncate text-[10px] text-danger">{notif.errorMsg}</p>
        )}
        {notif.type === 'apply_complete' && notif.applyObjects && notif.applyObjects.length > 0 && (
          <p className="truncate text-[10px] text-text-secondary">
            대상: <span className="font-mono text-text-primary">{notif.applyObjects.join(', ')}</span>
          </p>
        )}
        {notif.type === 'apply_failure' && notif.applyErrorMsg && (
          <p className="truncate text-[10px] text-danger">{notif.applyErrorMsg}</p>
        )}
        {notif.type === 'auto_stopped' && notif.stopReason && (
          <p className="text-[10px] text-warning-dark">사유: {notif.stopReason}</p>
        )}
        {notif.type === 'manual_stopped' && (
          <p className="text-[10px] text-warning-dark">
            대기 {notif.pendingCount ?? 0}건 일시정지 중
          </p>
        )}
        {(notif.type === 'batch_complete' || notif.type === 'recurring_complete') && (
          <p className="text-[10px] text-text-secondary">
            {notif.completedCount != null && <span className="text-success-dark font-medium">완료 {notif.completedCount}건</span>}
            {notif.failedCount != null && notif.failedCount > 0 && (
              <span className="text-danger font-medium"> · 실패 {notif.failedCount}건</span>
            )}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-1.5 pt-0.5">
          {/* 1. 시작: 중지 버튼 */}
          {notif.type === 'running_start' && (
            notif.stopped ? (
              <span className="text-[10px] text-text-muted">중지됨</span>
            ) : (
              <>
                <button
                  onClick={() => onStop(notif.id)}
                  className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-danger hover:bg-danger-bg transition-colors"
                >
                  <Square size={8} className="fill-danger" />
                  중지
                </button>
                <span className="text-text-muted/40">·</span>
                {actionLink('작업상세', targetPath)}
              </>
            )
          )}

          {/* 2. 완료: 검토하기 */}
          {notif.type === 'tuning_complete' && actionLink('검토하기', targetPath)}

          {/* 3. 실패: 재시도 + 상세 */}
          {notif.type === 'failure' && (
            <>
              {notif.retried ? (
                <span className="text-[10px] text-text-muted">재시도 요청됨</span>
              ) : (
                <button
                  onClick={() => onRetry(notif.id)}
                  className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-code hover:bg-code-bg transition-colors"
                >
                  <RotateCcw size={9} />
                  재시도
                </button>
              )}
              <span className="text-text-muted/40">·</span>
              {actionLink('상세', targetPath)}
            </>
          )}

          {/* 4. 반영완료: 작업상세 */}
          {notif.type === 'apply_complete' && actionLink('작업상세', targetPath)}

          {/* 5. 반영실패: 재시도 */}
          {notif.type === 'apply_failure' && (
            <>
              {notif.retried ? (
                <span className="text-[10px] text-text-muted">재시도 요청됨</span>
              ) : (
                <button
                  onClick={() => onRetry(notif.id)}
                  className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-code hover:bg-code-bg transition-colors"
                >
                  <RotateCcw size={9} />
                  재시도
                </button>
              )}
              <span className="text-text-muted/40">·</span>
              {actionLink('작업상세', targetPath)}
            </>
          )}

          {/* 기타 레거시 타입 */}
          {notif.type === 'auto_stopped' && actionLink('상세 확인', targetPath)}
          {(notif.type === 'batch_complete' || notif.type === 'recurring_complete') && actionLink('요청 결과 보기', '/work')}

          {/* 큐 중지/재개 */}
          {notif.type === 'manual_stopped' && (
            <>
              <button
                onClick={() => onResume(notif.id)}
                className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-code hover:bg-code-bg transition-colors"
              >
                <Play size={9} className="fill-code" />
                재개
              </button>
              <span className="text-text-muted/40">·</span>
              {actionLink('실행큐', '/queue')}
            </>
          )}
          {notif.type === 'queue_resumed' && actionLink('실행큐', '/queue')}
        </div>
      </div>
    </div>
  )
}

/* ─── NotificationDropdown ───────────────────────────────── */

export default function NotificationDropdown() {
  const navigate = useNavigate()
  const { handleConfirmStop: pauseQueue, handleResume: resumeQueue, isPaused } = useQueue()
  const { notifs, unreadCount, markAllRead, markRead, markStopped, markRetried } = useNotifications()
  const [open, setOpen] = useState(false)
  const [stopConfirmId, setStopConfirmId] = useState<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Click outside to close
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleNavigate = useCallback((id: string, path: string) => {
    markRead(id)
    setOpen(false)
    navigate(path)
  }, [markRead, navigate])

  const handleRetry = useCallback((id: string) => {
    const notif = notifs.find(n => n.id === id)
    if (notif?.workId) {
      const targetStatus = notif.type === 'apply_failure' ? 'apply_pending' : 'pending'
      setGlobalStatusOverride(notif.workId, targetStatus)
    }
    markRetried(id)
    markRead(id)
    showToast({ message: '재시도 요청을 큐에 추가했습니다', variant: 'info' })
  }, [notifs, markRetried, markRead])

  const handleResumeFromNotif = useCallback((id: string) => {
    markRead(id)
    if (isPaused) resumeQueue()
  }, [markRead, isPaused, resumeQueue])

  const handleConfirmStop = useCallback(() => {
    if (!stopConfirmId) return
    markStopped(stopConfirmId)
    markRead(stopConfirmId)
    setStopConfirmId(null)
    // 알림에서 중지한 작업도 전역 큐를 일시정지시킴 (중복 토스트 방지: 위임)
    pauseQueue()
  }, [stopConfirmId, markStopped, markRead, pauseQueue])

  const groups = groupNotifs(notifs)
  const stopTarget = notifs.find((n) => n.id === stopConfirmId)

  return (
    <>
      <div ref={wrapperRef} className="relative">
        {/* Trigger */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="알림"
          className="relative flex items-center justify-center rounded-md p-1.5 text-text-secondary hover:bg-surface-muted hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/30"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-0.5 text-[9px] font-bold text-white leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute right-0 top-[calc(100%+6px)] w-[340px] rounded-xl border border-border bg-white shadow-lg z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
              <span className="text-[12px] font-semibold text-text-primary">알림</span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10px] font-medium text-code hover:text-code-dark transition-colors"
                >
                  모두 읽음 처리
                </button>
              )}
            </div>

            {/* Content */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(60vh / 1.1)' }}>
              {groups.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-[11px] text-text-muted">
                  알림이 없습니다
                </div>
              ) : (
                groups.map(({ label, items }) => (
                  <div key={label}>
                    {/* Date label */}
                    <div className="sticky top-0 bg-surface-alt px-4 py-1.5 border-b border-border">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        {label}
                      </span>
                    </div>
                    {/* Cards */}
                    <div className="divide-y divide-border/60">
                      {items.map((n) => (
                        <NotifCard
                          key={n.id}
                          notif={n}
                          onStop={(id) => setStopConfirmId(id)}
                          onRetry={handleRetry}
                          onResume={handleResumeFromNotif}
                          onNavigate={handleNavigate}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stop confirm dialog */}
      <ConfirmDialog
        open={stopConfirmId !== null}
        title="작업 중지"
        message={
          stopTarget
            ? `"${(stopTarget.sqlText ?? '').slice(0, 60)}…"\n${stopTarget.instance} · ${fmtElapsed(stopTarget.elapsedSec ?? 0)}\n\n이 작업을 중지하면 큐가 일시정지됩니다.\n(다음 건이 자동으로 실행되지 않습니다)\n\n계속하시겠습니까?`
            : ''
        }
        variant="danger"
        confirmLabel="중지"
        onConfirm={handleConfirmStop}
        onCancel={() => setStopConfirmId(null)}
      />
    </>
  )
}
