# fix.md — workbench-c2 위에 적용된 변경사항 목록

> 베이스 커밋: `e8604f4` (workbench-c2)
> 작성: 2026-04-15
> 동반 파일: `docs/CHANGES.patch` (재적용용 git patch)

---

## 1. 변경 사항 요약

### A. 백엔드 신설 (`backend/`)
- **FastAPI + SQLAlchemy 2.0 + Alembic + pgvector** 풀스택 백엔드 신설
- 위치: `backend/`
- DB: PostgreSQL 15.17 (`exem_tuning_ai`, user `exemone`, host 10.10.45.119)
- 주요 파일:
  - `backend/app/main.py` — FastAPI app + CORS + 라우터 등록
  - `backend/app/core/config.py` — 환경 설정 (Pydantic Settings)
  - `backend/app/db/session.py` — SQLAlchemy engine, Base, get_db
  - `backend/app/models/tuning_case.py` — `tuning_cases` 테이블 (+ pgvector embedding)
  - `backend/app/models/plan.py` — `plans`, `bind_variables` 테이블
  - `backend/app/api/health.py` — `/health`, `/health/db`
  - `backend/app/api/tuning_cases.py` — `/api/cases`, `/api/cases/{id}` (plans/binds 포함)
  - `backend/alembic/` — 마이그레이션 (2건 적용 완료)
  - `backend/scripts/seed.py` — 실습 스크립트 3건 + mock plan_change 5건
  - `backend/scripts/seed_candidates.py` — candidates.ts 3건 추가
  - `backend/requirements.txt` — 의존성 잠금
- **재현 명령**:
  ```bash
  cd backend && python3.9 -m venv venv && source venv/bin/activate
  pip install -r requirements.txt
  alembic upgrade head
  PYTHONPATH=. python scripts/seed.py
  PYTHONPATH=. python scripts/seed_candidates.py
  uvicorn app.main:app --host 0.0.0.0 --port 8000
  ```

### B. 프론트엔드 신규 페이지 — `/db/cases`
- `src/pages/db/CasesDbPage.tsx` — 백엔드 API 연동 첫 화면 (케이스 리스트 + 상세)
- `src/lib/api.ts` — `fetchCases()` / `fetchCase(id)` 클라이언트
- `.env.local` — `VITE_API_BASE=http://10.10.45.119:8000`
- `src/App.tsx` — `/db/cases` 라우트 추가, ObjectInfoProvider/Panel 전역 장착
- `vite.config.ts` — `host: '0.0.0.0', port: 3005`

### C. Object Info 기능 (v7 sql-tuning-ai-draft 포팅 + 개선)
원본 v7 vanilla JS → React 컴포넌트로 포팅 + 다수의 개선.

**라이브러리 (`src/lib/object-info/`)**:
- `sqlHighlight.js` — 토크나이저 / `findPredicateUnits` / `findMatches` / `findPredicatesForObject` (로직 대폭 개선)
- `aliasResolver.js` — `buildAliasMap` / `resolveTerm`
- `objectMeta.js` — 카탈로그 mock 메타 (v7 12개 + 신규 6개 = **19개 오브젝트**)
  - 추가됨: DEPARTMENTS, EMP, DEPT, ACCOUNTS, TRANSACTIONS, STORES (모두 AS-IS/TO-BE 인덱스 포함)
- `syntheticMeta.js` — **카탈로그 미등록 오브젝트 자동 합성기** (신규 작성)
- `*.d.ts` — TypeScript 선언

**컴포넌트 (`src/components/object-info/`)**:
- `ObjectInfoContext.tsx` — Provider, F5 글로벌 단축키, collapse 상태
- `ObjectInfoPanel.tsx` — **우측 고정 패널** (640px 폭, collapsible 36px)
  - SQL 정보 우측 도킹, 본문 자동 padding-right 시프트
  - SlidePanel 등 기존 우측 fixed 패널과 충돌 없도록 `right` 속성 조작
- `SqlBlock.tsx` — 명시적 SQL 블록 wrapper (data-sql-source 자동 등록)

**전역 CSS (`src/index.css`)**:
- `body.object-info-open` / `body.object-info-collapsed` 클래스로 padding-right 토글
- `.fixed.inset-y-0.right-0` 도 같이 시프트 (Tailwind translate 애니메이션과 호환)

**핵심 동작**:
- 어떤 화면이든 SQL 식별자 드래그 + **F5** → Object Info 우측 패널 등장
- 카탈로그에 있으면 실제 메타, 없으면 SQL 본문에서 자동 합성 (AUTO 스키마)
- AS-IS/TO-BE 인덱스 뱃지, NEW 표시
- 컬럼 드래그/클릭 → Columns·Indexes 양쪽 하이라이트
- ▶ 버튼 접기 / ✕ 또는 Esc 닫기

### D. `findPredicatesForObject` 알고리즘 개선
순차 fallback → **합집합(union)** 기반으로 재작성:
1. 내 alias가 prefix로 등장 (`o.order_date`)
2. alias prefix 없는 bare column 매칭 (`status = 'OPEN'` → 내 컬럼 매칭)
3. cross-table false positive 차단 (다른 alias prefix만 있으면 제외)
4. 최종 fallback: 단일 테이블 SQL은 모든 predicate 귀속

→ ON 절이 AND로 여러 조각으로 쪼개진 경우 일부만 인식되던 버그 해결.

---

## 2. 변경 파일 일람 (수정/신규)

### 수정된 기존 파일
- `src/App.tsx` — ObjectInfoProvider/Panel 장착, `/db/cases` 라우트, CasesDbPage import
- `src/index.css` — Object Info 패널용 CSS 변수 + body 클래스
- `vite.config.ts` — host 0.0.0.0, port 3005

### 신규 디렉터리/파일
```
.env.local
backend/
├── .env (선택)
├── alembic.ini
├── alembic/env.py
├── alembic/versions/0026654debb2_init_tuning_cases.py
├── alembic/versions/fa5cc8952b39_add_plans_bind_vars_and_case_details.py
├── app/__init__.py
├── app/api/__init__.py
├── app/api/health.py
├── app/api/tuning_cases.py
├── app/core/__init__.py
├── app/core/config.py
├── app/db/__init__.py
├── app/db/session.py
├── app/main.py
├── app/models/__init__.py
├── app/models/plan.py
├── app/models/tuning_case.py
├── app/schemas/__init__.py
├── app/schemas/tuning_case.py
├── requirements.txt
└── scripts/seed.py, seed_candidates.py
src/components/object-info/
├── ObjectInfoContext.tsx
├── ObjectInfoPanel.tsx
└── SqlBlock.tsx
src/lib/api.ts
src/lib/object-info/
├── aliasResolver.js + .d.ts
├── index.d.ts
├── objectMeta.js + .d.ts
├── sqlHighlight.js + .d.ts
└── syntheticMeta.js + .d.ts
src/pages/db/CasesDbPage.tsx
docs/CHANGES.patch     ← 재적용용 git patch
docs/fix.md            ← 본 문서
```

---

## 3. 새 메인 버전 위에 다시 적용하는 방법

### 권장: git 기반 (재적용성 최상)

#### 옵션 1 — `git apply` (가장 간단)
```bash
# 새 main 브랜치 위에서
cd new-main-checkout
git apply --reject /path/to/CHANGES.patch
# 충돌 시 .rej 파일이 생기므로 수동 해결
```

#### 옵션 2 — 별도 브랜치로 보존하고 cherry-pick (가장 안전)
```bash
# 지금 작업 내용을 커밋해서 브랜치로 보관
cd /home/exemone/exem_tuning_ai_v2
git checkout -b feature/db-stack-and-object-info
git add -A
git commit -m "feat: PG/FastAPI backend + Object Info panel + 19 obj catalog"
git push origin feature/db-stack-and-object-info

# 새 main 위에서
git checkout main
git pull
git merge feature/db-stack-and-object-info
# 충돌이 나면 해당 파일만 수동 머지
```

#### 옵션 3 — `git format-patch` (이메일 패치 스타일)
```bash
git format-patch e8604f4..HEAD -o patches/
# 새 환경에서
git am patches/*.patch
```

### 비권장: fix.md 만 보고 수동 재현
- 가능은 하지만 백엔드 코드 수백 줄을 손으로 다시 치는 건 비효율적
- fix.md는 **무엇을 왜 바꿨는지** 이해하기 위한 문서로만 활용

### 가장 추천하는 워크플로우 (3인 비개발자 팀 + Claude 기준)

1. **지금 단계**: 위 옵션 2처럼 **feature 브랜치로 커밋**해서 GitHub에 push
   - 메인이 업데이트돼도 내 변경이 안전하게 보관됨
   - PR 형태로 공유 가능 → 다른 팀원도 리뷰
2. **새 메인이 나오면**: `git merge main` 해서 충돌 부분만 해결
   - Claude에게 "이 .rej 파일들 머지 도와줘" 지시 가능
   - 변경 파일 대부분이 신규 디렉터리(`backend/`, `src/components/object-info/` 등)라 충돌 거의 없음
3. **충돌이 큰 영역**: `src/App.tsx`, `src/index.css`, `vite.config.ts` — 이 3개만 신경 쓰면 됨

### 충돌 가능성 평가
| 파일 | 충돌 위험 | 비고 |
|---|---|---|
| `backend/**` | 거의 없음 | 신규 디렉터리, 메인이 추가할 가능성 낮음 |
| `src/components/object-info/**` | 거의 없음 | 신규 디렉터리 |
| `src/lib/object-info/**` | 거의 없음 | 신규 디렉터리 |
| `src/lib/api.ts` | 낮음 | 신규 파일 |
| `src/pages/db/CasesDbPage.tsx` | 거의 없음 | 신규 파일 |
| `src/App.tsx` | **중간** | 라우트/Provider 수정 — 메인이 라우트 추가 시 충돌 가능 |
| `src/index.css` | **중간** | append 한 CSS — 전역 스타일 변경시 충돌 가능 |
| `vite.config.ts` | 낮음 | 포트만 변경 |
| `.env.local` | 없음 | gitignore 대상 (커밋 안 함) |

---

## 4. 즉시 실행 권장사항

지금 바로 다음 두 가지를 하시는 걸 강력히 권장드립니다:

### (1) 변경사항을 브랜치로 커밋
```bash
cd /home/exemone/exem_tuning_ai_v2
git checkout -b feature/db-stack-and-object-info
git add -A
git commit -m "$(cat <<'EOF'
feat: PG/FastAPI backend + Object Info panel + 19 obj catalog

- 백엔드 신설: FastAPI + SQLAlchemy 2.0 + Alembic + pgvector
- /db/cases: 백엔드 API 연동 첫 화면 (cases/plans/binds)
- Object Info 우측 고정 패널 + collapse + F5 단축키
- 19개 오브젝트 카탈로그 + 미등록 오브젝트 자동 합성
- findPredicatesForObject 합집합 알고리즘 (ON 절 누락 fix)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
git push origin feature/db-stack-and-object-info
```

### (2) PR 만들기
```bash
gh pr create --title "feat: PG/FastAPI backend + Object Info panel" \
  --body "see docs/fix.md"
```

이렇게 하면 메인이 업데이트되어도 변경사항이 GitHub에 안전하게 보관되고, 나중에 머지/cherry-pick이 깔끔합니다.

---

## 5. 패치 파일 사용 예시 (옵션 1 자세히)

```bash
# 어디서든 새 main 체크아웃
git clone https://github.com/ryuat/exem_tuning_ai.git
cd exem_tuning_ai
git checkout main
git pull

# 패치 적용
git apply --check docs/CHANGES.patch    # dry run
git apply docs/CHANGES.patch              # 실제 적용

# 또는 conflict 표시 모드
git apply --3way docs/CHANGES.patch       # 3-way merge 시도
# 또는
git apply --reject docs/CHANGES.patch     # 충돌 부분만 .rej 파일로
```

만약 충돌이 나면:
- `.rej` 파일에 적용 실패한 hunk가 남음
- Claude에게 "이 .rej 파일을 보고 새 main 코드에 맞춰 적용해줘" 라고 지시하면 됨

---

## 2026-04-23 — 재튜닝 요청 parent_request_id 누락 버그 수정

### 증상
- `tuning_requests` 20건 전체가 `parent_request_id = NULL`
- alias 에 `_재튜닝(N)` 표기는 있지만 원본과의 계보 체인이 끊어짐

### 원인
`src/pages/work/WorkPipeline.tsx` 의 재튜닝 요청 2곳에서 `requestTuning()` 호출 시 `parent_request_id` 를 전달하지 않음. 백엔드는 필드를 정상 수신/저장하도록 이미 구현되어 있었음 (`backend/app/api/tuning_requests.py:64, 392, 397`).

### 수정
- 파일: `src/pages/work/WorkPipeline.tsx`
  - 단일 재튜닝 (`handleRetune`) → line 871: `parent_request_id: numericId` 추가
  - 일괄 재튜닝 → line 1002: `parent_request_id: numericId` 추가
- 백업: `src/pages/work/WorkPipeline.tsx.bak_20260423_parent_req_fix`

### 검증
- API 직접 호출로 `parent_request_id` 전달 시 DB 저장 확인 (테스트 request_id=116, 원본=101)
- `parent_request_id` 미전달 시 NULL 저장 확인 (테스트 request_id=117)

### 참고
- 규칙 문서: `docs/tuning-request-flow.md` §7 (재튜닝 계보)
- `WorkDetail.tsx` 재튜닝 모달은 현재 mock (status='pending' 전이만 수행) — 실연동 시 동일 규칙 적용 필요

---

## 2026-04-23 (추가) — SQL ID 컬럼의 "同plan" 경고 배지 제거

### 변경
`src/pages/work/WorkPipeline.tsx` 의 SQL ID 컬럼(line 1149)에서 AS-IS/TO-BE plan hash 일치 시 표시되던 `同plan` 배지 및 `samePlan` 계산 로직 제거.

### 이유
- 사용자 혼동 유발 ("Plan" 아이콘으로 오인)
- UI 정보량 과다

### 참고
- 백업: `src/pages/work/WorkPipeline.tsx.bak_20260423_remove_sameplan_badge`
- 필요 시 복원은 백업 파일에서 해당 블록을 복사
- plan hash 비교가 필요하면 상세 패널(WorkDetail) 내에서 별도 표시 권장
