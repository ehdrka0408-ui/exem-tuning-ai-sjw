import { useState } from 'react'
import { showToast } from '../../components/common/Toast'

/* ─── Types ──────────────────────────────────────────────── */

type ExecType = 'once' | 'repeat' | 'immediate'

interface CardState {
  source: string
  instance: string
  schema: string
  periodStart: string
  periodStartTime: string
  periodEnd: string
  periodEndTime: string
  execType: ExecType
  schedDate: string
  schedTime: string
  repeatPeriod: string
  previewOpen: boolean
}

interface Preset {
  id: number
  name: string
  abbrev: string
  desc: string
  lastRun: string | null
  lastRunResult: string | null
  repeatDesc: string | null
  defaultSchedTime: string
  previewMetric: string
}

/* ─── Constants ──────────────────────────────────────────── */

const INSTANCES = ['전체', '운영DB-1', '운영DB-2', '운영DB-3', '검증DB-1', '검증DB-2', '검증DB-3']

const REPEAT_PERIODS = ['매일', '매주 월요일', '매주 화요일', '매주 수요일', '매주 목요일', '매주 금요일', '매주 월수금']

const PRESETS: Preset[] = [
  {
    id: 1,
    name: 'CPU Time 기준 Top SQL 10',
    abbrev: 'CPU Top10',
    desc: 'DB 전반 CPU 사용률 절감',
    lastRun: '03/16 02:00',
    lastRunResult: '완료 8  실패 2',
    repeatDesc: '매일 02:00 활성',
    defaultSchedTime: '02:00',
    previewMetric: 'CPU Time',
  },
]

const PREVIEW_ITEMS = [
  { sql: 'SELECT emp_id, dept_name, salary_grade FROM hr.employees WHERE...', metric: '45.2s', instance: '운영DB-1' },
  { sql: 'SELECT order_amt, qty_ordered FROM sales.orders WHERE...', metric: '38.7s', instance: '운영DB-1' },
  { sql: 'SELECT dept_budget, fiscal_yr FROM finance.budgets WHERE...', metric: '31.4s', instance: '운영DB-2' },
  { sql: 'SELECT inv_total, warehouse_id FROM inventory.stock WHERE...', metric: '28.9s', instance: '운영DB-1' },
  { sql: 'SELECT salary_sum, bonus_rate FROM payroll.calc WHERE...', metric: '25.3s', instance: '검증DB-1' },
  { sql: 'SELECT cust_name, credit_limit FROM customers.acct WHERE...', metric: '22.1s', instance: '운영DB-2' },
  { sql: 'SELECT prod_code, unit_price FROM products.catalog WHERE...', metric: '19.8s', instance: '운영DB-3' },
  { sql: 'SELECT ship_date, carrier_id FROM logistics.shipments WHERE...', metric: '17.5s', instance: '검증DB-2' },
  { sql: 'SELECT acct_balance, last_txn FROM banking.accounts WHERE...', metric: '15.2s', instance: '운영DB-1' },
  { sql: 'SELECT log_entry, timestamp FROM system.audit_log WHERE...', metric: '12.1s', instance: '검증DB-1' },
]

/* ─── Helpers ────────────────────────────────────────────── */

const toast = (msg: string) => showToast({ message: msg, variant: 'success' })

function getDefaults() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const end = fmt(now)
  const start = fmt(new Date(now.getTime() - 7 * 86400_000))
  const sched = fmt(new Date(now.getTime() + 86400_000))
  return { start, end, sched }
}

const DEFAULTS = getDefaults()

function makeInitial(schedTime: string): CardState {
  return {
    source: 'DBA_HIST_SQLSTAT',
    instance: '전체',
    schema: '',
    periodStart: DEFAULTS.start,
    periodStartTime: '00:00',
    periodEnd: DEFAULTS.end,
    periodEndTime: '00:00',
    execType: 'once',
    schedDate: DEFAULTS.sched,
    schedTime,
    repeatPeriod: '매일',
    previewOpen: false,
  }
}

/* ─── Field styles ───────────────────────────────────────── */

const SEL = 'rounded border border-border bg-white px-2 py-1 text-[12px] text-text-primary focus:outline-none focus:border-code cursor-pointer'
const DATE_IN = 'rounded border border-border bg-white px-2 py-1 text-[12px] font-mono text-text-primary focus:outline-none focus:border-code'
const TIME_IN = `${DATE_IN} w-24`

/* ═══════════════════════════════════════════════════════════
   PresetCard
═══════════════════════════════════════════════════════════ */

function PresetCard({
  preset,
  state,
  onChange,
}: {
  preset: Preset
  state: CardState
  onChange: (patch: Partial<CardState>) => void
}) {
  const isImmediate = state.execType === 'immediate'

  function handleConfirm() {
    const dateSlug = state.schedDate.slice(5).replace('-', '/')
    if (state.execType === 'once') {
      toast(`${dateSlug} ${state.schedTime} 예약이 등록되었습니다`)
    } else if (state.execType === 'repeat') {
      toast(`${state.repeatPeriod} ${state.schedTime} 반복 예약이 등록되었습니다`)
    } else {
      toast('큐에 등록되었습니다')
    }
  }

  const lastLine = [
    preset.lastRun
      ? `마지막: ${preset.lastRun} ${preset.lastRunResult}`
      : '마지막: 없음',
    `반복: ${preset.repeatDesc ?? '없음'}`,
  ].join(' · ')

  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">

      {/* ── Main card body ── */}
      <div className="p-6 space-y-5">

        {/* Header */}
        <div>
          <h3 className="text-[15px] font-medium text-text-primary">{preset.name}</h3>
          <p className="mt-0.5 text-[13px] text-text-muted">{preset.desc}</p>
        </div>

        {/* Settings */}
        <div className="space-y-3">

          {/* Source + Instance */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-text-secondary w-8 shrink-0">소스</span>
              <select value={state.source} onChange={e => onChange({ source: e.target.value })} className={SEL}>
                <option>DBA_HIST_SQLSTAT</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-text-secondary w-14 shrink-0">인스턴스</span>
              <select value={state.instance} onChange={e => onChange({ instance: e.target.value })} className={SEL}>
                {INSTANCES.map(inst => <option key={inst}>{inst}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-text-secondary w-12 shrink-0">스키마</span>
              <input
                type="text"
                value={state.schema}
                onChange={e => onChange({ schema: e.target.value })}
                placeholder="전체 (예: HR, FINANCE)"
                className={`${DATE_IN} w-48`}
              />
            </div>
          </div>

          {/* Period */}
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-text-secondary w-8 shrink-0">기간</span>
            <input type="date" value={state.periodStart}  onChange={e => onChange({ periodStart: e.target.value })} className={DATE_IN} />
            <input type="time" value={state.periodStartTime} onChange={e => onChange({ periodStartTime: e.target.value })} className={TIME_IN} />
            <span className="text-[12px] text-text-muted px-1">~</span>
            <input type="date" value={state.periodEnd}    onChange={e => onChange({ periodEnd: e.target.value })} className={DATE_IN} />
            <input type="time" value={state.periodEndTime}   onChange={e => onChange({ periodEndTime: e.target.value })} className={TIME_IN} />
          </div>

          {/* Execution type */}
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-text-secondary w-8 shrink-0">실행</span>
            <select
              value={state.execType}
              onChange={e => onChange({ execType: e.target.value as ExecType })}
              className={SEL}
            >
              <option value="once">1회 예약</option>
              <option value="repeat">반복</option>
              <option value="immediate">즉시 실행</option>
            </select>

            {state.execType === 'once' && (
              <>
                <input type="date" value={state.schedDate}
                  onChange={e => onChange({ schedDate: e.target.value })} className={DATE_IN} />
                <input type="time" value={state.schedTime}
                  onChange={e => onChange({ schedTime: e.target.value })} className={TIME_IN} />
              </>
            )}

            {state.execType === 'repeat' && (
              <>
                <select value={state.repeatPeriod}
                  onChange={e => onChange({ repeatPeriod: e.target.value })} className={SEL}>
                  {REPEAT_PERIODS.map(p => <option key={p}>{p}</option>)}
                </select>
                <input type="time" value={state.schedTime}
                  onChange={e => onChange({ schedTime: e.target.value })} className={TIME_IN} />
              </>
            )}
          </div>

        </div>

        {/* Last run + repeat info */}
        <p className="border-t border-border pt-4 text-[12px] text-text-muted">{lastLine}</p>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onChange({ previewOpen: !state.previewOpen })}
            className="rounded-lg border border-border bg-white px-4 py-2 text-[12px] font-medium text-text-secondary hover:bg-surface-alt transition-colors"
          >
            {state.previewOpen ? '미리보기 접기' : '미리보기'}
          </button>
          <button
            onClick={handleConfirm}
            className={`rounded-lg px-4 py-2 text-[12px] font-medium text-white transition-colors ${
              isImmediate
                ? 'bg-action hover:bg-action-hover ring-2 ring-info/40'
                : 'bg-action hover:bg-action-hover'
            }`}
          >
            {isImmediate ? '즉시 실행' : '예약 확정'}
          </button>
        </div>
      </div>

      {/* ── Preview expansion ── */}
      {state.previewOpen && (
        <div className="border-t border-border px-6 py-5 bg-surface-alt space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            미리보기 (현재 시점 기준)
          </p>

          <div className="overflow-x-auto rounded-lg border border-border bg-white">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border bg-surface-alt text-left">
                  <th className="px-3 py-2.5 font-medium text-text-muted w-8">#</th>
                  <th className="px-3 py-2.5 font-medium text-text-muted">SQL</th>
                  <th className="px-3 py-2.5 font-medium text-text-muted tabular-nums">{preset.previewMetric}</th>
                  {state.instance === '전체' && (
                    <th className="px-3 py-2.5 font-medium text-text-muted">인스턴스</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {PREVIEW_ITEMS.map((item, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-surface-alt transition-colors">
                    <td className="px-3 py-2.5 tabular-nums text-text-muted">{i + 1}</td>
                    <td className="px-3 py-2.5 font-mono text-text-primary max-w-[480px] truncate">{item.sql}</td>
                    <td className="px-3 py-2.5 tabular-nums text-text-secondary">{item.metric}</td>
                    {state.instance === '전체' && (
                      <td className="px-3 py-2.5 text-text-secondary">{item.instance}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[12px] text-text-muted">
            이 목록은 현재 시점 기준이며, 예약 실행 시점에 달라질 수 있습니다.
          </p>
        </div>
      )}

    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   PresetAutoTuning
═══════════════════════════════════════════════════════════ */

export default function PresetAutoTuning() {
  const [states, setStates] = useState<CardState[]>(
    PRESETS.map(p => makeInitial(p.defaultSchedTime))
  )

  function patch(index: number, update: Partial<CardState>) {
    setStates(prev => prev.map((s, i) => i === index ? { ...s, ...update } : s))
  }

  return (
    <div className="space-y-4">
      {PRESETS.map((preset, i) => (
        <PresetCard
          key={preset.id}
          preset={preset}
          state={states[i]}
          onChange={update => patch(i, update)}
        />
      ))}
    </div>
  )
}
