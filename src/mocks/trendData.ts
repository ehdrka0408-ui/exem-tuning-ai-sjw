// 최근 7일 Elapsed 추이 mock 데이터 (SQL ID별, 플랜별)
export interface TrendPoint {
  date: string
  elapsed: number
  planHash: string
}

export interface SqlTrend {
  sqlId: string
  data: TrendPoint[]
}

const dates = [
  '03-28', '03-29', '03-30', '03-31', '04-01', '04-02', '04-03',
]

export const trendData: Record<string, TrendPoint[]> = {
  'a1b2c3d4e5f6g': dates.map((d, i) => ({
    date: d,
    elapsed: [42000, 43500, 44100, 46200, 47800, 48000, 48200][i],
    planHash: i < 4 ? '3829104756' : '1927384650',
  })),
  'f7g8h9i0j1k2l': dates.map((d, i) => ({
    date: d,
    elapsed: [28000, 29500, 30200, 30800, 31200, 31800, 32100][i],
    planHash: '2748193650',
  })),
  'm3n4o5p6q7r8s': dates.map((d, i) => ({
    date: d,
    elapsed: [35000, 36200, 38100, 39800, 40500, 41200, 41500][i],
    planHash: i < 3 ? '4019283756' : '5028374619',
  })),
  't9u0v1w2x3y4z': dates.map((d, i) => ({
    date: d,
    elapsed: [25000, 25800, 26200, 27000, 27200, 27500, 27800][i],
    planHash: '3847261590',
  })),
  'b5c6d7e8f9g0h': dates.map((d, i) => ({
    date: d,
    elapsed: [18000, 18500, 19000, 19100, 19200, 19400, 19500][i],
    planHash: '1638472950',
  })),
  'i1j2k3l4m5n6o': dates.map((d, i) => ({
    date: d,
    elapsed: [12000, 12800, 13500, 14200, 14800, 15000, 15200][i],
    planHash: '2957381640',
  })),
  'p7q8r9s0t1u2v': dates.map((d, i) => ({
    date: d,
    elapsed: [11000, 11500, 12000, 12200, 12500, 12700, 12800][i],
    planHash: '3846192750',
  })),
  'w3x4y5z6a7b8c': dates.map((d, i) => ({
    date: d,
    elapsed: [7500, 7800, 8100, 8400, 8600, 8800, 8900][i],
    planHash: '4738291560',
  })),
  'd9e0f1g2h3i4j': dates.map((d, i) => ({
    date: d,
    elapsed: [4800, 5000, 5100, 5200, 5300, 5350, 5400][i],
    planHash: '1829374650',
  })),
  'k5l6m7n8o9p0q': dates.map((d, i) => ({
    date: d,
    elapsed: [1800, 1900, 1950, 2000, 2050, 2080, 2100][i],
    planHash: '2938475610',
  })),
  'r1s2t3u4v5w6x': dates.map((d, i) => ({
    date: d,
    elapsed: [380, 400, 410, 420, 430, 440, 450][i],
    planHash: '3847261090',
  })),
  'y7z8a9b0c1d2e': dates.map((d, i) => ({
    date: d,
    elapsed: [150, 155, 160, 165, 170, 175, 180][i],
    planHash: '4910283756',
  })),
}

export interface BindInfo {
  sqlId: string
  bindSensitive: boolean
  capturedSets: number
  status: '사용 가능' | '샘플만 가능' | 'unknown'
}

export const bindInfoData: Record<string, BindInfo> = {
  'a1b2c3d4e5f6g': { sqlId: 'a1b2c3d4e5f6g', bindSensitive: true, capturedSets: 12, status: '사용 가능' },
  'f7g8h9i0j1k2l': { sqlId: 'f7g8h9i0j1k2l', bindSensitive: false, capturedSets: 3, status: '사용 가능' },
  'm3n4o5p6q7r8s': { sqlId: 'm3n4o5p6q7r8s', bindSensitive: true, capturedSets: 8, status: '샘플만 가능' },
  't9u0v1w2x3y4z': { sqlId: 't9u0v1w2x3y4z', bindSensitive: false, capturedSets: 0, status: 'unknown' },
  'b5c6d7e8f9g0h': { sqlId: 'b5c6d7e8f9g0h', bindSensitive: true, capturedSets: 5, status: '사용 가능' },
  'i1j2k3l4m5n6o': { sqlId: 'i1j2k3l4m5n6o', bindSensitive: false, capturedSets: 2, status: '샘플만 가능' },
  'p7q8r9s0t1u2v': { sqlId: 'p7q8r9s0t1u2v', bindSensitive: true, capturedSets: 7, status: '사용 가능' },
  'w3x4y5z6a7b8c': { sqlId: 'w3x4y5z6a7b8c', bindSensitive: false, capturedSets: 1, status: '샘플만 가능' },
  'd9e0f1g2h3i4j': { sqlId: 'd9e0f1g2h3i4j', bindSensitive: false, capturedSets: 0, status: 'unknown' },
  'k5l6m7n8o9p0q': { sqlId: 'k5l6m7n8o9p0q', bindSensitive: true, capturedSets: 15, status: '사용 가능' },
  'r1s2t3u4v5w6x': { sqlId: 'r1s2t3u4v5w6x', bindSensitive: false, capturedSets: 0, status: 'unknown' },
  'y7z8a9b0c1d2e': { sqlId: 'y7z8a9b0c1d2e', bindSensitive: false, capturedSets: 4, status: '사용 가능' },
}
