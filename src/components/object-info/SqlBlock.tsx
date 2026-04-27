import { useEffect, useRef, type ReactNode } from 'react'
import { useObjectInfo } from './ObjectInfoContext'

interface Props {
  sql: string
  children?: ReactNode
  className?: string
}

/**
 * SQL 블록을 감싸는 wrapper.
 * - 내부에서 텍스트를 선택하면 현재 활성 SQL로 등록됨
 * - 이후 F4를 누르면 Object Info 패널이 열림
 * - Object Info에서 colTerm이 설정되면 해당 컬럼명 토큰을 본 SQL에 하이라이트
 * - children 미지정 시 SQL을 pre 태그로 렌더
 */
export default function SqlBlock({ sql, children, className }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const { setActiveSql, colTerm } = useObjectInfo()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onUp = () => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return
      const anchor = sel.anchorNode
      if (!anchor || !el.contains(anchor)) return
      setActiveSql(sql)
    }
    const onEnter = () => setActiveSql(sql)
    el.addEventListener('mouseup', onUp)
    el.addEventListener('mouseenter', onEnter)
    return () => {
      el.removeEventListener('mouseup', onUp)
      el.removeEventListener('mouseenter', onEnter)
    }
  }, [sql, setActiveSql])

  const showHighlighted = !!colTerm

  return (
    <div ref={ref} className={className} data-object-info-sql="1" title="드래그 + F4 = Object Info">
      {showHighlighted ? (
        <pre className="text-xs bg-slate-50 p-3 rounded overflow-x-auto font-mono whitespace-pre">
          {renderWithHighlight(sql, colTerm)}
        </pre>
      ) : (
        children ?? (
          <pre className="text-xs bg-slate-50 p-3 rounded overflow-x-auto font-mono whitespace-pre">
{sql}
          </pre>
        )
      )}
    </div>
  )
}

function renderWithHighlight(sql: string, term: string): ReactNode[] {
  if (!term) return [sql]
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(?<![A-Za-z0-9_])(${escaped})(?![A-Za-z0-9_])`, 'gi')
  const out: ReactNode[] = []
  let lastIndex = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(sql)) !== null) {
    if (m.index > lastIndex) out.push(sql.slice(lastIndex, m.index))
    out.push(
      <mark key={key++} style={{ backgroundColor: '#FEF08A', color: '#78350F' }} className="rounded-sm font-semibold">
        {m[0]}
      </mark>
    )
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < sql.length) out.push(sql.slice(lastIndex))
  return out
}
