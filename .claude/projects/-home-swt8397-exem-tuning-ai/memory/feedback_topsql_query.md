---
name: Top SQL 조회 성능 제약
description: Top SQL은 지표 기준별로 개별 조회해야 함 — 5개 한번에 불가, 한 기준 한달치에 1분 걸리는 고객사도 있음
type: feedback
---

Top SQL 조회는 지표 기준(Elapsed/CPU/LReads/PReads/Execs)별로 개별 조회해야 한다. 5개를 한번에 가져오는 것은 불가능.

**Why:** 실제 고객사 환경에서 한 기준으로 한달치 Top SQL 뽑는 데 1분 걸리는 경우도 있음. 5개 동시 조회 = 5분은 말이 안 됨.

**How to apply:** 부하 지표 기준 버튼 클릭 = 서버 재조회 트리거. 프론트에서 정렬만 바꾸는 방식이 아니라, 지표 변경 시 반드시 새 조회가 필요하다는 전제로 UI를 설계할 것. Total/Avg, 뷰모드 등은 프론트 전환 가능.
