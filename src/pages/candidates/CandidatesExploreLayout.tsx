import { NavLink, Outlet } from 'react-router-dom'
import { useMaxGaugeStatus } from '../../hooks/useMaxGaugeStatus'

interface Tab {
  to: string
  label: string
  requiresMaxGauge?: boolean
}

const TABS: Tab[] = [
  { to: '/candidates/top', label: 'Top SQL' },
  { to: '/candidates/direct', label: '사용자 SQL입력' },
]

export default function CandidatesExploreLayout() {
  const mgConnected = useMaxGaugeStatus()

  return (
    <div className="flex flex-col h-full -mt-3">
      {/* 밑줄 탭 */}
      <div className="border-b border-border bg-white -mx-6 px-6 flex-shrink-0">
        <nav className="flex items-center gap-4">
          {TABS.map(tab => {
            const showDot = tab.requiresMaxGauge
            const dotColor = mgConnected ? 'bg-success' : 'bg-text-muted'
            const dotTitle = mgConnected ? 'MaxGauge 연동됨' : 'MaxGauge 미연동'
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end
                className={({ isActive }) =>
                  `relative -mb-px flex items-center gap-1.5 py-2 text-[13px] font-medium transition-colors ${
                    isActive
                      ? 'text-text-primary border-b-2 border-action'
                      : 'text-text-muted border-b-2 border-transparent hover:text-text-secondary'
                  }`
                }
              >
                {tab.label}
                {showDot && (
                  <span
                    title={dotTitle}
                    className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor}`}
                  />
                )}
              </NavLink>
            )
          })}
        </nav>
      </div>
      <div className="flex-1 min-h-0 flex flex-col pt-3">
        <Outlet />
      </div>
    </div>
  )
}
