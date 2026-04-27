import React from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  LayoutDashboard,
  Target,
  Workflow,
  Activity,
  Settings,
  ChevronRight,
  SquarePen,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle?: () => void;
}

interface NavChild {
  label: string;
  path: string;
}

interface NavItem {
  label: string;
  path?: string;         // 없으면 클릭 불가 (static label)
  icon: ReactNode;
  end?: boolean;
  divider?: boolean;
  children?: NavChild[];
}

const NAV: NavItem[] = [
  {
    label: '대시보드',
    path: '/',
    icon: <LayoutDashboard size={18} />,
    end: true,
    divider: true,
  },
  {
    label: '대상 선정',
    path: '/candidates/top',
    icon: <Target size={18} />,
  },
  {
    label: '튜닝 현황',
    path: '/work',
    icon: <Workflow size={18} />,
  },
  {
    label: '운영효과',
    path: '/ops/effect',
    icon: <Activity size={18} />,
  },
];

/* ─── item class helpers ─────────────────────────────────── */

const ITEM_BASE = 'flex items-center gap-3 px-4 py-2 text-[13px] transition-colors border-l-[3px]';

const ITEM_ACTIVE   = 'border-code bg-surface-alt text-text-primary font-medium';
const ITEM_INACTIVE = 'border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-alt';

const CHILD_BASE    = 'flex items-center pl-11 pr-4 py-1.5 text-[13px] transition-colors border-l-[3px]';
const CHILD_ACTIVE  = 'border-code bg-surface-alt text-text-primary font-medium';
const CHILD_INACTIVE= 'border-transparent text-text-muted hover:text-text-secondary hover:bg-surface-alt';

/* ═══════════════════════════════════════════════════════════
   Sidebar
═══════════════════════════════════════════════════════════ */

export default function Sidebar({ collapsed }: SidebarProps) {
  const { pathname } = useLocation();

  return (
    <aside
      className={`flex flex-col bg-white border-r border-border transition-all duration-300 shrink-0 ${
        collapsed ? 'w-14' : 'w-48'
      } h-full`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        {/* EXEM 로고 — 빨간 사각형 안의 흰 X */}
        <span
          className="inline-flex items-center justify-center shrink-0 rounded-[3px] text-white"
          style={{ backgroundColor: '#000000', width: 22, height: 22 }}
          aria-label="EXEM"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 5 L17 17 M17 5 L5 17" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </span>
        {!collapsed && (
          <span className="text-[13px] font-semibold tracking-tight whitespace-nowrap text-text-primary">
            EXEM TUNING AI
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV.map((item, navIdx) => {
          const hasChildren = !!item.children?.length;
          const prevItem = navIdx > 0 ? NAV[navIdx - 1] : null;
          const showDivider = prevItem?.divider;
          const childActive = hasChildren
            ? item.children!.some((c) => pathname === c.path || pathname.startsWith(c.path + '/'))
            : false;

          /* ── Standalone item ── */
          if (!hasChildren) {
            const dividerEl = showDivider ? <div key={`div-${navIdx}`} className="my-2 mx-4 border-t border-border" /> : null;
            const forcedActive =
              (item.path?.startsWith('/candidates') && pathname.startsWith('/candidates')) ||
              (item.path === '/ops/effect' && pathname.startsWith('/ops/effect')) ||
              (item.path?.startsWith('/ops') && item.path !== '/ops/effect' && pathname.startsWith('/ops') && !pathname.startsWith('/ops/effect'));
            return (
              <React.Fragment key={item.path}>
              {dividerEl}
              <NavLink
                to={item.path!}
                end={item.end}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  [ITEM_BASE, collapsed ? 'justify-center px-0' : '', (isActive || forcedActive) ? ITEM_ACTIVE : ITEM_INACTIVE].join(' ')
                }
              >
                <span className="shrink-0">{item.icon}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
              </React.Fragment>
            );
          }

          /* ── Parent + children ── */
          const parentCls = [
            ITEM_BASE,
            collapsed ? 'justify-center px-0' : '',
            childActive ? 'border-transparent text-text-primary font-medium' : 'border-transparent text-text-secondary',
          ].join(' ');

          const parentContent = (
            <>
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && (
                <>
                  <span className="flex-1 truncate">{item.label}</span>
                  <ChevronRight size={12} className="shrink-0 text-text-muted" />
                </>
              )}
            </>
          );

          return (
            <div key={item.label}>
              {/* Parent row */}
              {item.path ? (
                <NavLink
                  to={item.path}
                  end
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    [
                      ITEM_BASE,
                      collapsed ? 'justify-center px-0' : '',
                      (isActive || childActive)
                        ? 'border-transparent text-text-primary font-medium'
                        : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-alt',
                    ].join(' ')
                  }
                >
                  {parentContent}
                </NavLink>
              ) : (
                <div className={parentCls} title={collapsed ? item.label : undefined}>
                  {parentContent}
                </div>
              )}

              {/* Child items */}
              {!collapsed && (
                <div className="pb-1">
                  {item.children!.map((child) => (
                    <NavLink
                      key={child.path}
                      to={child.path}
                      className={({ isActive }) =>
                        [CHILD_BASE, isActive ? CHILD_ACTIVE : CHILD_INACTIVE].join(' ')
                      }
                    >
                      {child.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Quick Action — 쿼리툴 (설정 위) */}
      <div className="px-3 pb-2">
        <NavLink
          to="/canvas"
          title={collapsed ? '쿼리툴' : undefined}
          className={`flex items-center justify-center gap-2 w-full rounded-lg text-[13px] font-medium transition-colors cursor-pointer bg-code-bg text-action hover:bg-[#D2E3FC] hover:text-action-hover active:scale-[0.98] ${
            collapsed ? 'p-2' : 'px-3 py-1.5'
          }`}
        >
          <SquarePen size={15} className="shrink-0" />
          {!collapsed && <span>쿼리툴</span>}
        </NavLink>
      </div>

      {/* 설정 */}
      <div className="px-1 pb-1">
        <NavLink
          to="/ops/users"
          title={collapsed ? '설정' : undefined}
          className={({ isActive }) =>
            [ITEM_BASE, collapsed ? 'justify-center px-0' : '',
              (isActive || pathname.startsWith('/ops/users'))
                ? ITEM_ACTIVE : ITEM_INACTIVE].join(' ')
          }
        >
          <Settings size={18} />
          {!collapsed && <span>설정</span>}
        </NavLink>
      </div>

    </aside>
  );
}
