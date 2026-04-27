# 직접 지정 (Direct Input) — 중복·예외 차단

경로: `/candidates/direct` (`DirectInput`)

## 차단 체크 순서 (최종)

`handleTuningRequest` 는 다음 순서로 체크한다. **앞 단계가 걸리면 뒷 단계는 평가하지 않음.**

1. **빈 값** — `!sqlText.trim()` → 조용히 return (버튼 disabled 로 이미 차단됨)
2. **중복 체크** — `findActiveWorkItemByText(sqlText)` → 활성 작업 존재 시 `blockedDuplicate` 모달
3. **예외 체크** — `isSqlTextException(sqlText)` → 예외 일치 시 `blockedException` 모달
4. **Confirm** — 기존 튜닝 요청 ConfirmDialog 오픈 → `addNewWorkItem`

### 왜 중복 > 예외 순서인가
- 중복은 **복구 경로가 있음** (기존 작업 보기) — 사용자에게 바로 actionable 한 정보
- 예외는 **하드 블록** (관리자 해제 필요) — 사용자가 할 수 있는 게 없음
- 이미 작업이 있는데 예외 모달을 먼저 띄우면 사용자가 "근데 작업은 있는데?" 라는 모순을 만남 → 에러 모델 깨짐
- **상태(fact) > 정책(rule)** — 데이터 사실을 먼저 노출

## 중복 차단 모달 (blockedDuplicate)

- variant 성격: warning (bg-warning-light / text-warning, `Copy` 아이콘)
- 내용
  - 타이틀: "이미 작업이 존재합니다"
  - 설명: "이 SQL은 이미 작업함에 등록되어 진행 중입니다. 기존 작업을 먼저 확인해 주세요."
  - 메타 카드: 작업 ID / SQL ID / 작업명 / 상태 / 담당자 / 생성일
  - 푸터: "중복 생성 방지를 위해 튜닝 요청을 생성할 수 없습니다."
- 푸터 버튼: `닫기` + `기존 작업 보기 →` (클릭 시 `/work/{id}` 로 이동)
- 닫기: 우상단 X, 오버레이 클릭, "닫기" 버튼

## 예외 차단 모달 (blockedException)

- variant 성격: warning (bg-warning-light / text-warning, `Ban` 아이콘)
- 내용
  - 타이틀: "예외 등록된 SQL"
  - 설명: "이 SQL은 예외 목록에 등록되어 있어 튜닝 요청을 생성할 수 없습니다."
  - 메타 카드: SQL ID / 등록자 / 등록일 / 사유
  - 푸터: "해제가 필요하면 설정 > 예외 SQL 목록에서 관리자가 해제해야 합니다."
- 닫기: 우상단 X, 오버레이 클릭, "확인" 버튼

## 매칭 규칙

`isSqlTextException` / `findActiveWorkItemByText` 모두 동일 정규화 사용:
```
norm(s) = s.replace(/\s+/g, ' ').trim().toLowerCase()
```
- 이 정규화는 demo용이다. 실제 구현 시에는 hash-normalized plan 또는 정규화된 canonicalized SQL 해시 기반 매칭이 권장된다.
- 활성(in-flight) 상태 정의: `pending | tuning | approval_pending | apply_pending`. `applied | rejected | cancelled` 은 종료 상태이므로 재생성 허용.

## TODO (향후)
- sqlId 수동 입력 필드 추가 후 sqlId 기반 매칭 병행
- 파라미터 placeholder 정규화 (`:1` vs `:bind1`)
- 중복과 예외가 동시에 걸리는 edge case 의 사용자 안내 메시지 다듬기
