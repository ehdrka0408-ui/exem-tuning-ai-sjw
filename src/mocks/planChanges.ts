export type PlanChangeImpact = 'degraded' | 'improved' | 'neutral'

export interface PlanChangeItem {
  id: string
  sqlId: string
  schema: string
  instanceName: string
  prevPlanHash: string
  currPlanHash: string
  prevElapsed: number    // ms
  currElapsed: number    // ms
  changeRate: number     // % (양수=악화, 음수=개선)
  detectedAt: string
  impact: PlanChangeImpact
  sqlText: string
  prevPlan: string
  currPlan: string
  // 플랜 이력 (타임라인 차트용)
  planHistory: { time: string; elapsed: number; planHash: string }[]
  spmFixed: boolean
  tuningRequested: boolean
}

export const planChangeItems: PlanChangeItem[] = []
