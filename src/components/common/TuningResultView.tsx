import { useState } from 'react'
import { CheckCircle2, XCircle, ArrowRight, Copy, Check, ExternalLink, SquarePen, TrendingDown } from 'lucide-react'
// ─── Types ───────────────────────────────────────────────────────────────────
export interface TuningSessionResult {
  workItemId: string
  originalSql: string
  recommendedSql: string
  originalPlan: string
  recommendedPlan: string
  improvement: {
    elapsed: number   // negative = improvement (e.g. -45 means 45% faster)
    buffers: number
    cost: number
  }
  instance: string
  schema: string
}

interface TuningResultViewProps {
  result: TuningSessionResult
  onNewSql: () => void
  onApprove: () => void
  onReject: () => void
  onViewInPipeline: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={copy} className="p-1 rounded text-text-muted hover:text-text-secondary hover:bg-surface-muted transition-colors" title="복사">
      {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
    </button>
  )
}

function MetricCard({ label, value, unit }: { label: string; value: number; unit?: string }) {
  const abs = Math.abs(value)
  const improved = value < 0
  return (
    <div className="flex-1 rounded-lg border border-border bg-white px-4 py-3 text-center">
      <div className={`text-xl font-bold tabular-nums ${improved ? 'text-success' : 'text-danger'}`}>
        {improved ? '-' : '+'}{abs}%
      </div>
      <div className="text-[11px] text-text-muted mt-0.5">{label}{unit && ` (${unit})`}</div>
    </div>
  )
}

function SqlPanel({ label, sql, className }: { label: string; sql: string; className?: string }) {
  return (
    <div className={`flex-1 min-w-0 flex flex-col ${className ?? ''}`}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface-alt">
        <span className="text-[11px] font-medium text-text-secondary">{label}</span>
        <CopyBtn text={sql} />
      </div>
      <pre className="flex-1 overflow-auto p-3 text-[12px] font-mono leading-[20px] text-text-primary whitespace-pre-wrap break-all">
        {sql}
      </pre>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function TuningResultView({
  result,
  onNewSql,
  onApprove,
  onReject,
  onViewInPipeline,
}: TuningResultViewProps) {
  const [planTab, setPlanTab] = useState<'before' | 'after'>('after')

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-white shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center h-7 w-7 rounded-full bg-success/10">
            <CheckCircle2 size={16} className="text-success" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-text-primary">AI 튜닝 완료</div>
            <div className="text-[11px] text-text-muted">{result.instance} · {result.schema}</div>
          </div>
        </div>
        <button
          onClick={onNewSql}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-action bg-code-bg hover:bg-[#D2E3FC] transition-colors cursor-pointer"
        >
          <SquarePen size={13} />
          새 SQL 입력
        </button>
      </div>

      {/* Content — scrollable */}
      <div className="flex-1 overflow-y-auto">
        {/* Improvement metrics */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-1.5 mb-3">
            <TrendingDown size={14} className="text-success" />
            <span className="text-[12px] font-medium text-text-primary">개선 지표</span>
          </div>
          <div className="flex gap-3">
            <MetricCard label="Elapsed Time" value={result.improvement.elapsed} />
            <MetricCard label="Buffer Gets" value={result.improvement.buffers} />
            <MetricCard label="Cost" value={result.improvement.cost} />
          </div>
        </div>

        {/* SQL Comparison */}
        <div className="px-5 pb-4">
          <div className="text-[12px] font-medium text-text-primary mb-2">SQL 비교</div>
          <div className="flex border border-border rounded-lg overflow-hidden bg-white" style={{ height: 180 }}>
            <SqlPanel label="원본 SQL" sql={result.originalSql} />
            <div className="w-px bg-border shrink-0 relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border border-border flex items-center justify-center">
                <ArrowRight size={10} className="text-text-muted" />
              </div>
            </div>
            <SqlPanel label="추천 SQL" sql={result.recommendedSql} className="bg-code-bg/30" />
          </div>
        </div>

        {/* Plan Comparison */}
        <div className="px-5 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[12px] font-medium text-text-primary">실행계획 비교</span>
            <div className="inline-flex border border-border rounded-md overflow-hidden">
              <button
                onClick={() => setPlanTab('before')}
                className={`px-3 py-1 text-[11px] transition-colors ${planTab === 'before' ? 'bg-action text-white' : 'bg-white text-text-secondary hover:bg-surface-muted'}`}
              >
                Before
              </button>
              <button
                onClick={() => setPlanTab('after')}
                className={`px-3 py-1 text-[11px] transition-colors ${planTab === 'after' ? 'bg-action text-white' : 'bg-white text-text-secondary hover:bg-surface-muted'}`}
              >
                After
              </button>
            </div>
          </div>
          <div className="border border-border rounded-lg overflow-hidden bg-white">
            <pre className="overflow-auto p-3 text-[11px] font-mono leading-[18px] text-text-primary whitespace-pre max-h-[240px]">
              {planTab === 'before' ? result.originalPlan : result.recommendedPlan}
            </pre>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-white shrink-0">
        <button
          onClick={onViewInPipeline}
          className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text-secondary transition-colors"
        >
          <ExternalLink size={12} />
          작업함에서 보기
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onReject}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-[12px] text-text-secondary hover:bg-surface-muted transition-colors"
          >
            <XCircle size={13} />
            반려
          </button>
          <button
            onClick={onApprove}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-action text-white text-[12px] font-medium hover:bg-action-hover transition-colors"
          >
            <CheckCircle2 size={13} />
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
