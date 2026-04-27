export function stripRetuneSuffix(raw: string | null | undefined): string {
  let s = (raw ?? '').trim()
  for (let i = 0; i < 10; i++) {
    const m1 = s.match(/^(.+?)_재튜닝\(\d+\)$/)
    if (m1) { s = m1[1].trim(); continue }
    const m2 = s.match(/^(.+?)\s*\(\d+\)\s*$/)
    if (m2) { s = m2[1].trim(); continue }
    break
  }
  if (/^재튜닝\s*#?\d*$/.test(s)) s = ''
  return s
}
