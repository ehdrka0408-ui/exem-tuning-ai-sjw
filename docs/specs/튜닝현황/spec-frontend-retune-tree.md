# 프런트엔드 — 재튜닝 트리 UX

## 문서 목적

튜닝현황 목록(`WorkPipeline.tsx`)에서 재튜닝 체인을 트리 구조로 렌더링하고, 체크박스 격리·시각 구분·alias 자동 카운터를 제공하는 UX 로직을 정의한다.

대상 두 모드:
- **리스트 뷰** (평면 row + 자식 indent)
- **그룹 뷰** (그룹 카드 + 펼친 자식 영역의 트리)

두 모드 모두 동일 트리 헬퍼·동일 평탄화 규칙·동일 alias 카운터를 사용한다.

---

## 사용자 시나리오

**S1 — 재튜닝 체인 추적**
첫 튜닝 결과가 미흡해 재튜닝을 반복 요청. 같은 그룹 안에서 root → 자식 → 손자 형태로 누적되며, 모든 후손이 root 의 1단계 indent 로 노출되어 시간 흐름을 한눈에 파악.

**S2 — 그룹 일괄 삭제**
실패한 체인 전체 정리. 그룹 헤더 체크박스 1회 클릭 → 그룹의 모든 children 선택 → 하단 플로팅 바 "삭제" 클릭. 자식 의 parent_request_id 가 NULL 로 선 UPDATE 후 DELETE (orphan 방지).

**S3 — 자식만 선별 삭제**
체인의 일부 자식만 삭제. 자식 row 단건 체크 → 부모 헤더 indeterminate 상태로 전환 → 해당 자식만 삭제.

**S4 — 같은 SQL 별개 시기 요청**
사용자가 며칠 후 같은 SQL 을 새로 튜닝 요청. 별개 group_id 로 채번되어 트리에 묶이지 않고 별개 root 로 표시 (의도된 재튜닝만 묶이는 가드).

---

## Description

### (1) 그룹 키 — `group_id`

같은 SQL 의 재튜닝 이력은 **`tuning_request_group.group_id` (UUID)** 단위로 묶인다.

| 케이스 | group_id 처리 |
|--------|---------------|
| 신규 튜닝 요청 | 신규 group 채번 |
| 재튜닝 (`parent_request_id` 지정) | parent.group_id 그대로 승계 (신규 group 안 만듦) · parent group.request_count +=1 |
| 같은 SQL 별 시기 신규 요청 2건 | 별개 group_id 2개 (의도된 재튜닝만 묶임) |

→ 결과적으로 같은 group_id = 의도된 재튜닝 체인. 그룹 뷰는 자연히 group_id 단위 카드, 리스트 뷰의 트리도 group_id 일치 자식만 indent.

### (2) 자식 indent 조건 (필수 가드)

리스트 뷰의 트리 indent 는 다음 두 조건을 **모두** 충족할 때만 적용:

```ts
isChild(row) =
  row.parentRequestId != null
  && parent.group_id === row.group_id    // ← 핵심 가드
```

조건 미충족 시 root 처리 (parent 미존재 또는 다른 group 도 동일).

### (3) 트리 평탄화

리스트 뷰·그룹 뷰 공통:

| 요소 | 동작 |
|------|------|
| BFS | root 의 모든 후손(자식·손자·증손)을 수집 |
| 평탄화 | 모든 후손은 `depth = 1` 고정 (자식·손자 동일 시각 indent) |
| 루트 chevron | depth=0 root 에만 chevron 토글. 자식 row 에 chevron 부재 |
| chevron 라벨 | `펼치기 (N건)` — N = root 후손 전체 합 (자식+손자+...) |
| default | 접힘 (사용자 chevron 클릭 시 펼침) |
| 펼침 시 자식 row | indent 1단계 + `└` 커넥터 + `bg-surface-alt/40` 배경 |

→ 사용자는 root 의 chevron 1번만 클릭하면 후손 전체를 1단계 indent 로 볼 수 있음. 다단계 펼치기 불요.

**예시**:
```
rid=196 alias='AWR'                       (root, chevron + (3건))
└ rid=217 alias='AWR_재튜닝(1)'             (자식, depth=1)
└ rid=229 alias='AWR_재튜닝(2)'             (손자 — 평탄화로 1단계 표시)
└ rid=N   alias='AWR_재튜닝(3)'             (증손 — 평탄화로 1단계 표시)
```

---

### (4) 정렬

| 범위 | 규칙 |
|------|------|
| 그룹 간 (그룹 뷰 / 리스트 뷰 root) | 그룹 최신 요청시각 DESC (최근 활동 상단) |
| 그룹 내 자식 (펼친 상태) | requested_at ASC (시간 흐름대로) |
| 컬럼 정렬 변경 | 그룹/root 간 순서만 영향. 그룹 내 자식 순서는 유지 |

---

### (5) 체크박스 격리

| 위치 | 동작 |
|------|------|
| **리스트 뷰** row 체크박스 | row 단위 단건 toggle |
| **그룹 뷰** 그룹 헤더 체크박스 | 해당 그룹 children 만 toggle. 다른 그룹 영향 없음 |
| **그룹 뷰** 자식 row 체크박스 | row 단위 단건 toggle |
| **그룹 뷰** DataTable select-all 헤더 | 격리 핸들러 — `onSelectAll = (checked) => handleGroupToggle(group, checked)`. 그 그룹 children 만 toggle |
| 자식 일부 체크 → 부모/그룹 헤더 | indeterminate (`─`) |
| 자식 전체 체크 → 부모/그룹 헤더 | fully checked |

→ 어떤 상황에서도 다른 그룹의 row 가 함께 체크되는 일 없음.

---

### (6) 일괄 삭제 시 트리 처리

| 케이스 | 백엔드 처리 |
|--------|-------------|
| 자식 없는 단독 row | 해당 row 만 DELETE |
| root 삭제 + 자식 존재 | 자식의 `parent_request_id` 를 NULL 로 선 UPDATE → root DELETE (orphan 방지) |
| 자식 row 삭제 | 부모 영향 없음 |
| 그룹 전체 삭제 (그룹 헤더 체크 후 삭제) | 자식 → 부모 순으로 처리. orphan 발생 없음 |

---

### (7) alias 자동 카운터 규칙

자동 별칭 부여 시:
```ts
// 1) parent chain 거슬러 root 찾기
let rootId = numericId
let cur = samples.find(s => s.id === rootId)
while (cur?.parent_request_id != null) {
  rootId = cur.parent_request_id
  cur = samples.find(s => s.id === rootId)
}
// 2) root 의 모든 후손 BFS 수집 (cohort)
// 3) cohort 의 alias 에서 정규식 매치
const m = a.match(/_재튜닝\((\d+)\)$/)
if (m) maxN = max(maxN, parseInt(m[1], 10))
// 4) baseAlias = stripRetuneSuffix(root.alias)
// 5) newAlias = `${baseAlias}_재튜닝(${maxN + 1})`
```

핵심 원칙:
- baseAlias 는 **tree root** 기준 (parent chain 끝까지 거슬러 올라간 row 의 alias)
- maxN 은 root 의 **모든 후손** alias 중 max
- 사용자가 직접 입력한 alias 는 보존되며, 자동 카운터는 root 기준으로 일관 매김

**예시**:
```
rid=196 alias='AWR'           (root)
└ rid=217 alias='AWR_재튜닝(1)'  (maxN=0 → newAlias='AWR_재튜닝(1)')
└ rid=229 alias='AWR_재튜닝(2)'  (maxN=1 → newAlias='AWR_재튜닝(2)')
└ rid=N   alias='AWR_재튜닝(3)'  (maxN=2 → newAlias='AWR_재튜닝(3)')
```

→ 손자·증손 retune 도 항상 +1 증가, 같은 카운터 충돌 없음.

---

### (8) 재튜닝 가능 상태

다음 status 일 때 재튜닝 버튼 노출:

| 상태 | 의미 |
|------|------|
| `completed` (=approval_pending) | 운영자 검토 대기 |
| `approved` (=apply_pending) | 운영자 승인 |
| `applied` (=fulfilled) | 운영 반영 |
| `failed` | 파이프라인 실패 |
| `no_improve` | 동일 plan_hash 또는 개선 < 10% |

→ 실패·개선없음 상태도 재튜닝 가능 (다시 시도 자연스러움).

---

### 조건분기

| 조건 | 표시 |
|------|------|
| 그룹 내 1건만 존재 | 일반 row · chevron 부재 |
| 그룹 내 root + 자식 존재 | root 에 chevron + `펼치기 (N건)` |
| chevron 펼침 | 모든 후손 1단계 indent 로 노출 |
| 같은 sql_id 다른 group | 별개 root (트리 묶임 없음) |
| parent 미존재 / 다른 group 가리킴 | orphan → root 처리 |
| 루트 체크 + 자식 전부 체크 | 루트 fully-checked |
| 루트 체크 + 자식 일부 | 루트 indeterminate |
| 자식 없는 단독 row 삭제 | 그 row 만 삭제 |
| root 삭제 + 자식 존재 | 자식 parent NULL UPDATE → root DELETE |

---

## 영향 범위

- `src/pages/work/WorkPipeline.tsx` — 트리 빌더(`buildGroupTree`, 리스트 뷰 useMemo) · 체크박스 핸들러(`handleGroupToggle`) · alias 카운터 (`handleRetune`/`handleBulkRetune`) · 그룹 카드 헤더
- `src/lib/alias-util.ts` — `stripRetuneSuffix` 헬퍼
- `src/lib/api.ts` — `TuningRequestSummary` 타입 (group 메타 6키 + parent_request_id)
- `src/mocks/workItems.ts` — `WorkItem` 인터페이스 (groupId, parentRequestId, instanceId 등)

---

## 검증 체크포인트

- [ ] 같은 sql_id 별 시기 신규 2건 → 별개 root (트리 묶임 없음)
- [ ] 부모 + 자식 (parent.group_id == child.group_id) → 자식 indent 1단계
- [ ] 부모 + 자식 + 손자 → root 펼치면 자식·손자 모두 1단계 indent (`└`)
- [ ] 자식 row 에 chevron 부재
- [ ] chevron 옆 자식 수 = 후손 전체 합
- [ ] 자식 단건 체크 → 부모 헤더 indeterminate
- [ ] 부모 체크 → 부모 + 모든 후손 selected, 다른 그룹 영향 없음
- [ ] 그룹 뷰의 그룹 헤더 체크 격리 (펼친 상태에서도)
- [ ] alias 카운터 +1 정상 (손자·증손 retune 도 정상 증가)
- [ ] root 삭제 시 자식 orphan 발생 없음
- [ ] failed/no_improve 상태에서도 재튜닝 버튼 노출
