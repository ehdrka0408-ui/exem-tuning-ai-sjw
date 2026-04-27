import { useState } from 'react';
import { Outlet, useSearchParams, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { ToastContainer } from '../common/Toast';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [searchParams] = useSearchParams();
  const { pathname } = useLocation();
  const isPopup = searchParams.get('popup') === 'true';
  const isFullBleed = pathname === '/canvas';

  const handleToggle = () => setCollapsed((prev) => !prev);

  if (isPopup) {
    return (
      <div className="h-screen overflow-y-auto bg-white p-6">
        <Outlet />
        <ToastContainer />
      </div>
    );
  }

  return (
    <div
      className="flex overflow-hidden"
      style={{
        height: 'calc(100vh / 1.1)',
        '--layout-sidebar-w': collapsed ? '3.5rem' : '12rem',
        '--layout-topbar-h': '2rem',
      } as React.CSSProperties}
    >
      <Sidebar collapsed={collapsed} onToggle={handleToggle} />

      <div className="flex flex-col flex-1 min-w-0">
        <TopBar sidebarCollapsed={collapsed} onToggleSidebar={handleToggle} />

        <main className={`flex-1 overflow-y-auto bg-white ${isFullBleed ? '' : 'p-6'}`}>
          <Outlet />
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
