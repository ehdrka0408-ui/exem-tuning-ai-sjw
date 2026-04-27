# 설정 > 자동 튜닝 정책

경로: `/ops/policies` (기존 `PolicyManagement`)

## 구성 (탭)

1. **예외 SQL 목록** (현재 구현)
2. 자동 튜닝 스케줄 (준비중)
3. 임계치 설정 (준비중)

---

## 예외 SQL 목록

### 목적
자동 튜닝 대상에서 영구 제외할 SQL을 관리한다. 등록 즉시 Top SQL 후보 · 자동 튜닝 작업 · 직접 입력 세 경로 모두에서 해당 SQL이 차단/제외된다.

### 테이블 컬럼
| 컬럼 | 내용 |
|------|------|
| SQL ID | 예외 식별자 (font-mono) |
| SQL TEXT | 본문 80자 프리뷰 + title hover |
| 등록자 | 문자열 (mock: kim_dba 등) |
| 등록일 | YYYY-MM-DD |
| 사유 | 선택 입력 (없으면 `—`) |
| (해제) | 휴지통 아이콘 → ConfirmDialog |

### 검색
단일 입력, SQL ID · 본문 · 등록자 · 사유 대소문자 무시 부분일치.

### 해제 동선
행 우측 휴지통 → ConfirmDialog (danger) → 확인 시 스토어에서 제거 → 구독자(Top SQL, WorkPipeline) 즉시 리렌더.

### 빈 상태
- 검색 결과 0건: "검색 결과가 없습니다."
- 전체 0건: "등록된 예외 SQL이 없습니다. 대상 선정 > Top SQL에서 각 행의 예외 등록 버튼으로 추가할 수 있습니다."

### 상단 요약
"총 N건 등록됨" + (필터 중이면) "(필터: M건)"

## 스토어
`src/mocks/sqlExceptions.ts`
- 세션 스토어 (새로고침 시 SEED 복원)
- `subscribeSqlExceptions(listener)` / `window` `sqlExceptionsChange` 이벤트
- 소비자: TopSql · WorkPipeline · DirectInput · PolicyManagement
