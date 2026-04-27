# tuning_requests.user_id 추가 및 db_instances PK 컬럼 rename 명세

작성일: 2026-04-23  
마이그레이션 리비전: f1a2b3c4d5e6 (user_id), g2b3c4d5e6f7 (PK rename)

---

## 1. tuning_requests.user_id

### 의미

튜닝 요청을 제출한 사용자를 식별하는 컬럼. `console_users.id` (VARCHAR) FK 참조.  
세션/인증 연동은 포함하지 않음 — 프론트가 요청 body에 포함하면 그대로 적재.

### 컬럼 스펙

| 항목 | 값 |
|---|---|
| 컬럼명 | `user_id` |
| 타입 | `VARCHAR(64)` |
| NULL | 허용 (기존 레코드 소급 불가) |
| FK | `console_users(id)` |
| 인덱스 | `ix_tuning_requests_user_id` |

### API 계약

#### POST /api/tuning/requests (요청 body)

```json
{
  "sql_text": "SELECT ...",
  "instance_id": "1",
  "user_id": "user-uuid-or-login-id"  // 선택 필드, 없으면 NULL 적재
}
```

#### GET /api/tuning/requests/{request_id} (응답)

```json
{
  "request_id": "TR-000001",
  "user_id": "user-uuid-or-login-id",  // null 가능
  ...
}
```

### 세팅 규칙

- 프론트가 `user_id`를 보내면 적재, 생략하면 NULL 저장.
- 세션 기반 자동 주입은 인증 미들웨어 연동 후 별도 작업.
- `user_id` 값은 `console_users.id` 실존 값이어야 FK 통과 (NULL은 허용).

---

## 2. db_instances PK 컬럼명 변경 이력

### 변경 내용

| 구분 | 변경 전 | 변경 후 |
|---|---|---|
| 컬럼명 | `id` | `instance_id` |
| PK 제약 | `db_instances_pkey (id)` | `db_instances_pkey (instance_id)` |
| 시퀀스 | 없음 (수동 입력 PK) | 없음 |

### FK 처리 결과

| FK 이름 | 참조 테이블 | 처리 방법 |
|---|---|---|
| `sql_texts_instance_id_fkey` | `sql_texts(instance_id)` → `db_instances(instance_id)` | drop → recreate (이름 유지) |
| `tuning_requests_instance_id_fkey` | `tuning_requests(instance_id)` → `db_instances(instance_id)` | drop → recreate (이름 유지) |

FK 이름은 이미 `_instance_id_` 기반이었으므로 rename 없이 유지.

### FK 네이밍 컨벤션 (신규 기준)

```
{참조테이블}_{참조컬럼}_fkey
예) tuning_requests_instance_id_fkey
    tuning_requests_user_id_fkey (→ fk_tuning_requests_user_id 로 등록됨)
```

신규 FK는 `fk_{테이블}_{컬럼}` 형식도 허용 (2026-04-23 이후 추가분).

---

## 3. 프론트 연동 영향

### db_instances 관련 응답 변경

GET/POST/PATCH `/api/instances` 응답에서 `id` 키가 `instance_id` 로 변경됨.

**변경 전:**
```json
{ "id": "1", "name": "REPO", ... }
```

**변경 후:**
```json
{ "instance_id": "1", "name": "REPO", ... }
```

**프론트 수정 필요 지점:**
- `instances` 목록/등록/수정 화면에서 `item.id` 참조를 `item.instance_id` 로 변경
- `/api/instances/{id}/test` path param은 변경 없음 (내부 변수명만 정리됨)

