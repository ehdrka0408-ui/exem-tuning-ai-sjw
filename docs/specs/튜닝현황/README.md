# 튜닝현황 기능명세 — 제출용

**프로젝트**: Exem Tuning AI TF · **최신 갱신**: 2026-04-27 · **문서 언어**: 한국어

이 폴더는 Exem Tuning AI 의 **튜닝현황** 기능 (`/work` 화면 + 백엔드 API + DB 스키마) 에 대한 모든 명세를 담는다. 신규 팀원·Claude 에이전트가 폴더만 받으면 화면·백엔드·DB 전체 컨텍스트를 파악할 수 있도록 구성됐다.

> **Claude / 팀원이 본 폴더를 받았을 때**: `CLAUDE.md` 부터 → 이 README → 담당 영역 spec 순으로 읽으세요.

---

## 1. 문서 구성

### 1.1 UI 화면 명세 (기존 · 센터장 리뷰 기반)

| 파일 | 대상 |
|------|------|
| `spec-work-list.md` | 작업함 목록 — 조회·필터·테이블·배치보기 |
| `spec-work-detail-review.md` | 작업 상세 — 검토 탭 |
| `spec-work-detail-apply.md` | 작업 상세 — 권고안 탭 |
| `spec-work-detail-ops-effect.md` | 작업 상세 — 운영효과 탭 |
| `spec-work-detail-history.md` | 작업 상세 — 이력 탭 |
| `spec-work-detail-workspace.md` | 작업 상세 — 워크스페이스 (T2) |

### 1.2 내부 로직 · 백엔드 명세 (본 릴리즈 추가)

| 파일 | 대상 | 주요 내용 |
|------|------|----------|
| `spec-backend-schema.md` | PostgreSQL 데이터 모델 | 5개 테이블 · 단위 컨벤션 · CHECK/FK 제약 |
| `spec-backend-api.md` | REST API 엔드포인트 | 7개 엔드포인트 · 요청/응답 스키마 · 상태 전이 HTTP 코드 |
| `spec-backend-pipeline.md` | 튜닝 파이프라인 | 상태 전이 FSM · LLM 호출 · 재시도 · 예외 처리 |
| `spec-backend-oracle-capture.md` | Oracle 세션 캡처 | UUID marker · DBMS_XPLAN · Xplan 파싱 · gv$sql · bind 조회 |
| `spec-frontend-improvement-calc.md` | 개선률 계산 로직 | totals/per-exec · useTotals · 방향 · 0-coercion |
| `spec-frontend-retune-tree.md` | 재튜닝 트리 UX | 그룹핑 · 정렬 · 시각 구분 · 체크 전파 · 삭제 |

### 1.3 종합 화면 기획

| 파일 | 내용 |
|------|------|
| `튜닝현황_화면기획명세서_v1.md` | 캡처 10장 + 섹션별 화면 설명 |
| `튜닝현황_기능명세_v1.html` | 단일 HTML 통합 (인쇄/공유용) |
| `화면캡처/` | PNG 캡처 10장 (1920×1080) |

### 1.4 릴리즈 가이드 (배포 단위)

| 파일 | 용도 |
|------|------|
| **`spec-release-2026-04-26.md`** | **2026-04-26 튜닝현황 화면 배포 단일 진입점**. 화면 변경·의존성·검증·트러블슈팅. 본 릴리즈 이식 시 이 파일부터 |

---

## 2. 읽는 순서 — 역할별

**신규 개발자 · 백엔드 담당**
1. `spec-backend-schema.md` — 데이터 구조 이해
2. `spec-backend-api.md` — 외부 계약
3. `spec-backend-pipeline.md` — 처리 흐름
4. `spec-backend-oracle-capture.md` — Oracle 측 상세

**프런트 담당 (특히 튜닝현황 화면)**
1. **`spec-release-2026-04-26.md`** — 본 릴리즈 변경 모음·의존성·검증
2. `spec-work-list.md` — 화면 전체 구조
3. `spec-frontend-retune-tree.md` — 재튜닝 트리 내부 로직 (R-31 group_id 분기 반영)
4. `spec-frontend-improvement-calc.md` — 개선률 계산 공통 util
5. `spec-backend-api.md` — API 응답 구조 (의존)

**운영자 · 튜너 (기능 사용 관점)**
1. `튜닝현황_화면기획명세서_v1.md` — 캡처 기반 설명
2. `spec-work-list.md` — 목록 사용법
3. `spec-work-detail-review.md` — 상세 검토
4. `spec-work-detail-history.md` — 이력 확인 (구현 예정)

---

## 3. 새 팀원 온보딩 체크리스트

### 3.1 로컬 환경 요건

- Node.js 18+ · npm 9+ (프런트 Vite + React 19 + TS 5 + Tailwind v4)
- Python 3.9+ (백엔드 FastAPI + SQLAlchemy + oracledb + alembic)
- PostgreSQL 15+ 클라이언트 (psql)
- Oracle 접속 자격 (대상 DB 10.10.45.203 REPO/ETA)

### 3.2 서버 · 계정 정보 (dev)

| 대상 | 주소 | 계정 |
|------|------|------|
| 프런트 Vite | `http://10.10.45.119:3005` | - |
| 백엔드 API | `http://10.10.45.119:8000` | - |
| PostgreSQL | `10.10.45.119:5432` / exem_tuning_ai | `exemone` / `exemone` |
| Oracle 튜닝 대상 | `10.10.45.203` / REPO | `ETA` |
| vLLM (LLM 서버) | `http://10.10.48.89:8606` | (no auth) |

### 3.3 실행 방법

- 백엔드: `cd backend && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`
- 프런트: `npm run dev` (포트 3005)
- Alembic: `cd backend && alembic heads` (현재 head 확인) · `alembic upgrade head` (최신 반영)
- 서버 로그: `/tmp/backend_v2.log` (tail -f 로 실시간 확인)

### 3.4 동작 확인 E2E 시나리오

1. `http://10.10.45.119:3005/` 접속 → 좌측 사이드 "튜닝현황" 메뉴 → 목록 표시 확인
2. 상단 TopSQL 후보 선정 → 한 건 클릭 → 상세 패널 → "튜닝 요청" → status=tuning 진입
3. 약 30초~2분 후 목록 새로고침 → status=completed + 개선률 뱃지 확인
4. `curl http://10.10.45.119:8000/api/tuning/requests?limit=3 | jq '.[0]'` 로 API 응답 필드 확인

### 3.5 의존성 · 빌드 검증

- 백엔드: `python -m py_compile backend/app/api/tuning_requests_v4.py backend/app/services/tuning_pipeline_v2.py`
- 프런트 타입체크: `npx tsc --noEmit` (0 오류 필수)
- 프런트 빌드: `npm run build` (배포 전)

---

## 4. 용어집 (Glossary)

새 팀원이 문서를 읽을 때 마주치는 주요 용어의 정의.

| 용어 | 의미 |
|------|------|
| **llm_models** | LLM 설정 정규화 테이블. PK `llm_id` (R-25 에서 `id`→rename). R-26/R-27 부터 `tuning_request_group.llm_id` FK 로 참조 (구 `tuning_requests.llm_id` 는 DROP) |
| **tuning_request_group** | 튜닝 요청 묶음 단위. 그룹 공통 속성(`llm_id`, `user_id`, `instance_id`) 저장. R-26 부터 llm/user 를 요청 단위가 아닌 그룹 단위로 관리 |
| **legacy_console_id** | R-26 에서 console_users (U-001 형태) → users 이관 시 보존한 기존 ID. `users.legacy_console_id` varchar(32) 컬럼으로 참조 가능 |
| **instances / db_instances** | R-27 (예정) 까지 db_instances(1건 REPO) → instances 통합. PK 는 `instance_id`. 이관 후 db_instances 테이블 DROP |
| **llm_call_log** | LLM 호출 단위 토큰·지연·에러 로그. R-26 부터 `request_id` 가 구 `log_id` PK 를 대체하고 **PK 제약 제거** — 한 request_id 당 재시도·chunk 다건 로그 허용 |
| **schema_name** | SQL 실행 스키마. R-24 에서 `sql_texts` → `tuning_requests` 로 이동 (요청 단위 관리) |
| **AS-IS SQL** | 튜닝 대상이 되는 원본 SQL. `sql_texts.sql_type='as_is'` 로 저장 |
| **TO-BE SQL** | LLM 이 생성한 튜닝 결과 SQL. `sql_texts.sql_type='to_be'` 로 저장 |
| **phase** | SQL 실행 단계 구분. `before`(AS-IS 실측) / `after`(TO-BE 실측) / `applied`(운영 반영 후 실측) |
| **UUID marker** | 튜닝 요청마다 고유한 주석 문자열(`/* tuning_req_a1b2c3 */`)을 SQL 에 삽입해 Oracle 이 별개 `sql_id` 로 인식하도록 하는 기법. `gv$sql` 통계 오염 방지 목적 |
| **Xplan** | `DBMS_XPLAN.DISPLAY_CURSOR` 가 반환하는 실행계획 텍스트. `ALLSTATS LAST` 포맷 사용 시 A-Rows/A-Time/Buffers 실측값 포함 |
| **A-Time / A-Rows / Buffers / Starts / Reads** | Xplan 의 Id=0 SELECT STATEMENT 행에 노출되는 실측 통계 컬럼 |
| **gv$sql** | Oracle 공유풀 SQL 통계 뷰. `SUM(elapsed_time)/1e6` 등으로 누적값 조회. RAC 전 인스턴스 집계 |
| **plan_hash** | Oracle optimizer 가 선택한 실행계획의 해시값. plan_text 상단의 `"Plan hash value: N"` 을 정규식으로 추출해 `sql_plans.plan_hash` 에 저장 |
| **per-exec 정규화** | `elapsed_time_sec / executions_count` 로 1회 실행 기준 시간을 산출하는 방식. before/after 실행 횟수가 다를 때 공정 비교용 |
| **totals 방식** | 별도 나누기 없이 `(before - after) / before` 로 개선률 산출. `useTotals()` 조건 충족 시 사용 |
| **useTotals** | 개선률 계산에서 totals 로 전환할지 결정하는 헬퍼 함수. plan 동일 OR executions 비율 > 5배 시 true |
| **0-coercion** | `tunedElapsed ?? 0` 처럼 undefined 를 0 으로 강제 치환하는 위험 패턴. "N → 0" 을 "100% 개선"으로 오계산하게 함. R-11 릴리즈에서 전면 금지 |
| **`同plan` (동plan)** | before/after plan_hash 가 같을 때 LLM 튜닝 효과가 실제 plan 변화를 만들지 못했음을 경고하는 뱃지. 계산 로직(`useTotals`)은 유지됨 (뱃지 UI 는 제거됨 · 2026-04-24) |
| **재튜닝 트리** | 같은 `asis_sql_id + instance_id` 그룹의 요청을 parent_request_id 체인으로 묶은 UI 구조. 루트(최초 요청) + 자식(재튜닝) 계층 표시 |
| **invisible index** | `CREATE INDEX ... INVISIBLE` 로 생성한 index. 세션별 옵티마이저만 사용하므로 운영 구조 영향 없이 튜닝 효과 측정 가능 |
| **DISPLAY_CURSOR missing** | `DBMS_XPLAN.DISPLAY_CURSOR` 가 커서 미존재 시 예외 없이 `"SQL_ID: xxx, cannot be found"` 문자열을 반환하는 현상. `_is_display_cursor_missing()` 헬퍼로 감지 |
| **wall_clock_fallback** | gv$sql 통계 조회 실패 시 Python `time.time()` 기반 wall elapsed 로 대체. `is_estimated='Y'` 로 표시 |
| **상태 FSM** | tuning_requests.status 의 유한 상태 전이. 7종: `requested → tuning → completed → approved → applied` + 실패/반려 `failed`/`rejected` |
| **1건 1안 원칙** | 하나의 request_id 는 하나의 TO-BE SQL 만 가진다는 4/23 확정 원칙. 복수 튜닝안 선택 UI 는 제거됨 |
| **Peek (T1) · 워크스페이스 (T2)** | 상세 뷰의 3-tier progressive disclosure 중 슬라이드 패널(T1) 과 최대화 모드(T2) |
| **alias 재튜닝 suffix** | 재튜닝 요청의 alias 는 원본 + `_재튜닝(N)` 형태. N 은 동일 asis_sql_id 의 max(N)+1 |

---

## 5. 단위 · 네이밍 컨벤션 (전사 공통)

| 접미사 | 단위 | 예시 |
|--------|------|------|
| `_sec` | Second | `elapsed_time_sec`, `cpu_time_sec` |
| `_ms` | Millisecond | `latency_ms` · UI 내부 저장값 (`originalElapsed` 등) |
| `_count` | Count | `buffer_gets_count`, `executions_count`, `disk_reads_count` |
| `_at` | timestamptz | `requested_at`, `captured_at`, `completed_at` |
| `_hash` | string | `plan_hash`, `asis_sql_id_hash` |
| `_pct` | float (0.0~1.0) | `improvement_pct` |

**시간 지표**는 반드시 Second 로 저장·전송. Oracle 원값이 마이크로초 (`gv$sql.elapsed_time`) 또는 ms 포맷 (`A-Time HH:MM:SS.FF`) 이면 Second 로 변환 후 저장. UI 내부 state 는 ms 로 변환해 사용 (`Math.round(sec * 1000)`).

---

## 6. 파일 위치 · 인프라

| 영역 | 경로 |
|------|------|
| 프로젝트 루트 (원격) | `/home/exemone/exem_tuning_ai_v2` |
| 백엔드 | `backend/app/` (FastAPI) |
| 프런트 | `src/` (React + TS + Tailwind v4) |
| Alembic 마이그레이션 | `backend/alembic/versions/` (현 head: `r3m4n5o6p7q8` · R-26 rev3 완료 · rev4/5 진행 중) |
| 서버 로그 | `/tmp/backend_v2.log` |
| 테스트 데이터 | PostgreSQL `tuning_requests` / `sql_*` 테이블 |

---

## 7. 변경 이력 (릴리즈 단위)

릴리즈 코드는 `R-NN` 형태. 2026-04-23 ~ 2026-04-24 집중 개선 결과.

| 릴리즈 | 제목 | 날짜 | 주요 변경 |
|--------|------|------|----------|
| R-01 | DB 스키마 타입 통일 | 2026-04-23 | request_id/instance_id 타입 str→int 통일 · performance default 제거 · Decimal→float 직렬화 |
| R-02 | DB 스키마 동기화 검증 | 2026-04-23 | R-01 E2E 검증 · 타입 통일 회귀 없음 확인 |
| R-03 | 실측/예상·결과일치 mock 값 제거 | 2026-04-23 | WorkItem 의 `executionResult`/`integrityResult` 리터럴 제거 (타입·칼럼은 유지) |
| R-04 | 실측/예상·결과일치 빈값 렌더 검증 | 2026-04-23 | 빈값 시 "—" 렌더·1920/1440px 레이아웃 검증 |
| R-05 | Bind SQL 실패 원인 조사 | 2026-04-23 | `TopSql.tsx` 의 `binds: []` 하드코딩이 DPY-4010 원인으로 확인 |
| R-06 | TopSql binds 하드코딩 제거 | 2026-04-23 | `fetchSqlBinds(sql_id)` 기반 실제 전송 · Promise.all 병렬 fetch |
| R-07 | DISPLAY_CURSOR fallback 강화 | 2026-04-23 | `_is_display_cursor_missing()` 헬퍼로 "cannot be found" 감지 → EXPLAIN PLAN fallback |
| R-08 | plan_hash 추출·목록 API 확장 | 2026-04-23 | plan_text 에서 "Plan hash value: N" 추출해 sql_plans.plan_hash 저장 · API 에 4필드 추가 |
| R-09 | 개선률 per-exec 정규화·同plan 경고 | 2026-04-23 | `calcElapsedRate`/`calcBuffersRate` 공용 util 생성 · `同plan` amber 뱃지 |
| R-10 | after UUID marker 주입·sql_id 격리 | 2026-04-23 | `_capture_after` 에도 marker 주입 · gv$sql 통계 조회 marker 기반으로 전환 |
| R-11 | 미수집 0-coercion 제거 | 2026-04-23 | `tunedElapsed ?? 0` 강제 치환 전면 제거 · MetricCompareCard `number \| undefined` |
| R-12 | 개선률 방향 표시 수정 | 2026-04-23 | `Math.abs + ↓ 하드코딩` 패턴 제거 · rate 부호 기반 ↓↑ · 초록/빨강 분기 |
| R-13 | plan 동일 시 totals fallback | 2026-04-23 | `useTotals()` 헬퍼 추가 · plan 동일 or executions 비율 >5배 시 totals 사용 |
| R-14 | Xplan A-Time/Buffers 파싱 | 2026-04-23 | `_parse_xplan_id0()` 헬퍼 · sql_performance 적재 시 Xplan 값 우선, gv$sql fallback |
| R-15 | 재튜닝 트리 렌더링 | 2026-04-23 ~ 2026-04-24 | dedup 제거 · parent_request_id 트리 + 가상 체인 · 시각 구분 · 루트 체크 전파 |
| R-16 | `同plan` 뱃지 UI 제거 | 2026-04-24 | 계산 로직(`isSamePlan`/`useTotals`)은 유지 · UI 뱃지만 제거 |
| R-17 | 파이프라인 타임아웃 + 고아 cleanup | 2026-04-24 | `max(before_elapsed_sec × 2 + 1800, 600)` 초 deadline · uvicorn 시작 시 30분+ 고아 요청 자동 failed 전이 |
| R-18 | 재튜닝 prev 정보 주입 | 2026-04-24 | 이전 시도 최신 2개 (TO-BE SQL · rationale · plan_hash · performance · after plan_text) LLM prompt 에 prepend · "다른 접근 강제" 구체 카테고리 명시 |
| R-19 | plan_hash 동일 시 개선없음 강제 | 2026-04-24 | `_same_plan_hash()` 헬퍼 · 동일 plan_hash 면 elapsed 개선과 무관하게 재시도 · 3회 모두 동일 시 `status='failed'` · `[no_improve:same_plan_hash]` |
| R-20 | 재튜닝 schema 자동 상속 | 2026-04-24 | `body.parent_request_id` 있고 `body.schema_name` 없을 때 parent 에서 자동 상속 → ORA-00942 방지 |
| R-21 | 공백 정규화 SQL 동등성 검증 | 2026-04-24 | `_normalize_sql()` 로 이전 시도와 비교 후 동일하면 attempt 소비 없이 재시도 |
| R-22 | 흰 화면 크래시 다중 방어 | 2026-04-24 | formatNumber/formatMs/fmtElapsed null guard · `closest('button')` 체크 · ErrorBoundary 4 곳 · Vite overlay 비활성 |
| R-23 | CSV export 성능 필드 매핑 | 2026-04-24 | EXPORT_VALUE 매핑 테이블로 originalElapsed/tunedElapsed/Buffers 등 실제 WorkItem 필드로 변환 |
| R-24 | DB 스키마 재구조화 5건 | 2026-04-24 | 3 Alembic 리비전 — schema_name/result_match 이동(tuning_requests로) · `llm_models` 정규화 + `llm_id` FK · sql_performance.plan_hash 추가·42 백필 · sql_plans `request_id` DROP + UNIQUE `(sql_id, instance_id, phase, plan_hash)` |
| R-25 | PK 컬럼 리네임 + 타입 정합 | 2026-04-24 | users.id→user_id · llm_models.id→llm_id · instances.id→instance_id · tuning_requests.instance_id integer→bigint 승격 · 시퀀스명 일관 변경 · 코드 `lm.id`→`lm.llm_id` 전수 치환 |
| R-26 | 데이터 이관 + group 정규화 | 2026-04-24 | 백업 테이블 `_bak_console_users_20260424`, `_bak_db_instances_20260424` · console_users 5건→users(legacy_console_id 보존) · db_instances 1건→instances · tuning_request_group 에 llm_id/user_id 추가 + 15 그룹 이관 · llm_call_log PK 제거 + request_id 가 log_id 대체 |
| R-27 | tuning_requests 컬럼 DROP + 조회 전환 | 2026-04-24 | tuning_requests.llm_id / user_id DROP · list/detail 쿼리 `JOIN tuning_request_group g` 경유 · INSERT 경로 group 저장으로 전환 |
| R-28 | 테이블 통합 DROP | 2026-04-24 | tuning_requests.instance_id / sql_texts.instance_id FK → instances 재지정 · db_instances/console_users DROP · user_groups 는 이번 스코프 아님 |
| HOTFIX | oracle_top_sql/instances db_instances 참조 핫픽스 | 2026-04-26 | rev5 누락 사항. v$sql/awr 조회 500 발생 → instances 테이블 + 컬럼 매핑(`db_user`→`username`, `status='active'`→`is_active=true`, `db_type` 소문자) 으로 전환 · REPO password 평문 `oracle` 복원 |
| R-29 | batch 엔드포인트 + group 메타 | 2026-04-26 | `POST /api/tuning/requests/batch` 신규 (1 group + N requests 단일 트랜잭션) · 단건도 items.length=1 통합 · list/detail API 응답에 `group_id`/`request_group_name`/`request_source`/`group_request_count`/`group_scheduled_at`/`group_created_at` 6키 + `is_estimated`/`result_match` + `performance[].plan_hash` 추가 · WorkDetail.tsx schemaName 하드코딩 제거 |
| R-30 | 그룹 뷰 / 리스트 뷰 토글 + 그룹별 KPI | 2026-04-26 | 토글 [리스트 뷰 | 그룹 뷰] 2 모드(default 그룹 뷰) · 단건도 1건 그룹 카드 · 각 그룹 카드 헤더에 진행률 게이지 + 4 카테고리 카운트 · localStorage 모드 보존 · 기존 'batch' 값 → 'groups' 자동 마이그레이션 · group_name default `[방식] 유저명 요청 N건 YYMMDD HH:MM:SS` 자동 + 사용자 입력 가능 |
| R-31 | group_id 승계 + 트리 group 기준 | 2026-04-26 | 백엔드 batch/단건 엔드포인트 — 재튜닝 시 parent.group_id 승계, 신규 group INSERT skip, parent group request_count +N · 프런트 리스트 뷰 트리 그룹핑을 group_id 기준으로 변경 (parent.group_id == child.group_id 자식 인정) · group wrapper 제거, 평면 row + chevron 토글(default 펼침) |
| R-32 | 그룹 체크박스 격리 + KPI 매핑 정리 | 2026-04-26 | 그룹 헤더 체크 + 자식 row 체크 격리 (DataTable select-all 핸들러를 그룹 children 만 toggle) · `_actions`/`_workbench`/`_tree` 그룹 뷰 컬럼 제거 (조회 전용) · 그룹 뷰 KPI 매핑: `no_improve` → 완료, 실패 = `rejected/cancelled/failed` 만 · 라벨 '튜닝' → '튜닝중' (그룹 뷰 한정) |
| R-33 | 그룹 뷰 일괄 재요청 + 자식 트리 + default 접힘 | 2026-04-26 | 일괄 재요청 fix (instance_id 숫자 전송 — WorkItem 에 `instanceId(number)` 필드 추가) · 그룹 뷰 자식 영역에 parent_request_id 트리 indent · 리스트 뷰 + 그룹 뷰 default 접힘 + chevron 옆 자식 수 표기 · 손자 재요청 후 list 자동 refetch |
| R-34 | 트리 평탄화 | 2026-04-26 | 모든 후손(자식·손자·증손) 을 root 의 직접 자식 1단계(depth=1) 로 평탄 표시. chevron 토글은 root 만. 2단 트리 폐기. flatChildrenMap 구조로 buildGroupTree + 리스트 뷰 트리 일원화 |
| R-35 | 그룹 카드 헤더 요청일시 | 2026-04-26 | 그룹 카드 헤더에 `MM-DD HH:MM:SS` 형식 요청일시 표기 |
| R-36 | 재튜닝 alias 카운터 fix | 2026-04-26 | parent chain BFS 로 root 찾고 root 의 모든 후손 cohort 수집 → max(`_재튜닝(N)` suffix) +1 로 newAlias 결정. asis_sql_id_hash 의존 폐기. 손자(2단계+) retune 시에도 카운터 정상 증가. baseAlias 는 tree root.alias 기준 (사용자 결정) |
| R-37 | failed/no_improve 재튜닝 버튼 노출 | 2026-04-26 | 실패 상태(failed/no_improve)도 재튜닝 버튼 활성화 — 다시 시도 가능 |

---

## 8. 미구현 · 한계 (이식 시 주의)

| 항목 | 상태 | 영향 |
|------|------|------|
| result_match 결과셋 일치 비교 | TODO | `tuning_requests.result_match` 는 현재 NULL 고정 · UI 표시 "—" (R-24 에서 sql_performance → tuning_requests 로 이동) |
| LLM 토큰 사용량 저장 | TODO → 완료 | R-24 에서 tuning_requests 컬럼 삭제. R-26 이후 `llm_call_log` 테이블 활용 (request_id 기반, PK 제약 없이 호출별 다건 적재) |
| R-29 이관 후속 운영 액션 | TODO | users.password_hash NULL 5계정 비밀번호 재등록 · instances.password_encrypted `[MIGRATION_PLACEHOLDER]` REPO 재입력 |
| user_groups 테이블 deprecate | DEFER | console_users FK 대상이었으나 R-27 이후 참조 없음. 삭제 여부 별도 TF 판단 |
| 작업 상세 — 이력 탭 타임라인 | TODO | `spec-work-detail-history.md` 정의됨 · UI 탭 버튼 미구현 |
| 워크스페이스 Diff 토글 | TODO | 변경/추가/삭제 색상 하이라이트 계획됨 · DOM 미구현 |
| 운영효과 탭 MaxGauge 연동 | TODO | 현재 "MaxGauge 미연동" 상태 메시지만 표시 |
| CPU Time Xplan 파싱 | TODO | gv$sql 값만 사용 중. Elapsed/Buffers 와 단위 정합성 차이 주의 |
| RAC 다중 인스턴스 | LIMIT | 현재 `instances[0]` 만 사용 · 다중 노드 미지원 |
| 과거 데이터 backfill | OUT | R-08/R-10/R-14 는 신규 요청부터 적용 · 기존 데이터 재계산 없음 |
| vLLM 서버 가용성 | RISK | 10.10.48.89:8606 무응답 시 after 캡처 블로킹. 인프라 모니터링 별도 필요 |
| 1440px 뷰포트 반응형 | DEFER | 가로 스크롤 허용 · responsive column hide 는 추후 과제 |

---

## 9. 문서 갱신 규칙 (팀 이식성)

1. 새 기능·버그 수정 시 관련 `spec-*.md` 의 "소스 반영 필요 항목" 섹션에 `*` 마커로 즉시 기록
2. 변경 이력 (§7) 은 릴리즈 코드 `R-NN` 형태로 추가 · 내부 세션 번호 (`Task #N`) 는 사용하지 않음
3. 전문 용어 추가 시 §4 용어집에 1행 정의 추가
4. 큰 구조 변경은 파일 버전 증분 (`_v2.md`) · 기존 `_v1.md` 유지
5. 코드 경로·서버 IP·계정은 본 README 의 §3, §6 섹션에 갱신
6. 화면 UI 가 바뀌면 `화면캡처/` 폴더의 해당 PNG 를 재촬영해 대체

---

**문서 이식성을 위해**: 이 README 만 읽으면 새 팀원이 기능 범위·실행 환경·용어·변경 이력을 한 번에 파악할 수 있도록 구성함. 세부 동작은 각 `spec-*.md` 로 drill-down.
