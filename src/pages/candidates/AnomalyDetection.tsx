import { useState, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { X, Plus } from 'lucide-react'
import DataTable, { type ColumnDef } from '../../components/common/DataTable'
import MaxGaugeNotConnected from '../../components/common/MaxGaugeNotConnected'
import { useMaxGaugeStatus } from '../../hooks/useMaxGaugeStatus'
import TuningRequestDialog from '../../components/common/TuningRequestDialog'
import SlidePanel from '../../components/common/SlidePanel'
import { SqlDetailContent, type SourceTab, type DetailInitialTab } from './TopSql'
import { type Candidate } from '../../mocks/candidates'
import MultiSelect from '../../components/common/MultiSelect'

import { showToast } from '../../components/common/Toast'
import { anomalyPoints, INSTANCES, USERS, PROGRAMS, MODULES, type AnomalyPoint } from '../../mocks/anomalyData'
import { addNewWorkItem } from '../../mocks/newItemsStore'
import { useQueue } from '../../contexts/QueueContext'

/* ─── Constants ─── */
const CHART_HEIGHT = 360
const MARGIN = { top: 10, right: 20, bottom: 20, left: 5 }
const YAXIS_W = 40
const XAXIS_H = 32
const X_DOMAIN = 7200

/* ─── Helpers ─── */
function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

function fmtExecTime(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

/* ─── Custom Dot ─── */
function CustomDot(props: any) {
  const { cx, cy, payload, selectedId, dragSelectedIds } = props
  if (cx == null || cy == null) return null
  const isSelected = payload.id === selectedId
  const isDragSelected = dragSelectedIds?.has(payload.id)
  const isPlanChange = payload.hasPlanChange

  const r = isSelected ? 6 : isDragSelected ? 5 : 3.5
  const fill = isPlanChange
    ? '#EF4444'
    : isSelected || isDragSelected
      ? '#2563EB'
      : '#A1A1AA'
  const strokeColor = isSelected ? '#1D4ED8' : isDragSelected ? '#93B5F8' : 'transparent'
  const strokeWidth = isSelected ? 2 : isDragSelected ? 1.5 : 0

  return (
    <circle
      cx={cx} cy={cy} r={r}
      fill={fill} stroke={strokeColor} strokeWidth={strokeWidth}
      opacity={isSelected || isDragSelected ? 1 : 0.7}
      style={{ cursor: 'pointer', transition: 'r 0.15s, fill 0.15s' }}
    />
  )
}

/* ─── Chart Tooltip ─── */
function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null
  const p: AnomalyPoint = payload[0].payload
  return (
    <div className="rounded-md border border-border bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-mono font-medium text-text-primary">{p.sqlId}</div>
      <div className="mt-1 flex items-center gap-2 text-text-muted">
        <span>{p.schemaName}</span>
        <span className="text-surface-muted">|</span>
        <span>{p.instance}</span>
      </div>
      <div className="mt-1 text-text-secondary">
        <span className="font-medium">{p.y}s</span>
        <span className="ml-2 text-text-muted">{p.waitEvent}</span>
      </div>
      {p.hasPlanChange && (
        <span className="mt-1 inline-flex items-center rounded-full border border-danger-light px-2 py-0.5 text-[10px] font-medium text-danger">
          Plan Change
        </span>
      )}
    </div>
  )
}


/* ═══════════════════════════════════════════════════════════════════════════ */
/*  AnomalyDetection (Scatter View)                                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

export default function AnomalyDetection() {
  const mgConnected = useMaxGaugeStatus()
  if (!mgConnected) return <MaxGaugeNotConnected feature="Scatter View" />
  return <AnomalyDetectionInner />
}

function AnomalyDetectionInner() {
  const navigate = useNavigate()
  const { addScheduledRequest, openPanel, setActiveTab } = useQueue()

  /* ── Query condition state ── */
  const [selectedInstance, setSelectedInstance] = useState(INSTANCES[0])
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date(); return d.toISOString().slice(0, 10)
  })
  const [minElapsed, setMinElapsed] = useState<string>('')
  const [userFilter, setUserFilter] = useState<string[]>([])
  const [programFilter, setProgramFilter] = useState<string[]>([])
  const [moduleFilter, setModuleFilter] = useState<string[]>([])

  // startTime/endTime derived from selectedDate for chart & detail panel
  const startTime = useMemo(() => new Date(`${selectedDate}T00:00:00`), [selectedDate])
  const endTime = useMemo(() => new Date(`${selectedDate}T23:59:59`), [selectedDate])

  /* ── Applied snapshot (조회 버튼 클릭 시 갱신 — dirty 표시용) ── */
  const [appliedQuery, setAppliedQuery] = useState<{ date: string; instance: string; minElapsed: string; users: string[]; programs: string[]; modules: string[] }>(() => ({
    date: selectedDate,
    instance: selectedInstance,
    minElapsed: '',
    users: [],
    programs: [],
    modules: [],
  }))
  const handleQuery = useCallback(() => {
    setAppliedQuery({ date: selectedDate, instance: selectedInstance, minElapsed, users: [...userFilter], programs: [...programFilter], modules: [...moduleFilter] })
  }, [selectedDate, selectedInstance, minElapsed, userFilter, programFilter, moduleFilter])
  const [threshold, setThreshold] = useState(5)
  const [planChangeOnly, setPlanChangeOnly] = useState(false)

  /* ── Selection state ── */
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragSelectedIds, setDragSelectedIds] = useState<Set<string>>(new Set())

  // alias inline 편집 상태
  const [aliasMap, setAliasMap] = useState<Record<string, string>>({})
  const handleAliasChange = (sqlId: string, value: string) => {
    setAliasMap(prev => ({ ...prev, [sqlId]: value }))
  }
  const [panelChecked, setPanelChecked] = useState<Set<string>>(new Set())

  /* ── Detail panel state (row click → SlidePanel) ── */
  const [detailSql, setDetailSql] = useState<Candidate | null>(null)
  const [detailInitialTab, setDetailInitialTab] = useState<DetailInitialTab>('summary')

  /* ── Drag state ── */
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number; px: number; py: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number; px: number; py: number } | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)


  /* ── Tuning request dialog ── */
  const [tuningDialogOpen, setTuningDialogOpen] = useState(false)
  const [pendingTargets, setPendingTargets] = useState<AnomalyPoint[]>([])

  /* ── Filtered data ── */
  const filtered = useMemo(() => {
    const minE = minElapsed ? parseFloat(minElapsed) : 0
    return anomalyPoints.filter((p) => {
      if (p.instance !== selectedInstance) return false
      if (minE > 0 && p.y < minE) return false
      if (userFilter.length > 0 && !userFilter.includes(p.userName)) return false
      if (programFilter.length > 0 && !programFilter.includes(p.program)) return false
      if (moduleFilter.length > 0 && !moduleFilter.includes(p.module)) return false
      if (planChangeOnly && !p.hasPlanChange) return false
      return true
    })
  }, [selectedInstance, minElapsed, userFilter, programFilter, moduleFilter, planChangeOnly])

  const aboveThreshold = useMemo(() => filtered.filter((p) => p.y >= threshold), [filtered, threshold])

  /* ── Selected point info ── */
  const selectedPoint = useMemo(
    () => (selectedId ? anomalyPoints.find((p) => p.id === selectedId) ?? null : null),
    [selectedId],
  )

  /* ── Drag-selected raw points (XVIEW table format) ── */
  const dragSelectedPoints = useMemo(() => {
    if (dragSelectedIds.size === 0) return []
    return anomalyPoints
      .filter(p => dragSelectedIds.has(p.id))
      .sort((a, b) => b.y - a.y)
  }, [dragSelectedIds])

  const uniqueSqlIdsInPanel = useMemo(
    () => Array.from(new Set(dragSelectedPoints.map(p => p.sqlId))),
    [dragSelectedPoints],
  )

  /* ── Chart mouse handlers for drag selection ── */
  const getChartCoords = useCallback(
    (e: React.MouseEvent) => {
      if (!chartRef.current) return null
      const rect = chartRef.current.getBoundingClientRect()
      const plotLeft = MARGIN.left + YAXIS_W
      const plotRight = rect.width - MARGIN.right
      const plotTop = MARGIN.top
      const plotBottom = CHART_HEIGHT - MARGIN.bottom - XAXIS_H

      const px = e.clientX - rect.left
      const py = e.clientY - rect.top

      const xRatio = Math.max(0, Math.min(1, (px - plotLeft) / (plotRight - plotLeft)))
      const yRatio = Math.max(0, Math.min(1, (py - plotTop) / (plotBottom - plotTop)))

      const xVal = xRatio * X_DOMAIN
      const yMax = Math.max(15, ...filtered.map((p) => p.y)) * 1.1
      const yVal = yMax * (1 - yRatio)

      return { x: xVal, y: yVal, px, py }
    },
    [filtered],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const coords = getChartCoords(e)
      if (!coords) return
      setIsDragging(true)
      setDragStart(coords)
      setDragEnd(coords)
      setDragSelectedIds(new Set())
      setSelectedId(null)
    },
    [getChartCoords],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return
      const coords = getChartCoords(e)
      if (coords) setDragEnd(coords)
    },
    [isDragging, getChartCoords],
  )

  const handleMouseUp = useCallback(() => {
    if (!isDragging || !dragStart || !dragEnd) {
      setIsDragging(false)
      return
    }

    const xMin = Math.min(dragStart.x, dragEnd.x)
    const xMax = Math.max(dragStart.x, dragEnd.x)
    const yMin = Math.min(dragStart.y, dragEnd.y)
    const yMax = Math.max(dragStart.y, dragEnd.y)

    if (Math.abs(dragStart.px - dragEnd.px) > 10 && Math.abs(dragStart.py - dragEnd.py) > 10) {
      const selected = new Set<string>()
      filtered.forEach((p) => {
        if (p.x >= xMin && p.x <= xMax && p.y >= yMin && p.y <= yMax) {
          selected.add(p.id)
        }
      })
      if (selected.size > 0) {
        setDragSelectedIds(selected)
        setPanelChecked(new Set())
      }
    }

    setIsDragging(false)
    setDragStart(null)
    setDragEnd(null)
  }, [isDragging, dragStart, dragEnd, filtered])

  /* ── Scatter click ── */
  const handleScatterClick = useCallback((data: any) => {
    if (data?.payload?.id) {
      setSelectedId(data.payload.id)
      setDragSelectedIds(new Set())
    }
  }, [])

  /* ── Drag overlay rect coords ── */
  const dragRect = useMemo(() => {
    if (!isDragging || !dragStart || !dragEnd) return null
    return {
      left: Math.min(dragStart.px, dragEnd.px),
      top: Math.min(dragStart.py, dragEnd.py),
      width: Math.abs(dragEnd.px - dragStart.px),
      height: Math.abs(dragEnd.py - dragStart.py),
    }
  }, [isDragging, dragStart, dragEnd])

  /* ── Y domain ── */
  const yDomain = useMemo<[number, number]>(() => {
    const max = filtered.length > 0 ? Math.max(...filtered.map((p) => p.y)) : 15
    return [0, Math.ceil(max * 1.15)]
  }, [filtered])

  /* ── Detection count for selected SQL ── */
  const selectedDetectionCount = useMemo(() => {
    if (!selectedPoint) return 0
    return filtered.filter((p) => p.sqlId === selectedPoint.sqlId && p.y >= threshold).length
  }, [selectedPoint, filtered, threshold])

  /* ── AnomalyPoint → Candidate 변환 ── */
  const pointToCandidate = useCallback((p: AnomalyPoint): Candidate => ({
    sqlId: p.sqlId,
    sqlText: p.sqlText,
    elapsed: p.elapsed,
    cpuTime: Math.round(p.elapsed * 0.65),
    logicalReads: p.buffers,
    physicalReads: Math.round(p.buffers * 0.1),
    buffers: p.buffers,
    executions: 1,
    impact: Math.min(99, Math.round(p.y * 10)),
    source: 'maxgauge',
    module: '',
    instanceName: p.instance,
    schemaName: p.schemaName,
    planHashValue: p.hasPlanChange ? '9999999999' : '1234567890',
    firstSeen: p.timestamp,
    lastSeen: p.timestamp,
  }), [])

  const handleRowClick = useCallback((p: AnomalyPoint) => {
    setDetailSql(pointToCandidate(p))
    setDetailInitialTab('summary')
  }, [pointToCandidate])

  const handleCreateWork = useCallback((c: Candidate) => {
    addNewWorkItem({
      sqlId: c.sqlId,
      sqlText: c.sqlText,
      instanceName: c.instanceName,
      schemaName: c.schemaName,
      source: 'maxgauge',
    })
    setDetailSql(null)
    showToast({
      message: `${c.sqlId} 튜닝 요청이 접수되었습니다.`,
      variant: 'success',
      action: { label: '작업함 보기 →', onClick: () => navigate('/work') },
    })
  }, [navigate])

  /* ── Tuning request ── */
  const handleTuningRequest = useCallback(() => {
    const sqlInfoMap = new Map<string, AnomalyPoint>()
    dragSelectedPoints.forEach(p => {
      if (!sqlInfoMap.has(p.sqlId)) sqlInfoMap.set(p.sqlId, p)
    })

    const checkedIds = Array.from(panelChecked)
    // 튜닝 대상: SELECT, 또는 Plan Change 가 감지된 SQL (DML 포함)
    const tunableSqls = checkedIds
      .map(id => sqlInfoMap.get(id))
      .filter((p): p is AnomalyPoint => !!p && (p.sqlType === 'SELECT' || p.hasPlanChange))

    if (tunableSqls.length === 0) return

    setPendingTargets(tunableSqls)
    setTuningDialogOpen(true)
  }, [dragSelectedPoints, panelChecked])

  const handleSubmitTuningRequest = useCallback((opts: { scheduledAt?: string; queryTimeoutSec?: number }) => {
    const count = pendingTargets.length
    if (count === 0) return

    if (opts.scheduledAt) {
      // 예약: workItems 에 넣지 않고 oneTime 예약 목록에만 추가 (건별 1건)
      const primaryInstance = pendingTargets[0]?.instance ?? ''
      const instanceType = primaryInstance.toLowerCase().includes('dev') ? 'dev' : 'production'
      addScheduledRequest({
        label: `이상탐지 ${count}건 튜닝 요청`,
        instance: primaryInstance,
        instanceType,
        sqlCount: count,
        scheduledAt: opts.scheduledAt,
      })
      setTuningDialogOpen(false)
      setPendingTargets([])
      setDragSelectedIds(new Set())
      showToast({
        message: `${count}건 예약이 접수되었습니다.`,
        variant: 'success',
        action: {
          label: '예약 탭 열기 →',
          onClick: () => {
            setActiveTab('schedule')
            openPanel('slide')
          },
        },
      })
      return
    }

    // 즉시: 작업함(workItems)에 pending 으로 등록
    pendingTargets.forEach(s => {
      addNewWorkItem({
        sqlId: s.sqlId,
        sqlText: s.sqlText,
        instanceName: s.instance,
        schemaName: s.schemaName,
        source: 'maxgauge',
        queryTimeoutSec: opts.queryTimeoutSec,
      })
    })
    setTuningDialogOpen(false)
    setPendingTargets([])
    setDragSelectedIds(new Set())
    showToast({
      message: `${count}건 튜닝 요청이 접수되었습니다.`,
      variant: 'success',
      action: {
        label: '작업함 보기 →',
        onClick: () => navigate('/work'),
      },
    })
  }, [pendingTargets, navigate, addScheduledRequest, openPanel, setActiveTab])

  const checkedTunableCount = useMemo(() => {
    const sqlInfoMap = new Map<string, AnomalyPoint>()
    dragSelectedPoints.forEach(p => {
      if (!sqlInfoMap.has(p.sqlId)) sqlInfoMap.set(p.sqlId, p)
    })
    return Array.from(panelChecked).filter(id => {
      const p = sqlInfoMap.get(id)
      return p && (p.sqlType === 'SELECT' || p.hasPlanChange)
    }).length
  }, [dragSelectedPoints, panelChecked])

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden gap-4">
      {/* 조회조건 바 — compact inline */}
      {(() => {
        const arrayEq = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i])
        const isDirty =
          selectedDate !== appliedQuery.date ||
          selectedInstance !== appliedQuery.instance ||
          minElapsed !== appliedQuery.minElapsed ||
          !arrayEq(userFilter, appliedQuery.users) ||
          !arrayEq(programFilter, appliedQuery.programs) ||
          !arrayEq(moduleFilter, appliedQuery.modules)
        return (
          <div className="flex items-center gap-2 rounded-lg bg-surface-alt px-3 py-1.5 flex-wrap">
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="h-7 text-xs border border-border rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-action/30 bg-white"
            />
            <select value={selectedInstance} onChange={e => setSelectedInstance(e.target.value)}
              className="h-7 text-xs border border-border rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-action/30 bg-white">
              {INSTANCES.map(inst => <option key={inst} value={inst}>{inst}</option>)}
            </select>
            <MultiSelect label="User" options={USERS} selected={userFilter} onChange={setUserFilter} />
            <MultiSelect label="Program" options={PROGRAMS} selected={programFilter} onChange={setProgramFilter} />
            <MultiSelect label="Module" options={MODULES} selected={moduleFilter} onChange={setModuleFilter} />
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-text-secondary">Elapsed ≥</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={minElapsed}
                onChange={e => setMinElapsed(e.target.value)}
                placeholder="0"
                className="h-7 w-[60px] text-xs border border-border rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-action/30 bg-white font-mono text-right"
              />
              <span className="text-[11px] text-text-muted">s</span>
            </div>
            <div className="ml-auto">
              <button
                onClick={handleQuery}
                className={`shrink-0 h-7 rounded-md px-4 text-xs font-semibold text-white transition-colors inline-flex items-center justify-center ${
                  isDirty ? 'bg-action hover:bg-action-hover ring-2 ring-info/40' : 'bg-action hover:bg-action-hover'
                }`}
              >
                조회{isDirty ? ' •' : ''}
              </button>
            </div>
          </div>
        )
      })()}

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-white px-4 py-2.5">
        {/* Threshold Slider */}
        <div className="flex items-center gap-2 border-l border-border pl-3">
          <span className="text-[10px] text-text-muted uppercase tracking-wide">임계값</span>
          <input
            type="range" min={1} max={30} value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="h-1 w-20 cursor-pointer accent-code"
          />
          <span className="min-w-[32px] text-xs font-mono font-medium text-code">{threshold}s</span>
        </div>

        {/* Plan Change Only */}
        <label className="flex items-center gap-1.5 border-l border-border pl-3 cursor-pointer">
          <input
            type="checkbox" checked={planChangeOnly}
            onChange={(e) => setPlanChangeOnly(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border accent-code"
          />
          <span className="text-xs text-text-secondary">Plan Change only</span>
        </label>

        {/* Detection count */}
        <div className="ml-auto flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-danger-light px-2.5 py-0.5 text-[10px] font-medium text-danger">
            임계 초과 {aboveThreshold.length}건
          </span>
          <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-[10px] font-medium text-text-muted">
            전체 {filtered.length}건
          </span>
        </div>
      </div>

      {/* ── 차트 (고정) + 테이블 (스크롤) ── */}
      <div className="flex-1 min-h-0 flex flex-col gap-4">
      {/* Scatter Chart — 고정 높이 */}
      <div className="rounded-lg border border-border bg-white shrink-0">
        <div className="flex items-center gap-3 border-b border-surface-muted px-4 py-3">
          <h3 className="text-sm font-semibold text-text-primary">Scatter View</h3>
          <span className="inline-flex items-center rounded-full border border-code/30 px-2.5 py-0.5 text-[10px] font-medium text-code">MaxGauge xView</span>
          <div className="ml-auto flex items-center gap-3 text-[10px] text-text-muted">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-text-muted" /> 일반
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-danger" /> Plan Change
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-code" /> 선택됨
            </span>
          </div>
        </div>

        <div
          ref={chartRef}
          className="relative select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: isDragging ? 'crosshair' : 'default' }}
        >
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <ScatterChart margin={MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
              <XAxis
                dataKey="x" type="number" domain={[0, X_DOMAIN]}
                tickFormatter={fmtTime}
                tick={{ fontSize: 10, fill: '#A1A1AA' }}
                axisLine={{ stroke: '#D4D4D8' }}
                tickLine={false} height={XAXIS_H}
                label={{ value: '시간', position: 'insideBottomRight', offset: -5, fontSize: 10, fill: '#A1A1AA' }}
              />
              <YAxis
                dataKey="y" type="number" domain={yDomain}
                width={YAXIS_W}
                tick={{ fontSize: 10, fill: '#A1A1AA' }}
                axisLine={{ stroke: '#D4D4D8' }}
                tickLine={false}
                label={{ value: 'Elapsed(s)', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: '#A1A1AA' }}
              />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine
                y={threshold} stroke="#EF4444" strokeDasharray="6 3" strokeWidth={1.5}
                label={{ value: `${threshold}s`, position: 'right', fill: '#EF4444', fontSize: 10 }}
              />
              <Scatter
                data={filtered}
                onClick={handleScatterClick}
                shape={(props: any) => (
                  <CustomDot {...props} selectedId={selectedId} dragSelectedIds={dragSelectedIds} />
                )}
              />
            </ScatterChart>
          </ResponsiveContainer>

          {/* Drag selection overlay */}
          {isDragging && dragRect && (
            <div
              className="absolute border border-code/70 bg-code/10 rounded-sm pointer-events-none"
              style={{ left: dragRect.left, top: dragRect.top, width: dragRect.width, height: dragRect.height }}
            />
          )}
        </div>
      </div>

      {/* ── 하단 영역 (context strip + 테이블) — 스크롤 ── */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
      {/* Selected SQL context strip */}
      {selectedPoint && (
        <div className="flex items-center gap-4 rounded-lg border border-code/20 bg-code-bg px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted uppercase tracking-wide">SQL ID</span>
            <span className="font-mono text-sm font-medium text-text-primary">{selectedPoint.sqlId}</span>
            {(selectedPoint as {alias?: string}).alias && <span className="text-xs text-text-muted ml-1">{(selectedPoint as {alias?: string}).alias}</span>}
          </div>
          <div className="h-4 w-px bg-surface-muted" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted">User</span>
            <span className="text-xs text-text-secondary">{selectedPoint.userName}</span>
          </div>
          <div className="h-4 w-px bg-surface-muted" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted">Max Elapsed</span>
            <span className="text-xs font-mono font-medium text-danger">{selectedPoint.y}s</span>
          </div>
          <div className="h-4 w-px bg-surface-muted" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted">Program</span>
            <span className="text-xs text-text-secondary">{selectedPoint.program}</span>
          </div>
          <div className="h-4 w-px bg-surface-muted" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted">Module</span>
            <span className="text-xs text-text-secondary">{selectedPoint.module}</span>
          </div>
          <div className="h-4 w-px bg-surface-muted" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted">감지</span>
            <span className="inline-flex items-center rounded-full border border-code/30 px-2 py-0.5 text-[10px] font-medium text-code">
              {selectedDetectionCount}회
            </span>
          </div>
          {selectedPoint.hasPlanChange && (
            <>
              <div className="h-4 w-px bg-surface-muted" />
              <span className="inline-flex items-center rounded-full border border-danger-light px-2 py-0.5 text-[10px] font-medium text-danger">
                Plan Change
              </span>
            </>
          )}
          <button onClick={() => setSelectedId(null)} className="ml-auto text-text-muted hover:text-text-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Drag Selection Bottom Table (DataTable — Top SQL 스타일) ── */}
      {dragSelectedPoints.length > 0 && (
        <div className="rounded-lg border border-border bg-white">
          <DragSelectedTable
            points={dragSelectedPoints}
            threshold={threshold}
            checked={panelChecked}
            onToggleCheck={(sqlId) => {
              setPanelChecked(prev => {
                const next = new Set(prev)
                next.has(sqlId) ? next.delete(sqlId) : next.add(sqlId)
                return next
              })
            }}
            allSqlIds={uniqueSqlIdsInPanel}
            onToggleAll={(checked) => {
              setPanelChecked(checked ? new Set(uniqueSqlIdsInPanel) : new Set())
            }}
            onRowClick={handleRowClick}
            aliasMap={aliasMap}
            onAliasChange={handleAliasChange}
          />
        </div>
      )}

      </div>{/* /하단 스크롤 영역 */}
      </div>{/* /차트+테이블 컨테이너 */}

      {/* ── 일괄 튜닝요청 플로팅 바 (TOP SQL과 동일 패턴) ── */}
      {panelChecked.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white border border-border rounded-lg shadow-lg px-6 py-3 flex items-center gap-4 animate-[slideUp_150ms_var(--ease-out)]">
          <span className="text-sm font-medium text-text-primary">{panelChecked.size}건 선택됨</span>
          <button
            disabled={checkedTunableCount === 0}
            onClick={handleTuningRequest}
            className="inline-flex items-center rounded-md bg-action px-3 py-1.5 text-xs font-semibold text-white hover:bg-action-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={13} className="mr-1" /> 일괄 튜닝요청
          </button>
          <button
            onClick={() => setPanelChecked(new Set())}
            className="text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            선택 해제
          </button>
        </div>
      )}

      {/* ── SQL Detail Slide Panel (row click) ── */}
      <SlidePanel
        open={!!detailSql}
        onClose={() => setDetailSql(null)}
        title={detailSql?.sqlId || ''}
        headerContent={detailSql ? (
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-sm font-semibold text-text-primary shrink-0">{detailSql.sqlId}</span>
            <div className="w-px h-4 bg-surface-muted shrink-0" />
            <span className="text-xs text-text-muted">{detailSql.instanceName}</span>
            <span className="text-xs text-text-muted">{detailSql.schemaName}</span>
          </div>
        ) : undefined}
        defaultWidthRatio={0.4}
      >
        {detailSql && (
          <SqlDetailContent
            sql={detailSql}
            onCreateWork={handleCreateWork}
            activeTab={'maxgauge' as SourceTab}
            initialTab={detailInitialTab}
            startTime={startTime}
            endTime={endTime}
          />
        )}
      </SlidePanel>

      {/* Tuning Request Dialog — Scatter view (즉시 primary, 일괄) */}
      <TuningRequestDialog
        open={tuningDialogOpen}
        onClose={() => { setTuningDialogOpen(false); setPendingTargets([]) }}
        onSubmit={handleSubmitTuningRequest}
        primaryAction="immediate"
        mode="bulk"
        bulkCount={pendingTargets.length}
      />
    </div>
  )
}


/* ─── Drag Selected Table (DataTable 기반, Top SQL 리스트 뷰 스타일) ─── */
function DragSelectedTable({
  points, threshold, checked, onToggleCheck, allSqlIds, onToggleAll, onRowClick,
}: {
  points: AnomalyPoint[]
  threshold: number
  checked: Set<string>
  onToggleCheck: (sqlId: string) => void
  allSqlIds: string[]
  onToggleAll: (checked: boolean) => void
  onRowClick: (p: AnomalyPoint) => void
  aliasMap: Record<string, string>
  onAliasChange: (sqlId: string, value: string) => void
}) {
  const allChecked = allSqlIds.length > 0 && allSqlIds.every(id => checked.has(id))
  const someChecked = checked.size > 0 && !allChecked

  const columns = useMemo<ColumnDef<AnomalyPoint>[]>(() => [
    {
      key: 'sqlText',
      header: (
        <span className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={allChecked}
            ref={el => { if (el) el.indeterminate = someChecked }}
            onClick={e => e.stopPropagation()}
            onChange={e => onToggleAll(e.target.checked)}
            className="h-3.5 w-3.5 cursor-pointer"
          />
          SQL Text
        </span>
      ),
      width: 220,
      render: (_v, row) => (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={checked.has(row.sqlId)}
            onClick={e => e.stopPropagation()}
            onChange={() => onToggleCheck(row.sqlId)}
            className="h-3.5 w-3.5 cursor-pointer shrink-0"
          />
          <span className="block max-w-[160px] truncate font-mono text-[11px] text-code text-left">
            {row.sqlText.slice(0, 60)}
          </span>
        </div>
      ),
    },
    {
      key: 'alias',
      header: '별칭',
      width: 130,
      render: (_v, row) => (
        <input
          type="text"
          value={aliasMap[row.sqlId] ?? (row as { alias?: string }).alias ?? ''}
          onChange={e => { e.stopPropagation(); onAliasChange(row.sqlId, e.target.value) }}
          onClick={e => e.stopPropagation()}
          className="w-full bg-transparent border-0 border-b border-transparent hover:border-border focus:border-action focus:outline-none text-[11px] text-text-secondary px-0 py-0.5 truncate"
          style={{ maxWidth: 120 }}
        />
      ),
    },
    {
      key: 'sqlId',
      header: 'SQL ID',
      width: 140,
      render: (_v, row) => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] font-bold text-text-primary whitespace-nowrap">{row.sqlId}</span>
          {row.hasPlanChange && (
            <span className="rounded px-1 py-0.5 text-[10px] font-medium bg-danger-light text-danger border border-danger-light whitespace-nowrap">
              Plan Change
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'instance',
      header: 'Instance',
      width: 100,
      render: (v) => <span className="whitespace-nowrap text-[11px] text-text-secondary">{String(v)}</span>,
    },
    {
      key: 'userName',
      header: 'User',
      width: 100,
      render: (v) => <span className="whitespace-nowrap text-[11px] text-text-secondary">{String(v)}</span>,
    },
    {
      key: 'program',
      header: 'Program',
      width: 120,
      render: (v) => <span className="whitespace-nowrap text-[11px] text-text-muted truncate block max-w-[110px]">{String(v)}</span>,
    },
    {
      key: 'module',
      header: 'Module',
      width: 100,
      render: (v) => <span className="whitespace-nowrap text-[11px] text-text-muted truncate block max-w-[90px]">{String(v)}</span>,
    },
    {
      key: 'y',
      header: 'Elapsed (s)',
      width: 100,
      align: 'right' as const,
      render: (_v, row) => {
        const isAbove = row.y >= threshold
        return <span className={`text-[11px] font-mono font-medium whitespace-nowrap ${isAbove ? 'text-danger font-semibold' : 'text-text-primary'}`}>{row.y.toFixed(1)}s</span>
      },
    },
    {
      key: 'timestamp',
      header: 'Time',
      width: 160,
      render: (v) => <span className="font-mono text-[11px] text-text-secondary whitespace-nowrap">{fmtExecTime(String(v))}</span>,
    },
  ], [checked, allChecked, someChecked, onToggleAll, onToggleCheck, threshold])

  return (
    <DataTable<AnomalyPoint>
      columns={columns}
      data={points}
      rowKey="id"
      onRowClick={(row) => onRowClick(row)}
    />
  )
}
