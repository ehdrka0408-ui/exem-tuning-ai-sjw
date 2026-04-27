import type { WorkItem } from '../mocks/workItems'

export const isSamePlan = (row: WorkItem): boolean =>
  !!(row.beforePlanHash && row.afterPlanHash && row.beforePlanHash === row.afterPlanHash)

const calcTotalsRate = (b: number | undefined, a: number | undefined): number | null => {
  if (b == null || a == null || b === 0) return null
  return Math.round((b - a) / b * 100)
}

// 1순위: 백엔드 improvement_pct (정확한 값)
// 2순위: totals 직접 비교 fallback
export const calcElapsedRate = (row: WorkItem): number | null => {
  if (row.improvementRate != null) return row.improvementRate
  return calcTotalsRate(row.originalElapsed, row.tunedElapsed)
}

// buffers: 백엔드에 별도 pct 필드 없음 → totals 직접 비교
export const calcBuffersRate = (row: WorkItem): number | null =>
  calcTotalsRate(row.originalBuffers, row.tunedBuffers)
