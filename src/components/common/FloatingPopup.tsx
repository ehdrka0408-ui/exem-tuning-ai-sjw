import React, { useRef, useState, useCallback } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { useEscStack } from '../../utils/escStack';
import { getViewport } from '../../utils/viewport';

interface FloatingPopupProps {
  id: string;
  title: string;
  initialX?: number;
  initialY?: number;
  children: React.ReactNode;
  onClose: (id: string) => void;
  onFocus: (id: string) => void;
  zIndex: number;
}

type EdgeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const EDGE_SIZE = 6;
const MIN_W = 360;
const MIN_H = 300;

const FloatingPopup: React.FC<FloatingPopupProps> = ({
  id,
  title,
  initialX = 200,
  initialY = 80,
  children,
  onClose,
  onFocus,
  zIndex,
}) => {
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const [size, setSize] = useState({ w: 560, h: 520 });
  const [maximized, setMaximized] = useState(false);
  const prevState = useRef({ pos: { x: initialX, y: initialY }, size: { w: 560, h: 520 } });
  const dragRef = useRef<{ startX: number; startY: number; px: number; py: number } | null>(null);
  const edgeRef = useRef<{ startX: number; startY: number; ox: number; oy: number; ow: number; oh: number; dir: EdgeDir } | null>(null);

  useEscStack(true, useCallback(() => onClose(id), [id, onClose]));

  const toggleMaximize = useCallback(() => {
    if (maximized) {
      setPos(prevState.current.pos);
      setSize(prevState.current.size);
      setMaximized(false);
    } else {
      prevState.current = { pos, size };
      const v = getViewport();
      setPos({ x: 0, y: 0 });
      setSize({ w: v.w, h: v.h });
      setMaximized(true);
    }
  }, [maximized, pos, size]);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    if (maximized) return;
    e.preventDefault();
    onFocus(id);
    dragRef.current = { startX: e.clientX, startY: e.clientY, px: pos.x, py: pos.y };

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
  }, [pos, id, onFocus, maximized]);

  // Edge/corner resize
  const onEdgeStart = useCallback((dir: EdgeDir, e: React.MouseEvent) => {
    if (maximized) return;
    e.preventDefault();
    e.stopPropagation();
    onFocus(id);
    edgeRef.current = { startX: e.clientX, startY: e.clientY, ox: pos.x, oy: pos.y, ow: size.w, oh: size.h, dir };

    const onMove = (ev: MouseEvent) => {
      if (!edgeRef.current) return;
      const r = edgeRef.current;
      const dx = ev.clientX - r.startX;
      const dy = ev.clientY - r.startY;
      let nx = r.ox, ny = r.oy, nw = r.ow, nh = r.oh;

      if (r.dir.includes('e')) nw = Math.max(MIN_W, r.ow + dx);
      if (r.dir.includes('s')) nh = Math.max(MIN_H, r.oh + dy);
      if (r.dir.includes('w')) {
        const newW = Math.max(MIN_W, r.ow - dx);
        nx = r.ox + (r.ow - newW);
        nw = newW;
      }
      if (r.dir.includes('n')) {
        const newH = Math.max(MIN_H, r.oh - dy);
        ny = r.oy + (r.oh - newH);
        nh = newH;
      }
      setPos({ x: nx, y: ny });
      setSize({ w: nw, h: nh });
    };
    const onUp = () => {
      edgeRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [pos, size, id, onFocus, maximized]);

  const cursorMap: Record<EdgeDir, string> = {
    n: 'cursor-ns-resize', s: 'cursor-ns-resize',
    e: 'cursor-ew-resize', w: 'cursor-ew-resize',
    ne: 'cursor-nesw-resize', sw: 'cursor-nesw-resize',
    nw: 'cursor-nwse-resize', se: 'cursor-nwse-resize',
  };

  return (
    <div
      className={`fixed flex flex-col bg-white shadow-2xl ${maximized ? '' : 'rounded-lg border border-border'}`}
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h, zIndex }}
      onMouseDown={() => onFocus(id)}
    >
      {/* Title bar — draggable */}
      <div
        className={`flex shrink-0 items-center justify-between border-b border-border px-4 py-3 ${maximized ? '' : 'cursor-move'}`}
        onMouseDown={onDragStart}
      >
        <h2 className="text-sm font-semibold text-text-primary select-none">{title}</h2>
        <div className="flex items-center gap-0.5">
          <button
            onClick={toggleMaximize}
            className="rounded-md p-1.5 text-text-muted hover:bg-surface-muted hover:text-text-secondary transition-colors"
            title={maximized ? '원래 크기' : '전체화면'}
          >
            {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={() => onClose(id)}
            className="rounded-md p-1.5 text-text-muted hover:bg-surface-muted hover:text-text-secondary transition-colors"
            title="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {children}
      </div>

      {/* Edge & corner resize handles — hidden when maximized */}
      {!maximized && (
        <>
          {/* Edges */}
          <div className={`absolute top-0 left-[${EDGE_SIZE}px] right-[${EDGE_SIZE}px] h-[${EDGE_SIZE}px] ${cursorMap.n}`} style={{ top: 0, left: EDGE_SIZE, right: EDGE_SIZE, height: EDGE_SIZE, cursor: 'ns-resize' }} onMouseDown={(e) => onEdgeStart('n', e)} />
          <div style={{ bottom: 0, left: EDGE_SIZE, right: EDGE_SIZE, height: EDGE_SIZE, cursor: 'ns-resize' }} className="absolute" onMouseDown={(e) => onEdgeStart('s', e)} />
          <div style={{ left: 0, top: EDGE_SIZE, bottom: EDGE_SIZE, width: EDGE_SIZE, cursor: 'ew-resize' }} className="absolute" onMouseDown={(e) => onEdgeStart('w', e)} />
          <div style={{ right: 0, top: EDGE_SIZE, bottom: EDGE_SIZE, width: EDGE_SIZE, cursor: 'ew-resize' }} className="absolute" onMouseDown={(e) => onEdgeStart('e', e)} />
          {/* Corners */}
          <div style={{ top: 0, left: 0, width: EDGE_SIZE, height: EDGE_SIZE, cursor: 'nwse-resize' }} className="absolute" onMouseDown={(e) => onEdgeStart('nw', e)} />
          <div style={{ top: 0, right: 0, width: EDGE_SIZE, height: EDGE_SIZE, cursor: 'nesw-resize' }} className="absolute" onMouseDown={(e) => onEdgeStart('ne', e)} />
          <div style={{ bottom: 0, left: 0, width: EDGE_SIZE, height: EDGE_SIZE, cursor: 'nesw-resize' }} className="absolute" onMouseDown={(e) => onEdgeStart('sw', e)} />
          <div style={{ bottom: 0, right: 0, width: EDGE_SIZE, height: EDGE_SIZE, cursor: 'nwse-resize' }} className="absolute" onMouseDown={(e) => onEdgeStart('se', e)} />
        </>
      )}
    </div>
  );
};

export default FloatingPopup;
