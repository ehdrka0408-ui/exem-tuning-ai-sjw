# 백엔드 — Oracle 세션 캡처 로직

## 문서 목적

Oracle 세션에서 SQL 실행·성능·실행계획·바인드 변수를 수집하는 저수준 로직. UUID marker, DBMS_XPLAN.DISPLAY_CURSOR, Xplan 파싱, gv$sql 관계, V$SQL_BIND_CAPTURE 연동을 포함한다. `backend/app/services/tuning_pipeline_v2.py` + `backend/app/api/tuning_requests_v4.py` 공통 구현.

---

## Description

### (1) UUID marker 주입

**1. 내용**
- AS-IS / TO-BE SQL 을 실행하기 전 고유 UUID 주석을 삽입해 Oracle 이 해당 실행을 별개 sql_id 로 관리하도록 한다. 목적: gv$sql 누적 통계 오염 방지.

**2. 구성**

```python
marker = f"tuning_req_{uuid.uuid4().hex[:12]}"
tagged_sql = _tr_inject_hint_and_marker(sql, marker)
# 예: SELECT /*+ gather_plan_statistics */ /* tuning_req_a1b2c3d4e5f6 */ col FROM ...
```

- `gather_plan_statistics` 힌트는 A-Rows/A-Time/Buffers 실측 보장 (STATISTICS_LEVEL=ALL 과 동등)
- marker 는 매 요청마다 unique — Oracle 이 텍스트 해시로 sql_id 를 생성하므로 필연적으로 새 sql_id

**3. 동작**
- a. before 실행 시 `_capture_before` 내부에서 주입
- b. after 실행 시 `_capture_after` 내부에서 주입 이전에는 누락됨)
- c. sql_id lookup 우선순위:
 ```
 v$sql WHERE sql_text LIKE '%{marker}%' AND ROWNUM = 1
 └─ 실패 시 → v$session.prev_sql_id fallback
 ```
- d. marker 기반 조회가 실패하면 prev_sql_id 로 identify. prev_sql_id 는 세션 로컬이라 다른 세션 영향 없음

---

### (2) DBMS_XPLAN.DISPLAY_CURSOR

**1. 내용**
- Oracle 공유풀의 커서에서 실행계획을 조회한다. ALLSTATS LAST 포맷은 해당 커서의 마지막 실행 통계(A-Rows/A-Time/Buffers)를 포함한다.

**2. 구성**

```sql
SELECT plan_table_output
FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(:sid, :child, 'ALLSTATS LAST'))
```

- 인자: sql_id (marker 기반 조회 결과), child_number (함께 조회)
- 출력: 멀티 라인 plan_text (header + 표 형태)

**3. 동작**
- a. 정상: `Plan hash value: N` 헤더 + `| Id | Operation | ...` 표
- b. **커서 미존재 시 예외 없이 에러 문자열 반환**:
 ```
 SQL_ID: 59x0x6xt51xb8, child number: 0 cannot be found
 ```
- c. 정상/에러 구분을 `_is_display_cursor_missing()` 헬퍼로 수행 (다음 섹션 참조)
- d. 에러 감지 시 `RuntimeError` 발생 → 기존 except 블록의 EXPLAIN PLAN fallback 트리거

---

### (3) `_is_display_cursor_missing` 헬퍼

**1. 내용**
- DISPLAY_CURSOR 결과가 실제 plan 인지, 에러 문구인지 판별하는 헬퍼. DISPLAY_CURSOR fallback 강화 (2026-04-23) 에서 추가.

**2. 구성**

```python
_DISPLAY_CURSOR_MISSING_RE = re.compile(
 r"(cannot be found|no cursor available|no plan found|NO STATISTICS)",
 re.IGNORECASE
)

def _is_display_cursor_missing(text: str) -> bool:
 if not text:
 return True
 head = text.strip()[:500]
 # 정상 plan 마커 존재 시 False
 if "Plan hash value" in head: return False
 if re.search(r"\|\s*Id\s*\|", head): return False
 # 에러 패턴 매치 시 True
 return bool(_DISPLAY_CURSOR_MISSING_RE.search(head))
```

**3. 동작**
- a. 정상 판별: `"Plan hash value"` 또는 `"| Id |"` 헤더가 plan_text 상단 500자 내 존재 → False
- b. 에러 패턴: `cannot be found`, `no cursor available`, `no plan found`, `NO STATISTICS` 대소문자 무시 매치 → True
- c. 빈 문자열도 True (empty plan 은 fallback 필요)
- d. True 반환 시 호출자가 `RuntimeError` 로 에스컬레이션

---

### (4) EXPLAIN PLAN fallback

**1. 내용**
- DISPLAY_CURSOR 실패 시 EXPLAIN PLAN 으로 논리적 실행계획을 생성한다. A-Time 등 실측값은 없으나 plan 구조는 확인 가능.

**2. 구성**

```sql
EXPLAIN PLAN FOR {tagged_sql};
SELECT plan_table_output
FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, NULL, 'BASIC ROWS BYTES COST PREDICATE'))
```

**3. 동작**
- a. bind 값도 함께 전달 (변수 바인딩으로 계획 변동 방지)
- b. 포맷 `BASIC ROWS BYTES COST PREDICATE` — 실측 stats 없는 논리 plan
- c. 실패 시 plan_text 에 `"-- Plan 조회 실패: {type}: {msg}"` 하드코딩 메시지 저장
- d. EXPLAIN PLAN plan 은 A-Rows/A-Time 등 실측 컬럼 없음 → Xplan 파싱 `_parse_xplan_id0()` 에서 None 반환 → gv$sql SUM 값 fallback 됨

---

### (5) Xplan 파싱 — `_parse_xplan_id0`

**1. 내용**
- DISPLAY_CURSOR ALLSTATS LAST 결과의 Id=0 (SELECT STATEMENT) 행에서 A-Time/Buffers/A-Rows/Starts/Reads 를 추출한다. Xplan A-Time/Buffers 파싱 (2026-04-23) 에서 도입.

**2. 구성**

입력 plan_text 예:
```
| Id | Operation | Name | Starts | E-Rows | A-Rows | A-Time | Buffers | Reads |
| 0 | SELECT STATEMENT | | 1 | | 500 |00:01:05.98 | 66282 | 408 |
```

반환 dict:
```python
{
 "elapsed_sec": 65.98, # A-Time 00:01:05.98 을 Second 변환
 "buffers": 66282, # Buffers
 "a_rows": 500, # A-Rows
 "starts": 1, # Starts (재실행 횟수, 보통 1)
 "reads": 408 # Reads (disk read)
}
```

A-Time 변환:
```python
_ATIME_RE = re.compile(r"(\d{1,3}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?")
# 00:01:05.98 → 65.98 sec
# 01:23:45.678 → 5025.678 sec
```

**3. 동작**
- a. Id=0 행 찾기: 파이프로 분리한 cells 중 첫 컬럼이 `"0"` 인 행
- b. 열 인덱스는 표준 layout `[Id, Operation, Name, Starts, E-Rows, A-Rows, A-Time, Buffers, Reads]` 고정 가정
- c. 파싱 실패 시 모든 키 None 반환 → gv$sql fallback 발동
- d. 파싱 성공 시 sql_performance 적재 시 우선 사용

---

### (6) gv$sql 통계 수집 (fallback 경로)

**1. 내용**
- Xplan 파싱 실패 또는 추가 지표 필요 시 gv$sql 에서 집계 통계를 가져온다.

**2. 구성**

```sql
SELECT SUM(elapsed_time)/1e6, SUM(cpu_time)/1e6,
 SUM(buffer_gets), SUM(disk_reads),
 SUM(executions), SUM(rows_processed)
FROM gv$sql
WHERE sql_id = :sid
```

반환: (elapsed_sec, cpu_sec, buffer_gets, disk_reads, executions, rows_processed)

**3. 동작**
- a. sql_id 는 marker 기반 조회 결과 사용 이후). 이전에는 prev_sql_id 만 사용
- b. Xplan 값이 None 인 컬럼만 gv$sql 값 사용:
 ```python
 elapsed_time_sec = xplan.elapsed_sec ?? gv_elapsed_sec
 buffer_gets_count = xplan.buffers ?? gv_buffer_gets
 executions_count = xplan.starts ?? gv_executions
 disk_reads_count = xplan.reads ?? gv_disk_reads
 rows_processed_count = xplan.a_rows ?? gv_rows
 cpu_time_sec = gv_cpu_sec # Xplan 에 CPU 없음
 ```
- c. marker 격리 실패 시 gv$sql 누적이 과거 실행 포함 → 오염 가능
- d. wall_clock_fallback: gv$sql 결과 빈 row 면 Python `time.time()` 기반 wall elapsed 로 대체, is_estimated='Y'

---

### (7) invisible index 생성

**1. 내용**
- LLM 이 제안한 index_ddls 를 invisible 모드로 생성해 after 세션에서만 옵티마이저가 활용하도록 한다. 운영 구조에 영향 없음.

**2. 구성**

```sql
ALTER SESSION SET OPTIMIZER_USE_INVISIBLE_INDEXES = TRUE;
CREATE INDEX IDX_EMP_DEPT_ID ON EMP(DEPT_ID) INVISIBLE;
```

- LLM 이 `INVISIBLE` 키워드 없이 `CREATE INDEX` 반환 시, `_make_invisible_and_extract_name()` 헬퍼가 텍스트 조작으로 `INVISIBLE` 삽입
- 생성된 index name 을 created_indexes[] 에 기록 (감사 목적)

**3. 동작**
- a. DDL 실행 실패 (권한 부족, 중복 index 등) 시 warning 로그만, 나머지 파이프라인 진행
- b. invisible 속성으로 다른 세션의 기존 SQL 에 영향 없음 (세션 별 옵티마이저 결정)
- c. after 세션 종료 후 invisible index 는 데이터 딕셔너리에 남음 (V1 은 cleanup 미구현 — 운영 DBA 수동 정리)

---

### (8) V$SQL_BIND_CAPTURE 바인드 조회

**1. 내용**
- `/api/sql-binds` 엔드포인트가 Oracle V$SQL_BIND_CAPTURE / DBA_HIST_SQLBIND 를 조회해 프런트에 반환한다.

**2. 구성**

V$SQL 쿼리:
```sql
SELECT name, datatype_string,
 COALESCE(value_string,
 CASE datatype
 WHEN 1 THEN SYS.ANYDATA.ACCESSVARCHAR2(value_anydata)
 WHEN 96 THEN SYS.ANYDATA.ACCESSCHAR(value_anydata)
 WHEN 2 THEN TO_CHAR(SYS.ANYDATA.ACCESSNUMBER(value_anydata))
 WHEN 12 THEN TO_CHAR(SYS.ANYDATA.ACCESSDATE(value_anydata), 'YYYY-MM-DD HH24:MI:SS')
 WHEN 180 THEN TO_CHAR(SYS.ANYDATA.ACCESSTIMESTAMP(value_anydata), 'YYYY-MM-DD HH24:MI:SS')
 ELSE NULL
 END) AS value_string,
 TO_CHAR(last_captured, 'YYYY-MM-DD HH24:MI:SS') AS captured_at
FROM gv$sql_bind_capture
WHERE sql_id = :sql_id
ORDER BY position
```

AWR 쿼리 (fallback):
```sql
SELECT name, datatype_string, value_string,
 TO_CHAR(last_captured, 'YYYY-MM-DD HH24:MI:SS') AS captured_at
FROM dba_hist_sqlbind
WHERE sql_id = :sql_id
 AND snap_id = (SELECT MAX(snap_id) FROM dba_hist_sqlbind WHERE sql_id = :sql_id)
ORDER BY position
```

**3. 동작**
- a. `source=auto` (default) → V$SQL 먼저, 결과 0건이면 AWR 자동 fallback
- b. `source=v$sql` → V$SQL 만
- c. `source=awr` → DBA_HIST_SQLBIND 만
- d. 중복 name 은 첫 번째만 유지 (Python `seen` set)
- e. BLOB/RAW 등 value_string 조회 불가 타입은 빈 배열
- f. _BIND_CAPTURE_INTERVAL (Oracle 기본 15분) 간격 샘플링 한계 존재 — 항상 최신값 보장 안 됨

---

### (9) 조건분기

| Oracle 상태 | 파이프라인 반응 |
|-------------|----------------|
| 커서 aging out (shared pool 압박) | DISPLAY_CURSOR "cannot be found" → EXPLAIN PLAN fallback |
| SQL 에 bind placeholder 있으나 bind_dict 비어있음 | DPY-4010 → exec_err → status='failed' |
| gv$sql 행 0건 (세션 단절·캐시 flush) | wall_clock_fallback → is_estimated='Y' |
| invisible index 생성 권한 없음 | warning 로그 · DDL skip · 파이프라인 계속 |
| V$SQL_BIND_CAPTURE 에 sql_id 없음 | AWR fallback, AWR 도 없으면 빈 배열 |
| sql_text LIKE marker ROWNUM=1 결과 없음 | prev_sql_id fallback |

---

## 소스 반영 필요 항목

### 추가
- * `_is_display_cursor_missing()` 헬퍼 — 4개 패턴 정규식 + 정상 plan 마커 whitelist)
- * `_parse_xplan_id0()` 헬퍼 — Id=0 행 파싱 + A-Time Second 변환)
- * `_extract_plan_hash()` 헬퍼 — "Plan hash value: N" 정규식)
- * `_capture_after` 의 UUID marker 주입 — 이전 누락)

### 변경
- * gv$sql 통계 조회의 sql_id 인자를 `prev_sql_id` 에서 `captured_sql_id (marker 기반)` 로 전환)

