import type { ReactNode } from 'react'

interface TooltipProps {
  label: string
  shortcut?: string
  children: ReactNode
  position?: 'top' | 'bottom'
}

export default function Tooltip({ label, shortcut, children, position = 'bottom' }: TooltipProps) {
  const isTop = position === 'top'

  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-50 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-md bg-action px-2 py-1 text-[11px] leading-none text-white opacity-0 transition-opacity duration-[var(--duration-fast)] group-hover/tip:opacity-100 group-hover/tip:delay-400 ${
          isTop ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
        }`}
      >
        {label}
        {shortcut && (
          <kbd className="rounded bg-white/15 px-1 py-0.5 font-mono text-[10px] leading-none tracking-wide">
            {shortcut}
          </kbd>
        )}
        {/* Arrow */}
        <span
          className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
            isTop
              ? 'top-full border-t-action'
              : 'bottom-full border-b-action'
          }`}
        />
      </span>
    </span>
  )
}
