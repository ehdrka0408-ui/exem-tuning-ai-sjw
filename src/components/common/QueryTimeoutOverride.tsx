import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  getQueryTimeoutSec,
  isValidQueryTimeoutSec,
  subscribeSettings,
  QUERY_TIMEOUT_MIN_SEC,
  QUERY_TIMEOUT_MAX_SEC,
} from '../../mocks/settingsStore'

interface Props {
  /** 현재 오버라이드 값 (없으면 기본값 사용) */
  value: number | undefined
  onChange: (value: number | undefined) => void
  /** compact: true면 토글만, false면 "고급 옵션" 펼침형 */
  collapsible?: boolean
}

export default function QueryTimeoutOverride({ value, onChange, collapsible = false }: Props) {
  const [globalDefault, setGlobalDefault] = useState<number>(() => getQueryTimeoutSec())
  const [open, setOpen] = useState(!collapsible)
  const [overrideOn, setOverrideOn] = useState<boolean>(value !== undefined)
  const [draft, setDraft] = useState<string>(String(value ?? getQueryTimeoutSec()))

  useEffect(() => {
    const unsub = subscribeSettings(() => setGlobalDefault(getQueryTimeoutSec()))
    return unsub
  }, [])

  useEffect(() => {
    setOverrideOn(value !== undefined)
    if (value !== undefined) setDraft(String(value))
  }, [value])

  const draftNum = Number(draft)
  const valid = isValidQueryTimeoutSec(draftNum)

  const toggleOverride = () => {
    if (overrideOn) {
      setOverrideOn(false)
      onChange(undefined)
    } else {
      setOverrideOn(true)
      const init = Number.isInteger(draftNum) && valid ? draftNum : globalDefault
      setDraft(String(init))
      onChange(init)
    }
  }

  const handleInput = (raw: string) => {
    setDraft(raw)
    const n = Number(raw)
    if (isValidQueryTimeoutSec(n)) onChange(n)
  }

  const Header = (
    <button
      type="button"
      onClick={() => setOpen(o => !o)}
      className="flex items-center gap-1 text-[11px] font-medium text-text-muted hover:text-text-secondary transition-colors"
    >
      {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      고급 옵션
    </button>
  )

  const Body = (
    <div className="mt-2 rounded-md border border-border bg-surface-alt px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-medium text-text-primary">쿼리 타임아웃 개별 설정</div>
          <div className="text-[10px] text-text-muted mt-0.5">
            {overrideOn ? `이 요청에만 적용 (${QUERY_TIMEOUT_MIN_SEC}~${QUERY_TIMEOUT_MAX_SEC}초)` : `기본값 사용 (${globalDefault}초)`}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={overrideOn}
          onClick={toggleOverride}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
            overrideOn ? 'bg-action' : 'bg-border'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              overrideOn ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
      {overrideOn && (
        <div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={QUERY_TIMEOUT_MIN_SEC}
              max={QUERY_TIMEOUT_MAX_SEC}
              value={draft}
              onChange={e => handleInput(e.target.value)}
              className={`w-28 rounded-md border px-2 py-1 text-[12px] font-mono bg-white focus:outline-none focus:ring-1 ${
                valid ? 'border-border focus:ring-action/30' : 'border-danger focus:ring-danger/40'
              }`}
            />
            <span className="text-[11px] text-text-muted">초</span>
          </div>
          {!valid && (
            <p className="mt-1 text-[10px] text-danger">
              {QUERY_TIMEOUT_MIN_SEC}~{QUERY_TIMEOUT_MAX_SEC} 사이의 정수를 입력하세요.
            </p>
          )}
        </div>
      )}
    </div>
  )

  if (!collapsible) return Body

  return (
    <div>
      {Header}
      {open && Body}
    </div>
  )
}
