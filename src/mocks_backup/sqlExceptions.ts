// SQL ID 단위 예외 목록 — mock 세션 스토어
// 등록 시점 이후 Top SQL / 자동 작업 / 직접 입력에서 해당 SQL을 차단/제외한다.
// 새로고침 시 초기 seed 로 복원.

export interface SqlException {
  sqlId: string
  sqlText: string
  registeredAt: string   // ISO
  registeredBy: string
  reason?: string
  alias?: string // 사용자 정의 SQL 별칭
}

const SEED: SqlException[] = [
  {
    sqlId: 'z9y8x7w6v5u4t',
    sqlText: "SELECT /*+ FULL(t) */ t.audit_id, t.event_type, t.event_time, t.user_id, t.ip_addr FROM AUDIT_LOG t WHERE t.tenant_id = :1 AND t.event_time >= :2",
    registeredAt: '2026-03-18T10:14:00+09:00',
    registeredBy: 'kim_dba',
    reason: '운영 요건상 풀스캔 필수 (감사 로그 전수 조회)',
    alias: '감사로그 전수 조회',
  },
  {
    sqlId: 'm1n2o3p4q5r6s',
    sqlText: "SELECT /*+ PARALLEL(s 8) */ s.seg_name, s.tablespace_name, s.bytes FROM DBA_SEGMENTS s WHERE s.owner = :1",
    registeredAt: '2026-03-22T15:42:00+09:00',
    registeredBy: 'park_tuner',
    reason: '딕셔너리 뷰 튜닝 대상 아님',
    alias: '세그먼트 용량 조회',
  },
  {
    sqlId: 'b3c4d5e6f7g8h',
    alias: '임시 스테이지 정리',
    sqlText: "DELETE FROM TEMP_STAGE WHERE created_at < SYSDATE - 7",
    registeredAt: '2026-03-30T09:05:00+09:00',
    registeredBy: 'lee_admin',
  },
  {
    sqlId: 'k9l0m1n2o3p4q',
    sqlText: "SELECT COUNT(*) FROM V$SESSION WHERE status = 'ACTIVE'",
    registeredAt: '2026-04-02T18:21:00+09:00',
    registeredBy: 'kim_dba',
    reason: '모니터링 툴 내부 쿼리 — 튜닝 대상 제외',
    alias: '활성 세션 카운트',
  },
]

const items: SqlException[] = [...SEED]
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach(fn => fn())
  // DOM 이벤트도 발사 — 비(非)훅 소비자(mock 필터) 대응
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('sqlExceptionsChange'))
  }
}

export function getSqlExceptions(): readonly SqlException[] {
  return items
}

export function isSqlException(sqlId: string): boolean {
  return items.some(x => x.sqlId === sqlId)
}

export function findSqlException(sqlId: string): SqlException | undefined {
  return items.find(x => x.sqlId === sqlId)
}

/** SQL 본문으로 예외 여부 확인 (공백/개행 정규화) */
export function isSqlTextException(sqlText: string): SqlException | null {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()
  const target = norm(sqlText)
  if (!target) return null
  return items.find(x => norm(x.sqlText) === target) ?? null
}

export function addSqlException(input: Omit<SqlException, 'registeredAt' | 'registeredBy'> & { registeredBy?: string }): SqlException {
  // 중복 제거 — 같은 sqlId 존재 시 덮어씀
  const idx = items.findIndex(x => x.sqlId === input.sqlId)
  const entry: SqlException = {
    sqlId: input.sqlId,
    sqlText: input.sqlText,
    reason: input.reason,
    registeredAt: new Date().toISOString(),
    registeredBy: input.registeredBy ?? '김민수',
  }
  if (idx >= 0) items[idx] = entry
  else items.unshift(entry)
  notify()
  return entry
}

export function removeSqlException(sqlId: string): boolean {
  const idx = items.findIndex(x => x.sqlId === sqlId)
  if (idx < 0) return false
  items.splice(idx, 1)
  notify()
  return true
}

export function subscribeSqlExceptions(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
