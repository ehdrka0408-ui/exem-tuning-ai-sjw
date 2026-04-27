# 백엔드 — API 엔드포인트

## 문서 목적

튜닝현황 프런트가 호출하는 REST API 엔드포인트 전체 명세. 라우터 파일은 `backend/app/api/tuning_requests_v4.py` (FastAPI · BasePath `/api`). 운영 주소는 `http://10.10.45.119:8000`.

---

## Description

### (1) POST /api/tuning/requests — 요청 생성

**1. 내용**
- 새 튜닝 요청을 접수하고, before 캡처 → LLM 호출 → after 캡처 파이프라인을 동기 실행 후 결과를 반환한다.

**2. 구성**

요청 body:
```json
{
 "sql_text": "SELECT ... WHERE category_id BETWEEN :cat_from AND :cat_to",
 "schema_name": "SALES",
 "instance_id": 1,
 "binds": [
 {"name": ":CAT_FROM", "value": "1", "data_type": "NUMBER", "position": 1},
 {"name": ":CAT_TO", "value": "400", "data_type": "NUMBER", "position": 2}
 ],
 "source": "ui",
 "auto_tune": true,
 "alias": "V$SQL",
 "parent_request_id": 101,
 "user_id": "oper_01",
 "user_instruction": "인덱스 힌트 강제 없이 재작성 위주로"
}
```

응답 body:
```json
{
 "request_id": 120,
 "status": "completed",
 "asis_sql_id": "1e6c05b8c1bd33a0f5f007e85b30a940",
 "tobe_sql_id": "a9ac702fcf3f571751f7ba712fb707df",
 "rationale": "인덱스 힌트 추가로 FULL TABLE SCAN 제거...",
 "before": { "elapsed_sec": 1.5, "buffer_gets": 66282, "plan_hash": "1937960388" },
 "after": { "elapsed_sec": 0.07, "buffer_gets": 1205, "plan_hash": "1898327994" },
 "after_plan": "...",
 "improvement_pct": 0.9533
}
```

**3. 동작**
- a. request_id 자동 채번 · status='requested' 초기화
- b. sql_texts UPSERT (sql_type='as_is')
- c. sql_bind_variables INSERT (request_id 단위)
- d. _capture_before 실행 (UUID marker 주입 · Oracle 실행 · 성능·plan 캡처)
- e. status='tuning' UPDATE · vLLM 호출 (timeout 60s · 재시도 3회)
- f. _capture_after 실행 (invisible index 생성 · TO-BE SQL 마커 주입 · 실측)
- g. 개선 10% 미달 시 LLM 재시도 · 3회 초과 시 status='failed'
- h. 완료 시 status='completed' · completed_at = now()

---

### (2) GET /api/tuning/requests — 목록 조회

**1. 내용**
- 튜닝 요청 전체 목록을 반환한다. 페이지네이션 · 필터는 쿼리 파라미터로 제공.

**2. 구성**

쿼리 파라미터:
- `limit` (default 50) — 최대 반환 건수
- `offset` (default 0) — 건너뛸 건수
- `instance_id` (optional) — 특정 인스턴스 필터
- `status` (optional) — 특정 상태 필터
- `user_id` (optional) — 특정 요청자 필터

응답 item 필드:

| 필드 | 타입 | 설명 |
|------|------|------|
| request_id | int | PK |
| instance_id / instance_name | int / string | 대상 DB |
| parent_request_id | int \| null | 재튜닝 트리 parent |
| asis_sql_id / tobe_sql_id | string \| null | SQL 해시 |
| source_sql_text | string | AS-IS SQL 원문 |
| status | string | 7종 상태 |
| requested_at / completed_at | timestamptz | |
| alias / rationale / user_instruction | string \| null | |
| before_elapsed_sec / after_elapsed_sec | float \| null | Second |
| before_buffer_gets / after_buffer_gets | int \| null | Count |
| before_executions / after_executions | int \| null | Count · Xplan Starts |
| before_plan_hash / after_plan_hash | string \| null | Oracle plan_hash_value |
| improvement_pct | float \| null | 백엔드 산출 개선률 로직) |
| schema_name | string \| null | 실행 스키마 (구 `sql_texts.schema_name` · 이제 `tuning_requests` 컬럼) |
| result_match | string \| null | 결과셋 일치 (구 `sql_performance.result_match` · 이제 `tuning_requests` 컬럼. 현재 NULL 고정) |
| llm_provider / llm_model | string \| null | `llm_models` JOIN 결과 (`tuning_request_group.llm_id` FK 경유) |
| input_tokens / output_tokens | int \| null | DB 컬럼 DROP. 응답에는 키는 유지하되 항상 NULL. 프런트 하위호환용 |
| latency_ms | int \| null | Millisecond |
| group_id | uuid | 요청 그룹 식별자 |
| request_group_name | string \| null | 그룹명 (default `[방식] 유저명 요청 N건 YYMMDD HH:MM:SS`) |
| request_source | string \| null | 그룹 출처 (`V$SQL` / `AWR` / `DIRECT` / `RETUNE` 등) |
| group_request_count | int | 그룹 내 request 총 수 |
| group_scheduled_at | timestamptz \| null | 그룹 예약 시각 |
| group_created_at | timestamptz | 그룹 생성 시각 |
| is_estimated | string \| null | `Y`/`N` (sql_performance.is_estimated of after phase) |

**3. 동작**
- a. 기본 정렬: requested_at DESC
- b. sql_performance/sql_plans 서브쿼리 JOIN 으로 before/after 값 동시 반환. sql_plans 는 `(sql_id, instance_id, phase, plan_hash)` 로 sql_performance 와 조인 (request_id 컬럼 없음)
- c. before_executions / after_executions 은 sql_performance.executions_count 에서 추출
- d. before_plan_hash / after_plan_hash 는 **sql_performance.plan_hash** 에서 추출 (구 sql_plans.plan_hash 에서 전환 — 조인 경로 단순화)
- e. llm_provider / llm_model 은 `llm_models` JOIN 결과 반환 (컬럼 DROP 후 FK 경유)
- f. schema_name / result_match 는 tuning_requests 직접 컬럼에서 반환

---

### (3) GET /api/tuning/requests/{request_id} — 상세 조회

**1. 내용**
- 특정 요청의 전체 상세를 반환한다. 목록 필드 + 배열 형태 연관 데이터.

**2. 구성**

응답: 목록 모든 필드 + 다음 배열:

| 필드 | 타입 | 설명 |
|------|------|------|
| performance | array | phase 별 sql_performance 행 |
| plans | array | phase 별 sql_plans 행 |
| bind_variables | array | name, value, data_type, position |
| sql_texts | object | `{as_is: {...}, to_be: {...}}` |

performance[] item:
```json
{
 "phase": "before",
 "elapsed_time_sec": 1.495,
 "cpu_time_sec": 1.21,
 "buffer_gets_count": 66282,
 "executions_count": 1,
 "rows_processed_count": 500,
 "plan_hash": "1937960388",
 "captured_at": "2026-04-23T17:04:51+09:00",
 "is_estimated": "N",
 "result_match": null
}
```
- `plan_hash` 는 sql_performance.plan_hash 직접 노출 (Task #22 재구조화)
- `result_match` 는 tuning_requests 로 이동했지만 performance[] 응답에선 `NULL AS result_match` 고정 반환 (요청 단위는 루트 응답의 `result_match` 키로 이미 반환됨)

plans[] item:
```json
{
 "phase": "before",
 "plan_hash": "1937960388",
 "plan_text": "Plan hash value: 1937960388\n| 0 | SELECT STATEMENT ...",
 "cost": 1234,
 "captured_at": "2026-04-23T17:04:51+09:00"
}
```

**3. 동작**
- a. 404 Not Found — request_id 미존재 시
- b. performance/plans 는 phase 별 1행 이상 (재시도 시 복수 가능)
- c. bind_variables 는 position 오름차순 정렬

---

### (4) POST /api/tuning/requests/batch — 단건/일괄 통합 요청 생성

**1. 내용**
- 단건/일괄을 통합한 신규 엔드포인트. **1 트랜잭션 안에서 1 group + N requests 를 일괄 INSERT**. 단건도 `items.length=1` 로 통합 호출.
- 재튜닝(`parent_request_id` 포함 item)은 **parent 의 group_id 를 그대로 승계** — 신규 group 생성하지 않고 parent group 의 `request_count` +=1.

**2. 구성**

요청 body:
```json
{
  "batch_meta": {
    "request_group_name": "[V$SQL] admin 요청 3건 260426 14:25:32",
    "request_source": "DIRECT",
    "instance_id": 1,
    "scheduled_at": null,
    "user_id": null
  },
  "items": [
    {
      "sql_text": "...",
      "schema_name": "SALES",
      "binds": [{"name":":B1","value":"1","data_type":"NUMBER","position":1}],
      "alias": "V$SQL",
      "parent_request_id": null,
      "user_instruction": null,
      "auto_tune": true
    }
  ]
}
```

응답:
```json
{
  "group_id": "uuid",
  "request_count": 3,
  "requests": [
    { "request_id": 175, "status": "requested", "asis_sql_id": "...", "alias": "V$SQL" }
  ]
}
```

**3. 동작**
- a. items 순회 — `parent_request_id` 있으면 parent.group_id 조회 → 승계, group INSERT skip / 없으면 batch_meta 로 신규 group INSERT (한 batch 안 신규 item 들은 같은 신규 group 공유)
- b. 각 item: sql_texts UPSERT → tuning_requests INSERT (동일 group_id, request_id 채번) → sql_bind_variables INSERT
- c. COMMIT 후 비동기 `run_tuning_job(request_id)` N 번 실행 — 각 request 독립, 일부 실패해도 다른 request 영향 없음
- d. 어떤 item INSERT 실패 시 전체 ROLLBACK
- e. mixed 케이스: batch 안에 parent 가진 item + 신규 item 혼재 시 — parent 가진 item 은 parent group, 신규 item 은 batch 신규 group 으로 분리 (request_count 도 분리 집계)

**4. instance_id 자리**
- **숫자(int) 만 허용**. 문자열 (예: `"REPO"`) 보내면 422. 프런트는 `WorkItem.instanceId` (number) 필드 사용

---

### (5) POST /api/tuning/requests/delete — 일괄 삭제

**1. 내용**
- 복수 요청을 일괄 삭제한다. 자식의 parent_request_id 를 먼저 NULL 처리해 orphan 방지.

**2. 구성**

요청 body:
```json
{ "ids": [55, 56, 58] }
```

응답:
```json
{ "deleted_count": 3, "orphaned_children": 1 }
```

**3. 동작**
- a. `UPDATE tuning_requests SET parent_request_id = NULL WHERE parent_request_id = ANY(:ids)` 선행
- b. `DELETE FROM tuning_requests WHERE request_id = ANY(:ids)` (CASCADE 로 sql_bind_variables 함께 삭제)
- c. sql_texts / sql_performance / sql_plans 는 논리 FK 만 있으므로 수동 삭제 필요 (현 구현은 보존)

---

### (5) 상태 전이 엔드포인트

**5.1 POST /api/tuning/requests/{id}/approve**

**1. 내용** — completed → approved 전이

**2. 구성** — body 없음

**3. 동작**
- a. 현재 status 가 completed 가 아니면 HTTP 409 Conflict
- b. status='approved' UPDATE
- c. 응답: `{status: "approved", request_id: N}`

**5.2 POST /api/tuning/requests/{id}/reject**

**1. 내용** — completed → rejected 전이. 사유 필수.

**2. 구성**
```json
{ "reason": "인덱스 전략 검토 필요" }
```

**3. 동작**
- a. reason 누락 시 HTTP 422
- b. 현재 status 가 completed 가 아니면 HTTP 409
- c. rationale 에 `[reject:reason]` append
- d. status='rejected' UPDATE

**5.3 POST /api/tuning/requests/{id}/apply**

**1. 내용** — approved → applied 전이 (운영 반영)

**2. 구성**
```json
{ "instance_id": 1 }
```

**3. 동작**
- a. 현재 status 가 approved 가 아니면 HTTP 409
- b. (현재 V1) TO-BE SQL 을 운영 인스턴스에 반영하는 실행 로직은 최소 구현
- c. status='applied' UPDATE · completed_at 유지

---

### (6) GET /api/sql-binds — 바인드 변수 조회 (Oracle)

**1. 내용**
- Oracle V$SQL_BIND_CAPTURE / DBA_HIST_SQLBIND 에서 바인드 변수를 조회해 프런트에 반환. 라우터는 `backend/app/api/oracle_top_sql.py`.

**2. 구성**

쿼리 파라미터:
- `sql_id` (required) — Oracle SQL ID
- `source` — `auto` (default) / `v$sql` / `awr`

응답:
```json
[
 { "name": ":cat_from", "type": "NUMBER", "value": "1", "capturedAt": "2026-04-23 17:04:51" },
 { "name": ":cat_to", "type": "NUMBER", "value": "400", "capturedAt": "2026-04-23 17:04:51" }
]
```

**3. 동작**
- a. `source=v$sql` → `gv$sql_bind_capture` 조회 (value_string 우선, datatype 별 ANYDATA 디코딩)
- b. `source=awr` → `dba_hist_sqlbind` 조회 (MAX snap_id 최신 스냅)
- c. `source=auto` → V$SQL 먼저, 0건이면 AWR fallback
- d. 중복 name 은 첫 건만 (seen set)
- e. 결과 0건 정상 (BLOB/RAW 타입 등은 value_string 조회 불가)

---

### (7) 조건분기

| 조건 | HTTP 응답 |
|------|----------|
| request_id 미존재 | 404 Not Found |
| status 전이 불가 (예: requested → approved 직행) | 409 Conflict |
| reason 누락 on reject | 422 Unprocessable Entity |
| body 스키마 위반 (타입 불일치) | 422 |
| Oracle instance not found or inactive | 404 "Oracle instance not found" |
| vLLM 타임아웃 60s 초과 × 3 재시도 | status='failed' · rationale 에 이유 기록 · HTTP 200 |
| DPY-4010 bind variable not provided | status='failed' · HTTP 200 (파이프라인 내부 catch) |

---

## 소스 반영 필요 항목

### 추가
- * 목록/상세 응답에 `before_plan_hash`, `after_plan_hash`, `before_executions`, `after_executions` 필드 추가
- * 상세 응답 `plans[].plan_hash` 포함
- * 상세 응답 performance 의 `elapsed_time_sec` / `cpu_time_sec` 을 float 로 직렬화 (Decimal 타입 변환 · DB 스키마 타입 통일 (2026-04-23) 검증)
- * 상세 응답 `performance[].plan_hash` 필드 추가 (4/24) — sql_performance 직접 컬럼 노출
- * 상세 / 목록 응답에 `schema_name` 필드 공식화 (4/24) — tuning_requests 컬럼에서 직접 반환
- * 상세 루트 `result_match` 필드 (4/24) — tuning_requests 로 이동

### 변경
- * request_id / instance_id / parent_request_id 를 문자열에서 int 로 통일 · #2
- * `TuningRequestBody.instance_id` 타입을 `Union[str,int]` 로 완화해 422 해소 재검증
- * **LLM 메타 응답 경로 전환** (4/24) — `llm_provider`/`llm_model` 이 tuning_requests 컬럼에서 → `llm_models` FK JOIN 결과로 변경. 프런트는 응답 키 변경 없음 (하위 호환)
- * **`input_tokens` / `output_tokens` 응답 키 NULL 고정** (4/24) — DB 컬럼 DROP. 프런트 호환 위해 `NULL::int AS input_tokens` 로 키 유지. 추후 토큰 사용량 별도 로그 테이블 도입 시 재정의
- * **before_plan_hash / after_plan_hash 소스 전환** (4/24) — 목록 응답에서 sql_plans.plan_hash → sql_performance.plan_hash 로 출처 변경 (sql_plans 조인 단순화)
- * **R-25 PK 리네임 반영** (4/24) — llm_models.id → llm_id, users.id → user_id, instances.id → instance_id. 응답 필드 키 자체는 변경 없음 (llm_provider / llm_model 그대로 유지, user 정보는 이번 스코프 미노출)
- * **R-26/R-27 조회 경로 전환** (4/24) — GET list/detail 모두 `tr → tuning_request_group g → llm_models` / `→ users` 경유 JOIN 으로 변경. 응답 키 변경 없음 (하위 호환 유지). INSERT body 의 `llm_id`/`user_id`(향후) 는 group 레코드에 저장되도록 변경. `tuning_requests` 테이블에는 두 필드 부재
- * **R-28 (예정) instance FK 재지정** — tuning_requests.instance_id / sql_texts.instance_id FK 가 `db_instances` → `instances` 로 전환. 응답 포맷은 변경 없음. `_resolve_instance()` 가 instances 질의로 변경
- * **LLM 토큰 응답 키 NULL 고정 유지** (4/24) — input_tokens/output_tokens 는 프런트 하위 호환 위해 응답 키 유지, 값은 NULL. 실제 토큰은 `llm_call_log` 별도 테이블에서 관리 (request_id 로 조인)

