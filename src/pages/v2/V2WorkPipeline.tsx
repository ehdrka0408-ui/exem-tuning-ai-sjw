import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  LayoutGrid,
  List,
  ArrowRight,
  CheckCircle2,
  X,
} from 'lucide-react';
import { MetricCard, Badge, SourceBadge, ImprovementBadge, SlidePanel, Button } from '../../components/common';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import {
  v2WorkItems,
  v2StatusLabels,
  v2StatusColors,
  type V2WorkItem,
  type V2Status,
} from '../../mocks/v2WorkItems';
import { getNewV2Items } from '../../mocks/newItemsStore';

const KANBAN_COLUMNS: V2Status[] = ['pending', 'tuning', 'approval_pending', 'apply_pending', 'applied'];
const ALL_STATUSES: V2Status[] = [...KANBAN_COLUMNS, 'rejected', 'failed', 'no_improve'];

type ViewMode = 'kanban' | 'list';
type Preset = 'all' | 'auto-today' | 'tuned_review' | 'mine';

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'auto-today', label: '오늘 자동튜닝' },
  { key: 'tuned_review', label: '튜닝완료만' },
  { key: 'mine', label: '내 작업만' },
];

const MY_NAME = '김민수';

export default function V2WorkPipeline() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPreset = (searchParams.get('preset') as Preset) || 'all';

  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [preset, setPreset] = useState<Preset>(initialPreset);
  const [previewItem, setPreviewItem] = useState<V2WorkItem | null>(null);

  // 인라인 상태 변경 추적 (일괄검증, 단건검증 후 로컬 반영)
  const [statusOverrides, setStatusOverrides] = useState<Record<string, V2Status>>({});
  const getStatus = useCallback((item: V2WorkItem) => statusOverrides[item.id] ?? item.status, [statusOverrides]);

  // 체크박스 선택
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 확인 모달
  const [confirmAction, setConfirmAction] = useState<null | {
    title: string; message: string; variant: 'danger' | 'warning'; onConfirm: () => void;
  }>(null);

  // 반려 사유 모달
  const [rejectTarget, setRejectTarget] = useState<V2WorkItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const filtered = useMemo(() => {
    const allItems = [...v2WorkItems, ...getNewV2Items()]
    // scheduled 항목은 작업함에서 기본 제외 (예약·반복 탭에서만 표시)
    let items = allItems
      .map((w) => ({
        ...w,
        status: statusOverrides[w.id] ?? w.status,
      }))
      .filter((w) => w.status !== 'scheduled');
    switch (preset) {
      case 'auto-today':
        items = items.filter((i) => i.selectionSource === 'auto');
        break;
      case 'tuned_review':
        items = items.filter((i) => i.status === 'approval_pending');
        break;
      case 'mine':
        items = items.filter((i) => i.assignee === MY_NAME);
        break;
    }
    return items;
  }, [preset, statusOverrides]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of ALL_STATUSES) counts[s] = 0;
    for (const item of filtered) counts[item.status] = (counts[item.status] || 0) + 1;
    return counts;
  }, [filtered]);

  const handleCardClick = (item: V2WorkItem, e: React.MouseEvent) => {
    if (e.shiftKey) {
      setPreviewItem(item);
    } else {
      const ctx = preset === 'tuned_review' ? '?context=tuned_review' : '';
      navigate(`/v2/work/${item.id}${ctx}`);
    }
  };

  // ─── 단건 확인 ────────────────────────────
  const handleVerify = useCallback((item: V2WorkItem) => {
    setConfirmAction({
      title: '확인', variant: 'warning',
      message: `${item.sqlId} — ${item.workName}을(를) 확인 처리하시겠습니까?\n\n확인 시 반영대기 상태로 전환됩니다.`,
      onConfirm: () => {
        setStatusOverrides((prev) => ({ ...prev, [item.id]: 'apply_pending' }));
        setSelectedIds((prev) => { const n = new Set(prev); n.delete(item.id); return n; });
        setConfirmAction(null);
      },
    });
  }, []);

  // ─── 단건 반려 ────────────────────────────
  const handleTuningImpossible = useCallback((item: V2WorkItem) => {
    setRejectTarget(item);
    setRejectReason('');
  }, []);

  const confirmTuningImpossible = useCallback(() => {
    if (!rejectTarget) return;
    setStatusOverrides((prev) => ({ ...prev, [rejectTarget.id]: 'rejected' }));
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(rejectTarget.id); return n; });
    setRejectTarget(null);
    setRejectReason('');
  }, [rejectTarget]);

  // ─── 일괄 확인 ────────────────────────────
  const handleBulkVerify = useCallback(() => {
    const ids = [...selectedIds];
    const items = filtered.filter((w) => ids.includes(w.id) && w.status === 'approval_pending');
    if (items.length === 0) return;
    setConfirmAction({
      title: '일괄 확인', variant: 'warning',
      message: `${items.length}건을 일괄 확인 처리하시겠습니까?\n\n확인 시 반영대기 상태로 전환됩니다.`,
      onConfirm: () => {
        const overrides: Record<string, V2Status> = {};
        items.forEach((w) => { overrides[w.id] = 'apply_pending'; });
        setStatusOverrides((prev) => ({ ...prev, ...overrides }));
        setSelectedIds(new Set());
        setConfirmAction(null);
      },
    });
  }, [selectedIds, filtered]);

  // ─── 체크박스 토글 ────────────────────────────
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // 선택된 approval_pending 건수
  const selectedTunedCount = [...selectedIds].filter((id) => {
    const it = filtered.find((w) => w.id === id);
    return it && it.status === 'approval_pending';
  }).length;

  // approval_pending 전체 선택/해제
  const tunedItems = filtered.filter((w) => w.status === 'approval_pending');
  const allTunedSelected = tunedItems.length > 0 && tunedItems.every((w) => selectedIds.has(w.id));
  const toggleSelectAllTuned = useCallback(() => {
    if (allTunedSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tunedItems.map((w) => w.id)));
    }
  }, [allTunedSelected, tunedItems]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4">
        <MetricCard label="전체 작업" value={filtered.length} />
        <MetricCard label="튜닝중" value={statusCounts.tuning || 0} />
        <MetricCard label="튜닝완료" value={statusCounts.approval_pending || 0} />
        <MetricCard label="반영대기" value={statusCounts.apply_pending || 0} />
        <MetricCard label="반영완료" value={statusCounts.applied || 0} />
      </div>

      {/* Filters + View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => { setPreset(p.key); setSelectedIds(new Set()); }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                preset === p.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
          <button
            onClick={() => setViewMode('kanban')}
            className={`rounded-md p-1.5 ${viewMode === 'kanban' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            title="칸반 뷰"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`rounded-md p-1.5 ${viewMode === 'list' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            title="리스트 뷰"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      {viewMode === 'kanban' ? (
        <KanbanView
          items={filtered}
          onCardClick={handleCardClick}
          statusCounts={statusCounts}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
          allTunedSelected={allTunedSelected}
          toggleSelectAllTuned={toggleSelectAllTuned}
        />
      ) : (
        <ListView
          items={filtered}
          onCardClick={handleCardClick}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
          allTunedSelected={allTunedSelected}
          toggleSelectAllTuned={toggleSelectAllTuned}
          onVerify={handleVerify}
          onTuningImpossible={handleTuningImpossible}
          getStatus={getStatus}
        />
      )}

      {/* Floating Action Bar */}
      {selectedTunedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-xl border border-slate-300 bg-white px-6 py-3 shadow-xl">
          <span className="text-sm font-medium text-slate-700">{selectedTunedCount}건 선택됨</span>
          <Button size="sm" onClick={handleBulkVerify}>
            <CheckCircle2 size={13} className="mr-1" /> 일괄 확인
          </Button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-slate-500 transition-colors hover:text-slate-700"
          >
            선택 해제
          </button>
        </div>
      )}

      {/* Preview SlidePanel */}
      <SlidePanel
        open={!!previewItem}
        onClose={() => setPreviewItem(null)}
        title={previewItem?.workName || ''}
      >
        {previewItem && <PreviewContent item={previewItem} />}
      </SlidePanel>

      {/* ─── 확인 모달 ─── */}
      {confirmAction && (
        <ConfirmDialog
          open
          title={confirmAction.title}
          message={confirmAction.message}
          variant={confirmAction.variant}
          confirmLabel="확인"
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* ─── 반려 사유 모달 ─── */}
      {rejectTarget && (
        <>
          <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setRejectTarget(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-[420px] overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h3 className="text-sm font-semibold text-slate-900">반려</h3>
                <button onClick={() => setRejectTarget(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
              </div>
              <div className="px-5 py-4">
                <div className="mb-2 text-xs text-slate-500">{rejectTarget.sqlId} — {rejectTarget.workName}</div>
                <label className="mb-1 block text-xs font-medium text-slate-700">반려 사유</label>
                <textarea
                  className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                  rows={3}
                  placeholder="반려 사유를 입력하세요..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
                <Button size="sm" variant="secondary" onClick={() => setRejectTarget(null)}>취소</Button>
                <Button size="sm" variant="danger" onClick={confirmTuningImpossible} disabled={!rejectReason.trim()}>반려</Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Kanban View (상태별 조감 + 일괄선택) ─── */
function KanbanView({
  items,
  onCardClick,
  statusCounts,
  selectedIds,
  toggleSelect,
  allTunedSelected,
  toggleSelectAllTuned,
}: {
  items: V2WorkItem[];
  onCardClick: (item: V2WorkItem, e: React.MouseEvent) => void;
  statusCounts: Record<string, number>;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  allTunedSelected: boolean;
  toggleSelectAllTuned: () => void;
}) {
  const columnItems = useMemo(() => {
    const map: Record<V2Status, V2WorkItem[]> = {
      scheduled: [], pending: [], tuning: [], approval_pending: [],
      apply_pending: [], applied: [], rejected: [], failed: [],
      cancelled: [], no_improve: [],
    };
    for (const item of items) {
      map[item.status]?.push(item);
    }
    return map;
  }, [items]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {KANBAN_COLUMNS.map((status) => {
        const isHighlight = status === 'approval_pending';
        const isTunedCol = status === 'approval_pending';
        return (
          <div
            key={status}
            className={`flex w-56 shrink-0 flex-col rounded-lg border bg-slate-50 ${
              isHighlight ? 'border-emerald-300' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
              <div className="flex items-center gap-1.5">
                {isTunedCol && columnItems.approval_pending.length > 0 && (
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={allTunedSelected}
                    onChange={toggleSelectAllTuned}
                    title="전체 선택"
                  />
                )}
                <span className="text-sm font-semibold text-slate-700">
                  {v2StatusLabels[status]}
                </span>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${v2StatusColors[status]}`}>
                {statusCounts[status] || 0}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2" style={{ maxHeight: 'calc(70vh / 1.1)' }}>
              {columnItems[status].map((item) => (
                <KanbanCard
                  key={item.id}
                  item={item}
                  onClick={onCardClick}
                  selectable={isTunedCol}
                  selected={selectedIds.has(item.id)}
                  onToggleSelect={toggleSelect}
                />
              ))}
              {columnItems[status].length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400">-</div>
              )}
            </div>
          </div>
        );
      })}


      {(['rejected', 'failed', 'no_improve'] as const).map((sideStatus) => {
        const count = statusCounts[sideStatus] || 0;
        if (count === 0) return null;
        const sideItems = items.filter((i) => i.status === sideStatus);
        const isError = sideStatus === 'rejected' || sideStatus === 'failed';
        return (
          <div
            key={sideStatus}
            className="flex w-56 shrink-0 flex-col rounded-lg border border-slate-200 bg-slate-50"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
              <span className="text-sm font-semibold text-slate-700">
                {v2StatusLabels[sideStatus]}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  isError ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {count}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2" style={{ maxHeight: 'calc(70vh / 1.1)' }}>
              {sideItems.map((item) => (
                <KanbanCard
                  key={item.id}
                  item={item}
                  onClick={onCardClick}
                  isTuningImpossible={isError}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({
  item,
  onClick,
  isTuningImpossible = false,
  selectable = false,
  selected = false,
  onToggleSelect,
}: {
  item: V2WorkItem;
  onClick: (item: V2WorkItem, e: React.MouseEvent) => void;
  isTuningImpossible?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  return (
    <div
      onClick={(e) => onClick(item, e)}
      className={`group relative w-full cursor-pointer rounded-md border bg-white p-3 text-left shadow-sm transition-shadow hover:shadow-md ${
        isTuningImpossible
          ? 'border-l-2 border-l-red-500 border-t-slate-200 border-r-slate-200 border-b-slate-200'
          : selected
            ? 'border-indigo-400 ring-1 ring-indigo-200'
            : 'border-slate-200'
      }`}
    >
      {selectable && (
        <div className="absolute right-2 top-2" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            checked={selected}
            onChange={() => onToggleSelect?.(item.id)}
          />
        </div>
      )}
      <div className="mb-1 font-mono text-xs text-slate-400">{item.sqlId}</div>
      <div className="mb-2 truncate text-sm text-slate-700">{item.sqlText.slice(0, 60)}...</div>

      {item.tunedElapsed !== undefined && (
        <div className="mb-2 flex items-center gap-1 text-xs">
          <span className="text-slate-500">{(item.originalElapsed / 1000).toFixed(1)}s</span>
          <span className="text-slate-400">&rarr;</span>
          <span className="font-medium text-green-600">{(item.tunedElapsed / 1000).toFixed(1)}s</span>
          {item.improvementRate != null && item.improvementRate !== 0 ? (
            <span className={`ml-1 font-medium ${item.improvementRate > 0 ? (item.status === 'applied' ? 'text-green-600' : 'text-slate-500') : 'text-red-500'}`}>
              {item.improvementRate > 0 ? '↓' : '↑'}{Math.abs(item.improvementRate)}%
            </span>
          ) : null}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {item.recommendationType && (
            <Badge variant={item.recommendationType === 'rewrite' ? 'info' : item.recommendationType === 'index' ? 'success' : 'neutral'}>
              {item.recommendationType}
            </Badge>
          )}
          <Badge variant={item.type === 'tuning' ? 'info' : 'warning'}>
            {item.type === 'tuning' ? '튜닝' : '검증'}
          </Badge>
        </div>
        <span className="text-xs text-slate-400">{item.assignee}</span>
      </div>
    </div>
  );
}

/* ─── List View (일괄검증 처리 전용) ─── */
function ListView({
  items,
  onCardClick,
  selectedIds,
  toggleSelect,
  allTunedSelected,
  toggleSelectAllTuned,
  onVerify,
  onTuningImpossible,
  getStatus,
}: {
  items: V2WorkItem[];
  onCardClick: (item: V2WorkItem, e: React.MouseEvent) => void;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  allTunedSelected: boolean;
  toggleSelectAllTuned: () => void;
  onVerify: (item: V2WorkItem) => void;
  onTuningImpossible: (item: V2WorkItem) => void;
  getStatus: (item: V2WorkItem) => V2Status;
}) {
  // 정렬: tuned 맨 위, 그 안에서 개선률 내림차순 (트리아지)
  const sorted = useMemo(() => {
    const STATUS_SORT: Record<V2Status, number> = {
      approval_pending: 0, pending: 1, tuning: 2, apply_pending: 3,
      applied: 4, no_improve: 5, rejected: 6, failed: 7, cancelled: 8,
      scheduled: 9,
    };
    return [...items].sort((a, b) => {
      const sa = STATUS_SORT[getStatus(a)] ?? 99;
      const sb = STATUS_SORT[getStatus(b)] ?? 99;
      if (sa !== sb) return sa - sb;
      // approval_pending 내에서는 개선률 내림차순
      if (getStatus(a) === 'approval_pending' && getStatus(b) === 'approval_pending') {
        return (b.improvementRate ?? 0) - (a.improvementRate ?? 0);
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [items, getStatus]);

  const hasTuned = items.some((w) => getStatus(w) === 'approval_pending');

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {hasTuned && (
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={allTunedSelected}
                  onChange={toggleSelectAllTuned}
                  title="튜닝완료 전체 선택"
                />
              </th>
            )}
            <th className="px-3 py-2 text-left font-medium text-slate-500">상태</th>
            <th className="px-3 py-2 text-left font-medium text-slate-500">SQL ID</th>
            <th className="px-3 py-2 text-left font-medium text-slate-500">작업명</th>
            <th className="px-3 py-2 text-left font-medium text-slate-500">유형</th>
            <th className="px-3 py-2 text-right font-medium text-slate-500">Elapsed (원본)</th>
            <th className="px-3 py-2 text-right font-medium text-slate-500">Elapsed (튜닝)</th>
            <th className="px-3 py-2 text-right font-medium text-slate-500">개선률</th>
            <th className="px-3 py-2 text-left font-medium text-slate-500">추천유형</th>
            <th className="px-3 py-2 text-left font-medium text-slate-500">담당자</th>
            <th className="px-3 py-2 text-center font-medium text-slate-500">빠른 액션</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => {
            const st = getStatus(item);
            const isTuned = st === 'approval_pending';
            return (
              <tr
                key={item.id}
                onClick={(e) => onCardClick(item, e)}
                className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${
                  isTuned ? 'bg-emerald-50/40' : ''
                }`}
              >
                {hasTuned && (
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    {isTuned ? (
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                      />
                    ) : (
                      <span />
                    )}
                  </td>
                )}
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${v2StatusColors[st]}`}>
                    {v2StatusLabels[st]}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-slate-600">{item.sqlId}</td>
                <td className="max-w-xs truncate px-3 py-2 text-slate-700">{item.workName}</td>
                <td className="px-3 py-2">
                  <Badge variant={item.type === 'tuning' ? 'info' : 'warning'}>
                    {item.type === 'tuning' ? '튜닝' : '검증'}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right font-mono text-slate-600">
                  {(item.originalElapsed / 1000).toFixed(1)}s
                </td>
                <td className="px-3 py-2 text-right font-mono text-slate-600">
                  {item.tunedElapsed ? `${(item.tunedElapsed / 1000).toFixed(1)}s` : '-'}
                </td>
                <td className="px-3 py-2 text-right">
                  {item.improvementRate ? (
                    <ImprovementBadge rate={item.improvementRate} />
                  ) : (
                    <span className="text-xs text-slate-300">-</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {item.recommendationType ? (
                    <Badge variant="neutral">{item.recommendationType}</Badge>
                  ) : '-'}
                </td>
                <td className="px-3 py-2 text-slate-600">{item.assignee}</td>
                <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                  {isTuned ? (
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => onVerify(item)}
                        className="rounded bg-indigo-600 px-2 py-0.5 text-[11px] font-medium text-white transition-colors hover:bg-indigo-700"
                      >
                        확인
                      </button>
                      <button
                        onClick={() => onTuningImpossible(item)}
                        className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-100"
                      >
                        반려
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-300">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Preview Content ─── */
function PreviewContent({ item }: { item: V2WorkItem }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${v2StatusColors[item.status]}`}>
          {v2StatusLabels[item.status]}
        </span>
        <SourceBadge source={item.source} />
        <Badge variant={item.type === 'tuning' ? 'info' : 'warning'}>
          {item.type === 'tuning' ? '튜닝' : '검증'}
        </Badge>
      </div>

      <div>
        <div className="text-xs text-slate-500">SQL ID</div>
        <div className="font-mono text-sm">{item.sqlId}</div>
      </div>

      <div>
        <div className="text-xs text-slate-500">인스턴스 / 스키마</div>
        <div className="text-sm">{item.instanceName} / {item.schemaName}</div>
      </div>

      {item.tunedElapsed !== undefined && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-slate-500">Elapsed</div>
            <div className="text-sm">
              {(item.originalElapsed / 1000).toFixed(1)}s &rarr; {(item.tunedElapsed / 1000).toFixed(1)}s
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">개선률</div>
            {item.improvementRate && <ImprovementBadge rate={item.improvementRate} />}
          </div>
        </div>
      )}

      <button
        onClick={() => navigate(`/v2/work/${item.id}`)}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        상세 보기 <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
