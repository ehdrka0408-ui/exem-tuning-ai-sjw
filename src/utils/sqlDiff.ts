import { diffArrays } from 'diff'
import { format as sqlFormat } from 'sql-formatter'

// ─── Types ────────────────────────────────────
export type DiffLine = { num: number; text: string; type: 'equal' | 'added' | 'removed' | 'modified' | 'spacer'; wordSegments?: { text: string; type: 'equal' | 'added' | 'removed' }[] }

export const DIFF_STYLES: Record<DiffLine['type'], string> = {
  equal: '',
  added: 'bg-emerald-50',
  removed: 'bg-red-50',
  modified: 'bg-amber-50',
  spacer: '',
}

export const DIFF_TEXT: Record<DiffLine['type'], string> = {
  equal: '',
  added: 'text-emerald-700',
  removed: 'text-red-700',
  modified: 'text-amber-800',
  spacer: '',
}

// ─── SQL line diff ────────────────────────────
export function computeLineDiff(left: string, right: string): { leftLines: DiffLine[], rightLines: DiffLine[] } {
  const leftArr = left.split('\n')
  const rightArr = right.split('\n')
  const changes = diffArrays(leftArr, rightArr)
  const leftLines: DiffLine[] = []
  const rightLines: DiffLine[] = []
  let leftNum = 1
  let rightNum = 1
  for (const part of changes) {
    if (!part.added && !part.removed) {
      for (const val of part.value) {
        leftLines.push({ num: leftNum++, text: val, type: 'equal' })
        rightLines.push({ num: rightNum++, text: val, type: 'equal' })
      }
    } else if (part.removed) {
      for (const val of part.value) {
        leftLines.push({ num: leftNum++, text: val, type: 'removed' })
      }
    } else if (part.added) {
      for (const val of part.value) {
        rightLines.push({ num: rightNum++, text: val, type: 'added' })
      }
    }
  }
  return { leftLines, rightLines }
}

// ─── Plan structure-aware diff ────────────────
export function computePlanDiff(left: string, right: string): { leftLines: DiffLine[], rightLines: DiffLine[] } {
  const leftArr = left.split('\n')
  const rightArr = right.split('\n')
  const extractId = (line: string): string | null => {
    const m = line.match(/\|\s*\*?\s*(\d+)\s*\|/)
    return m ? m[1] : null
  }
  const extractOp = (line: string): string => {
    const parts = line.split('|').filter(p => p !== '')
    if (parts.length < 3) return ''
    return (parts[1] || '').trim() + '|' + (parts[2] || '').trim()
  }
  const isHeader = (line: string) => /^\|\s*Id\s*\|/.test(line)
  const isSeparator = (line: string) => /^-{3,}$/.test(line.trim())
  const isPredicate = (line: string) => /^Predicate Information/i.test(line.trim())

  type Section = 'pre' | 'header' | 'data' | 'predicate'
  function splitPlan(arr: string[]) {
    const pre: string[] = []
    const headerLines: string[] = []
    const dataRows: { id: string; line: string }[] = []
    const postLines: string[] = []
    let phase: Section = 'pre'
    for (const line of arr) {
      if (phase === 'pre') {
        if (isHeader(line)) { headerLines.push(line); phase = 'header'; continue }
        pre.push(line)
      } else if (phase === 'header') {
        if (isSeparator(line)) { headerLines.push(line); phase = 'data'; continue }
        headerLines.push(line)
      } else if (phase === 'data') {
        if (isPredicate(line)) { postLines.push(line); phase = 'predicate'; continue }
        if (isSeparator(line)) { phase = 'predicate'; continue }
        const id = extractId(line)
        if (id) dataRows.push({ id, line })
      } else if (phase === 'predicate') {
        postLines.push(line)
      }
    }
    return { pre, headerLines, dataRows, postLines }
  }

  const L = splitPlan(leftArr)
  const R = splitPlan(rightArr)

  const leftById = new Map<string, string>()
  for (const r of L.dataRows) leftById.set(r.id, r.line)
  const rightById = new Map<string, string>()
  for (const r of R.dataRows) rightById.set(r.id, r.line)

  const leftIdOrder = L.dataRows.map(r => r.id)
  const rightIdOrder = R.dataRows.map(r => r.id)
  const rightOnlyIds = new Set(rightIdOrder.filter(id => !leftById.has(id)))
  const allIds: string[] = []
  let ri = 0
  for (const lid of leftIdOrder) {
    while (ri < rightIdOrder.length && rightOnlyIds.has(rightIdOrder[ri])) {
      allIds.push(rightIdOrder[ri])
      ri++
    }
    allIds.push(lid)
    if (ri < rightIdOrder.length && rightIdOrder[ri] === lid) ri++
  }
  while (ri < rightIdOrder.length) {
    if (rightOnlyIds.has(rightIdOrder[ri])) allIds.push(rightIdOrder[ri])
    ri++
  }

  const leftLines: DiffLine[] = []
  const rightLines: DiffLine[] = []
  let ln = 1
  let rn = 1

  const maxPre = Math.max(L.pre.length, R.pre.length)
  for (let i = 0; i < maxPre; i++) {
    leftLines.push(L.pre[i] ? { num: ln++, text: L.pre[i], type: 'equal' } : { num: 0, text: '', type: 'spacer' })
    rightLines.push(R.pre[i] ? { num: rn++, text: R.pre[i], type: 'equal' } : { num: 0, text: '', type: 'spacer' })
  }

  const maxH = Math.max(L.headerLines.length, R.headerLines.length)
  for (let i = 0; i < maxH; i++) {
    leftLines.push(L.headerLines[i] ? { num: ln++, text: L.headerLines[i], type: 'equal' } : { num: 0, text: '', type: 'spacer' })
    rightLines.push(R.headerLines[i] ? { num: rn++, text: R.headerLines[i], type: 'equal' } : { num: 0, text: '', type: 'spacer' })
  }

  for (const id of allIds) {
    const lLine = leftById.get(id)
    const rLine = rightById.get(id)
    if (lLine && rLine) {
      const opChanged = extractOp(lLine) !== extractOp(rLine)
      leftLines.push({ num: ln++, text: lLine, type: opChanged ? 'modified' : 'equal' })
      rightLines.push({ num: rn++, text: rLine, type: opChanged ? 'modified' : 'equal' })
    } else if (lLine) {
      leftLines.push({ num: ln++, text: lLine, type: 'removed' })
      rightLines.push({ num: 0, text: '', type: 'spacer' })
    } else if (rLine) {
      leftLines.push({ num: 0, text: '', type: 'spacer' })
      rightLines.push({ num: rn++, text: rLine, type: 'added' })
    }
  }

  const maxPost = Math.max(L.postLines.length, R.postLines.length)
  for (let i = 0; i < maxPost; i++) {
    leftLines.push(L.postLines[i] ? { num: ln++, text: L.postLines[i], type: 'equal' } : { num: 0, text: '', type: 'spacer' })
    rightLines.push(R.postLines[i] ? { num: rn++, text: R.postLines[i], type: 'equal' } : { num: 0, text: '', type: 'spacer' })
  }

  return { leftLines, rightLines }
}

// ─── Diff stats ──────────────────────────────
export function computeDiffStats(leftLines: DiffLine[], rightLines: DiffLine[]) {
  let added = 0, removed = 0, modified = 0
  for (const l of leftLines) { if (l.type === 'removed') removed++; if (l.type === 'modified') modified++ }
  for (const l of rightLines) { if (l.type === 'added') added++ }
  return { totalLeft: leftLines.filter(l => l.type !== 'spacer').length, totalRight: rightLines.filter(l => l.type !== 'spacer').length, added, removed, modified }
}

// ─── SQL formatting (preserves Oracle hints) ──
export function formatSQLText(sql: string): string {
  try {
    const hints: string[] = []
    const preserved = sql.replace(/\/\*\+[\s\S]*?\*\//g, (m) => { hints.push(m); return `__HINT_${hints.length - 1}__` })
    let result = sqlFormat(preserved, { language: 'plsql', tabWidth: 2, keywordCase: 'upper', linesBetweenQueries: 1 })
    hints.forEach((h, i) => { result = result.replace(`__HINT_${i}__`, h) })
    return result
  } catch { return sql }
}
