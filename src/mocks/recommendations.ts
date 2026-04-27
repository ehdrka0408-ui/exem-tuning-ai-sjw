// 복수 튜닝안 mock 데이터

export type TuningType = 'index' | 'hint' | 'rewrite'
export type VerifyType = 'actual' | 'estimated'

export interface TuningPlan {
  id: string
  label: string
  types: TuningType[]
  improvementRate: number
  summary: string
  rationale?: string[]  // AI 분석 근거 (단계별)
  // 검증 결과
  originalElapsed?: number
  tunedElapsed?: number
  originalBuffers?: number
  tunedBuffers?: number
  originalDiskReads?: number
  tunedDiskReads?: number
  // 실행계획
  originalPlanText: string
  tunedPlanText: string
  // SQL
  tunedSqlText?: string
  // 인덱스 관련
  indexDdl?: string
  indexDdls?: { name: string; ddl: string }[]
  // 바인드셋 참조
  bindSetId?: string
  // 검증 유형
  verifyType?: VerifyType
}

export interface WorkRecommendation {
  workItemId: string
  selectedPlanId: string
  plans: TuningPlan[]
}

export const workRecommendations: Record<string, WorkRecommendation> = {}
