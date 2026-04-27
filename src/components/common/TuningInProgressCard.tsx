import React from 'react'
import CostSweepHero from './CostSweepHero'
import ProgressStepBar, { type ProgressStepNumber, stepToPercent } from './ProgressStepBar'

/**
 * "AI 튜닝 진행 중" 카드 — 연속 바 + 퍼센트 + optional 설명.
 *
 * - narrow:   3-line — hero+title+elapsed / bar(80px)+pct+desc / footer
 * - expanded: 1-line — hero+title+bar(100px)+pct+desc+elapsed+footer inline
 * - compact:  hero+bar(80px)+pct+desc+elapsed / footer
 */
export type TuningInProgressVariant = 'narrow' | 'expanded' | 'compact'

export interface TuningInProgressCardProps {
  variant: TuningInProgressVariant
  currentStep: ProgressStepNumber
  elapsed?: string
  stepDescription?: string
  delayed?: boolean
  title?: string
  footer?: React.ReactNode
  className?: string
}

const DEFAULT_TITLE = 'AI 튜닝 진행 중'

const TuningInProgressCard: React.FC<TuningInProgressCardProps> = ({
  variant,
  currentStep,
  elapsed,
  stepDescription,
  delayed = false,
  title = DEFAULT_TITLE,
  footer,
  className = '',
}) => {
  const pct = stepToPercent(currentStep)
  const pctEl = (
    <span className={`text-[11px] font-mono tabular-nums shrink-0 ${delayed ? 'text-warning font-medium' : 'text-text-muted'}`}>
      {pct}%
    </span>
  )
  const descEl = stepDescription ? (
    <span className={`text-[11px] truncate min-w-0 ${delayed ? 'text-warning font-medium' : 'text-text-secondary'}`}>
      {stepDescription}
    </span>
  ) : null

  // ─────────── COMPACT ───────────
  if (variant === 'compact') {
    return (
      <div className={`rounded-lg border border-border bg-white ${className}`}>
        <div className="flex items-center gap-3 px-3 py-2.5">
          <CostSweepHero size="sm" />
          <ProgressStepBar currentStep={currentStep} delayed={delayed} className="w-[80px] shrink-0" />
          {pctEl}
          {descEl}
          <span className="flex-1" />
          {elapsed && (
            <span className="font-mono text-[11px] tabular-nums text-text-muted shrink-0">{elapsed}</span>
          )}
        </div>
        {(stepDescription || footer) && (
          <div className="border-t border-border/60 px-3 py-2 space-y-2">
            {footer}
          </div>
        )}
      </div>
    )
  }

  // ─────────── EXPANDED (1-line inline) ───────────
  if (variant === 'expanded') {
    return (
      <div className={`rounded-lg border border-border bg-white ${className}`}>
        <div className="flex items-center gap-3 px-4 py-2">
          <CostSweepHero size="xs" />
          <span className="text-[13px] font-semibold text-text-primary whitespace-nowrap">{title}</span>
          <ProgressStepBar currentStep={currentStep} delayed={delayed} className="w-[100px] shrink-0" />
          {pctEl}
          {descEl}
          <span className="flex-1" />
          {elapsed && (
            <span className="font-mono text-[11px] tabular-nums text-text-muted shrink-0">{elapsed}</span>
          )}
          {footer && <div className="shrink-0 ml-1">{footer}</div>}
        </div>
      </div>
    )
  }

  // ─────────── NARROW (3-line) ───────────
  return (
    <div className={`rounded-lg border border-border bg-white ${className}`}>
      {/* Line 1: Hero + title + elapsed */}
      <div className="flex items-center gap-2.5 px-3 py-2">
        <CostSweepHero size="sm" />
        <span className="text-[13px] font-semibold text-text-primary">{title}</span>
        <span className="flex-1" />
        {elapsed && (
          <span className="font-mono text-[11px] tabular-nums text-text-muted shrink-0">{elapsed}</span>
        )}
      </div>
      {/* Line 2: Bar + pct + description */}
      <div className="flex items-center gap-2 px-3 pb-2">
        <ProgressStepBar currentStep={currentStep} delayed={delayed} className="w-[80px] shrink-0" />
        {pctEl}
        {descEl}
      </div>
      {/* Line 3: Footer */}
      {footer && <div className="border-t border-border/60 px-3 py-1.5">{footer}</div>}
    </div>
  )
}

export default TuningInProgressCard
