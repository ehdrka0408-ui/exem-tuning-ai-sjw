export type TrendMetric = 'elapsed' | 'cpu' | 'logicalReads' | 'physicalReads' | 'executions'

export interface TrendDataPoint {
  timestamp: number
  time: string
  total: number
  [sqlId: string]: number | string
}

// All candidate SQL IDs with their base weights (proportional to impact)
const SQL_BASES: Record<string, Record<TrendMetric, number>> = {
  'a1b2c3d4e5f6g': { elapsed: 45000, cpu: 31500, logicalReads: 4500000, physicalReads: 450000, executions: 120 },
  'f7g8h9i0j1k2l': { elapsed: 30000, cpu: 21000, logicalReads: 3000000, physicalReads: 360000, executions: 800 },
  'm3n4o5p6q7r8s': { elapsed: 38000, cpu: 26600, logicalReads: 3800000, physicalReads: 304000, executions: 300 },
  't9u0v1w2x3y4z': { elapsed: 25000, cpu: 17500, logicalReads: 2500000, physicalReads: 175000, executions: 55 },
  'b5c6d7e8f9g0h': { elapsed: 18000, cpu: 12600, logicalReads: 1800000, physicalReads: 252000, executions: 400 },
  'i1j2k3l4m5n6o': { elapsed: 14000, cpu: 9800, logicalReads: 1400000, physicalReads: 168000, executions: 90 },
  'p7q8r9s0t1u2v': { elapsed: 12000, cpu: 8400, logicalReads: 1200000, physicalReads: 144000, executions: 200 },
  'w3x4y5z6a7b8c': { elapsed: 8000, cpu: 5600, logicalReads: 800000, physicalReads: 96000, executions: 35 },
  'd9e0f1g2h3i4j': { elapsed: 5000, cpu: 3500, logicalReads: 450000, physicalReads: 54000, executions: 1100 },
  'k5l6m7n8o9p0q': { elapsed: 2000, cpu: 1400, logicalReads: 120000, physicalReads: 14400, executions: 2500 },
  'r1s2t3u4v5w6x': { elapsed: 400, cpu: 280, logicalReads: 3000, physicalReads: 360, executions: 18500 },
  'y7z8a9b0c1d2e': { elapsed: 170, cpu: 119, logicalReads: 1700, physicalReads: 204, executions: 7200 },
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

// Seeded pseudo-random for consistent data across calls
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

function getSqlValue(sqlId: string, metric: TrendMetric, hour: number, minute: number, pointIndex: number): number {
  const bases = SQL_BASES[sqlId]
  if (!bases) return 0
  const base = bases[metric]
  const seed = pointIndex * 0.3 + sqlId.charCodeAt(0) * 0.1 + sqlId.charCodeAt(5) * 0.05

  let m = businessHourMultiplier(hour)

  // SQL-specific patterns
  if (sqlId === 'a1b2c3d4e5f6g' && ((hour >= 9 && hour <= 11) || (hour >= 14 && hour <= 16))) m *= 1.25
  if (sqlId === 'm3n4o5p6q7r8s' && ((hour === 10 && minute <= 20) || (hour === 15 && minute <= 20))) m *= 1.6
  if (sqlId === 'f7g8h9i0j1k2l') m = 1.0 + (hour / 24) * 0.3 + 0.05 * Math.sin(seed * 3.1)

  // Add noise
  m += 0.1 * Math.sin(seed * 2.3) + 0.08 * (seededRandom(seed + pointIndex) - 0.5)

  return Math.max(0, Math.round(base * m))
}

// "기타" system load — represents SQL not in our candidate list
const OTHER_BASES: Record<TrendMetric, number> = {
  elapsed: 80000,
  cpu: 56000,
  logicalReads: 8000000,
  physicalReads: 960000,
  executions: 50000,
}

export function generateTopSqlTrend(metric: TrendMetric): TrendDataPoint[] {
  const dayStart = new Date('2026-04-02T00:00:00').getTime()
  const intervalMs = 10 * 60 * 1000
  const totalPoints = 144
  const sqlIds = Object.keys(SQL_BASES)
  const data: TrendDataPoint[] = []

  for (let i = 0; i < totalPoints; i++) {
    const ts = dayStart + i * intervalMs
    const d = new Date(ts)
    const hour = d.getHours()
    const minute = d.getMinutes()
    const timeLabel = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`

    const point: TrendDataPoint = { timestamp: ts, time: timeLabel, total: 0 }

    let sum = 0
    for (const sqlId of sqlIds) {
      const val = getSqlValue(sqlId, metric, hour, minute, i)
      point[sqlId] = val
      sum += val
    }

    // Add "other" system load
    const otherBase = OTHER_BASES[metric]
    const otherM = businessHourMultiplier(hour) + 0.12 * (seededRandom(i * 7.3) - 0.5)
    const otherVal = Math.max(0, Math.round(otherBase * otherM))
    sum += otherVal

    point.total = sum
    data.push(point)
  }

  return data
}

export const METRIC_UNITS: Record<TrendMetric, string> = {
  elapsed: 'ms',
  cpu: 'ms',
  logicalReads: 'blocks',
  physicalReads: 'blocks',
  executions: '회',
}
