# 대상 선정 > Top SQL

## 행 액션 (최종)

각 행(ListView) · 카드(CardView) 우측에 두 개의 아이콘 액션이 나란히 놓인다.

| 순서 | 아이콘 | 동작 | 호버 색 |
|------|--------|------|---------|
| 1 | `Ban` | 예외 등록 모달 오픈 | `hover:bg-danger-light hover:text-danger` |
| 2 | `Plus` | 튜닝작업 생성 ConfirmDialog | `hover:bg-code-bg hover:text-code` |

ListView `_action` 컬럼 width = 76 (기존 48에서 확장).

## 예외 등록 모달

- 컴포넌트: `ConfirmDialog` variant=`warning`
- 내용
  - 설명 문구: "이 SQL은 이후 Top SQL 목록·자동 튜닝 작업·직접 입력에서 모두 제외됩니다. 설정 > 예외 SQL 목록에서 해제할 수 있습니다."
  - SQL ID / 인스턴스 / SQL 프리뷰 120자
  - 사유 (선택) — `<textarea rows=2>`
- 확인 버튼: "예외 등록"
- 확인 시 → `addSqlException(...)` → 토스트 → 목록 즉시 리렌더 (구독)

## 목록 반영

`filtered` useMemo 파이프라인 순서:
1. 소스 탭 / 조회조건 / Property filter 적용
2. `isSqlException(c.sqlId)` true 행 제거
3. `isActiveWorkItem(c.sqlId)` true 행 제거 (중복 작업)
4. 지표 정렬

하단 meta (`N > 0` 일 때만 노출, 각각 **별도 라인**):
- `Ban` 예외 등록으로 <N>건 제외됨
- `Copy` 이미 작업 중인 SQL <N>건 제외됨

### 왜 같은 라인에 합치지 않는가
- 예외 meta 는 warning 톤(Ban), 중복 meta 는 info 톤(Copy) — 의미 범주가 다름
- 향후 다른 자동 제외 사유(예: plan hash 미수집) 추가 시 라인 단위로 자연스럽게 확장 가능
- exem 디자인 시스템: "절제된 정보 밀도 + 의도 있는 여백" — 밀집보다 구분이 우선

## 중복 작업 필터 동작

- **활성(차단) 상태**: `pending | tuning | approval_pending | apply_pending`
- **종료(허용) 상태**: `applied | rejected | cancelled` — 재생성 허용
- 이유: 이미 적용된 SQL 도 재발 가능하고, 반려·취소 된 건은 재시도 유효
- 구현: `src/mocks/duplicateCheck.ts` → `isActiveWorkItem(sqlId)`
- 리렌더 트리거: `workVersion` state 를 `handleConfirm` 에서 bump (생성 직후 해당 카드 즉시 사라짐)

## 토스트

2종류로 분기:
- `kind: 'created'` — 성공 계열, 작업함 보기 CTA 포함
- `kind: 'excepted'` — 경고 계열, CTA 없음, Ban 아이콘

## SqlDetailContent (슬라이드 패널 / 팝업 상세)

이후 개선 여지: 상세 패널 헤더에도 예외 등록 버튼 추가 (현재는 행 액션만 제공).
