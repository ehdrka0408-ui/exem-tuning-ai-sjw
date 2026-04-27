import React from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
import { useEscStack } from '../../utils/escStack';

interface ConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message?: string;
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'positive';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onConfirm,
  onCancel,
  title,
  message,
  children,
  confirmLabel = '확인',
  cancelLabel = '취소',
  variant = 'danger',
}) => {
  useEscStack(open, onCancel)

  if (!open) return null;

  const iconEl = variant === 'positive'
    ? <Plus className="h-5 w-5 text-text-primary" />
    : <AlertTriangle className={`h-5 w-5 ${variant === 'danger' ? 'text-danger' : 'text-warning'}`} />

  const iconBg = variant === 'positive'
    ? 'bg-surface-muted'
    : variant === 'danger' ? 'bg-danger-light' : 'bg-warning-light'

  const confirmCls = variant === 'positive'
    ? 'bg-action hover:bg-action-hover'
    : variant === 'danger' ? 'bg-danger hover:bg-danger-dark' : 'bg-warning hover:bg-warning-dark'

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
              {iconEl}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-text-primary">{title}</h3>
              {message && <p className="mt-1 text-sm text-text-secondary whitespace-pre-line">{message}</p>}
              {children}
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="rounded-md border border-border bg-white px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-alt transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`rounded-md px-4 py-2 text-sm font-medium text-white transition-colors ${confirmCls}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ConfirmDialog;
