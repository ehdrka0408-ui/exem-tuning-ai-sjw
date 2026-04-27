import { useEffect, useState } from 'react'

/**
 * MaxGauge 연동 상태 (mock).
 * 개발 중 토글: localStorage.setItem('mg:connected', 'false') 후 storage 이벤트 발생
 * 또는 전역 window.__setMaxGauge(false) 호출.
 */
const KEY = 'mg:connected'

function readStatus(): boolean {
  if (typeof window === 'undefined') return true
  const v = localStorage.getItem(KEY)
  if (v === null) return true // 기본: 연동됨
  return v === 'true'
}

type Listener = (v: boolean) => void
const listeners = new Set<Listener>()

export function setMaxGaugeConnected(v: boolean) {
  localStorage.setItem(KEY, String(v))
  listeners.forEach(l => l(v))
}

if (typeof window !== 'undefined') {
  // 개발 편의
  ;(window as unknown as { __setMaxGauge: (v: boolean) => void }).__setMaxGauge = setMaxGaugeConnected
}

export function useMaxGaugeStatus(): boolean {
  const [connected, setConnected] = useState<boolean>(readStatus)
  useEffect(() => {
    const l: Listener = (v) => setConnected(v)
    listeners.add(l)
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setConnected(readStatus())
    }
    window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(l)
      window.removeEventListener('storage', onStorage)
    }
  }, [])
  return connected
}
