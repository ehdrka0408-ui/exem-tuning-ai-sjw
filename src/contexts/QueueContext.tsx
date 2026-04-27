import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import type { ReactNode, Dispatch, SetStateAction } from 'react'
import { showToast } from '../components/common/Toast'
import { useNotifications } from './NotificationContext'

/* ─── Types ──────────────────────────────────────────────── */

export type Tab = 'queue' | 'schedule'
export type InstanceKind = 'production' | 'dev'

/** 패널 내부 뷰 — queue(목록) ↔ work-detail(작업상세) 교체 */
export type PanelView =
  | { type: 'queue' }
  | { type: 'work-detail'; workId: string }

export interface QItem {
  id: string
  sqlText: string
  groupId: string
  groupLabel: string
  instance: string
  instanceType: InstanceKind
  /** 보류된 시각 (ms epoch) — held 리스트에 있을 때만 설정 */
  heldAt?: number
  /** 작업함 WorkItem ID — 작업상세 drill-down용 */
  workId?: string
}

export interface QGroup {
  id: string
  label: string
  instance: string
  instanceType: InstanceKind
  items: QItem[]
}

export interface QueueState {
  standalone: QItem[]
  groups: QGroup[]
  held: QItem[]
}

export interface OneTimeSchedule {
  id: string
  label: string
  instance: string
  instanceType: InstanceKind
  sqlCount: number
  scheduledDate: string
  scheduledDow: string
  scheduledTime: string
}

export interface RecurringLastRun {
  date: string       // 'YYYY-MM-DD'
  time: string       // 'HH:MM'
  totalCount: number
  successCount: number
  failedCount: number
  elapsedSec: number
}

export interface RecurringSchedule {
  id: string
  label: string
  instance: string
  instanceType: InstanceKind
  period: string
  time: string
  active: boolean
  lastRun?: RecurringLastRun
}

/* ─── Mock Data ──────────────────────────────────────────── */

export const STEPS = ['분석', '대안 생성', '검증 실행', '비교 평가', '완료'] as const

export interface RunningItem {
  id: string
  sqlText: string
  instance: string
  instanceType: InstanceKind
  requestLabel: string
  initialElapsed: number
  currentStep: number
  stepDesc: string
  isDelayed: boolean
  workId?: string
  /** 개별 SQL 식별자 (V$SQL.SQL_ID) */
  sqlId?: string
  /** 배치(요청) 전체 건수 — 대시보드 매크로 진행률 표시용 */
  batchTotal?: number
  /** 배치(요청) 완료 건수 */
  batchDone?: number
  /** 이 단계에 도달하면 실패 처리 (mock 용) */
  failAt?: number
  errorMsg?: string
}

const STEP_DESCS = [
  'SQL 파싱 및 구조를 분석하고 있습니다',
  'AI가 대안 SQL을 생성하고 있습니다',
  '검증 SQL을 실행하여 성능을 측정하고 있습니다',
  '원본과 튜닝안을 비교 평가하고 있습니다',
  '튜닝이 완료되었습니다',
]

/** Mock 풀 — 데모용 순환. 일부 항목은 failAt로 실패 시뮬레이션
 *  workId는 실제 mocks/workItems.ts에 존재하는 항목을 가리켜야 하며,
 *  running_start 알림 → 작업상세 진입 시 '튜닝중' 상태가 보이도록
 *  status='tuning'인 작업을 우선 사용한다. (failure 케이스는 rejected 사용) */
const RUN_POOL: RunningItem[] = [
  {
    id: 'idle',
    sqlText: '',
    instance: '',
    instanceType: 'production',
    requestLabel: '',
    initialElapsed: 0,
    currentStep: 0,
    stepDesc: '',
    isDelayed: false,
    workId: null,
    sqlId: '',
    batchTotal: 0,
    batchDone: 0,
  },
]

/** 후방호환용 — 기존 MOCK_RUNNING 참조가 있으면 첫 풀 항목을 반환 */
export const MOCK_RUNNING: RunningItem = RUN_POOL[0]

/** 단계 전환 간격 (ms) — Mock PoC 데모용 */
const STEP_INTERVAL_MS = 5000

export const GROUP_PREVIEW = 5

/** 보류 TTL — 7일 후 자동 만료 */
export const HELD_TTL_MS = 7 * 24 * 60 * 60 * 1000
const ONE_DAY_MS = 24 * 60 * 60 * 1000

/** 보류 만료까지 남은 일수 (음수면 만료) */
export function daysUntilExpiry(heldAt: number): number {
  const remaining = heldAt + HELD_TTL_MS - Date.now()
  return Math.ceil(remaining / ONE_DAY_MS)
}

const SQL_POOL = [
  "SELECT * FROM orders o JOIN customers c ON o.cust_id = c.id WHERE o.status = 'PENDING' AND c.region = 'KR'",
  "SELECT dept_id, COUNT(*), AVG(salary) FROM employees GROUP BY dept_id HAVING COUNT(*) > 10",
  "SELECT p.product_name, SUM(s.quantity) FROM sales s JOIN products p ON s.prod_id = p.id WHERE s.sale_date >= SYSDATE - 30 GROUP BY p.product_name",
  "UPDATE accounts SET balance = balance - :amt WHERE account_id = :id AND balance >= :amt",
  "SELECT e.emp_name, d.dept_name, m.emp_name AS manager FROM employees e JOIN departments d ON e.dept_id = d.id LEFT JOIN employees m ON e.mgr_id = m.emp_id",
  "SELECT DISTINCT session_id FROM audit_log WHERE action = 'LOGIN' AND login_time > SYSDATE - 7",
  "SELECT inv_id, item_code, qty, unit_price, qty * unit_price AS total FROM inventory WHERE qty > 0 ORDER BY total DESC",
  "SELECT customer_id, SUM(order_amount) AS total FROM orders WHERE order_date BETWEEN :start AND :end GROUP BY customer_id",
  "SELECT a.*, b.metric_value FROM perf_baseline a JOIN perf_current b ON a.sql_id = b.sql_id WHERE b.metric_value > a.metric_value * 1.5",
  "DELETE FROM temp_sessions WHERE created_at < SYSDATE - 1",
]

function makeItems(groupId: string, groupLabel: string, instance: string, instanceType: InstanceKind, count: number): QItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${groupId}-${i}`,
    sqlText: SQL_POOL[i % SQL_POOL.length],
    groupId,
    groupLabel,
    instance,
    instanceType,
  }))
}

// pending workItem ID를 큐 항목에 매핑 (작업상세 drill-down용)
const PENDING_WORK_IDS = ['WI-2024-041', 'WI-2024-042', 'WI-004', 'WI-005', 'WI-006', 'WI-007', 'WI-008']

function assignWorkIds(items: QItem[]): QItem[] {
  return items.map((item, i) => i < PENDING_WORK_IDS.length ? { ...item, workId: PENDING_WORK_IDS[i] } : item)
}

const INITIAL_QUEUE: QueueState = {
  standalone: [],
  groups: [],
  held: [],
}

const INITIAL_ONE_TIME: OneTimeSchedule[] = []

const INITIAL_RECURRING: RecurringSchedule[] = []

/* ─── Helpers ────────────────────────────────────────────── */

export function fmtElapsed(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m === 0 ? `${s}초` : `${m}분 ${String(s).padStart(2, '0')}초`
}

export function instCls(type: InstanceKind) {
  return type === 'production' ? 'bg-warning-bg text-warning-dark' : 'bg-code-bg text-code-dark'
}

export function totalPending(state: QueueState) {
  return state.standalone.length + state.groups.reduce((n, g) => n + g.items.length, 0)
}

/** 큐에서 다음에 실행될 건 — standalone 1순위, 없으면 첫 그룹 첫 건 */
export function nextInQueue(state: QueueState): QItem | null {
  if (state.standalone.length > 0) return state.standalone[0]
  const firstGroup = state.groups[0]
  if (firstGroup && firstGroup.items.length > 0) return firstGroup.items[0]
  return null
}

/* ─── Context ────────────────────────────────────────────── */

interface QueueContextValue {
  // Panel open/mode (인디케이터 패널을 외부에서 열기 위함)
  panelOpen: boolean
  panelInitialMode: 'slide' | 'maximized'
  openPanel: (mode?: 'slide' | 'maximized') => void
  closePanel: () => void
  // Panel view — queue(목록) ↔ work-detail(작업상세) Replace 패턴
  panelView: PanelView
  navigatePanel: (view: PanelView) => void
  // Tab
  activeTab: Tab
  setActiveTab: Dispatch<SetStateAction<Tab>>
  // Running / Paused
  currentRunning: RunningItem
  elapsed: number
  isPaused: boolean
  confirmStop: boolean
  setConfirmStop: Dispatch<SetStateAction<boolean>>
  handleConfirmStop: () => void
  handleResume: () => void
  // Queue
  queueState: QueueState
  expandedGroups: Set<string>
  handleMoveToTop: (item: QItem) => void
  handleHold: (item: QItem) => void
  handleRestore: (item: QItem) => void
  handleDeleteHeld: (item: QItem) => void
  handleCancelQueueItem: (item: QItem) => void
  toggleGroup: (groupId: string) => void
  // Schedule
  oneTime: OneTimeSchedule[]
  setOneTime: Dispatch<SetStateAction<OneTimeSchedule[]>>
  recurring: RecurringSchedule[]
  setRecurring: Dispatch<SetStateAction<RecurringSchedule[]>>
  runScheduleNow: (id: string) => void
  /** 예약 튜닝 요청 접수 — workItems 에는 넣지 않고 oneTime 에만 추가 */
  addScheduledRequest: (opts: {
    label: string
    instance: string
    instanceType: InstanceKind
    sqlCount: number
    scheduledAt: string // ISO
  }) => OneTimeSchedule
}

const QueueContext = createContext<QueueContextValue | null>(null)

export function QueueProvider({ children }: { children: ReactNode }) {
  const { addNotification } = useNotifications()

  const [panelOpen, setPanelOpen] = useState(false)
  const [panelInitialMode, setPanelInitialMode] = useState<'slide' | 'maximized'>('slide')
  const [panelView, setPanelView] = useState<PanelView>({ type: 'queue' })
  const openPanel = useCallback((mode: 'slide' | 'maximized' = 'slide') => {
    setPanelInitialMode(mode)
    setPanelOpen(true)
  }, [])
  const closePanel = useCallback(() => {
    setPanelOpen(false)
    // 닫힐 때 뷰를 queue로 리셋 (다음 열기 시 기본 뷰)
    setTimeout(() => setPanelView({ type: 'queue' }), 300)
  }, [])
  const navigatePanel = useCallback((view: PanelView) => setPanelView(view), [])

  const [activeTab, setActiveTab] = useState<Tab>('queue')
  const [currentRunning, setCurrentRunning] = useState<RunningItem>(RUN_POOL[0])
  const [elapsed, setElapsed] = useState(RUN_POOL[0].initialElapsed)
  // Mock 데이터 제거 — 초기 상태 일시정지로 시작하여 mock 큐 진행 루프 차단
  const [isPaused, setIsPaused] = useState(true)
  const [confirmStop, setConfirmStop] = useState(false)
  const [queueState, setQueueState] = useState<QueueState>(INITIAL_QUEUE)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [oneTime, setOneTime] = useState<OneTimeSchedule[]>(INITIAL_ONE_TIME)
  const [recurring, setRecurring] = useState<RecurringSchedule[]>(INITIAL_RECURRING)

  // currentRunning 최신값을 interval 내부에서 참조하기 위한 ref
  const runningRef = useRef<RunningItem>(currentRunning)
  runningRef.current = currentRunning
  const poolIdxRef = useRef(0)

  useEffect(() => {
    if (isPaused) return
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [isPaused])

  // ─── Mock 큐 진행 애니메이션 ──────────────────────────────
  // 일시정지 아니면 STEP_INTERVAL_MS마다 currentStep을 1씩 증가시키고,
  // 완료/실패 시점에 알림 push + 다음 풀 항목으로 교체
  useEffect(() => {
    if (isPaused) return

    const advance = () => {
      const prev = runningRef.current
      const nextStep = prev.currentStep + 1

      // ── 실패 분기 ──
      if (prev.failAt != null && nextStep === prev.failAt) {
        addNotification({
          type: 'failure',
          instance: prev.instance,
          instanceType: prev.instanceType,
          requestLabel: prev.requestLabel,
          sqlText: prev.sqlText,
          errorMsg: prev.errorMsg ?? '튜닝 중 오류가 발생했습니다 (3회 재시도 실패)',
          workId: prev.workId,
        })
        moveToNextPoolItem()
        return
      }

      // ── 완료 분기 (step 4 "완료" 도달) ──
      if (nextStep >= 4) {
        // 먼저 완료 단계로 잠깐 전환 후 알림 push
        const donePlus = (prev.batchDone ?? 0) + 1
        setCurrentRunning({ ...prev, currentStep: 4, stepDesc: STEP_DESCS[4], batchDone: donePlus })
        addNotification({
          type: 'tuning_complete',
          instance: prev.instance,
          instanceType: prev.instanceType,
          requestLabel: prev.requestLabel,
          sqlText: prev.sqlText,
          beforeTime: '2.3s',
          afterTime: '0.4s',
          improvePct: 82,
          workId: prev.workId,
        })
        moveToNextPoolItem()
        return
      }

      // ── 일반 단계 전환 ──
      setCurrentRunning({ ...prev, currentStep: nextStep, stepDesc: STEP_DESCS[nextStep] })
    }

    const moveToNextPoolItem = () => {
      poolIdxRef.current = (poolIdxRef.current + 1) % RUN_POOL.length
      const base = RUN_POOL[poolIdxRef.current]
      const nextItem: RunningItem = {
        ...base,
        currentStep: 0,
        stepDesc: STEP_DESCS[0],
        initialElapsed: 0,
      }
      setCurrentRunning(nextItem)
      setElapsed(0)
      // 새 카드 시작 알림
      addNotification({
        type: 'running_start',
        instance: nextItem.instance,
        instanceType: nextItem.instanceType,
        requestLabel: nextItem.requestLabel,
        sqlText: nextItem.sqlText,
        elapsedSec: 0,
        stopped: false,
        workId: nextItem.workId,
      })
    }

    const t = setInterval(advance, STEP_INTERVAL_MS)
    return () => clearInterval(t)
  }, [isPaused, addNotification])

  // 보류건 TTL 만료 자동 정리 (1분마다 체크)
  useEffect(() => {
    const purge = () => {
      setQueueState((prev) => {
        const now = Date.now()
        const alive = prev.held.filter((i) => i.heldAt == null || i.heldAt + HELD_TTL_MS > now)
        if (alive.length === prev.held.length) return prev
        return { ...prev, held: alive }
      })
    }
    purge()
    const t = setInterval(purge, 60_000)
    return () => clearInterval(t)
  }, [])

  const handleMoveToTop = useCallback((item: QItem) => {
    setQueueState((prev) => ({
      ...prev,
      standalone: [item, ...prev.standalone.filter((i) => i.id !== item.id)],
      groups: prev.groups
        .map((g) => ({ ...g, items: g.items.filter((i) => i.id !== item.id) }))
        .filter((g) => g.items.length > 0),
    }))
    showToast({ message: '맨 위로 이동했습니다', variant: 'info' })
  }, [])

  const handleHold = useCallback((item: QItem) => {
    const heldItem: QItem = { ...item, heldAt: Date.now() }
    setQueueState((prev) => ({
      ...prev,
      standalone: prev.standalone.filter((i) => i.id !== item.id),
      groups: prev.groups
        .map((g) => ({ ...g, items: g.items.filter((i) => i.id !== item.id) }))
        .filter((g) => g.items.length > 0),
      held: [heldItem, ...prev.held],
    }))
    showToast({ message: '보류 처리했습니다', variant: 'warning' })
  }, [])

  const handleDeleteHeld = useCallback((item: QItem) => {
    setQueueState((prev) => ({
      ...prev,
      held: prev.held.filter((i) => i.id !== item.id),
    }))
    showToast({ message: '보류건을 삭제했습니다', variant: 'warning' })
  }, [])

  const handleRestore = useCallback((item: QItem) => {
    setQueueState((prev) => {
      const targetGroup = prev.groups.find((g) => g.id === item.groupId)
      return {
        ...prev,
        held: prev.held.filter((i) => i.id !== item.id),
        groups: targetGroup
          ? prev.groups.map((g) => g.id === item.groupId ? { ...g, items: [...g.items, item] } : g)
          : prev.groups,
        standalone: targetGroup ? prev.standalone : [...prev.standalone, item],
      }
    })
    showToast({ message: '대기열에 복귀했습니다', variant: 'info' })
  }, [])

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }, [])

  const handleConfirmStop = useCallback(() => {
    setConfirmStop(false)
    setIsPaused(true)
    const stopped = runningRef.current
    // 중지된 작업은 큐 #1로 복귀 (대기 상태)
    const stoppedQItem: QItem = {
      id: `stopped-${stopped.id}-${Date.now()}`,
      sqlText: stopped.sqlText,
      groupId: 'stopped',
      groupLabel: stopped.requestLabel,
      instance: stopped.instance,
      instanceType: stopped.instanceType,
    }
    setQueueState((prev) => ({
      ...prev,
      standalone: [stoppedQItem, ...prev.standalone],
    }))
    showToast({ message: '작업이 중지되었습니다. 큐 #1로 복귀했습니다.', variant: 'warning' })
    addNotification({
      type: 'manual_stopped',
      instance: stopped.instance,
      instanceType: stopped.instanceType,
      requestLabel: stopped.requestLabel,
      sqlText: stopped.sqlText,
      pendingCount: totalPending(queueState) + 1,
      workId: stopped.workId,
    })
  }, [addNotification, queueState])

  /** 큐의 가장 앞에 있는 항목을 꺼내어 RunningItem으로 변환 */
  const popFirstFromQueue = useCallback((): { item: RunningItem | null; nextState: QueueState } => {
    const prev = queueState
    if (prev.standalone.length > 0) {
      const [first, ...rest] = prev.standalone
      const next: RunningItem = {
        id: first.id,
        sqlText: first.sqlText,
        instance: first.instance,
        instanceType: first.instanceType,
        requestLabel: first.groupLabel,
        initialElapsed: 0,
        currentStep: 0,
        stepDesc: STEP_DESCS[0],
        isDelayed: false,
      }
      return { item: next, nextState: { ...prev, standalone: rest } }
    }
    if (prev.groups.length > 0 && prev.groups[0].items.length > 0) {
      const g = prev.groups[0]
      const [first, ...restItems] = g.items
      const next: RunningItem = {
        id: first.id,
        sqlText: first.sqlText,
        instance: g.instance,
        instanceType: g.instanceType,
        requestLabel: g.label,
        initialElapsed: 0,
        currentStep: 0,
        stepDesc: STEP_DESCS[0],
        isDelayed: false,
      }
      const nextGroups = restItems.length > 0
        ? [{ ...g, items: restItems }, ...prev.groups.slice(1)]
        : prev.groups.slice(1)
      return { item: next, nextState: { ...prev, groups: nextGroups } }
    }
    return { item: null, nextState: prev }
  }, [queueState])

  const handleResume = useCallback(() => {
    const { item, nextState } = popFirstFromQueue()
    if (item) {
      setQueueState(nextState)
      setCurrentRunning(item)
      setElapsed(0)
      addNotification({
        type: 'queue_resumed',
        instance: item.instance,
        instanceType: item.instanceType,
        requestLabel: item.requestLabel,
        sqlText: item.sqlText,
      })
      showToast({ message: '큐가 재개되었습니다', variant: 'info' })
    } else {
      // 큐가 비어 있으면 그냥 일시정지 해제
      showToast({ message: '큐가 비어 있습니다', variant: 'info' })
    }
    setIsPaused(false)
  }, [popFirstFromQueue, addNotification])

  const handleCancelQueueItem = useCallback((item: QItem) => {
    setQueueState((prev) => ({
      ...prev,
      standalone: prev.standalone.filter((i) => i.id !== item.id),
      groups: prev.groups
        .map((g) => ({ ...g, items: g.items.filter((i) => i.id !== item.id) }))
        .filter((g) => g.items.length > 0),
    }))
    showToast({ message: '큐에서 제거했습니다', variant: 'warning' })
  }, [])

  const addScheduledRequest = useCallback((opts: {
    label: string
    instance: string
    instanceType: InstanceKind
    sqlCount: number
    scheduledAt: string
  }): OneTimeSchedule => {
    const d = new Date(opts.scheduledAt)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    const dowArr = ['(일)', '(월)', '(화)', '(수)', '(목)', '(금)', '(토)']
    const entry: OneTimeSchedule = {
      id: `sched-new-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      label: opts.label,
      instance: opts.instance,
      instanceType: opts.instanceType,
      sqlCount: opts.sqlCount,
      scheduledDate: `${yyyy}-${mm}-${dd}`,
      scheduledDow: dowArr[d.getDay()],
      scheduledTime: `${hh}:${mi}`,
    }
    setOneTime((prev) => [entry, ...prev])
    return entry
  }, [])

  const runScheduleNow = useCallback((id: string) => {
    const target = oneTime.find((s) => s.id === id)
    if (!target) return
    // 예약 항목을 큐 마지막(standalone 끝)에 추가
    const newItem: QItem = {
      id: `sched-${target.id}-${Date.now()}`,
      sqlText: `-- [예약 ${target.label}] ${target.sqlCount}건 일괄 튜닝 요청`,
      groupId: 'schedule',
      groupLabel: target.label,
      instance: target.instance,
      instanceType: target.instanceType,
    }
    setQueueState((prev) => ({ ...prev, standalone: [...prev.standalone, newItem] }))
    setOneTime((prev) => prev.filter((s) => s.id !== id))
    showToast({ message: `"${target.label}" 예약이 실행큐로 이동했습니다`, variant: 'info' })
  }, [oneTime])

  return (
    <QueueContext.Provider
      value={{
        panelOpen, panelInitialMode, openPanel, closePanel, panelView, navigatePanel,
        activeTab, setActiveTab,
        currentRunning,
        elapsed, isPaused, confirmStop, setConfirmStop, handleConfirmStop, handleResume,
        queueState, expandedGroups, handleMoveToTop, handleHold, handleRestore, handleDeleteHeld, handleCancelQueueItem, toggleGroup,
        oneTime, setOneTime, recurring, setRecurring, runScheduleNow, addScheduledRequest,
      }}
    >
      {children}
    </QueueContext.Provider>
  )
}

export function useQueue() {
  const ctx = useContext(QueueContext)
  if (!ctx) throw new Error('useQueue must be used within QueueProvider')
  return ctx
}
