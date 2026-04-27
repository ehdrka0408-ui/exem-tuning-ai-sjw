# 작업 상세 — 검토

## 화면 목적

선택한 튜닝 건의 AI 분석 결과를 상세히 보여주고, SQL/Plan 비교를 통해 승인·반려·재튜닝 판단을 내린다. 목록에서 행 클릭 시 우측 슬라이드 패널로 열리며, 워크스페이스에서도 동일 콘텐츠를 표시한다.

기본 탭은 상태와 무관하게 항상 검토 탭이다. *

---

## 레이아웃

### 슬라이드 패널
- 기본 너비: 뷰포트 40% (`defaultWidthRatio: 0.4`)
- 최소 너비: 320px
- 최대 너비: 뷰포트 95%
- 리사이즈: 좌측 핸들 드래그 (5px 영역)
- 최대화 모드: 뷰포트 100%
- 열기/닫기 애니메이션: transform 200ms ease-out
- 너비 변경 애니메이션: width 200ms (드래그 중에는 transform만)

### 내부 여백
- 헤더: px-4 py-1.5
- 본문: 각 섹션 p-6, 섹션 간 간격 space-y-6

### 반응형
- 900px 미만: SQL/Plan 좌우 비교 → Before/After 탭 전환

---

## Description

### (1) 메타 정보

**1. 내용**
- 해당 튜닝 건의 기본 식별 정보를 한 줄로 보여준다.

**2. 구성**
- a. 인스턴스명
- b. 스키마명
- c. 생성일시
- d. 예상 일일 수행횟수
- e. 출처 배지 — AWR / V$SQL / MaxGauge
- f. 실측/예상 배지 — 실측 / 실측(T/O) / 예상 — **현 단계 값 비움** (향후 `sql_performance.is_estimated` 매핑)
- g. 결과일치 경고 — 불일치 시 "결과 불일치" 표시 — **현 단계 값 비움** (`result_match` 컬럼 NULL 고정, 비교 로직 미구현)

**3. 동작**
- 없음 (읽기 전용)

---

### (2) 성능 메트릭

**1. 내용**
- Before/After 성능 수치와 개선율을 요약 비교한다. 방어 로직으로 미수집 데이터를 정확히 구분해 표시한다.

**2. 구성**
- a. **Elapsed Time** — Before 값 / After 값 / 개선율 (Second 단위, 내부는 ms 로 변환)
- b. **Buffer Gets** — Before 값 / After 값 / 개선율 (Count 단위)
- c. **`MetricCompareCard` 컴포넌트** 사용 (재사용 컴포넌트)
 - Props: `original: number | undefined`, `tuned: number | undefined`, `unit`, `better: 'lower' | 'higher'`
 - **undefined 허용**: 미수집 시 "—" 렌더, 개선율 계산 스킵
- d. **값 원천**
 - 기본: Xplan `A-Time` / `Buffers` (Id=0 SELECT STATEMENT 행 파싱값)
 - Fallback: gv$sql `SUM(elapsed_time)/1e6`, `SUM(buffer_gets)` (Xplan 파싱 실패 시)

**3. 동작**
- a. **개선 시 초록색 ↓ / 악화 시 빨간색 ↑** — rate 부호 기반 방향 분기
- b. **rate null / 0 / undefined 시 "—"** — 비교 불가 표시. 개선율 뱃지 렌더 생략
- c. **개선율 산식**: `useTotals()` 조건에 따라 분기
 - 기본(per-exec): `((before/before_exec) − (after/after_exec)) / (before/before_exec) × 100`
 - totals fallback (plan_hash 동일 또는 executions 비율 > 5배): `(before − after) / before × 100`
- d. **before = 0 또는 before/after 하나라도 undefined** — rate null 반환 → "—"

---

### ~~(3) 복수 튜닝안 선택~~ — 제거 *(4/23 변경)*

> **1건 1안 원칙**: 하나의 튜닝 건은 하나의 튜닝안만 갖는다. 복수 튜닝안 선택 UI 제거.
> - 인덱스 생성이 필요한 경우에도 단일 안으로 제시
> - 튜닝 유형 태그(인덱스 · 힌트 · 리라이트)는 성능 메트릭 영역에 표시
> - 인덱스 포함 안은 실측 불가이므로 After = "—", 실측/예상 = "예상"

---

### (4) AI 분석 근거

**1. 내용**
- AI가 이 튜닝안을 제시한 이유를 보여준다.

**2. 구성**
- a. 요약 — 1~2줄 핵심 설명. 원본은 `tuning_requests.rationale` 컬럼
- b. 상세 근거 목록 — 접기/펼치기 (기본 접힘)
 - 인덱스 생성 전략
 - 힌트 추가 근거
 - SQL Rewrite 대안
 - 검증 방식

**3. 동작**
- a. 요약 영역 클릭 → 상세 근거 펼침/접힘
- b. 실패 케이스 (`status='failed'`) 의 경우 rationale 에 실패 사유 기록되어 표시 (예: `"LLM call failed after 3 retries"`, `"3회 시도 모두 개선율 10% 미달 [no_improve]"`)
- c. 반려 케이스 (`status='rejected'`) 의 경우 rationale 에 `[reject:reason]` 형태로 append 된 운영자 사유 포함

---

### (5) 바인드 변수

**1. 내용**
- AI가 튜닝 시 사용한 바인드 변수 세트를 보여준다.

**2. 구성**
- a. 변수 테이블 — 변수명 / 타입 / 값 (원본: `sql_bind_variables` 테이블)
- b. 캡처 시점 (`captured_at`)
- c. 복사 버튼
- d. "바인드 검증" 버튼 — 수집된 세트가 여러 개일 때 표시

**3. 동작**
- a. 바인드 검증 클릭 → 바인드 변수 피벗 팝업 (행=변수, 열=캡처시점, 변동값 상단 정렬, 실행결과 Before/After 비교)
- b. 복사 클릭 → 클립보드 복사
- c. **바인드 수집 경로**: 요청 생성 시점에 프런트가 `GET /api/sql-binds?sql_id=...&source=v$sql` 로 Oracle `V$SQL_BIND_CAPTURE` / `DBA_HIST_SQLBIND` 조회 후 POST body `binds[]` 에 포함해 전송. 백엔드가 `sql_bind_variables` 에 적재
- d. 바인드 누락 시 Oracle DPY-4010 오류 → status=failed 로 마감 · rationale 에 실패 사유 기록

---

### (6) SQL / Plan 비교

**1. 내용**
- Before/After SQL과 실행계획을 나란히 비교한다.

**2. 구성**
- a. SQL 비교 — Before(좌) / After(우) 2열
- b. Plan 비교 — Before(좌) / After(우) 2열. plan_text 원천:
 - 1순위 `DBMS_XPLAN.DISPLAY_CURSOR(ALLSTATS LAST)` — 실측 A-Time/Buffers/A-Rows 포함
 - Fallback `EXPLAIN PLAN` — 논리 계획만 (A-Time 등 실측 없음)
- c. 컨트롤
 - Format 버튼 — SQL 포매팅 on/off
 - SQL Diff 버튼 — 변경사항 강조 (추가: 초록, 삭제: 빨강, 변경: 노랑) *(현재 워크스페이스 DOM 에 미구현 — spec-work-detail-workspace.md §2 참조)*
 - Plan Diff 버튼 — 실행계획 변경사항 강조 *(현재 미구현)*
 - 복사 버튼 — 각 영역 우상단
 - 크게 보기 버튼 — 각 영역 팝업으로 확대

**3. 동작**
- a. Format 토글 → SQL 들여쓰기 적용/해제
- b. Diff 토글 → 변경 부분 색상 강조 on/off
- c. 복사 클릭 → 클립보드 복사
- d. 크게 보기 클릭 → 플로팅 팝업으로 해당 영역 확대
- e. 좁은 화면(900px 미만) → 좌우 비교 대신 Before/After 탭 전환 방식
- f. **plan_hash 동일 상황**: `tuning_requests_v4.py` API 응답 `before_plan_hash == after_plan_hash` 이면 LLM 튜닝이 plan 변화를 만들지 못한 것. 이 경우 개선율 계산은 totals 방식으로 자동 전환 (`useTotals` true). 과거에는 `同plan` amber 뱃지를 표시했으나 제거됨
- g. Plan 캡처 실패 시 (커서 aging out 등) `"SQL_ID: xxx, cannot be found"` 같은 에러 문자열이 plan_text 에 저장되는 것을 방지하기 위해 백엔드가 `_is_display_cursor_missing()` 헬퍼로 감지 → EXPLAIN PLAN fallback 실행

---

### (7) 액션 버튼 (하단 고정)

**1. 내용**
- 튜닝완료 상태일 때 승인·반려·재튜닝 판단 버튼과 워크스페이스 진입 버튼을 제공한다.

**2. 구성**
- a. 승인 버튼
- b. 재튜닝 버튼
- c. 반려 버튼
- d. 상세검토 버튼 (우측) — 워크스페이스 모드 진입

**3. 동작**
- a. 승인 클릭 → 승인완료 전환, 토스트 "승인 완료", 이력에 `approved` 이벤트 추가. 검토 탭 유지 (권고안 탭 자동 전환 없음). *(4/23 변경: 1건 1안으로 단순화)*
 - 내부 호출: `POST /api/tuning/requests/{id}/approve` · 현재 status 가 `completed` 아니면 HTTP 409
- b. 재튜닝 클릭 → 튜닝대기로 복귀, 이력에 `retune_requested` 이벤트 추가, 이력 탭으로 이동
 - 내부 호출: `POST /api/tuning/requests` (신규 request) 바디에 `parent_request_id = 원본.request_id` 포함 → 목록에서 트리 자식으로 표시됨
 - alias 자동 suffix: 원본 alias + `_재튜닝(N)` — N 은 동일 asis_sql_id cohort 의 max(N)+1. 재귀 재튜닝 시 **suffix 중첩 없이 N 증분** (`_재튜닝(1)` → `_재튜닝(2)` → `_재튜닝(3)`). base 추출은 `stripRetuneSuffix` 헬퍼로 `_재튜닝(N)` · `(N)` 반복 strip
 - binds 자동 재수집: `fetchSqlBinds(sql_id)` 로 Oracle V$SQL_BIND_CAPTURE 재조회 · 실패 시 빈 배열
- c. 반려 클릭 → 반려 사유 입력 모달, 이력에 `rejected` 이벤트 추가, 이력 탭으로 이동
 - 내부 호출: `POST /api/tuning/requests/{id}/reject` · 사유(reason) 필수, 누락 시 422. `rationale` 컬럼에 `[reject:reason]` append
- d. 상세검토 클릭 → 워크스페이스 모드 진입 (→ 워크스페이스 고유 기능 명세 참조)
- e. ESC 키 → 슬라이드 패널 닫힘 (워크스페이스에서는 적용 안 함)

---

### (8) 승인완료 배너 (승인완료 상태)

**1. 내용**
- 승인 완료된 건이 검토 탭에 진입했을 때 상단에 승인완료 상태와 권고안 탭 유도를 표시한다.

**2. 구성**
- a. 배너 — 검토 탭 콘텐츠 최상단, success 배경
- b. 승인완료 아이콘 + 라벨 — CheckCircle2 + "승인 완료" (초록)
- c. 안내 텍스트 — "권고안을 확인하려면"
- d. "권고안 탭으로 이동" 버튼 (ArrowRight)

**3. 동작**
- a. 버튼 클릭 → 권고안 탭으로 전환

---

### 조건분기

| 상태 | 검토 탭 표시 |
|------|------------|
| 튜닝대기 (requested) | Before 성능수치 + Before SQL/Plan 만 표시. After 영역·개선율 "—" |
| 튜닝중 (tuning) | 진행 카드(단계 표시 + 경과시간 + 중단 버튼) + Before 정보. After 영역 "—" |
| 튜닝완료 (completed) | 검토 탭 전체 + 액션 버튼 노출 |
| 반려 (rejected) | 반려 사유 카드 (빨간색) · rationale 의 `[reject:...]` 부분 강조 표시 |
| 실패 (failed) | 실패 사유 카드 (빨간색) · rationale 의 실패 원인 표시 |
| 취소 (cancelled) | 취소 사유 + 취소일시 카드 |
| 승인 (approved) | 검토 탭 + 승인완료 배너 (§8) |
| 반영 (applied) | 검토 탭 + 반영 완료 표시 |
| 개선없음 (no_improve · 현재 failed 로 통합) | "AI 분석 완료, 개선 여지 없음" 카드 (회색) |

**성능 메트릭 분기**

| 데이터 상태 | Before 셀 | After 셀 | 개선율 뱃지 |
|-------------|----------|---------|-----------|
| 정상 (both values) | 값 표시 | 값 표시 | 양수 = ↓N% 초록 / 음수 = ↑N% 빨강 |
| After 미수집 (undefined) | 값 표시 | "—" | 표시 안 함 (rate null) |
| Before 미수집 | "—" | 값 표시 | 표시 안 함 (division by zero 방지) |
| 둘 다 미수집 | "—" | "—" | 표시 안 함 |
| rate = 0 (변동 없음) | 값 표시 | 값 표시 | "—" |
| plan_hash 동일 | 값 표시 | 값 표시 | totals 기반 계산 (per-exec 미사용) |

---

## 소스 반영 필요 항목

### 추가
- * 실패 케이스 (`status='failed'`) 시 AI 분석 근거 섹션에 실패 사유 가시화 (rationale 컬럼 기반)
- * **Xplan 값 원천 명시** — Elapsed/Buffers 가 Xplan A-Time/Buffers 기반으로 적재됨을 표시
- * **plan 동일 감지 시 totals 자동 전환** (내부 계산) — UI 뱃지는 표시하지 않음

### 변경
- * (3) 복수 튜닝안 선택 섹션 전체 제거 → 1건 1안 원칙 (4/23)
- * (7) 승인 동작: "선택된 튜닝안" 표현 제거, 단일 안 승인으로 단순화 (4/23)
- * **MetricCompareCard prop 타입** `number | undefined` 로 완화 · undefined 시 "—" 렌더
- * **개선율 방향 표시** — 양수 ↓ 초록 / 음수 ↑ 빨강 / null·0 "—"
- * **실측/예상 · 결과일치 배지** — 컬럼/자리는 유지하되 현 단계 값 비움 (is_estimated / result_match 미매핑)
- * **재튜닝 alias 규칙** — `_재튜닝(N)` 자동 suffix · binds 자동 재수집

