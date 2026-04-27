# 튜닝 현황 — 작업함 목록 (`/work`)

## 화면 목적

AI 가 자동 튜닝한 결과물과 사용자가 직접 요청한 건의 전체 현황을 관리하는 중앙 작업함. 상태별 필터·정렬로 이상 항목을 빠르게 식별하고, 건별 승인·반려·재튜닝 판단을 내린다.

화면 모드:
- **리스트 뷰** — 평면 row 리스트 + 재요청 자식만 부모 바로 아래 indent
- **그룹 뷰** — 요청 그룹(`tuning_request_group.group_id`) 단위 카드 + 진행률 게이지 + 카테고리 카운트

같은 SQL 의 재튜닝 이력은 `parent_request_id` + `group_id` 일치 조건으로 묶어 시각화한다.

---

## 사용자 시나리오

**S1 — 야간 작업 확인**
출근 후 전날 야간 튜닝 결과 확인. 그룹 뷰에서 진행률 게이지·실패 카운트로 이상 그룹을 빠르게 식별.

**S2 — 특정 SQL 빠른 조회**
SQL ID 검색 → 현재 상태(튜닝중·완료·승인완료)를 즉시 확인.

**S3 — 일괄 요청 묶음 추적**
일괄 N건 튜닝 요청 후 그룹 뷰에서 `[V$SQL] admin 요청 N건 …` 그룹 카드 1건 확인. 그룹 헤더의 게이지로 진행률, 펼치기로 자식 request 들 노출.

**S4 — 승인완료 .sql 다운로드**
승인완료 상태 필터 → 일괄 .sql 다운로드. 예상 검증(실측 아닌) 건은 별도로 분리.

**S5 — 재튜닝 체인 추적**
같은 SQL 에 대해 여러 차례 재튜닝 요청한 이력을 한 그룹 안에서 root → 자식·손자 형태로 확인. 자식 alias 는 `_재튜닝(N)` suffix 로 카운터 자동 증가.

---

## Description

### (1) 조회조건 바

**1. 내용**
조회 범위를 설정하여 작업 목록을 가져온다.

**2. 구성**
- 기간 선택 — 시작일~종료일. 기본값: 어제~오늘
- 인스턴스 다중선택 — 등록된 인스턴스 목록. 전체 선택/해제 체크박스
- 스키마 다중선택 — 전체 선택/해제 체크박스
- 모듈 다중선택 — 전체 선택/해제 체크박스
- 요청자 다중선택 — 등록된 사용자 목록. **현재 운영 사용자 기반 매핑 작업 진행 중** (사용자 명세 테이블 확정 후 `tuning_request_group.user_id` 조인으로 활성화)
- 조회 버튼

**3. 동작**
- 조회 버튼 클릭 → 백엔드 `GET /api/tuning/requests?...` 호출하여 결과 집합 로드
- 조건 변경 후 조회 버튼을 누르기 전까지 반영되지 않음

---

### (2) 상태 파이프라인 바

**1. 내용**
전체 작업의 상태별 건수를 파이프라인 순서로 보여주고, 클릭으로 해당 상태만 필터한다.

**2. 구성**
수평 알약(pill) 버튼. 좌→우 순서:

| pill | 색 | 의미 |
|------|----|----|
| 전체 | action(파랑 배경) | 예약중 제외 전체 |
| 튜닝대기 | 회색 점 | 큐 대기 (`pending`) |
| 튜닝중 | 회색 점 | LLM 처리 중 (`tuning`) |
| 실패 | 빨강 점 | 파이프라인 실패 (`failed`) |
| 취소 | 연빨강 점 | 사용자 취소·예외 SQL 차단 (`cancelled`) |
| 튜닝완료 | 초록 점 | 운영자 검토 대기 (`approval_pending`) |
| 개선없음 | 회색 점 | 동일 plan_hash 또는 개선 < 10% (`no_improve`) |
| 승인완료 | 초록 점 | 운영자 승인 (`apply_pending`/`applied`/`fulfilled`) |
| 반려 | 빨강 점 | 운영자 반려 (`rejected`) |

**3. 동작**
- pill 클릭 → 해당 상태만 필터. "전체" 클릭 → 필터 해제

---

### (3) 속성 필터 바

**1. 내용**
조회된 결과 집합 내에서 속성 조건으로 즉시 좁힌다.

**2. 구성**
- 속성 필터 입력창 (드롭다운 또는 자유 타이핑)
  - 상태 / 유형(인덱스/힌트/Rewrite) / 출처(AWR/V$SQL/MaxGauge/사용자SQL입력) / 실행검증(실측-개선/실측-저하/예상/T/O) / 정합성(일치/불일치/미확인) / 요청자
- 자유 검색 — 속성 지정 없이 전체 컬럼 통합 검색
- 적용된 칩 목록 (exact: `속성 = 값`, contains: `속성 ≈ 검색어`, freeText: `"검색어"`)
- 모두 지우기 버튼

**3. 동작**
- 칩 추가/제거 즉시 필터 반영
- ↑↓ 속성/값 목록 포커스, Enter 선택, ESC 계층적 되돌리기
- contains 검색: 라벨 기준 contains 매칭, 대소문자 무시
- 타이핑 중 옵션 실시간 필터링 + 매칭 부분 강조

---

### (4) 뷰 모드 토글

화면 상단에 좌측부터 `[ 리스트 뷰 | 그룹 뷰 ]` 2 모드 토글.

| 항목 | 동작 |
|------|------|
| default | 그룹 뷰 |
| 모드 보존 | localStorage `workPipelineViewMode` (값: `'requests'` / `'groups'`). 새로고침 후 마지막 모드 복원 |
| 마이그레이션 | 기존 `'batch'` 값 → 마운트 시 `'groups'` 로 자동 변환 (1회) |

---

### (5) 그룹 뷰

**1. 내용**
요청 그룹(`group_id` UUID) 단위로 카드 표시. 단건/일괄 무관 모든 그룹이 노출(단건도 1건 그룹 카드).

**2. 그룹 카드 헤더**

| 요소 | 표시 |
|------|------|
| 그룹명 | `request_group_name` (예: `[V$SQL] admin 요청 3건 260426 14:25:32`) |
| 건수 | `N건` (그룹 내 request 수) |
| 요청자 | `users.name` (`tuning_request_group.user_id` 조인) |
| 요청일시 | `MM-DD HH:MM:SS` (`group_created_at`) |
| 출처 | `request_source` (V$SQL / AWR / DIRECT / RETUNE 등) |
| 진행률 게이지 | `(완료 + 실패) / 전체 × 100%` 바 + 퍼센트 |
| 카테고리 카운트 | `대기 N · 튜닝중 N · 완료 N · 실패 N` (4 카테고리) |
| chevron 토글 | `▶ (N건)` 자식 펼치기. **default 접힘** (사용자 클릭 시 펼침) |

**3. KPI 카테고리 매핑** (그룹 뷰 한정)

| 카테고리 | 포함 status |
|----------|-------------|
| 대기 | `pending` |
| 튜닝중 | `tuning` |
| 완료 | `approval_pending` + `apply_pending` + `applied` + `fulfilled` + `no_improve` |
| 실패 | `rejected` + `cancelled` + `failed` |

> 본체 상태 파이프라인 바 (§2) 의 6 카테고리는 별도 매핑 (변경 없음).

**4. 그룹 카드 펼침 시 자식 영역 (DataTable)**

- **트리 평탄화**: 모든 후손(자식·손자·증손)을 root 의 직접 자식 1단계 (depth=1, `└` 커넥터) 로 노출. 2단 트리 안 만듦
- **chevron 토글은 root 만**. 자식 row 에 chevron 부재
- chevron 옆 카운트 = 후손 전체 합 (예: 자식 1 + 손자 1 = 2)
- 그룹 뷰 DataTable 컬럼 노출: `_select` (체크박스) + `_tree` (트리 마커) + 본문 컬럼들. 제외: `_actions` / `_workbench` (그룹 뷰는 조회 전용)

**5. 체크박스 격리**

| 위치 | 동작 |
|------|------|
| 그룹 헤더 체크박스 | 해당 그룹 children 만 toggle. 다른 그룹 영향 없음 |
| 자식 row 체크박스 | row 단위 단건 toggle |
| DataTable select-all 헤더 | 그룹별 격리: `onSelectAll` 핸들러를 `handleGroupToggle(group, checked)` 로 override → 그 그룹 children 만 toggle |
| 그룹 헤더 indeterminate | 자식 일부만 체크 시 |
| 그룹 헤더 fully-checked | 자식 전체 체크 시 |

**6. 상단 전체 KPI**

그룹 뷰 진입 시 화면 상단에 1개:
> `전체 N건 · 대기 N · 튜닝중 N · 완료 N · 실패 N · 진행률 X%`

집계 매핑은 §3 KPI 카테고리와 동일.

---

### (6) 리스트 뷰

**1. 내용**
row(=request) 단위 평면 리스트. 그룹 wrapper 없음. 재튜닝 자식만 부모 바로 아래 indent 1단계.

**2. 트리 분기 규칙**

| 조건 | 표시 |
|------|------|
| `parent_request_id == null` | root 평면 row |
| `parent_request_id != null` 이고 parent.group_id == child.group_id | 자식 (부모 row 바로 아래 indent 1단계, `└` 커넥터) |
| `parent_request_id != null` 이지만 parent 미존재 또는 group_id 불일치 | root 처리 |

**3. 평탄화 (그룹 뷰와 동일)**

손자 이하의 후손도 모두 root 의 직접 자식 1단계로 노출. chevron 토글은 root 에만. chevron 옆 자식 수는 후손 전체 합.

**4. 정렬·컬럼**

- 정렬: `requested_at` DESC (root 기준)
- chevron 토글 default **접힘**
- 자식 row 의 indent + `└` 커넥터 + `bg-surface-alt/40` 배경
- 컬럼 표시/숨기기 (헤더 우측 버튼)
- 기본 표시 컬럼: 요청일시, 요청자, 별칭, SQL ID, SQL 텍스트, 인스턴스명, 출처, 상태, 튜닝 내용, Before/After Elapsed/개선율, Before/After Buffers/개선율, 실측/예상, 결과일치, 퀵 액션

---

### (7) 작업 테이블 컬럼 정의

| 컬럼 | 내용 |
|------|------|
| 체크박스 | 행별. 헤더 체크박스로 전체 선택 (리스트 뷰만). 그룹 뷰는 그룹 헤더 격리 |
| 요청일시 | 튜닝 작업 생성 시각. `MM-DD HH:mm` |
| 요청자 | `users.name` (`tuning_request_group.user_id` 조인). 자동선정 = `'시스템'` |
| 별칭 | 요청 시 부여된 식별 이름. **재튜닝 alias 카운터 규칙** 은 §10 참조 |
| SQL ID | Oracle V$SQL.SQL_ID 또는 asis_sql_id_hash. 고정폭, 굵게. 호버 시 복사 아이콘 |
| 트리 마커 (`_tree`) | root 면 chevron + `(N건)` / 자식이면 `└` |
| SQL 텍스트 | 첫 줄 요약. 호버 복사 |
| 인스턴스명 | `instances.name` (예: `REPO`) |
| 스키마 | 실행 스키마. `tuning_requests.schema_name`. 기본 숨김 |
| 모듈 | `V$SESSION.MODULE`. 기본 숨김 |
| 출처 | AWR/V$SQL/사용자SQL입력 등. 색상 배지 |
| 상태 | 파이프라인 단계. 좌측 액션 인디케이터 + 라벨. 튜닝중도 게이지 미표시 (텍스트만) |
| 튜닝 내용 | AI 제안 유형 — 인덱스 · 힌트 · Rewrite. 복수 표시 |
| Before/After Elapsed (sec) | 원본/튜닝 SQL 실행 시간. 개선율 산식 §11 |
| Before/After Buffers (count) | Logical Reads. 개선율 산식 §11 |
| 실측/예상 | sql_performance.is_estimated 매핑 (`Y` → 예상, `N` → 실측). **현재 값 빈 상태** |
| 결과일치 | sql_performance.result_match 또는 tuning_requests.result_match. **현재 NULL 고정** (비교 로직 미구현) |
| 퀵 액션 | 승인완료/튜닝완료: .sql 다운로드 + 워크스페이스. 실패/개선없음: 재튜닝 + 워크스페이스. 외 워크스페이스만 |

---

### (8) 작업 테이블 동작

| 동작 | 설명 |
|------|------|
| 행 클릭 | 우측 슬라이드 패널에 상세 표시 |
| SQL ID/텍스트 복사 | 호버 시 복사 아이콘 클릭 → 클립보드 |
| 컬럼 헤더 클릭 | 오름/내림 정렬 토글 |
| 컬럼 헤더 드래그 | 컬럼 순서 재정렬 |
| 컬럼 경계 드래그 | 컬럼 너비 조절 |
| chevron 토글 | 자식 hide/show (default 접힘) |
| 체크박스 | 리스트 뷰 = row 단건 / 그룹 뷰 = 그룹 격리 |
| CSV/Excel 내보내기 | 우측 끝 버튼 |
| 신규 건 하이라이트 | 노란 4초 후 소멸, 자동 스크롤 |

---

### (9) 일괄 액션 플로팅 바

`selectedIds.size > 0` 일 때 화면 하단에 노출.

| 액션 | 동작 |
|------|------|
| 튜닝 재요청 | `handleBulkRetune` — 선택된 BE 항목들 각각 `postTuningRequestsBatch(items.length=1, parent_request_id=원본 rid)` 호출. parent group 승계되어 같은 group 안에 자식 추가 |
| 일괄 확인 | 선택 건들 `approval_pending` → `approved` 일괄 전이 |
| 일괄 삭제 | 선택 건들 DELETE. 자식의 parent_request_id 를 NULL 로 선 UPDATE 후 DELETE (orphan 방지) |
| 선택 해제 | selectedIds 초기화 |

---

### (10) 재튜닝 alias 카운터 규칙

자동 별칭 부여 시 다음 규칙으로 카운터 증가:

```
baseAlias = stripRetuneSuffix(tree-root.alias)
maxN = max(_재튜닝(N) suffix N) over (root 의 모든 후손 alias 의 정규식 매치)
newAlias = `${baseAlias}_재튜닝(${maxN + 1})`
```

핵심:
- **tree root** 까지 parent chain 거슬러 올라가 root 발견 (root.parent_request_id IS NULL)
- root.alias 에서 `_재튜닝(N)` suffix 제거한 값이 baseAlias
- root 의 모든 후손(BFS) 의 alias 에서 `/_재튜닝\((\d+)\)$/` 매치된 N 중 최대값 +1
- 사용자가 직접 입력한 alias 는 그대로 보존 (자동 카운터는 root 기준으로 일관)

예시:
```
rid=196 alias='AWR'                       (root)
└ rid=217 alias='AWR_재튜닝(1)'             (자식: maxN=0+1=1)
  └ rid=229 alias='AWR_재튜닝(2)'           (손자 retune: maxN=1+1=2)
    └ rid=N  alias='AWR_재튜닝(3)'          (증손 retune: maxN=2+1=3)
```

---

### (11) 개선율 계산 규칙

자세한 로직은 `spec-frontend-improvement-calc.md` 참조. 요약:

- **per-exec 정규화 (기본)**: `((Before/Before_executions) − (After/After_executions)) / (Before/Before_executions) × 100%`
- **totals fallback** (`useTotals()` true 일 때): `(Before − After) / Before × 100%`
  - 조건: `before_plan_hash == after_plan_hash` (물리 경로 무변화) **OR** `after_executions / before_executions > 5` (executions 오염)

방향 표시:
- 양수(개선): `↓` + 초록(`text-success`)
- 음수(악화): `↑` + 빨강(`text-danger`)
- null/0/미수집: `—` (절대 0 으로 강제 치환 금지)

값 원천: 기본 Xplan `A-Time`/`Buffers` · fallback `gv$sql SUM(...)`.

---

### (12) 재요청 (handleRetune / handleBulkRetune)

**호출 경로**: `POST /api/tuning/requests/batch` 통일 (단건도 `items.length=1` 으로 batch 호출)

**body**:
```json
{
  "batch_meta": {
    "request_group_name": "[재튜닝] admin 요청 1건 YYMMDD HH:MM:SS",
    "request_source": "RETUNE",
    "instance_id": 1
  },
  "items": [{
    "sql_text": "(asis SQL)",
    "schema_name": "SALES",
    "binds": [...],
    "alias": "(자동 카운터 alias, §10 규칙)",
    "parent_request_id": "(원본 rid)",
    "auto_tune": true
  }]
}
```

**중요 규칙**:
- `instance_id` 자리에 **숫자** 전달 (`item.instanceId` 필드. instanceName 문자열 보내면 422)
- `parent_request_id` 있으면 백엔드가 parent 의 group_id 승계 → 신규 group 생성 안 함, parent group.request_count +=1
- 응답 후 즉시 `refreshBackendItems()` 호출 → 화면에 새 row 즉시 노출 (새로고침 불필요)

**재튜닝 가능 상태**: `completed` / `approval_pending` / `apply_pending` / `applied` / `fulfilled` / **`failed`** / **`no_improve`**.
실패·개선없음 상태에서도 재튜닝 가능 (다시 시도 자연스러움).

---

### 조건분기

**테이블 셀 표시 분기**

| 조건 | 영향 컬럼 | 표시 |
|------|----------|------|
| 상태 = 튜닝대기/튜닝중 | Elapsed · Buffers · 개선율 · 실측/예상 · 결과일치 | "—" |
| After 미수집 (failed 포함) | After · 개선율 | "—" (undefined 그대로 전파, 0 강제 치환 금지) |
| 개선율 양수 | 개선율 | ↓N% 초록 |
| 개선율 음수 | 개선율 | ↑N% 빨강 |
| 개선율 0/null | 개선율 | "—" |
| before/after plan_hash 동일 | 개선률 계산 | `useTotals()` true → totals (UI 뱃지 미표시) |
| after_executions/before_executions > 5 | 개선률 계산 | `useTotals()` true |
| 실측/예상 — 값 없음 (현 단계) | 실측/예상 | "—" |
| 결과일치 — NULL (현 단계) | 결과일치 | "—" |
| 인덱스 포함 튜닝안 (실측 불가) | After Elapsed/Buffers/개선율 | "—" |

**그룹 뷰 분기**

| 조건 | 동작 |
|------|------|
| 단건 그룹 (1건) | 카드 1개로 표시 (다건과 동일 레이아웃, `1건` 표기) |
| 그룹 카드 default 상태 | 접힘 (자식 노출 없음) |
| chevron 클릭 | 펼침 → 자식 DataTable 렌더 (트리 평탄화 적용) |
| 그룹 헤더 체크 | 그 그룹 children 만 toggle |
| 자식 일부만 체크 | 그룹 헤더 indeterminate |
| 자식 전체 체크 | 그룹 헤더 fully-checked |

**리스트 뷰 분기**

| 조건 | 표시 |
|------|------|
| 같은 sql_id 인데 group_id 다른 신규 2건 | 별개 root (트리 묶임 없음) |
| parent.group_id == child.group_id | 자식이 부모 바로 아래 indent (`└`) |
| parent_request_id 있는데 parent 미존재/다른 group | 자식이 root 처리 |
| 자식 가진 root + chevron 접힘 (default) | 자식 hide |
| chevron 펼치면 | root 의 모든 후손 (자식·손자·...) 1단계 indent 로 노출 |

**일괄 삭제 시 트리 처리**

| 케이스 | 처리 |
|--------|------|
| 자식 없는 단독 요청 | 해당 row만 삭제 |
| root 삭제 + 자식 존재 | 자식의 parent_request_id NULL UPDATE 선행 → DELETE (orphan 방지) |
| 자식 row 삭제 | 부모 영향 없음 |

**전체 화면 분기**

| 조건 | 표시 |
|------|------|
| 필터 결과 0건 | "검색 결과가 없습니다." 안내 |
| 조회 조건 변경 후 미조회 | 조회 버튼 dirty 상태 강조 (`bg-action` + `ring-info/40`) |
| 신규 건 실시간 수신 | 노란 하이라이트 4초 후 소멸 + 자동 스크롤 |
| 예외 SQL 정책 차단 | 자동 cancelled + "예외 SQL 정책에 의해 차단되었습니다" 사유 |
| 1440px 뷰포트 | 가로 스크롤 허용 |

---

## 영향 범위

**프런트 파일**:
- `src/pages/work/WorkPipeline.tsx` — 전체 화면 (뷰 토글, 그룹 뷰, 리스트 뷰, KPI, 트리 평탄화, 체크박스 격리, alias 카운터)
- `src/pages/work/WorkDetail.tsx` — 슬라이드 패널 (`schemaName: d.schema_name ?? ''`)
- `src/lib/api.ts` — `TuningRequestSummary` / `TuningRequestDetail` 타입, `postTuningRequestsBatch`
- `src/lib/group-name.ts` — `buildDefaultGroupName(source, userName, count, date)` 헬퍼
- `src/lib/alias-util.ts` — `stripRetuneSuffix` 헬퍼
- `src/mocks/workItems.ts` — `WorkItem` 인터페이스 (groupId, groupName, groupRequestCount, requestSource, instanceId)
- `src/components/common/ErrorBoundary.tsx` — 흰 화면 다중 방어

**백엔드 의존 (§API)**:
- `GET /api/tuning/requests` — list (group 메타 6키 + is_estimated + result_match + plan_hash 노출)
- `GET /api/tuning/requests/{id}` — detail (performance[].plan_hash, schema_name 노출)
- `POST /api/tuning/requests/batch` — 단건/일괄 통합 (1 group + N requests 트랜잭션, parent group_id 승계)
- `POST /api/tuning/requests/{id}/approve|reject|apply` — 상태 전이

**DB 의존 (§Schema)**:
- `tuning_requests` — request 단위 (`group_id` FK, `parent_request_id`, `schema_name`, `result_match`)
- `tuning_request_group` — 그룹 단위 (`llm_id`, `user_id`, `instance_id`, `request_count`)
- `instances` — 대상 DB (db_instances 통합 후 단일)
- `users` — 운영자 (legacy_console_id 보존)
- `llm_models` — LLM 설정 정규화

자세한 컬럼 정의는 `spec-backend-schema.md` 참조.

---

## 검증 체크포인트

- [ ] 뷰 모드 토글 좌측 `리스트 뷰` 우측 `그룹 뷰` 노출
- [ ] 그룹 뷰 단건 그룹 1건 카드 노출 (다건과 동일 레이아웃)
- [ ] 그룹 카드 헤더에 진행률 게이지 + 4 카테고리 카운트 + 요청일시 표시
- [ ] 그룹 펼친 상태에서 그룹 A 헤더 체크 → A children 만 selected, 다른 그룹 영향 없음
- [ ] 자식 row 단건 체크 → 부모 헤더 indeterminate
- [ ] 트리 평탄화: root 펼치면 자식·손자 모두 1단계 indent (`└`)
- [ ] 자식 row 에 chevron 부재 (chevron 은 root 만)
- [ ] chevron 옆 자식 수 = 후손 전체 합
- [ ] default chevron 접힘 (사용자 클릭 시 펼침)
- [ ] 같은 sql_id 별 시기 신규 2건 → 별개 root (트리 묶임 없음)
- [ ] parent.group_id == child.group_id 일 때만 자식 indent
- [ ] 재튜닝 시 parent group_id 승계 → 같은 그룹 카드 안에서 자식
- [ ] 재튜닝 alias 카운터 +1 증가 (root 기준 BFS 후손 max+1)
- [ ] failed/no_improve 상태도 재튜닝 버튼 노출
- [ ] no_improve 가 KPI 의 완료 카테고리에 포함
- [ ] 흰 화면 없음 / tsc 0 / CSV export 정상

---

## 미구현 · 한계

| 항목 | 상태 | 영향 |
|------|------|------|
| result_match 결과셋 비교 | TODO | 현재 NULL 고정. 비교 로직 미구현 |
| 실측/예상 뱃지 | TODO | is_estimated 값은 백엔드 적재됨. UI 표시 자리만 유지, 매핑 로직 미구현 |
| 요청자 필터 옵션 | DEFER | 사용자 명세 확정 후 활성화 |
| MaxGauge 출처 | TODO | 출처 옵션·뱃지 정의 완료, 데이터 미수집 |
| 인덱스 포함 안의 실측 | LIMIT | 실측 불가 → "예상" 표시 |
| 1440px 반응형 | DEFER | 가로 스크롤 허용 |
