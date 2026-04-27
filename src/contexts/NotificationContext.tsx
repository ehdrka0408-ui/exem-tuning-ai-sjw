import { createContext, useContext, useState, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import type { InstanceKind } from './QueueContext'

/* ─── Types ──────────────────────────────────────────────── */

export type NotifType =
  | 'running_start'
  | 'tuning_complete'
  | 'failure'
  | 'apply_complete'
  | 'apply_failure'
  | 'batch_complete'
  | 'auto_stopped'
  | 'manual_stopped'
  | 'queue_resumed'
  | 'recurring_complete'

export interface Notif {
  id: string
  type: NotifType
  read: boolean
  ts: Date
  instance: string
  instanceType: InstanceKind
  requestLabel: string
  /** work item id for 작업상세 navigation */
  workId?: string
  // single-item fields
  sqlText?: string
  // tuning_complete
  beforeTime?: string
  afterTime?: string
  improvePct?: number
  // failure
  errorMsg?: string
  /** 실패 알림에서 재시도 완료 후 비활성화 */
  retried?: boolean
  // auto_stopped
  stopReason?: string
  // batch / recurring
  completedCount?: number
  failedCount?: number
  recurringLabel?: string
  // running_start state
  stopped?: boolean
  elapsedSec?: number
  // apply_complete
  applyObjects?: string[]
  // apply_failure
  applyErrorMsg?: string
  // manual_stopped / queue_resumed
  pendingCount?: number
  resumedSqlText?: string
}

/** addNotification 인자 — id/read/ts는 생략하면 자동 생성 */
export type NotifInput = Omit<Notif, 'id' | 'read' | 'ts'> & {
  read?: boolean
  ts?: Date
}

interface NotificationContextValue {
  notifs: Notif[]
  unreadCount: number
  addNotification: (input: NotifInput) => string
  markRead: (id: string) => void
  markAllRead: () => void
  markStopped: (id: string) => void
  markRetried: (id: string) => void
  removeNotification: (id: string) => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

/* ─── Initial Mock Data ──────────────────────────────────── */

const NOW = Date.now()

const INITIAL_NOTIFS: Notif[] = [
  {
    // → WI-2024-023 (approval_pending, HR EMP Self-Join 매니저 조회)
    id: 'n1', type: 'tuning_complete', read: false,
    ts: new Date(NOW - 3 * 60_000),
    instance: 'PROD-DB1', instanceType: 'production', requestLabel: '4/2 새벽 · PROD-DB1·DB2 · 프리셋:야간배치 · 36건',
    sqlText: "SELECT e.emp_id, e.hire_date, m.last_name mgr_name FROM EMP e LEFT JOIN EMP m ON e.manager_id = m.employee_id WHERE e.dept",
    beforeTime: '6.7s', afterTime: '1.0s', improvePct: 85,
    workId: 'WI-2024-023',
  },
  {
    // → WI-2026-T01 (tuning, OMS ORDERS 당일 미처리 조회) — 진행중인 작업
    id: 'n2', type: 'running_start', read: false,
    ts: new Date(NOW - 12 * 60_000),
    instance: 'PROD-DB1', instanceType: 'production', requestLabel: '4/7 새벽 · PROD-DB1 · 정기 자동 · 7건',
    sqlText: "SELECT order_id, order_date, total_amount FROM ORDERS WHERE order_date >= TRUNC(SYSDATE) AND status = 'PENDING'",
    elapsedSec: 720, stopped: false,
    workId: 'WI-2026-T01',
  },
  {
    // → WI-2024-015 (rejected, 동적 SQL) — 실패/반려 사례
    id: 'n3', type: 'failure', read: false,
    ts: new Date(NOW - 60 * 60_000),
    instance: 'PROD-DB1', instanceType: 'production', requestLabel: '4/2 새벽 · PROD-DB1·DB2 · 프리셋:야간배치 · 36건',
    sqlText: "SELECT NVL(bonus, 0) + salary total_comp FROM EMP WHERE department_id = :dept_id ORDER BY total_comp DESC",
    errorMsg: '개선율 4.5% — 적용 효과 미미로 반려',
    workId: 'WI-2024-015',
  },
  {
    // → WI-2024-DV03 (tuning, PAY 일일 결제 통계) — 자동 중단된 케이스
    id: 'n4', type: 'auto_stopped', read: false,
    ts: new Date(NOW - 2 * 60 * 60_000),
    instance: 'PROD-DB1', instanceType: 'production', requestLabel: '4/6 16:00 · PROD-DB1 · 직접등록 · 이준혁(결제팀) · 3건',
    sqlText: "SELECT COUNT(*) total_cnt, SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) success_cnt FROM PAYMENTS WHERE pay_date = TRUNC(SYSDATE) AND merchant_id = :mid",
    stopReason: 'timeout 120초 초과',
    workId: 'WI-2024-DV03',
  },
  {
    // → WI-2024-006 (applied, 주문 통계) — 적용 완료
    id: 'n5', type: 'apply_complete', read: true,
    ts: new Date(2026, 3, 6, 22, 15),
    instance: 'PROD-DB1', instanceType: 'production', requestLabel: '4/6 새벽 · PROD-DB1·DB2 · 정기 자동 · 7건',
    sqlText: "SELECT c.cust_id, c.cust_name, COUNT(o.order_id) order_cnt FROM CUSTOMERS c LEFT JOIN ORDERS o ON c.cust_id = o.cust_id WHERE c.created_at >= SYSDATE - 30 GROUP BY c.cust_id, c.cust_name",
    applyObjects: ['IDX_CUSTOMERS_CREATED_AT'],
    workId: 'WI-2024-006',
  },
  {
    // → WI-2024-005 (apply_pending — 인덱스 생성 실패)
    id: 'n8', type: 'apply_failure', read: false,
    ts: new Date(NOW - 30 * 60_000),
    instance: 'PROD-DB1', instanceType: 'production', requestLabel: '4/7 새벽 · PROD-DB1 · 정기 자동 · 7건',
    sqlText: 'SELECT m.emp_id, m.emp_name, COUNT(r.review_id) review_cnt FROM EMPLOYEES m JOIN REVIEWS r ON m.emp_id = r.reviewer_id WHERE r.review_date',
    applyErrorMsg: 'ORA-01652: unable to extend temp segment by 128 in tablespace USERS',
    workId: 'WI-2024-005',
  },
  {
    id: 'n6', type: 'batch_complete', read: true,
    ts: new Date(2026, 2, 16, 2, 31),
    instance: '운영DB-1', instanceType: 'production', requestLabel: 'CPU Top10',
    completedCount: 8, failedCount: 2,
  },
  {
    id: 'n7', type: 'recurring_complete', read: true,
    ts: new Date(2026, 2, 15, 2, 28),
    instance: '운영DB-1', instanceType: 'production', requestLabel: 'CPU Top10',
    recurringLabel: '(매일 반복)', completedCount: 10,
  },
]

/* ─── Provider ───────────────────────────────────────────── */

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifs, setNotifs] = useState<Notif[]>(INITIAL_NOTIFS)
  const counterRef = useRef(0)

  const addNotification = useCallback((input: NotifInput): string => {
    counterRef.current += 1
    const id = `notif-${Date.now()}-${counterRef.current}`
    const notif: Notif = {
      ...input,
      id,
      read: input.read ?? false,
      ts: input.ts ?? new Date(),
    }
    setNotifs((prev) => [notif, ...prev])
    return id
  }, [])

  const markRead = useCallback((id: string) => {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }, [])

  const markAllRead = useCallback(() => {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const markStopped = useCallback((id: string) => {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, stopped: true } : n)))
  }, [])

  const markRetried = useCallback((id: string) => {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, retried: true } : n)))
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifs((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const unreadCount = notifs.filter((n) => !n.read).length

  return (
    <NotificationContext.Provider
      value={{
        notifs,
        unreadCount,
        addNotification,
        markRead,
        markAllRead,
        markStopped,
        markRetried,
        removeNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}
