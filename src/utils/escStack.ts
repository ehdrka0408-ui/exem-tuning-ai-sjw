import { useEffect, useRef } from 'react'

// 글로벌 ESC 스택: 최상위(가장 최근에 등록된) 핸들러만 ESC 키를 받는다.
// 여러 플로팅 패널/모달이 동시에 열려있어도 최근 것부터 하나씩 닫힌다.

interface StackEntry {
  id: symbol
  fn: () => void
}

const stack: StackEntry[] = []
let installed = false

function ensureInstalled() {
  if (installed) return
  installed = true
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape') return
      const top = stack[stack.length - 1]
      if (!top) return
      // 입력 요소 안에서는 Esc가 입력 정리 용도일 수 있어 그대로 전파
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement | null)?.isContentEditable) return
      e.stopPropagation()
      e.preventDefault()
      top.fn()
    },
    true, // capture: 다른 keydown 리스너보다 우선 실행
  )
}

/**
 * 컴포넌트가 활성 상태일 때 글로벌 ESC 스택에 핸들러를 등록한다.
 * 최상위 등록 핸들러만 ESC를 받으므로 LIFO 닫기 동작이 자연스럽게 동작한다.
 */
export function useEscStack(active: boolean, handler: () => void) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!active) return
    ensureInstalled()
    const entry: StackEntry = { id: Symbol('esc'), fn: () => handlerRef.current() }
    stack.push(entry)
    return () => {
      const idx = stack.findIndex((e) => e.id === entry.id)
      if (idx !== -1) stack.splice(idx, 1)
    }
  }, [active])
}
