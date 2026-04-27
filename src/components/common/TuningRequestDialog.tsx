import { useState, useMemo, useEffect } from 'react'
import { Clock } from 'lucide-react'
import { useEscStack } from '../../utils/escStack'
import QueryTimeoutOverride from './QueryTimeoutOverride'

interface SingleTarget {
  sqlId: string
  instanceName: string
  schemaName: string
  sqlText: string
}

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (opts: { scheduledAt?: string; queryTimeoutSec?: number; groupName: string }) => void
  primaryAction: 'immediate' | 'scheduled'
  mode: 'single' | 'bulk'
  target?: SingleTarget
  bulkCount?: number
  /** 그룹명 기본값 — 외부에서 buildDefaultGroupName()으로 생성해 전달 */
  defaultGroupName?: string
}

type Step = 'idle' | 'scheduling'

function nextAt(hour: number): Date {
  const now = new Date()
  const next = new Date(now)
  next.setHours(hour, 0, 0, 0)
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1)
  }
  return next
}

function formatDateLabel(d: Date): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const day = diffDays === 0 ? '오늘' : diffDays === 1 ? '내일' : `${diffDays}일 후`
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} (${day}) ${hh}:${mi}`
}

function toDatetimeLocalValue(d: Date): string {
  const tzOffset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16)
}

export default function TuningRequestDialog({
  open, onClose, onSubmit, primaryAction, mode, target, bulkCount, defaultGroupName,
}: Props) {
  const [step, setStep] = useState<Step>('idle')
  const [timeoutOverride, setTimeoutOverride] = useState<number | undefined>(undefined)
  const [customAt, setCustomAt] = useState<string>('')
  const [groupName, setGroupName] = useState<string>('')

  useEscStack(open, () => {
    if (step === 'scheduling') setStep('idle')
    else onClose()
  })

  useEffect(() => {
    if (open) {
      setStep('idle')
      setTimeoutOverride(undefined)
      setCustomAt(toDatetimeLocalValue(nextAt(20)))
      setGroupName(defaultGroupName ?? '')
    }
  }, [open, defaultGroupName])

  const presets = useMemo(() => {
    if (!open) return []
    return [
      { key: 'eve20', date: nextAt(20) },
      { key: 'night02', date: nextAt(2) },
    ]
  }, [open])

  if (!open) return null

  const handleImmediate = () => {
    onSubmit({ scheduledAt: undefined, queryTimeoutSec: timeoutOverride, groupName: groupName.slice(0, 128) })
  }

  const handleScheduled = (iso: string) => {
    onSubmit({ scheduledAt: iso, queryTimeoutSec: timeoutOverride, groupName: groupName.slice(0, 128) })
  }

  const handleCustomSubmit = () => {
    if (!customAt) return
    const d = new Date(customAt)
    if (Number.isNaN(d.getTime())) return
    handleScheduled(d.toISOString())
  }

  const filledBtn = 'bg-action text-white hover:bg-action-hover'
  const outlinedBtn = 'bg-white border border-border text-text-primary hover:bg-surface-alt'
  const immediateCls = primaryAction === 'immediate' ? filledBtn : outlinedBtn
  const scheduledCls = primaryAction === 'scheduled' ? filledBtn : outlinedBtn
  const nowMin = toDatetimeLocalValue(new Date())

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-text-primary">
                {mode === 'bulk' ? '일괄 튜닝 요청' : '튜닝 요청'}
              </h3>

              {mode === 'single' && target && (
                <div className="mt-3 rounded-md border border-border bg-surface-alt px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-text-muted w-12 shrink-0">SQL ID</span>
                    <span className="font-mono text-[13px] font-semibold text-text-primary">{target.sqlId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-text-muted w-12 shrink-0">인스턴스</span>
                    <span className="text-[13px] text-text-secondary">{target.instanceName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-text-muted w-12 shrink-0">스키마</span>
                    <span className="text-[13px] text-text-secondary">{target.schemaName}</span>
                  </div>
                  <div className="flex items-start gap-2 pt-0.5 border-t border-border">
                    <span className="text-[11px] text-text-muted w-12 shrink-0 pt-0.5">SQL</span>
                    <span className="font-mono text-[11px] text-text-muted leading-relaxed line-clamp-2">
                      {target.sqlText.replace(/\s+/g, ' ').slice(0, 100)}
                    </span>
                  </div>
                </div>
              )}
              {mode === 'bulk' && (
                <p className="mt-3 text-[12px] text-text-secondary">
                  선택된 <span className="font-semibold text-text-primary">{bulkCount ?? 0}건</span>의 SQL에 대해 튜닝을 요청합니다.
                </p>
              )}

              {/* 그룹명 입력 */}
              <div className="mt-3">
                <label className="block text-[11px] font-medium text-text-secondary mb-1">그룹명</label>
                <input
                  type="text"
                  value={groupName}
                  maxLength={128}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="그룹명 (선택)"
                  className="w-full rounded-md border border-border bg-white px-3 py-1.5 text-[12px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-action/40"
                />
                <p className="mt-0.5 text-[10px] text-text-muted text-right">{groupName.length}/128</p>
              </div>

              {/* 쿼리 타임아웃 */}
              <div className="mt-3">
                <QueryTimeoutOverride value={timeoutOverride} onChange={setTimeoutOverride} />
              </div>

              {step === 'scheduling' && (
                <div className="mt-4 rounded-md border border-border bg-surface-alt px-3 py-3 space-y-2">
                  <div className="text-[11px] font-medium text-text-secondary mb-1">예약 시각</div>
                  {presets.map(p => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => handleScheduled(p.date.toISOString())}
                      className="w-full text-left rounded-md border border-border bg-white px-3 py-2 text-[13px] text-text-primary hover:bg-surface-muted transition-colors flex items-center gap-2"
                    >
                      <Clock className="h-3.5 w-3.5 text-text-muted shrink-0" />
                      <span>{formatDateLabel(p.date)}</span>
                    </button>
                  ))}
                  <div className="pt-1 border-t border-border">
                    <div className="text-[10px] text-text-muted mt-1.5 mb-1">직접 지정</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="datetime-local"
                        value={customAt}
                        min={nowMin}
                        onChange={e => setCustomAt(e.target.value)}
                        className="flex-1 rounded-md border border-border bg-white px-2 py-1.5 text-[12px] font-mono focus:outline-none focus:ring-1 focus:ring-action/30"
                      />
                      <button
                        type="button"
                        onClick={handleCustomSubmit}
                        disabled={!customAt}
                        className="rounded-md bg-action text-white px-3 py-1.5 text-[12px] font-medium hover:bg-action-hover disabled:bg-surface-muted disabled:text-text-muted disabled:cursor-not-allowed transition-colors"
                      >
                        확인
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-text-muted pt-1">선택한 시각에 접수됩니다.</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            {step === 'idle' ? (
              <>
                <button
                  onClick={onClose}
                  className="rounded-md border border-border bg-white px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-alt transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={() => setStep('scheduling')}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${scheduledCls}`}
                >
                  예약 요청
                </button>
                <button
                  onClick={handleImmediate}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${immediateCls}`}
                >
                  즉시 요청
                </button>
              </>
            ) : (
              <button
                onClick={() => setStep('idle')}
                className="rounded-md border border-border bg-white px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-alt transition-colors"
              >
                뒤로
              </button>
            )}
          </div>

          {step === 'idle' && (
            <p className="mt-3 text-[11px] text-text-muted text-right">
              {primaryAction === 'immediate' ? '지금 접수됩니다.' : '선택한 시각에 접수됩니다.'}
            </p>
          )}
        </div>
      </div>
    </>
  )
}
