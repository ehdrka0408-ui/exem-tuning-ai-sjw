# 과제 001: 소스 SQL → V$SQL SQL_ID 매칭

## 해결하려는 문제

개발자는 소스코드의 SQL만 알고 V$SQL에 잡히는 SQL_TEXT 형태를 모름.
SQL_ID 없이는 실행계획 조회조차 불가 → 튜닝 시작점이 막힘.

### 왜 어려운가
- 소스: `SELECT * FROM emp WHERE dept_id = #{deptId}`
- V$SQL: `SELECT * FROM emp WHERE dept_id = :1` (바인드 치환, 공백 정규화, 프레임워크 래핑)
- 프레임워크별 변환 패턴 상이 (MyBatis, JPA/Hibernate, Spring JDBC)
- 동적 SQL → 조건 조합에 따라 N개 변형

## 접근 후보

1. **신택스 유사도** — SQL 정규화(공백/바인드/힌트 제거) 후 비교
2. **SQL 파싱 → AST 비교** — 테이블/컬럼/조인 구조 기반 구조적 매칭
3. **키워드 부분매칭** — 테이블명 + 주요 조건으로 V$SQL TEXT 검색 축소
4. **AI 기반** — LLM에 소스 SQL + V$SQL 후보군 주고 매칭 판단

## 테스트해볼 것

- [ ] MyBatis XML의 SQL vs V$SQL TEXT 실제 차이 패턴 수집
- [ ] 바인드 변수 정규화 규칙 정리 (#{} → :N, ? → :N 등)
- [ ] 공백/줄바꿈 정규화 후 유사도 비교 정확도 측정
- [ ] 동적 SQL (MyBatis `<if>`, `<choose>`) 변형 케이스 수집

## 구현할 것 (테스트 통과 시)

- [ ] SQL 정규화 함수
- [ ] V$SQL TEXT 검색 + 후보 정렬 로직
- [ ] 후보 리스트 UI

## 완료 기준

소스 SQL 입력 → V$SQL 후보 3~5개 제시 → 그 중 정답 포함율 80% 이상

## 상태

🔬 연구 단계
