import React from 'react'

export type ProgressStepNumber = 1 | 2 | 3 | 4 | 5

export interface ProgressStepBarProps {
  currentStep: ProgressStepNumber
  /** 현재 단계가 지연된 상태. 바가 warning 색으로 표시됨. */
  delayed?: boolean
  className?: string
}

export function stepToPercent(step: ProgressStepNumber): number {
  return step === 5 ? 100 : Math.round((step / 5) * 100)
}

const ProgressStepBar: React.FC<ProgressStepBarProps> = ({
  currentStep,
  delayed = false,
  className = '',
}) => {
  const pct = stepToPercent(currentStep)
  const isComplete = currentStep === 5
  const barColor = delayed ? 'bg-warning' : 'bg-action'

  return (
    <div className={`h-1.5 rounded-full bg-border/30 overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full ${barColor} relative overflow-hidden transition-[width] duration-300`}
        style={{ width: `${pct}%` }}
      >
        {!isComplete && (
          <div className="absolute inset-0 tuning-gauge-shimmer" />
        )}
      </div>
    </div>
  )
}

export default ProgressStepBar
