import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { QueueTab, ScheduleTab, PanelTabs } from '../components/common/AiQueueIndicator'
import ConfirmDialog from '../components/common/ConfirmDialog'
import { useQueue, fmtElapsed } from '../contexts/QueueContext'

export default function QueueFullView() {
  const navigate = useNavigate()
  const { activeTab, setActiveTab, confirmStop, setConfirmStop, handleConfirmStop, currentRunning, elapsed } = useQueue()

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between h-12 px-6 border-b border-border shrink-0 bg-white">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold text-text-primary">실행큐 관리</h1>
          <div className="w-px h-4 bg-border" />
          <PanelTabs active={activeTab} onChange={setActiveTab} />
        </div>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium text-text-secondary hover:bg-surface-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={13} />
          닫기
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-surface">
        <div className="max-w-3xl mx-auto px-8 py-6">
          {activeTab === 'queue' && <QueueTab />}
          {activeTab === 'schedule' && <ScheduleTab />}
        </div>
      </div>

      {/* Stop confirm */}
      <ConfirmDialog
        open={confirmStop}
        title="작업 중지"
        message={`"${currentRunning.sqlText.slice(0, 60)}…"\n${currentRunning.instance} · ${fmtElapsed(elapsed)}\n\n이 작업을 중지하면 큐가 일시정지됩니다.\n(다음 건이 자동으로 실행되지 않습니다)\n\n계속하시겠습니까?`}
        variant="danger"
        confirmLabel="중지"
        onConfirm={handleConfirmStop}
        onCancel={() => setConfirmStop(false)}
      />
    </div>
  )
}
