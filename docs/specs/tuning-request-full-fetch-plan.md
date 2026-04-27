# 백엔드 지침 — 튜닝요청 시 전체 rows 조회 + Plan(ALLSTATS LAST) 저장

**대상 엔드포인트:** `POST /api/tuning/requests`
**수정 파일:** `backend/app/api/tuning_requests.py` → `_capture_before()`
**작성일:** 2026-04-17
**상태:** 구현 대기

---

## 1. 배경 / 목적

- `/api/sql/execute` (직접 입력, 사용자 UX) 는 `row_limit=200` + PageDown/Ctrl+End 페이징으로 운영되고, Plan 은 참고용.
- 반면 **튜닝요청** 경로는 LLM 이 분석에 사용할 **정확한 실측 Plan** 이 필수.
- `DBMS_XPLAN.DISPLAY_CURSOR(..., 'ALLSTATS LAST')` 는 cursor 의 **마지막 실행 전체** 에 대한 `Starts / E-Rows / A-Rows / A-Time / Buffers / Reads / OMem / 1Mem` 실측을 리턴하므로, 이를 저장하려면 **cursor 를 끝까지 fetch 한 이후** 에 조회해야 한다.
- 부분 fetch(예: `fetchmany(1000)`) 로 cursor 를 중단하면 `A-Rows` 가 fetch 된 양까지만 기록되어 오인(under-reporting) 을 유발한다.

## 2. 결정 사항

> 튜닝요청 시 사용자 SQL 은 **전체 rows 까지 fetchall()** 한 뒤 Plan 을 캡처해 저장한다. (safety cap 은 §5 참조)

## 3. 변경 요지 (diff 요약)

`_capture_before()` 함수:

### 3-1. 실행 전 세션 설정 추가
```python
# 추가: 실측 통계 수집을 위한 session-level 설정
cur.execute("ALTER SESSION SET statistics_level = ALL")
```
`CURRENT_SCHEMA` 설정 직후, `EXPLAIN PLAN`/user SQL 실행 전에 반드시 선행.

### 3-2. 실행 블록 — EXPLAIN PLAN 우선순위 강등, fetchall 로 변경
```python
# 기존
cur.execute("EXPLAIN PLAN FOR " + sql, bind_dict)        # 1차 Plan
cur.execute("SELECT ... DBMS_XPLAN.DISPLAY(...)")         # 1차 Plan 읽기
...
cur.execute(sql, bind_dict)                               # 실 수행
fetched = cur.fetchmany(1000)                             # ★ 1000 행 제한

# 변경
cur.execute(sql, bind_dict)                               # 실 수행 먼저
if cur.description:
    fetched = _fetch_all_with_cap(cur)                    # ★ 전체 fetch (cap 적용)
    rows_processed = len(fetched)
```
`EXPLAIN PLAN` 블록은 **DISPLAY_CURSOR 실패 시의 fallback** 으로만 유지.

### 3-3. sql_id / child_number 즉시 캡처 (recursive SQL 오염 방지)
사용자 SQL fetchall 직후, 같은 cursor 에서 `prev_sql_id / prev_child_number` 를 즉시 읽는다. (`/api/sql/execute` 수정본과 동일 패턴)
```python
cur.execute("""
    SELECT prev_sql_id, prev_child_number
    FROM v$session
    WHERE sid = SYS_CONTEXT('USERENV','SID')
""")
row = cur.fetchone()
captured_sql_id  = row[0] if row else None
captured_child   = row[1] if row else None
```

### 3-4. Plan 캡처 — explicit sql_id 전달
```python
try:
    if captured_sql_id:
        cur.execute(
            "SELECT plan_table_output FROM TABLE("
            "DBMS_XPLAN.DISPLAY_CURSOR(:sid, :child, 'ALLSTATS LAST'))",
            {"sid": captured_sql_id, "child": captured_child},
        )
    else:
        cur.execute(
            "SELECT plan_table_output FROM TABLE("
            "DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'ALLSTATS LAST'))"
        )
    plan_text = "\n".join(r[0] for r in cur.fetchall())
    if not plan_text.strip():
        raise RuntimeError("empty plan")
except Exception as e:
    logger.warning(f"DISPLAY_CURSOR failed, fallback to EXPLAIN PLAN: {e}")
    cur.execute("EXPLAIN PLAN FOR " + sql, bind_dict)
    cur.execute(
        "SELECT plan_table_output FROM TABLE("
        "DBMS_XPLAN.DISPLAY(NULL, NULL, 'BASIC ROWS BYTES COST PREDICATE'))"
    )
    plan_text = "\n".join(r[0] for r in cur.fetchall())
```

`NULL, NULL` 을 그대로 두면 oracledb 드라이버의 recursive SQL(e.g. `update user$`) 로 `prev_sql_id` 가 덮이는 문제가 재현됨 → 반드시 explicit 전달.

### 3-5. V$SQL 성능 통계 — 기존 로직 유지
`captured_sql_id` 를 재사용해 `gv$sql` 집계 → `before_performance` 채움. (현재 구현과 동일, 변수명만 공유)

## 4. Plan 저장

- 기존대로 `sql_plans` 테이블에 `plan_type='before'` 로 INSERT.
- `plan_text` 포맷이 `BASIC ROWS BYTES COST PREDICATE` → **`ALLSTATS LAST`** 로 바뀌므로:
  - 컬럼 세트 확장: `Starts, E-Rows, A-Rows, A-Time, Buffers, Reads, OMem, 1Mem, Used-Mem`
  - 프론트는 `<pre>` monospace 렌더이므로 시각적 호환 O
  - **파싱 로직이 있다면** (예: Top N operation 추출) 컬럼 offset 재점검 필요

## 5. 성능 / 안전 장치 (필수)

### 5-1. Row count soft cap
```python
MAX_ROWS_FOR_TUNING = 10_000_000   # 환경변수 override 권장: TUNING_MAX_FETCH_ROWS
CHUNK = 10_000

def _fetch_all_with_cap(cur):
    out = []
    while True:
        batch = cur.fetchmany(CHUNK)
        if not batch:
            break
        out.extend(batch)
        if len(out) >= MAX_ROWS_FOR_TUNING:
            logger.warning(f"fetch capped at {MAX_ROWS_FOR_TUNING}")
            break
    return out
```
- cap 에 걸리더라도 cursor 는 끝까지 읽지 않은 상태 → `A-Rows` 가 절단(cap)까지만 반영됨. 이 경우 `plan_text` 에 `-- truncated at MAX_ROWS_FOR_TUNING rows` 주석 prefix 를 붙여 저장.

### 5-2. Connection timeout
```python
conn.call_timeout = int(os.getenv("TUNING_CALL_TIMEOUT_MS", "600000"))   # 기본 10분
```
요청당 Oracle 호출 전체에 걸쳐 상한선. 초과 시 `DPI-1067` 발생 → `status='failed'` 로 전이.

### 5-3. 메모리
- rows 는 row_processed count 만 필요하고 **응답에 담지 않음** (기존과 동일). 대용량 fetch 시 `out.extend(batch)` 를 제거하고 `cnt += len(batch)` 로 대체해 O(1) 메모리 운영 권장.

### 5-4. 비동기 처리 (장기 과제)
- 10만 row 이상 SQL 은 HTTP 요청 타임아웃을 깨기 쉬움.
- 장기적으로 `/api/tuning/requests` 는 `202 Accepted + request_id` 를 즉시 리턴하고, 실제 before 캡처는 background worker 가 수행하도록 분리. (현재 구현은 동기식이므로 §5-1, §5-2 cap 만으로 충분히 방어.)

## 6. API 계약 변경

| 항목 | 현재 | 변경 |
|------|------|------|
| `before_plan` (string) | `EXPLAIN PLAN` 출력 | `DBMS_XPLAN.DISPLAY_CURSOR('ALLSTATS LAST')` 출력. 실패 시 EXPLAIN fallback |
| `before_performance` | wall+gv$sql | 동일 (이제 전체 fetch 기반이므로 `rows_processed_count` 가 실제 전체 행 수) |
| response shape | 변동 없음 | 변동 없음 |

프론트 수정 불필요.

## 7. 테스트 체크리스트

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| 1 | 수백 행 SELECT | `plan_text` 에 `A-Rows` 존재, `rows_processed_count` = 실제 행 수 |
| 2 | 10만 행 이하 SELECT (cap 내) | 전체 fetch 완료, 타임아웃 없음 |
| 3 | cap 초과 SELECT | `plan_text` 에 `-- truncated at ...` 주석, status='requested' 정상 |
| 4 | ORA 에러 SQL | `before_plan=NULL`, `status='failed'` |
| 5 | 동시 요청 2건 | 각자 sql_id 로 Plan 캡처, 섞이지 않음 |
| 6 | `sql_plans` 테이블 검증 | plan_type='before', plan_text 의 Operation/A-Rows 가 SQL 과 일관 |
| 7 | V$SQL 통계 동기화 | `buffer_gets / elapsed_time` 이 `plan_text` 의 Buffers 총합과 근접 |

## 8. 관련 파일

- `backend/app/api/tuning_requests.py` — 수정 대상
- `backend/app/api/sql_execute.py` — 참고(동일 패턴 이미 적용)
- `src/components/canvas/DirectInputIdle.tsx` — 프론트 Plan 렌더러 (변경 불필요)

---

**요약:** 튜닝요청은 "끝까지 실행(fetchall, cap 10M)" → "prev_sql_id/child 즉시 캡처" → "DISPLAY_CURSOR(:sid,:child,'ALLSTATS LAST')" → "sql_plans.before 저장" 순서로 처리한다. `/api/sql/execute` 는 UX 용으로 기존 페이징 유지, 튜닝 품질은 이 경로에서 담보.
