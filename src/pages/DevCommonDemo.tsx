import React, { useState } from 'react'
import SlidePanelShell, { type SlidePanelShellWidth } from '../components/common/SlidePanelShell'
import ProgressStepBar, { type ProgressStepNumber } from '../components/common/ProgressStepBar'
import CostSweepHero from '../components/common/CostSweepHero'
import TuningInProgressCard from '../components/common/TuningInProgressCard'

/**
 * P10-exem · 시안 B
 * SlidePanel 셸 + ProgressStepBar + TuningInProgressCard 데모
 *
 * 라우트: /dev/common
 */

// ── 디자인 시스템과 조화로운 currentStep 컨트롤 (segmented button) ──
const StepSegmented: React.FC<{
  value: ProgressStepNumber
  onChange: (n: ProgressStepNumber) => void
}> = ({ value, onChange }) => (
  <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-white p-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        onClick={() => onChange(n as ProgressStepNumber)}
        className={`min-w-[28px] px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors ${
          value === n
            ? 'bg-action text-white'
            : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
        }`}
        aria-pressed={value === n}
      >
        {n}
      </button>
    ))}
  </div>
)

const DevCommonDemo: React.FC = () => {
  // ── Section 1: SlidePanel 단독
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelWidth, setPanelWidth] = useState<SlidePanelShellWidth>('narrow')

  // ── Section 2: ProgressStepBar 단독
  const [step, setStep] = useState<ProgressStepNumber>(2)

  // ── Section 3: 결합 데모
  const [comboOpen, setComboOpen] = useState(false)
  const [comboWidth, setComboWidth] = useState<SlidePanelShellWidth>('narrow')
  const [comboStep, setComboStep] = useState<ProgressStepNumber>(3)

  return (
    <div className="p-8 max-w-[1100px] mx-auto space-y-12">
      {/* ── Page header ── */}
      <header className="flex items-start gap-4">
        <CostSweepHero size="lg" />
        <div className="space-y-2">
          <div className="text-[11px] font-mono text-text-muted">P10-exem · 시안 B</div>
          <h1 className="text-lg font-semibold text-text-primary">공통 컴포넌트 데모</h1>
          <p className="text-sm text-text-secondary">
            SlidePanel 셸 · ProgressStepBar · cost sweep 애니메이션 — exem 디자인 토큰 계승
          </p>
        </div>
      </header>

      {/* ──────────────────────────────────────── */}
      {/* 1. SlidePanel 단독 */}
      {/* ──────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-text-primary border-b border-border pb-2">
          1. SlidePanel 단독
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPanelOpen(true)}
            className="px-3 py-1.5 rounded-md bg-action text-white text-xs font-medium hover:bg-action-hover transition-colors"
          >
            패널 열기
          </button>
          <span className="text-[11px] text-text-muted">
            ESC · 오버레이 클릭으로 닫힘. 헤더의 토글 버튼으로 narrow ↔ expanded 전환.
          </span>
        </div>

        <SlidePanelShell
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          title="SlidePanel 단독 데모"
          width={panelWidth}
          onWidthChange={setPanelWidth}
          headerSlot={
            <div className="flex items-center gap-2 text-[11px] text-text-secondary">
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                큐 정상
              </span>
              <span className="text-text-muted/60">·</span>
              <span>실행 중 3 / 대기 12</span>
              <span className="text-text-muted/60">·</span>
              <span className="font-mono">headerSlot 예시</span>
            </div>
          }
        >
          <div className="p-6 space-y-4">
            <div className="text-sm text-text-primary">
              현재 width: <span className="font-mono text-action">{panelWidth}</span>
            </div>
            <p className="text-[13px] text-text-secondary leading-relaxed">
              이 영역은 children입니다. 헤더는 sticky로 유지되고, 이 콘텐츠 영역만 스크롤됩니다.
            </p>
            <div className="space-y-2">
              {Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={i}
                  className="px-3 py-2 rounded border border-border bg-surface-alt text-[12px] text-text-secondary"
                >
                  더미 콘텐츠 행 {i + 1}
                </div>
              ))}
            </div>
          </div>
        </SlidePanelShell>
      </section>

      {/* ──────────────────────────────────────── */}
      {/* 2. ProgressStepBar 단독 */}
      {/* ──────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-text-primary border-b border-border pb-2">
          2. ProgressStepBar 단독
        </h2>

        <div className="flex items-center gap-3">
          <label className="text-[11px] font-medium text-text-secondary">currentStep:</label>
          <StepSegmented value={step} onChange={setStep} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 연속 바 */}
          <div className="rounded-lg border border-border bg-white p-5 space-y-4">
            <div className="text-[11px] font-mono uppercase text-text-muted">continuous bar</div>
            <ProgressStepBar currentStep={step} className="w-[200px]" />
            <div className="text-[10px] uppercase text-text-muted/70">w-[80px] 고정폭</div>
            <ProgressStepBar currentStep={step} className="w-[80px]" />
            <div className="text-[10px] uppercase text-text-muted/70">delayed</div>
            <ProgressStepBar currentStep={step} delayed className="w-[200px]" />
          </div>

          {/* 조합 예시 */}
          <div className="rounded-lg border border-border bg-white p-5 space-y-4">
            <div className="text-[11px] font-mono uppercase text-text-muted">bar + text 조합</div>
            <div className="flex items-center gap-3">
              <ProgressStepBar currentStep={step} className="w-[100px] shrink-0" />
              <span className="text-[11px] text-text-secondary truncate">현재 단계 한 줄 설명</span>
              <span className="flex-1" />
              <span className="text-[11px] font-mono text-text-muted">03:12</span>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────── */}
      {/* 3. 결합 데모 (핵심) */}
      {/* ──────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-text-primary border-b border-border pb-2">
          3. SlidePanel + ProgressStepBar + cost sweep 결합 ⭐
        </h2>
        <p className="text-[12px] text-text-secondary">
          패널 width 토글 시 내부 ProgressStepBar의 orientation이 자동 전환됩니다.
          (narrow → horizontal, expanded → vertical) · 작업상세 cost sweep 애니메이션 계승
        </p>

        {/* 패널 밖 미리보기 — narrow / expanded / compact 세 버전 */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-4">
          {/* narrow */}
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase text-text-muted">narrow</div>
            <TuningInProgressCard
              variant="narrow"
              currentStep={comboStep}
              elapsed="03:12"
              stepDescription="튜닝안 후보를 검증 환경에서 순차 실행 중"
            />
          </div>

          {/* expanded */}
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase text-text-muted">expanded</div>
            <TuningInProgressCard
              variant="expanded"
              currentStep={comboStep}
              elapsed="03:12"
              stepDescription="튜닝안 후보를 검증 환경에서 순차 실행 중"
            />
          </div>
        </div>

        {/* compact 변형 — AiQueueIndicator 드롭다운/RunningCard용 */}
        <div className="space-y-2">
          <div className="text-[10px] font-mono uppercase text-text-muted">compact (드롭다운/RunningCard용)</div>
          <div className="max-w-[420px]">
            <TuningInProgressCard
              variant="compact"
              currentStep={comboStep}
              elapsed="03:12"
              stepDescription="튜닝안 후보를 검증 환경에서 순차 실행 중"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => { setComboWidth('narrow'); setComboOpen(true) }}
            className="px-3 py-1.5 rounded-md bg-action text-white text-xs font-medium hover:bg-action-hover transition-colors"
          >
            결합 패널 열기 · narrow
          </button>
          <button
            onClick={() => { setComboWidth('expanded'); setComboOpen(true) }}
            className="px-3 py-1.5 rounded-md border border-border bg-white text-text-primary text-xs font-medium hover:bg-surface-muted transition-colors"
          >
            결합 패널 열기 · expanded
          </button>

          <label className="text-[11px] font-medium text-text-secondary ml-4">currentStep:</label>
          <StepSegmented value={comboStep} onChange={setComboStep} />
        </div>

        <SlidePanelShell
          open={comboOpen}
          onClose={() => setComboOpen(false)}
          title="AI 자동 튜닝 진행상태"
          width={comboWidth}
          onWidthChange={setComboWidth}
          headerSlot={
            <div className="flex items-center gap-2 text-[11px] text-text-secondary">
              <CostSweepHero size="sm" />
              <span className="font-mono text-text-muted">SQL_8x4k2m1</span>
              <span className="text-text-muted/60">·</span>
              <span>EXEM_PROD</span>
              <span className="text-text-muted/60">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-action animate-pulse" />
                실행 중
              </span>
            </div>
          }
        >
          <div className="p-6 space-y-6">
            <TuningInProgressCard
              variant={comboWidth === 'narrow' ? 'narrow' : 'expanded'}
              currentStep={comboStep}
              elapsed="03:12"
              stepDescription="튜닝안 후보를 검증 환경에서 순차 실행 중"
            />

            <div className="text-[12px] text-text-secondary leading-relaxed">
              헤더의 확장/축소 버튼을 눌러 패널 폭을 바꾸면, 카드 레이아웃이
              narrow(3줄 컴팩트) / expanded(1줄 인라인)로 자동 전환됩니다.
            </div>
          </div>
        </SlidePanelShell>
      </section>
    </div>
  )
}

export default DevCommonDemo
