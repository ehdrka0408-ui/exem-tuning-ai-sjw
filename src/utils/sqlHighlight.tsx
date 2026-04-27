import React from 'react'

const SQL_KEYWORDS = /\b(SELECT|FROM|WHERE|AND|OR|NOT|IN|EXISTS|BETWEEN|LIKE|IS|NULL|AS|ON|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|FULL|UNION|ALL|INSERT|INTO|UPDATE|SET|DELETE|CREATE|ALTER|DROP|TABLE|INDEX|VIEW|WITH|HAVING|GROUP\s+BY|ORDER\s+BY|PARTITION\s+BY|OVER|CASE|WHEN|THEN|ELSE|END|DISTINCT|TOP|LIMIT|OFFSET|FETCH|FIRST|NEXT|ROWS|ONLY|ASC|DESC|USING|VALUES|COUNT|SUM|AVG|MIN|MAX|ROUND|NVL|NVL2|DECODE|TO_CHAR|TO_DATE|TO_NUMBER|TRUNC|ADD_MONTHS|SYSDATE|ROWNUM|ROWID|SUBSTR|INSTR|LENGTH|REPLACE|TRIM|UPPER|LOWER|COALESCE|NULLIF|CAST|EXTRACT|RANK|DENSE_RANK|ROW_NUMBER|LAG|LEAD|LISTAGG|RATIO_TO_REPORT)\b/gi
const SQL_STRINGS = /('[^']*')/g
const SQL_NUMBERS = /\b(\d+\.?\d*)\b/g
const SQL_COMMENTS = /(--.*$|\/\*[\s\S]*?\*\/)/gm
const SQL_HINTS = /(\/\*\+[\s\S]*?\*\/)/g

const HL_BG = '#FEF08A'
const HL_FG = '#78350F'

/** 동일어 globalTerm(case-insensitive)을 형광 mark 로 추가 분할. */
function applyGlobalHighlight(node: React.ReactNode, globalTerm?: string, keyPrefix = 'g'): React.ReactNode {
  if (!globalTerm) return node
  if (typeof node === 'string') return splitWithMark(node, globalTerm, keyPrefix)
  if (React.isValidElement(node)) {
    const props = (node as React.ReactElement<{ children?: React.ReactNode }>).props
    const children = props.children
    if (typeof children === 'string') {
      return React.cloneElement(node as React.ReactElement<{ children?: React.ReactNode }>, undefined,
        splitWithMark(children, globalTerm, keyPrefix))
    }
  }
  return node
}

function splitWithMark(text: string, term: string, keyPrefix: string): React.ReactNode {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(?<![A-Za-z0-9_])(${escaped})(?![A-Za-z0-9_])`, 'gi')
  const out: React.ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(
      <mark
        key={`${keyPrefix}-${i++}`}
        style={{ backgroundColor: HL_BG, color: HL_FG }}
        className="rounded-sm font-semibold"
      >
        {m[0]}
      </mark>
    )
    last = m.index + m[0].length
  }
  if (last === 0) return text
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function highlightSQL(text: string, globalTerm?: string): React.ReactNode[] {
  const tokens: { start: number; end: number; type: string }[] = []
  const collect = (regex: RegExp, type: string) => {
    let m: RegExpExecArray | null
    const r = new RegExp(regex.source, regex.flags)
    while ((m = r.exec(text)) !== null) {
      const overlap = tokens.some(t => m!.index < t.end && m!.index + m![0].length > t.start)
      if (!overlap) tokens.push({ start: m.index, end: m.index + m[0].length, type })
    }
  }
  collect(SQL_HINTS, 'hint')
  collect(SQL_COMMENTS, 'comment')
  collect(SQL_STRINGS, 'string')
  collect(SQL_KEYWORDS, 'keyword')
  collect(SQL_NUMBERS, 'number')
  tokens.sort((a, b) => a.start - b.start)
  const result: React.ReactNode[] = []
  let cursor = 0
  let keyIdx = 0
  for (const tok of tokens) {
    if (tok.start > cursor) {
      const seg = text.slice(cursor, tok.start)
      result.push(applyGlobalHighlight(seg, globalTerm, `seg-${keyIdx++}`))
    }
    const cls =
      tok.type === 'keyword' ? 'text-code font-semibold' :
      tok.type === 'string' ? 'text-warning' :
      tok.type === 'number' ? 'text-indigo-600' :
      tok.type === 'comment' ? 'text-text-muted italic' :
      tok.type === 'hint' ? 'text-teal-600 font-medium' : ''
    const segText = text.slice(tok.start, tok.end)
    result.push(
      <span key={tok.start} className={cls}>
        {applyGlobalHighlight(segText, globalTerm, `tok-${tok.start}`)}
      </span>
    )
    cursor = tok.end
  }
  if (cursor < text.length) {
    const seg = text.slice(cursor)
    result.push(applyGlobalHighlight(seg, globalTerm, `tail-${keyIdx++}`))
  }
  return result
}

/** 전역 colTerm 과 자동 동기화되는 SQL pre 컴포넌트.
 *  사용: <HighlightedSql sql={item.sqlText} /> */
import { useObjectInfo } from '../components/object-info/ObjectInfoContext'
export function HighlightedSql({
  sql,
  className = 'text-xs font-mono whitespace-pre-wrap text-text-primary',
}: { sql: string; className?: string }) {
  const { colTerm, setColTerm } = useObjectInfo()
  const handleSelect = () => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const picked = sel.toString().trim()
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(picked)) setColTerm(picked)
  }
  return (
    <pre
      className={className}
      data-sql-source={sql}
      onMouseUp={handleSelect}
      onKeyUp={(e) => { if (e.shiftKey) handleSelect() }}
    >
      {highlightSQL(sql, colTerm)}
    </pre>
  )
}
