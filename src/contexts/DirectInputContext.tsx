import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import SlidePanel from '../components/common/SlidePanel'
import DirectInputForm from '../components/common/DirectInputForm'

interface DirectInputContextValue {
  openDirectInput: () => void
  closeDirectInput: () => void
  isOpen: boolean
}

const Ctx = createContext<DirectInputContextValue | null>(null)

export function useDirectInput() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useDirectInput must be used within DirectInputProvider')
  return v
}

export function DirectInputProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const openDirectInput = useCallback(() => setOpen(true), [])
  const closeDirectInput = useCallback(() => setOpen(false), [])

  const ctxValue = useMemo(() => ({ openDirectInput, closeDirectInput, isOpen: open }), [openDirectInput, closeDirectInput, open])

  return (
    <Ctx.Provider value={ctxValue}>
      {children}
      <SlidePanel
        open={open}
        onClose={closeDirectInput}
        title="사용자 SQL입력"
        defaultWidthRatio={0.5}
        contentClassName="flex-1 flex flex-col overflow-hidden"
      >
          <DirectInputForm
            onCreated={(id) => {
              setOpen(false)
              navigate(`/work?detail=${id}`)
            }}
            onNavigateToExisting={(id) => {
              setOpen(false)
              navigate(`/work?detail=${id}`)
            }}
          />
      </SlidePanel>
    </Ctx.Provider>
  )
}
