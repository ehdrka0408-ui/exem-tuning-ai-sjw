export interface ExecutionValidation {
  id: string
  workItemId: string
  sqlId: string
  originalPlanText: string
  tunedPlanText: string
  originalElapsed: number
  tunedElapsed: number
  originalBuffers: number
  tunedBuffers: number
  originalRows: number
  tunedRows: number
  originalDiskReads: number
  tunedDiskReads: number
  validatedAt: string
  validatedBy: string
  result: 'improved' | 'degraded' | 'neutral'
  recommendationType: 'rewrite' | 'hint' | 'index' | 'plan_restore'
  changeDescription: string
  tunedSqlText?: string
}

export interface BindVariable {
  name: string
  type: string
  value: string
  status: 'available' | 'sample_only' | 'unknown'
}

export interface WorkBindInfo {
  workItemId: string
  bindSensitive: boolean
  variables: BindVariable[]
}

// 바인드 변수 mock
export const workBinds: Record<string, WorkBindInfo> = {}

// ─── 바인드셋 (튜닝안별 사용 바인드 + 대안 바인드셋) ───
export interface BindSetVariable {
  name: string
  type: string
  value: string
}

export interface BindSet {
  id: string
  capturedAt: string
  source: 'MaxGauge' | 'AWR' | 'V$SQL'
  variables: BindSetVariable[]
}

export interface WorkBindSets {
  workItemId: string
  bindSensitive: boolean
  sets: BindSet[]
}

export const workBindSets: Record<string, WorkBindSets> = {}

export const executionValidations: Record<string, ExecutionValidation> = {}
