# SQL Tuning AI Console — 기획명세서

> **문서 버전:** 1.0
> **작성일:** 2026-03-27
> **대상:** 개발팀 (프론트엔드 + 백엔드)
> **현재 상태:** 프론트엔드 프로토타입 완료 (Mock 데이터 기반), 백엔드 API 연동 전

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [시스템 아키텍처](#3-시스템-아키텍처)
4. [데이터 모델](#4-데이터-모델)
5. [상태 흐름 (Status Flow)](#5-상태-흐름-status-flow)
6. [라우트 맵](#6-라우트-맵)
7. [화면 명세](#7-화면-명세)
8. [공유 컴포넌트](#8-공유-컴포넌트)
9. [핵심 사용자 흐름 (User Flows)](#9-핵심-사용자-흐름-user-flows)
10. [V1 vs V2 차이점](#10-v1-vs-v2-차이점)
11. [백엔드 API 요구사항](#11-백엔드-api-요구사항)
12. [구현 현황 및 TODO](#12-구현-현황-및-todo)

---

## 1. 프로젝트 개요

### 1.1 목적

Oracle DB 환경에서 SQL 성능 문제를 **자동 탐지 → AI 튜닝 → 검증 → 반영**까지 end-to-end로 수행하는 콘솔 시스템.

### 1.2 핵심 가치

| 가치 | 설명 |
|------|------|
| **자동화** | 성능 이상 SQL 자동 탐지, AI 기반 튜닝안 자동 생성 |
| **추적성** | 모든 튜닝 작업의 상태 이력을 추적 (pending → applied) |
| **검증** | 튜닝안 적용 전 실행계획 비교 검증, 적용 후 실측 모니터링 |
| **협업** | DBA 팀의 검증/승인 워크플로우 지원 |

### 1.3 대상 사용자

- **DBA (주 사용자):** 튜닝 대상 확인, 튜닝안 검증/승인, 반영 관리
- **개발자:** 개발 단계 SQL 사전 검증, 직접 튜닝 요청
- **운영팀:** 적용 후 효과 모니터링, 재튜닝 판단

---

## 2. 기술 스택

### 2.1 프론트엔드 (현재 구현 완료)

| 항목 | 기술 | 버전 |
|------|------|------|
| Framework | React | 19.2.4 |
| Language | TypeScript | 5.9.3 |
| Router | react-router-dom | 7.13.2 |
| Build | Vite | 8.0.1 |
| Styling | Tailwind CSS | 4.2.2 |
| Chart | Recharts | 3.8.0 |
| Icons | lucide-react | 1.0.1 |
| Linting | ESLint | 9.39.4 |

### 2.2 백엔드 (개발 필요)

> 프론트엔드가 Mock 데이터 기반으로 완성되어 있으므로, 백엔드는 Mock 인터페이스를 그대로 API로 구현하면 됨.

### 2.3 빌드 & 실행

```bash
npm run dev      # 개발 서버 (Vite)
npm run build    # 프로덕션 빌드
npm run preview  # 빌드 결과 미리보기
npm run lint     # 코드 검사
```

---

## 3. 시스템 아키텍처

### 3.1 디렉토리 구조

```
src/
├── components/
│   ├── common/          # 공유 UI 컴포넌트 (DataTable, Badge, PlanCompare 등)
│   └── layout/          # 레이아웃 (AppLayout, Sidebar, TopBar)
├── mocks/               # Mock 데이터 (→ 향후 API 호출로 대체)
│   ├── workItems.ts     # V1 작업 아이템
│   ├── v2WorkItems.ts   # V2 작업 아이템
│   ├── recommendations.ts  # 튜닝 추천안
│   ├── executionValidation.ts  # 실행 검증 결과
│   ├── anomalyData.ts   # 이상 실행 데이터
│   ├── planChanges.ts   # 플랜 변경 감지 데이터
│   ├── newItemsStore.ts # 세션 스토어 (신규 아이템)
│   ├── dashboard.ts     # 대시보드 메트릭
│   ├── candidates.ts    # Top SQL 후보 데이터
│   └── ...
├── pages/
│   ├── Dashboard.tsx     # 메인 대시보드
│   ├── Login.tsx         # 로그인 (미구현)
│   ├── candidates/       # 튜닝 대상 선정 화면 (5개)
│   ├── work/             # V1 튜닝 작업 화면
│   ├── v2/               # V2 기획 비교 화면
│   └── ops/              # 운영 관리 화면
└── App.tsx               # 라우트 정의
```

### 3.2 상태 관리

| 방식 | 범위 | 용도 |
|------|------|------|
| `useState` | 컴포넌트 | 필터, 뷰 모드, 선택 상태, 모달 등 |
| `useSearchParams` | URL | 탭, 프리셋, 컨텍스트 전달 |
| `useParams` | URL | 작업 상세 ID |
| Session Store (`newItemsStore.ts`) | 모듈 레벨 | 후보 화면 → 파이프라인 간 신규 아이템 전달 |

> **향후:** 백엔드 연동 시 React Query 또는 SWR 도입 권장

### 3.3 네비게이션 구조

```
AppLayout (Sidebar + TopBar + Outlet)
├── 현황
│   └── 대시보드 (/)
├── 튜닝대상선정
│   ├── Top SQL (/candidates/top)
│   ├── 이상 실행 탐색 (/candidates/anomaly)
│   ├── 플랜 변경 감지 (/candidates/plan-change)
│   ├── 개발 SQL 검증 (/candidates/dev-verify)
│   └── 직접 지정 (/candidates/direct)
├── 튜닝작업
│   ├── 작업 파이프라인 (/work)
│   ├── 승인 큐 (/work/approval)
│   └── 작업 상세 (/work/:id)
├── 운영관리
│   ├── 운영 효과 (/ops/impact)
│   ├── 자동 튜닝 정책 (/ops/policy)
│   ├── 연동 설정 (/ops/integration)
│   └── 사용자/권한 (/ops/users)
└── V2 기획 비교
    ├── V2 대시보드 (/v2)
    ├── V2 작업 파이프라인 (/v2/work)
    └── V2 작업 상세 (/v2/work/:id)
```

---

## 4. 데이터 모델

### 4.1 WorkItem (V1 작업 아이템)

> 파일: `src/mocks/workItems.ts`

```typescript
interface WorkItem {
  // === 식별 ===
  id: string                    // 예: "WI-2024-001"
  sqlId: string                 // Oracle SQL_ID (13자 영숫자)
  sqlText: string               // SQL 전문
  batchId: string               // 배치 그룹 ID
  batchMemo?: string            // 배치 메모

  // === 상태 ===
  status: 'pending' | 'tuning' | 'tuned' | 'verified'
        | 'tuning_impossible' | 'applied' | 'retune_requested'
  type: 'tuning' | 'verification'
  selectionSource: 'auto' | 'manual'   // 자동선정 / 수동선정

  // === 할당 ===
  assignee: string              // 담당 DBA
  createdAt: string             // ISO datetime
  updatedAt: string

  // === 대상 DB ===
  instanceName: string          // Oracle 인스턴스명
  schemaName: string            // 스키마명
  source: 'maxgauge' | 'awr' | 'v$sql'  // 수집 소스

  // === 성능 지표 ===
  workName: string              // AI 자동 생성 작업명
  originalElapsed: number       // 원본 elapsed (ms)
  originalBuffers: number       // 원본 buffer gets
  tunedElapsed?: number         // 튜닝 후 elapsed
  tunedBuffers?: number         // 튜닝 후 buffers
  improvementRate?: number      // 개선율 (%)

  // === 튜닝 정보 ===
  recommendationType?: 'rewrite' | 'hint' | 'index' | 'plan_restore'
  recommendationTypes?: ('index' | 'hint' | 'rewrite')[]
  verifyType?: 'actual' | 'estimated'
  executionContext?: 'OLTP' | 'Batch'
  estimatedDailyExec?: number   // 일 추정 실행 횟수
  queuePosition?: number        // pending 대기열 순서
  analysisStep?: 'sql_analysis' | 'plan_collection' | 'plan_generation' | 'verification'

  // === 검증/반영 이력 ===
  verifiedBy?: string
  verifiedAt?: string
  impossibleBy?: string
  impossibleAt?: string
  impossibleReason?: string
  appliedAt?: string
  retuneRequestedBy?: string
  retuneRequestedAt?: string
  retuneConditions?: string[]
  retuneReason?: string

  // === 운영 실측 ===
  operationalElapsed?: number
  operationalBuffers?: number
  operationalResult?: 'improved' | 'degraded' | 'monitoring'
  operationalMeasuredAt?: string
}
```

### 4.2 V2WorkItem (V2 작업 아이템)

> 파일: `src/mocks/v2WorkItems.ts`

V1과 대부분 동일하나 다음이 다름:

```typescript
type V2Status = 'pending' | 'tuning' | 'tuned' | 'verified'
              | 'applied' | 'retune_requested' | 'tuning_impossible'

interface V2WorkItem {
  // ...V1과 동일한 필드들...

  // V2 고유 필드
  analysisStep?: 'structure' | 'plan_collection' | 'comparison' | 'recommendation'
  analysisEstimatedRemaining?: number  // 남은 시간(초)
  appliedBy?: string                   // 적용 담당자
}
```

**상태 레이블 & 색상:**

| Status | 레이블 | 색상 |
|--------|--------|------|
| pending | 튜닝예정 | gray |
| tuning | 튜닝중 | amber |
| tuned | 튜닝완료 | indigo |
| verified | 검증완료 | blue |
| applied | 적용됨 | green |
| retune_requested | 재튜닝 | purple |
| tuning_impossible | 튜닝불가 | red |

### 4.3 TuningPlan & WorkRecommendation (튜닝 추천안)

> 파일: `src/mocks/recommendations.ts`

```typescript
type TuningType = 'index' | 'hint' | 'rewrite'
type VerifyType = 'actual' | 'estimated'

interface TuningPlan {
  id: string              // 예: "WI-2024-004-A"
  label: string           // "튜닝안 A"
  types: TuningType[]     // 적용된 튜닝 유형들
  verifyType: VerifyType  // 검증 방식
  improvementRate: number // 개선율 (음수 = 개선)
  summary: string         // 튜닝 내용 요약

  // Before/After 메트릭
  originalElapsed: number
  tunedElapsed: number
  originalBuffers: number
  tunedBuffers: number
  originalDiskReads: number
  tunedDiskReads: number

  // 실행계획 텍스트
  originalPlanText: string
  tunedPlanText: string

  // 선택적
  tunedSqlText?: string   // 변환된 SQL (rewrite인 경우)
  indexDdl?: string        // 인덱스 DDL (index인 경우)
}

interface WorkRecommendation {
  workItemId: string
  selectedPlanId: string  // AI가 추천한 안
  plans: TuningPlan[]     // 복수 튜닝안 (보통 2~3개)
}

// Key: workItemId → WorkRecommendation
const workRecommendations: Record<string, WorkRecommendation>
```

### 4.4 ExecutionValidation (실행 검증)

> 파일: `src/mocks/executionValidation.ts`

```typescript
interface ExecutionValidation {
  id: string
  workItemId: string
  sqlId: string

  // Before/After 실행계획
  originalPlanText: string
  tunedPlanText: string

  // Before/After 메트릭
  originalElapsed: number
  tunedElapsed: number
  originalBuffers: number
  tunedBuffers: number
  originalRows: number
  tunedRows: number
  originalDiskReads: number
  tunedDiskReads: number

  // 검증 결과
  validatedAt: string
  validatedBy: string
  result: 'improved' | 'degraded' | 'neutral'
  recommendationType: 'rewrite' | 'hint' | 'index' | 'plan_restore'
  changeDescription: string
  tunedSqlText?: string
}

interface BindVariable {
  name: string
  type: string
  value: string
  status: 'available' | 'sample_only' | 'unknown'
}

interface WorkBindInfo {
  workItemId: string
  bindSensitive: boolean
  variables: BindVariable[]
}
```

### 4.5 AnomalyPoint (이상 실행 데이터)

> 파일: `src/mocks/anomalyData.ts`

```typescript
type SqlType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'

interface AnomalyPoint {
  id: string
  timestamp: string     // ISO datetime
  sqlId: string
  elapsed: number       // ms
  buffers: number
  waitEvent: string     // Oracle wait event
  schemaName: string
  sqlType: SqlType
  sqlText: string
}
```

### 4.6 PlanChangeItem (실행계획 변경)

> 파일: `src/mocks/planChanges.ts`

```typescript
type PlanChangeImpact = 'degraded' | 'improved' | 'neutral'

interface PlanChangeItem {
  id: string
  sqlId: string
  schema: string
  instanceName: string
  prevPlanHash: string
  currPlanHash: string
  prevElapsed: number     // ms
  currElapsed: number     // ms
  changeRate: number      // % (양수=악화, 음수=개선)
  detectedAt: string
  impact: PlanChangeImpact
  sqlText: string
  prevPlan: string        // 이전 실행계획 텍스트
  currPlan: string        // 현재 실행계획 텍스트
  planHistory: { time: string; elapsed: number; planHash: string }[]
  spmFixed: boolean       // SPM 고정 여부
  tuningRequested: boolean
}
```

### 4.7 ExplainPlanResult (실행계획 결과)

> 파일: `src/mocks/explainPlan.ts`

```typescript
interface ExplainPlanResult {
  planText: string
  cost: number
  rows: number
  warnings: { level: 'warning' | 'danger'; message: string }[]
}
```

### 4.8 Session Store (신규 아이템 스토어)

> 파일: `src/mocks/newItemsStore.ts`, `src/contexts/QueueContext.tsx`
> 상세: [`tuning-request-flow.md`](./tuning-request-flow.md)

**핵심 원칙**: 작업함(=`workItems`) 진입 ≡ 실행큐 진입 ≡ 튜닝 시작.
- **즉시 요청** → `addNewWorkItem()` → `workItems` 에 `status: 'pending'` 으로 즉시 등록
- **예약 요청** → `QueueContext.addScheduledRequest()` → `oneTime` 배열에만 추가, `workItems` 에 **들어가지 않음**
  - 예약 시각이 도래해야 작업함으로 이동 (mock 미구현, 백엔드 연동 과제)

```typescript
// 즉시 튜닝 요청 전용 — 항상 status='pending'으로 등록
function addNewWorkItem(params: {
  sqlId: string
  sqlText: string
  instanceName: string
  schemaName: string
  source: string
  executionContext?: 'OLTP' | 'Batch'
  estimatedDailyExec?: number
  selectionSource?: 'auto' | 'manual'
  queryTimeoutSec?: number
  // scheduledAt 은 시그니처 호환성 유지용 (내부에서 무시됨)
}): { v1Id: string; v2Id: string }

function getNewV1Items(): WorkItem[]
function getNewV2Items(): V2WorkItem[]

// 예약 튜닝 요청 전용 — workItems 에 넣지 않고 oneTime 예약 목록에만 추가
// QueueContext 에서 제공
function addScheduledRequest(params: {
  label: string
  instance: string
  instanceType: 'production' | 'dev'
  sqlCount: number
  scheduledAt: string // ISO
}): OneTimeSchedule
```

**포스트 액션 (모든 진입점 통일)**
- 즉시: 토스트 + "작업함 보기 →" 버튼 (자동 네비게이션 금지)
- 예약: 토스트 + "예약 탭 열기 →" 버튼 → `openPanel('slide') + setActiveTab('schedule')`

---

## 5. 상태 흐름 (Status Flow)

### 5.1 정상 흐름

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ pending  │───▶│ tuning   │───▶│  tuned   │───▶│ verified │───▶│ applied  │
│ (대기열) │    │ (AI분석) │    │(튜닝완료)│    │(검증완료)│    │ (적용됨) │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
   2초 대기       3초 분석         DBA 검증        DBA 적용        실측 모니터링
```

### 5.2 분기 흐름

```
tuned ──────▶ tuning_impossible    (DBA가 "튜닝 불가" 판정, 사유 기록)

applied ────▶ retune_requested     (실측 성능 저하 시 재튜닝 요청)
                    │
                    ▼
                 pending ──▶ tuning ──▶ ...  (다시 정상 흐름)
```

### 5.3 상태별 필수 데이터

| 상태 | 필수 필드 |
|------|-----------|
| pending | queuePosition |
| tuning | analysisStep |
| tuned | tunedElapsed, tunedBuffers, improvementRate, recommendationType |
| verified | verifiedBy, verifiedAt |
| applied | appliedAt (V2: appliedBy) |
| tuning_impossible | impossibleBy, impossibleAt, impossibleReason |
| retune_requested | retuneRequestedBy, retuneRequestedAt, retuneReason |

### 5.4 자동 전환 (프론트엔드 Mock)

현재 프론트엔드에서 자동 시뮬레이션:
- **pending → tuning:** 2초 후 자동 전환
- **tuning → tuned:** 3초 후 자동 전환 + 튜닝 결과 데이터 생성

> 백엔드 연동 시: polling 또는 WebSocket으로 상태 변화 감지

---

## 6. 라우트 맵

| 경로 | 컴포넌트 | 설명 | 구현 상태 |
|------|----------|------|-----------|
| `/` | Dashboard | 메인 대시보드 | ✅ 완료 |
| `/login` | Login | 로그인 | ⬜ 미구현 |
| `/candidates/top` | TopSql | Top SQL 분석 | ✅ 완료 |
| `/candidates/anomaly` | AnomalyDetection | 이상 실행 탐색 | ✅ 완료 |
| `/candidates/plan-change` | PlanChange | 플랜 변경 감지 | ✅ 완료 |
| `/candidates/dev-verify` | DevVerify | 개발 SQL 검증 | ✅ 완료 |
| `/candidates/direct` | DirectInput | 직접 SQL 지정 | ✅ 완료 |
| `/work` | WorkPipeline | 작업 파이프라인 | ✅ 완료 |
| `/work/approval` | ApprovalQueue | 승인 큐 | ✅ 완료 |
| `/work/:id` | WorkDetail | 작업 상세 | ✅ 완료 |
| `/ops/impact` | OpsImpact | 운영 효과 | ⬜ 미구현 |
| `/ops/policy` | PolicyManagement | 자동 튜닝 정책 | ⬜ 미구현 |
| `/ops/integration` | IntegrationSettings | 연동 설정 | ⬜ 미구현 |
| `/ops/users` | UserManagement | 사용자 관리 | ⬜ 미구현 |
| `/v2` | V2Dashboard | V2 대시보드 | ✅ 완료 |
| `/v2/work` | V2WorkPipeline | V2 작업 파이프라인 | ✅ 완료 |
| `/v2/work/:id` | V2WorkDetail | V2 작업 상세 | ✅ 완료 |

---

## 7. 화면 명세

### 7.1 대시보드 (`/`)

**목적:** 오늘의 SQL 튜닝 현황 한눈에 보기

**구성 요소:**

| 영역 | 내용 |
|------|------|
| 시스템 알림 | 위험/경고 레벨 알림 배너 (클릭 시 상세 이동) |
| 자동 튜닝 결과 | 오늘의 자동 선정 + 튜닝 결과 요약 카드 |
| 상태 분포 메트릭 | pending/tuning/tuned/verified/applied 건수 카드 |
| 일별 추세 | ComposedChart: 건수 bar + 개선율 line (7일) |
| 할 일 목록 | 수동 검증 필요, 추천 확인, 플랜 변경 감지 건 |
| 다음 스케줄 | 다음 자동 분석 예정 시간 |

**데이터 소스:** `src/mocks/dashboard.ts`

---

### 7.2 Top SQL (`/candidates/top`)

**목적:** 성능 상위 SQL을 지표 기준으로 조회하여 튜닝 대상 선정

**레이아웃:** 전체 너비 테이블 + 우측 슬라이드 패널

**주요 기능:**

1. **데이터 소스 탭:** maxgauge / awr / v$sql
2. **필터:**
   - 인스턴스 (멀티 셀렉트)
   - 스키마 (멀티 셀렉트)
   - 모듈 (멀티 셀렉트)
   - PropertyFilter 토큰 (지표/연산자/값 조합)
3. **정렬 기준:** elapsed, cpuTime, logicalReads, physicalReads, executions
4. **값 모드:** 합계(total) / 평균(avg) 토글
5. **뷰 모드:** 카드 / 리스트 토글

**테이블 컬럼:**
- SQL_ID, SQL 텍스트 (truncated), Elapsed, CPU Time, Logical Reads, Physical Reads, Executions

**슬라이드 패널 (행 클릭 시):**
- SQL 전문 + 복사 버튼
- 지표 상세 (elapsed, cpu, logical/physical reads, executions)
- 7일 트렌드 차트 (AreaChart)
- "작업 추가" 버튼 → `addNewWorkItem()` 호출

> **제약:** 지표 기준별 개별 조회 필요 (5개 동시 불가, 고객사에 따라 1분/기준 소요)

---

### 7.3 이상 실행 탐색 (`/candidates/anomaly`)

**목적:** 성능 이상치 SQL을 산점도에서 시각적으로 탐지

**레이아웃:** 상단 필터 + 중앙 차트 + 하단 선택 요약

**주요 기능:**

1. **시간 범위:** 1시간 / 6시간 / 24시간
2. **필터:** 인스턴스, Wait Event, 스키마
3. **산점도 (ScatterChart):**
   - X축: 시간 (분 단위)
   - Y축: Elapsed (ms)
   - 버블 크기: Buffer Gets
   - 색상: Wait Event 별
   - 임계값 영역 표시 (ReferenceArea)
4. **드래그 선택:** 차트 위에서 영역 드래그 → 해당 포인트 선택

**선택 요약 패널:**
- 선택된 포인트 수
- 영향받는 SQL_ID 목록
- DML vs SELECT 분포
- SQL_ID별 최대 elapsed

**액션:**
- 일괄 작업 추가 → `addNewWorkItem()` (각 SQL_ID별)
- 개별 튜닝 요청

---

### 7.4 플랜 변경 감지 (`/candidates/plan-change`)

**목적:** 실행계획 변경으로 인한 성능 저하 탐지 및 대응

**레이아웃:** 좌측 리스트 + 우측 슬라이드 패널

**주요 기능:**

1. **필터:** 영향도 (전체/악화/개선), 인스턴스, 스키마
2. **리스트:**
   - 변경률(%) 내림차순 정렬
   - Impact 뱃지 (red=악화, green=개선, gray=중립)
   - 이전/현재 elapsed
   - 7일 플랜 해시 이력 미니 차트

**슬라이드 패널:**
- PlanCompare: Before/After 실행계획 비교
- Plan Hash 타임라인 (LineChart)
- 변경률, 이전/현재 elapsed
- 액션:
  - "SPM으로 이전 플랜 고정" (SPM 지원 시)
  - "튜닝 요청" → `addNewWorkItem()`

---

### 7.5 개발 SQL 검증 (`/candidates/dev-verify`)

**목적:** 개발 단계 SQL의 실행계획 사전 검증

**레이아웃:** 60:40 분할 (좌: 입력 / 우: 결과)

**좌측 패널 (SQL 입력):**
- SQL 입력 텍스트 영역
- 인스턴스/스키마/실행 컨텍스트 선택
- 일 추정 실행 횟수 입력
- 바인드 변수 자동 감지 (`:VAR` 패턴)
  - 바인드 값 입력 필드 자동 생성
  - Bind Sensitive 플래그
- DML 감지 시 경고 표시
- "실행계획 확인" 버튼

**우측 패널 (결과):**
- 실행계획 텍스트
- 경고 목록 (danger/warning 레벨)
- Cost & Rows 추정값
- "튜닝 요청" 버튼 → `addNewWorkItem()`

---

### 7.6 직접 지정 (`/candidates/direct`)

**목적:** SQL을 직접 입력하여 튜닝 요청

**레이아웃:** 카드 기반 폼

**섹션:**
1. SQL 입력 (textarea)
2. 실행 대상 (인스턴스, 스키마, 실행 컨텍스트)
3. 예상 부하 (일 추정 실행 횟수)

**액션:**
- "튜닝 요청 생성" → 확인 다이얼로그 → `addNewWorkItem()`
- 성공 시 `/work/{newId}`로 이동

---

### 7.7 작업 파이프라인 (`/work`) — V1

**목적:** 모든 튜닝 작업의 상태별 관리 보드

**프리셋 탭:**

| 탭 | 필터 조건 | 용도 |
|----|-----------|------|
| auto_today | 오늘 자동선정 | 오늘 생성된 자동 선정 작업 |
| tuned_review | status === 'tuned' | 검증 대기 작업 |
| all | 전체 | 모든 작업 |

**뷰 모드:**
- items: DataTable 뷰
- batches: batchId별 그룹핑

**테이블 컬럼:**
- ID, 작업명, 상태(뱃지), 담당자
- 원본 vs 튜닝 Elapsed (바 차트)
- 개선율(%, 색상 코딩)
- 소스(SourceBadge)
- 추천 유형(hint/index/rewrite 뱃지)
- 액션 (상세 이동)

**인라인 액션:**
- 검증완료 / 튜닝불가(사유 모달) / 재튜닝 / 적용 / 삭제

**데이터:**
- `workItems` + `getNewV1Items()` 합산

---

### 7.8 작업 상세 (`/work/:id`) — V1

**목적:** 단건 작업의 전체 분석 결과 확인 및 검증/반영

**상단:**
- 브레드크럼: 대시보드 > 작업 > {작업명}
- StepIndicator (pending → tuning → tuned → verified → applied)
- 현재 상태 뱃지
- 이전/다음 버튼 (순차 리뷰 모드)
  - `?context=tuned_review` 시 tuned 목록 내 prev/next
  - 카운터 표시 ("2/5")

**좌측 사이드바:**
- 아이템 메타 (ID, 담당자, 생성/수정일)
- 배치 정보
- 소스, 실행 컨텍스트

**메인 콘텐츠 (상태별 조건부 렌더링):**

#### PendingContent (status: pending)
- 대기열 위치 표시
- 2초 후 자동 tuning 전환

#### TuningContent (status: tuning)
- StepIndicator: sql_analysis → plan_collection → plan_generation → verification
- 현재 단계 상세
- 3초 후 자동 tuned 전환

#### TunedContent (status: tuned) ⭐ 핵심
- **AI 추천 요약:** 튜닝 유형, 개선율
- **복수 튜닝안 비교:**
  - 각 안: 유형 뱃지, 개선율, 요약
  - 선택 버튼으로 안 전환
- **선택된 안 상세:**
  - Before/After 실행계획 비교 (PlanCompare)
  - Before/After 메트릭 (elapsed, buffers, disk reads)
  - 변환 SQL (rewrite인 경우)
  - 인덱스 DDL (index인 경우)
- **바인드 변수 정보** (있는 경우)
- **액션:**
  - "검증완료" → verified 전환
  - "튜닝불가" → 사유 입력 모달 → tuning_impossible
  - 순차 리뷰 모드 시 자동 다음 건 이동

#### VerifiedContent (status: verified)
- 검증 완료 정보 (검증자, 검증 시간)
- 액션 아이템 체크리스트
- "반영(Apply)" 버튼 → applied 전환

#### AppliedContent (status: applied)
- 적용일시
- **운영 실측 결과:**
  - operationalResult 뱃지 (improved/degraded/monitoring)
  - 운영 Elapsed vs 튜닝 Elapsed vs 원본 Elapsed 비교
- **degraded인 경우:**
  - 경고 배너
  - "재튜닝 요청" 버튼 → 사유 입력 모달 → retune_requested

#### ImpossibleContent (status: tuning_impossible)
- 판정 정보 (판정자, 사유)

#### RetuneContent (status: retune_requested)
- 재튜닝 사유
- 이전 적용 이력

---

### 7.9 V2 작업 파이프라인 (`/v2/work`)

**목적:** V2 칸반 + 리스트 뷰 기반 작업 관리

**뷰 모드:**
- **Kanban:** 상태별 컬럼 (pending → tuning → tuned → verified → applied)
  - 사이드 카드: retune_requested, tuning_impossible
- **List:** DataTable

**프리셋:**
- all, auto-today, tuned_review, mine (내 할당)

**칸반 카드:**
- 작업명, 상태 뱃지, 담당자
- 개선율, 소스 뱃지
- 클릭 → 미리보기 패널
- 상태 칼럼 간 드래그&드롭

**특이사항:**
- 거부 모달: impossibleReason + retuneConditions 입력
- 멀티 셀렉트 → 일괄 검증

---

### 7.10 V2 작업 상세 (`/v2/work/:id`)

V1 WorkDetail과 동일한 구조이나:
- V2 analysisStep 사용 (structure → plan_collection → comparison → recommendation)
- analysisEstimatedRemaining 표시
- appliedBy 필드 표시
- V2 전용 executionValidation 데이터 사용 (sqlId 기반 룩업)

---

### 7.11 승인 큐 (`/work/approval`)

**목적:** tuned 상태 작업의 일괄 검증/승인

**기능:**
- tuned 상태 필터링 뷰
- 일괄 검증 (멀티 셀렉트 → 한번에 승인)
- 개별 검증/거부 버튼
- 인라인 코멘트 입력

---

## 8. 공유 컴포넌트

> 파일 위치: `src/components/common/`

### 8.1 DataTable

**가장 중요한 공유 컴포넌트.** 모든 테이블은 이 컴포넌트를 사용해야 함.

```typescript
interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey: keyof T | ((row: T) => string)
  onRowClick?: (row: T) => void
  onRowHover?: (row: T | null) => void
  onColumnsChange?: (columns: Column<T>[]) => void
}

interface Column<T> {
  key: string
  label: string
  width?: number
  minWidth?: number
  render?: (value: any, row: T) => ReactNode
  sortable?: boolean
}
```

**기능:**
- 컬럼 리사이즈 (드래그 핸들)
- 컬럼 재정렬 (드래그 앤 드롭)
- 커스텀 셀 렌더링
- 행 선택
- 행 호버 콜백
- 스프레드시트 스타일 인터랙션
- 셀 복사

### 8.2 기타 컴포넌트

| 컴포넌트 | 용도 | 주요 Props |
|----------|------|------------|
| Badge | 상태/레이블 뱃지 | `variant`: success/danger/warning/neutral/info |
| SourceBadge | 데이터 소스 표시 | maxgauge/awr/v$sql |
| ImprovementBadge | 개선율 표시 | 수치에 따른 색상 자동 |
| Button | 범용 버튼 | variant, size, disabled |
| Card | 카드 컨테이너 | children |
| MetricCard | 지표 카드 | title, value, status |
| StepIndicator | 단계 표시기 | steps, currentStep |
| SlidePanel | 슬라이드 패널 | isOpen, onClose, title |
| PlanCompare | 실행계획 비교 | originalPlan, tunedPlan |
| SqlTextBlock | SQL 표시 + 복사 | sqlText |
| SqlFullScreenModal | SQL 전체화면 뷰어 | sqlText, bindVariables |
| ConfirmDialog | 확인 다이얼로그 | title, message, variant, onConfirm |
| TimeRangePicker | 시간 범위 선택 | value, onChange, options |
| FloatingPopup | 플로팅 정보 팝업 | position, content |

---

## 9. 핵심 사용자 흐름 (User Flows)

### 흐름 1: 자동선정 → 순차 리뷰 → 검증 → 반영

```
1. [대시보드] "오늘의 자동 튜닝 결과" 카드 클릭
   └── WorkPipeline(?preset=auto_today) 이동

2. [작업 파이프라인] "검증대기" 탭 클릭
   └── tuned 상태 아이템 목록 표시

3. [작업 파이프라인] 첫 번째 아이템 클릭
   └── WorkDetail(:id, ?context=tuned_review) 이동

4. [작업 상세 — TunedContent] AI 추천 확인
   ├── 복수 튜닝안 비교
   ├── 실행계획 Before/After 비교
   └── 변환 SQL / 인덱스 DDL 확인

5. [작업 상세] "검증완료" 클릭
   ├── status → verified
   └── 자동으로 다음 tuned 아이템으로 이동 (2/5, 3/5...)

6. [작업 상세] 마지막 건 검증완료
   └── 파이프라인으로 복귀

7. [작업 상세 — VerifiedContent] "반영" 클릭
   └── status → applied
```

### 흐름 2: 수동선정 → 상세확인 → 검증 → 반영

```
1. [후보화면] Top SQL / 이상실행 / 플랜변경 / 개발검증 / 직접지정 중 택1
   └── SQL 선택 또는 입력

2. [후보화면] "튜닝 요청" 클릭
   ├── addNewWorkItem() 호출
   ├── 토스트: "작업이 생성되었습니다"
   └── "작업함에서 확인" 버튼 → WorkPipeline 이동

3. [작업 파이프라인] 신규 아이템 확인 (pending 상태)
   └── 아이템 클릭 → WorkDetail 이동

4. [작업 상세] 자동 전환 관찰
   ├── pending (2초) → tuning
   ├── tuning (3초) → tuned
   └── 튜닝 결과 데이터 자동 생성

5. [작업 상세 — TunedContent] 튜닝안 확인 → 검증완료 → 반영
   (이하 흐름 1의 4~7과 동일)
```

### 흐름 3: 적용 후 실측 저하 → 재튜닝

```
1. [작업 파이프라인] applied 상태 아이템 중 operationalResult=degraded 확인
   └── 아이템 클릭 → WorkDetail 이동

2. [작업 상세 — AppliedContent] 운영 실측 확인
   ├── operationalResult: degraded 경고 배너
   ├── 운영 Elapsed vs 튜닝 Elapsed 비교
   └── "재튜닝 요청" 버튼 표시

3. [작업 상세] "재튜닝 요청" 클릭
   ├── 사유 입력 모달 표시
   ├── 사유 입력 + 확인
   └── status → retune_requested

4. [작업 파이프라인] retune_requested 상태로 표시됨
   └── 재튜닝 프로세스 시작 (pending → tuning → ...)
```

---

## 10. V1 vs V2 차이점

V2는 V1의 기획 개선 비교를 위한 병행 구현.

| 항목 | V1 | V2 |
|------|----|----|
| 파이프라인 뷰 | 리스트 + 배치 그룹 | **칸반** + 리스트 |
| 분석 단계 | sql_analysis → plan_collection → plan_generation → verification | structure → plan_collection → comparison → recommendation |
| 분석 남은 시간 | 없음 | `analysisEstimatedRemaining` (초) |
| 적용 담당자 | appliedAt만 | `appliedBy` + appliedAt |
| 검증 데이터 조회 | `workRecommendations[id]` (workItemId 직접 매핑) | `executionValidations` (sqlId 기반 룩업) |
| 프리셋 | auto_today, tuned_review, all | + `mine` (내 할당) |

---

## 11. 백엔드 API 요구사항

> Mock 데이터 인터페이스를 그대로 REST API로 구현하면 프론트엔드 연동 가능

### 11.1 작업(Work) API

| Method | Path | 설명 | 요청 | 응답 |
|--------|------|------|------|------|
| GET | `/api/work-items` | 작업 목록 조회 | query: status, source, assignee, batchId | WorkItem[] |
| GET | `/api/work-items/:id` | 작업 상세 조회 | - | WorkItem |
| POST | `/api/work-items` | 작업 생성 | body: sqlId, sqlText, instanceName, schemaName, source | WorkItem |
| PATCH | `/api/work-items/:id/status` | 상태 변경 | body: status, reason?, verifiedBy? | WorkItem |
| GET | `/api/work-items/:id/recommendation` | 튜닝 추천안 조회 | - | WorkRecommendation |
| GET | `/api/work-items/:id/validation` | 실행 검증 결과 | - | ExecutionValidation |
| GET | `/api/work-items/:id/binds` | 바인드 변수 정보 | - | WorkBindInfo |

### 11.2 후보(Candidate) API

| Method | Path | 설명 | 요청 | 응답 |
|--------|------|------|------|------|
| GET | `/api/candidates/top-sql` | Top SQL 조회 | query: source, sortBy, valueMode, instances[], schemas[] | TopSqlItem[] |
| GET | `/api/candidates/anomaly` | 이상 실행 조회 | query: timeRange, instance, waitEvent, schema | AnomalyPoint[] |
| GET | `/api/candidates/plan-changes` | 플랜 변경 조회 | query: impact, instance, schema | PlanChangeItem[] |
| POST | `/api/candidates/explain-plan` | 실행계획 확인 | body: sqlText, instance, schema, binds[] | ExplainPlanResult |

### 11.3 대시보드 API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/dashboard/summary` | 현황 요약 (알림, 메트릭, 할 일) |
| GET | `/api/dashboard/trend` | 일별 추세 데이터 |

### 11.4 운영관리 API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/ops/impact` | 운영 효과 통계 |
| GET/PUT | `/api/ops/policy` | 자동 튜닝 정책 조회/수정 |
| GET/PUT | `/api/ops/integration` | 연동 설정 |
| GET/POST/PUT/DELETE | `/api/ops/users` | 사용자 CRUD |

### 11.5 인증 API

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/auth/login` | 로그인 |
| POST | `/api/auth/logout` | 로그아웃 |
| GET | `/api/auth/me` | 현재 사용자 정보 |

### 11.6 실시간 통신 (권장)

- **WebSocket** 또는 **SSE**: 튜닝 진행 상태 실시간 업데이트
  - pending → tuning 전환 알림
  - tuning 진행 단계 업데이트
  - tuning → tuned 완료 알림

---

## 12. 구현 현황 및 TODO

### 12.1 프론트엔드 완료 항목

- [x] 전체 레이아웃 (Sidebar + TopBar + Outlet)
- [x] 대시보드 (V1 + V2)
- [x] 5개 후보 선정 화면 (Top SQL, 이상실행, 플랜변경, 개발검증, 직접지정)
- [x] 작업 파이프라인 (V1 리스트 + V2 칸반)
- [x] 작업 상세 — 상태별 콘텐츠 (V1 + V2)
- [x] 순차 리뷰 (prev/next, 자동 다음 건 이동)
- [x] 후보 → 작업 생성 → 파이프라인 연결 (세션 스토어)
- [x] 검증/거부/재튜닝 워크플로우
- [x] 운영 실측 표시 + 재튜닝 요청
- [x] 공유 컴포넌트 (DataTable, PlanCompare, etc.)
- [x] Mock 데이터 전체 정합성 검증

### 12.2 프론트엔드 TODO

- [ ] 로그인 화면 구현
- [ ] 운영관리 4개 화면 (운영효과, 자동튜닝정책, 연동설정, 사용자관리)
- [ ] Mock → API 호출 전환 (React Query/SWR 도입)
- [ ] 에러 핸들링 (스켈레톤 로딩, 에러 바운더리)
- [ ] 토스트 알림 시스템
- [ ] 반응형 레이아웃 (모바일 지원)
- [ ] 다크 모드

### 12.3 백엔드 TODO

- [ ] REST API 서버 구축
- [ ] Oracle DB 연동 (MaxGauge/AWR/V$SQL 데이터 수집)
- [ ] AI 튜닝 엔진 연동 (SQL 분석 → 튜닝안 생성)
- [ ] 사용자 인증/인가 (JWT)
- [ ] WebSocket/SSE 실시간 상태 업데이트
- [ ] 배치 스케줄러 (자동 SQL 선정, 주기적 실측 수집)

### 12.4 디자인 시스템

**색상 체계:**

| 용도 | 색상 | Tailwind |
|------|------|----------|
| Primary | Indigo | indigo-400~700 |
| Success | Green | green-100~700 |
| Danger | Red | red-100~700 |
| Warning | Amber | amber-100~700 |
| Info | Blue | blue-100~700 |
| Neutral | Gray | gray-50~900 |

**타이포그래피:**
- 제목: `font-bold text-xl ~ text-2xl`
- 본문: `text-sm ~ text-base text-gray-600 ~ gray-900`
- 레이블: `text-xs text-gray-500`
- SQL: `font-mono`

**컴포넌트 스타일:**
- Card: `rounded-lg border bg-white shadow-sm`
- Button: `rounded-md px-3 py-2 transition-colors`
- Badge: `rounded-full px-2.5 py-0.5 text-xs font-medium`
- Input: `rounded-lg border focus:ring-2 focus:outline-none`

---

## 부록 A: Mock 데이터 현황

| 파일 | 건수 | 상태 분포 |
|------|------|-----------|
| workItems.ts (V1) | ~50건 | pending:5, tuning:2, tuned:10, verified:10, applied:15, impossible:3, retune:2 |
| v2WorkItems.ts (V2) | ~20건 | pending:3, tuning:2, tuned:3, verified:3, applied:5, impossible:2, retune:2 |
| recommendations.ts | ~30건 | tuned+verified+applied 아이템에 대한 복수 튜닝안 |
| executionValidation.ts | ~25건 | 실행 검증 결과 + 바인드 변수 |
| anomalyData.ts | 150건 | 산점도용 이상치 포인트 |
| planChanges.ts | 10건 | degraded:5, improved:3, neutral:2 |

## 부록 B: 파일-라우트 매핑

```
src/App.tsx                          → 라우트 정의
src/components/layout/AppLayout.tsx  → 전체 레이아웃
src/components/layout/Sidebar.tsx    → 사이드바 메뉴
src/components/layout/TopBar.tsx     → 상단 바

src/pages/Dashboard.tsx              → /
src/pages/Login.tsx                  → /login

src/pages/candidates/TopSql.tsx          → /candidates/top
src/pages/candidates/AnomalyDetection.tsx → /candidates/anomaly
src/pages/candidates/PlanChange.tsx      → /candidates/plan-change
src/pages/candidates/DevVerify.tsx       → /candidates/dev-verify
src/pages/candidates/DirectInput.tsx     → /candidates/direct

src/pages/work/WorkPipeline.tsx      → /work
src/pages/work/ApprovalQueue.tsx     → /work/approval
src/pages/work/WorkDetail.tsx        → /work/:id

src/pages/v2/V2Dashboard.tsx         → /v2
src/pages/v2/V2WorkPipeline.tsx      → /v2/work
src/pages/v2/V2WorkDetail.tsx        → /v2/work/:id
```
