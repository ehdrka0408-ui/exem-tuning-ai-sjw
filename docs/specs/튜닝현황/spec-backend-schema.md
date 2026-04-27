# 백엔드 — 데이터 모델 (PostgreSQL)

## 문서 목적

튜닝현황 기능이 의존하는 PostgreSQL 스키마(10.10.45.119:5432 / exem_tuning_ai)의 테이블 구조·컬럼 단위·제약·관계를 정의한다. API/파이프라인/프런트 계산 로직이 참조하는 단일 진실 공급원(Single Source of Truth).

---

## Description

### (1) tuning_requests

**1. 내용**
- 튜닝 요청 단위의 메타·상태·LLM 호출 이력을 보관하는 메인 테이블.
- PK `request_id` 기반으로 모든 연관 테이블이 조인된다.

**2. 구성**

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| request_id | integer | NN | PK, 요청 일련번호 |
| instance_id | bigint | NN · FK → instances.instance_id | 대상 Oracle 인스턴스 |
| parent_request_id | integer | NULL | 재튜닝 체인 — 부모 요청 |
| asis_sql_id | varchar(64) | NULL | 원본 SQL 해시 (sql_texts 참조) |
| tobe_sql_id | varchar(64) | NULL | 튜닝된 SQL 해시 |
| group_id | uuid | NN · FK → tuning_request_group.group_id | 요청 묶음 그룹 (LLM·사용자·인스턴스는 그룹에 귀속) |
| source | varchar(32) | NN | 요청 출처 (`ui` / `api` / `batch`) |
| status | varchar(32) | NN | CHECK IN ('requested','tuning','completed','approved','applied','failed','rejected') |
| rationale | text | NULL | LLM 개선 논거 / 실패 사유. 반려 시 `[reject:reason]` append |
| user_instruction | text | NULL | 사용자 지시사항 |
| alias | varchar(64) | NULL | 표시용 이름. 재튜닝 시 `_재튜닝(N)` suffix (자동 카운터 규칙은 `spec-work-list.md` §10) |
| schema_name | varchar(128) | NULL | 실행 스키마. 재튜닝 시 parent 에서 자동 상속 |
| result_match | char(1) | NULL | 결과셋 일치 (현재 NULL 고정 — 비교 로직 미구현) |
| requested_at | timestamptz | NN · default now() | 요청 접수 시각 |
| completed_at | timestamptz | NULL | 종단 상태 진입 시각 |
| latency_ms | integer | NULL | Millisecond. LLM 호출 왕복 |

> **그룹 단위 메타** (`llm_id`, `user_id`, `request_group_name` 등) 은 `tuning_request_group` 에 보관. `tuning_requests` 는 `group_id` 로 1:N 참조 (§7).

**3. 동작**
- 상태 CHECK 제약으로 7종 이외 값 INSERT/UPDATE 차단
- 삭제 시 자식의 parent_request_id 를 NULL 로 사전 UPDATE (orphan 방지)
- requested_at DESC 기본 정렬 (목록 상단에 최근 요청)
- 재튜닝 요청 시 `schema_name` 은 `parent_request_id` 로부터 자동 상속 (body 미지정 시)
- 재튜닝 요청 시 `group_id` 는 parent 의 group_id 를 그대로 승계 (신규 group 생성 안 함, parent group.request_count +=1)
- LLM/사용자 정보는 `tuning_request_group` JOIN 으로 조회 — `tr.group_id = g.group_id → g.llm_id → llm_models`, `g.user_id → users`

---

### (2) sql_texts

**1. 내용**
- AS-IS / TO-BE SQL 원문 저장소. sql_id 해시 + instance_id + sql_type 조합으로 유일성 보장.

**2. 구성**

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| sql_id | varchar(64) | NN | md5 기반 해시 ID |
| instance_id | integer | NN · FK | 대상 인스턴스 |
| sql_type | varchar(16) | NN | CHECK IN ('as_is','to_be') |
| sql_text | text | NN | SQL 원문 |
| created_at | timestamptz | NN · default now() | 최초 등록 시각 |

- UNIQUE 제약: `(sql_id, instance_id, sql_type)` — 제약명 `sql_texts_unique_combo`
- `schema_name` 은 `tuning_requests` 로 이동(요청 단위 관리). `sql_texts` 는 SQL 원문의 순수 공유 저장소 역할만 유지.

**3. 동작**
- 동일 SQL 재요청 시 UPSERT. 해시 중복 시 신규 INSERT 하지 않음
- tuning_requests 와 조인: `(instance_id, asis_sql_id, sql_type='as_is')` 또는 `(instance_id, tobe_sql_id, sql_type='to_be')`

---

### (3) sql_performance

**1. 내용**
- before / after / applied phase 별 성능 스냅샷. Xplan 파싱값 우선, gv$sql SUM 값 fallback.

**2. 구성**

| 컬럼 | 타입 | NULL | 단위 · 제약 |
|------|------|------|------------|
| request_id | integer | NN | 논리 키 |
| instance_id | integer | NN | 논리 키 |
| sql_id | varchar(64) | NULL | 논리 키 |
| phase | varchar(16) | NN | CHECK IN ('before','after','applied') |
| elapsed_time_sec | numeric | NULL | **Second** · Xplan A-Time 우선 |
| cpu_time_sec | numeric | NULL | Second · gv$sql SUM(cpu_time)/1e6 |
| buffer_gets_count | bigint | NULL | Count · Xplan Buffers 우선 |
| disk_reads_count | bigint | NULL | Count · Xplan Reads 우선 |
| executions_count | bigint | NULL | Count · Xplan Starts 우선 |
| rows_processed_count | bigint | NULL | Count · Xplan A-Rows 우선 |
| plan_hash | varchar(64) | NULL | Oracle plan_hash_value (sql_plans 와 조인 키) |
| captured_at | timestamptz | NN · default now() | 캡처 시각 |
| is_estimated | char(1) | NN · default 'N' | 'Y'=EXPLAIN/wall_clock_fallback, 'N'=실측 |

- 물리 PK 없음 (논리 키: request_id + instance_id + sql_id + phase + captured_at)
- 인덱스: `ix_sql_performance_plan_hash (sql_id, instance_id, plan_hash)` — sql_plans 조인 가속
- `result_match` 컬럼은 `tuning_requests` 로 이동(요청 단위 집계)

**3. 동작**
- capture 함수가 plan 파싱 실패 시 gv$sql 값 fallback · is_estimated='N' 유지
- wall_clock_fallback 시 is_estimated='Y' 마킹
- `plan_hash` 는 before/after 양쪽 capture 시 Xplan 에서 추출해서 적재
- 단위: 시간 계열은 `_sec` (Second), 누적 카운트는 `_count` (Count) 컨벤션 준수

---

### (4) sql_plans

**1. 내용**
- phase 별 실행계획 저장. plan_text 는 DISPLAY_CURSOR(ALLSTATS LAST) 우선, EXPLAIN PLAN fallback.
- **sql_texts 와 동일한 공유 저장소 컨셉** — 동일 plan 은 중복 저장하지 않고, `(sql_id, instance_id, phase, plan_hash)` 조합으로 유일하게 보관. 조회는 `sql_performance` 경유 JOIN.

**2. 구성**

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| sql_id | varchar(64) | NN | 논리 키 |
| instance_id | integer | NN | 논리 키 |
| phase | varchar(16) | NN | CHECK IN ('before','after','applied') |
| plan_hash | varchar(64) | NN | Oracle plan_hash_value. plan_text 정규식 추출 |
| plan_text | text | NULL | 실행계획 원문 |
| cost | integer | NULL | optimizer cost |
| captured_at | timestamptz | NN · default now() | 최초 저장 시각 |

- UNIQUE 제약: `uq_sql_plans_sql_inst_phase_hash (sql_id, instance_id, phase, plan_hash)`
- **`request_id` 컬럼 제거** — 중복 plan 방지. 조회 시 `sql_performance.(sql_id,instance_id,phase,plan_hash) = sql_plans.(sql_id,instance_id,phase,plan_hash)` 로 JOIN

**3. 동작**
- plan_hash: `"Plan hash value: N"` 정규식 매치 후 저장 (파싱 실패 시 레코드 skip)
- INSERT 는 `ON CONFLICT DO NOTHING` 으로 중복 무시
- fallback 흐름: DISPLAY_CURSOR → `_is_display_cursor_missing()` 패턴 감지 시 RuntimeError → EXPLAIN PLAN 재시도

---

### (5) sql_bind_variables

**1. 내용**
- 튜닝 파이프라인용 바인드 변수 캡처. FK request_id 로 tuning_requests 와 연결.

**2. 구성**

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| request_id | integer | NN · FK ON DELETE CASCADE | → tuning_requests.request_id |
| sql_id | varchar(64) | NN | 논리 참조 → tuning_requests.asis_sql_id |
| instance_id | integer | NN | 논리 참조 |
| name | varchar(256) | NN | 바인드명 (`:B1`, `:cat_from` 등) |
| position | integer | NN | 1-based 순서 |
| data_type | varchar(128) | NULL | Oracle 타입 (NUMBER/VARCHAR2/DATE 등) |
| value | text | NULL | 캡처값 (문자열 표현) |
| captured_at | timestamptz | NN · default now() | |

- 물리 PK 없음 · ORM `primary_key=["request_id","sql_id","instance_id","name","position"]`
- 인덱스: `ix_sql_bind_variables_request_id (request_id)`

**3. 동작**
- request 삭제 시 FK CASCADE 로 함께 삭제
- 프런트는 `/api/sql-binds` 에서 fetch 후 POST 페이로드로 전송 → 백엔드가 이 테이블에 적재

---

### (6) llm_models

**1. 내용**
- LLM 설정 정규화 테이블. `tuning_request_group.llm_id` FK 로 참조된다 (그룹 단위 LLM 설정).
- 사용자(관리자)가 UI/관리 API 로 신규 모델 엔드포인트·토큰 제한·활성 여부를 등록하고, 튜닝 파이프라인은 요청 시점의 `llm_id` 로 endpoint 를 결정한다.

**2. 구성**

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| llm_id | integer | NN · PK | PK, 시퀀스 `llm_models_llm_id_seq` |
| provider | varchar(64) | NN | `vllm` / `openai` / `anthropic` 등 |
| model_name | varchar(128) | NN | `axis-v1` / `gpt-4` 등 |
| description | text | NULL | 관리자 메모 |
| endpoint_url | varchar(512) | NULL | 로컬 vLLM 주소 등 |
| api_key_ref | varchar(128) | NULL | 환경변수 참조명 (평문 저장 금지) |
| max_tokens | integer | NULL | Count |
| temperature | numeric(3,2) | NULL | 샘플링 파라미터 |
| is_active | boolean | NN · default true | 비활성 시 선택 불가 |
| created_at | timestamptz | NN · default now() | |
| updated_at | timestamptz | NN · default now() | |

- UNIQUE 제약: `(provider, model_name)`
- Seed: `(vllm, axis-v1, http://10.10.48.89:8606, NULL, 4096, 0.20, true)` 1건 등록

**3. 동작**
- 튜닝 요청 그룹 생성 시 활성 default `llm_id` 또는 사용자가 지정한 `llm_id` 를 `tuning_request_group.llm_id` 에 저장 (요청 단위가 아닌 그룹 단위)
- LLM 클라이언트는 `llm_id` 로 endpoint/토큰/온도 를 resolve 해서 호출
- 토큰 사용량 (`input_tokens` / `output_tokens`) 은 현재 저장하지 않음(컬럼 삭제). 추후 별도 로그 테이블 도입 시 재정의 대상

---

### (7) tuning_request_group

**1. 내용**
- 튜닝 요청의 묶음 단위. 한 번의 사용자 액션(단건·일괄)이 하나의 group 으로 묶이고, 그 그룹의 공통 속성(요청자·LLM·인스턴스·스케줄)을 담는다.
- 개별 `tuning_requests` 의 LLM·요청자 정보는 이 그룹 테이블에 귀속 (정규화).

**2. 구성**

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| group_id | uuid | NN · PK · default `gen_random_uuid()` | 그룹 식별자 |
| request_group_name | varchar(128) | NULL | 사용자 지정 이름 (default 자동 포맷: `[방식] 유저명 요청 N건 YYMMDD HH:MM:SS`) |
| alias | text | NULL | 표시용 별칭 |
| instance_id | bigint | NN · FK → instances.instance_id | 대상 인스턴스 |
| llm_id | integer | NULL · FK → llm_models.llm_id | 그룹 공통 LLM 설정 |
| user_id | bigint | NULL · FK → users.user_id | 요청자 |
| request_source | varchar(32) | NN | 요청 출처 (`ui`/`api`/`batch`) |
| created_by | varchar(64) | NN | 시스템 태그 (`system` 등). 표시용 운영자 식별은 `user_id` 사용 |
| created_at | timestamptz | NN · default now() | |
| scheduled_at | timestamptz | NULL | 예약 시각 |
| request_count | integer | NN · default 0 | 그룹 내 tuning_requests 수 |

**3. 동작**
- `tuning_requests.group_id` 로 1:N 연결
- 그룹 내 모든 request 는 동일 `llm_id` / `user_id` / `instance_id` 를 공유하는 것을 원칙 (실데이터상 검증됨 — distinct > 1 사례 0건)
- 관리 화면에서 그룹 단위 재실행·삭제·상태 확인 UI 제공 (Task)
- `created_by` 는 내부 시스템 식별자(시스템/배치 로그 태그). 운영자 이름·이메일은 `user_id → users` JOIN 으로 표시

---

### (8) users

**1. 내용**
- 콘솔 운영자 계정. PK 컬럼명 `user_id`. 구 `console_users` 테이블에서 이관된 운영자(U-001~U-005)는 `legacy_console_id` 로 추적.

**2. 구성**

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| user_id | bigint | NN · PK · 시퀀스 `users_user_id_seq` | 사용자 식별자 |
| legacy_console_id | varchar(32) | NULL | 구 console_users.id (`U-001` 형태) 보존 — 이관된 레거시 계정 추적 |
| email | varchar | NN | 로그인·연락처 |
| name | varchar | NN | 표시명 |
| role | `user_role` (enum) | NN · default `'tuner'` | 권한 (admin/tuner/viewer 등) |
| group_id | bigint | NULL · FK → ait_groups.group_id | 조직 그룹 |
| password_hash | varchar | NULL | 해시된 비밀번호 (이관된 U-001~005 는 NULL — 재등록 필요) |
| last_login_at | timestamptz | NULL | |
| ip_limits | text | NULL | 접속 IP 제한 |
| is_active | boolean | NN · default true | |
| phone | varchar | NULL | |
| created_at / updated_at | timestamptz | NN | |

**3. 동작**
- `tuning_request_group.user_id` FK 를 통해 요청 그룹과 연결
- 이관된 레거시 계정(U-001~U-005)은 `password_hash IS NULL` 이므로 로그인 전 재설정 필요
- 백업 테이블: `_bak_console_users_20260424` (이관 전 원본 5건 보존)

---

### (9) instances

**1. 내용**
- 튜닝 대상 DB 인스턴스. PK 컬럼명 `instance_id`. 구 `db_instances` 테이블에서 통합 이관됨 (REPO 인스턴스).

**2. 구성** (주요 컬럼만)

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| instance_id | bigint | NN · PK · 시퀀스 `instances_instance_id_seq` | 인스턴스 식별자 |
| name | varchar | NN · UNIQUE | 인스턴스명 (예: `REPO`) |
| alias_name | varchar | NULL | 표시용 (예: `운영-REPO`) |
| db_groupname | varchar | NN · default `'미지정'` | 그룹명 |
| host | varchar | NN | 예: `10.10.45.203` |
| port | integer | NN · default 1521 | |
| sid / service_name | varchar | NULL | Oracle 접속 정보 |
| db_type | varchar | NN · default `'oracle'` | |
| db_version / os_type | varchar | NULL | |
| username / password_encrypted | varchar / text | NN | 접속 자격. REPO 운영 환경 = `system / oracle` (평문 — 향후 암호화 정책 적용 시 갱신) |
| is_sysdba / is_active | boolean | NN | |
| pool_min / pool_max / pool_increment / pool_timeout_sec / pool_max_lifetime_sec | integer | NN | 커넥션 풀 |
| stmt_cache_size / connect_timeout_sec / query_timeout_sec | integer | NN | |
| cb_failure_threshold / cb_cooldown_sec / cb_success_threshold | integer | NN | 서킷브레이커 |
| health_status | varchar | NN · default `'unknown'` | `active`/`down`/`unknown` |
| last_health_check_at / last_tested_at | timestamptz | NULL | |
| last_error_message | text | NULL | |
| created_at / updated_at | timestamptz | NN | |

**3. 동작**
- `tuning_requests.instance_id` / `tuning_request_group.instance_id` / `sql_texts.instance_id` FK 대상 (단일 instances 테이블 — 구 db_instances 폐기)
- `_resolve_instance()` 백엔드 헬퍼는 integer(instance_id) / name / sid / alias_name / `INS-{NAME}` 레거시 패턴 3단계 fallback 으로 조회
- 백업 테이블: `_bak_db_instances_20260424` (이관 전 원본 1건 보존)

---

### (10) llm_call_log

**1. 내용**
- LLM 호출별 토큰·지연·에러를 기록하는 로그 테이블. 요청 단위의 `input_tokens`/`output_tokens`/`latency_ms` 를 여기서 집계.
- **PK 없음** (요청 재시도·반복 호출로 동일 request_id 다건 레코드 허용 → 로그형 적재).

**2. 구성**

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| request_id | integer | NN | 논리 FK → tuning_requests.request_id (이전 `log_id` PK 를 R-26 에서 대체) |
| instance_id | integer | NULL | 대상 인스턴스 |
| provider | varchar | NN | `vllm` / `openai` 등 (llm_models.provider 와 의미 일치) |
| model | varchar | NN | 모델명 |
| sql_id | varchar | NULL | 대상 SQL 해시 |
| work_id | varchar | NULL | 외부 워크플로 식별자 |
| input_tokens | integer | NN | Count · 요청 토큰 |
| output_tokens | integer | NN | Count · 응답 토큰 |
| cached_tokens | bigint | NULL | Count · 캐시 히트 토큰 (provider 지원 시) |
| cache_creation_tokens | bigint | NULL | Count · 프롬프트 캐시 생성 토큰 |
| latency_ms | integer | NN | Millisecond |
| status | varchar | NN | `success` / `failed` / `timeout` 등 |
| error | text | NULL | 실패 시 메시지 |
| created_at | timestamptz | NN · default now() | |

**3. 동작**
- 한 request_id 에 여러 호출 로그 가능 (재시도·stream·chunk)
- 프런트 분석 페이지는 이 테이블을 aggregate 해서 requests 토큰 사용량 집계
- tuning_requests 에서 DROP 된 `input_tokens`/`output_tokens` 의 실제 저장 위치가 이 테이블임 (R-24/R-26 연관)
- PK 없음 → 중복 방지 필요 시 `(request_id, created_at)` 조합으로 UNIQUE 운영 가능 (현재 미설정)

---

### (11) 조건분기

**phase 값 제약**

| 조건 | 결과 |
|------|------|
| phase NOT IN ('before','after','applied') | CHECK 제약 위반 → INSERT 실패 |
| is_estimated NOT IN ('Y','N') | CHECK 제약 위반 |
| status NOT IN (7종) | CHECK 제약 위반 |
| sql_type NOT IN ('as_is','to_be') | CHECK 제약 위반 |

**FK / UNIQUE 가드**

| 조건 | 결과 |
|------|------|
| tuning_requests.instance_id 미존재 (instances) | FK 위반 |
| tuning_requests.group_id 미존재 | FK 위반 |
| tuning_request_group.llm_id 미존재 (llm_models) 또는 is_active=false | FK 위반 또는 애플리케이션 레벨 거부 |
| tuning_request_group.user_id 미존재 (users) | FK 위반 |
| sql_texts (sql_id, instance_id, sql_type) 중복 | UNIQUE 위반 → UPSERT 로 회피 |
| sql_plans (sql_id, instance_id, phase, plan_hash) 중복 | UNIQUE 위반 → ON CONFLICT DO NOTHING |
| sql_bind_variables 에 대응 request_id 없음 | FK 위반 |

---

## 조인 경로 (주요 쿼리 패턴)

**목록 / 상세 공통** — LLM/사용자 정보는 `tuning_request_group` 경유
```
tuning_requests tr
  LEFT JOIN tuning_request_group g ON g.group_id   = tr.group_id  -- 그룹 공통 속성
  LEFT JOIN llm_models          lm ON lm.llm_id    = g.llm_id     -- LLM 설정
  LEFT JOIN users               u  ON u.user_id    = g.user_id    -- 요청자
  LEFT JOIN instances           i  ON i.instance_id = tr.instance_id -- 대상 DB
  LEFT JOIN sql_performance spb ON spb.request_id = tr.request_id
                                AND spb.phase = 'before'
  LEFT JOIN sql_performance spa ON spa.request_id = tr.request_id
                                AND spa.phase = 'after'
  LEFT JOIN sql_plans pb    ON pb.sql_id      = spb.sql_id
                            AND pb.instance_id = spb.instance_id
                            AND pb.phase       = spb.phase
                            AND pb.plan_hash   = spb.plan_hash
  LEFT JOIN sql_plans pa    ON pa.sql_id      = spa.sql_id
                            AND pa.instance_id = spa.instance_id
                            AND pa.phase       = spa.phase
                            AND pa.plan_hash   = spa.plan_hash
```

**재튜닝 prev plan 수집 (`_collect_previous_attempts`)**
```
SELECT ... FROM tuning_requests r
LEFT JOIN sql_performance sp  ON sp.request_id = r.request_id
LEFT JOIN sql_plans       pl  ON pl.sql_id      = sp.sql_id
                              AND pl.instance_id = sp.instance_id
                              AND pl.phase       = sp.phase
                              AND pl.plan_hash   = sp.plan_hash
WHERE r.request_id IN (parent chain ...)
ORDER BY r.requested_at DESC
LIMIT 2
```

---

## 단위 · 네이밍 컨벤션

| 접미사 | 단위 | 예시 |
|--------|------|------|
| `_sec` | Second | `elapsed_time_sec`, `cpu_time_sec` |
| `_ms` | Millisecond | `latency_ms` |
| `_count` | Count | `buffer_gets_count`, `executions_count`, `disk_reads_count`, `rows_processed_count`, `max_tokens` |
| `_at` | timestamptz | `requested_at`, `captured_at`, `completed_at`, `updated_at` |
| `_hash` | varchar | `plan_hash` |

시간 지표는 반드시 Second 단위. Oracle 원값이 마이크로초(`gv$sql.elapsed_time`) 또는 ms 포맷(`A-Time HH:MM:SS.FF`)이면 Second 로 변환 후 저장.

---

## 운영 후속 액션 (배포·이관 후 즉시 처리)

| 항목 | 액션 |
|------|------|
| 레거시 운영자 비밀번호 재설정 | `users.password_hash IS NULL` 인 U-001~U-005 5계정 — 운영 정책에 따라 임시 비밀번호 발급 + 사용자 재설정 안내 |
| REPO 인스턴스 자격 검증 | `instances.password_encrypted` 값 확인 (정상 평문 `oracle`. `[MIGRATION_PLACEHOLDER]` 잔존 시 즉시 갱신) |
| 백업 테이블 보존 | `_bak_console_users_20260424`, `_bak_db_instances_20260424` — 1개월 보존 후 정리 |
| user_groups 테이블 | console_users 폐기로 참조 없음. deprecate 여부 별도 TF 결정 |

---

## 마이그레이션 이력 (참고용 — 본문 스펙은 위 본문 자체)

본 스키마는 2026-04-24~04-26 에 걸쳐 8개 Alembic 리비전으로 재구조화되었다. 본문은 **현재 시점 최종 스펙** 으로 작성됐으며, 적용된 마이그레이션 추적은 다음과 같다.

| Rev | 변경 |
|-----|------|
| 1차 (3 리비전) | schema_name/result_match 이동(tuning_requests로) · llm_models 정규화 + 이전 llm 컬럼 4개 DROP · sql_performance.plan_hash 추가·백필 · sql_plans 중복 제거·request_id DROP·UNIQUE(sql_id,instance_id,phase,plan_hash) |
| 2차 (5 리비전) | PK 리네임 (users.id→user_id, llm_models.id→llm_id, instances.id→instance_id) + tuning_requests.instance_id integer→bigint 승격 · 데이터 이관 (console_users→users, db_instances→instances) · tuning_request_group 에 llm_id/user_id FK 추가 · tuning_requests 의 llm_id/user_id DROP · db_instances/console_users DROP |
| 부수 | llm_call_log PK 제거 — `request_id` 가 구 log_id 를 대체, PK 없이 로그형 다건 적재 |

릴리즈 타임라인은 `spec-release-2026-04-26.md` 또는 `README.md` §변경 이력 참조.
