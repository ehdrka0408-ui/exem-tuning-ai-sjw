# Exem Tuning AI — 튜닝현황 기능 명세 (팀 인계용)

이 디렉토리는 **튜닝현황 기능** 의 모든 명세를 담은 단일 진입점입니다. 신규 팀원·Claude 에이전트가 프로젝트에 합류했을 때 본 폴더의 md 파일만 읽어도 화면·백엔드·DB 전체 컨텍스트를 파악할 수 있도록 구성됩니다.

---

## 0. 빠른 시작 (Claude / 팀원)

이 폴더를 받았을 때 다음 순서로 읽으세요.

| 순서 | 파일 | 용도 |
|------|------|------|
| 1 | `README.md` | 폴더 인덱스 + 용어집 + 단위 컨벤션 + 역할별 읽는 순서 |
| 2 | `spec-work-list.md` | **튜닝현황 메인 화면** — 그룹/리스트 뷰, 트리, KPI, 체크박스, 재튜닝 alias 규칙. 화면 담당자 우선 |
| 3 | `spec-backend-schema.md` | **PostgreSQL 데이터 모델** — 테이블 정의, 조인 경로, FK 관계. 스키마 담당자 우선 |
| 4 | `spec-backend-api.md` | REST API 요청·응답 스키마 (list / detail / batch / 상태 전이) |
| 5 | `spec-backend-pipeline.md` | 튜닝 파이프라인 상태 FSM, LLM 호출, 재시도, Oracle 캡처 |
| 6 | `spec-backend-oracle-capture.md` | Oracle 세션 캡처 상세 (UUID marker, DBMS_XPLAN, gv$sql, bind) |
| 7 | `spec-frontend-improvement-calc.md` | 개선률 계산 로직 (totals/per-exec, useTotals, 0-coercion 금지) |
| 8 | `spec-frontend-retune-tree.md` | 재튜닝 트리 UX (group_id 기반 분기, 평탄화 정책) |
| 9 | `spec-work-detail-*.md` (5건) | 작업 상세 패널 — 검토/권고안/운영효과/이력/워크스페이스 |
| 10 | `spec-release-2026-04-26.md` | 2026-04-26 릴리즈 가이드 (배포·이식 후 history 로 보존) |

**원칙**: spec-* 파일들은 모두 **현재 시점 스펙** 본문. 변경 이력은 README.md §"변경 이력" 또는 본 폴더의 `spec-release-*.md` 에만 기록.

---

## 1. 본 프로젝트 1줄 정의

> Oracle 운영 DB 의 튜닝 대상 SQL 을 LLM(vLLM/axis-v1) 으로 자동 튜닝하고, 운영자가 결과를 검토·승인·반영하는 흐름을 관리하는 화면 + 백엔드.

---

## 2. 화면 진입점

| 라우트 | 화면 | 담당 spec |
|--------|------|----------|
| `/work` | **튜닝현황 (이 폴더의 핵심 화면)** — 그룹 뷰 / 리스트 뷰 | `spec-work-list.md` |
| `/work/{request_id}` | 작업 상세 슬라이드 패널 | `spec-work-detail-*.md` |
| `/canvas` | SQL 직접 입력 | (별도 화면 — 본 폴더 외부) |
| `/candidates/topsql` | TopSql 대상 선정 (V$SQL/AWR) | (별도 화면 — 본 폴더 외부) |

---

## 3. 인프라

| 항목 | 값 |
|------|------|
| 프런트 | `http://10.10.45.119:3005` (Vite + React 19 + TS 5 + Tailwind v4) |
| 백엔드 API | `http://10.10.45.119:8000` (FastAPI + SQLAlchemy + oracledb) |
| PostgreSQL | `10.10.45.119:5432 / exem_tuning_ai` (`exemone` / `exemone`) |
| Oracle 튜닝 대상 | `10.10.45.203 / REPO / system / oracle` |
| vLLM (LLM 서버) | `http://10.10.48.89:8606` (axis-v1, llm_models 테이블에 등록) |

---

## 4. 담당 영역 (본 문서 기준)

- **튜닝현황 화면 (`/work`)** — 그룹 뷰 · 리스트 뷰 · 트리 · 체크박스 · KPI · alias 규칙 → `spec-work-list.md`
- **PostgreSQL 스키마 설계** — 테이블 구조 · FK · 마이그레이션 정책 → `spec-backend-schema.md`

위 두 파일이 가장 정밀하게 작성된 본문이며, 변경 사항 검토·이식·확장 시 우선 참조.

---

## 5. 단위·네이밍 (전사 공통)

| 접미사 | 단위 | 예시 |
|--------|------|------|
| `_sec` | Second | `elapsed_time_sec`, `cpu_time_sec` |
| `_ms` | Millisecond | `latency_ms`, UI 내부 state |
| `_count` | Count | `buffer_gets_count`, `executions_count` |
| `_at` | timestamptz | `requested_at`, `completed_at` |
| `_hash` | string | `plan_hash` |
| `_pct` | float (0.0~1.0) | `improvement_pct` |

시간 지표는 반드시 **Second** 로 저장·전송. Oracle 원값(microseconds, `A-Time HH:MM:SS.FF`)이 들어오면 Second 로 변환 후 저장.

---

## 6. Claude 작업자에게

본 폴더는 ID-기반 변경 이력 누적 방식이 아니라 **현재 스펙 = 본문**, 변경 이력 = 별도 섹션 형태로 정리되어 있습니다. 새로운 변경 적용 시:
1. 본문 스펙을 직접 수정 (현재 동작이 진실)
2. 변경 이력은 `README.md` 의 변경 이력 섹션에 한 줄 추가
3. 큰 릴리즈는 `spec-release-YYYY-MM-DD.md` 에 별도 기록

이전 릴리즈 코드 (R-NN) 가 본문에 박혀있으면 정리해서 본문화 — 본문엔 R-NN 불필요.
