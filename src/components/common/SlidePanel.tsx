import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Maximize2, Minimize2, ExternalLink } from 'lucide-react';
import Tooltip from './Tooltip';
import { useEscStack } from '../../utils/escStack';
import { getViewport } from '../../utils/viewport';

export type PanelMode = 'slide' | 'maximized';

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
  defaultWidthRatio?: number;
  /** 패널이 열릴 때 시작 모드 — 기본 'slide'. 'maximized'로 지정하면 전체화면 상태로 등장 */
  initialMode?: PanelMode;
  onModeChange?: (mode: PanelMode) => void;
  contentClassName?: string;
  /** 새 탭에서 열기 콜백. 설정하면 헤더에 아이콘 표시. */
  onOpenNewTab?: () => void;
  /** 외부에서 slide 모드 폭을 제어. 설정 시 내부 width 대신 사용. */
  widthOverride?: number;
  /** 현재 패널 폭(px)과 모드를 부모에 전달 */
  onWidthChange?: (width: number, mode: PanelMode) => void;
  /** true면 배경 오버레이 숨김 */
  noBackdrop?: boolean;
  /** 외부에서 모드 제어 — 설정 시 내부 mode를 이 값으로 동기화 */
  controlledMode?: PanelMode;
  /** true면 헤더 영역 숨김 (자식 컴포넌트가 자체 헤더를 가질 때) */
  hideHeader?: boolean;
}

const MIN_WIDTH = 320;
const MAX_WIDTH_RATIO = 0.95;

const SlidePanel: React.FC<SlidePanelProps> = ({
  open,
  onClose,
  title,
  headerContent,
  children,
  defaultWidthRatio,
  initialMode = 'slide',
  onModeChange,
  contentClassName,
  onOpenNewTab,
  widthOverride,
  onWidthChange,
  noBackdrop,
  controlledMode,
  hideHeader,
}) => {
  const [mode, setMode] = useState<PanelMode>(initialMode);

  // 외부 controlledMode 동기화 — controlledMode 변경 시 내부 mode 갱신
  useEffect(() => {
    if (controlledMode != null && controlledMode !== mode) {
      setMode(controlledMode);
    }
  }, [controlledMode]); // eslint-disable-line react-hooks/exhaustive-deps
  const [width, setWidth] = useState(() =>
    Math.round(getViewport().w * (defaultWidthRatio ?? 0.3))
  );
  const resizeRef = useRef<{ startX: number; startW: number } | null>(null);

  // Esc → 글로벌 스택 (LIFO 닫기). F → 전체화면 토글
  useEscStack(open, onClose);
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable) return;
        e.preventDefault();
        setMode(prev => {
          const next = prev === 'maximized' ? 'slide' : 'maximized';
          onModeChange?.(next);
          return next;
        });
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onModeChange]);

  // 열릴 때 initialMode 적용 (예: 외부에서 maximized로 호출)
  useEffect(() => {
    if (open) {
      setMode(initialMode);
      onModeChange?.(initialMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialMode]);

  // Reset mode & width when closed
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setMode(initialMode);
        onModeChange?.(initialMode);
        setWidth(Math.round(getViewport().w * (defaultWidthRatio ?? 0.3)));
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open, defaultWidthRatio, initialMode]);

  // onWidthChange를 ref로 보관 — 의존성 배열에서 제외하여 race condition 방지
  const onWidthChangeRef = useRef(onWidthChange);
  onWidthChangeRef.current = onWidthChange;

  // 폭/모드 변경을 부모에 알림
  useEffect(() => {
    if (!open) return;
    const effectiveW = mode === 'maximized' ? getViewport().w : (widthOverride ?? width);
    onWidthChangeRef.current?.(effectiveW, mode);
  }, [open, mode, width, widthOverride]);

  // Slide panel resize (drag left edge)
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = { startX: e.clientX, startW: width };

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const vw = getViewport().w;
      const maxW = vw * MAX_WIDTH_RATIO;
      const delta = resizeRef.current.startX - ev.clientX;
      const newW = Math.min(maxW, Math.max(MIN_WIDTH, resizeRef.current.startW + delta));
      setWidth(newW);
      onWidthChangeRef.current?.(newW, mode);
    };
    const onUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [width, mode]);

  const isMax = mode === 'maximized';
  const isResizing = resizeRef.current !== null;
  const effectiveWidth = widthOverride ?? width;

  return (
    <>
      {/* Backdrop */}
      {!noBackdrop && !isMax && (
        <div
          className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 ${
            open ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex transform bg-white shadow-xl ease-[var(--ease-out)] ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          width: isMax ? '100%' : `${effectiveWidth}px`,
          minWidth: MIN_WIDTH,
          transition: isResizing ? 'transform 200ms' : 'transform 200ms, width 200ms',
        }}
      >
        {/* Resize handle (left edge) — slide mode only */}
        {!isMax && (
          <div
            className="absolute -left-px top-0 z-10 flex h-full w-[5px] cursor-col-resize items-center justify-center hover:bg-action/10"
            onMouseDown={onResizeStart}
          >
            <div className="h-8 w-0.5 rounded-full bg-border" />
          </div>
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          {!hideHeader && (
          <div className="shrink-0 border-b border-border px-4 py-1.5">
            <div className="flex items-center justify-between">
              {headerContent ? (
                <div className="min-w-0 flex-1">{headerContent}</div>
              ) : (
                <h2 className="text-sm font-semibold text-text-primary truncate">{title}</h2>
              )}
              <div className="flex items-center gap-0.5 shrink-0 ml-3">
                {onOpenNewTab && (
                  <Tooltip label="새 탭에서 열기">
                    <button
                      onClick={onOpenNewTab}
                      className="rounded p-1 text-text-muted hover:bg-surface-muted hover:text-text-secondary transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                )}
                <Tooltip label={isMax ? '원래 크기' : '최대화'} shortcut="F">
                  <button
                    onClick={() => { const next = isMax ? 'slide' : 'maximized'; setMode(next); onModeChange?.(next); }}
                    className="rounded p-1 text-text-muted hover:bg-surface-muted hover:text-text-secondary transition-colors"
                  >
                    {isMax ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </button>
                </Tooltip>
                <Tooltip label="닫기" shortcut="Esc">
                  <button
                    onClick={onClose}
                    className="rounded p-1 text-text-muted hover:bg-surface-muted hover:text-text-secondary transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>
          )}

          {/* Content */}
          <div className={contentClassName ?? 'flex-1 overflow-y-auto p-6'}>
            {children}
          </div>
        </div>
      </div>
    </>
  );
};

export default SlidePanel;
