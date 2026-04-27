# Tuning AI — 수집 DB 적재 규칙

> PostgreSQL 10.10.45.119:5432 / exem_tuning_ai
> 대상선정(Top SQL)은 Oracle 실시간 조회 전용 — DB 저장 없음
> 아래 테이블은 **튜닝 요청 이후** 데이터만 적재

---

## 설정 테이블 (앱 초기화 시)

### db_instances
튜닝 대상 Oracle DB 접속 정보. 추후 인스턴스 등록 UI 추가 예정.

### console_users
콘솔 사용자 계정. 유저 생성 시 적재. 추후 로그인 인증 연동 예정.

### model_configs
SQL 튜닝에 사용될 LLM 모델 설정 (provider, model, is_default).

---

## 튜닝 현황 테이블

### sql_texts
SQL 원문 저장소. AS-IS/TO-BE 구분 없이 하나의 SQL = 하나의 row.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | SERIAL PK | |
| sql_id | VARCHAR (nullable) | Oracle sql_id. TO-BE는 적용 후 채움 |
| sql_text | TEXT NOT NULL | SQL 원문 |
| schema_name | VARCHAR | 파싱 스키마 |
| instance_name | VARCHAR | 인스턴스명 |
| sql_type | VARCHAR NOT NULL | `as_is` / `to_be` |
| created_at | TIMESTAMPTZ | 등록 시점 |

- UNIQUE: (sql_id, sql_type) — 동일 SQL 중복 방지
- AS-IS/TO-BE 독립 조회 가능

**적재 시점:**
- `as_is`: 사용자가 튜닝 요청 시
- `to_be`: LLM 튜닝 완료 시

---

### tuning_requests
튜닝 요청 이력. 재튜닝 시 parent_request_id로 체이닝.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | SERIAL PK | |
| source_sql_id | FK → sql_texts | AS-IS SQL |
| tuned_sql_id | FK → sql_texts (nullable) | TO-BE SQL (튜닝 완료 후) |
| parent_request_id | FK → self (nullable) | 재튜닝 시 이전 요청 참조 |
| source | VARCHAR NOT NULL | `maxgauge / awr / v$sql / scatter / direct` |
| status | VARCHAR NOT NULL | `requested → tuning → completed → approved → applied` |
| rationale | TEXT | LLM 튜닝 근거 |
| user_instruction | TEXT | 사용자 지시사항 |
| requested_by | VARCHAR | 요청자 |
| requested_at | TIMESTAMPTZ | 요청 시점 |
| completed_at | TIMESTAMPTZ | 튜닝 완료 시점 |

**적재 시점:**
- 사용자가 대상선정(MaxGauge/AWR/V$SQL/Scatter/직접입력)에서 SQL 선택 → 튜닝 요청
- 재튜닝: 새 row 생성, parent_request_id = 이전 request id

---

### sql_performance
성능 스냅샷. before/after 비교용.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | SERIAL PK | |
| request_id | FK → tuning_requests | 튜닝 요청 |
| sql_text_id | FK → sql_texts | SQL |
| phase | VARCHAR NOT NULL | `before` / `after` |
| elapsed_time | NUMERIC | seconds |
| cpu_time | NUMERIC | seconds |
| buffer_gets | BIGINT | Logical Reads |
| disk_reads | BIGINT | Physical Reads |
| executions | BIGINT | 수행 횟수 |
| rows_processed | BIGINT | 처리 건수 |
| captured_at | TIMESTAMPTZ | 캡처 시점 |

**적재 시점:**
- `before`: 튜닝 요청 시 Oracle에서 현재 성능 캡처
- `after`: 적용 후 성능 측정 시

---

### sql_plans
실행계획.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | SERIAL PK | |
| request_id | FK → tuning_requests | |
| sql_text_id | FK → sql_texts | |
| phase | VARCHAR NOT NULL | `before` / `after` |
| plan_hash | VARCHAR | plan_hash_value |
| plan_text | TEXT | 실행계획 전문 |
| cost | INTEGER | |
| captured_at | TIMESTAMPTZ | |

**적재 시점:**
- `before`: 튜닝 요청 시 V$SQL_PLAN 또는 DBA_HIST_SQL_PLAN에서 캡처
- `after`: 적용 후 새 실행계획 캡처

---

### sql_bind_variables
바인드 변수. 바인드 사용 SQL일 경우에만 저장.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | SERIAL PK | |
| sql_text_id | FK → sql_texts | |
| name | VARCHAR | :bind_name |
| data_type | VARCHAR | NUMBER, VARCHAR2 등 |
| value | TEXT | 캡처된 값 |
| position | INTEGER | |
| captured_at | TIMESTAMPTZ | |

**적재 시점:**
- 튜닝 요청 시 V$SQL_BIND_CAPTURE 또는 DBA_HIST_SQLBIND에서 캡처

---

## 적재 규칙 요약

| 사용자 행동 | 적재 테이블 | 비고 |
|------------|------------|------|
| 대상선정 조회 | 없음 | Oracle 실시간 조회만 |
| **튜닝 요청** | sql_texts(as_is) + tuning_requests + sql_performance(before) + sql_plans(before) + sql_bind_variables | 핵심 적재 시점 |
| LLM 튜닝 완료 | sql_texts(to_be) + tuning_requests 갱신 | tuned_sql_id 연결 |
| 적용 후 측정 | sql_performance(after) + sql_plans(after) | before/after 비교 가능 |
| 재튜닝 요청 | tuning_requests(신규, parent 연결) | 이력 체이닝 |

## 적재 목적

1. **유실 방지** — 튜닝 요청한 SQL 원문·성능·실행계획 보존
2. **이력 관리** — 재튜닝 포함 전체 튜닝 이력 추적
3. **개선 효과** — before/after 성능 비교 (튜닝 현황 페이지)
