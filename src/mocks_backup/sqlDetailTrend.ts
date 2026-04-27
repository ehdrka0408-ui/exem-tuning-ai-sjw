/**
 * SQL Detail Trend — 개별 SQL의 시간대별 추이 목업
 * 메인 조회조건 시간 범위를 따라가며, 10분 간격 데이터를 생성
 * 콤보 차트용: plan별 executions (stacked bar) + metric avg/total (line)
 */

export type DetailMetric = 'elapsed' | 'cpuTime' | 'logicalReads' | 'physicalReads' | 'executions'

export interface DetailTrendPoint {
  timestamp: number
  time: string
  elapsed: number
  cpuTime: number
  logicalReads: number
  physicalReads: number
  executions: number
  /** plan_hash별 실행 횟수 — 스택 바 차트용 */
  planExecs: Record<string, number>
  /** 해당 구간에서 관찰된 플랜 해시 목록 */
  planHashes: string[]
  /** 플랜이 이전 구간 대비 변경되었는지 */
  planChanged: boolean
}

// SQL별 기본 메트릭 + 플랜 시나리오
interface SqlProfile {
  elapsed: number
  cpuTime: number
  logicalReads: number
  physicalReads: number
  executions: number
  plans: { hash: string; fromHour: number; toHour: number; weight?: number }[]
}

const SQL_PROFILES: Record<string, SqlProfile> = {
  'a1b2c3d4e5f6g': {
    elapsed: 48200, cpuTime: 31500, logicalReads: 4500000, physicalReads: 450000, executions: 1240,
    plans: [
      { hash: '3829104756', fromHour: 0, toHour: 14, weight: 0.7 },
      { hash: '1927384650', fromHour: 10, toHour: 24, weight: 0.5 },
    ],
  },
  'f7g8h9i0j1k2l': {
    elapsed: 32100, cpuTime: 21000, logicalReads: 3000000, physicalReads: 360000, executions: 8500,
    plans: [{ hash: '2748193650', fromHour: 0, toHour: 24 }],
  },
  'm3n4o5p6q7r8s': {
    elapsed: 41500, cpuTime: 26600, logicalReads: 3800000, physicalReads: 304000, executions: 3200,
    plans: [
      { hash: '4019283756', fromHour: 0, toHour: 11, weight: 0.6 },
      { hash: '5028374619', fromHour: 8, toHour: 18, weight: 0.5 },
      { hash: '4019283756', fromHour: 16, toHour: 24, weight: 0.4 },
    ],
  },
  't9u0v1w2x3y4z': {
    elapsed: 27800, cpuTime: 17500, logicalReads: 2500000, physicalReads: 175000, executions: 550,
    plans: [{ hash: '3847261590', fromHour: 0, toHour: 24 }],
  },
  'b5c6d7e8f9g0h': {
    elapsed: 19500, cpuTime: 12600, logicalReads: 1800000, physicalReads: 252000, executions: 4000,
    plans: [{ hash: '1638472950', fromHour: 0, toHour: 24 }],
  },
  'i1j2k3l4m5n6o': {
    elapsed: 15200, cpuTime: 9800, logicalReads: 1400000, physicalReads: 168000, executions: 900,
    plans: [
      { hash: '2957381640', fromHour: 0, toHour: 13 },
      { hash: '8847291035', fromHour: 13, toHour: 24 },
    ],
  },
  'p7q8r9s0t1u2v': {
    elapsed: 12800, cpuTime: 8400, logicalReads: 1200000, physicalReads: 144000, executions: 2000,
    plans: [{ hash: '3846192750', fromHour: 0, toHour: 24 }],
  },
  'w3x4y5z6a7b8c': {
    elapsed: 8900, cpuTime: 5600, logicalReads: 800000, physicalReads: 96000, executions: 350,
    plans: [{ hash: '4738291560', fromHour: 0, toHour: 24 }],
  },
  'd9e0f1g2h3i4j': {
    elapsed: 5400, cpuTime: 3500, logicalReads: 450000, physicalReads: 54000, executions: 11000,
    plans: [{ hash: '1829374650', fromHour: 0, toHour: 24 }],
  },
  'k5l6m7n8o9p0q': {
    elapsed: 2100, cpuTime: 1400, logicalReads: 120000, physicalReads: 14400, executions: 25000,
    plans: [{ hash: '2938475610', fromHour: 0, toHour: 24 }],
  },
  'r1s2t3u4v5w6x': {
    elapsed: 450, cpuTime: 280, logicalReads: 3000, physicalReads: 360, executions: 18500,
    plans: [{ hash: '3847261090', fromHour: 0, toHour: 24 }],
  },
  'y7z8a9b0c1d2e': {
    elapsed: 180, cpuTime: 119, logicalReads: 1700, physicalReads: 204, executions: 7200,
    plans: [{ hash: '4910283756', fromHour: 0, toHour: 24 }],
  },
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

function businessHourMultiplier(hour: number): number {
  if (hour >= 9 && hour <= 18) {
    const mid = 13.5
    const dist = Math.abs(hour - mid)
    return 1.3 + 0.7 * Math.cos((dist / 5) * Math.PI * 0.5)
  }
  if (hour >= 0 && hour < 6) return 0.4 + 0.1 * Math.sin(hour * 0.5)
  if (hour >= 6 && hour < 9) return 0.6 + 0.25 * (hour - 6)
  return 0.8 - 0.15 * (hour - 18)
}

export function generateSqlDetailTrend(
  sqlId: string,
  startTime: Date,
  endTime: Date,
): { points: DetailTrendPoint[]; allPlanHashes: string[] } {
  const profile = SQL_PROFILES[sqlId]
  if (!profile) return { points: [], allPlanHashes: [] }

  const start = startTime.getTime()
  const end = endTime.getTime()
  const rangeHours = (end - start) / (3600 * 1000)
  // 6시간 이하: 10분 간격, 초과: 1시간 간격
  const intervalMs = rangeHours <= 6 ? 10 * 60 * 1000 : 60 * 60 * 1000
  const points: DetailTrendPoint[] = []
  const allPlanHashSet = new Set<string>()

  const totalDayPoints = Math.ceil((end - start) / intervalMs)
  const totalPoints = Math.min(totalDayPoints, 144)

  let prevPlanSet = ''

  for (let i = 0; i < totalPoints; i++) {
    const ts = start + i * intervalMs
    const d = new Date(ts)
    const hour = d.getHours()
    const minute = d.getMinutes()
    const fractionalHour = hour + minute / 60
    const timeLabel = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`

    const seed = i * 0.37 + sqlId.charCodeAt(0) * 0.13 + sqlId.charCodeAt(3) * 0.07
    const bm = businessHourMultiplier(hour)
    const noise = 0.85 + 0.3 * seededRandom(seed + i)

    // 구간 총 실행 횟수 (1시간 집계 시 10분 대비 6배)
    const intervalsPerDay = 24 * 3600 * 1000 / intervalMs
    const execBase = profile.executions / intervalsPerDay
    const totalExecs = Math.max(1, Math.round(execBase * bm * noise))

    // 활성 플랜 목록 + plan별 실행 횟수 분배
    const activePlans = profile.plans.filter(p => fractionalHour >= p.fromHour && fractionalHour < p.toHour)
    const effectivePlans = activePlans.length > 0 ? activePlans : [profile.plans[0]]

    const planExecs: Record<string, number> = {}
    const planHashes: string[] = []
    const totalWeight = effectivePlans.reduce((s, p) => s + (p.weight ?? 1), 0)

    let remaining = totalExecs
    effectivePlans.forEach((p, idx) => {
      allPlanHashSet.add(p.hash)
      planHashes.push(p.hash)
      const share = idx === effectivePlans.length - 1
        ? remaining
        : Math.round(totalExecs * ((p.weight ?? 1) / totalWeight))
      const planNoise = 0.8 + 0.4 * seededRandom(seed + idx * 5.7 + i)
      const planExecCount = Math.max(0, Math.round(share * planNoise))
      planExecs[p.hash] = (planExecs[p.hash] || 0) + planExecCount
      remaining -= planExecCount
    })
    // fix remaining
    if (remaining > 0) planExecs[effectivePlans[0].hash] += remaining

    const planSetKey = planHashes.sort().join(',')
    const planChanged = i > 0 && planSetKey !== prevPlanSet
    prevPlanSet = planSetKey

    // 메트릭 — per_exec 기준, 플랜 변경 시 스파이크
    const perExecNoise = 0.9 + 0.2 * seededRandom(seed + i * 2.1)
    const planSpike = planChanged ? 1.3 : 1.0
    const perExecElapsed = (profile.elapsed / profile.executions) * perExecNoise * planSpike
    const perExecCpu = (profile.cpuTime / profile.executions) * perExecNoise * planSpike
    const perExecLReads = (profile.logicalReads / profile.executions) * (0.95 + 0.1 * seededRandom(seed + i * 3.2))
    const perExecPReads = (profile.physicalReads / profile.executions) * (0.9 + 0.2 * seededRandom(seed + i * 4.3))

    const actualExecs = Object.values(planExecs).reduce((s, v) => s + v, 0)

    points.push({
      timestamp: ts,
      time: timeLabel,
      elapsed: Math.round(perExecElapsed * actualExecs),
      cpuTime: Math.round(perExecCpu * actualExecs),
      logicalReads: Math.round(perExecLReads * actualExecs),
      physicalReads: Math.round(perExecPReads * actualExecs),
      executions: actualExecs,
      planExecs,
      planHashes: [...new Set(planHashes)],
      planChanged,
    })
  }

  return { points, allPlanHashes: [...allPlanHashSet] }
}

export const DETAIL_METRIC_LABELS: Record<DetailMetric, string> = {
  elapsed: 'Elapsed Time',
  cpuTime: 'CPU Time',
  logicalReads: 'Logical Reads',
  physicalReads: 'Physical Reads',
  executions: 'Executions',
}

// plan hash별 색상 팔레트 — cool 우선, warm은 후순위 액센트
const PLAN_COLORS = [
  '#2563EB', '#06B6D4', '#0284C7', '#059669', '#6366F1',
  '#0891B2', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899',
]

export function getPlanColor(hash: string, allHashes: string[]): string {
  const idx = allHashes.indexOf(hash)
  return PLAN_COLORS[idx >= 0 ? idx % PLAN_COLORS.length : 0]
}
