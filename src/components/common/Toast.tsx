import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface ToastData {
  id: string
  message: string
  variant?: ToastVariant
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

let _toastListener: ((t: ToastData) => void) | null = null

export function showToast(toast: Omit<ToastData, 'id'>) {
  if (_toastListener) {
    _toastListener({ ...toast, id: String(Date.now()) })
  }
}

const variantStyles: Record<ToastVariant, { Icon: typeof CheckCircle2; border: string; iconColor: string }> = {
  success: { Icon: CheckCircle2, border: 'border-success/30', iconColor: 'text-success' },
  error: { Icon: XCircle, border: 'border-danger/30', iconColor: 'text-danger' },
  warning: { Icon: AlertTriangle, border: 'border-warning/30', iconColor: 'text-warning' },
  info: { Icon: Info, border: 'border-action/30', iconColor: 'text-action' },
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([])

  const addToast = useCallback((t: ToastData) => {
    setToasts(prev => [...prev, t])
  }, [])

  useEffect(() => {
    _toastListener = addToast
    return () => { _toastListener = null }
  }, [addToast])

  useEffect(() => {
    if (toasts.length === 0) return
    const latest = toasts[toasts.length - 1]
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== latest.id))
    }, latest.duration ?? 4000)
    return () => clearTimeout(timer)
  }, [toasts])

  if (toasts.length === 0) return null

  return createPortal(
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2" role="status" aria-live="polite">
      {toasts.map(t => {
        const v = variantStyles[t.variant ?? 'success']
        const { Icon } = v
        return (
          <div
            key={t.id}
            className={`flex items-center gap-2.5 rounded-lg border bg-white px-4 py-3 shadow-lg ${v.border}`}
            style={{ minWidth: '280px', maxWidth: '420px', animation: 'toastDrop 250ms var(--ease-out)' }}
          >
            <Icon size={16} className={`shrink-0 ${v.iconColor}`} />
            <span className="text-xs text-text-primary flex-1">{t.message}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action!.onClick()
                  setToasts(prev => prev.filter(x => x.id !== t.id))
                }}
                className="shrink-0 rounded-md bg-action px-2.5 py-1 text-[11px] font-medium text-white hover:bg-action-hover transition-colors"
              >
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="text-text-muted hover:text-text-secondary shrink-0"
              aria-label="닫기"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>,
    document.body,
  )
}
