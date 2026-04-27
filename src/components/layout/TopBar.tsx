import { useLocation, Link } from 'react-router-dom';
import { Menu, PanelLeftClose, ChevronRight } from 'lucide-react';
import { AiQueueIndicator, NotificationDropdown } from '../common';

interface TopBarProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

const BREADCRUMB_MAP: Record<string, { parent?: { label: string; path: string }; label: string }> = {
  '/': { label: '대시보드' },
  '/candidates/preset':  { label: '프리셋 자동튜닝' },
  '/candidates/top':     { label: '대상 선정' },
  '/candidates/direct':  { label: '대상 선정' },
  '/canvas':             { label: '사용자 SQL입력' },
  '/work': { label: '튜닝 현황' },
  '/ops/integration':            { label: '설정' },
  '/ops/integration/instances':  { label: '설정' },
  '/ops/integration/exceptions': { label: '설정' },
  '/ops/users':                  { label: '설정' },
  '/ops/preset':                 { label: '설정' },
};

export default function TopBar({ sidebarCollapsed, onToggleSidebar }: TopBarProps) {
  const location = useLocation();
  const crumb = BREADCRUMB_MAP[location.pathname];

  return (
    <header className="flex items-center justify-between h-8 px-4 bg-white border-b border-border shrink-0">
      {/* Left: sidebar toggle + breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-muted transition-colors"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <Menu size={18} /> : <PanelLeftClose size={18} />}
        </button>

        {crumb && (
          <nav className="flex items-center gap-1 text-[13px]">
            {crumb.parent && (
              <>
                <Link to={crumb.parent.path} className="text-text-muted hover:text-text-secondary transition-colors">
                  {crumb.parent.label}
                </Link>
                <ChevronRight size={12} className="text-border" />
              </>
            )}
            <span className="font-medium text-text-primary">{crumb.label}</span>
          </nav>
        )}
      </div>

      {/* Right: AI queue + notifications */}
      <div className="flex items-center gap-1">
        <AiQueueIndicator />
        <NotificationDropdown />
      </div>
    </header>
  );
}
