import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import SlidePanel from '../components/common/SlidePanel'
import ErrorBoundary from '../components/common/ErrorBoundary'
import WorkDetailPanel from '../pages/work/WorkDetailPanel'
import { workItems, type WorkItem } from '../mocks/workItems'
import { getNewV1Items } from '../mocks/newItemsStore'

interface WorkDetailPanelContextValue {
  openWorkDetail: (workItemId: string) => void
  closeWorkDetail: () => void
}

const Ctx = createContext<WorkDetailPanelContextValue | null>(null)

export function useWorkDetailPanel() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useWorkDetailPanel must be used within WorkDetailPanelProvider')
  return v
}

export function WorkDetailPanelProvider({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [panelMode, setPanelMode] = useState<'slide' | 'maximized'>('slide')

  const openWorkDetail = useCallback((id: string) => {
    setPanelMode('slide')
    setOpenId(id)
  }, [])
  const closeWorkDetail = useCallback(() => setOpenId(null), [])

  const item: WorkItem | null = useMemo(() => {
    if (!openId) return null
    const all = [...workItems, ...getNewV1Items()]
    return all.find(w => w.id === openId) ?? null
  }, [openId])

  const ctxValue = useMemo(() => ({ openWorkDetail, closeWorkDetail }), [openWorkDetail, closeWorkDetail])

  return (
    <Ctx.Provider value={ctxValue}>
      {children}
      <SlidePanel
        open={!!item}
        onClose={closeWorkDetail}
        title={item?.sqlId || ''}
        defaultWidthRatio={0.4}
        onModeChange={setPanelMode}
        headerContent={item ? (
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-sm font-semibold text-text-primary shrink-0">{item.sqlId}</span>
          </div>
        ) : undefined}
      >
        {item && (
          <ErrorBoundary fallback={
            <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-text-muted">
              <span className="text-sm">상세 패널 렌더 오류.</span>
              <button className="px-3 py-1.5 rounded text-sm border border-border hover:bg-surface-muted" onClick={closeWorkDetail}>닫기</button>
            </div>
          }>
            <WorkDetailPanel
              key={item.id}
              item={item}
              panelMode={panelMode}
            />
          </ErrorBoundary>
        )}
      </SlidePanel>
    </Ctx.Provider>
  )
}
