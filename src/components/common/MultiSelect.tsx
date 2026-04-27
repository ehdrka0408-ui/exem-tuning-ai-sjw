import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'

interface Props {
  label?: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
  emptyText?: string
}

export default function MultiSelect({ label, options, selected, onChange, emptyText }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) { setQuery(''); return }
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v])
  }

  const filteredOptions = query.trim()
    ? options.filter(o => o.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  const display = selected.length === 0 ? '전체' : selected.length <= 2 ? selected.join(', ') : `${selected.length}개 선택`

  return (
    <div className={label ? 'flex items-center gap-2' : ''}>
      {label && <label className="text-[11px] text-text-secondary shrink-0">{label}</label>}
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center justify-between rounded-md border border-border bg-white px-2 h-7 text-xs text-text-primary hover:border-text-muted transition-colors min-w-[100px]"
        >
          <span className="truncate">{display}</span>
          <ChevronDown size={12} className="ml-2 shrink-0 text-text-muted" />
        </button>
        {open && (
          <div className="absolute top-full left-0 z-50 mt-1 min-w-[200px] max-h-[320px] flex flex-col rounded-lg border border-border bg-white py-1 shadow-lg">
            {options.length === 0 ? (
              <div className="px-3 py-3 text-xs text-text-muted italic">{emptyText ?? '항목 없음'}</div>
            ) : (<>
            <div className="px-2 pb-1">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="검색"
                autoFocus
                className="w-full text-xs border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-action/30 placeholder:text-text-muted"
              />
            </div>
            <div className="overflow-y-auto">
              <button
                type="button"
                onClick={() => onChange([])}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-surface ${selected.length === 0 ? 'text-text-primary font-medium' : 'text-text-secondary'}`}
              >
                전체
              </button>
              {filteredOptions.length === 0 && (
                <div className="px-3 py-2 text-xs text-text-muted">결과 없음</div>
              )}
              {filteredOptions.map(opt => {
                const checked = selected.includes(opt)
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggle(opt)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-surface ${checked ? 'text-text-primary font-medium' : 'text-text-secondary'}`}
                  >
                    <span className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${checked ? 'border-action bg-action' : 'border-border'}`}>
                      {checked && <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </span>
                    {opt}
                  </button>
                )
              })}
            </div>
            </>)}
          </div>
        )}
      </div>
    </div>
  )
}
