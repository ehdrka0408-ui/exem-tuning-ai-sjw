# 2026-04-26 릴리즈 — 튜닝현황 화면 배포 가이드

**대상**: 튜닝현황 화면 담당자 본인 (담당 범위: `/work` 페이지, `WorkPipeline.tsx`, `WorkDetail.tsx` 등)
**비담당 영역**: TopSql / DirectInput / 백엔드 / DB 마이그레이션 → §0.2 의존성 항목으로 분리

본 파일 1건 = 튜닝현황 화면 배포·이식·검증 단일 진입점.
백엔드/DB 변경은 §0.2 와 `spec-backend-*.md` 참조.

---

## 0. 한 줄 요약 + 의존 관계

### 0.1 화면(내 영역) 변경 핵심
- 토글: `[ 리스트 뷰 | 그룹 뷰 ]` 2 모드 (배치 탭 흡수, 그룹 뷰 default)
- 그룹 뷰: 단건/다건 모두 그룹 카드. 그룹별 진행률 게이지 + 카테고리 카운트
- 리스트 뷰: 평면 row + parent_request_id + group_id 일치한 자식만 indent (chevron 토글)
- 체크박스: 리스트 뷰=row 단건, 그룹 뷰=헤더+자식 격리(그룹 children 만 toggle, 다른 그룹 영향 없음)
- KPI 매핑: 4 카테고리(`대기 / 튜닝중 / 완료 / 실패`). `no_improve` 는 완료에 포함, `rejected/cancelled/failed` 만 실패
- 재튜닝 호출: `postTuningRequestsBatch` 1회로 통합. 단건도 `items.length=1`

### 0.2 선행 의존성 (다른 팀원 책임 — 본인 배포 전 완료 확인 필요)
| 항목 | 책임 | 본인 영향 |
|------|------|----------|
| Alembic 8 리비전 적용 | 백엔드 담당 | API 응답 키가 본 화면이 기대하는 형태로 와야 함 |
| `POST /api/tuning/requests/batch` 신규 엔드포인트 | 백엔드 담당 | `handleRetune` 등 batch 호출이 200 받아야 함 |
| list/detail API 응답에 group 메타 6키 + `is_estimated`/`result_match`/`plan_hash` 노출 | 백엔드 담당 | 그룹 뷰·KPI·트리·체크 모두 의존 |
| TopSql / DirectInput 화면 변경 (group_name 입력 + batch 호출) | 다른 팀원 | 본인 `/work` 화면은 직접 영향 없음. 다만 group_name 자동 default 가 본인 그룹 카드 헤더에 그대로 표시됨 |
| `oracle_top_sql.py` / `instances.py` 핫픽스 (db_instances→instances) | 백엔드 담당 | 본 화면 영향 없음, TopSql 화면 영향 |
| REPO 비밀번호 + U-001~005 비밀번호 후속 운영 액션 | 운영 DBA / 관리자 | 본 화면 영향 없음 |

**선행 의존성 미완료 시 본인 화면이 깨질 위험**:
- batch 엔드포인트 미배포 → `handleRetune` 실패 → 재튜닝 안 됨
- list API group 메타 미노출 → 그룹 뷰 빈 화면 또는 모든 row 가 `_no_group_*` 단독 그룹

배포 직전 백엔드/DB 적용 완료 여부를 백엔드 담당자에게 명시 확인할 것.

---

## 1. 내 영역 — 변경 파일 (이식 대상)

| 파일 | 변경 핵심 |
|------|----------|
| `src/pages/work/WorkPipeline.tsx` | 뷰 모드 토글, 리스트 뷰 평면+자식 indent+chevron, 그룹 뷰(KPI+체크 격리), GroupView 컴포넌트, `handleRetune` batch 호출 |
| `src/pages/work/WorkDetail.tsx` | `schemaName: d.schema_name ?? ''` (하드코딩 제거) |
| `src/lib/api.ts` | `TuningRequestSummary`/`TuningRequestDetail` 에 group 메타 + schema_name + result_match 키 추가, `postTuningRequestsBatch` 함수 |
| `src/mocks/workItems.ts` | `WorkItem` 인터페이스에 `groupId / groupName / groupRequestCount / requestSource` 필드 추가 |
| `src/lib/group-name.ts` (신규) | `buildDefaultGroupName` 헬퍼 (재튜닝 호출 시 `[재튜닝]` prefix 사용) |
| `src/components/common/ErrorBoundary.tsx` | (직전 흰 화면 사고 방어, 기존) |

---

## 2. 화면 동작 상세

### 2.1 진입 + 모드 전환
- 라우트: `/work`
- 모드 토글: 좌측 = `리스트 뷰`, 우측 = `그룹 뷰`
- 마지막 모드 보존: localStorage 키 `workPipelineViewMode` (값 `'requests'` / `'groups'`)
- 기존 `'batch'` 값 보유한 사용자는 마운트 시 자동으로 `'groups'` 로 마이그레이션

### 2.2 리스트 뷰 (이전 'Request 뷰')

| 요소 | 동작 |
|------|------|
| 표시 단위 | row(=request) 평면 |
| 정렬 | `requested_at` DESC |
| 자식 indent 조건 | (1) `parent_request_id != null` (2) `parent.group_id == child.group_id` 둘 다 충족 |
| 자식 표시 위치 | 부모 row 바로 다음 행 (indent 1단계, `└` 커넥터) |
| Chevron 토글 | 자식 가진 root row 에 chevron 노출. default 펼침. 클릭 시 자식 hide/show |
| 체크박스 | row 단위 단건 toggle (`selectedIds: Set<string>`) |
| 그룹 wrapper | **없음** (절대 만들지 말 것) |

**예시**
```
rid=198  [root, parent=null, group=A]
└ rid=199  [child, parent=198, group=A]   ← 같은 group → indent
rid=200  [root, parent=null, group=B]
rid=201  [root, parent=null, group=A]    ← 같은 sql_id 이지만 별 시기 신규 → root
rid=202  [root, parent=199, group=B]    ← parent 다른 group → root 처리
```

### 2.3 그룹 뷰 (이전 '배치' 흡수)

| 요소 | 동작 |
|------|------|
| 그룹 키 | `group_id` |
| 그룹 카드 | 단건(1건)도 동일 카드 형태 — 빠지거나 평면 처리 금지 |
| 카드 헤더 | 그룹명 · `N건` · 요청자 · **요청일시(MM-DD HH:MM:SS)** · **진행률 % 게이지** · 카테고리 카운트(`대기/튜닝중/완료/실패`) |
| 펼치기 | chevron 으로 자식 DataTable 노출. **default 접힘** (R-33 적용 — 사용자가 chevron 클릭 시 펼침) |
| 자식 트리 | **평탄화** (R-34) — 모든 후손(자식·손자·증손)을 root 의 1단계 직접 자식(depth=1)으로 노출. 2단 트리 안 만듦. 자식 row 는 `└` 만 (chevron 부재) |
| chevron 옆 카운트 | 후손 전체 합산 (예: `펼치기 (2건)` — 자식 1 + 손자 1) |
| 체크박스 (그룹 헤더) | 해당 그룹 children 만 toggle. 다른 그룹 영향 없음. select-all 헤더 핸들러도 그룹 children 만 toggle 하도록 격리 (`onSelectAll`) |
| 체크박스 (자식 row) | row 단위 단건 toggle |
| 그룹 뷰 DataTable 컬럼 제외 | `_actions` / `_workbench` 는 그룹 뷰에선 제거 (조회 전용). `_select` / `_tree` 는 노출 |

**상단 전체 KPI** (그룹 뷰 진입 시 화면 상단 1개):
- `전체 N건 · 대기 N · 튜닝중 N · 완료 N · 실패 N · 진행률 X%`
- 그룹별 KPI 와 동일 매핑 사용

### 2.4 KPI 카테고리 매핑 (그룹 뷰 한정)

| 카테고리 | 포함 status |
|----------|-------------|
| 대기 | `pending` |
| 튜닝중 | `tuning` |
| 완료 | `approval_pending` + `apply_pending` + `applied` + **`no_improve`** |
| 실패 | `rejected` + `cancelled` + `failed` |

진행률 % = `(완료 + 실패) / 전체 × 100`

> 본체 상태 필터 버튼 (튜닝대기 / 튜닝중 / 실패 / 튜닝완료 / 승인완료 / 반려) 6 카테고리는 별도 매핑 — 변경 없음.

### 2.5 group_id 기반 트리 분기 (필수 가드)
- 같은 `asis_sql_id` 라도 group_id 가 다르면 **별개 root** 로 표시 (의도된 재튜닝만 묶이도록)
- `parent.group_id == child.group_id` 조건이 트리·체크 전반의 핵심 가드

### 2.6 트리 평탄화 (R-34, 리스트 뷰 + 그룹 뷰 공통)
- BFS 로 root 의 모든 후손을 수집해 **flat children list** 구성
- 모든 후손은 `depth = 1` 고정 (자식·손자·증손 동일 시각 indent)
- `chevron` 토글은 root(`depth = 0`) 에만. 자식 row 는 chevron 부재
- chevron 옆 자식 수 = 후손 전체 합 (예: 부모 → 자식 → 손자 면 후손 2)
- root 1번 펼치면 후손 전부 노출 — 사용자가 다단계로 펼칠 필요 없음

### 2.7 재튜닝 alias 카운터 규칙 (R-36, 자동 별칭)
**baseAlias** = parent chain 거슬러 root 찾고, root.alias 의 `_재튜닝(N)` suffix 제거한 값

**maxN** = root 의 모든 후손(BFS) 의 alias 에서 정규식 `/_재튜닝\((\d+)\)$/` 매치된 N 중 최대값

**newAlias** = `${baseAlias}_재튜닝(${maxN + 1})`

예시:
```
rid=196 alias='AWR'                       → root, baseAlias='AWR'
└ rid=217 alias='AWR_재튜닝(1)'             → 자식 (maxN=1)
  └ rid=N1 alias='AWR_재튜닝(2)'           → 손자 retune 시 (1+1)
    └ rid=N2 alias='AWR_재튜닝(3)'         → 증손 retune 시 (2+1)
```
- 자동 alias 는 항상 +1 증가
- 사용자가 직접 입력한 alias 는 그대로 보존 (예: rid=208 alias='재튜닝_검증_195' 는 사용자 수동 — 그 자식들은 baseAlias='test1' (root rid=195) 기준으로 카운터 매김)

### 2.8 재튜닝 — `handleRetune`
- `postTuningRequestsBatch` 호출 (단건도 batch 통합)
- `batch_meta.request_group_name` 자동: `buildDefaultGroupName('RETUNE', userName, 1)` → `[재튜닝] admin 요청 1건 YYMMDD HH:MM:SS`
- 백엔드가 parent_request_id 기반 group_id 승계 처리 → 같은 group 안에서 자식 트리 형성

### 2.7 흰 화면 방어
- `ErrorBoundary` 다중 레이어
- 직전 사고 회귀 방지: dead code 제거 시 `useCallback`/`useMemo` 정의 누락 절대 금지 (예: `navigateToDetail`)
- 빌드 후 `npx tsc --noEmit` 0 오류 확인 필수

---

## 3. API 응답 의존 — 화면이 기대하는 형태

### 3.1 `GET /api/tuning/requests` (목록)
```json
{
  "request_id": 175,
  "instance_id": 1,
  "instance_name": "REPO",
  "parent_request_id": null,
  "asis_sql_id": "...",
  "tobe_sql_id": "...",
  "status": "completed",
  "alias": "V$SQL",
  "schema_name": "SALES",
  "requested_at": "2026-04-26T15:00:00+09:00",
  "completed_at": "...",
  "before_elapsed_sec": 1.5,
  "after_elapsed_sec": 0.07,
  "before_buffer_gets": 66282,
  "after_buffer_gets": 1205,
  "before_executions": 1,
  "after_executions": 1,
  "before_plan_hash": "1937960388",
  "after_plan_hash": "1898327994",
  "improvement_pct": 0.95,
  "is_estimated": "N",
  "result_match": null,
  "llm_provider": "vllm",
  "llm_model": "axis-v1",
  "input_tokens": null,
  "output_tokens": null,
  "group_id": "...uuid...",
  "request_group_name": "[V$SQL] admin 요청 3건 260426 14:25:32",
  "request_source": "DIRECT",
  "group_request_count": 3,
  "group_scheduled_at": null,
  "group_created_at": "2026-04-26T14:25:32+09:00"
}
```
- `group_*` 6키, `is_estimated`/`result_match`, `before_/after_plan_hash`, `before_/after_executions` 모두 본 화면이 의존

### 3.2 `GET /api/tuning/requests/{id}` (상세)
- 위 + `performance[].plan_hash`, `plans[].plan_hash`, `bind_variables[]`, `sql_texts.{as_is,to_be}`
- `schema_name` 은 root 객체에 (WorkDetail 의 `d.schema_name` 으로 매핑)

### 3.3 `POST /api/tuning/requests/batch` (재튜닝 호출)
요청:
```json
{
  "batch_meta": {
    "request_group_name": "[재튜닝] admin 요청 1건 260426 16:00:00",
    "request_source": "RETUNE",
    "instance_id": 1
  },
  "items": [
    {"sql_text":"...","schema_name":"SALES","binds":[...],"alias":"V$SQL_재튜닝(1)","parent_request_id":175,"auto_tune":true}
  ]
}
```
응답:
```json
{
  "group_id": "...",
  "request_count": 1,
  "requests": [{"request_id": 199, "status": "requested", "asis_sql_id": "...", "alias": "..."}]
}
```

---

## 4. 검증 체크리스트 (배포 직후, 본 화면 한정)

### 4.1 모드·표시
- [ ] `/work` 진입 → 토글 `[ 리스트 뷰 | 그룹 뷰 ]` 2개만 노출 (배치 탭 부재)
- [ ] localStorage `workPipelineViewMode` 마지막 값 복원
- [ ] 기존 `'batch'` 값 → `'groups'` 자동 마이그레이션 1회

### 4.2 리스트 뷰
- [ ] 평면 row 리스트 (group wrapper 없음)
- [ ] 자식 가진 root 에 chevron 노출 + 클릭 시 자식 hide/show
- [ ] 자식 row 가 `└` 커넥터 + indent 1단계
- [ ] 같은 sql_id 별 시기 신규 2건 → 별개 root (트리 묶임 없음)
- [ ] parent.group_id == child.group_id 일 때만 자식 indent
- [ ] 자식 row 단건 체크 → 그 row 만 selected

### 4.3 그룹 뷰
- [ ] 단건 그룹도 1건 카드로 노출 (빠지지 않음)
- [ ] 그룹 카드 헤더에 진행률 게이지 + `대기 / 튜닝중 / 완료 / 실패` 카운트 표시
- [ ] 펼치기 chevron → 자식 DataTable 노출
- [ ] 펼친 상태에서 그룹 A 헤더 체크 → A children 만 selected, 다른 그룹 영향 없음
- [ ] 자식 row 단건 체크 → 부모 헤더 indeterminate
- [ ] 그룹 A 자식 모두 체크 → A 헤더 fully checked
- [ ] A 헤더 해제 → A 만 deselect, B 선택 유지
- [ ] `_actions` / `_workbench` / `_tree` 컬럼 그룹 뷰에서 부재
- [ ] 상단 전체 KPI: 대기/튜닝중/완료/실패/% 정상

### 4.4 재튜닝 (handleRetune / handleBulkRetune)
- [ ] 단건 재튜닝 → batch 엔드포인트 200 응답
- [ ] 일괄 재튜닝 → 선택된 BE-{N} item 들이 모두 batch 호출, 새 row 들이 parent group 으로 합류
- [ ] 새 request 의 group_id 가 parent group_id 와 동일 (R-31 group_id 승계)
- [ ] 그룹 뷰에서 같은 그룹 카드 안에 자식으로 표시
- [ ] 리스트 뷰에서 부모 row 바로 아래 indent
- [ ] **재튜닝(N) 별칭 카운터 +1 증가**: 같은 root tree (parent chain) 의 후손 alias 중 max(N) 추출 → newAlias = `{baseAlias}_재튜닝({maxN+1})`
- [ ] 손자(2단계) 재튜닝 시에도 alias 가 root 의 cohort 기준으로 카운터 증가 (예: `_재튜닝(1)` → `_재튜닝(2)` → `_재튜닝(3)`)
- [ ] 재튜닝 후 list 자동 refetch 로 화면 즉시 갱신 (새로고침 없이)
- [ ] `instance_id` 자리에 number 전달 (instanceId 필드 사용. instanceName 문자열 보내면 422)

### 4.5 KPI 카테고리
- [ ] no_improve 상태 row 가 완료 카운트에 포함
- [ ] rejected/cancelled/failed 만 실패에 포함

### 4.6 트리 표시 (리스트 뷰 + 그룹 뷰 공통, R-33 ~ R-35)
- [ ] 모든 후손(자식·손자·증손) 이 root 의 직접 자식(depth=1) 으로 평탄화 노출 — 2단 트리 안 만듦
- [ ] chevron 토글은 root 만 (자식 row 에 chevron 부재)
- [ ] chevron 옆 자식 수 숫자 표기 (`펼치기 (N건)`) — 후손 전체 합산
- [ ] default **접힘** (사용자가 chevron 클릭 시 펼침)
- [ ] 자식 row indent + `└` 커넥터
- [ ] 그룹 뷰의 그룹 카드 헤더에 **요청일시** 표시 (예: `04-26 15:00:13`)

### 4.7 회귀
- [ ] 흰 화면 없음 (콘솔 0 에러)
- [ ] CSV export 정상 (Elapsed/Buffers 필드 살아있음)
- [ ] 상세 패널 진입 시 schema_name 정상 표시
- [ ] tsc 0 / 빌드 정상

---

## 5. 트러블슈팅 (본 화면 관련)

| 증상 | 원인 | 해결 |
|------|------|------|
| `/work` 흰 화면 | dead code 제거 후 `xxx is not defined` (예: navigateToDetail) | ErrorBoundary stack trace 확인 → 정의 복원 |
| 그룹 뷰가 빈 화면 / 모든 row 가 단독 그룹 | list API 응답에 `group_id` 누락 | 백엔드 담당자에게 §0.2 의존성 적용 확인 |
| 단건 요청이 그룹 뷰에 안 보임 | GroupView 그룹핑 키가 group_id 만 사용 + null 처리 누락 | 키 fallback `item.groupId ?? item.batchId ?? \`req:${item.id}\`` |
| 같은 sql_id 별 시기 요청이 트리로 묶임 | parent-child 매칭에 group_id 가드 누락 | parent.group_id == child.group_id 조건 추가 |
| 펼친 상태 그룹 체크 시 다른 그룹도 체크 | DataTable select-all 헤더 핸들러가 전체 toggle | 그룹별 DataTable 의 `onSelectAll` 을 `handleGroupToggle(group, checked)` 로 override |
| 일괄 요청 시 그룹이 N개 생성 | 프런트가 단건 N회 호출 | `postTuningRequestsBatch` 1회 호출로 통합 (TopSql 담당 영역) |
| no_improve row 가 실패에 카운트 | KPI 매핑 미적용 | §2.4 매핑으로 수정 |
| 그룹 뷰 일괄 재요청 시 422 / silent fail | `instance_id` 슬롯에 instanceName 문자열 전송 | `instance_id: it.instanceId ?? it.instanceName`. WorkItem 에 `instanceId` (number) 필드 추가 + summary 매핑 |
| 손자 row 가 화면에 안 추가 | 재튜닝 후 list refetch 누락 | handleRetune / handleBulkRetune 의 onConfirm 마지막에 `refreshBackendItems()` 호출 |
| 자식 row chevron 부재 | 의도된 동작 (R-34 평탄화 — 모든 후손이 root 1단계로 평탄) | 평탄화 스펙 그대로 |
| 재튜닝(N) 카운터 +1 증가 안 됨 | parent chain BFS cohort 수집 / alias regex / samples stale 중 하나 | 콘솔 로그로 cohort/maxN 출력해 원인 특정 후 fix. 일반적으로 root 후손 BFS + `/_재튜닝\((\d+)\)$/` 매치 필요 |

---

## 6. 변경 이력 (튜닝현황 화면 관련만)

| R | 날짜 | 제목 |
|---|------|------|
| R-29 | 2026-04-26 | 그룹 뷰 / 리스트 뷰 토글 + 그룹별 KPI · 단건 그룹 카드 보장 · KPI 헤더 통합 |
| R-30 | 2026-04-26 | 리스트 뷰 평면화 + parent_request_id + group_id 일치 자식 indent + chevron 토글 부활 |
| R-31 | 2026-04-26 | group_id 기반 트리 분기 + 그룹 체크박스 격리 (헤더 + 자식 row + select-all 격리) |
| R-32 | 2026-04-26 | KPI 매핑 정리 (no_improve→완료) + 라벨 '튜닝'→'튜닝중' (그룹 뷰 한정) |
| R-33 | 2026-04-26 | 그룹 뷰 일괄 재요청 fix (instance_id 숫자 전송) + 그룹 뷰 자식 영역에도 트리 indent + 트리 default 접힘 + chevron 옆 자식 수 표기 + 손자 재요청 후 list 자동 refetch |
| R-34 | 2026-04-26 | **트리 평탄화** — 모든 후손(자식·손자·증손) 을 root 의 1단계 직접 자식(depth=1)으로 표시. chevron 토글은 root 만. 2단 트리 폐기 |
| R-35 | 2026-04-26 | 그룹 카드 헤더에 **요청일시** 표시 추가 (`MM-DD HH:MM:SS`) |
| R-36 | 2026-04-26 | **재튜닝 alias 카운터 fix** — parent chain BFS 로 root 찾고 root 의 모든 후손 cohort 수집, 후손 alias 의 `_재튜닝(N)` suffix 중 max(N) +1 로 newAlias 결정. 손자(2단계) 도 정상 카운터 증가. baseAlias 는 **tree root.alias** 기준(사용자 결정) — 중간 자식 row alias 가 수동 변경되어도 root 까지 거슬러 올라가 일관 유지 |
| R-37 | 2026-04-26 | **failed / no_improve 상태도 재튜닝 버튼 노출** — 이전엔 정상 종료(completed/approved/applied) 만 재튜닝 가능했으나, 실패한 SQL 도 다시 시도 가능해야 자연스러우므로 재튜닝 버튼 노출 추가 |

(R-24 ~ R-28 은 백엔드/DB 영역 — `spec-backend-schema.md` §"R-25 ~ R-29" 참조)

---

## 7. 본 화면이 의존하는 다른 spec 파일

| 파일 | 본 화면이 참조하는 부분 |
|------|----------------------|
| `spec-backend-api.md` | list/detail/batch API 요청·응답 스키마 |
| `spec-backend-schema.md` | tuning_requests / tuning_request_group / instances / users / llm_models 컬럼 정의 |
| `spec-frontend-improvement-calc.md` | 개선률 계산 (백엔드 `improvement_pct` 우선) |
| `spec-frontend-retune-tree.md` | 재튜닝 트리 UX (이번 릴리즈에서 group_id 기반으로 재정의) |
| `spec-work-list.md` 외 | 다른 화면 명세 (참고용) |

---

## 8. 배포 직후 본인이 확인할 5가지 (요약)

1. `/work` 진입 → 토글 2개 노출, 그룹 뷰 default
2. 그룹 뷰: 단건/다건 모두 카드 + 진행률 게이지 + 4 카테고리 카운트
3. 펼친 상태 그룹 체크 격리 (다른 그룹 영향 없음)
4. 리스트 뷰: 평면 + 자식 indent + chevron 토글
5. 재튜닝 1건 실행 → 같은 그룹 안에서 자식 표시

5가지 모두 정상이면 배포 성공. 1개라도 실패면 §5 트러블슈팅 → 백엔드 의존성(§0.2) 재확인 → 본 코드 회귀 점검.
