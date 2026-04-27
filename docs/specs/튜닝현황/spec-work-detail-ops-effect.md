# 작업 상세 — 운영효과

## 탭 목적

반영 완료 후 실제 운영 환경에서 성능이 개선되었는지 확인하는 탭. MaxGauge에서 After SQL을 자동 탐색하고, Before/After 실측 수치를 바 차트로 비교하여 튜닝 효과를 검증한다.

### 사용자 시나리오

**시나리오 1 — 반영 후 효과 확인**
튜너가 반영 완료된 건의 운영효과 탭 진입 → After SQL 후보 자동 탐색 → 후보 선택 후 등록 → Before/After 바 차트로 실측 개선율 확인

**시나리오 2 — 성능 저하 감지**
운영효과 탭에서 After 수치가 Before보다 악화 → 성능 저하 라벨 + 빨간색 바 표시 → 튜너가 원인 파악 후 조치

---

## 레이아웃

검토 탭과 동일한 슬라이드 패널 내부에서 표시 (→ spec-work-detail-review.md 레이아웃 참조).

---

## Description

### (1) MaxGauge 미연동 상태

**1. 내용**
- MaxGauge 연동이 안 된 경우 안내 메시지를 표시한다.

**2. 구성**
- a. 안내 메시지 — "운영효과 기능을 사용하려면 MaxGauge 연동이 필요합니다"

**3. 동작**
- 없음 (읽기 전용)

---

### (2) After SQL 미등록 상태 (기본)

**1. 내용**
- 반영 완료 후 아직 After SQL이 등록되지 않은 상태. After SQL 후보 탐색을 유도한다.

**2. 구성**
- a. Before/After 바 차트 (2본) — Before=채움, After=빈 막대 (데이터 없음 시각화)
- b. 안내 텍스트 — "운영 효과를 확인하려면" + "반영 완료 후 MaxGauge에서 EXEM_TUNING_ID 주석이 포함된 After SQL을 탐색합니다. 후보를 선택하면 실제 운영 수치가 채워집니다."
- c. "After SQL 후보 찾기 (MaxGauge)" 버튼 — 강조 버튼

**3. 동작**
- a. "After SQL 후보 찾기" 클릭 → After SQL 검색 패널 펼침

---

### (3) After SQL 검색 패널

**1. 내용**
- MaxGauge에서 EXEM_TUNING_ID 주석이 포함된 SQL을 자동 탐색하여 후보 목록을 보여준다.

**2. 구성**
- a. 탐색 중 상태 — 스피너 + "EXEM_TUNING_ID 주석으로 MaxGauge 탐색 중..."
- b. 후보 없음 상태
 - 안내 텍스트 — "MaxGauge에서 After SQL을 찾지 못했습니다"
 - 설명 — EXEM_TUNING_ID 주석이 달린 SQL이 아직 실행되지 않았거나 수집 주기가 지나지 않았을 가능성
 - "다시 탐색" 버튼
- c. 후보 목록 (컴팩트 테이블)
 - 출처 배지 — MaxGauge
 - 안내 — "반영일 이후 누적 기준 · EXEM_TUNING_ID 주석 매칭"
 - 테이블 (sticky 헤더, max-h 280px 스크롤, 10~20건 대응)
 - 컬럼: 선택(라디오) | SQL ID | 최초 발견 | 실행(기간) | 평균 | 전체보기
 - SQL ID — 고정폭 파란 글꼴
 - 최초 발견 — MM-DD 형식
 - 실행(기간) — "1,842 /10일" 형식 (실행횟수 + 측정기간)
 - 평균 — 초 단위 소수점 2자리 (e.g., "0.12s")
 - 전체보기 아이콘 (Maximize2) — 클릭 시 검토탭과 동일한 ComparePanel(플로팅 패널)로 전체 SQL TEXT 표시. titleOverride="SQL". 드래그/리사이즈/구문강조/복사 동일.
 - 선택된 SQL 미리보기 — 테이블 아래 2줄 말줄임 표시
 - "등록" 버튼

**3. 동작**
- a. 행 클릭 → 라디오 선택, 선택 행 하이라이트(code-bg)
- b. "등록" 클릭 → 운영 실측 데이터 등록, 이력에 `after_sql_registered` 이벤트 추가, 토스트 "After SQL 등록 완료 — 운영 실측 데이터가 반영되었습니다"
- c. "다시 탐색" 클릭 → 스피너 표시 후 재탐색

---

### (4) After SQL 등록 완료 상태

**1. 내용**
- Before/After 실측 수치를 바 차트로 비교하여 운영 효과를 보여준다.

**2. 구성**
- a. Before/After 바 차트 (2본)
 - Before — 기본 색상 (action)
 - After — 개선 시 초록(success), 악화 시 빨강(danger)
 - 상단 수치 라벨 (ms)
- b. 개선율 배지 — "-94.9%" (초록) 또는 "+12.3%" (빨강)
- c. 운영 상태 라벨
 - 안정 — CheckCircle2 아이콘 + 초록
 - 성능 저하 — AlertCircle 아이콘 + 빨강
 - 모니터링중 — Clock 아이콘 + 회색
- d. 출처 — MaxGauge (하드코딩, AWR/V$SQL 미사용)
- e. 측정 기간 정보
 - "측정 기간 MM-DD HH:MM ~ MM-DD HH:MM" (시작~종료 기간 표시)
 - "N회 실행 기준" (별도 줄)

**3. 동작**
- 없음 (읽기 전용)

---

### 조건분기

- MaxGauge 미연동 → (1) 표시
- After SQL 미등록 → (2) 표시
- After SQL 등록 완료 → (4) 표시
- 운영 결과 회귀(regressed/degraded) → After 바 빨간색 + 성능 저하 라벨

---

## 소스 반영 필요 항목

### 변경
- (없음)

### 추가
- (없음)

