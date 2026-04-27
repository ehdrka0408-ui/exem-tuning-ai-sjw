# Design Decisions

## §25 예외 SQL 정책 (2026-04-07)

### 원칙
자동 튜닝 대상에서 영구 제외할 SQL을 **SQL ID 단위**로 관리한다. 체크는 **두 층**에서 이뤄진다.

1. **Pre-creation check** (UX 조기 차단)
   - Top SQL 행에서 등록 후 해당 행 숨김 + 생성 경로 차단
   - DirectInput 제출 직전 `isSqlTextException` 으로 차단 모달
2. **Pre-execution guard** (authoritative 차단)
   - 작업함의 auto 작업 중 `pending|tuning` 상태인 SQL이 예외 등록되면 실행 진입 시점에서 `cancelled` 로 전이
   - `cancelReason = "예외 SQL 정책 차단 — {사유}"`, `cancelledAt = exception.registeredAt`
   - 아이템은 **목록에서 사라지지 않고** "취소됨" 상태로 남아 감사 추적 가능

### 왜 두 층이 필요한가
작업 생성과 실행 사이에 시간차가 있다(pending 큐 대기). 이 윈도우 동안 운영팀이 예외 등록하면, 이미 큐에 들어간 작업도 정책 위반 없이 차단되어야 한다. pre-creation check만으로는 이 윈도우를 방어할 수 없다.

### 영향 경로 매트릭스
| 경로 | 차단 층 | 동작 |
|------|---------|------|
| 대상 선정 > Top SQL (행 후보) | pre-creation | 목록에서 숨김 + `N건 제외됨` meta |
| 대상 선정 > 직접 지정 (입력 SQL) | pre-creation | 제출 차단 모달 |
| 작업함 > 자동 작업 (pending/tuning) | **pre-execution** | `cancelled` 전이 + `cancelReason` + meta |
| 작업함 > 수동/직접 작업 | 미적용 | 튜너 명시 의사 존중 — 예외와 무관하게 유지 |
| 설정 > 예외 SQL 목록 | — | 등록/해제/검색 UI |

### 상호 배제
수동 선정(`manual`, `direct_verify`) 작업은 예외 상태와 무관하게 유지된다. 이유: 튜너가 명시적으로 선택한 작업이므로 정책 변경으로 소급 취소하면 안 된다.

### 구현 디테일
- `filteredItems` useMemo 에서 render 시점에 effective status를 계산(pure derivation). 예외 해제 시 자동으로 pending 복원.
- WorkDetailPanel에 `status === 'cancelled' && cancelReason` 섹션 추가 — warning 톤, `Ban` 아이콘.
- 상태 필터 탭에 "취소됨" 추가 — meta 링크 → `setStatusFilter('cancelled')` 원클릭 이동.

### 스토어
`src/mocks/sqlExceptions.ts` — listeners + `window` 이벤트 두 가지 구독 채널 제공.
- `isSqlException(sqlId)` — 빠른 경로 (배열 스캔, mock 기준 OK)
- `isSqlTextException(sqlText)` — DirectInput 차단용, 정규화 비교
- `addSqlException(item)` / `removeSqlException(sqlId)` → notify

### UI 색상 컨벤션
예외 관련 액션/표시는 **warning 톤** (amber) 사용 — danger(빨강)는 "반려/파괴적 동작" 전용으로 구분.
- 행 액션 Ban 호버: `hover:bg-danger-light hover:text-danger` (시선 끌기 목적, 실수 방지)
- Meta 텍스트: `text-text-muted` + `text-text-secondary` (조용한 정보)
- 차단 모달 아이콘: `text-warning`
- 해제 확인 ConfirmDialog: `variant="danger"` (되돌릴 수 있는 파괴적 동작)

## §26 중복 작업 방지 정책 (2026-04-07)

### 원칙
같은 `sqlId` 에 이미 활성(in-flight) 작업이 있으면 신규 튜닝 작업 생성을 차단한다. **활성** 정의:

| 상태 | 활성(차단) | 종료(허용) |
|------|:---------:|:---------:|
| pending | ● | |
| tuning | ● | |
| approval_pending | ● | |
| apply_pending | ● | |
| applied | | ● |
| rejected | | ● |
| cancelled | | ● |

**왜 종료 상태는 허용?** 적용 후 재발, 반려 후 재시도, 예외 해제 후 재요청은 모두 유효한 워크플로우.

### 체크 경로 매트릭스
| 경로 | 동작 | 비고 |
|------|------|------|
| Top SQL (카드/행) | `filtered` 에서 사전 제거 | meta: `이미 작업 중인 SQL N건 제외됨` |
| 직접 지정 (DirectInput) | `handleTuningRequest` 에서 차단 모달 | 우선순위: **중복 > 예외 > Confirm** |
| 작업함 (WorkPipeline) | `AUTO_DUPLICATE_EXCLUDED_COUNT` meta 표시 | 야간 자동 튜닝의 중복 스킵 집계 (mock 고정값) |

### DirectInput 체크 우선순위 (중복 > 예외)
1. **중복** → 복구 경로 있음 (기존 작업 보기) → 먼저 노출
2. **예외** → 하드 블록 → 중복 없을 때만 평가
3. **Confirm**

근거: **상태(fact) > 정책(rule)** 원칙. 이미 작업이 있는데 예외 모달을 먼저 띄우면 사용자가 "근데 작업은 있는데?" 라는 모순을 만남. Error Recovery UX 원칙상 actionable 한 정보 우선.

### Meta 표시 원칙 (TopSql / WorkPipeline)
- 예외 meta 와 중복 meta 는 **같은 블록 내 별도 라인** 으로 stack
- 이유:
  - 아이콘/톤 다름 (Ban=warning / Copy=info)
  - 인터랙션 다름 (예외는 클릭 가능, 중복은 정적 — WorkPipeline 기준)
  - 향후 확장성 (새로운 자동 제외 사유 추가 시 라인 단위로 자연스럽게 붙음)

### 스토어
`src/mocks/duplicateCheck.ts`
- `isActiveStatus(status)` — 4개 활성 상태 set 조회
- `findActiveWorkItem(sqlId)` / `isActiveWorkItem(sqlId)` — sqlId 기반
- `findActiveWorkItemByText(sqlText)` — 정규화 본문 비교 (DirectInput)
- `AUTO_DUPLICATE_EXCLUDED_COUNT` — WorkPipeline meta 용 상수

### UI 색상 컨벤션
- 중복 아이콘: `Copy` (lucide) — 예외의 `Ban` 과 구분
- 중복 차단 모달: warning 톤 (bg-warning-light / text-warning) — 예외와 동일 톤이지만 아이콘으로 구분
- Meta 텍스트: 동일하게 `text-text-muted` + `text-text-secondary`
