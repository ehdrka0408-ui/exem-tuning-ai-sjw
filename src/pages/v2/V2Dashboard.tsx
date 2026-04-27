import { useNavigate, Link } from 'react-router-dom';
import {
  AlertTriangle,
  XCircle,
  ArrowRight,
  Clock,
  Settings,
} from 'lucide-react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { MetricCard, ImprovementBadge, Card } from '../../components/common';
import {
  v2Alerts,
  v2AutoTuningResult,
  v2Metrics,
  v2DailyTrend,
  v2NextSchedule,
} from '../../mocks/v2Dashboard';

export default function V2Dashboard() {
  const navigate = useNavigate();
  const hasAlerts = v2Alerts.length > 0;

  const sessionColor =
    v2Metrics.activeSessionStatus === 'danger'
      ? 'text-red-600'
      : v2Metrics.activeSessionStatus === 'warning'
        ? 'text-amber-600'
        : 'text-green-600';

  const sessionLabel =
    v2Metrics.activeSessionStatus === 'danger'
      ? '위험'
      : v2Metrics.activeSessionStatus === 'warning'
        ? '주의'
        : '정상';

  return (
    <div className="space-y-6">
      {/* 1. Urgent Alert Bar */}
      {hasAlerts && (
        <div className="space-y-2">
          {v2Alerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-center justify-between rounded-lg border-l-4 px-4 py-3 ${
                alert.level === 'error'
                  ? 'border-l-red-500 bg-red-50'
                  : 'border-l-amber-500 bg-amber-50'
              }`}
            >
              <div className="flex items-center gap-3">
                {alert.level === 'error' ? (
                  <XCircle className="h-5 w-5 shrink-0 text-red-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                )}
                <span
                  className={`text-sm font-medium ${
                    alert.level === 'error' ? 'text-red-800' : 'text-amber-800'
                  }`}
                >
                  {alert.message}
                </span>
              </div>
              <button
                onClick={() => navigate(alert.link)}
                className={`text-sm font-medium underline ${
                  alert.level === 'error'
                    ? 'text-red-700 hover:text-red-900'
                    : 'text-amber-700 hover:text-amber-900'
                }`}
              >
                확인하기
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 2. Key Metric Cards */}
      <div className="grid grid-cols-4 gap-4">
        <button
          onClick={() => navigate('/v2/work?preset=tuned_review')}
          className="text-left"
        >
          <MetricCard
            label="검증 대기"
            value={v2Metrics.verificationPending}
            unit="건"
          />
        </button>
        <button
          onClick={() => navigate('/v2/work?preset=auto-today')}
          className="text-left"
        >
          <MetricCard
            label="오늘 자동 튜닝"
            value={`${v2AutoTuningResult.improved} / ${v2AutoTuningResult.failed} / ${v2AutoTuningResult.notImproved}`}
            unit="성공/실패/미검증"
          />
        </button>
        <button
          onClick={() => navigate('/candidates/plan-change')}
          className="text-left"
        >
          <MetricCard
            label="플랜 변경 감지"
            value={v2Metrics.planChanges}
            unit="건"
          />
        </button>
        <div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-slate-900">
                {v2Metrics.activeSession}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">Active Session</p>
            <div className={`mt-2 text-sm font-medium ${sessionColor}`}>
              {sessionLabel}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Auto Tuning Summary Card */}
      <Card title={`야간 자동 튜닝 결과 (${v2AutoTuningResult.timeRange})`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">{v2AutoTuningResult.total}</div>
              <div className="text-xs text-slate-500">대상</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">{v2AutoTuningResult.analyzed}</div>
              <div className="text-xs text-slate-500">분석 완료</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{v2AutoTuningResult.improved}</div>
              <div className="text-xs text-slate-500">개선</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-400">{v2AutoTuningResult.notImproved}</div>
              <div className="text-xs text-slate-500">미개선</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{v2AutoTuningResult.failed}</div>
              <div className="text-xs text-slate-500">실패</div>
            </div>
            <div className="ml-4">
              <ImprovementBadge rate={v2AutoTuningResult.avgImprovement} />
            </div>
          </div>
          <button
            onClick={() => navigate('/v2/work?preset=auto-today')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            전체 결과 보기
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </Card>

      {/* 4. 7-Day Trend Chart */}
      <Card title="최근 7일 처리 추이">
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={v2DailyTrend}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }} />
            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '12px', paddingBottom: '8px' }} />
            <Bar yAxisId="left" dataKey="completed" name="반영완료" fill="#86efac" radius={[4, 4, 0, 0]} barSize={20} />
            <Bar yAxisId="left" dataKey="tuningImpossible" name="반려" fill="#fca5a5" radius={[4, 4, 0, 0]} barSize={20} />
            <Line yAxisId="right" dataKey="avgImprovement" name="평균 개선률(%)" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* 5. Next Schedule */}
      <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-5 py-3">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Clock className="h-4 w-4 text-slate-400" />
          <span>
            다음 자동 튜닝: 오늘 {v2NextSchedule.time} / {v2NextSchedule.instances.join(', ')} / {v2NextSchedule.criteria} 기준
          </span>
        </div>
        <Link
          to="/ops/policy"
          className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          <Settings className="h-4 w-4" />
          설정 변경
        </Link>
      </div>
    </div>
  );
}
