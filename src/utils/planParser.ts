export type PlanRow = { id: string; starred: boolean; cells: string[] }
export type PredicateEntry = { id: string; type: 'access' | 'filter'; text: string }

export function parsePlanText(text: string) {
  const lines = text.split('\n')
  const preLines: string[] = []
  const headers: string[] = []
  const rows: PlanRow[] = []
  const predicates: PredicateEntry[] = []
  let phase: 'pre' | 'header' | 'data' | 'post' | 'predicate' = 'pre'

  for (const line of lines) {
    if (/^Predicate Information/i.test(line.trim())) { phase = 'predicate'; continue }
    if (phase === 'predicate') {
      if (/^-+$/.test(line.trim())) continue
      const m = line.match(/^\s*(\d+)\s*-\s*(access|filter)\s*\((.+)\)\s*$/)
      if (m) predicates.push({ id: m[1], type: m[2] as 'access' | 'filter', text: m[3] })
      else if (line.trim() && predicates.length > 0 && /^\s{10,}/.test(line)) predicates[predicates.length - 1].text += ' ' + line.trim()
      continue
    }
    if (phase === 'pre') {
      if (/^\|\s*Id\s*\|/.test(line)) {
        headers.push(...line.split('|').filter(p => p.trim() !== '').map(p => p.trim()))
        phase = 'header'
      } else if (!/^-+$/.test(line)) preLines.push(line)
    } else if (phase === 'header') {
      if (/^-+$/.test(line)) phase = 'data'
      else if (/^\|/.test(line)) {
        phase = 'data'
        const parts = line.split('|').filter(p => p !== '')
        rows.push({ id: parts[0]?.replace('*', '').trim() || '', starred: parts[0]?.includes('*') || false, cells: parts.map((p, ci) => ci === 0 ? p.replace(/\*/g, '').trim() : ci === 1 ? p.replace(/\s+$/, '') : p.trim()) })
      }
    } else if (phase === 'data') {
      if (/^-+$/.test(line)) phase = 'post'
      else if (/^\|/.test(line)) {
        const parts = line.split('|').filter(p => p !== '')
        rows.push({ id: parts[0]?.replace('*', '').trim() || '', starred: parts[0]?.includes('*') || false, cells: parts.map((p, ci) => ci === 0 ? p.replace(/\*/g, '').trim() : ci === 1 ? p.replace(/\s+$/, '') : p.trim()) })
      }
    }
  }
  return { preLines, headers, rows, predicates }
}
