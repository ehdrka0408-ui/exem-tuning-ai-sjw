# 튜닝 요청 흐름 — 즉시 vs 예약

> 작성: 2026-04-09
> 관련 파일: `src/mocks/newItemsStore.ts`, `src/contexts/QueueContext.tsx`, `src/components/common/TuningRequestDialog.tsx`, `src/components/common/DirectInputForm.tsx`, `src/pages/candidates/AnomalyDetection.tsx`, `src/pages/candidates/TopSql.tsx`

## 1. 핵심 모델

**작업함에 들어간다 ≡ 실행큐에 들어간다 ≡ 튜닝이 시작된다**

- **즉시 요청**: `workItems` 에 `status: 'pending'` 으로 즉시 등록 → 작업함에 노출, AI 실행큐에 곧바로 진입
- **예약 요청**: `workItems` 에 **들어가지 않음**. AI 실행 패널 > "1회 예약" 탭에만 표시. 예약 시각이 도래하면 그때 작업함으로 이동(= 실행큐 진입)

즉, "예약"은 작업함 진입 시점을 예고하는 메타데이터이지, 작업 자체가 아니다. 예약 시각 전까지는 어떤 워커도 해당 건을 건드리지 않아야 하며, 작업함/파이프라인 어디에도 나타나지 않아야 한다.

## 2. 데이터 경로

| 경로 | 즉시 | 예약 |
|------|------|------|
| 등록 API (mock) | `addNewWorkItem()` | `QueueContext.addScheduledRequest()` |
| 저장 위치 | `newItemsStore.v1Items` / `v2Items` | `QueueContext.oneTime` |
| 초기 상태 | `status: 'pending'` | n/a (별도 구조체 `OneTimeSchedule`) |
| 작업함 노출 | 즉시 노출 | 예약 시각 도래 후 노출 (현재 mock 미구현) |
| AI 실행 패널 | "실행 큐" 탭 | "1회 예약" 탭 |

### 2.1 `addNewWorkItem` 시그니처 (즉시 전용)

```ts
addNewWorkItem(opts: {
  sqlId: string
  sqlText: string
  instanceName: string
  schemaName: string
  source: WorkItem['source']
  executionContext?: 'OLTP' | 'Batch'
  estimatedDailyExec?: number
  selectionSource?: 'auto' | 'manual'
  queryTimeoutSec?: number
  scheduledAt?: string // 시그니처 호환성 유지용 — mock 파이프라인에서는 무시됨
}): { v1Id: string; v2Id: string }
```

- `scheduledAt` 파라미터는 내부에서 `void` 처리되어 사용하지 않음. 호출부는 즉시건에만 `addNewWorkItem` 을 사용해야 한다.
- 항상 `status: 'pending'` 으로 등록된다.

### 2.2 `addScheduledRequest` 시그니처 (예약 전용)

```ts
addScheduledRequest(opts: {
  label: string
  instance: string
  instanceType: 'production' | 'dev'
  sqlCount: number
  scheduledAt: string // ISO
}): OneTimeSchedule
```

- `QueueContext` 에서 제공.
- `oneTime` 배열 선두에 추가 → AI 실행 패널 > 1회 예약 탭에 즉시 반영.
- **`workItems` / `newItemsStore` 에는 일체 기록하지 않음.**

## 3. 요청 진입점별 포스트 액션 (통일)

모든 튜닝 요청 진입점(DirectInput / AnomalyDetection / TopSql 단건·일괄)은 다이얼로그 제출 후 아래 규칙을 따른다.

### 3.1 즉시 요청 (`opts.scheduledAt` 없음)

1. `addNewWorkItem()` 호출
2. 다이얼로그 닫기 + 로컬 상태 초기화
3. 성공 토스트 + 액션 버튼 **"작업함 보기 →"**
   - 클릭 시: 호출자 화면의 네비게이션 핸들러 실행 (예: `/work?highlightItemId=...`)
4. **자동 네비게이션 금지** — 사용자가 토스트 버튼을 눌러야 작업함으로 이동

### 3.2 예약 요청 (`opts.scheduledAt` 존재)

1. `addScheduledRequest()` 호출
2. 다이얼로그 닫기 + 로컬 상태 초기화
3. 성공 토스트 + 액션 버튼 **"예약 탭 열기 →"**
   - 클릭 시: `QueueContext.setActiveTab('schedule')` + `QueueContext.openPanel('slide')`
4. **작업함으로 이동하지 않음** — 예약건은 작업함에 존재하지 않기 때문

## 4. 구현 세부

### 4.1 Toast 컴포넌트 확장

`src/components/common/Toast.tsx` 의 `ToastData` 에 `action?: { label, onClick }` 필드 추가. `ToastContainer` 는 이 버튼을 메시지 우측에 렌더하며, 클릭 시 `onClick` 실행 후 토스트를 즉시 제거한다.

```ts
interface ToastData {
  id: string
  message: string
  variant?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  action?: { label: string; onClick: () => void }
}
```

### 4.2 네임 충돌 주의

`TopSql.tsx` 는 자체 소스 탭 상태(`activeTab`, `setActiveTab`)를 가지고 있으므로 QueueContext 의 `setActiveTab` 을 구조분해할 때 반드시 별칭을 사용한다.

```ts
const { addScheduledRequest, openPanel, setActiveTab: setQueueTab } = useQueue()
```

### 4.3 `WorkPipeline` 필터와의 관계

`src/pages/work/WorkPipeline.tsx` 의 기본 필터는 `status !== 'scheduled'` 항목만 노출한다. 예약건이 `workItems` 에 들어가지 않으므로 이 필터는 현재 모델에서 중복 방어지만, 레거시 `scheduled` 상태를 사용하던 mock 데이터 호환을 위해 유지한다.

## 5. 테스트 체크리스트

- [ ] 즉시 요청 → 작업함에 즉시 등록, 토스트의 "작업함 보기 →" 클릭 시에만 이동
- [ ] 예약 요청 → 작업함에 **존재하지 않음**
- [ ] 예약 요청 → AI 실행 패널 > 1회 예약 탭에 새 항목 노출
- [ ] 예약 요청 토스트의 "예약 탭 열기 →" 클릭 시 슬라이드 패널 + 예약 탭 활성화
- [ ] DirectInput / TopSql 단건 / TopSql 일괄 / AnomalyDetection 모두 동일한 포스트 액션 동작
- [ ] `scheduledAt` 유무로만 분기되어야 하며, 진입점별 분기 로직이 따로 존재하면 안 됨

## 6. 향후 과제

- **예약 시각 도래 → 작업함 이동**: 현재 mock 에는 없음. 백엔드 연동 시 스케줄러가 `addNewWorkItem` 과 동등한 경로로 `workItems` 에 주입해야 함.
- **예약 취소**: 1회 예약 탭에서 삭제 시 `oneTime` 에서만 제거하면 충분 (workItems 조회 불필요).
- **예약 → 즉시 전환**: 사용자가 "지금 실행"을 누르면 `runScheduleNow()` 가 해당 예약을 제거하고 `workItems` 에 주입해야 함.

## 7. 재튜닝 계보 (parent_request_id) — 2026-04-23 추가

### 7.1 원칙

재튜닝은 **독립된 새 `tuning_requests` 레코드**를 생성하되, 원본 요청과의 계보는 `parent_request_id` 컬럼으로 이어져야 한다.

- 최초 요청: `parent_request_id = NULL`
- 재튜닝 요청(N차): `parent_request_id = <원본 request_id>` (또는 체인 중간 노드의 id)
- 한 SQL에 대한 재튜닝 N차가 반복되어도 **체인의 뿌리는 하나**가 되어야 통계/감사/재현이 가능하다.

### 7.2 백엔드 계약 (이미 구현됨)

- 엔드포인트: `POST /api/tuning/requests`
- 요청 모델 필드: `parent_request_id: Optional[str]` (`backend/app/api/tuning_requests.py:64`)
- INSERT 반영: `tuning_requests.py:392, 397` — 전달값 그대로 DB 저장
- 전달하지 않으면 `NULL` 로 저장

### 7.3 프론트엔드 호출부 (반드시 전달)

재튜닝 경로는 다음 **2곳**. 모두 `requestTuning()` 호출 시 `parent_request_id` 를 명시해야 한다.

| 위치 | 라인 (2026-04-23 기준) | 설명 |
|------|------------------------|------|
| `src/pages/work/WorkPipeline.tsx` | 871 | 단일 재튜닝 (`handleRetune`) |
| `src/pages/work/WorkPipeline.tsx` | 1002 | 일괄 재튜닝 |

두 지점 모두 스코프에 `numericId`(원본 request_id) 가 이미 존재하므로 그대로 넘기면 된다.

```ts
await requestTuning({
  sql_text: d.source_sql_text,
  // ... 기존 필드들
  alias: newAlias,
  parent_request_id: numericId,   // ← 원본 request_id
})
```

### 7.4 `WorkDetail.tsx` 의 재튜닝 모달은 mock

`src/pages/work/WorkDetail.tsx` 의 `confirmRetune`(line 1227) 은 현재 status 를 `'pending'` 으로 전이만 할 뿐 백엔드 호출을 수행하지 않는 **mock 전용**이다. 실연동 전환 시 위 7.3 규칙을 반드시 준수할 것.

### 7.5 계보 조회

자손 트리는 백엔드에 이미 재귀 쿼리로 구현되어 있다 (`tuning_requests.py:634` 부근 `WITH RECURSIVE descendants ... JOIN descendants d ON tr.parent_request_id = d.request_id`). 삭제 시에는 `parent_request_id = ANY(:ids)` 로 자손의 부모 참조를 NULL 처리(line 661~) 하여 고아 레코드를 허용하는 정책을 쓰고 있다.

### 7.6 과거 잔여 NULL 데이터

2026-04-23 이전에 생성된 재튜닝 요청들(예: `alias = 'bindsql_1_재튜닝(1)'` 의 request_id=56)은 프론트 버그로 인해 `parent_request_id = NULL` 로 남아있다. 이들은 alias 패턴(`_재튜닝(N)`) 으로는 재튜닝임이 식별되지만 체인은 끊어져 있다. 필요 시 별도 백필 마이그레이션을 고려한다.
