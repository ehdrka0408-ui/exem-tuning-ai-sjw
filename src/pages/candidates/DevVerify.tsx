import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Send, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';
import { Button, Badge } from '../../components/common';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { mockExplainPlans, type ExplainPlanResult } from '../../mocks/explainPlan';
import { addNewWorkItem } from '../../mocks/newItemsStore';

const INSTANCES = ['PROD-DB1', 'PROD-DB2', 'DEV-DB1'];
const SCHEMAS = ['APP', 'OMS', 'HR', 'FIN', 'CRM', 'AUDIT'];

export default function DevVerify() {
  const navigate = useNavigate();
  const [sqlText, setSqlText] = useState('');
  const [instance, setInstance] = useState(INSTANCES[0]);
  const [schema, setSchema] = useState(SCHEMAS[0]);
  const [execContext, setExecContext] = useState<'OLTP' | 'Batch'>('OLTP');
  const [dailyExec, setDailyExec] = useState('1000');
  const [result, setResult] = useState<ExplainPlanResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | {
    title: string; message: string; variant: 'danger' | 'warning'; onConfirm: () => void;
  }>(null);

  // 바인드 변수 감지
  const bindVars = useMemo(() => {
    const matches = sqlText.match(/:[a-zA-Z_]\w*/g);
    if (!matches) return [];
    return [...new Set(matches)];
  }, [sqlText]);

  const [bindValues, setBindValues] = useState<Record<string, string>>({});

  // DML 감지
  const isDml = useMemo(() => {
    const trimmed = sqlText.trim().toUpperCase();
    return /^(INSERT|UPDATE|DELETE|MERGE)\b/.test(trimmed);
  }, [sqlText]);

  const handleExplain = () => {
    if (!sqlText.trim() || isDml) return;
    setIsLoading(true);
    // mock: 카테시안 키워드 포함시 cartesian, 인덱스 있으면 good, 기본 default
    setTimeout(() => {
      let planKey = 'default';
      const upper = sqlText.toUpperCase();
      if (upper.includes('CROSS JOIN') || (upper.includes('FROM') && upper.split(',').length > 2 && !upper.includes('WHERE'))) {
        planKey = 'cartesian';
      } else if (upper.includes('INDEX') || upper.includes('department_id') || upper.includes('DEPT')) {
        planKey = 'good';
      }
      setResult(mockExplainPlans[planKey]);
      setIsLoading(false);
    }, 800);
  };

  const handleTuningRequest = () => {
    setConfirmAction({
      title: '튜닝 요청',
      variant: 'warning',
      message: '이 SQL에 대한 튜닝 요청을 생성하시겠습니까?\n\n작업함에 새 튜닝 작업이 생성됩니다.',
      onConfirm: () => {
        const sqlId = `sql_${Date.now().toString(36)}`;
        const { v1Id } = addNewWorkItem({
          sqlId,
          sqlText: sqlText,
          instanceName: instance,
          schemaName: schema,
          source: 'maxgauge',
          executionContext: execContext,
          estimatedDailyExec: Number(dailyExec) || 1000,
        });
        setConfirmAction(null);
        navigate(`/work/${v1Id}`);
      },
    });
  };

  return (
    <div className="flex gap-6" style={{ minHeight: 'calc(100vh / 1.1 - 140px)' }}>
      {/* 좌측: SQL 입력 (60%) */}
      <div className="flex w-[60%] flex-col space-y-4">
        {/* SQL 에디터 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">SQL</label>
          <textarea
            value={sqlText}
            onChange={(e) => setSqlText(e.target.value)}
            placeholder="SELECT 문을 입력하세요..."
            className="h-[300px] w-full resize-none rounded-lg border border-slate-300 bg-slate-50 p-4 font-mono text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          {isDml && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              현재 AI 엔진은 SELECT 문만 지원합니다.
            </div>
          )}
        </div>

        {/* 실행 대상 */}
        <div className="flex items-center gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">인스턴스</label>
            <select
              value={instance}
              onChange={(e) => setInstance(e.target.value)}
              className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            >
              {INSTANCES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">스키마</label>
            <select
              value={schema}
              onChange={(e) => setSchema(e.target.value)}
              className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            >
              {SCHEMAS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* 실행 맥락 */}
        <div className="flex items-center gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">실행 맥락</label>
            <div className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white p-0.5">
              <button
                onClick={() => setExecContext('OLTP')}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  execContext === 'OLTP' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                OLTP
              </button>
              <button
                onClick={() => setExecContext('Batch')}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  execContext === 'Batch' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Batch
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">예상 일 실행횟수</label>
            <input
              type="number"
              value={dailyExec}
              onChange={(e) => setDailyExec(e.target.value)}
              className="w-28 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            />
          </div>
        </div>

        {/* 바인드 변수 */}
        {bindVars.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">바인드 변수</label>
            <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
              {bindVars.map((v) => (
                <div key={v} className="flex items-center gap-2">
                  <span className="w-24 font-mono text-xs text-slate-600">{v}</span>
                  <input
                    type="text"
                    value={bindValues[v] || ''}
                    onChange={(e) => setBindValues((prev) => ({ ...prev, [v]: e.target.value }))}
                    placeholder="값 입력"
                    className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 실행 버튼 */}
        <Button
          onClick={handleExplain}
          disabled={!sqlText.trim() || isDml || isLoading}
        >
          <Play className="mr-1.5 h-4 w-4" />
          {isLoading ? '분석 중...' : '실행계획 확인'}
        </Button>
      </div>

      {/* 우측: 결과 (40%) */}
      <div className="w-[40%] rounded-lg border border-slate-200 bg-white">
        {!result ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            SQL을 입력하고 실행계획을 확인하세요.
          </div>
        ) : (
          <div className="flex h-full flex-col">
            {/* 요약 */}
            <div className="border-b border-slate-200 px-5 py-3">
              <div className="flex items-center gap-3">
                <div>
                  <span className="text-xs text-slate-500">Cost</span>
                  <div className={`text-lg font-bold ${result.cost > 5000 ? 'text-red-600' : result.cost > 500 ? 'text-amber-600' : 'text-green-600'}`}>
                    {result.cost.toLocaleString()}
                  </div>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div>
                  <span className="text-xs text-slate-500">Rows</span>
                  <div className="text-lg font-bold text-slate-700">
                    {result.rows.toLocaleString()}
                  </div>
                </div>
                <div className="ml-auto">
                  {result.warnings.length === 0 ? (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm font-medium">양호</span>
                    </div>
                  ) : (
                    <Badge variant={result.warnings.some((w) => w.level === 'danger') ? 'danger' : 'warning'}>
                      위험 신호 {result.warnings.length}건
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* 위험 신호 */}
            {result.warnings.length > 0 && (
              <div className="space-y-1.5 border-b border-slate-200 px-5 py-3">
                {result.warnings.map((w, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 rounded-md px-3 py-1.5 text-xs ${
                      w.level === 'danger' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {w.level === 'danger' ? (
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    {w.message}
                  </div>
                ))}
              </div>
            )}

            {/* 실행계획 */}
            <div className="flex-1 overflow-auto px-5 py-3">
              <div className="mb-2 text-xs font-medium text-slate-500">실행계획 (DBMS_XPLAN)</div>
              <pre className="rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed">
                {result.planText.split('\n').map((line, i) => {
                  const isFull = line.includes('TABLE ACCESS FULL');
                  const isCartesian = line.includes('CARTESIAN');
                  return (
                    <div
                      key={i}
                      className={
                        isFull ? 'bg-red-100 text-red-700 px-1 -mx-1 font-medium' :
                        isCartesian ? 'bg-red-200 text-red-800 px-1 -mx-1 font-bold' :
                        ''
                      }
                    >
                      {line}
                    </div>
                  );
                })}
              </pre>
            </div>

            {/* 튜닝 요청 버튼 */}
            {result.warnings.length > 0 && (
              <div className="border-t border-slate-200 px-5 py-3">
                <Button onClick={handleTuningRequest} className="w-full">
                  <Send className="mr-1.5 h-4 w-4" />
                  튜닝 요청
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

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
