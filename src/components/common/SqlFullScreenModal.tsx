import React, { useEffect, useCallback, useRef, useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { useEscStack } from '../../utils/escStack';
import { getViewport } from '../../utils/viewport';

export interface PlanRow {
  id: number;
  operation: string;
  name: string;
  rows: number | null;
  bytes: number | null;
  cost: number | null;
  depth: number;
}

export interface BindVariable {
  name: string;
  type: string;
  value: string;
  capturedAt: string;
}

interface SqlFullScreenModalProps {
  open: boolean;
  onClose: () => void;
  sqlId: string;
  sqlText: string;
  planData?: PlanRow[];
  bindData?: BindVariable[];
}

type TabKey = 'sql' | 'plan' | 'bind';

const SqlFullScreenModal: React.FC<SqlFullScreenModalProps> = ({
  open,
  onClose,
  sqlId,
  sqlText,
  planData,
  bindData,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('sql');
  const [pos, setPos] = useState({ x: -1, y: -1 }); // -1 means center
  const [size, setSize] = useState({ w: 0, h: 0 }); // 0 means default 85vw/85vh
  const dragRef = useRef<{ startX: number; startY: number; px: number; py: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; sw: number; sh: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEscStack(open, onClose);

  useEffect(() => {
    if (open) {
      setActiveTab('sql');
      setCopied(false);
      // Reset to center
      setPos({ x: -1, y: -1 });
      setSize({ w: 0, h: 0 });
    }
  }, [open, sqlId]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(sqlText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [sqlText]);

  // Title bar drag
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    const curX = pos.x === -1 ? rect.left : pos.x;
    const curY = pos.y === -1 ? rect.top : pos.y;
    dragRef.current = { startX: e.clientX, startY: e.clientY, px: curX, py: curY };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: Math.max(0, dragRef.current.px + (ev.clientX - dragRef.current.startX)),
        y: Math.max(0, dragRef.current.py + (ev.clientY - dragRef.current.startY)),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [pos]);

  // Bottom-right resize
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    resizeRef.current = { startX: e.clientX, startY: e.clientY, sw: rect.width, sh: rect.height };

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      setSize({
        w: Math.max(400, resizeRef.current.sw + (ev.clientX - resizeRef.current.startX)),
        h: Math.max(300, resizeRef.current.sh + (ev.clientY - resizeRef.current.startY)),
      });
    };
    const onUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  if (!open) return null;

  const formatSql = (raw: string) => {
    const keywords = /\b(SELECT|FROM|WHERE|AND|OR|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP BY|ORDER BY|HAVING|INSERT|INTO|UPDATE|SET|DELETE|VALUES|CREATE|ALTER|DROP|INDEX|TABLE|AS|IN|NOT|NULL|IS|BETWEEN|LIKE|EXISTS|UNION|ALL|DISTINCT|CASE|WHEN|THEN|ELSE|END|WITH|OVER|PARTITION BY|RANK|ROW_NUMBER|SUM|COUNT|AVG|MAX|MIN|NVL|DECODE|SYSDATE|ROWNUM|CONNECT BY|START WITH|PRIOR|LEVEL|SYS_CONNECT_BY_PATH)\b/gi;
    return raw.replace(keywords, match => match.toUpperCase());
  };

  const hasPlan = planData && planData.length > 0;
  const hasBind = bindData && bindData.length > 0;
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'sql', label: 'SQL Text' },
    { key: 'plan', label: 'Execution Plan' },
    { key: 'bind', label: 'Bind Variables' },
  ];

  // Position/size styles — zoom-safe (CSS vw/vh는 zoom 배율만큼 커지므로 JS로 계산)
  const isPositioned = pos.x !== -1;
  const v = getViewport();
  const defaultW = Math.min(1200, v.w * 0.85);
  const defaultH = v.h * 0.85;
  const style: React.CSSProperties = isPositioned
    ? { left: pos.x, top: pos.y, width: size.w || defaultW, height: size.h || defaultH }
    : {
        left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        width: size.w || defaultW, height: size.h || defaultH,
      };

  return (
    <div
      ref={panelRef}
      className="fixed z-[70] flex flex-col rounded-xl border border-border bg-white shadow-2xl"
      style={style}
    >
      {/* Header — draggable */}
      <div
        className="flex shrink-0 cursor-move items-center justify-between border-b border-border px-6 py-4"
        onMouseDown={onDragStart}
      >
        <div className="flex items-center gap-4 select-none">
          <span className="font-mono text-sm font-semibold text-text-secondary">{sqlId}</span>
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-action text-white'
                    : 'text-text-secondary hover:bg-surface-muted'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {activeTab === 'sql' && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-muted transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? '복사됨' : '복사'}
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-text-muted hover:bg-surface-muted hover:text-text-secondary transition-colors"
            title="닫기 (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'sql' && (
          <pre className="h-full whitespace-pre-wrap break-words p-6 font-mono text-sm leading-relaxed text-text-primary">
            <code>{formatSql(sqlText)}</code>
          </pre>
        )}

        {activeTab === 'plan' && hasPlan && (
          <div className="p-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase text-text-secondary">
                  <th className="px-3 py-2 w-12">ID</th>
                  <th className="px-3 py-2">Operation</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2 text-right">Rows</th>
                  <th className="px-3 py-2 text-right">Bytes</th>
                  <th className="px-3 py-2 text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-muted">
                {planData.map(row => (
                  <tr key={row.id} className="hover:bg-surface-alt">
                    <td className="px-3 py-1.5 font-mono text-xs text-text-secondary">{row.id}</td>
                    <td className="px-3 py-1.5">
                      <span style={{ paddingLeft: row.depth * 16 }} className="font-mono text-xs text-text-primary">
                        {row.operation}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs text-text-secondary">{row.name}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs text-text-secondary">{row.rows?.toLocaleString() ?? ''}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs text-text-secondary">{row.bytes?.toLocaleString() ?? ''}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs text-text-secondary">{row.cost?.toLocaleString() ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'plan' && !hasPlan && (
          <div className="flex h-full items-center justify-center text-sm text-text-muted">
            실행계획 데이터가 없습니다.
          </div>
        )}

        {activeTab === 'bind' && hasBind && (
          <div className="p-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase text-text-secondary">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Value</th>
                  <th className="px-3 py-2">Captured At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-muted">
                {bindData.map((b, i) => (
                  <tr key={i} className="hover:bg-surface-alt">
                    <td className="px-3 py-1.5 font-mono text-xs font-medium text-text-primary">{b.name}</td>
                    <td className="px-3 py-1.5 text-xs text-text-secondary">{b.type}</td>
                    <td className="px-3 py-1.5 font-mono text-xs text-text-primary">{b.value}</td>
                    <td className="px-3 py-1.5 text-xs text-text-muted">{b.capturedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'bind' && !hasBind && (
          <div className="flex h-full items-center justify-center text-sm text-text-muted">
            바인드 변수 데이터가 없습니다.
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
        onMouseDown={onResizeStart}
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4 text-border">
          <path d="M14 14L8 14L14 8Z" fill="currentColor" />
          <path d="M14 14L11 14L14 11Z" fill="currentColor" opacity="0.5" />
        </svg>
      </div>
    </div>
  );
};

export default SqlFullScreenModal;
