# 프런트엔드 — 개선률 계산 로직

## 문서 목적

튜닝현황 목록 · 상세 · 워크스페이스에서 "개선률(%)" 을 계산하고 방향을 표시하는 공통 로직을 정의한다. 핵심 파일: `src/lib/improvement.ts` (공용 util), `src/pages/work/WorkPipeline.tsx`, `src/components/common/ImprovementBadge.tsx`, `src/pages/work/WorkDetail.tsx`, `src/pages/work/WorkDetailPanel.tsx`.

### 배경

개선률은 Before/After 성능 수치에서 산출하나, 실제 데이터는 다음 요인으로 왜곡 위험이 있다:
- gv$sql SUM 누적값이 과거 실행 포함 → per-exec 단순 나누기가 오도
- after 미수집 시 undefined 를 0 으로 강제 치환하면 "100% 개선" 오표시
- 악화(음수 rate) 를 `Math.abs()` + ↓ 하드코딩으로 렌더하면 "개선"으로 착시

이를 방지하기 위해 계산·렌더 단계 모두에 방어 로직을 적용한다.

---

## Description

### (1) 두 가지 계산 방식

**1. 내용**
- 같은 "개선률" 이라도 어떤 값을 기준으로 나누느냐에 따라 두 방식이 존재한다. 상황에 따라 선택한다.

**2. 구성**

| 방식 | 수식 | 장점 | 한계 |
|------|------|------|------|
| totals | `(before - after) / before` | 누적값 직접 비교, 단순 | after 가 집계값이면 왜곡 |
| per-exec | `(before/before_exec - after/after_exec) / (before/before_exec)` | 1회 실행 기준 정규화 | executions 오염 시 무의미 |

**3. 동작**
- a. 기본은 per-exec (튜닝된 plan 의 1회 실행 시간 비교)
- b. 특정 조건 만족 시 totals 로 전환 (다음 섹션)

---

### (2) `useTotals()` 전환 조건

**1. 내용**
- per-exec 정규화가 의미 없거나 왜곡을 유발할 경우 totals 로 전환한다. 공용 util 에 정의.

**2. 구성**

```typescript
export function useTotals(row: WorkItem): boolean {
 // ① plan_hash 동일 (plan 미변경 → per-exec 차이는 cache/노이즈)
 if (row.beforePlanHash && row.afterPlanHash
 && row.beforePlanHash === row.afterPlanHash) {
 return true
 }
 // ② executions 비율 5배 초과 (gv$sql 누적 오염 의심)
 if (row.beforeExecutions && row.afterExecutions
 && row.afterExecutions / row.beforeExecutions > 5) {
 return true
 }
 return false
}
```

**3. 동작**
- a. 조건 ①: before/after plan_hash 가 동일하고 둘 다 non-null. Oracle 이 같은 plan 을 선택 → LLM 튜닝 효과 없음 → per-exec 로 나누면 cache warmup 효과가 "개선"으로 둔갑
- b. 조건 ②: after_executions 가 before_executions 의 5배 초과. UUID marker 격리 실패 또는 after UUID marker 주입·sql_id 격리 (2026-04-23) 배포 전 데이터 → gv$sql SUM 이 과거 실행 포함
- c. 둘 다 false 면 per-exec 정규화 사용 (정상 케이스)
- d. useTotals=true 시 executions 으로 나누지 않고 raw 값 비교

---

### (3) 개선률 헬퍼 — `calcElapsedRate` / `calcBuffersRate`

**1. 내용**
- Elapsed · Buffers 각각의 rate 를 산출한다. useTotals 분기에 따라 totals 또는 per-exec.

**2. 구성**

```typescript
const perExec = (total?: number, execs?: number) =>
 total != null && execs != null && execs > 0 ? total / execs : total

const calcRate = (b?: number, a?: number): number | null => {
 if (b == null || a == null || b === 0) return null
 return Math.round((b - a) / b * 100)
}

export const calcElapsedRate = (row: WorkItem): number | null => {
 if (useTotals(row)) {
 return calcRate(row.originalElapsed, row.tunedElapsed)
 }
 return calcRate(
 perExec(row.originalElapsed, row.beforeExecutions),
 perExec(row.tunedElapsed, row.afterExecutions),
 )
}

export const calcBuffersRate = (row: WorkItem): number | null => {
 if (useTotals(row)) {
 return calcRate(row.originalBuffers, row.tunedBuffers)
 }
 return calcRate(
 perExec(row.originalBuffers, row.beforeExecutions),
 perExec(row.tunedBuffers, row.afterExecutions),
 )
}
```

**3. 동작**
- a. null / undefined / 0 값은 `null` 반환 → UI 에서 "—" 렌더
- b. 음수 결과 (악화) 도 그대로 반환 (방향 표시는 렌더 단계에서 처리)
- c. Math.round 로 정수 %. (예: `-181.77` → `-182`)
- d. Elapsed 단위는 ms 기반 (WorkItem 에 저장 시 sec × 1000), 결과는 % 무단위

---

### (4) 방향 표시 — `ImprovementBadge`

**1. 내용**
- rate 부호에 따라 아이콘·색을 분기해 개선/악화/비교불가를 시각화한다. 재사용 컴포넌트.

**2. 구성**

```tsx
export function ImprovementBadge({ rate, size }: Props) {
 if (rate == null || rate === 0) {
 return <span className="text-text-muted/40">—</span>
 }
 const improved = rate > 0
 return (
 <span className={`${improved ? 'text-success' : 'text-danger-dark'} tabular-nums`}>
 {improved ? '↓' : '↑'}{Math.abs(rate)}%
 </span>
 )
}
```

렌더 규칙:

| rate | 아이콘 | 색상 | 의미 |
|------|--------|------|------|
| > 0 | ↓ or ▼ | text-success (초록) | 개선 |
| < 0 | ↑ or ▲ | text-danger (빨강) | 악화 |
| == 0 · null · undefined | — | text-muted | 비교 불가 |

**3. 동작**
- a. prop 타입 `number | null | undefined` 허용)
- b. null/0 분기를 먼저 처리해 `Math.abs(null)` 등 런타임 오류 방지
- c. 아이콘 문자열은 테마에 따라 `↓/↑` 또는 `▼/▲` (tailwind 클래스로 통일)
- d. 적용 위치: WorkPipeline 목록, WorkDetail/WorkDetailPanel 메트릭, WorkbenchContent, Dashboard, V2WorkPipeline

---

### (5) `同plan` 경고 뱃지

**1. 내용**
- before/after plan_hash 가 동일할 때 (LLM 튜닝이 실제 plan 변화를 만들지 못함) 경고 뱃지를 노출해 수치 신뢰도를 명시한다.

**2. 구성**

표시 조건:
```typescript
const samePlan = row.beforePlanHash && row.afterPlanHash
 && row.beforePlanHash === row.afterPlanHash
```

뱃지 스타일: amber 배경 · `同plan` 라벨 · tooltip "AS-IS/TO-BE 실행계획 해시가 같습니다. 개선 수치는 cache warmup 효과일 수 있습니다."

위치: WorkPipeline `_elapsed_rate` 칼럼 · WorkDetail 상세 Elapsed 섹션 · WorkDetailPanel 메트릭

**3. 동작**
- a. 한쪽이라도 plan_hash 가 null 이면 뱃지 표시 안 함 (판단 불가)
- b. tooltip 으로 운영자에게 plan 미변경 사실 알림
- c. plan 동일 시 totals fallback (2026-04-23) useTotals 조건 ①과 동일 판정 — 뱃지 표시 = useTotals=true 와 동치

---

### (6) 0-coercion 방지

**1. 내용**
- after 미수집 시 undefined 를 0 으로 강제 치환하는 `?? 0` 패턴을 전면 제거한다. 미수집 0-coercion 제거 (2026-04-23) 에서 도입된 중요 방어 규칙.

**2. 구성**

금지 패턴:
```typescript
// ❌ 위험
tunedElapsed: after ? Math.round((after.elapsed_time_sec ?? 0) * 1000) : undefined
<MetricCompareCard tuned={item.tunedElapsed ?? 0} />
Math.round(((fi.originalElapsed - fi.tunedElapsed) / fi.originalElapsed) * 100)
```

대체 패턴:
```typescript
// ✓ 안전
tunedElapsed: after?.elapsed_time_sec != null
 ? Math.round(after.elapsed_time_sec * 1000)
 : undefined
<MetricCompareCard tuned={item.tunedElapsed /* undefined 허용 */} />
fi.tunedElapsed != null && fi.originalElapsed > 0
 ? Math.round(((fi.originalElapsed - fi.tunedElapsed) / fi.originalElapsed) * 100)
 : null
```

**3. 동작**
- a. `undefined` 를 전 파이프라인에 전파 → 렌더 단계에서 "—" 표시
- b. MetricCompareCard · WorkDetail · WorkDetailPanel · WorkbenchContent · CanvasPage 5개 파일 10여 곳 적용
- c. 원본 쪽(originalElapsed/originalBuffers)도 동일 원칙 — `before?.elapsed_time_sec != null ? ... : undefined`
- d. 사유: "N → 0" 산식은 "100% 감소" 로 계산되어 "100% 개선" 오표시를 유발

---

### (7) MetricCompareCard 컴포넌트

**1. 내용**
- WorkDetail 의 Before → After 메트릭 카드. 미수집 0-coercion 제거 (2026-04-23) 에서 undefined 허용하도록 타입 완화.

**2. 구성**

```tsx
function MetricCompareCard({ label, original, tuned, unit, better }: {
 label: string
 original: number | undefined // 미수집 0-coercion 제거 (2026-04-23) 타입 완화
 tuned: number | undefined // 미수집 0-coercion 제거 (2026-04-23) 타입 완화
 unit?: string
 better: 'lower' | 'higher'
}) {
 const hasAfter = tuned != null
 const hasBefore = original != null
 const improved = hasAfter && hasBefore &&
 (better === 'lower' ? tuned < original : tuned > original)
 const rate = hasAfter && hasBefore && original > 0
 ? Math.round(((original - tuned) / original) * 100)
 : null
 return (
 <div>
 <div>Before: {hasBefore ? format(original, unit) : '—'}</div>
 <div>After: {hasAfter ? format(tuned, unit) : '—'}</div>
 {rate != null && rate !== 0 && (
 <span className={improved ? 'text-success' : 'text-danger'}>
 {improved ? '↓' : '↑'}{Math.abs(rate)}%
 </span>
 )}
 </div>
 )
}
```

**3. 동작**
- a. original/tuned 둘 중 하나라도 undefined 면 해당 쪽 "—"
- b. 둘 다 있을 때만 rate 계산·뱃지 렌더
- c. better='lower' — elapsed/buffers 등 낮을수록 좋은 지표
- d. better='higher' — hit_ratio 등 높을수록 좋은 지표 (현재 V1 미사용)

---

### (7-A) 계산 주체 단일화 — 백엔드 `improvement_pct` 를 primary source 로 (4/24)

**1. 내용**
- 과거 프런트 자체 계산(per-exec 정규화 / useTotals 조건 분기)이 Xplan 전환 이후 `executions_count=Starts` 재시도·nested loop 값을 분할해 왜곡 발생. 계산 주체를 백엔드 단일화로 변경해 신뢰성 확정.

**2. 구성**
```typescript
// 개선률 산출 — backend improvement_pct 가 primary
export const calcElapsedRate = (row: WorkItem): number | null => {
  // 1순위: 백엔드 계산값
  if (row.improvementRate != null) {
    return Math.round(row.improvementRate * 100)
  }
  // 2순위: totals 단순 계산 (백엔드 값 없을 때)
  if (row.originalElapsed != null && row.tunedElapsed != null
      && row.originalElapsed > 0) {
    return Math.round((row.originalElapsed - row.tunedElapsed)
                      / row.originalElapsed * 100)
  }
  return null
}
```

- `perExec()` · `useTotals()` · `isSamePlan()` 헬퍼 모두 제거
- Buffers rate 도 totals 단순 계산만 사용

**3. 동작**
- 프런트 개선률 값이 백엔드 `improvement_pct` 와 항상 1:1 일치
- 재시도·nested loop 로 executions 편향되는 케이스에 왜곡 없음
- plan_hash 동일 분기 로직·뱃지 모두 제거됨

---

### (8) 렌더 매핑 — 백엔드 응답 → WorkItem

**1. 내용**
- API 응답을 WorkItem 타입으로 변환하는 매퍼. `mapBackendSummaryToWorkItem()` 이 한 곳 — snake_case 를 camelCase 로, 단위 변환.

**2. 구성**

```typescript
function mapBackendSummaryToWorkItem(s: BackendSummary): WorkItem {
 return {
 id: `BE-${s.request_id}`,
 sqlId: s.asis_sql_id ?? '',
 sourceSqlKey: s.asis_sql_id ?? '',
 parentRequestId: s.parent_request_id ?? undefined,
 instanceId: s.instance_id,
 instanceName: s.instance_name ?? '',
 // 단위 변환: sec → ms (UI 내부는 ms 기준)
 originalElapsed: s.before_elapsed_sec != null
 ? Math.round(s.before_elapsed_sec * 1000) : undefined,
 tunedElapsed: s.after_elapsed_sec != null
 ? Math.round(s.after_elapsed_sec * 1000) : undefined,
 originalBuffers: s.before_buffer_gets ?? undefined,
 tunedBuffers: s.after_buffer_gets ?? undefined,
 beforeExecutions: s.before_executions ?? undefined,
 afterExecutions: s.after_executions ?? undefined,
 beforePlanHash: s.before_plan_hash ?? undefined,
 afterPlanHash: s.after_plan_hash ?? undefined,
 status: s.status,
 requestedAt: s.requested_at,
 alias: s.alias ?? undefined,
 // ...
 }
}
```

**3. 동작**
- a. undefined 전파 원칙 적용 (0-coercion 없음)
- b. Elapsed 는 UI 내부에서 ms 단위 (sec × 1000, Math.round 로 정수화)
- c. Buffers 는 Count 단위 그대로
- d. plan_hash / executions 는 plan_hash 추출·목록 API 확장 (2026-04-23) 이후 API 에서 제공

---

### (9) 조건분기 (렌더 시)

| 조건 | 표시 |
|------|------|
| before/after 모두 값 있음 + plan 다름 | per-exec 정규화 %, ↓↑ 방향, 초록/빨강 |
| before/after 모두 값 있음 + plan 동일 | totals % + `同plan` amber 뱃지 |
| before/after 모두 값 있음 + executions 비율 > 5 | totals % (executions 오염 경고 간접 표시) |
| tuned(after) undefined | "—" · rate null · 뱃지 표시 안 함 |
| original(before) undefined | "—" · rate null |
| before = 0 | rate null (division guard) |
| rate = 0 | "—" (변동 없음) |
| status IN ('pending','tuning') | 메트릭 셀 전부 "—" (아직 결과 없음) |

---

## 소스 반영 필요 항목

### 추가
- * `src/lib/improvement.ts` — useTotals / calcElapsedRate / calcBuffersRate / perExec 공용 util)
- * `before_plan_hash` / `after_plan_hash` / `before_executions` / `after_executions` 필드를 BackendSummary 타입에 추가)
- * `同plan` amber 뱃지 — WorkPipeline `_elapsed_rate` 칼럼 우측)
- * `ImprovementBadge` prop 타입을 `number | null | undefined` 로 완화)

### 변경
- * `Math.abs(rate)` + 하드코딩 `↓` + `text-success` 고정 패턴을 rate 부호 기반 분기로 교체)
- * `(after.elapsed_time_sec ?? 0) * 1000` 같은 0-coercion 을 `!= null` 가드로 대체)
- * WorkDetailPanel / WorkbenchContent / Dashboard / V2WorkPipeline 4곳의 개선률 렌더에 방향 분기 적용)
- * per-exec 단순 나누기를 useTotals 조건 분기로 변경)

