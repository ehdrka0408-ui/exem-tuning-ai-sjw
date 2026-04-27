export type GroupNameSource = 'V$SQL' | 'AWR' | 'USER_INPUT' | 'RETUNE'

const SOURCE_LABEL: Record<GroupNameSource, string> = {
  'V$SQL': 'V$SQL',
  'AWR': 'AWR',
  'USER_INPUT': '사용자SQL입력',
  'RETUNE': '재튜닝',
}

export function buildDefaultGroupName(
  source: GroupNameSource,
  userName: string,
  count: number,
  date: Date = new Date(),
): string {
  const yy = String(date.getFullYear()).slice(2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `[${SOURCE_LABEL[source]}] ${userName} 요청 ${count}건 ${yy}${mm}${dd} ${hh}:${mi}:${ss}`
}
