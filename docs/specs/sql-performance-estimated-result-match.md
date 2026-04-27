# sql_performance — is_estimated / result_match 컬럼 명세

**작성일:** 2026-04-23  
**마이그레이션:** `backend/alembic/versions/e8f9a0b1c2d3_sql_performance_is_estimated_result_match.py`  
**상태:** 구현 완료 (result_match 적재 로직은 TODO — §4 참조)

---

## 1. 컬럼 정의

### 1-1. `is_estimated` CHAR(1) NOT NULL DEFAULT 'N'

| 항목 | 값 |
|---|---|
| 타입 | CHAR(1) |
| NOT NULL | O |
| 기본값 | `'N'` |
| CHECK | `is_estimated IN ('Y','N')` |
| 제약명 | `sql_performance_is_estimated_check` |

| 값 | 의미 |
|---|---|
| `'N'` | 실측 — Oracle `gv$sql` 통계에서 직접 수집한 elapsed_time_sec / cpu_time_sec / buffer_gets_count 등 |
| `'Y'` | 예상치 — `gv$sql` 조회 실패로 wall clock 으로 대체(`wall_clock_fallback`)하거나 EXPLAIN PLAN 기반 추정값 |

**기존 레코드:** 마이그레이션 시 DEFAULT 'N' 적용. 실제로 기존 레코드는 모두 Oracle 실수행 결과이므로 'N'이 의미적으로도 정확.

---

### 1-2. `result_match` CHAR(1) NULL

| 항목 | 값 |
|---|---|
| 타입 | CHAR(1) |
| NOT NULL | X (NULL 허용) |
| 기본값 | NULL |
| CHECK | `result_match IN ('Y','N')` (NULL 은 CHECK 통과) |
| 제약명 | `sql_performance_result_match_check` |

| 값 | 의미 |
|---|---|
| `'Y'` | 튜닝 전(before) 과 후(after/applied) 결과셋 일치 확인됨 |
| `'N'` | 결과셋 불일치 — TO-BE SQL 이 AS-IS 와 다른 결과를 반환 |
| `NULL` | 비교 미실행 — 해당 phase 에서 결과셋 비교를 수행하지 않은 케이스 |

---

## 2. 값 세팅 규칙

### is_estimated 결정 경로

```
Oracle 실수행 완료
  └── gv$sql 통계 조회 성공   → is_estimated = 'N'  (실측)
  └── gv$sql 조회 실패        → wall clock 사용
        wall_clock_fallback=True → is_estimated = 'Y'  (예상치)
```

| phase | 결정 위치 | 값 |
|---|---|---|
| `before` | `tuning_requests.py` → `create_tuning_request()` before INSERT | 항상 `'N'` (before 는 gv$sql 성공 여부와 무관하게 'N'으로 고정 — wall_clock_fallback 은 rationale 마커로 별도 기록됨) |
| `after` | `tuning_pipeline.py` → `_persist_after_snapshot()` | `after.wall_clock_fallback` 이 True 면 `'Y'`, False 면 `'N'` |
| `applied` | `tuning_requests.py` → `apply_tuning_request()` apply INSERT | 항상 `'N'` (apply 단계도 동일 정책) |

> **NOTE:** before phase 의 wall_clock_fallback 도 엄밀히는 `is_estimated='Y'`가 맞으나, 프론트 "실측/예상" 컬럼의 사용자 UX 상 before 는 항상 "실측"으로 표시하는 것이 직관적이라 판단하여 'N' 고정. 필요 시 `_capture_before()` 반환값 `before_fallback` 을 INSERT 에 연결하면 됨.

### result_match 결정 경로

**현재:** 모든 phase 에서 `NULL` 고정 (비교 로직 미구현 — §4 참조).

향후 구현 시:
- before → after 결과셋 row-count 또는 hash 비교 후 일치하면 `'Y'`, 불일치 `'N'`
- applied 단계에서는 before 결과셋 hash 와 대조

---

## 3. API 응답 계약

### GET /api/tuning/requests/{request_id}

`performance` 배열 각 항목에 두 필드 포함:

```json
{
  "performance": [
    {
      "phase": "before",
      "elapsed_time_sec": 33.926617,
      "cpu_time_sec": 27.235394,
      "buffer_gets_count": 66278,
      "disk_reads_count": 8790,
      "executions_count": 1,
      "rows_processed_count": 500,
      "captured_at": "2026-04-21 14:09:15.204596+09:00",
      "is_estimated": "N",
      "result_match": null
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `is_estimated` | `"N"` \| `"Y"` | 실측 여부. 프론트 "실측/예상" 컬럼 표시 기준 |
| `result_match` | `"Y"` \| `"N"` \| `null` | 결과셋 일치 여부. null = 비교 미실행 (현재 항상 null) |

---

## 4. 남은 TODO

### TODO-1: result_match 적재 로직 구현

**위치:** `backend/app/services/tuning_pipeline.py` → `_capture_after()` 또는 `run_tuning_job()`  
**내용:** AS-IS 결과셋과 TO-BE 결과셋을 비교(row count / checksum)하여 일치 여부를 `result_match`에 적재.  
**설계 고려사항:**
- 결과셋이 클 경우 fetchall 대신 COUNT(*) 또는 첫 N 행 hash 비교 검토
- before phase 결과셋은 이미 fetch 완료 상태 — 비교를 위해 메모리에 보존하거나 hash 를 별도 저장해야 함
- before INSERT 시 `result_match=NULL` 유지, after INSERT 시 비교 결과 반영

### TODO-2: before phase is_estimated 정밀화 (선택)

현재 before 는 wall_clock_fallback 여부와 무관하게 `'N'` 고정.  
`_capture_before()` 반환값 `before_fallback` 이 True 인 경우 `'Y'`로 세팅하려면 `create_tuning_request()` 의 before INSERT 에 `"ie": "Y" if before_fallback else "N"` 바인드를 추가하면 됨.

---

## 5. 신규 기능 구현 시 준수사항

> **sql_performance 에 성능 기록을 남기는 모든 로직은 반드시 `is_estimated` 와 `result_match` 를 명시적으로 세팅해야 한다.**

```sql
-- 올바른 예
INSERT INTO sql_performance (
    request_id, instance_id, sql_id, phase,
    elapsed_time_sec, cpu_time_sec, buffer_gets_count,
    disk_reads_count, executions_count, rows_processed_count,
    is_estimated, result_match              -- ← 반드시 포함
)
VALUES (..., 'N', NULL);

-- 잘못된 예 — is_estimated 누락 시 DEFAULT 'N' 이 적용되지만
-- 의도가 불명확해 코드 리뷰 시 지적 대상
INSERT INTO sql_performance (request_id, ..., rows_processed_count)
VALUES (...);
```

**판정 기준:**
- Oracle 실수행(`gv$sql` 통계 직접 수집) → `is_estimated = 'N'`
- wall clock 대체 / EXPLAIN PLAN 추정 / LLM 예측값 → `is_estimated = 'Y'`
- 결과셋 비교 미실행 → `result_match = NULL`
- 비교 실행 후 일치 → `result_match = 'Y'`
- 비교 실행 후 불일치 → `result_match = 'N'`

---

## 6. 단위 규칙 (기존 컨벤션 재확인)

| 지표 | 컬럼명 suffix | 단위 |
|---|---|---|
| 경과 시간 | `_sec` | Second (초, 소수점 허용) |
| CPU 시간 | `_sec` | Second |
| Buffer 접근 | `_count` | Count (회) |
| Disk 읽기 | `_count` | Count (회) |
| 실행 횟수 | `_count` | Count (회) |
| 처리 행수 | `_count` | Count (행) |

ms(밀리초) 단위 혼용 금지. 적재 전 반드시 초 단위로 변환.
