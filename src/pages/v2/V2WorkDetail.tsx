import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Clock,
  Play,
  RotateCcw,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  StepIndicator,
  Badge,
  SourceBadge,
  SqlTextBlock,
  PlanCompare,
  ImprovementBadge,
  ConfirmDialog,
  Button,
} from '../../components/common';
import {
  v2WorkItems,
  v2StatusLabels,
  v2StatusColors,
  type V2WorkItem,
  type V2Status,
} from '../../mocks/v2WorkItems';
import { getNewV2Items } from '../../mocks/newItemsStore';
import { executionValidations } from '../../mocks/executionValidation';

const STEPS = ['튜닝대기', '튜닝중', '튜닝완료', '반영대기', '반영완료'];
const STATUS_TO_STEP: Record<V2Status, number> = {
  scheduled: -1,
  pending: 0, tuning: 1, approval_pending: 2,
  apply_pending: 3, applied: 4,
  rejected: -1, failed: -1, cancelled: -1, no_improve: -1,
};

// Mock applied chart data
const appliedChartData = Array.from({ length: 14 }, (_, i) => {
  const isAfter = i >= 7;
  return {
    day: `D${i - 7 >= 0 ? '+' : ''}${i - 7}`,
    elapsed: isAfter ? 800 + Math.random() * 400 : 4000 + Math.random() * 2000,
  };
});

function getFilteredV2Items(context: string | null): V2WorkItem[] {
  const allItems = [...v2WorkItems, ...getNewV2Items()];
  switch (context) {
    case 'tuned_review':
      return allItems.filter((w) => w.status === 'approval_pending');
    default:
      return allItems;
  }
}

export default function V2WorkDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const context = searchParams.get('context');

  const filteredItems = useMemo(() => getFilteredV2Items(context), [context]);
  const currentIdx = useMemo(() => filteredItems.findIndex((w) => w.id === id), [id, filteredItems]);
  const prevItem = currentIdx > 0 ? filteredItems[currentIdx - 1] : null;
  const nextItem = currentIdx < filteredItems.length - 1 ? filteredItems[currentIdx + 1] : null;
  const contextQuery = context ? `?context=${context}` : '';
  const goTo = useCallback((targetId: string) => navigate(`/v2/work/${targetId}${contextQuery}`), [navigate, contextQuery]);

  const originalItem = [...v2WorkItems, ...getNewV2Items()].find((w) => w.id === id);
  const [item, setItem] = useState<V2WorkItem | null>(originalItem || null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    variant: 'primary' | 'danger';
    onConfirm: () => void;
  } | null>(null);
  const [retuneDialogOpen, setRetuneDialogOpen] = useState(false);
  const [rejectedDialogOpen, setRejectedDialogOpen] = useState(false);
  const [rejectedReason, setRejectedReason] = useState('');
  const [retuneConditions, setRetuneConditions] = useState<string[]>([]);
  const [retuneReason, setRetuneReason] = useState('');

  // Simulate pending → tuning auto-transition (for new items)
  useEffect(() => {
    if (item?.status !== 'pending') return;
    const timer = setTimeout(() => {
      setItem((prev) => prev ? { ...prev, status: 'tuning' } : null);
    }, 2000);
    return () => clearTimeout(timer);
  }, [item?.status]);

  // Simulate tuning → approval_pending auto-transition
  useEffect(() => {
    if (item?.status !== 'tuning') return;
    const timer = setTimeout(() => {
      setItem((prev) => prev ? { ...prev, status: 'approval_pending',
        tunedElapsed: prev.tunedElapsed ?? Math.round(prev.originalElapsed * 0.15),
        tunedBuffers: prev.tunedBuffers ?? Math.round(prev.originalBuffers * 0.1),
        improvementRate: prev.improvementRate ?? 85,
        recommendationType: prev.recommendationType ?? 'index',
      } : null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [item?.status]);

  // Generate fallback executionValidation for new items reaching approval_pending
  useEffect(() => {
    if (item?.status !== 'approval_pending' || !item?.sqlId) return;
    const existing = Object.values(executionValidations).find((v) => v.sqlId === item.sqlId);
    if (!existing) {
      const tunedEl = item.tunedElapsed ?? Math.round(item.originalElapsed * 0.15);
      const tunedBuf = item.tunedBuffers ?? Math.round(item.originalBuffers * 0.1);
      executionValidations[item.id] = {
        id: `EV-${item.id}`,
        workItemId: item.id,
        sqlId: item.sqlId,
        originalPlanText: `SQL_ID  ${item.sqlId}, child number 0\nPlan hash value: ${Math.floor(Math.random() * 9e9) + 1e9}\n--------------------------------------------------------------------\n| Id  | Operation                     | Name         | Rows  | Cost(%CPU)|\n--------------------------------------------------------------------\n|   0 | SELECT STATEMENT              |              |       |  ${Math.floor(item.originalElapsed / 10)}  (2)|\n|   1 |  TABLE ACCESS FULL            | ${item.schemaName.padEnd(12)} | 50000 |  ${Math.floor(item.originalElapsed / 10)}  (1)|\n--------------------------------------------------------------------`,
        tunedPlanText: `SQL_ID  ${item.sqlId}, child number 1\nPlan hash value: ${Math.floor(Math.random() * 9e9) + 1e9}\n------------------------------------------------------------------------\n| Id  | Operation                         | Name            | Rows  | Cost(%CPU)|\n------------------------------------------------------------------------\n|   0 | SELECT STATEMENT                  |                 |       |   ${Math.floor(tunedEl / 10)}  (1)|\n|*  1 |  INDEX RANGE SCAN                 | IDX_AUTO_001    |  5000 |   ${Math.floor(tunedEl / 10)}  (0)|\n|   2 |   TABLE ACCESS BY INDEX ROWID     | ${item.schemaName.padEnd(12)} |     1 |     1  (0)|\n------------------------------------------------------------------------`,
        originalElapsed: item.originalElapsed,
        tunedElapsed: tunedEl,
        originalBuffers: item.originalBuffers,
        tunedBuffers: tunedBuf,
        originalRows: 50000,
        tunedRows: 5000,
        originalDiskReads: Math.round(item.originalBuffers * 0.1),
        tunedDiskReads: Math.round(tunedBuf * 0.1),
        validatedAt: new Date().toISOString(),
        validatedBy: 'AI 자동분석',
        result: 'improved',
        recommendationType: item.recommendationType ?? 'index',
        changeDescription: `${item.workName} — AI 자동 분석 완료`,
      };
    }
  }, [item?.status, item?.sqlId]);

  const transition = useCallback((newStatus: V2Status) => {
    const now = new Date().toISOString();
    setItem((prev) => {
      if (!prev) return null;
      const extra =
        newStatus === 'apply_pending' ? { approvedBy: '김민수', approvedAt: now } :
        newStatus === 'applied'       ? { appliedBy: '김민수',  appliedAt: now  } :
        {};
      return { ...prev, status: newStatus, ...extra };
    });
    // After approval in tuned_review context, auto-navigate to next approval_pending item
    if (newStatus === 'apply_pending' && context === 'tuned_review' && nextItem) {
      setTimeout(() => goTo(nextItem.id), 300);
    } else if (newStatus === 'apply_pending' && context === 'tuned_review' && !nextItem) {
      setTimeout(() => navigate('/v2/work'), 300);
    }
  }, [context, nextItem, goTo, navigate]);

  if (!item) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        작업을 찾을 수 없습니다. (ID: {id})
      </div>
    );
  }

  const stepIndex = STATUS_TO_STEP[item.status];
  const isSideStatus = item.status === 'rejected' || item.status === 'failed' || item.status === 'cancelled' || item.status === 'no_improve';

  return (
    <div className="space-y-6">
      {/* Navigation bar */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => prevItem && goTo(prevItem.id)}
            disabled={!prevItem}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${prevItem ? 'text-slate-600 hover:bg-slate-100' : 'cursor-not-allowed text-slate-300'}`}
          >
            <ChevronLeft size={14} /> 이전
          </button>
          {currentIdx >= 0 && (
            <span className="text-sm font-medium text-slate-700">
              {currentIdx + 1} / {filteredItems.length}
            </span>
          )}
          <button
            onClick={() => nextItem && goTo(nextItem.id)}
            disabled={!nextItem}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${nextItem ? 'text-slate-600 hover:bg-slate-100' : 'cursor-not-allowed text-slate-300'}`}
          >
            다음 <ChevronRight size={14} />
          </button>
          {context === 'tuned_review' && (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
              튜닝완료 검토
            </span>
          )}
        </div>
        <button
          onClick={() => navigate('/v2/work')}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> 목록으로
        </button>
      </div>

      {/* Step Indicator */}
      {!isSideStatus ? (
        <StepIndicator steps={STEPS} currentStep={stepIndex} />
      ) : item.status === 'no_improve' ? (
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <AlertTriangle className="h-5 w-5" /> 개선없음
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-5 w-5" /> {v2StatusLabels[item.status]}
        </div>
      )}

      {/* Header */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm text-slate-500">{item.sqlId}</span>
              <SourceBadge source={item.source} />
              <Badge variant={item.type === 'tuning' ? 'info' : 'warning'}>
                {item.type === 'tuning' ? '튜닝' : '검증'}
              </Badge>
              <Badge variant={item.selectionSource === 'auto' ? 'success' : 'neutral'}>
                {item.selectionSource === 'auto' ? '자동선정' : '수동선정'}
              </Badge>
            </div>
            <h1 className="text-xl font-bold text-slate-900">{item.workName}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {item.instanceName} &middot; {item.schemaName} &middot; {new Date(item.createdAt).toLocaleDateString('ko-KR')}
              {item.assignee && ` · ${item.assignee}`}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${v2StatusColors[item.status]}`}>
            {v2StatusLabels[item.status]}
          </span>
        </div>
      </div>

      {/* Status-specific content */}
      {item.status === 'pending' && (
        <PendingContent item={item} onTransition={transition} />
      )}
      {item.status === 'tuning' && (
        <TuningContent item={item} onTransition={transition} />
      )}
      {item.status === 'approval_pending' && (
        <ApprovalPendingContent
          item={item}
          onTransition={transition}
          onReject={() => setRejectedDialogOpen(true)}
          onRetune={() => setRetuneDialogOpen(true)}
        />
      )}
      {item.status === 'apply_pending' && (
        <ApplyPendingContent
          item={item}
          onApply={() => setConfirmAction({
            title: '반영 실행',
            message: '운영 환경에 반영하시겠습니까? 이 작업은 되돌리기 어렵습니다.',
            variant: 'danger',
            onConfirm: () => transition('applied'),
          })}
        />
      )}
      {item.status === 'applied' && (
        <AppliedContent
          item={item}
          onRetuneRequest={item.operationalResult === 'degraded' ? () => setRetuneDialogOpen(true) : undefined}
        />
      )}
      {item.status === 'rejected' && (
        <RejectedContent item={item} onRetune={() => transition('tuning')} />
      )}

      {/* Confirm Dialog */}
      {confirmAction && (
        <ConfirmDialog
          open
          title={confirmAction.title}
          message={confirmAction.message}
          confirmLabel="확인"
          variant={confirmAction.variant === 'danger' ? 'danger' : 'warning'}
          onConfirm={() => {
            confirmAction.onConfirm();
            setConfirmAction(null);
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* Rejected Dialog */}
      {rejectedDialogOpen && (
        <ModalDialog title="반려" onClose={() => setRejectedDialogOpen(false)}>
          <label className="block text-sm font-medium text-slate-700 mb-1">반려 사유</label>
          <textarea
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            rows={3}
            value={rejectedReason}
            onChange={(e) => setRejectedReason(e.target.value)}
            placeholder="반려 사유를 입력하세요..."
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setRejectedDialogOpen(false)}>취소</Button>
            <Button
              variant="danger"
              size="sm"
              disabled={!rejectedReason.trim()}
              onClick={() => {
                transition('rejected');
                setRejectedDialogOpen(false);
                setRejectedReason('');
              }}
            >
              반려
            </Button>
          </div>
        </ModalDialog>
      )}

      {/* Retune Dialog */}
      {retuneDialogOpen && (
        <ModalDialog title="재튜닝 요청" onClose={() => setRetuneDialogOpen(false)}>
          <label className="block text-sm font-medium text-slate-700 mb-2">재튜닝 조건</label>
          {['인덱스 없이', '힌트만', 'Rewrite 없이'].map((cond) => (
            <label key={cond} className="flex items-center gap-2 mb-1 text-sm">
              <input
                type="checkbox"
                checked={retuneConditions.includes(cond)}
                onChange={(e) =>
                  setRetuneConditions((prev) =>
                    e.target.checked ? [...prev, cond] : prev.filter((c) => c !== cond)
                  )
                }
                className="rounded border-slate-300"
              />
              {cond}
            </label>
          ))}
          <label className="mt-3 block text-sm font-medium text-slate-700 mb-1">사유</label>
          <textarea
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            rows={2}
            value={retuneReason}
            onChange={(e) => setRetuneReason(e.target.value)}
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setRetuneDialogOpen(false)}>취소</Button>
            <Button
              size="sm"
              onClick={() => {
                transition('pending');
                setRetuneDialogOpen(false);
                setRetuneConditions([]);
                setRetuneReason('');
              }}
            >
              {item.status === 'applied' ? '재튜닝 요청' : '재튜닝 시작'}
            </Button>
          </div>
        </ModalDialog>
      )}
    </div>
  );
}

/* ─── Modal Dialog (simple wrapper) ─── */
function ModalDialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-semibold text-slate-900">{title}</h3>
        {children}
      </div>
    </div>
  );
}

/* ─── Status: pending ─── */
function PendingContent({ item, onTransition }: { item: V2WorkItem; onTransition: (s: V2Status) => void }) {
  const [context, setContext] = useState<'OLTP' | 'Batch'>(item.executionContext || 'OLTP');
  const [dailyExec, setDailyExec] = useState(item.estimatedDailyExec || 0);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="mb-3 font-semibold text-slate-900">SQL Text</h3>
        <SqlTextBlock sql={item.sqlText} maxLines={5} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="mb-3 font-semibold text-slate-900">실행 맥락 설정</h3>
        <div className="flex items-center gap-4 mb-4">
          <span className="text-sm text-slate-600">유형:</span>
          <div className="flex rounded-lg border border-slate-200">
            <button
              onClick={() => setContext('OLTP')}
              className={`px-4 py-1.5 text-sm font-medium ${context === 'OLTP' ? 'bg-indigo-600 text-white' : 'text-slate-600'} rounded-l-lg`}
            >OLTP</button>
            <button
              onClick={() => setContext('Batch')}
              className={`px-4 py-1.5 text-sm font-medium ${context === 'Batch' ? 'bg-indigo-600 text-white' : 'text-slate-600'} rounded-r-lg`}
            >Batch</button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">예상 일 실행횟수:</span>
          <input
            type="number"
            value={dailyExec}
            onChange={(e) => setDailyExec(Number(e.target.value))}
            className="w-32 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="mb-3 font-semibold text-slate-900">바인드 변수</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2 text-left text-slate-500">변수명</th>
              <th className="px-3 py-2 text-left text-slate-500">타입</th>
              <th className="px-3 py-2 text-left text-slate-500">값</th>
              <th className="px-3 py-2 text-left text-slate-500">상태</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="px-3 py-2 font-mono text-slate-700">:CUST_ID</td>
              <td className="px-3 py-2 text-slate-600">NUMBER</td>
              <td className="px-3 py-2"><input type="text" defaultValue="10245" className="w-full rounded border border-slate-200 px-2 py-1 text-sm" /></td>
              <td className="px-3 py-2"><Badge variant="success">사용 가능</Badge></td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="px-3 py-2 font-mono text-slate-700">:START_DATE</td>
              <td className="px-3 py-2 text-slate-600">DATE</td>
              <td className="px-3 py-2"><input type="text" defaultValue="2026-01-01" className="w-full rounded border border-slate-200 px-2 py-1 text-sm" /></td>
              <td className="px-3 py-2"><Badge variant="success">사용 가능</Badge></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => onTransition('tuning')}>
          <Play className="mr-1 h-4 w-4" /> AI 분석 시작
        </Button>
      </div>
    </div>
  );
}

/* ─── Status: tuning ─── */
function TuningContent({ item, onTransition }: { item: V2WorkItem; onTransition: (s: V2Status) => void }) {
  const analysisSteps = ['구조분석', '실행계획 수집', '비교분석', '추천안 생성'];
  const stepMap: Record<string, number> = { structure: 0, plan_collection: 1, comparison: 2, recommendation: 3 };
  const currentAnalysisStep = item.analysisStep ? stepMap[item.analysisStep] ?? 0 : 0;

  return (
    <div className="space-y-4">
      <CollapsibleSection title="SQL Text" defaultOpen={false}>
        <SqlTextBlock sql={item.sqlText} />
      </CollapsibleSection>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="mb-4 font-semibold text-slate-900">AI 분석 진행률</h3>
        <div className="space-y-3">
          {analysisSteps.map((step, i) => {
            const isComplete = i < currentAnalysisStep;
            const isCurrent = i === currentAnalysisStep;
            return (
              <div key={step} className="flex items-center gap-3">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full ${
                  isComplete ? 'bg-green-600 text-white' : isCurrent ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'
                }`}>
                  {isComplete ? <Check className="h-4 w-4" /> : isCurrent ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-xs">{i + 1}</span>}
                </div>
                <span className={`text-sm ${isCurrent ? 'font-semibold text-indigo-600' : isComplete ? 'text-green-600' : 'text-slate-400'}`}>
                  {step}
                </span>
              </div>
            );
          })}
        </div>
        {item.analysisEstimatedRemaining && (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <Clock className="h-4 w-4" />
            예상 남은 시간: 약 {item.analysisEstimatedRemaining}초
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" onClick={() => onTransition('pending')}>
          분석 중단
        </Button>
      </div>
    </div>
  );
}

/* ─── Status: approval_pending ─── */
function ApprovalPendingContent({
  item,
  onTransition,
  onReject,
  onRetune,
}: {
  item: V2WorkItem;
  onTransition: (s: V2Status) => void;
  onReject: () => void;
  onRetune: () => void;
}) {
  const ev = Object.values(executionValidations).find((v) => v.sqlId === item.sqlId);

  return (
    <div className="space-y-4">
      <CollapsibleSection title="SQL Text" defaultOpen={false}>
        <SqlTextBlock sql={item.sqlText} />
      </CollapsibleSection>

      {/* Recommendation Summary */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="mb-3 font-semibold text-slate-900">추천안 요약</h3>
        <div className="flex items-center gap-2 mb-2">
          {item.recommendationType && (
            <Badge variant="info">
              {item.recommendationType === 'rewrite' ? 'SQL Rewrite'
                : item.recommendationType === 'hint' ? 'Hint 추가'
                : item.recommendationType === 'index' ? 'Index 추천'
                : '플랜 복구'}
            </Badge>
          )}
          <Badge variant="success">실제 실행 기반 검증</Badge>
        </div>
        <p className="text-sm text-slate-700">
          {ev?.changeDescription || '튜닝 분석이 완료되어 승인 검토가 필요합니다.'}
        </p>
      </div>

      {/* Verification Result */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="mb-3 font-semibold text-slate-900">실행 검증 결과</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-2 text-left text-slate-500">지표</th>
                <th className="px-4 py-2 text-right text-slate-500">AS-IS</th>
                <th className="px-4 py-2 text-right text-slate-500">TO-BE</th>
                <th className="px-4 py-2 text-right text-slate-500">변화</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-700">Elapsed</td>
                <td className="px-4 py-2 text-right font-mono">{(item.originalElapsed / 1000).toLocaleString()}s</td>
                <td className="px-4 py-2 text-right font-mono">{item.tunedElapsed ? `${(item.tunedElapsed / 1000).toLocaleString()}s` : '-'}</td>
                <td className="px-4 py-2 text-right">
                  {item.improvementRate && <ImprovementBadge rate={item.improvementRate} />}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-700">Buffer Gets</td>
                <td className="px-4 py-2 text-right font-mono">{item.originalBuffers.toLocaleString()}</td>
                <td className="px-4 py-2 text-right font-mono">{item.tunedBuffers ? item.tunedBuffers.toLocaleString() : '-'}</td>
                <td className="px-4 py-2 text-right">
                  {item.tunedBuffers && (
                    <ImprovementBadge rate={Math.round((1 - item.tunedBuffers / item.originalBuffers) * 100)} />
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Plan Compare */}
      {ev && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="mb-3 font-semibold text-slate-900">실행계획 비교</h3>
          <PlanCompare original={ev.originalPlanText} tuned={ev.tunedPlanText} />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 justify-end border-t border-slate-200 pt-4">
        <Button variant="danger" size="sm" onClick={onReject}>반려</Button>
        <Button variant="secondary" size="sm" onClick={onRetune}>재튜닝</Button>
        <Button onClick={() => onTransition('apply_pending')}>확인</Button>
      </div>
    </div>
  );
}

/* ─── Status: apply_pending ─── */
function ApplyPendingContent({
  item,
  onApply,
}: {
  item: V2WorkItem;
  onApply: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <div className="text-sm text-green-800">
          <span className="font-medium">{item.approvedBy}</span>님이{' '}
          {item.approvedAt && new Date(item.approvedAt).toLocaleString('ko-KR')}에 확인
        </div>
      </div>

      <CollapsibleSection title="SQL Text" defaultOpen={false}>
        <SqlTextBlock sql={item.sqlText} />
      </CollapsibleSection>

      {/* Verification summary (read-only) */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="mb-3 font-semibold text-slate-900">검토 결과 (읽기 전용)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-2 text-left text-slate-500">지표</th>
                <th className="px-4 py-2 text-right text-slate-500">AS-IS</th>
                <th className="px-4 py-2 text-right text-slate-500">TO-BE</th>
                <th className="px-4 py-2 text-right text-slate-500">변화</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-700">Elapsed</td>
                <td className="px-4 py-2 text-right font-mono">{(item.originalElapsed / 1000).toLocaleString()}s</td>
                <td className="px-4 py-2 text-right font-mono">{item.tunedElapsed ? `${(item.tunedElapsed / 1000).toLocaleString()}s` : '-'}</td>
                <td className="px-4 py-2 text-right">{item.improvementRate && <ImprovementBadge rate={item.improvementRate} />}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-700">Buffer Gets</td>
                <td className="px-4 py-2 text-right font-mono">{item.originalBuffers.toLocaleString()}</td>
                <td className="px-4 py-2 text-right font-mono">{item.tunedBuffers ? item.tunedBuffers.toLocaleString() : '-'}</td>
                <td className="px-4 py-2 text-right">{item.tunedBuffers && <ImprovementBadge rate={Math.round((1 - item.tunedBuffers / item.originalBuffers) * 100)} />}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end border-t border-slate-200 pt-4">
        <Button onClick={onApply}>반영 실행</Button>
      </div>
    </div>
  );
}

/* ─── Status: applied ─── */
function AppliedContent({ item, onRetuneRequest }: { item: V2WorkItem; onRetuneRequest?: () => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <div className="text-sm text-green-800">
          <span className="font-medium">{item.appliedBy}</span>님이{' '}
          {item.appliedAt && new Date(item.appliedAt).toLocaleString('ko-KR')}에 반영 완료
        </div>
      </div>

      {/* Operational impact chart */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="mb-4 font-semibold text-slate-900">운영 영향도</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={appliedChartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="ms" />
            <Tooltip />
            <ReferenceLine x="D0" stroke="#6366f1" strokeDasharray="5 5" label={{ value: '반영', position: 'top', fontSize: 11 }} />
            <Area type="monotone" dataKey="elapsed" stroke="#6366f1" fill="#c7d2fe" />
          </AreaChart>
        </ResponsiveContainer>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-md bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Before 평균</div>
            <div className="text-lg font-bold text-slate-900">
              {(item.originalElapsed / 1000).toFixed(1)}s
            </div>
          </div>
          <div className="rounded-md bg-green-50 p-3">
            <div className="text-xs text-slate-500">After 평균</div>
            <div className="text-lg font-bold text-green-600">
              {item.tunedElapsed ? `${(item.tunedElapsed / 1000).toFixed(1)}s` : '-'}
            </div>
          </div>
        </div>
      </div>

      {/* Result judgment */}
      <div className={`rounded-lg border px-4 py-3 ${
        item.operationalResult === 'improved'
          ? 'border-green-200 bg-green-50'
          : item.operationalResult === 'degraded'
            ? 'border-red-200 bg-red-50'
            : 'border-amber-200 bg-amber-50'
      }`}>
        <div className="flex items-center gap-2">
          {item.operationalResult === 'improved' ? (
            <Check className="h-5 w-5 text-green-600" />
          ) : item.operationalResult === 'degraded' ? (
            <AlertTriangle className="h-5 w-5 text-red-600" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          )}
          <span className={`text-sm font-medium ${
            item.operationalResult === 'improved' ? 'text-green-800'
              : item.operationalResult === 'degraded' ? 'text-red-800'
              : 'text-amber-800'
          }`}>
            {item.operationalResult === 'improved'
              ? '운영 환경에서 의미 있는 개선 확인'
              : item.operationalResult === 'degraded'
                ? '운영 환경에서 성능 저하 감지'
                : '추가 모니터링 필요'}
          </span>
        </div>
      </div>

      {/* Degraded: 경고 배너 + 재튜닝 요청 */}
      {item.operationalResult === 'degraded' && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="text-sm font-semibold text-red-800">실측 성능 저하 감지</span>
          </div>
          <div className="mb-3 grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-xs text-red-600">튜닝 전 Elapsed</div>
              <div className="font-mono font-medium text-slate-700">{(item.originalElapsed / 1000).toFixed(1)}s</div>
            </div>
            <div>
              <div className="text-xs text-red-600">튜닝 후 Elapsed</div>
              <div className="font-mono font-medium text-slate-700">{item.tunedElapsed ? `${(item.tunedElapsed / 1000).toFixed(1)}s` : '-'}</div>
            </div>
            <div>
              <div className="text-xs text-red-600">운영 실측 Elapsed</div>
              <div className="font-mono font-bold text-red-700">{item.operationalElapsed ? `${(item.operationalElapsed / 1000).toFixed(1)}s` : '-'}</div>
            </div>
          </div>
          {onRetuneRequest && (
            <Button variant="danger" size="sm" onClick={onRetuneRequest}>
              <RotateCcw className="mr-1 h-4 w-4" /> 재튜닝 요청
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Status: rejected ─── */
function RejectedContent({
  item,
  onRetune,
}: {
  item: V2WorkItem;
  onRetune: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="text-sm text-red-800">
          <span className="font-medium">{item.rejectedBy}</span>님이{' '}
          {item.rejectedAt && new Date(item.rejectedAt).toLocaleString('ko-KR')}에 반려 처리
        </div>
        {item.rejectedReason && (
          <p className="mt-2 text-sm text-red-700">{item.rejectedReason}</p>
        )}
      </div>

      {item.retuneConditions && item.retuneConditions.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm font-medium text-slate-700 mb-1">재튜닝 조건:</div>
          <div className="flex gap-2">
            {item.retuneConditions.map((c) => (
              <Badge key={c} variant="warning">{c}</Badge>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 justify-end border-t border-slate-200 pt-4">
        <Button variant="ghost" onClick={() => {}}>작업 닫기</Button>
        <Button onClick={onRetune}>
          <RotateCcw className="mr-1 h-4 w-4" /> 재튜닝 시작
        </Button>
      </div>
    </div>
  );
}

/* ─── Collapsible Section ─── */
function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}
