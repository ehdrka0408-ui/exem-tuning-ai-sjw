import type { ComponentType } from 'react'
import { Clock, BotMessageSquare, User, CheckCircle2, AlertCircle, Minus, CalendarClock } from 'lucide-react'

export type V2Status =
  | 'scheduled'
  | 'pending'
  | 'tuning'
  | 'approval_pending'
  | 'apply_pending'
  | 'applied'
  | 'rejected'
  | 'failed'
  | 'cancelled'
  | 'no_improve'

/** Owner axis — 이 작업의 현재 '공' 소유자. 상태값과 독립된 축 */
export type V2Owner = 'scheduled' | 'ai' | 'human' | 'done' | 'error' | 'none'

export interface V2WorkItem {
  id: string
  sqlId: string
  sqlText: string
  status: V2Status
  type: 'tuning' | 'verification'
  createdAt: string
  updatedAt: string
  assignee: string
  instanceName: string
  schemaName: string
  workName: string
  alias?: string // 사용자 정의 SQL 별칭
  selectionSource: 'auto' | 'manual'
  originalElapsed: number
  originalBuffers: number
  tunedElapsed?: number
  tunedBuffers?: number
  improvementRate?: number
  recommendationType?: 'rewrite' | 'hint' | 'index' | 'plan_restore'
  source: 'maxgauge' | 'awr' | 'v$sql'
  executionContext?: 'OLTP' | 'Batch'
  estimatedDailyExec?: number
  // tuning
  analysisStep?: 'structure' | 'plan_collection' | 'comparison' | 'recommendation'
  analysisEstimatedRemaining?: number
  // apply_pending (승인 완료)
  approvedBy?: string
  approvedAt?: string
  // apply_pending (검토 완료)
  verifiedBy?: string
  verifiedAt?: string
  // applied
  appliedBy?: string
  appliedAt?: string
  operationalResult?: 'improved' | 'degraded' | 'monitoring'
  operationalElapsed?: number
  operationalBuffers?: number
  operationalMeasuredAt?: string
  // rejected (반려)
  rejectedBy?: string
  rejectedAt?: string
  rejectedReason?: string
  retuneConditions?: string[]
  // failed (AI 분석 실패 / 적용 실패)
  tuningError?: string
  applyError?: string
  // scheduled (예약·반복)
  scheduleKind?: 'once' | 'recurring'
  scheduleCron?: string        // recurring일 때
  scheduleRunAt?: string       // once일 때
  // batch/request grouping
  batchId: string
  batchMemo?: string
  // bind
  executionContextType?: 'OLTP' | 'Batch'
  // 쿼리 실행 타임아웃 (초). 값이 있으면 요청별 오버라이드.
  queryTimeoutSec?: number
}

/**
 * 상태값 라벨 — 2026-04-09 용어 정비
 *
 * 핵심 원칙
 * - **튜닝완료** (approval_pending): AI가 튜닝을 완료해서 사람이 확인해야 하는 상태.
 *   과거 "승인대기"·"검토대기" 모두 이 라벨로 통일.
 * - **반영대기** (apply_pending): 사람이 확인(승인)을 마치고 운영 반영만 남은 상태.
 * - **반영완료** (applied): 운영 환경에 반영된 종결 상태.
 *
 * 상태 전이 동사
 * - 사람 → '확인' (approval_pending → apply_pending)
 * - 시스템/사람 → '반영' (apply_pending → applied)
 */
export const v2StatusLabels: Record<V2Status, string> = {
  scheduled: '예약중',
  pending: '튜닝대기',
  tuning: '튜닝중',
  approval_pending: '튜닝완료',
  apply_pending: '반영대기',
  applied: '반영완료',
  rejected: '반려',
  failed: '실패',
  cancelled: '취소',
  no_improve: '개선없음',
}

export const v2StatusColors: Record<V2Status, string> = {
  scheduled: 'bg-slate-100 text-slate-600',
  pending: 'bg-slate-100 text-slate-600',
  // 2026-04-09: tuning은 진행중 → cool blue. approval_pending은 AI 성공 마일스톤 → green.
  tuning: 'bg-blue-50 text-blue-700',
  approval_pending: 'bg-emerald-50 text-emerald-700',
  apply_pending: 'bg-sky-100 text-sky-700',
  applied: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-red-100 text-red-700',
  no_improve: 'bg-slate-100 text-slate-500',
}

/** 상태 → Owner(공의 소유자) 매핑 */
export const v2StatusOwner: Record<V2Status, V2Owner> = {
  scheduled: 'scheduled',
  pending: 'ai',
  tuning: 'ai',
  approval_pending: 'ai', // 2026-04-09 재정의: Owner 축 = 주체. AI 튜닝 완료 결과.
  apply_pending: 'human',
  applied: 'done',
  rejected: 'error',
  failed: 'error',
  cancelled: 'error',
  no_improve: 'none',
}

/** 상태 → lucide 아이콘 컴포넌트. Owner 축 시각화 전용 */
export const v2StatusIcon: Record<V2Status, ComponentType<{ className?: string; size?: number }>> = {
  scheduled: CalendarClock,
  pending: Clock,
  tuning: BotMessageSquare,
  approval_pending: BotMessageSquare, // 2026-04-09 재정의: AI 작품
  apply_pending: User,
  applied: CheckCircle2,
  rejected: AlertCircle,
  failed: AlertCircle,
  cancelled: AlertCircle,
  no_improve: Minus,
}

export const v2WorkItems: V2WorkItem[] = []
