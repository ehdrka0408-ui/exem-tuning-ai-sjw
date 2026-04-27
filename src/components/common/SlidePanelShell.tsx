import React, { useEffect, useRef } from 'react'
import { X, PanelLeftOpen, PanelLeftClose } from 'lucide-react'
import { useEscStack } from '../../utils/escStack'
import { getViewport } from '../../utils/viewport'

export type SlidePanelShellWidth = 'narrow' | 'expanded'

export interface SlidePanelShellProps {
  open: boolean
  onClose: () => void
  title: string
  /** 제목 줄 바로 아래에 들어가는 한 줄 슬롯 (큐 상태 라인 등). 비어 있으면 공간도 없음. */
  headerSlot?: React.ReactNode
  /** 패널 폭 모드 — controlled */
  width?: SlidePanelShellWidth
  /** onWidthChange가 없으면 토글 버튼 숨김 */
  onWidthChange?: (w: SlidePanelShellWidth) => void
  children: React.ReactNode
}

const NARROW_WIDTH = 480
const EXPANDED_RATIO = 0.72 // viewport 72%

const SlidePanelShell: React.FC<SlidePanelShellProps> = ({
  open,
  onClose,
  title,
  headerSlot,
  width = 'narrow',
  onWidthChange,
  children,
}) => {
  const [vw, setVw] = React.useState(() => (typeof window !== 'undefined' ? getViewport().w : 1440))
  const lastFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const onResize = () => setVw(getViewport().w)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // 열릴 때 직전 포커스 저장 → 닫힐 때 복원
  useEffect(() => {
    if (open) {
      lastFocusedRef.current = document.activeElement as HTMLElement | null
    } else if (lastFocusedRef.current) {
      lastFocusedRef.current.focus?.()
      lastFocusedRef.current = null
    }
  }, [open])

  // ESC → 글로벌 LIFO 스택
  useEscStack(open, onClose)

  const panelWidth =
    width === 'narrow' ? NARROW_WIDTH : Math.round(vw * EXPANDED_RATIO)

  const showToggle = !!onWidthChange
  const toggleNext: SlidePanelShellWidth = width === 'narrow' ? 'expanded' : 'narrow'

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Panel — 우측 슬라이드, width transition */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex flex-col bg-white shadow-xl transform transition-all duration-200 ease-[var(--ease-out)] ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: panelWidth, minWidth: 320 }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header — sticky 안에서 자체적으로 유지 */}
        <div className="shrink-0 border-b border-border px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-text-primary truncate">{title}</h2>
            <div className="flex items-center gap-0.5 shrink-0">
              {showToggle && (
                <button
                  onClick={() => onWidthChange?.(toggleNext)}
                  className="rounded-md p-1.5 text-text-muted hover:bg-surface-muted hover:text-text-secondary transition-colors"
                  title={width === 'narrow' ? '확장' : '축소'}
                  aria-label={width === 'narrow' ? '패널 확장' : '패널 축소'}
                >
                  {width === 'narrow' ? (
                    <PanelLeftOpen className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-text-muted hover:bg-surface-muted hover:text-text-secondary transition-colors"
                title="닫기"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          {headerSlot && (
            <div className="mt-2 min-w-0">{headerSlot}</div>
          )}
        </div>

        {/* Content — 스크롤은 여기만 */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </>
  )
}

export default SlidePanelShell
