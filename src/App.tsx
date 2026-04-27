import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import Dashboard from './pages/Dashboard'
import CasesDbPage from './pages/db/CasesDbPage'
import { ObjectInfoProvider } from './components/object-info/ObjectInfoContext'
import ObjectInfoPanel from './components/object-info/ObjectInfoPanel'
import TopSql from './pages/candidates/TopSql'
// DirectInput → /canvas redirect (App.tsx route)
import CandidatesExploreLayout from './pages/candidates/CandidatesExploreLayout'
import OpsLayout from './pages/ops/OpsLayout'
import PresetAutoTuning from './pages/candidates/PresetAutoTuning'
import WorkPipeline from './pages/work/WorkPipeline'
import WorkDetail from './pages/work/WorkDetail'
import OpsImpact from './pages/ops/OpsImpact'
import OpsEffect from './pages/OpsEffect'
import PolicyManagement from './pages/ops/PolicyManagement'
import InstanceConnections from './pages/ops/InstanceConnections'
import SqlExceptions from './pages/ops/SqlExceptions'
import UserManagement from './pages/ops/UserManagement'
import Login from './pages/Login'
import V2Dashboard from './pages/v2/V2Dashboard'
import V2WorkPipeline from './pages/v2/V2WorkPipeline'
import V2WorkDetail from './pages/v2/V2WorkDetail'
import PopupView from './pages/PopupView'
import CompareAllPopupView from './pages/CompareAllPopupView'
import QueueFullView from './pages/QueueFullView'
import DevCommonDemo from './pages/DevCommonDemo'
import TuningRowPreview from './pages/dev/TuningRowPreview'
import CanvasPage from './pages/CanvasPage'
import { QueueProvider } from './contexts/QueueContext'
import ErrorBoundary from './components/common/ErrorBoundary'
import { NotificationProvider } from './contexts/NotificationContext'
import { WorkDetailPanelProvider } from './contexts/WorkDetailPanelContext'
import { DirectInputProvider } from './contexts/DirectInputContext'

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary fallback={
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '16px', color: '#64748b', fontFamily: 'sans-serif' }}>
          <p style={{ fontSize: '14px' }}>오류가 발생했습니다. 페이지를 새로고침해 주세요.</p>
          <button style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '13px' }} onClick={() => window.location.reload()}>새로고침</button>
        </div>
      }>
      <ObjectInfoProvider>
      <NotificationProvider>
      <QueueProvider>
      <WorkDetailPanelProvider>
      <DirectInputProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/db/cases" element={<CasesDbPage />} />
          <Route path="/candidates" element={<Navigate to="/candidates/top" replace />} />
          <Route path="/candidates/preset" element={<PresetAutoTuning />} />
          <Route element={<CandidatesExploreLayout />}>
            <Route path="/candidates/top" element={<TopSql />} />
            <Route path="/candidates/direct" element={<Navigate to="/canvas" replace />} />
          </Route>
          <Route path="/canvas" element={<CanvasPage />} />
          <Route path="/work" element={<WorkPipeline />} />
          <Route path="/work/:id" element={<WorkDetail />} />
          <Route path="/ops/impact" element={<OpsImpact />} />
          <Route path="/ops/effect" element={<OpsEffect />} />
          <Route path="/ops/policy" element={<PolicyManagement />} />
          <Route path="/ops" element={<Navigate to="/ops/users" replace />} />
          <Route element={<OpsLayout />}>
            <Route path="/ops/integration/instances" element={<InstanceConnections />} />
            <Route path="/ops/integration/exceptions" element={<SqlExceptions />} />
            <Route path="/ops/users" element={<UserManagement />} />
            <Route path="/ops/preset" element={<PresetAutoTuning />} />
          </Route>
          {/* V2 기획 비교용 */}
          <Route path="/v2" element={<V2Dashboard />} />
          <Route path="/v2/work" element={<V2WorkPipeline />} />
          <Route path="/v2/work/:id" element={<V2WorkDetail />} />
          {/* Dev — 공통 컴포넌트 데모 */}
          <Route path="/dev/common" element={<DevCommonDemo />} />
          <Route path="/dev/tuning-row" element={<TuningRowPreview />} />
        </Route>
        <Route path="/view" element={<AppLayout />}>
          <Route index element={<PopupView />} />
          <Route path="compare" element={<CompareAllPopupView />} />
        </Route>
        <Route path="/queue" element={<QueueFullView />} />
      </Routes>
        <ObjectInfoPanel />
      </DirectInputProvider>
      </WorkDetailPanelProvider>
      </QueueProvider>
      </NotificationProvider>
      </ObjectInfoProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}

export default App
