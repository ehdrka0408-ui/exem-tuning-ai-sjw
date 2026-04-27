// DBA_HIST_SQLBIND mock loader.
// 실제론 백엔드 /api/sqlbind?sql_id=... 로 대체 가능.

export interface BindSnapshot {
  snapTime: string      // BEGIN_INTERVAL_TIME
  snapId: number
  instId: number
  sqlId: string
  bindValues: string    // 'POS(NAME)=VALUE, ...'
}

const PROFILES: Record<string, BindSnapshot[]> = {
  'abc123def456': [
    { snapTime: '2026-04-14 18:00', snapId: 5841, instId: 1, sqlId: 'abc123def456',
      bindValues: "1(:start_dt)=TO_DATE('2026-04-01','YYYY-MM-DD'), 2(:end_dt)=TO_DATE('2026-04-14','YYYY-MM-DD')" },
    { snapTime: '2026-04-14 17:00', snapId: 5840, instId: 1, sqlId: 'abc123def456',
      bindValues: "1(:start_dt)=TO_DATE('2026-04-13','YYYY-MM-DD'), 2(:end_dt)=TO_DATE('2026-04-14','YYYY-MM-DD')" },
    { snapTime: '2026-04-14 16:00', snapId: 5839, instId: 1, sqlId: 'abc123def456',
      bindValues: "1(:start_dt)=TO_DATE('2026-04-01','YYYY-MM-DD'), 2(:end_dt)=TO_DATE('2026-04-07','YYYY-MM-DD')" },
  ],
  'def456ghi789': [
    { snapTime: '2026-04-14 18:00', snapId: 5841, instId: 1, sqlId: 'def456ghi789',
      bindValues: "1(:min_salary)=5000, 2(:cutoff_date)=TO_DATE('2024-01-01','YYYY-MM-DD')" },
    { snapTime: '2026-04-14 15:00', snapId: 5838, instId: 1, sqlId: 'def456ghi789',
      bindValues: "1(:min_salary)=7500, 2(:cutoff_date)=TO_DATE('2023-06-01','YYYY-MM-DD')" },
  ],
  'ghi789jkl012': [
    { snapTime: '2026-04-14 18:00', snapId: 5841, instId: 1, sqlId: 'ghi789jkl012',
      bindValues: "1(:status)='ACTIVE'" },
    { snapTime: '2026-04-14 17:00', snapId: 5840, instId: 1, sqlId: 'ghi789jkl012',
      bindValues: "1(:status)='PENDING'" },
  ],
}

/**
 * sql_id로 DBA_HIST_SQLBIND mock 결과 조회.
 * 미리 정의된 프로필이 없으면, sql_id 해시 기반으로 가짜 스냅샷 2~3건 생성.
 */
export function fetchBindsByMock(sqlId: string): Promise<BindSnapshot[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (PROFILES[sqlId]) {
        resolve(PROFILES[sqlId])
        return
      }
      // 해시 기반 가짜 생성
      let h = 0
      for (let i = 0; i < sqlId.length; i++) h = (h * 31 + sqlId.charCodeAt(i)) | 0
      const n = 2 + (Math.abs(h) % 3)
      const out: BindSnapshot[] = []
      const now = new Date('2026-04-14T18:00:00')
      for (let i = 0; i < n; i++) {
        const t = new Date(now.getTime() - i * 60 * 60 * 1000)
        out.push({
          snapTime: t.toISOString().replace('T', ' ').slice(0, 16),
          snapId: 5841 - i,
          instId: 1,
          sqlId,
          bindValues: `1(:param1)='${['ACTIVE', 'PENDING', 'DONE'][Math.abs(h + i) % 3]}', 2(:param2)=${1000 + (Math.abs(h + i) % 9000)}`,
        })
      }
      resolve(out)
    }, 450)
  })
}
