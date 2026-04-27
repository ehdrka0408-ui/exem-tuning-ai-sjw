// 글로벌 설정 store — localStorage backed
// 현재는 쿼리 실행 타임아웃만 관리. 추후 다른 글로벌 설정 추가 시 동일 패턴 확장.

const STORAGE_KEY = 'exem_tuning_ai.settings'

export const QUERY_TIMEOUT_DEFAULT_SEC = 600 // 10분
export const QUERY_TIMEOUT_MIN_SEC = 60       // 1분
export const QUERY_TIMEOUT_MAX_SEC = 36000    // 10시간

export interface AppSettings {
  queryTimeoutSec: number
}

const DEFAULTS: AppSettings = {
  queryTimeoutSec: QUERY_TIMEOUT_DEFAULT_SEC,
}

let cache: AppSettings | null = null

function read(): AppSettings {
  if (cache) return cache
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppSettings>
      cache = { ...DEFAULTS, ...parsed }
      return cache
    }
  } catch {
    // ignore parse errors
  }
  cache = { ...DEFAULTS }
  return cache
}

function write(next: AppSettings): void {
  cache = next
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      window.dispatchEvent(new Event('appSettingsChange'))
    }
  } catch {
    // ignore quota errors
  }
}

export function getSettings(): AppSettings {
  return { ...read() }
}

export function getQueryTimeoutSec(): number {
  return read().queryTimeoutSec
}

export function setQueryTimeoutSec(value: number): void {
  const cur = read()
  write({ ...cur, queryTimeoutSec: value })
}

export function isValidQueryTimeoutSec(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value >= QUERY_TIMEOUT_MIN_SEC && value <= QUERY_TIMEOUT_MAX_SEC
}

export function subscribeSettings(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = () => cb()
  window.addEventListener('appSettingsChange', handler)
  return () => window.removeEventListener('appSettingsChange', handler)
}

/** React hook 없이 사용하기 위한 간단한 helper — 컴포넌트에서 useState + useEffect로 구독 */
