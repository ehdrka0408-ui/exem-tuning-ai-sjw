import React, { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface QuickInterval {
  label: string
  value: string
  ms: number
}

interface TimeRangePickerProps {
  startTime: Date
  endTime: Date
  onChange: (start: Date, end: Date) => void
  quickIntervals?: QuickInterval[]
}

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

const DAY_MS = 86_400_000

const DEFAULT_INTERVALS: QuickInterval[] = [
  { label: '어제', value: 'yesterday', ms: DAY_MS },
  { label: '오늘', value: 'today', ms: DAY_MS },
  { label: '1주', value: '7d', ms: DAY_MS * 7 },
  { label: '1달', value: '30d', ms: DAY_MS * 30 },
]

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDateTime(d: Date): string {
  const yyyy = String(d.getFullYear())
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}:${ss}`
}

function parseDateTime(s: string): Date | null {
  const m = s.trim().match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2]) - 1
  const day = Number(m[3])
  const hour = Number(m[4])
  const min = Number(m[5])
  const sec = Number(m[6])
  const d = new Date(year, month, day, hour, min, sec)
  if (isNaN(d.getTime())) return null
  // Validate that the components round-trip correctly
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month ||
    d.getDate() !== day ||
    d.getHours() !== hour ||
    d.getMinutes() !== min ||
    d.getSeconds() !== sec
  )
    return null
  return d
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function cloneDate(d: Date): Date {
  return new Date(d.getTime())
}

function padTwo(n: number): string {
  return String(n).padStart(2, '0')
}

/* ------------------------------------------------------------------ */
/*  Mini Calendar                                                      */
/* ------------------------------------------------------------------ */

interface MiniCalendarProps {
  label: string
  selected: Date
  onSelectDate: (d: Date) => void
  onTimeChange: (h: number, m: number, s: number) => void
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const MiniCalendar: React.FC<MiniCalendarProps> = ({
  label,
  selected,
  onSelectDate,
  onTimeChange,
}) => {
  const [viewYear, setViewYear] = useState(selected.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected.getMonth())

  const today = new Date()

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1)
      setViewMonth(0)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const days = daysInMonth(viewYear, viewMonth)
  const firstDow = new Date(viewYear, viewMonth, 1).getDay()

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= days; d++) cells.push(d)

  const handleDayClick = (day: number) => {
    const d = cloneDate(selected)
    d.setFullYear(viewYear, viewMonth, day)
    onSelectDate(d)
  }

  return (
    <div className="flex flex-col gap-2 min-w-[220px]">
      {/* Header */}
      <div className="text-xs font-semibold text-text-secondary mb-1">{label}</div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-1">
        <button
          type="button"
          onClick={prevMonth}
          className="p-0.5 rounded hover:bg-surface-muted text-text-secondary hover:text-text-primary"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm font-medium text-text-primary">
          {viewYear}년 {viewMonth + 1}월
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-0.5 rounded hover:bg-surface-muted text-text-secondary hover:text-text-primary"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center text-[10px] font-medium text-text-muted">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-0.5">
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 text-center text-xs">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`e-${idx}`} className="py-1" />
          }
          const cellDate = new Date(viewYear, viewMonth, day)
          const isToday = isSameDay(cellDate, today)
          const isSelected = isSameDay(cellDate, selected)

          return (
            <button
              key={day}
              type="button"
              onClick={() => handleDayClick(day)}
              className={[
                'py-1 rounded-md cursor-pointer transition-colors',
                isSelected
                  ? 'bg-action text-white font-semibold'
                  : isToday
                    ? 'ring-1 ring-action/30 bg-surface-muted text-action'
                    : 'text-text-primary hover:bg-surface-muted',
              ].join(' ')}
            >
              {day}
            </button>
          )
        })}
      </div>

      {/* Time inputs */}
      <div className="flex items-center gap-1 mt-1 text-xs text-text-secondary">
        <span className="mr-1">시간</span>
        <input
          type="number"
          min={0}
          max={23}
          value={padTwo(selected.getHours())}
          onChange={(e) =>
            onTimeChange(
              Math.min(23, Math.max(0, Number(e.target.value))),
              selected.getMinutes(),
              selected.getSeconds(),
            )
          }
          className="w-10 px-1 py-0.5 border border-border rounded text-center text-xs focus:outline-none focus:ring-1 focus:ring-action/30"
        />
        <span>:</span>
        <input
          type="number"
          min={0}
          max={59}
          value={padTwo(selected.getMinutes())}
          onChange={(e) =>
            onTimeChange(
              selected.getHours(),
              Math.min(59, Math.max(0, Number(e.target.value))),
              selected.getSeconds(),
            )
          }
          className="w-10 px-1 py-0.5 border border-border rounded text-center text-xs focus:outline-none focus:ring-1 focus:ring-action/30"
        />
        <span>:</span>
        <input
          type="number"
          min={0}
          max={59}
          value={padTwo(selected.getSeconds())}
          onChange={(e) =>
            onTimeChange(
              selected.getHours(),
              selected.getMinutes(),
              Math.min(59, Math.max(0, Number(e.target.value))),
            )
          }
          className="w-10 px-1 py-0.5 border border-border rounded text-center text-xs focus:outline-none focus:ring-1 focus:ring-action/30"
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  TimeRangePicker                                                    */
/* ------------------------------------------------------------------ */

const TimeRangePicker: React.FC<TimeRangePickerProps> = ({
  startTime,
  endTime,
  onChange,
  quickIntervals = DEFAULT_INTERVALS,
}) => {
  const [activeInterval, setActiveInterval] = useState<string | null>('1h')
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [editingStart, setEditingStart] = useState(false)
  const [editingEnd, setEditingEnd] = useState(false)
  const [startText, setStartText] = useState(formatDateTime(startTime))
  const [endText, setEndText] = useState(formatDateTime(endTime))
  const [tempStart, setTempStart] = useState<Date>(cloneDate(startTime))
  const [tempEnd, setTempEnd] = useState<Date>(cloneDate(endTime))

  const calendarRef = useRef<HTMLDivElement>(null)
  const startInputRef = useRef<HTMLInputElement>(null)
  const endInputRef = useRef<HTMLInputElement>(null)

  // Sync text when props change externally
  useEffect(() => {
    if (!editingStart) setStartText(formatDateTime(startTime))
  }, [startTime, editingStart])

  useEffect(() => {
    if (!editingEnd) setEndText(formatDateTime(endTime))
  }, [endTime, editingEnd])

  // Close calendar on outside click
  useEffect(() => {
    if (!calendarOpen) return
    const handler = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setCalendarOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [calendarOpen])

  /* ---- Active interval helper ---- */
  const getActiveMs = useCallback((): number => {
    if (activeInterval) {
      const found = quickIntervals.find((q) => q.value === activeInterval)
      if (found) return found.ms
    }
    // Fallback: current range duration
    return endTime.getTime() - startTime.getTime()
  }, [activeInterval, quickIntervals, startTime, endTime])

  /* ---- Arrow handlers ---- */
  const handlePrev = () => {
    const ms = getActiveMs()
    onChange(new Date(startTime.getTime() - ms), new Date(endTime.getTime() - ms))
  }

  const handleNext = () => {
    const ms = getActiveMs()
    onChange(new Date(startTime.getTime() + ms), new Date(endTime.getTime() + ms))
  }

  /* ---- Quick interval ---- */
  const handleQuick = (q: QuickInterval) => {
    setActiveInterval(q.value)
    const now = new Date()
    if (q.value === 'today') {
      const s = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
      const e = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      onChange(s, e)
    } else if (q.value === 'yesterday') {
      const y = new Date(now.getTime() - DAY_MS)
      const s = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0)
      const e = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59)
      onChange(s, e)
    } else {
      onChange(new Date(now.getTime() - q.ms), now)
    }
  }

  /* ---- Inline edit commit ---- */
  const commitStartEdit = () => {
    setEditingStart(false)
    const parsed = parseDateTime(startText)
    if (parsed && parsed.getTime() < endTime.getTime()) {
      setActiveInterval(null)
      onChange(parsed, endTime)
    } else {
      setStartText(formatDateTime(startTime))
    }
  }

  const commitEndEdit = () => {
    setEditingEnd(false)
    const parsed = parseDateTime(endText)
    if (parsed && parsed.getTime() > startTime.getTime()) {
      setActiveInterval(null)
      onChange(startTime, parsed)
    } else {
      setEndText(formatDateTime(endTime))
    }
  }

  /* ---- Calendar open ---- */
  const openCalendar = () => {
    setTempStart(cloneDate(startTime))
    setTempEnd(cloneDate(endTime))
    setCalendarOpen(true)
  }

  const applyCalendar = () => {
    if (tempStart.getTime() < tempEnd.getTime()) {
      setActiveInterval(null)
      onChange(tempStart, tempEnd)
    }
    setCalendarOpen(false)
  }

  const cancelCalendar = () => {
    setCalendarOpen(false)
  }

  /* ---- Calendar date/time callbacks ---- */
  const handleTempStartDate = (d: Date) => setTempStart(d)
  const handleTempStartTime = (h: number, m: number, s: number) => {
    const d = cloneDate(tempStart)
    d.setHours(h, m, s)
    setTempStart(d)
  }
  const handleTempEndDate = (d: Date) => setTempEnd(d)
  const handleTempEndTime = (h: number, m: number, s: number) => {
    const d = cloneDate(tempEnd)
    d.setHours(h, m, s)
    setTempEnd(d)
  }

  return (
    <div className="relative inline-flex items-center h-7 bg-white border border-border rounded-md select-none">
      {/* Prev arrow */}
      <button
        type="button"
        onClick={handlePrev}
        className="flex items-center justify-center w-7 h-full text-text-muted hover:text-text-secondary hover:bg-surface-muted transition-colors"
        aria-label="Previous"
      >
        <ChevronLeft size={14} />
      </button>

      <div className="h-4 w-px bg-border" />

      {/* Start datetime */}
      {editingStart ? (
        <input
          ref={startInputRef}
          type="text"
          value={startText}
          onChange={(e) => setStartText(e.target.value)}
          onBlur={commitStartEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitStartEdit()
            if (e.key === 'Escape') {
              setStartText(formatDateTime(startTime))
              setEditingStart(false)
            }
          }}
          className="w-[155px] px-1.5 text-xs font-medium text-text-primary bg-surface-muted border-none outline-none focus:ring-0 text-center"
          autoFocus
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setEditingStart(true)
            setTimeout(() => startInputRef.current?.select(), 0)
          }}
          className="px-1.5 text-xs font-medium text-text-primary hover:bg-surface-alt transition-colors whitespace-nowrap"
        >
          {formatDateTime(startTime)}
        </button>
      )}

      <span className="text-xs text-text-muted px-0.5">~</span>

      {/* End datetime */}
      {editingEnd ? (
        <input
          ref={endInputRef}
          type="text"
          value={endText}
          onChange={(e) => setEndText(e.target.value)}
          onBlur={commitEndEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEndEdit()
            if (e.key === 'Escape') {
              setEndText(formatDateTime(endTime))
              setEditingEnd(false)
            }
          }}
          className="w-[155px] px-1.5 text-xs font-medium text-text-primary bg-surface-muted border-none outline-none focus:ring-0 text-center"
          autoFocus
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setEditingEnd(true)
            setTimeout(() => endInputRef.current?.select(), 0)
          }}
          className="px-1.5 text-xs font-medium text-text-primary hover:bg-surface-alt transition-colors whitespace-nowrap"
        >
          {formatDateTime(endTime)}
        </button>
      )}

      <div className="h-4 w-px bg-border" />

      {/* Quick interval buttons */}
      <div className="flex items-center gap-0.5 px-1">
        {quickIntervals.map((q) => (
          <button
            key={q.value}
            type="button"
            onClick={() => handleQuick(q)}
            className={[
              'px-2 py-0.5 text-xs font-medium rounded transition-colors',
              activeInterval === q.value
                ? 'bg-action text-white'
                : 'text-text-muted hover:text-text-secondary',
            ].join(' ')}
          >
            {q.label}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-border" />

      {/* Calendar button */}
      <button
        type="button"
        onClick={openCalendar}
        className="flex items-center justify-center w-7 h-full text-text-muted hover:text-text-secondary hover:bg-surface-muted transition-colors"
        aria-label="Calendar"
      >
        <Calendar size={14} />
      </button>

      <div className="h-4 w-px bg-border" />

      {/* Next arrow */}
      <button
        type="button"
        onClick={handleNext}
        className="flex items-center justify-center w-7 h-full text-text-muted hover:text-text-secondary hover:bg-surface-muted transition-colors"
        aria-label="Next"
      >
        <ChevronRight size={14} />
      </button>

      {/* Calendar dropdown */}
      {calendarOpen && (
        <div
          ref={calendarRef}
          className="absolute top-full left-0 mt-1 bg-white border border-border rounded-lg shadow-lg z-40 p-4"
        >
          <div className="flex gap-6">
            <MiniCalendar
              label="시작"
              selected={tempStart}
              onSelectDate={handleTempStartDate}
              onTimeChange={handleTempStartTime}
            />
            <div className="w-px bg-border" />
            <MiniCalendar
              label="종료"
              selected={tempEnd}
              onSelectDate={handleTempEndDate}
              onTimeChange={handleTempEndTime}
            />
          </div>

          {/* Apply / Cancel */}
          <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-surface-muted">
            <button
              type="button"
              onClick={cancelCalendar}
              className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary rounded hover:bg-surface-muted transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={applyCalendar}
              className="px-3 py-1.5 text-xs font-medium text-white bg-action rounded hover:bg-action-hover transition-colors"
            >
              적용
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default TimeRangePicker
