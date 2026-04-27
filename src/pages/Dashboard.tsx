import type { ReactNode } from 'react'
import { useState, useEffect } from 'react'
import { fetchTuningRequests, type TuningRequestSummary } from '../lib/api'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Square, Play, Pause, BarChart3, Crosshair, FilePlus } from 'lucide-react'
import CostSweepHero from '../components/common/CostSweepHero'
import ProgressStepBar, { type ProgressStepNumber, stepToPercent } from '../components/common/ProgressStepBar'
import { BatchQueueRow } from '../components/common/AiQueueIndicator'
import { useQueue, instCls, fmtElapsed, nextInQueue, totalPending } from '../contexts/QueueContext'

/* ─── Status line — workItems에서 파생 ───────────────────── */

// [F-3] backend tuning_requests 기반 동적 stats — Dashboard 마운트 시 fetch + 5초 polling
let STATUS = {
  running:         0,
  tuningPending:   0,
  approvalPending: 0,
  applyPending:    0,
  appliedThisWeek: 0,
}
let _dashboardListeners: Array<() => void> = []
function _notifyDashboard() { _dashboardListeners.forEach(l => l()) }
function _truncate(s: string | null | undefined, n: number) { return (s ?? '').length > n ? (s ?? '').slice(0, n) + '…' : (s ?? '') }
function _summaryToDashboardItem(r: TuningRequestSummary): DashboardWorkItem {
  return {
    id: `BE-${r.id}`,
    sqlId: r.asis_sql_id_hash ?? `BE-${r.id}`,
    workName: (r.alias ?? '').trim() || _truncate(r.source_sql_text_preview, 60) || `튜닝 요청 #${r.id}`,
    instanceName: r.instance_name ?? '-',
    schemaName: r.schema_name ?? '',
    recommendationType: 'hint',
    improvementRate: r.improvement_pct != null ? Math.round(r.improvement_pct * 100) : undefined,
    originalElapsed: r.before_elapsed_sec != null ? Math.round(r.before_elapsed_sec * 1000) : 0,
    tunedElapsed: r.after_elapsed_sec != null ? Math.round(r.after_elapsed_sec * 1000) : undefined,
    updatedAt: r.completed_at ?? r.requested_at ?? '',
  }
}
async function _refreshDashboard() {
  try {
    const rows = await fetchTuningRequests({ limit: 1000 })
    const oneWeekAgo = Date.now() - 7 * 86400000
    STATUS = {
      running:         rows.filter(r => r.status === 'tuning' || r.status === 'requested').length,
      tuningPending:   rows.filter(r => r.status === 'requested').length,
      approvalPending: rows.filter(r => r.status === 'completed').length,
      applyPending:    rows.filter(r => r.status === 'approved').length,
      appliedThisWeek: rows.filter(r => r.status === 'applied' && r.completed_at && new Date(r.completed_at).getTime() >= oneWeekAgo).length,
    }
    approvalItems = rows.filter(r => r.status === 'completed').slice(0, 5).map(_summaryToDashboardItem)
    applyItems    = rows.filter(r => r.status === 'approved').slice(0, 5).map(_summaryToDashboardItem)
    _notifyDashboard()
  } catch (e) { console.error('[Dashboard refresh failed]', e) }
}

/* ─── Todo: workItems에서 파생 ────────────────────────────── */

const REC_LABEL: Record<string, string> = {
  rewrite: '리라이트', hint: '힌트', index: '인덱스', plan_restore: 'Plan복원',
}

function daysAgo(dateStr: string): string {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (d === 0) return '오늘'
  return `${d}일 전`
}

function fmtSec(ms: number): string {
  return ms >= 100 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

// Mock 제거 — 실제 API 연동 전까지 빈 배열
type DashboardWorkItem = {
  id: string; workName: string; instanceName: string
  status: string; recommendationType?: string | null
  improvementRate?: number; originalElapsed: number; tunedElapsed?: number
  updatedAt: string; verifiedAt?: string | null; verifiedBy?: string | null
}
let approvalItems: DashboardWorkItem[] = []
let applyItems: DashboardWorkItem[] = []

/* ─── Shortcuts mock ─────────────────────────────────────── */

interface Shortcut {
  icon: ReactNode
  title: string
  desc: string
  path: string
  context?: string
}

const SHORTCUTS: Shortcut[] = [
  { icon: <BarChart3  size={16} />, title: 'Top SQL',      desc: '상위 SQL 분석',      path: '/candidates/top' },
  { icon: <Crosshair  size={16} />, title: 'Scatter View', desc: '이상점 탐색',         path: '/candidates/anomaly' },
  { icon: <FilePlus   size={16} />, title: '사용자 SQL입력', desc: 'SQL 텍스트 붙여넣어 튜닝', path: '/canvas' },
]

/* ═══════════════════════════════════════════════════════════
   1. StatusLine — compact pipeline summary
═══════════════════════════════════════════════════════════ */

function StatusLine() {
  const { isPaused } = useQueue()
  const navigate = useNavigate()
  const statBtn = 'flex items-center gap-1.5 rounded-md px-2 py-1 -mx-2 cursor-pointer hover:bg-[#E8F0FE] active:scale-[0.97] transition-all duration-100'

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border border-l-2 border-l-code bg-white px-5 py-2.5 text-xs">

      {/* 실행중 / 일시정지 */}
      {isPaused ? (
        <span className="flex items-center gap-1.5">
          <Pause size={11} className="fill-text-secondary text-text-secondary shrink-0" />
          <span className="font-medium text-text-secondary">일시정지</span>
        </span>
      ) : (
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-code opacity-50" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-code" />
          </span>
          <span className="text-text-muted">실행중</span>
          <span className="font-medium tabular-nums text-code">{STATUS.running}</span>
        </span>
      )}

      <span className="text-border select-none">·</span>

      <button onClick={() => navigate('/work?filter=pending,tuning')} className={statBtn}>
        <span className="text-text-muted">튜닝대기</span>
        <span className="font-medium tabular-nums text-text-primary">{STATUS.tuningPending}</span>
      </button>

      <span className="text-border select-none">·</span>

      <button onClick={() => navigate('/work?filter=approval_pending')} className={statBtn}>
        <span className="text-text-muted">튜닝완료</span>
        <span className="font-medium tabular-nums text-success-dark">{STATUS.approvalPending}</span>
      </button>

      <span className="text-border select-none">·</span>

      <button onClick={() => navigate('/work?filter=apply_pending')} className={statBtn}>
        <span className="text-text-muted">반영대기</span>
        <span className="font-medium tabular-nums text-info-dark">{STATUS.applyPending}</span>
      </button>

      <span className="text-border select-none">·</span>

      <button onClick={() => navigate('/work?filter=applied')} className={statBtn}>
        <span className="text-text-muted">이번 주 완료</span>
        <span className="font-medium tabular-nums text-text-muted">{STATUS.appliedThisWeek}</span>
      </button>

    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   2. TodoSection (right column cards)
═══════════════════════════════════════════════════════════ */

function ApprovalCard() {
  const navigate = useNavigate()
  const count = approvalItems.length
  const empty = count === 0
  const top = approvalItems.slice(0, 2)

  return (
    <div className={`flex flex-1 flex-col gap-3 rounded-lg border bg-white p-6 ${empty ? 'border-border opacity-60' : 'border-border border-l-2 border-l-success'}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-primary">튜닝완료</span>
        <span className={`text-md font-bold tabular-nums leading-tight ${empty ? 'text-text-muted' : 'text-success-dark'}`}>
          {count}
        </span>
      </div>

      {empty ? (
        <p className="text-xs text-text-muted">처리할 항목이 없습니다.</p>
      ) : (
        <div className="space-y-1.5">
          {top.map((item) => (
            <div
              key={item.id}
              onClick={() => navigate('/work?filter=approval_pending')}
              className="rounded px-2 py-1.5 -mx-2 cursor-pointer hover:bg-surface-alt active:scale-[0.99] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="flex-1 min-w-0 truncate text-xs font-medium text-text-primary">
                  {item.workName}
                </span>
                {item.improvementRate != null && item.improvementRate !== 0 ? (
                  <span className={`shrink-0 text-xs font-medium tabular-nums ${item.improvementRate > 0 ? 'text-success-dark' : 'text-danger-dark'}`}>
                    {item.improvementRate > 0 ? '▼' : '▲'}{Math.abs(item.improvementRate)}%
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="rounded bg-surface-alt px-1.5 py-0.5 text-[10px] text-text-secondary">
                  {item.instanceName}
                </span>
                <span className="rounded bg-code-bg px-1.5 py-0.5 text-[10px] text-code">
                  {REC_LABEL[item.recommendationType ?? ''] ?? item.recommendationType}
                </span>
                <span className="text-[10px] text-text-muted tabular-nums">
                  {fmtSec(item.originalElapsed)} → {fmtSec(item.tunedElapsed ?? 0)}
                </span>
              </div>
            </div>
          ))}
          {count > top.length && (
            <p className="text-[11px] text-text-muted px-2">...{count - top.length}건 더</p>
          )}
        </div>
      )}

      <button
        onClick={() => navigate('/work?filter=approval_pending')}
        className="mt-auto flex items-center gap-1 rounded-md px-2.5 py-1.5 -ml-2 text-xs font-medium text-[#1A73E8] bg-[#E8F0FE] hover:bg-[#D2E3FC] hover:text-[#1557B0] active:scale-[0.97] cursor-pointer transition-all duration-100 w-fit"
      >
        검토하러 가기 <ArrowRight size={12} />
      </button>
    </div>
  )
}

function ApplyCard() {
  const navigate = useNavigate()
  const count = applyItems.length
  const empty = count === 0
  const top = applyItems.slice(0, 2)

  return (
    <div className={`flex flex-1 flex-col gap-3 rounded-lg border bg-white p-6 ${empty ? 'border-border opacity-60' : 'border-border border-l-2 border-l-info'}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-primary">반영대기</span>
        <span className={`text-md font-bold tabular-nums leading-tight ${empty ? 'text-text-muted' : 'text-info-dark'}`}>
          {count}
        </span>
      </div>

      {empty ? (
        <p className="text-xs text-text-muted">처리할 항목이 없습니다.</p>
      ) : (
        <div className="space-y-1.5">
          {top.map((item) => (
            <div
              key={item.id}
              onClick={() => navigate('/work?filter=apply_pending')}
              className="rounded px-2 py-1.5 -mx-2 cursor-pointer hover:bg-surface-alt active:scale-[0.99] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="flex-1 min-w-0 truncate text-xs font-medium text-text-primary">
                  {item.workName}
                </span>
                <span className="shrink-0 rounded bg-surface-alt px-1.5 py-0.5 text-[10px] text-text-secondary">
                  {item.instanceName}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="rounded bg-code-bg px-1.5 py-0.5 text-[10px] text-code">
                  {REC_LABEL[item.recommendationType ?? ''] ?? item.recommendationType}
                </span>
                <span className="text-[10px] text-text-muted">
                  확인: {item.verifiedBy ?? '—'} · {daysAgo(item.verifiedAt ?? item.updatedAt)}
                </span>
              </div>
            </div>
          ))}
          {count > top.length && (
            <p className="text-[11px] text-text-muted px-2">...{count - top.length}건 더</p>
          )}
        </div>
      )}

      <button
        onClick={() => navigate('/work?filter=apply_pending')}
        className="mt-auto flex items-center gap-1 rounded-md px-2.5 py-1.5 -ml-2 text-xs font-medium text-[#1A73E8] bg-[#E8F0FE] hover:bg-[#D2E3FC] hover:text-[#1557B0] active:scale-[0.97] cursor-pointer transition-all duration-100 w-fit"
      >
        반영하러 가기 <ArrowRight size={12} />
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   QueuePreview — 대기 요청 미리보기 (최대 2건)
═══════════════════════════════════════════════════════════ */

function QueuePreview({ queueState, onOpenPanel }: { queueState: import('../contexts/QueueContext').QueueState; onOpenPanel: () => void }) {
  const pending = totalPending(queueState)

  // 단건 + 그룹을 하나의 리스트로 합침
  const allRows: { key: string; label: string; instance: string; instanceType: import('../contexts/QueueContext').InstanceKind; count: number; isStandalone: boolean }[] = [
    ...queueState.standalone.map(s => ({ key: s.id, label: s.groupLabel, instance: s.instance, instanceType: s.instanceType, count: 1, isStandalone: true })),
    ...queueState.groups.map(g => ({ key: g.id, label: g.label, instance: g.instance, instanceType: g.instanceType, count: g.items.length, isStandalone: false })),
  ]
  const preview = allRows.slice(0, 2)
  const restCount = allRows.length - 2
  let queueNum = 1

  return (
    <div className="border-t border-border px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
          대기 {pending}건
        </span>
        <button
          type="button"
          onClick={onOpenPanel}
          className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-secondary active:scale-[0.97] cursor-pointer transition-colors"
        >
          AI 실행현황 보기 <ArrowRight size={10} />
        </button>
      </div>

      <div className="space-y-1.5">
        {preview.map((row) => {
          const start = queueNum; queueNum += row.count
          return (
            <BatchQueueRow
              key={row.key}
              label={row.label}
              instance={row.instance}
              instanceType={row.instanceType}
              totalCount={row.count}
              pendingCount={row.count}
              runningCount={0}
              doneCount={0}
              failedCount={0}
              queueStart={start}
              isStandalone={row.isStandalone}
              isActive={false}
              onClick={onOpenPanel}
            />
          )
        })}
        {restCount > 0 && (
          <button
            onClick={onOpenPanel}
            className="w-full py-1.5 text-center text-[11px] text-text-muted hover:text-text-secondary cursor-pointer transition-colors"
          >
            ...{restCount}건 더 대기 중
          </button>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   3. AiStatusCard (hero, left 60%) — visual anchor
═══════════════════════════════════════════════════════════ */

function AiStatusCard() {
  const { isPaused, queueState, setConfirmStop, handleResume, currentRunning, elapsed, openPanel, navigatePanel } = useQueue()
  const nextItem = nextInQueue(queueState)
  if (!isPaused) {
    const batchTotal = currentRunning.batchTotal ?? 1
    const batchDone = currentRunning.batchDone ?? 0
    const batchPct = batchTotal > 0 ? Math.round((batchDone / batchTotal) * 100) : 0
    const stepNum = Math.min(currentRunning.currentStep + 1, 5) as ProgressStepNumber

    const openWorkDetail = () => {
      if (currentRunning.workId) {
        navigatePanel({ type: 'work-detail', workId: currentRunning.workId })
        openPanel('slide')
      }
    }

    return (
      <div className="rounded-lg border border-border border-l-2 border-l-code bg-white animate-ai-glow overflow-hidden">
        {/* ═══ 상단: 배치(요청) 레벨 ═══ */}
        <div className="px-4 pt-4 pb-3 space-y-2.5">
          {/* Header: hero + title + elapsed */}
          <div className="flex items-center gap-2">
            <CostSweepHero size="sm" />
            <span className="text-[13px] font-semibold text-text-primary">AI 튜닝 진행 중</span>
            <span className="flex-1" />
            <span className="font-mono text-[11px] tabular-nums text-text-muted">{fmtElapsed(elapsed)}</span>
          </div>

          {/* Batch name (request label) — bar 바로 위 = 근접성 */}
          <p className="text-[12px] font-medium text-text-primary truncate">
            {currentRunning.requestLabel}
          </p>

          {/* Batch bar + count — 이름 바로 아래 */}
          <div className="flex items-center gap-2.5">
            <div className="h-2 flex-1 rounded-full bg-border/30 overflow-hidden">
              <div
                className="h-full rounded-full bg-action relative overflow-hidden transition-[width] duration-500"
                style={{ width: `${batchPct}%` }}
              >
                {batchPct < 100 && <div className="absolute inset-0 tuning-gauge-shimmer" />}
              </div>
            </div>
            <span className="text-[12px] font-medium tabular-nums text-text-primary shrink-0">
              {batchDone}<span className="text-text-muted font-normal">/{batchTotal}건</span>
            </span>
          </div>
        </div>

        {/* ═══ 현재 단건 SQL — 전체 클릭 가능 ═══ */}
        <div
          onClick={openWorkDetail}
          className="border-t border-border bg-surface-alt/50 px-4 py-3 space-y-2 cursor-pointer hover:bg-surface-alt transition-colors group/sql"
        >
          {/* SQL_ID + step bar + % + stepDesc + 중지 */}
          <div className="flex items-center gap-2">
            {currentRunning.sqlId && (
              <span className="font-mono text-[11px] font-medium text-code group-hover/sql:text-code-dark group-hover/sql:underline transition-colors shrink-0">
                {currentRunning.sqlId}
              </span>
            )}
            <ProgressStepBar
              currentStep={stepNum}
              delayed={currentRunning.isDelayed}
              className="w-[80px] shrink-0"
            />
            <span className={`text-[11px] font-mono tabular-nums shrink-0 ${currentRunning.isDelayed ? 'text-warning font-medium' : 'text-text-muted'}`}>
              {stepToPercent(stepNum)}%
            </span>
            {currentRunning.stepDesc && (
              <span className={`text-[11px] truncate ${currentRunning.isDelayed ? 'text-warning font-medium' : 'text-text-secondary'}`}>
                {currentRunning.stepDesc}
              </span>
            )}
            <span className="flex-1" />
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmStop(true) }}
              className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs font-medium text-danger hover:bg-danger-bg active:scale-[0.97] cursor-pointer transition-colors"
            >
              <Square size={10} className="fill-danger" />
              중지
            </button>
          </div>

          {/* SQL TEXT — dominant within this section */}
          <p className="font-mono text-[12px] leading-relaxed text-text-primary line-clamp-2">
            {currentRunning.sqlText}
          </p>

        </div>

        {/* ═══ 대기 요청 미리보기 ═══ */}
        <QueuePreview queueState={queueState} onOpenPanel={() => openPanel('maximized')} />
      </div>
    )
  }

  // isPaused — 기존 구조 유지
  return (
    <div className="flex flex-col rounded-lg border border-border bg-white p-6 shadow-[inset_2px_0_0_0_var(--color-text-muted)]">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Pause size={14} className="fill-text-secondary text-text-secondary shrink-0" />
          <span className="text-sm font-semibold text-text-secondary">큐 일시정지됨</span>
        </div>
      </div>

      {/* 다음 실행 대기 — dominant */}
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-text-muted">다음 실행 대기</p>
      {nextItem ? (
        <>
          <p className="mb-2 font-mono text-base leading-relaxed text-text-primary line-clamp-2">
            {nextItem.sqlText}
          </p>
          <div className="mb-4 flex items-center gap-2 text-xs">
            <span className={`rounded px-1.5 py-0.5 font-medium ${instCls(nextItem.instanceType)}`}>
              {nextItem.instance}
            </span>
            <span className="text-text-muted">·</span>
            <span className="text-text-secondary">{nextItem.groupLabel}</span>
          </div>
        </>
      ) : (
        <p className="mb-4 text-sm text-text-muted">대기 중인 작업이 없습니다.</p>
      )}

      {/* Resume 버튼 — 가운데 강조 */}
      <div className="flex flex-1 flex-col justify-center">
        <div className="flex items-center justify-end">
          <button
            onClick={handleResume}
            className="inline-flex items-center gap-1.5 rounded-md bg-action px-3 py-1.5 text-xs font-semibold text-white hover:bg-action-hover active:scale-[0.97] cursor-pointer transition-colors"
          >
            <Play size={12} className="fill-white" />
            재개
          </button>
        </div>
      </div>

      {/* Next queue — 카드 하단 고정 */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <p className="flex-1 min-w-0 truncate text-xs text-text-muted">
          대기열 {totalPending(queueState)}건
        </p>
        <button
          type="button"
          onClick={() => openPanel('maximized')}
          className="ml-4 flex shrink-0 items-center gap-1 text-xs text-text-muted hover:text-text-secondary active:scale-[0.97] cursor-pointer transition-colors"
        >
          AI 실행현황 보기 <ArrowRight size={10} />
        </button>
      </div>
    </div>
  )
}

/* ─── ShortcutCard ────────────────────────────────────────── */

function ShortcutCard({ icon, title, desc, path, context }: Shortcut) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(path)}
      className="group flex flex-col gap-1.5 rounded-lg border border-border bg-white p-4 text-left cursor-pointer transition-all duration-100 hover:border-[#93C5FD] hover:bg-[#E8F0FE] hover:shadow-[0_2px_8px_rgba(26,115,232,0.10)] active:scale-[0.98]"
    >
      <div className="text-text-secondary transition-colors duration-100 group-hover:text-[#1A73E8]">{icon}</div>
      <p className="text-xs font-medium text-text-primary transition-colors duration-100 group-hover:text-[#1A73E8]">{title}</p>
      <p className="text-xs text-text-muted leading-relaxed">{desc}</p>
      {context && (
        <p className="text-xs text-code">{context}</p>
      )}
    </button>
  )
}

/* ═══════════════════════════════════════════════════════════
   Dashboard — spacing hierarchy: tighter within, wider between groups
═══════════════════════════════════════════════════════════ */

export default function Dashboard() {
  const navigate = useNavigate()
  // [F-3] backend stats 강제 리렌더 — _refreshDashboard 호출 시 listeners 가 setTick
  const [, setTick] = useState(0)
  useEffect(() => {
    const listener = () => setTick(t => t + 1)
    _dashboardListeners.push(listener)
    _refreshDashboard()
    const timer = setInterval(_refreshDashboard, 5000)
    return () => {
      clearInterval(timer)
      _dashboardListeners = _dashboardListeners.filter(l => l !== listener)
    }
  }, [])

  return (
    <div>

      {/* 1. 상태 라인 */}
      <StatusLine />

      {/* 2. 메인 영역 — 좌 40% AI 히어로 + 우 60% 할 일 (2026-04-09: Todo 우위로 전환) */}
      <div className="mt-5 grid grid-cols-[2fr_3fr] gap-6">

        {/* 좌: AI 실행 상태 (visual anchor) */}
        <AiStatusCard />

        {/* 우: 할 일 카드 — stretch로 좌측과 높이 맞춤 */}
        <div className="flex flex-col gap-4">
          <ApprovalCard />
          <ApplyCard />
        </div>

      </div>

      {/* 이번 주 완료 — 그리드 밖, 우측 정렬 */}
      <div className="mt-2 flex justify-end">
        <button
          onClick={() => navigate('/work?filter=applied')}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted hover:bg-[#E8F0FE] hover:text-[#1A73E8] active:scale-[0.97] cursor-pointer transition-all duration-100"
        >
          이번 주 반영완료 {STATUS.appliedThisWeek}건
          <ArrowRight size={12} />
        </button>
      </div>

      {/* 3. 대상 선정 바로가기 — 별도 그룹, 여백 확대 */}
      <section className="mt-6 space-y-3 pb-2">
        <p className="text-xs text-text-muted">
          새로운 튜닝 대상을 선정하려면 아래에서 방법을 선택하세요.
        </p>
        <div className="grid grid-cols-3 gap-4">
          {SHORTCUTS.map((card) => (
            <ShortcutCard key={card.path} {...card} />
          ))}
        </div>
      </section>

    </div>
  )
}
