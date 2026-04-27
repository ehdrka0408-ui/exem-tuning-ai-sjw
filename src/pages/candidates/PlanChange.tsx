import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Send, ExternalLink } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Badge, SlidePanel, SqlTextBlock, PlanCompare, SourceBadge } from '../../components/common';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import {
  planChangeItems,
  type PlanChangeItem,
  type PlanChangeImpact,
} from '../../mocks/planChanges';
import { addNewWorkItem } from '../../mocks/newItemsStore';

const IMPACT_LABELS: Record<PlanChangeImpact, string> = {
  degraded: '성능저하 의심',
  improved: '개선됨',
  neutral: '변화없음',
};
const IMPACT_COLORS: Record<PlanChangeImpact, string> = {
  degraded: 'bg-red-100 text-red-700',
  improved: 'bg-green-100 text-green-700',
  neutral: 'bg-slate-100 text-slate-500',
};

type ImpactFilter = 'all' | 'degraded' | 'improved';

const INSTANCES = ['전체', 'PROD-DB1', 'PROD-DB2'];
const SCHEMAS = ['전체', 'APP', 'FIN', 'HR'];

// SPM 전역 정책 (mock)
const SPM_ENABLED = true;

export default function PlanChange() {
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>('degraded');
  const [instanceFilter, setInstanceFilter] = useState('전체');
  const [schemaFilter, setSchemaFilter] = useState('전체');
  const [selectedItem, setSelectedItem] = useState<PlanChangeItem | null>(null);

  // 로컬 상태 오버라이드 (SPM 고정 / 튜닝 요청 후 표시용)
  const [spmFixedIds, setSpmFixedIds] = useState<Set<string>>(new Set());
  const [tuningRequestedIds, setTuningRequestedIds] = useState<Set<string>>(new Set());

  // 모달
  const [confirmAction, setConfirmAction] = useState<null | {
    title: string; message: string; variant: 'danger' | 'warning'; onConfirm: () => void;
  }>(null);

  const filtered = useMemo(() => {
    let items = planChangeItems;
    if (impactFilter !== 'all') {
      items = items.filter((i) => i.impact === impactFilter);
    }
    if (instanceFilter !== '전체') {
      items = items.filter((i) => i.instanceName === instanceFilter);
    }
    if (schemaFilter !== '전체') {
      items = items.filter((i) => i.schema === schemaFilter);
    }
    // 기본 정렬: 악화 비율 내림차순
    return [...items].sort((a, b) => b.changeRate - a.changeRate);
  }, [impactFilter, instanceFilter, schemaFilter]);

  const degradedCount = planChangeItems.filter((i) => i.impact === 'degraded').length;
  const improvedCount = planChangeItems.filter((i) => i.impact === 'improved').length;

  const handleSpmFix = (item: PlanChangeItem) => {
    if (!SPM_ENABLED) return;
    setConfirmAction({
      title: 'SPM 고정',
      variant: 'warning',
      message: `${item.sqlId}의 이전 실행계획(Plan Hash: ${item.prevPlanHash})을 SPM으로 고정하시겠습니까?\n\n좋은 플랜으로 복구되며, 이후 옵티마이저가 다른 플랜을 선택하지 않습니다.`,
      onConfirm: () => {
        setSpmFixedIds((prev) => new Set(prev).add(item.id));
        setConfirmAction(null);
      },
    });
  };

  const handleTuningRequest = (item: PlanChangeItem) => {
    setConfirmAction({
      title: '튜닝 요청',
      variant: 'warning',
      message: `${item.sqlId}를 튜닝 요청하시겠습니까?\n\n작업함에 새 튜닝 작업이 생성됩니다.`,
      onConfirm: () => {
        addNewWorkItem({
          sqlId: item.sqlId,
          sqlText: item.sqlText,
          instanceName: item.instanceName,
          schemaName: item.schema,
          source: 'maxgauge',
        });
        setTuningRequestedIds((prev) => new Set(prev).add(item.id));
        setConfirmAction(null);
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* 상단: 기간 + 인스턴스 + 조회 */}
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">기간</label>
          <input type="date" defaultValue="2026-03-25" className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
          <span className="text-slate-400">~</span>
          <input type="date" defaultValue="2026-03-25" className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
        <select
          value={instanceFilter}
          onChange={(e) => setInstanceFilter(e.target.value)}
          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
        >
          {INSTANCES.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
        <button className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
          조회
        </button>
      </div>

      {/* 필터 바 */}
      <div className="flex items-center gap-2">
        {([
          { key: 'degraded' as const, label: `성능저하만 (${degradedCount})`, color: 'text-red-600' },
          { key: 'improved' as const, label: `개선됨 (${improvedCount})`, color: 'text-green-600' },
          { key: 'all' as const, label: `전체 (${planChangeItems.length})`, color: 'text-slate-600' },
        ]).map((f) => (
          <button
            key={f.key}
            onClick={() => setImpactFilter(f.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              impactFilter === f.key
                ? 'bg-indigo-600 text-white'
                : `bg-slate-100 ${f.color} hover:bg-slate-200`
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto">
          <select
            value={schemaFilter}
            onChange={(e) => setSchemaFilter(e.target.value)}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          >
            {SCHEMAS.map((s) => <option key={s} value={s}>{s === '전체' ? '전체 스키마' : s}</option>)}
          </select>
        </div>
      </div>

      {/* 메인 테이블 */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2 text-left font-medium text-slate-500">감지일시</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">SQL ID</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">스키마</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">이전 Plan Hash</th>
              <th className="px-3 py-2 text-left font-medium text-slate-500">현재 Plan Hash</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">이전 Elapsed</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">현재 Elapsed</th>
              <th className="px-3 py-2 text-right font-medium text-slate-500">변화</th>
              <th className="px-3 py-2 text-center font-medium text-slate-500">상태</th>
              <th className="px-3 py-2 text-center font-medium text-slate-500">액션</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const isDegraded = item.impact === 'degraded';
              const isSpmFixed = spmFixedIds.has(item.id);
              const isTuningReq = tuningRequestedIds.has(item.id);
              return (
                <tr
                  key={item.id}
                  className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${
                    isDegraded ? 'border-l-2 border-l-red-400' : ''
                  }`}
                  onClick={() => setSelectedItem(item)}
                >
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {new Date(item.detectedAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-700">{item.sqlId}</td>
                  <td className="px-3 py-2 text-slate-600">{item.schema}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{item.prevPlanHash}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-700">{item.currPlanHash}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-600">
                    {item.prevElapsed.toLocaleString()}ms
                  </td>
                  <td className={`px-3 py-2 text-right font-mono ${isDegraded ? 'font-medium text-red-600' : 'text-slate-600'}`}>
                    {item.currElapsed.toLocaleString()}ms
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={`font-medium ${
                      item.changeRate > 0 ? 'text-red-600' : item.changeRate < -10 ? 'text-green-600' : 'text-slate-500'
                    }`}>
                      {item.changeRate > 0 ? '↑' : '↓'}{Math.abs(item.changeRate).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {isSpmFixed ? (
                      <Badge variant="success">SPM 고정됨</Badge>
                    ) : isTuningReq ? (
                      <Badge variant="info">튜닝 요청됨</Badge>
                    ) : (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${IMPACT_COLORS[item.impact]}`}>
                        {IMPACT_LABELS[item.impact]}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    {isDegraded && !isSpmFixed && !isTuningReq && (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="rounded px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                        >
                          상세
                        </button>
                        <button
                          onClick={() => handleSpmFix(item)}
                          className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                            SPM_ENABLED
                              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                              : 'cursor-not-allowed bg-slate-200 text-slate-400'
                          }`}
                          title={SPM_ENABLED ? 'SPM 고정' : '설정 > 정책에서 SPM을 활성화해주세요'}
                          disabled={!SPM_ENABLED}
                        >
                          SPM고정
                        </button>
                        <button
                          onClick={() => handleTuningRequest(item)}
                          className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-100"
                        >
                          튜닝요청
                        </button>
                      </div>
                    )}
                    {!isDegraded && (
                      <button
                        onClick={() => setSelectedItem(item)}
                        className="rounded px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                      >
                        상세
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="py-12 text-center text-sm text-slate-400">
                  해당 조건에 맞는 플랜 변경 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* SlidePanel */}
      <SlidePanel
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title={selectedItem ? `${selectedItem.sqlId} 플랜 변경 상세` : ''}
      >
        {selectedItem && (
          <DetailPanel
            item={selectedItem}
            isSpmFixed={spmFixedIds.has(selectedItem.id)}
            isTuningReq={tuningRequestedIds.has(selectedItem.id)}
            onSpmFix={() => handleSpmFix(selectedItem)}
            onTuningRequest={() => handleTuningRequest(selectedItem)}
          />
        )}
      </SlidePanel>

      {/* ConfirmDialog */}
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
    </div>
  );
}

/* ─── Detail Panel ─── */
function DetailPanel({
  item,
  isSpmFixed,
  isTuningReq,
  onSpmFix,
  onTuningRequest,
}: {
  item: PlanChangeItem;
  isSpmFixed: boolean;
  isTuningReq: boolean;
  onSpmFix: () => void;
  onTuningRequest: () => void;
}) {
  const navigate = useNavigate();
  const isDegraded = item.impact === 'degraded';

  // 플랜 이력에서 고유 planHash 추출 (차트 색상용)
  const planHashes = [...new Set(item.planHistory.map((h) => h.planHash))];
  const PLAN_COLORS = ['#2563EB', '#06B6D4', '#0284C7', '#0891B2'];

  // 차트 데이터 변환: 각 planHash별 elapsed를 별도 키로
  const chartData = item.planHistory.map((h) => {
    const point: Record<string, string | number | undefined> = { time: h.time };
    planHashes.forEach((hash) => {
      point[hash] = h.planHash === hash ? h.elapsed : undefined;
    });
    return point;
  });

  return (
    <div className="space-y-6">
      {/* 상태 + 소스 */}
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${IMPACT_COLORS[item.impact]}`}>
          {IMPACT_LABELS[item.impact]}
        </span>
        <SourceBadge source="maxgauge" />
        {isSpmFixed && <Badge variant="success">SPM 고정됨</Badge>}
        {isTuningReq && <Badge variant="info">튜닝 요청됨</Badge>}
      </div>

      {/* SQL */}
      <div>
        <div className="mb-1 text-xs font-medium text-slate-500">SQL ID: {item.sqlId}</div>
        <SqlTextBlock sql={item.sqlText} maxLines={3} />
      </div>

      {/* 성능 변화 요약 */}
      <div className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3">
        <div>
          <div className="text-xs text-slate-500">이전 Elapsed</div>
          <div className="text-sm font-medium text-slate-700">{item.prevElapsed.toLocaleString()}ms</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">현재 Elapsed</div>
          <div className={`text-sm font-medium ${isDegraded ? 'text-red-600' : 'text-slate-700'}`}>
            {item.currElapsed.toLocaleString()}ms
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">변화율</div>
          <div className={`text-sm font-medium ${item.changeRate > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {item.changeRate > 0 ? '↑' : '↓'}{Math.abs(item.changeRate).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* 플랜 이력 타임라인 차트 */}
      <div>
        <div className="mb-2 text-sm font-semibold text-slate-700">플랜 이력</div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} unit="ms" />
            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            {planHashes.map((hash, i) => (
              <Line
                key={hash}
                dataKey={hash}
                name={`Plan ${hash.slice(0, 8)}`}
                stroke={PLAN_COLORS[i % PLAN_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Plan 비교 */}
      <div>
        <div className="mb-2 text-sm font-semibold text-slate-700">실행계획 비교</div>
        <PlanCompare original={item.prevPlan} tuned={item.currPlan} />
      </div>

      {/* 액션 버튼 */}
      {isDegraded && !isSpmFixed && !isTuningReq && (
        <div className="flex items-center gap-2 border-t border-slate-200 pt-4">
          <button
            onClick={onSpmFix}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium ${
              SPM_ENABLED
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'cursor-not-allowed bg-slate-200 text-slate-400'
            }`}
            disabled={!SPM_ENABLED}
            title={SPM_ENABLED ? '' : '설정 > 정책에서 SPM을 활성화해주세요'}
          >
            <Shield className="h-4 w-4" />
            SPM 고정 (좋은 플랜으로 복구)
          </button>
          <button
            onClick={onTuningRequest}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
          >
            <Send className="h-4 w-4" />
            튜닝 요청
          </button>
        </div>
      )}

      {/* 튜닝 요청 후 작업함 이동 */}
      {isTuningReq && (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <span className="text-sm text-green-700">튜닝 요청이 생성되었습니다.</span>
          <button
            onClick={() => navigate('/work')}
            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
          >
            작업함에서 확인 →
          </button>
        </div>
      )}

      {/* MaxGauge 딥링크 */}
      <div className="border-t border-slate-100 pt-3">
        <a
          href="#"
          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
          onClick={(e) => e.preventDefault()}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          MaxGauge에서 보기
        </a>
      </div>
    </div>
  );
}
