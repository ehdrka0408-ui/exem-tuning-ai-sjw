// 별칭 override 저장소.
// - 초기 seed: 일부 workItem 에 예시 별칭 미리 주입
// - localStorage 영속
// - 구독 기반 구독자 알림
// - setAlias 호출 시 백엔드 tuning_cases.alias 에도 best-effort PATCH

const STORAGE_KEY = 'tuning_ai_alias_overrides_v1'
const API_BASE = (import.meta as unknown as { env: { VITE_API_BASE?: string } }).env.VITE_API_BASE || 'http://10.10.45.119:8000'

const SEED: Record<string, string> = {}

let store: Record<string, string> = {}
try {
  const raw = localStorage.getItem(STORAGE_KEY)
  store = raw ? { ...SEED, ...JSON.parse(raw) } : { ...SEED }
} catch {
  store = { ...SEED }
}

const subs = new Set<() => void>()
function notify() {
  subs.forEach(f => f())
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* ignore */
  }
}

export function getAlias(workId: string): string | undefined {
  return store[workId]
}

export function getAllAliases(): Record<string, string> {
  return { ...store }
}

export function subscribeAlias(cb: () => void): () => void {
  subs.add(cb)
  return () => subs.delete(cb)
}

export async function setAlias(workId: string, alias: string, sqlId?: string): Promise<void> {
  const trimmed = alias.trim()
  if (trimmed) {
    store[workId] = trimmed
  } else {
    delete store[workId]
  }
  persist()
  notify()

  // best-effort: sync to DB tuning_cases by sql_id
  if (sqlId) {
    try {
      await fetch(`${API_BASE}/api/cases/by-sql-id/${encodeURIComponent(sqlId)}/alias`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: trimmed || null }),
      })
    } catch (e) {
      console.warn('[alias] DB sync failed (sqlId not matched or network):', e)
    }
  }
}
