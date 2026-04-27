// 액션 항목 mock 데이터 (승인완료 후 2레이어)

export type ActionItemType = 'auto_apply' | 'recommendation'
export type AutoApplyStatus = 'pending' | 'running' | 'completed' | 'failed'
export type RecommendationStatus = 'pending' | 'delivered' | 'dev_confirmed' | 'applied'

export interface ActionItem {
  id: number
  workItemId: string
  label: string
  type: ActionItemType
  status: AutoApplyStatus | RecommendationStatus
  detail?: string
  deliveryMethod?: 'email' | 'slack' | 'jira' | 'copy' | null
  deliveredAt?: string
  deliveredTo?: string
  completedAt?: string
  // 인덱스 관련
  ddl?: string
  scheduledTime?: string // 예약 시간 (정책에 의한)
}

export const workActionItems: Record<string, ActionItem[]> = {}
