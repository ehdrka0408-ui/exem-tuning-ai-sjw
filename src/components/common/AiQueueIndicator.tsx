import { useState, useMemo } from 'react'
import {
  Play, Square, ChevronDown, ArrowUp, Pause, ChevronRight,
  Undo2, CalendarDays, RefreshCw, Pencil, Trash2, X, Zap,
} from 'lucide-react'
import SlidePanel from './SlidePanel'
import ProgressStepBar, { type ProgressStepNumber, stepToPercent } from './ProgressStepBar'
import TuningInProgressCard from './TuningInProgressCard'
import CostSweepHero from './CostSweepHero'
import ConfirmDialog from './ConfirmDialog'
import WorkDetailPanel from '../../pages/work/WorkDetailPanel'
import ErrorBoundary from './ErrorBoundary'
import { getViewport } from '../../utils/viewport'
import { workItems, type WorkItem } from '../../mocks/workItems'
import {
  useQueue,
  fmtElapsed, instCls, totalPending, daysUntilExpiry,
  GROUP_PREVIEW,
  type QItem, type InstanceKind, type RunningItem,
  type OneTimeSchedule, type RecurringSchedule, type RecurringLastRun,
} from '../../contexts/QueueContext'

/* ─── RunningCard ────────────────────────────────────────── */

export function RunningCard({ running, elapsed, onStop, wide = false }: { running: RunningItem; elapsed: number; onStop: () => void; wide?: boolean }) {
  const { sqlText, instance, instanceType, requestLabel, currentStep, stepDesc, isDelayed } = running

  return (
    <TuningInProgressCard
      variant={wide ? 'expanded' : 'narrow'}
      currentStep={(Math.min(currentStep + 1, 5)) as ProgressStepNumber}
      elapsed={fmtElapsed(elapsed)}
      stepDescription={stepDesc}
      delayed={isDelayed}
      footer={
        wide ? (
          <div className="flex items-center justify-end">
            <button
              onClick={onStop}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-danger hover:bg-danger-bg transition-colors"
            >
              <Square size={10} className="fill-danger" />
              중지
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* SQL — dominant element */}
            <p className="font-mono text-sm leading-relaxed text-text-primary line-clamp-2">
              {sqlText}
            </p>

            {/* Meta + 중지 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs min-w-0">
                <span className={`shrink-0 rounded px-1.5 py-0.5 font-medium ${instCls(instanceType)}`}>
                  {instance}
                </span>
                <span className="text-text-muted">·</span>
                <span className="text-text-secondary truncate">{requestLabel}</span>
              </div>
              <button
                onClick={onStop}
                className="shrink-0 inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-danger hover:bg-danger-bg transition-colors"
              >
                <Square size={10} className="fill-danger" />
                중지
              </button>
            </div>
          </div>
        )
      }
    />
  )
}

/* ─── RunningBatchRow ────────────────────────────────────── */

function RunningBatchRow({ running, elapsed, onStop, onNavigateToWork, isSelected, compact }: { running: RunningItem; elapsed: number; onStop: () => void; onNavigateToWork?: (workId: string) => void; isSelected?: boolean; compact?: boolean }) {
  const { sqlText, instance, instanceType, requestLabel, currentStep, stepDesc, isDelayed } = running
  const stepNum = Math.min(currentStep + 1, 5) as ProgressStepNumber
  const pct = Math.round((currentStep / 4) * 100)
  const [expanded, setExpanded] = useState(true)

  return (
    <div className={`rounded-lg border overflow-hidden ${isSelected ? 'border-code ring-1 ring-code/20' : 'border-action/20'}`}>
      {/* ── 헤더 ── */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-start gap-2.5 px-3 py-2.5 bg-action/5 hover:bg-action/10 transition-colors text-left"
      >
        <ChevronDown
          size={13}
          className={`shrink-0 text-text-muted mt-0.5 transition-transform duration-150 ${expanded ? '' : '-rotate-90'}`}
        />

        {/* 좌: 요청명 + 인스턴스 · 경과 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12px] font-semibold text-text-primary truncate">{requestLabel}</span>
            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-action/10 text-action">
              <span className="w-1 h-1 rounded-full bg-action animate-pulse" />
              실행중
            </span>
            {isDelayed && (
              <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-warning-bg text-warning-dark">
                지연
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${instCls(instanceType)}`}>
              {instance}
            </span>
            <span className="font-mono text-[10px] text-text-muted tabular-nums">{fmtElapsed(elapsed)}</span>
          </div>
        </div>

        {/* 우: 게이지 + 중지 버튼 */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          {compact ? (
            /* compact: 퍼센트 텍스트만 */
            <span className="text-[11px] font-mono tabular-nums text-action font-medium">{pct}%</span>
          ) : (
            <div className="flex items-center gap-1.5 w-[148px]">
              <CostSweepHero size="xs" color="blue" animated className="shrink-0" />
              <div className="relative h-1.5 flex-1 bg-bg-muted rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-action transition-[width] duration-500 ease-out"
                  style={{ width: `${pct}%` }}
                >
                  <div className="absolute inset-0 tuning-gauge-shimmer" />
                </div>
              </div>
              <span className="text-[10px] font-mono tabular-nums text-text-muted shrink-0 w-[28px] text-right">
                {pct}%
              </span>
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onStop() }}
            className="inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-[10px] font-medium text-danger hover:bg-danger-bg transition-colors"
          >
            <Square size={9} className="fill-danger" />
            중지
          </button>
        </div>
      </button>

      {/* ── 펼침: 연속 바 + 퍼센트 + 설명 + SQL — 전체 클릭 가능 ── */}
      {expanded && (
        <div
          onClick={(e) => { e.stopPropagation(); running.workId && onNavigateToWork?.(running.workId) }}
          className="px-4 py-3 bg-white border-t border-action/10 space-y-2.5 cursor-pointer hover:bg-surface-alt/80 transition-colors group/detail"
        >
          <div className={`flex items-center gap-2 ${compact ? 'flex-wrap' : ''}`}>
            {running.sqlId && (
              <span className="font-mono text-[11px] font-medium text-text-primary shrink-0">
                {running.sqlId}
              </span>
            )}
            {!compact && (
              <ProgressStepBar
                currentStep={stepNum}
                delayed={isDelayed}
                className="w-[120px] shrink-0"
              />
            )}
            <span className={`text-[11px] font-mono tabular-nums shrink-0 ${isDelayed ? 'text-warning font-medium' : 'text-text-muted'}`}>
              {stepToPercent(stepNum)}%
            </span>
            {stepDesc && !compact && (
              <span className={`text-[11px] truncate ${isDelayed ? 'text-warning font-medium' : 'text-text-secondary'}`}>
                {stepDesc}
              </span>
            )}
            <span className="flex-1" />
            <span className="text-[11px] font-mono tabular-nums text-text-muted shrink-0">{fmtElapsed(elapsed)}</span>
          </div>
          <pre className="font-mono text-[12px] text-text-secondary leading-relaxed whitespace-pre-wrap line-clamp-2">
            {sqlText}
          </pre>
        </div>
      )}
    </div>
  )
}

/* ─── PausedCard ─────────────────────────────────────────── */

export function PausedCard({ onResume }: { onResume: () => void }) {
  return (
    <div className="rounded-lg border border-warning/30 bg-warning-bg/40 px-3 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Pause size={12} className="fill-warning-dark text-warning-dark shrink-0" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-warning-dark">큐 일시정지됨</p>
          <p className="text-[10px] text-text-secondary">아래 #1부터 다시 실행됩니다. 취소하려면 ✕ 클릭.</p>
        </div>
      </div>
      <button
        onClick={onResume}
        className="shrink-0 inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-[11px] font-semibold bg-action text-white hover:bg-action-hover transition-colors"
      >
        <Play size={10} className="fill-current" />
        재개
      </button>
    </div>
  )
}

/* ─── Section Header ─────────────────────────────────────── */

export function SectionHeader({ label, count, pulse }: { label: string; count?: number; pulse?: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Play
        size={9}
        className={`fill-current shrink-0 ${pulse ? 'text-code animate-pulse' : 'text-text-muted'}`}
      />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
        {label}
      </span>
      {count != null && (
        <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-text-muted">
          {count}
        </span>
      )}
    </div>
  )
}

/* ─── Held Card ───────────────────────────────────────────── */

function HeldCard({ item, onRestore, onDelete }: { item: QItem; onRestore: () => void; onDelete: () => void }) {
  const days = item.heldAt != null ? daysUntilExpiry(item.heldAt) : null
  // D-2 이하면 경고, 그 외는 조용한 톤
  const isWarning = days != null && days <= 2
  const ttlCls = isWarning
    ? 'bg-warning-bg text-warning-dark'
    : 'bg-surface-muted text-text-muted'

  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2.5 space-y-1.5 transition-all duration-100 hover:bg-slate-50 hover:shadow-[inset_3px_0_0_0_var(--color-border)]">
      <div className="flex items-start justify-between gap-2">
        <p className="flex-1 min-w-0 truncate font-mono text-[11px] text-text-primary">{item.sqlText}</p>
        {days != null && (
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${ttlCls}`}>
            D-{Math.max(0, days)}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${instCls(item.instanceType)}`}>
            {item.instance}
          </span>
          <span className="text-[10px] text-text-muted truncate">{item.groupLabel}</span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onRestore}
            className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-text-secondary hover:bg-surface-muted hover:text-text-primary transition-colors"
          >
            <Undo2 size={9} />
            복귀
          </button>
          <button
            onClick={onDelete}
            aria-label="보류건 삭제"
            className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-text-muted hover:bg-danger-bg hover:text-danger transition-colors"
          >
            <Trash2 size={9} />
            삭제
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Group Item Row ──────────────────────────────────────── */

function GroupItemRow({ item, queueNum, groupLabel, instance, instanceType, onMoveToTop, onHold, onCancel, onNavigateToWork, paused, isActive }: {
  item: QItem
  queueNum: number
  groupLabel: string
  instance: string
  instanceType: InstanceKind
  onMoveToTop: () => void
  onHold: () => void
  onCancel: () => void
  onNavigateToWork?: (workId: string) => void
  paused: boolean
  isActive?: boolean
}) {
  const isFirst = queueNum === 1
  const canNavigate = !!item.workId && !!onNavigateToWork
  return (
    <div
      onClick={() => canNavigate && onNavigateToWork!(item.workId!)}
      className={`group flex items-start gap-2 px-3 py-2 transition-colors duration-100 ${
        canNavigate ? 'cursor-pointer' : ''
      } ${isActive ? 'bg-code-bg' : ''} hover:bg-surface-alt hover:shadow-[inset_3px_0_0_0_var(--color-border)]`}
    >
      <span className="shrink-0 w-5 text-right font-mono text-[10px] tabular-nums text-text-muted pt-px">
        #{queueNum}
      </span>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="truncate font-mono text-[11px] text-text-primary">
          {item.sqlText}
        </p>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${instCls(instanceType)}`}>
            {instance}
          </span>
          <span className="text-[10px] text-text-secondary truncate">{groupLabel}</span>
        </div>
      </div>
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 transition-opacity duration-100" onClick={(e) => e.stopPropagation()}>
        {!isFirst && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveToTop() }}
            className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-text-muted hover:bg-surface-muted hover:text-text-primary transition-colors"
          >
            <ArrowUp size={9} />
            맨 위로
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onHold() }}
          className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-text-muted hover:bg-surface-muted hover:text-text-primary transition-colors"
        >
          <Pause size={9} />
          보류
        </button>
        {paused && (
          <button
            onClick={(e) => { e.stopPropagation(); onCancel() }}
            className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-text-muted hover:bg-danger-bg hover:text-danger transition-colors"
            aria-label="큐에서 제거"
          >
            <X size={9} />
            취소
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── BatchQueueRow ─────────────────────────────────────── */
// 배치뷰(WorkPipeline)와 동일한 시각 어휘 — 요청 단위 카드

export function BatchQueueRow({
  label, instance, instanceType, totalCount, pendingCount,
  runningCount, doneCount, failedCount, queueStart, isStandalone, isActive, children,
  onClick,
}: {
  label: string
  instance: string
  instanceType: InstanceKind
  totalCount: number
  pendingCount: number
  runningCount: number
  doneCount: number
  failedCount: number
  queueStart: number
  isStandalone: boolean
  isActive: boolean
  children?: React.ReactNode
  onClick?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const hasChildren = !!children
  const completedCnt = doneCount + failedCount
  const pct = totalCount > 0 ? Math.round((completedCnt / totalCount) * 100) : 0
  const queueEnd = queueStart + totalCount - 1
  const queueLabel = totalCount === 1 ? `전체 #${queueStart}` : `전체 #${queueStart}–${queueEnd}`

  return (
    <div className="rounded-lg border border-border overflow-hidden transition-shadow duration-100 hover:shadow-[inset_3px_0_0_0_var(--color-border)]">
      {/* ── 헤더 (배치뷰 동일 레이아웃) ── */}
      <button
        onClick={() => hasChildren ? setExpanded(v => !v) : onClick?.()}
        className="flex w-full items-start gap-2.5 px-3 py-2.5 bg-white hover:bg-slate-50 transition-colors duration-100 text-left cursor-pointer"
      >
        {hasChildren ? (
          <ChevronDown
            size={13}
            className={`shrink-0 text-text-muted mt-0.5 transition-transform duration-150 ${expanded ? '' : '-rotate-90'}`}
          />
        ) : (
          <span className="w-[13px] shrink-0" />
        )}

        {/* 좌: 요청명 + 인스턴스 · 큐 위치 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12px] font-semibold text-text-primary truncate">
              {label}
            </span>
            {isActive && (
              <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-action/10 text-action">
                <span className="w-1 h-1 rounded-full bg-action animate-pulse" />
                실행중
              </span>
            )}
            {isStandalone && (
              <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-bg-muted text-text-muted">
                단건
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${instCls(instanceType)}`}>
              {instance}
            </span>
            <span className="text-[10px] text-text-muted font-mono tabular-nums">{queueLabel}</span>
          </div>
        </div>

        {/* 우: 건수 / 게이지 + 상태 도트 건수 */}
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          {isActive ? (
            <div className="flex items-center gap-1.5 w-[148px]">
              <CostSweepHero size="xs" color="blue" animated className="shrink-0" />
              <div className="relative h-1.5 flex-1 bg-bg-muted rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out bg-action"
                  style={{ width: `${pct}%` }}
                >
                  <div className="absolute inset-0 tuning-gauge-shimmer" />
                </div>
              </div>
              <span className="text-[10px] font-mono tabular-nums text-text-muted shrink-0 w-[28px] text-right">
                {pct}%
              </span>
            </div>
          ) : (
            <span className="text-[12px] font-semibold text-text-primary tabular-nums">{totalCount}건</span>
          )}

          <div className="flex items-center gap-2 text-[10px] tabular-nums">
            <span className={`flex items-center gap-0.5 ${pendingCount > 0 ? 'text-text-secondary' : 'text-text-muted/30'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted/40 shrink-0" />
              대기 {pendingCount}
            </span>
            {runningCount > 0 && (
              <span className="flex items-center gap-0.5 text-action">
                <span className="w-1.5 h-1.5 rounded-full bg-action animate-pulse shrink-0" />
                실행 {runningCount}
              </span>
            )}
            {doneCount > 0 && (
              <span className="flex items-center gap-0.5 text-success">
                <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                완료 {doneCount}
              </span>
            )}
            {failedCount > 0 && (
              <span className="flex items-center gap-0.5 text-danger">
                <span className="w-1.5 h-1.5 rounded-full bg-danger shrink-0" />
                실패 {failedCount}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* 펼친 개별 항목 */}
      {expanded && children && (
        <div className="divide-y divide-border/50 bg-white">
          {children}
        </div>
      )}
    </div>
  )
}

/* ─── Queue Tab ──────────────────────────────────────────── */

export function QueueTab({ panelMode = 'slide', onNavigateToWork, activeWorkId, compact }: { panelMode?: 'slide' | 'maximized'; onNavigateToWork?: (workId: string) => void; activeWorkId?: string | null; compact?: boolean }) {
  const {
    currentRunning, elapsed, isPaused, queueState,
    handleMoveToTop, handleHold, handleRestore, handleDeleteHeld, handleCancelQueueItem,
    setConfirmStop, handleResume,
  } = useQueue()

  const [deleteHeldTarget, setDeleteHeldTarget] = useState<QItem | null>(null)
  const [cancelTarget, setCancelTarget] = useState<QItem | null>(null)
  // 그룹별 "더 보기" 상태
  const [showAllMap, setShowAllMap] = useState<Record<string, boolean>>({})

  const wide = panelMode === 'maximized'

  // 전체 큐에서 각 그룹의 시작 번호 계산
  const groupStartNums = queueState.groups.reduce<number[]>((acc, _, idx) => {
    const prev = idx === 0
      ? queueState.standalone.length + 1
      : acc[idx - 1] + queueState.groups[idx - 1].items.length
    return [...acc, prev]
  }, [])

  return (
    <div className="space-y-6">
      <section>
        {isPaused ? (
          <>
            <SectionHeader label="일시정지" />
            <PausedCard onResume={handleResume} />
          </>
        ) : (
          <>
            <SectionHeader label="실행 중" pulse />
            <RunningBatchRow running={currentRunning} elapsed={elapsed} onStop={() => setConfirmStop(true)} onNavigateToWork={onNavigateToWork} isSelected={activeWorkId != null && activeWorkId === currentRunning.workId} compact={compact} />
          </>
        )}
      </section>

      <section>
        <SectionHeader label="대기" count={totalPending(queueState)} />
        <div className="space-y-2">
          {/* 단건 — BatchQueueRow(단건 뱃지) */}
          {queueState.standalone.map((item, idx) => (
            <BatchQueueRow
              key={item.id}
              label={item.groupLabel}
              instance={item.instance}
              instanceType={item.instanceType}
              totalCount={1}
              pendingCount={1}
              runningCount={0}
              doneCount={0}
              failedCount={0}
              queueStart={idx + 1}
              isStandalone={true}
              isActive={false}
            >
              <GroupItemRow
                item={item}
                queueNum={idx + 1}
                groupLabel={item.groupLabel}
                instance={item.instance}
                instanceType={item.instanceType}
                onMoveToTop={() => handleMoveToTop(item)}
                onHold={() => handleHold(item)}
                onCancel={() => setCancelTarget(item)}
                onNavigateToWork={onNavigateToWork}
                paused={isPaused}
                isActive={activeWorkId != null && activeWorkId === item.workId}
              />
            </BatchQueueRow>
          ))}

          {/* 그룹 — BatchQueueRow(건수 뱃지) */}
          {queueState.groups.map((group, gIdx) => {
            const startNum = groupStartNums[gIdx]
            const showAll = showAllMap[group.id] ?? false
            const visible = showAll ? group.items : group.items.slice(0, GROUP_PREVIEW)
            const hiddenCnt = group.items.length - GROUP_PREVIEW
            return (
              <BatchQueueRow
                key={group.id}
                label={group.label}
                instance={group.instance}
                instanceType={group.instanceType}
                totalCount={group.items.length}
                pendingCount={group.items.length}
                runningCount={0}
                doneCount={0}
                failedCount={0}
                queueStart={startNum}
                isStandalone={false}
                isActive={false}
              >
                {visible.map((item, idx) => (
                  <GroupItemRow
                    key={item.id}
                    item={item}
                    queueNum={startNum + idx}
                    groupLabel={group.label}
                    instance={group.instance}
                    instanceType={group.instanceType}
                    onMoveToTop={() => handleMoveToTop(item)}
                    onHold={() => handleHold(item)}
                    onCancel={() => setCancelTarget(item)}
                    onNavigateToWork={onNavigateToWork}
                    paused={isPaused}
                    isActive={activeWorkId != null && activeWorkId === item.workId}
                  />
                ))}
                {!showAll && hiddenCnt > 0 && (
                  <button
                    onClick={() => setShowAllMap(m => ({ ...m, [group.id]: true }))}
                    className="w-full py-2 text-center text-[11px] text-code hover:text-code-dark hover:bg-bg-alt transition-colors"
                  >
                    …{hiddenCnt}건 더 보기
                  </button>
                )}
              </BatchQueueRow>
            )
          })}
        </div>
      </section>

      {queueState.held.length > 0 && (
        <section>
          <SectionHeader label="보류" count={queueState.held.length} />
          <p className="mb-2 text-[10px] text-text-muted">보류한 지 7일이 지나면 자동 삭제됩니다.</p>
          <div className={wide ? 'grid grid-cols-2 gap-2' : 'space-y-1.5'}>
            {queueState.held.map((item) => (
              <HeldCard
                key={item.id}
                item={item}
                onRestore={() => handleRestore(item)}
                onDelete={() => setDeleteHeldTarget(item)}
              />
            ))}
          </div>
        </section>
      )}

      <ConfirmDialog
        open={deleteHeldTarget !== null}
        title="보류건 삭제"
        message={
          deleteHeldTarget
            ? `"${deleteHeldTarget.sqlText.slice(0, 60)}…"\n${deleteHeldTarget.instance} · ${deleteHeldTarget.groupLabel}\n\n이 보류건을 삭제하시겠습니까? 되돌릴 수 없습니다.`
            : ''
        }
        variant="danger"
        confirmLabel="삭제"
        onConfirm={() => {
          if (deleteHeldTarget) handleDeleteHeld(deleteHeldTarget)
          setDeleteHeldTarget(null)
        }}
        onCancel={() => setDeleteHeldTarget(null)}
      />

      <ConfirmDialog
        open={cancelTarget !== null}
        title="큐에서 제거"
        message={
          cancelTarget
            ? `"${cancelTarget.sqlText.slice(0, 60)}…"\n${cancelTarget.instance} · ${cancelTarget.groupLabel}\n\n이 작업을 큐에서 제거하시겠습니까? 되돌릴 수 없습니다.`
            : ''
        }
        variant="danger"
        confirmLabel="제거"
        onConfirm={() => {
          if (cancelTarget) handleCancelQueueItem(cancelTarget)
          setCancelTarget(null)
        }}
        onCancel={() => setCancelTarget(null)}
      />

    </div>
  )
}

/* ─── OneTimeScheduleRow ─────────────────────────────────── */

function OneTimeScheduleRow({ s, onRunNow, onConfirmCancel }: {
  s: OneTimeSchedule
  onRunNow: () => void
  onConfirmCancel: () => void
}) {
  const { setOneTime } = useQueue()
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editDate, setEditDate] = useState(s.scheduledDate)
  const [editTime, setEditTime] = useState(s.scheduledTime)

  const handleConfirm = () => {
    setOneTime(prev => prev.map(x => x.id === s.id ? { ...x, scheduledDate: editDate, scheduledTime: editTime } : x))
    setEditing(false)
    showToast('예약 시간이 변경되었습니다', 'info')
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-start gap-2.5 px-3 py-2.5 bg-bg-alt hover:bg-bg-muted transition-colors text-left"
      >
        <ChevronDown size={13} className={`shrink-0 text-text-muted mt-0.5 transition-transform duration-150 ${expanded ? '' : '-rotate-90'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12px] font-semibold text-text-primary truncate">{s.label}</span>
            <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-info-bg text-info">예약됨</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${instCls(s.instanceType)}`}>{s.instance}</span>
            <CalendarDays size={9} className="text-text-muted shrink-0" />
            <span className="font-mono text-[10px] text-text-muted">{s.scheduledDate} {s.scheduledDow} {s.scheduledTime}</span>
          </div>
        </div>
        <span className="shrink-0 text-[12px] font-semibold text-text-primary tabular-nums">{s.sqlCount}건</span>
      </button>
      {expanded && (
        <div className="px-4 py-3 bg-white border-t border-border">
          {editing ? (
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                className="flex-1 min-w-[120px] rounded border border-border px-2 py-1 text-[11px] font-mono text-text-primary focus:outline-none focus:border-code" />
              <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)}
                className="w-24 rounded border border-border px-2 py-1 text-[11px] font-mono text-text-primary focus:outline-none focus:border-code" />
              <button onClick={handleConfirm}
                className="rounded px-2.5 py-1 text-[11px] font-medium bg-action text-white hover:bg-action-hover transition-colors">확인</button>
              <button onClick={() => setEditing(false)}
                className="rounded px-2.5 py-1 text-[11px] text-text-muted hover:bg-surface-muted transition-colors">취소</button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={onRunNow}
                className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium text-code hover:bg-code-bg transition-colors"
                title="예약 시각이 도래했다고 가정 — AI 실행현황으로 즉시 이동">
                <Zap size={10} />지금 실행
              </button>
              <button onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:bg-surface-muted transition-colors">
                <Pencil size={10} />시간 변경
              </button>
              <button onClick={onConfirmCancel}
                className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium text-danger hover:bg-danger-bg transition-colors">
                예약 취소
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── RecurringScheduleRow ───────────────────────────────── */

function RecurringScheduleRow({ r, onConfirmDelete }: {
  r: RecurringSchedule
  onConfirmDelete: () => void
}) {
  const { setRecurring } = useQueue()
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editPeriod, setEditPeriod] = useState(r.period)
  const [editRecTime, setEditRecTime] = useState(r.time)

  const handleConfirm = () => {
    setRecurring(prev => prev.map(x => x.id === r.id ? { ...x, period: editPeriod, time: editRecTime } : x))
    setEditing(false)
    showToast('반복 설정이 변경되었습니다', 'info')
  }

  const handleToggleActive = () => {
    setRecurring(prev => prev.map(x => {
      if (x.id !== r.id) return x
      const next = !x.active
      showToast(next ? '반복 예약이 재개되었습니다' : '반복 예약이 중지되었습니다', next ? 'info' : 'warning')
      return { ...x, active: next }
    }))
  }

  return (
    <div className={`rounded-lg border overflow-hidden ${r.active ? 'border-border' : 'border-border/60'}`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className={`flex w-full items-start gap-2.5 px-3 py-2.5 transition-colors text-left ${r.active ? 'bg-bg-alt hover:bg-bg-muted' : 'bg-surface-alt hover:bg-surface-muted'}`}
      >
        <ChevronDown size={13} className={`shrink-0 text-text-muted mt-0.5 transition-transform duration-150 ${expanded ? '' : '-rotate-90'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[12px] font-semibold truncate ${r.active ? 'text-text-primary' : 'text-text-muted'}`}>{r.label}</span>
            <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${r.active ? 'bg-success-bg text-success' : 'bg-surface-muted text-text-muted'}`}>
              {r.active && <span className="w-1 h-1 rounded-full bg-success animate-pulse" />}
              {r.active ? '활성' : '중지'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${instCls(r.instanceType)}`}>{r.instance}</span>
            <RefreshCw size={9} className="text-text-muted shrink-0" />
            <span className="text-[10px] text-text-muted">{r.period} {r.time}</span>
          </div>
        </div>
      </button>
      {expanded && (
        <div className="bg-white border-t border-border divide-y divide-border/50">
          {/* 직전 실행 결과 */}
          {r.lastRun && <LastRunBar lastRun={r.lastRun} />}

          <div className="px-4 py-3">
          {editing ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="shrink-0 text-[10px] text-text-muted w-8">주기</label>
                <select value={editPeriod} onChange={e => setEditPeriod(e.target.value)}
                  className="flex-1 rounded border border-border px-2 py-1 text-[11px] text-text-primary focus:outline-none focus:border-code">
                  <option>매일</option>
                  <option>매주 월요일</option>
                  <option>매주 화요일</option>
                  <option>매주 수요일</option>
                  <option>매주 목요일</option>
                  <option>매주 금요일</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="shrink-0 text-[10px] text-text-muted w-8">시간</label>
                <input type="time" value={editRecTime} onChange={e => setEditRecTime(e.target.value)}
                  className="rounded border border-border px-2 py-1 text-[11px] font-mono text-text-primary focus:outline-none focus:border-code" />
              </div>
              <div className="flex justify-end gap-1">
                <button onClick={handleConfirm}
                  className="rounded px-2.5 py-1 text-[11px] font-medium bg-action text-white hover:bg-action-hover transition-colors">확인</button>
                <button onClick={() => setEditing(false)}
                  className="rounded px-2.5 py-1 text-[11px] text-text-muted hover:bg-surface-muted transition-colors">취소</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:bg-surface-muted transition-colors">
                <Pencil size={10} />수정
              </button>
              <button onClick={handleToggleActive}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${r.active ? 'text-text-secondary hover:bg-surface-muted' : 'text-code hover:bg-code-bg'}`}>
                {r.active ? <><Pause size={10} />중지</> : <><Play size={10} className="fill-current" />재개</>}
              </button>
              {!r.active && (
                <button onClick={onConfirmDelete}
                  className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium text-danger hover:bg-danger-bg transition-colors">
                  <Trash2 size={10} />삭제
                </button>
              )}
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── LastRunBar ─────────────────────────────────────────── */

function LastRunBar({ lastRun }: { lastRun: RecurringLastRun }) {
  const { totalCount, successCount, failedCount, elapsedSec, date, time } = lastRun
  const m = Math.floor(elapsedSec / 60)
  const s = elapsedSec % 60
  const elapsedLabel = m > 0 ? `${m}분 ${String(s).padStart(2, '0')}초` : `${s}초`
  const allOk = failedCount === 0

  return (
    <div className="px-4 py-2.5 flex items-center gap-3 flex-wrap bg-surface-alt/60">
      <span className="text-[10px] font-medium text-text-muted shrink-0">직전 실행</span>
      <span className="font-mono text-[10px] text-text-secondary shrink-0">{date} {time}</span>
      <span className="text-[10px] text-text-muted shrink-0">총 {totalCount}건</span>
      <span className={`text-[10px] font-medium shrink-0 ${allOk ? 'text-success' : 'text-text-secondary'}`}>
        성공 {successCount}
      </span>
      {failedCount > 0 && (
        <span className="text-[10px] font-medium text-danger shrink-0">실패 {failedCount}</span>
      )}
      <span className="font-mono text-[10px] text-text-muted shrink-0">{elapsedLabel}</span>
    </div>
  )
}

/* ─── Schedule Tab ───────────────────────────────────────── */

type ConfirmKind =
  | { type: 'cancelSchedule'; id: string }
  | { type: 'deleteRecurring'; id: string }

export function ScheduleTab() {
  const { oneTime, setOneTime, recurring, setRecurring, runScheduleNow } = useQueue()
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null)

  const handleCancelSchedule = (id: string) => {
    setOneTime(prev => prev.filter(s => s.id !== id))
    setConfirmKind(null)
    showToast('예약이 취소되었습니다', 'warning')
  }

  const handleDeleteRecurring = (id: string) => {
    setRecurring(prev => prev.filter(r => r.id !== id))
    setConfirmKind(null)
    showToast('반복 예약이 삭제되었습니다', 'warning')
  }

  return (
    <div className="space-y-6">
      <section>
        <SectionHeader label="1회 예약" count={oneTime.length} />
        {oneTime.length === 0 ? <EmptySchedule /> : (
          <div className="space-y-2">
            {oneTime.map(s => (
              <OneTimeScheduleRow
                key={s.id}
                s={s}
                onRunNow={() => runScheduleNow(s.id)}
                onConfirmCancel={() => setConfirmKind({ type: 'cancelSchedule', id: s.id })}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader label="반복" count={recurring.length} />
        {recurring.length === 0 ? <EmptySchedule /> : (
          <div className="space-y-2">
            {recurring.map(r => (
              <RecurringScheduleRow
                key={r.id}
                r={r}
                onConfirmDelete={() => setConfirmKind({ type: 'deleteRecurring', id: r.id })}
              />
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmKind?.type === 'cancelSchedule'}
        title="예약 취소"
        message="이 예약을 취소하시겠습니까?"
        variant="danger"
        confirmLabel="취소"
        onConfirm={() => confirmKind && handleCancelSchedule(confirmKind.id)}
        onCancel={() => setConfirmKind(null)}
      />
      <ConfirmDialog
        open={confirmKind?.type === 'deleteRecurring'}
        title="반복 예약 삭제"
        message="이 반복 예약을 삭제하시겠습니까? 되돌릴 수 없습니다."
        variant="danger"
        confirmLabel="삭제"
        onConfirm={() => confirmKind && handleDeleteRecurring(confirmKind.id)}
        onCancel={() => setConfirmKind(null)}
      />
    </div>
  )
}

/* ─── Empty Schedule ─────────────────────────────────────── */

export function EmptySchedule() {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-5 text-center space-y-1">
      <p className="text-[11px] text-text-muted">등록된 예약이 없습니다.</p>
      <p className="text-[10px] text-text-muted">튜닝대상선정에서 프리셋을 선택하여 예약할 수 있습니다.</p>
    </div>
  )
}

/* ─── Panel Tabs ─────────────────────────────────────────── */

export function PanelTabs({ active, onChange }: { active: 'queue' | 'schedule'; onChange: (t: 'queue' | 'schedule') => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {([['queue', 'AI 실행현황'], ['schedule', '예약 · 반복']] as ['queue' | 'schedule', string][]).map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            active === key ? 'bg-surface-alt text-text-primary' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/* ─── showToast helper ───────────────────────────────────── */

import { showToast as _showToast } from './Toast'
function showToast(message: string, variant: 'info' | 'warning' | 'success' | 'error') {
  _showToast({ message, variant })
}

/* ═══════════════════════════════════════════════════════════
   AiQueueIndicator — Split Layout
═══════════════════════════════════════════════════════════ */

/* ─── SplitDetailEmpty (maximized only) ──────────────────── */

function SplitDetailEmpty() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-8">
      <div className="w-10 h-10 rounded-full bg-surface-alt flex items-center justify-center">
        <ChevronRight size={18} className="text-text-muted" />
      </div>
      <p className="text-[13px] text-text-secondary">좌측 목록에서 항목을 선택하면<br />작업상세가 여기에 표시됩니다.</p>
    </div>
  )
}

/* ─── SplitLayout (maximized 전용) ───────────────────────── */

function SplitLayout({ detailItem, panelMode, onNavigateToWork, onCloseDetail, compact }: {
  detailItem: WorkItem | null
  panelMode: 'slide' | 'maximized'
  onNavigateToWork: (workId: string) => void
  onCloseDetail: () => void
  compact?: boolean
}) {
  const { activeTab, setActiveTab } = useQueue()
  const selectedWorkId = detailItem?.id ?? null

  return (
    <div className="flex h-full">
      {/* 좌측: 큐 목록 (고정 폭) */}
      <div className={`${compact ? 'w-[300px]' : 'w-[380px]'} shrink-0 border-r border-border overflow-y-auto p-5`}>
        <PanelTabs active={activeTab} onChange={setActiveTab} />
        <div className="mt-4">
          {activeTab === 'queue' && (
            <QueueTab
              panelMode={panelMode}
              onNavigateToWork={onNavigateToWork}
              activeWorkId={selectedWorkId}
              compact={compact}
            />
          )}
          {activeTab === 'schedule' && <ScheduleTab />}
        </div>
      </div>

      {/* 우측: 작업상세 or 빈 상태 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
        {detailItem ? (
          <div className="relative p-5">
            <button
              onClick={onCloseDetail}
              className="absolute top-3 right-3 z-10 rounded p-1 text-text-muted hover:bg-surface-muted hover:text-text-secondary transition-colors"
              title="작업상세 닫기"
            >
              <X size={14} />
            </button>
            <ErrorBoundary fallback={
              <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-text-muted">
                <span className="text-sm">상세 패널 렌더 오류.</span>
                <button className="px-3 py-1.5 rounded text-sm border border-border hover:bg-surface-muted" onClick={onCloseDetail}>닫기</button>
              </div>
            }>
              <WorkDetailPanel item={detailItem} panelMode={panelMode} />
            </ErrorBoundary>
          </div>
        ) : (
          <SplitDetailEmpty />
        )}
      </div>
    </div>
  )
}

export default function AiQueueIndicator() {
  const {
    activeTab, setActiveTab, isPaused, confirmStop, setConfirmStop, handleConfirmStop, currentRunning, elapsed,
    panelOpen, panelInitialMode, openPanel, closePanel,
    panelView, navigatePanel,
  } = useQueue()
  const [panelMode, setPanelMode] = useState<'slide' | 'maximized'>('slide')

  // work-detail 뷰일 때 WorkItem 조회
  const detailItem = useMemo<WorkItem | null>(() => {
    if (panelView.type !== 'work-detail') return null
    return workItems.find(w => w.id === panelView.workId) ?? null
  }, [panelView])

  const isSplit = panelMode === 'maximized'
  const showDetail = panelView.type === 'work-detail'

  // slide 모드에서 detail 열릴 때 패널 자동 확장
  const SPLIT_WIDTH_RATIO = 0.75
  const widthOverride = (!isSplit && showDetail)
    ? Math.round(getViewport().w * SPLIT_WIDTH_RATIO)
    : undefined

  const handleNavigateToWork = (workId: string) => {
    navigatePanel({ type: 'work-detail', workId })
  }

  const handleBackToQueue = () => {
    navigatePanel({ type: 'queue' })
  }

  // ESC/닫기: detail 보는 중이면 queue로 복귀, 아니면 패널 닫기
  const handlePanelClose = () => {
    if (showDetail) {
      navigatePanel({ type: 'queue' })
    } else {
      closePanel()
    }
  }

  // 헤더: split(maximized or slide+detail) → 타이틀, queue only → 탭
  const headerContent = (isSplit || showDetail) ? (
    <span className="text-sm font-semibold text-text-primary">AI 실행현황</span>
  ) : (
    <PanelTabs active={activeTab} onChange={setActiveTab} />
  )

  const contentCls = (isSplit || showDetail) ? 'flex-1 overflow-hidden' : 'flex-1 overflow-hidden'

  return (
    <>
      {/* ── 헤더 트리거 ── */}
      <button
        onClick={() => panelOpen ? closePanel() : openPanel('slide')}
        aria-label={isPaused ? 'AI 실행현황 (일시정지)' : 'AI 실행현황'}
        className="relative flex items-center justify-center rounded-md p-1 text-text-secondary hover:bg-surface-muted hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/30"
      >
        <div className="relative inline-flex items-center justify-center size-6 overflow-hidden">
          {isPaused ? (
            <Pause size={16} className="fill-text-muted text-text-muted" />
          ) : (
            <>
              <svg className="size-5" viewBox="0 0 100 100" fill="none">
                <rect className="cost-bar-1" y="22" x="15" height="10" rx="3" fill="var(--color-code)" />
                <rect className="cost-bar-2" y="45" x="15" height="10" rx="3" fill="var(--color-code)" opacity="0.65" />
                <rect className="cost-bar-3" y="68" x="15" height="10" rx="3" fill="var(--color-code)" opacity="0.4" />
              </svg>
              <span className="cost-sweep-line absolute left-[12%] right-[12%] h-[1px] rounded-full" />
            </>
          )}
        </div>
      </button>

      {/* ── 슬라이드 패널 ── */}
      <SlidePanel
        open={panelOpen}
        onClose={handlePanelClose}
        title="AI 실행현황"
        headerContent={headerContent}
        defaultWidthRatio={0.45}
        initialMode={panelInitialMode}
        onModeChange={setPanelMode}
        contentClassName={contentCls}
        widthOverride={widthOverride}
      >
        {(isSplit || showDetail) ? (
          /* ── Split 레이아웃 (maximized 또는 slide+detail) ── */
          <SplitLayout
            detailItem={detailItem}
            panelMode={panelMode}
            onNavigateToWork={handleNavigateToWork}
            onCloseDetail={handleBackToQueue}
            compact={!isSplit}
          />
        ) : (
          /* ── 큐 목록만 (slide, no detail) ── */
          <div className="h-full overflow-y-auto p-5">
            {activeTab === 'queue' && <QueueTab panelMode={panelMode} onNavigateToWork={handleNavigateToWork} />}
            {activeTab === 'schedule' && <ScheduleTab />}
          </div>
        )}
      </SlidePanel>

      {/* ── 중지 확인 ── */}
      <ConfirmDialog
        open={confirmStop}
        title="작업 중지"
        message={`"${currentRunning.sqlText.slice(0, 60)}…"\n${currentRunning.instance} · ${fmtElapsed(elapsed)}\n\n이 작업을 중지하면 큐가 일시정지됩니다.\n(다음 건이 자동으로 실행되지 않습니다)\n\n계속하시겠습니까?`}
        variant="danger"
        confirmLabel="중지"
        onConfirm={handleConfirmStop}
        onCancel={() => setConfirmStop(false)}
      />
    </>
  )
}
