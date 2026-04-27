# 백엔드 — 튜닝 파이프라인 (상태 전이 · LLM)

## 문서 목적

POST /api/tuning/requests 호출 후 백엔드가 수행하는 단계별 파이프라인과 상태 전이(finite state) 로직을 정의한다. 구현 파일: `backend/app/api/tuning_requests_v4.py`, `backend/app/services/tuning_pipeline_v2.py`.

### 처리 대상 단위

- 1건 1안 원칙: 하나의 튜닝 요청(request_id)은 하나의 TO-BE SQL 만 가진다
- 재튜닝은 별도 request_id 로 생성하며 `parent_request_id` 로 원본과 연결
- 단건/일괄 진입은 **`POST /api/tuning/requests/batch`** 단일 엔드포인트로 통합 (단건도 `items.length=1` batch 호출). 기존 `POST /api/tuning/requests` 단건 엔드포인트는 호환 유지.

### 진입 처리 — group_id 채번 / 승계

batch 엔드포인트가 1 트랜잭션 안에서:
1. **group 결정**:
   - `item.parent_request_id` 있음 → parent 의 `tuning_request_group.group_id` 를 그대로 승계, parent group 의 `request_count +=1` UPDATE
   - 없음 → `batch_meta` 로 신규 group INSERT (한 batch 안 신규 item 들은 같은 신규 group 공유, `request_count` = 신규 item 수)
   - 같은 batch 안에 parent 가진 item + 신규 item 혼재(mixed) → parent group / 신규 group 분리 처리
2. **각 item INSERT**: sql_texts UPSERT → tuning_requests INSERT(같은 group_id, 새 request_id 채번) → sql_bind_variables INSERT
3. **COMMIT** 후 **비동기**로 `run_tuning_job(request_id)` N 번 실행. 각 request 독립이라 일부 실패가 다른 request 영향 없음
4. 어떤 item INSERT 실패 시 전체 ROLLBACK

> 결과적으로 같은 sql_id 라도 별 시기에 별 batch 로 들어오면 별 group 으로 분리되고, 의도된 재튜닝(`parent_request_id` 명시)만 같은 group 에 누적된다. 사용자 시점에서 그룹 = 의도된 재튜닝 체인.

---

## Description

### (1) 상태 전이 FSM

**1. 내용**
- 요청 생성부터 운영 반영까지의 상태 흐름을 정의한다. 허용되지 않은 전이는 HTTP 409 로 차단.

**2. 구성**

```
requested ──> tuning ──> completed ──> approved ──> applied
 │ │ │
 └──> failed └──> rejected (reason 필수)
```

상태별 의미:

| 상태 | 의미 | 진입 시점 |
|------|------|----------|
| requested | 요청 접수, 파이프라인 대기 | 생성 직후 |
| tuning | before 캡처 완료, LLM 호출 중 | _capture_before 성공 후 |
| completed | after 캡처까지 완료, 운영자 검토 대기 | _capture_after + 적재 완료 |
| approved | 운영자 승인 | POST /approve |
| applied | 운영 반영 완료 | POST /apply |
| failed | 파이프라인 실패 (exec_err, LLM 실패 3회, bind 미수신 등) | 예외 catch 지점 |
| rejected | 운영자 반려 (사유 필수) | POST /reject |

**3. 동작**
- a. `_enforce_transition(request_id, target)` 가드 함수가 허용된 pre-state 집합 검증
- b. 전이 규칙: `approved ← completed` / `rejected ← completed` / `applied ← approved`
- c. 위반 시 HTTP 409 Conflict · 응답 body 에 현재 status 포함
- d. rejected 시 rationale 컬럼에 `[reject:reason]` append

---

### (2) before 캡처 단계 — `_capture_before`

**1. 내용**
- AS-IS SQL 을 UUID marker 와 함께 Oracle 에서 실행하고 성능·실행계획을 적재한다.

**2. 구성**

파이프라인 순서:

```
① UUID marker 생성 — marker = "tuning_req_" + uuid.uuid4().hex[:12]
② SQL 태깅 — /*+ gather_plan_statistics */ /* {marker} */
③ Oracle 세션 설정 — ALTER SESSION SET STATISTICS_LEVEL = ALL
④ 스키마 설정 — ALTER SESSION SET CURRENT_SCHEMA = {schema}
⑤ SQL 실행 — cur.execute(tagged_sql, bind_dict)
⑥ marker 기반 sql_id 조회 — v$sql WHERE sql_text LIKE '%{marker}%'
 (prev_sql_id fallback)
⑦ plan 캡처 — DBMS_XPLAN.DISPLAY_CURSOR(sql_id, child, 'ALLSTATS LAST')
 (_is_display_cursor_missing 감지 시 EXPLAIN PLAN fallback)
⑧ Xplan 파싱 — _parse_xplan_id0 → A-Time/Buffers/A-Rows/Starts/Reads
⑨ sql_performance INSERT (phase='before')
 — Xplan 값 우선, gv$sql SUM 값 fallback, is_estimated='N'
⑩ plan_hash 추출 — _extract_plan_hash(plan_text)
⑪ sql_plans INSERT (phase='before')
```

**3. 동작**
- a. marker 주입으로 sql_id 가 매 요청마다 unique → gv$sql 통계 격리
- b. Oracle 실행 실패 (ex: DPY-4010 bind 미수신) 시 예외 catch → exec_err 세팅 → 상위에서 status='failed' UPDATE
- c. DISPLAY_CURSOR 가 "cannot be found" 에러 row 반환 시 RuntimeError 로 EXPLAIN PLAN fallback 트리거
- d. plan_text 는 `trim_plan_header()` 로 불필요 공백 정리 후 저장

---

### (3) LLM 호출 단계 — vLLM

**1. 내용**
- before 성능·plan 과 AS-IS SQL 을 vLLM 에 전달해 TO-BE SQL 을 생성한다.

**2. 구성**

- 서버: `http://10.10.48.89:8606` (정규화 테이블 `llm_models.endpoint_url` 에 저장)
- 모델: `axis-v1` (LoRA on Qwen2.5-Coder-32B) — `llm_models.model_name`
- 클라이언트: `app/services/local_llm_client.py` — `llm_id` 로 `llm_models` 에서 endpoint/token/temperature resolve
- 타임아웃: 60s · 재시도: 최대 3회

요청 prompt 포함 항목:
- AS-IS SQL 원문
- before plan_text (ALLSTATS LAST)
- before performance 요약 (elapsed, buffers, executions)
- schema 메타 (테이블/컬럼/인덱스)
- user_instruction (있을 때)

응답 JSON:
```json
{
 "tuned_sql": "SELECT /*+ INDEX(...) */ ...",
 "rationale": "FULL TABLE SCAN 제거를 위해 인덱스 힌트 추가...",
 "index_ddls": ["CREATE INDEX ... ON ..."]
}
```

**3. 동작**
- a. status → 'tuning' UPDATE
- b. **R-26/R-27 이후**: `tuning_request_group` 에 `llm_id(llm_models FK)` 저장. `tuning_requests` 에는 `latency_ms` 만 기록. provider/model 은 `tr → g → llm_models` 조인으로 응답에 노출
- c. rationale 컬럼에 LLM 응답의 rationale 저장
- d. sql_texts UPSERT (sql_type='to_be')
- e. 토큰 사용량(input/output)은 **`llm_call_log` 테이블** 에 호출 단위로 적재 (request_id 가 기존 log_id PK 를 대체, PK 제약 없이 로그형 다건 허용)
- e. 실패 시나리오:
 - 타임아웃/HTTP 오류 → 재시도 (최대 3)
 - 3회 실패 → status='failed' · rationale="LLM call failed after 3 retries"
 - tuned_sql 빈 응답 → 재시도

---

### (4) after 캡처 단계 — `_capture_after`

**1. 내용**
- LLM 이 생성한 TO-BE SQL 과 index_ddls 를 Oracle 에 적용해 after 성능·plan 을 측정한다.

**2. 구성**

파이프라인 순서 (before 와 유사하되 추가 단계 있음):

```
① invisible index 생성 (index_ddls 있을 때만)
 ALTER SESSION SET OPTIMIZER_USE_INVISIBLE_INDEXES = TRUE
 + 각 DDL 의 CREATE INDEX 에 INVISIBLE 키워드 주입
② UUID marker 주입 (before 와 동일)
③ 나머지 단계 (③~⑪) before 와 동일
```

**3. 동작**
- a. invisible index 는 운영 구조에 영향 없음 (옵티마이저는 이 세션에서만 사용)
- b. DDL 실행 실패는 warning 로그만 · created_indexes 리스트에서 제외
- c. wall_clock_fallback: gv$sql 통계 조회 실패 시 Python `time.time()` 기반 wall elapsed 로 대체 · is_estimated='Y' 마킹
- d. 개선 판정: `_improvement(before, after)` 호출 → useTotals 조건 분기 적용 후 rate 계산
- e. 개선 < 10% 시 재시도 flag 설정 → 최대 3회 LLM 재호출

---

### (5) 재시도 로직 (no_improve)

**1. 내용**
- LLM 튜닝 결과 개선이 미약한 경우 다른 힌트/접근으로 재시도한다.

**2. 구성**
- 조건: 개선률 < 10% (per-exec 또는 useTotals 조건에 따른 rate 기준)
- 최대 횟수: 3회
- 재시도 prompt 에 이전 시도의 tuned_sql 과 rationale 포함 (중복 회피)

**3. 동작**
- a. 3회 모두 개선 10% 미달 시 status='failed' · rationale="3회 시도 모두 개선율 10% 미달"
- b. rationale 에 최종 시도의 lastRationale + `[no_improve]` 태그
- c. 성공 시 status='completed' · completed_at = now()

---

### (6) 예외 처리 · 방어 로직

**1. 내용**
- 파이프라인 각 단계의 예외를 명시적으로 catch 해 status='failed' 로 종결한다.

**2. 구성**

| 단계 | 예외 | 처리 |
|------|------|------|
| before 실행 | DPY-4010 (bind 미수신) | exec_err 세팅 → status='failed' |
| before plan 캡처 | DISPLAY_CURSOR "cannot be found" | RuntimeError → EXPLAIN PLAN fallback |
| LLM 호출 | Timeout 60s | 3회 재시도 후 status='failed' |
| LLM 응답 | invalid JSON / empty tuned_sql | 재시도 |
| after 실행 | Oracle 예외 | exec_err · status='failed' |
| invisible index 생성 | ORA-01408 등 | warning 로그 · 해당 index 건너뛰고 진행 |
| gv$sql 통계 | 빈 결과 (세션 단절 등) | wall_clock_fallback 발동 · is_estimated='Y' |

**3. 동작**
- a. status='failed' 전이 시 completed_at = now() 갱신 안 함 (미완료 표식)
- b. rationale 에 실패 원인 한 줄 기록 (운영자 가시화)
- c. 예외 대응 후 응답은 HTTP 200 (status 로 실패 구분) — 클라이언트는 status='failed' 로 실패 처리

---

### (7) 조건분기

| 입력 조건 | 결과 |
|----------|------|
| binds 배열 비어있고 SQL 에 `:xxx` 플레이스홀더 존재 | Oracle DPY-4010 → status='failed' |
| LLM 이 동일 plan_hash 를 생성 (optimizer 가 같은 plan 선택) | status='completed' 되지만 前plan = after_plan_hash → 프런트 `同plan` 경고 |
| index_ddls 가 비어있음 | invisible index 단계 건너뜀 |
| schema_name 없음 | ALTER SESSION CURRENT_SCHEMA 건너뜀 (디폴트 스키마 사용) |
| parent_request_id 지정 | tuning_requests.parent_request_id 에 저장 → 프런트 트리 렌더에 활용 |
| auto_tune=false | LLM 호출 건너뛰고 status='requested' 유지 (수동 튜닝 입력 대기) |

---

## 소스 반영 필요 항목

### 추가
- * UUID marker 주입을 `_capture_after` 에도 적용해 sql_id 격리)
- * gv$sql 통계 조회가 `captured_sql_id`(marker 기반)를 1차로 사용하고, None 일 때만 prev_sql_id fallback)
- * `_is_display_cursor_missing()` 헬퍼 추가 — before/after 양쪽에 적용)
- * before INSERT 에 plan_hash 컬럼 추가)

### 변경
- * 통계 소스 우선순위: gv$sql SUM → Xplan A-Time/Buffers 우선으로 전환
- * exec_err 발생 시 rationale 에 명확한 메시지 기록 (DPY-4010 원문 노출 대신)
- * 파이프라인 전체 타임아웃 도입 (4/24) — `max(before_elapsed_sec × 2 + 1800, 600)` 초. 각 재시도 attempt 진입 시 deadline 체크 → 초과 시 `status='failed'` · rationale 에 `[timeout] 파이프라인 실행 제한 시간 초과` append
- * Startup lifespan 훅 추가 (4/24) — uvicorn 시작 시 `requested`/`tuning` 상태에서 30분 이상 경과한 고아 요청 자동 `status='failed'` 전이 · rationale 에 `[timeout:server restart cleanup · <ts>]` 기록
- * 재튜닝 LLM prompt 에 **이전 시도 최신 2개 정보 주입** (4/24) — parent_request_id 체인 따라 이전 TO-BE SQL · rationale · after plan · after 성능 · plan_hash 수집해 prompt 상단 "이전 튜닝 시도 정보" 섹션으로 prepend. LLM 이 동일 접근 반복 회피하도록 유도
- * LLM prompt 에 **"다른 접근 강제" 명시 문구 추가** (4/24) — 실험 결과 단순 "다른 접근" 지시만으로는 axis-v1 LoRA 가 같은 SQL 반복하므로, 이전 TO-BE 와 공백만 다른 SQL 출력 금지 + 힌트(INDEX/NO_INDEX/PARALLEL/USE_HASH)/CTE materialization/조인 순서 변경/서브쿼리 구조 변경 등 **구체 대안 카테고리 명시**. prompt 말미에 경고 추가
- * 파이프라인 **공백 정규화 동등성 체크 + 재시도 강제** (4/24) — `_normalize_sql()` 헬퍼 (공백·대소문자 정규화) 후 이전 시도와 비교. 동일하면 attempt 소비 없이 `continue` 로 재시도 + `last_failure_note` 에 "SQL 구조가 동일했음, 다른 전략 필요" 지시 추가해 다음 LLM 호출 에 반영. `[retune] identical SQL detected, retrying` 로그 기록
- * **plan_hash 동일 시 "개선없음" 강제 판정** (4/24) — `_same_plan_hash()` 헬퍼로 before/after plan_hash 비교. 동일하면 elapsed 수치 개선과 무관하게 "물리적 실행 경로 변화 없음 · 캐시 warmup 효과" 로 간주하여 재시도. `[no_improve] same_plan_hash=... — physical path unchanged` 로그. 3회 모두 동일 plan_hash 면 status='failed' · rationale 에 `[no_improve:same_plan_hash]` 기록
- * **재튜닝 시 schema_name 자동 상속** (4/24) — `body.parent_request_id` 있고 `body.schema_name` 없을 때 parent 의 `asis_sql` schema_name 을 자동 사용. 사용자 오입력으로 인한 ORA-00942 (object not found) 방지
- * **이전 after plan_text prompt 주입** (4/24) — `_collect_previous_attempts` 쿼리에 `sql_plans.plan_text` 포함. `_build_user_message` 에서 "이전 After Plan (이 경로를 피해야 함)" 블록으로 렌더 (3000자 truncate). LLM 이 이전 실행 경로를 구체적으로 인지하고 회피하도록
- * **DB 스키마 5건 재구조화** (4/24) — 3개 Alembic 리비전으로 적용:
  - rev1 `j5e6f7g8h9i0`: `sql_texts.schema_name` → `tuning_requests.schema_name` 이동(asis_sql_id 백필) + `sql_performance.result_match` → `tuning_requests.result_match` 이동
  - rev2 `k6f7g8h9i0j1`: `llm_models` 신규 테이블(vllm/axis-v1 seed) + `tuning_requests.llm_id` FK 추가 + `llm_provider`/`llm_model`/`input_tokens`/`output_tokens` 4컬럼 DROP + `sql_performance.plan_hash` 추가·기존 42건 백필 + `ix_sql_performance_plan_hash` INDEX
  - rev3 `l7g8h9i0j1k2`: `sql_plans` 중복 22건 제거(42→20 rows) + `request_id` 컬럼 DROP + `uq_sql_plans_sql_inst_phase_hash(sql_id, instance_id, phase, plan_hash)` UNIQUE 제약
- * **sql_performance INSERT 에 plan_hash 바인드 추가** (4/24) — before/after 양쪽 캡처 시 `_extract_plan_hash(plan_text)` 결과를 `:ph` 로 전달
- * **`_collect_previous_attempts` 쿼리 재작성** (4/24) — plan_hash 는 `sql_performance sp WHERE sp.request_id = r.request_id` 경유, plan_text 는 `sql_performance sp3 JOIN sql_plans pl ON pl.sql_id=sp3.sql_id AND pl.instance_id=sp3.instance_id AND pl.phase=sp3.phase AND pl.plan_hash=sp3.plan_hash` 경유로 전환 (구 `sql_plans.request_id` 참조 제거)
- * **schema 상속 쿼리 전환** (4/24) — `SELECT r.schema_name FROM tuning_requests r WHERE r.request_id = :pid` 로 parent 직접 조회 (구 `JOIN sql_texts st ... st.schema_name` 폐기)
- * **sql_plans INSERT ON CONFLICT DO NOTHING** (4/24) — UNIQUE 제약 충돌 시 skip, request_id 컬럼 바인드 제거
- * **GET /api/tuning/requests/{id} 응답 perf SELECT 에 plan_hash 노출** (4/24) — `performance[].plan_hash` 키 추가로 프런트가 before/after plan_hash 비교를 performance 배열만으로 수행 가능
- * **R-25 PK 컬럼 리네임** (4/24) — users.id→user_id, llm_models.id→llm_id, instances.id→instance_id. tuning_requests.instance_id integer→bigint 승격. 시퀀스명도 일관 변경. 코드 `lm.id` / `SELECT id FROM llm_models` → `lm.llm_id` / `SELECT llm_id FROM llm_models` 전수 치환
- * **R-26 데이터 이관 + group 정규화** (4/24) — console_users(5건) → users 이관(`legacy_console_id` 보존), db_instances(1건 REPO) → instances 이관(PLACEHOLDER 비밀번호). tuning_request_group 에 `llm_id`/`user_id` 추가, 15개 그룹에 llm_id 이관
- * **R-27 tuning_requests 컬럼 DROP + 조회 전환** (4/24) — tuning_requests.llm_id / user_id DROP. 모든 쿼리를 `JOIN tuning_request_group g` 경유로 변경. `_collect_previous_attempts` 도 llm_id 참조 시 group 을 통해 조회. INSERT 경로는 `tuning_request_group` 에 llm_id/user_id 저장
- * **R-28 (예정) 테이블 통합·DROP** — `tuning_requests.instance_id` / `sql_texts.instance_id` FK 를 `instances.instance_id` 로 재지정 후 `db_instances` / `console_users` DROP. `_resolve_instance()` 가 instances 테이블 질의로 전환
- * **llm_call_log 적재 경로** (4/24 참고) — 기존 `log_id` PK 를 `request_id` 가 대체, PK 제약 제거. 한 request_id 당 다건 로그 허용 (재시도·chunk 별도 기록). 토큰 집계는 이 테이블 aggregate 로 수행

