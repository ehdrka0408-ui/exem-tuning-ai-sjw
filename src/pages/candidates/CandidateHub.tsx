import { useNavigate } from 'react-router-dom'
import { BarChart3, Crosshair, FilePlus, ListFilter } from 'lucide-react'
import { useQueue, totalPending } from '../../contexts/QueueContext'

/* ─── Mock ───────────────────────────────────────────────── */
const TODAY_COMPLETED = 32

/* ─── Card data ──────────────────────────────────────────── */
interface HubCard {
  icon: React.ReactNode
  title: string
  description: string
  path: string
  context?: React.ReactNode
}

/* ═══════════════════════════════════════════════════════════
   CandidateHub
═══════════════════════════════════════════════════════════ */
export default function CandidateHub() {
  const navigate = useNavigate()
  const { queueState } = useQueue()
  const pending = totalPending(queueState)

  const cards: HubCard[] = [
    {
      icon: <ListFilter size={20} className="text-code" />,
      title: '프리셋 자동튜닝',
      description: '조건 기반으로 SQL을 자동 선별하고 예약·반복 실행',
      path: '/candidates/preset',
      context: (
        <div className="mt-3 space-y-1 text-[11px] text-text-muted">
          <div>마지막 실행: <span className="text-text-secondary">03/16 02:00</span></div>
          <div>활성 반복: <span className="text-text-secondary">2건</span></div>
        </div>
      ),
    },
    {
      icon: <BarChart3 size={20} className="text-text-secondary" />,
      title: 'Top SQL',
      description: 'CPU, I/O, Elapsed 기준 상위 SQL을 수집·분석',
      path: '/candidates/top',
    },
    {
      icon: <Crosshair size={20} className="text-text-secondary" />,
      title: 'Scatter View',
      description: '실행 분포에서 이상점을 시각적으로 탐색',
      path: '/candidates/anomaly',
    },
    {
      icon: <FilePlus size={20} className="text-text-secondary" />,
      title: '사용자 SQL입력',
      description: '튜닝할 SQL 텍스트를 직접 붙여넣어 요청',
      path: '/candidates/direct',
    },
  ]

  return (
    <div className="p-6 max-w-[960px]">
      {/* Status bar */}
      <div className="mb-6 flex items-center gap-2 text-[12px] text-text-muted">
        <span>큐 대기 <span className="font-medium text-text-secondary tabular-nums">{pending}건</span></span>
        <span className="text-border">·</span>
        <span>실행 중 <span className="font-medium text-text-secondary tabular-nums">1건</span></span>
        <span className="text-border">·</span>
        <span>오늘 완료 <span className="font-medium text-text-secondary tabular-nums">{TODAY_COMPLETED}건</span></span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 gap-4">
        {cards.map((card) => (
          <button
            key={card.path}
            onClick={() => navigate(card.path)}
            className="group flex flex-col items-start rounded-xl border border-border bg-white p-5 text-left hover:border-text-muted hover:shadow-sm transition-all"
          >
            <div className="mb-3">{card.icon}</div>
            <p className="text-[14px] font-semibold text-text-primary">{card.title}</p>
            <p className="mt-1 text-[12px] text-text-muted leading-relaxed">{card.description}</p>
            {card.context}
          </button>
        ))}
      </div>
    </div>
  )
}
