import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  { to: '/ops/integration/instances', label: '인스턴스 연결' },
  { to: '/ops/users', label: '사용자/권한' },
  { to: '/ops/integration/exceptions', label: '예외 SQL 목록' },
  { to: '/ops/preset', label: '프리셋 자동튜닝' },
]

export default function OpsLayout() {
  return (
    <div>
      <div className="border-b border-border bg-white px-4">
        <nav className="flex items-center gap-4">
          {TABS.map(tab => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end
              className={({ isActive }) =>
                `relative -mb-px py-2.5 text-[13px] font-medium transition-colors ${
                  isActive
                    ? 'text-text-primary border-b-2 border-action'
                    : 'text-text-muted border-b-2 border-transparent hover:text-text-secondary'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="pt-3">
        <Outlet />
      </div>
    </div>
  )
}
