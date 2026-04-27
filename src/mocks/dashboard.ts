export interface SystemAlert {
  level: 'error' | 'warning';
  message: string;
  link: string;
}

export interface AutoTuningResult {
  date: string;
  timeRange: string;
  instances: string[];
  total: number;
  verified: number;
  reviewNeeded: number;
  failed: number;
  avgImprovement: number;
}

export interface ExtraTodos {
  manualReviewPending: number;
  pendingRecommendations: number;
  planChanges: number;
}

export interface DailyTrend {
  date: string;
  autoTotal: number;
  autoVerified: number;
  avgImprovement: number;
}

export interface NextSchedule {
  time: string;
  instances: string[];
  criteria: string;
}

export const systemAlerts: SystemAlert[] = [] /*[
  {
    level: 'warning',
    message: 'MaxGauge 연동 — 데이터 수신 지연 (마지막 수신: 15분 전)',
    link: '/ops/integration',
  },
];

export const autoTuningResult: AutoTuningResult = {
  date: '2026-04-03',
  timeRange: '어제 22:00 ~ 오늘 06:00',
  instances: ['PROD_01', 'PROD_02'],
  total: 48,
  verified: 33,
  reviewNeeded: 12,
  failed: 3,
  avgImprovement: 42.3,
};

export const extraTodos: ExtraTodos = {
  manualReviewPending: 2,
  pendingRecommendations: 3,
  planChanges: 2,
};

export const dailyTrend: DailyTrend[] = [] /*[
  { date: '03-28', autoTotal: 42, autoVerified: 38, avgImprovement: 39.1 },
  { date: '03-29', autoTotal: 45, autoVerified: 41, avgImprovement: 41.5 },
  { date: '03-30', autoTotal: 38, autoVerified: 35, avgImprovement: 44.2 },
  { date: '03-31', autoTotal: 50, autoVerified: 46, avgImprovement: 37.8 },
  { date: '04-01', autoTotal: 41, autoVerified: 37, avgImprovement: 40.6 },
  { date: '04-02', autoTotal: 47, autoVerified: 43, avgImprovement: 43.1 },
  { date: '04-03', autoTotal: 48, autoVerified: 33, avgImprovement: 42.3 },
];

export const nextSchedule: NextSchedule = {
  time: '22:00',
  instances: ['PROD_01', 'PROD_02'],
  criteria: 'Top 20',
};
