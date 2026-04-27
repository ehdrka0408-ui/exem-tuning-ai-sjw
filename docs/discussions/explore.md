# 논의 — Top SQL 예외 등록

## 등록된 결정 사항 (2026-04-07)

### Q1. 예외는 sqlId 단위인가, sqlText 단위인가?
**A.** sqlId 단위. sqlText는 바인드 변수/공백 차이로 해시 편차가 크고, AWR/V$SQL에서 이미 sqlId가 1차 식별자로 쓰이기 때문.
예외 DirectInput 차단은 편의상 `isSqlTextException` 으로 sqlText 정규화 비교를 지원 — 관리자가 sqlId 없이 SQL 본문만 가지고 들어올 때 차단하기 위함.

### Q2. 기 생성된 작업(workItems 중 auto/pending)은 어떻게 처리하나?
**A.** (2026-04-07 재결정) **"취소됨 + 사유 남김"**. 사라지게 하는 건 감사 추적이 불가능하므로 B안 채택.
- pending 또는 tuning 상태이고 `selectionSource === 'auto'` 인 작업 중 예외 등록된 SQL은 effective status를 `cancelled` 로 전이
- `cancelReason = "예외 SQL 정책 차단 — {사유}"` 로 설정
- 작업함 상태 필터 탭의 "취소됨" 으로 이동하면 그대로 조회 가능
- 수동 작업(`manual` / `direct_verify`)은 예외 상태와 무관하게 유지 — 이미 튜너가 판단해 넣은 것이므로
- 초기 구현은 `filteredItems` useMemo의 pure derivation 으로 처리(예외 해제 시 자동 복원)

### Q3. 권한?
**A.** mock 단계에서는 미구현. 정식 설계 시 `ROLE_TUNING_ADMIN` 같은 제한이 필요 (등록/해제 모두).

### Q4. 예외 등록을 상세 패널(슬라이드/팝업)에서도 가능하게 해야 하는가?
**A.** 현재 MVP는 행 액션만 제공. 상세에서 등록하는 게 더 자연스러운 경우도 있어(=본문을 열어보고 판단), 향후 `SqlDetailContent` 헤더에 동일 Ban 버튼 추가 여지 있음. 스토어와 핸들러는 이미 준비됨 — props로 내려주기만 하면 됨.

### Q5. 예외 제외 meta는 어디에 표시?
**A.**
- TopSql: 목록 바로 아래 한 줄 (`예외 등록으로 N건 제외됨`)
- WorkPipeline: 상태 필터 / Property filter 바로 아래 meta 라인 (`자동 튜닝 결과에서 N건 예외 제외됨`)
양쪽 다 `N > 0`일 때만 노출.

---

## 중복 작업 방지 결정 사항 (2026-04-07 — P13)

### Q6. 활성 상태 정의는?
**A.** `pending | tuning | approval_pending | apply_pending` 4개만 활성(차단) — `applied | rejected | cancelled` 은 종료(허용). 이유: 적용 후 재발/반려 후 재시도/취소 후 재요청 모두 유효 시나리오.

### Q7. DirectInput 에서 중복 체크와 예외 체크 우선순위?
**A.** **중복 > 예외** (UX Pro Max 판단). 근거:
- 중복은 복구 경로(기존 작업 보기)가 있어 actionable
- 예외는 하드 블록이라 사용자가 할 수 있는 게 없음
- 이미 작업이 있는데 예외 모달을 먼저 띄우면 "근데 작업은 있는데?" 모순
- **상태(fact) > 정책(rule)** 원칙

### Q8. TopSql 의 중복 카드는 숨김 vs 비활성?
**A.** **숨김 + meta**. exception 과 동일한 패턴.
- 숨김: 튜너가 actionable 한 SQL에만 집중
- meta: "이미 작업 중인 SQL N건 제외됨" 으로 맥락 보존
- `handleConfirm` 에서 `workVersion` bump → 생성 직후 해당 카드 즉시 사라짐

### Q9. WorkPipeline 의 중복 meta 는 어떻게 집계?
**A.** 현 단계에서는 **mock 고정값** (`AUTO_DUPLICATE_EXCLUDED_COUNT = 4`).
- 실제: 야간 자동 튜닝 러닝 결과 + 기존 활성 작업 대조 → 스킵된 건수를 실행 메타에 기록
- demo 목적: meta 가 있다는 것 자체를 보여주면 됨 → 실데이터 정합성은 구현 단계 작업

### Q10. 예외 meta + 중복 meta 같은 라인 vs 별도 라인?
**A.** **같은 블록, 별도 라인 (stack)**. UX Pro Max 판단.
- 의미 범주 다름 (warning-Ban vs info-Copy)
- 인터랙션 다름 (예외는 클릭 가능, 중복은 정적 — WorkPipeline 기준)
- 향후 확장성 (다른 자동 제외 사유 추가 시 라인 단위로 자연스럽게)

### Q11. 예외·중복 동시 적중 케이스는?
**A.** DirectInput 에서만 발생 가능. 우선순위에 따라 **중복 모달이 뜨고 예외는 평가되지 않음**. TopSql은 두 필터가 독립적으로 모두 적용되므로 충돌 없음.
향후 개선: 중복 차단 해제(기존 작업 완료 후 재시도) 시 예외 체크가 후속으로 동작하도록 — 현재 구현이 이미 그 동작.
