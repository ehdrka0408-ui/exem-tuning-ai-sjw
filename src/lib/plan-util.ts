export function trimPlanHeader(plan: string | null | undefined): string {
  if (!plan) return ''
  const lines = plan.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Plan hash value')) return lines.slice(i).join('\n')
  }
  return plan
}
