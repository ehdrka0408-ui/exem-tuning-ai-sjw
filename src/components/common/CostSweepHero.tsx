import React from 'react'

/**
 * AI 튜닝 cost sweep 아이콘 — 다목적.
 *
 * Hero 카드(lg/md/sm), 헤더 인디케이터(sm), 테이블 status dot 대체(xs).
 * - animated=true: cost-bar width 애니메이션 + sweep line.
 * - animated=false: 정적 cost-bar 3개(sweep line 없음).
 *
 * CSS 키프레임: src/index.css (cost-bar-1/2/3, cost-sweep-line, sweep-y)
 */
export type CostSweepHeroSize = 'xs' | 'sm' | 'md' | 'lg'
export type CostSweepHeroColor = 'blue' | 'green'

export interface CostSweepHeroProps {
  size?: CostSweepHeroSize
  /** 막대 색상 — blue(code/AI 진행), green(success/AI 완료) */
  color?: CostSweepHeroColor
  /** true: sweep line + bar width 애니메이션. false: 정적 */
  animated?: boolean
  className?: string
}

const FILL: Record<CostSweepHeroColor, string> = {
  blue: 'var(--color-code)',
  green: 'var(--color-success)',
}

const CostSweepHero: React.FC<CostSweepHeroProps> = ({
  size = 'lg',
  color = 'blue',
  animated = true,
  className = '',
}) => {
  const wrapperCls =
    size === 'lg' ? 'size-14' :
    size === 'md' ? 'size-10' :
    size === 'sm' ? 'size-7' :
    /* xs */ 'size-5'
  const svgCls =
    size === 'lg' ? 'size-12' :
    size === 'md' ? 'size-9' :
    size === 'sm' ? 'size-6' :
    /* xs */ 'size-4'
  const lineH = size === 'xs' || size === 'sm' ? 'h-[1px]' : 'h-[2px]'
  const fill = FILL[color]

  return (
    <div className={`relative inline-flex items-center justify-center overflow-hidden ${wrapperCls} ${className}`}>
      <svg className={svgCls} viewBox="0 0 100 100" fill="none">
        <rect className={animated ? 'cost-bar-1' : undefined} y="22" x="15" width="60" height="10" rx="3" fill={fill} />
        <rect className={animated ? 'cost-bar-2' : undefined} y="45" x="15" width="40" height="10" rx="3" fill={fill} opacity="0.65" />
        <rect className={animated ? 'cost-bar-3' : undefined} y="68" x="15" width="50" height="10" rx="3" fill={fill} opacity="0.4" />
      </svg>
      {animated && (
        <div className={`cost-sweep-line absolute left-[12%] right-[12%] rounded-full ${lineH}`} />
      )}
    </div>
  )
}

export default CostSweepHero
