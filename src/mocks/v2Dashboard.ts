export interface V2Alert {
  level: 'error' | 'warning'
  message: string
  link: string
}

export interface V2AutoTuningResult {
  total: number
  analyzed: number
  improved: number
  notImproved: number
  failed: number
  avgImprovement: number
  timeRange: string
}

export interface V2Metrics {
  verificationPending: number
  planChanges: number
  activeSession: number
  activeSessionStatus: 'normal' | 'warning' | 'danger'
}

export interface V2DailyTrend {
  date: string
  completed: number
  tuningImpossible: number
  avgImprovement: number
}

export interface V2NextSchedule {
  time: string
  instances: string[]
  criteria: string
}

export const v2Alerts: V2Alert[] = [
  { level: 'error', message: '플랜 변경 후 성능 저하 감지 2건', link: '/candidates/plan-change' },
  { level: 'warning', message: 'AI 분석 실패 1건 — V2-004 타임아웃', link: '/v2/work' },
]

export const v2AutoTuningResult: V2AutoTuningResult = {
  total: 15,
  analyzed: 15,
  improved: 11,
  notImproved: 3,
  failed: 1,
  avgImprovement: 34.2,
  timeRange: '어제 22:00 ~ 오늘 06:00',
}

export const v2Metrics: V2Metrics = {
  verificationPending: 4,
  planChanges: 2,
  activeSession: 28,
  activeSessionStatus: 'normal',
}

export const v2DailyTrend: V2DailyTrend[] = [
  { date: '03-28', completed: 8, tuningImpossible: 1, avgImprovement: 39.1 },
  { date: '03-29', completed: 10, tuningImpossible: 2, avgImprovement: 41.5 },
  { date: '03-30', completed: 7, tuningImpossible: 1, avgImprovement: 44.2 },
  { date: '03-31', completed: 12, tuningImpossible: 3, avgImprovement: 37.8 },
  { date: '04-01', completed: 9, tuningImpossible: 1, avgImprovement: 40.6 },
  { date: '04-02', completed: 11, tuningImpossible: 2, avgImprovement: 43.1 },
  { date: '04-03', completed: 5, tuningImpossible: 1, avgImprovement: 34.2 },
]

export const v2NextSchedule: V2NextSchedule = {
  time: '22:00',
  instances: ['PROD-DB1', 'PROD-DB2'],
  criteria: 'Top 20',
}
