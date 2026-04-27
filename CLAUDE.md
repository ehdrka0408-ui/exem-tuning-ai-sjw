# exem_tuning_ai_v2 — 워크벤치 시안 (workbench-c 브랜치)

## ⚠️ 병렬 시안 개발 (2026-04-11~)

이 프로젝트는 `exem_tuning_ai`의 **병렬 시안**입니다.

| 버전 | 경로 | 브랜치 | 포트 | 방향 |
|------|------|--------|------|------|
| **v1 (현행)** | `/home/swt8397/exem_tuning_ai/` | `design-experiment` | 3003 | 현재 슬라이드패널 기반 |
| **v2 (이 프로젝트)** | `/home/swt8397/exem_tuning_ai_v2/` | `workbench-c` | 3006 | 3-Tier 워크벤치 (시안 C) |

- 설계 문서: `docs/direct-input-requirements.md` (시안 A/B/C 정리)
- 메모리: v1과 심볼릭 링크로 공유
- PM 현황: `/home/swt8397/gpt-tuning-ai/docs/PM_STATUS.md`
- 목표: 시안 C 구현 — T1(Peek 슬라이드) + T2(인페이지 워크벤치) + T3(새탭)

## 응답 규칙

- 작업 수행 시 코드 스니펫을 응답 텍스트에 출력하지 말 것. 툴로 직접 작업만 수행하고 결과만 간략히 보고.

## 제품 정의

AI SQL 튜닝 검증 콘솔. 야간 자동 튜닝 결과를 튜너가 효율적으로 리뷰·검증하는 도구.
- 핵심 문제: 튜너가 직접 하면 하루 1건도 힘듦 (시간 부족 + 전문성 편차)
- AI 신뢰도 50~70% → 사람(튜너)의 검증 판단이 반드시 필요
- 당장: 건건이 SQL/Plan/근거 샅샅이 상세 리뷰
- 미래: AI 신뢰도 상승 시 일괄 검증 흐름

## 디자인 시스템

### 방향성 (2026-04-09 개정)
**Cool Analytical** — 차가운 이성적 분석 도구
- DBA/튜너의 전문 도구. 감성보다 신뢰·이성·집중을 우선.
- Slate(쿨 그레이) + Sky/Blue 도미넌트. Warm은 의도적 격리(warning/danger/brand 로고만).
- 근거: Mehta & Zhu 2009 — 쿨 컬러는 신뢰·창의를 강화. 분석적 의사결정에 적합.

### 성격 (Personality)
**Precise · Assured · Swift**
- 정밀한 정보 전달, AI 결과에 대한 확신 근거 제공, 군더더기 없는 빠른 워크플로우
- 조잡하면 안 됨 — 절제된 정보 밀도, 의도 있는 여백

### 브랜드
- 엑셈(EXEM) — "Data Artist Group"
- 브랜드 레드: `#FF470E` — **로고 전용**. UI ambient(버튼/액센트/링)에 사용 금지.
- 톤: 미니멀, 전문적, B2B 엔터프라이즈

### 시각 계층 (우선순위)
공백 > 굵기 > 크기 > 색상 순으로 계층 표현
- **지배적**: SQL 텍스트 / 실행계획 (가장 넓은 면적)
- **행동 유도**: 검증완료/튜닝불가 버튼 (대비 최대)
- **조용한 정보**: 날짜, 출처, 인스턴스명 (작은 크기, 연한 색)

### 타이포그래피
- **UI/본문**: Pretendard (이미 적용)
- **코드/SQL**: JetBrains Mono
- **Type scale**: Perfect Fourth (1.333 비율)
  - xs: 0.75rem(12px), sm: 0.875rem(14px), base: 1rem(16px)
  - md: 1.333rem(21px), lg: 1.777rem(28px), xl: 2.369rem(38px)
- **행간**: 본문 1.5, 테이블 1.3, 코드 1.6, 제목 1.2
- **규칙**: 최대 2폰트, 인공 굵기 금지

### 색상 토큰 — Slate & Sky (Cool Analytical)

#### 뉴트럴 (Slate — 확실한 cool 언더톤)
순흑/순백·warm gray를 폐기. Slate-기반 cool neutral만 사용.

| 토큰 | Hex | 용도 |
|------|-----|------|
| `--color-surface` | `#F8FAFC` | 페이지 배경 (slate-50) |
| `--color-surface-alt` | `#F1F5F9` | 카드/섹션 배경 (slate-100) |
| `--color-surface-muted` | `#E2E8F0` | 호버, 필터바 (slate-200) |
| `--color-border` | `#CBD5E1` | 구분선 (slate-300) |
| `--color-text-muted` | `#94A3B8` | 보조 텍스트 (slate-400) |
| `--color-text-secondary` | `#64748B` | 레이블 (slate-500) |
| `--color-text-primary` | `#0F172A` | 본문 (slate-900 — cool 잉크) |

#### 액션 (cool slate dark — pure black 폐기)
| 토큰 | Hex | 용도 |
|------|-----|------|
| `--color-action` | `#0F172A` | 기본 CTA (slate-900) |
| `--color-action-hover` | `#1E293B` | CTA 호버 (slate-800) |

#### 브랜드 (격리)
| 토큰 | Hex | 용도 |
|------|-----|------|
| `--color-brand` | `#FF470E` | EXEM Red — **로고 전용**. UI ambient 사용 금지 |
| `--color-brand-hover` | `#E63E0B` | 로고 호버만 |

#### 시맨틱 (모두 cool-leaning, 모든 진행 상태는 positive 톤)
| 토큰 | Hex | 용도 |
|------|-----|------|
| `--color-success` / `--color-success-bg` | `#059669` / `#ECFDF5` | **튜닝완료 + 반영완료** (emerald-600 — AI 성공·최종 성공 공통) |
| `--color-warning` / `--color-warning-bg` | `#D97706` / `#FFFBEB` | 자동 중단·큐 일시정지 등 주의 (사용 최소화) |
| `--color-danger` / `--color-danger-bg` | `#DC2626` / `#FEF2F2` | 반려·실패 (red-600) |
| `--color-info` / `--color-info-bg` | `#0284C7` / `#F0F9FF` | 반영대기 (sky-600 — 사람 확인 후 배포 큐) |
| `--color-applied` / `--color-applied-bg` | `#059669` / `#ECFDF5` | success alias (반영완료) |

**튜닝완료/반영완료 두 green 구분 규칙**: 같은 emerald 계열이지만 다음 세 신호로 구분한다.
1. **Owner 아이콘**: 튜닝완료 = `BotMessageSquare`(AI), 반영완료 = `CheckCircle2`(done)
2. **라벨**: "튜닝완료" vs "반영완료"
3. **정렬**: 튜닝완료가 항상 상단(사람 확인 시급)
색상으로 인텐시티를 차별화하지 말 것. 둘 다 positive milestone이라는 시각적 그룹화가 더 중요하다.

#### 코드/AI 강조 (Deep Blue Hero)
SQL 키워드, 활성 탭, AI 기능, 링크 — cool palette의 hero hue.

| 토큰 | Hex | 용도 |
|------|-----|------|
| `--color-code` | `#2563EB` | blue-600 — 핵심 강조 (AI 버튼, 활성 nav, SQL 키워드) |
| `--color-code-dark` | `#1D4ED8` | blue-700 — code hover |
| `--color-code-bg` | `#EFF6FF` | blue-50 — 코드/AI 카드 배경 |

#### 색상 사용 원칙 (Cool Analytical)
1. **Slate dominant**: 모든 뉴트럴은 slate(쿨 그레이). zinc/stone/neutral 폐기.
2. **Blue as hero**: AI/코드/액션의 강조는 blue-600(`--color-code`). 브랜드 빨강 대체.
3. **Warm 격리**: amber(warning), red(danger), brand red(로고)만 warm. 그 외 모두 cool.
4. **Action = slate-900**: 순수 블랙 폐기. cool 잉크로 통일.
5. **Ring/액센트**: dirty 상태 등은 `ring-info/40` 사용. brand ring 금지.

#### 파이프라인 상태 → 색상
<!-- 2026-04-09 개정: Owner 축 도입, 승인→확인, 적용→반영, scheduled/failed/no_improve/cancelled 상태 추가 -->
내부 enum 키는 변경하지 않음 — 라벨(사용자 노출)만 갱신.

| 상태 (enum) | 라벨 | 색상 | 의미 |
|------|------|------|------|
| `scheduled` | 예약중 | `--text-muted` (회색) | 시각 대기 — 예약·반복 탭에서만 표시, 기본 작업함 제외 |
| `pending` / `tuning` | 튜닝대기 / 튜닝중 | `--text-muted` (회색) | 대기/진행중, 조용히 |
| `approval_pending` | **튜닝완료** | `--success` (초록) | **AI 성공 마일스톤** — AI가 결과 도출 완료. 사람 검토·확인 대기. |
| `apply_pending` | **반영대기** | `--info` (sky blue) | 사람 확인 완료, 운영 반영 큐 진입 |
| `applied` | **반영완료** | `--success` (초록) | 운영 반영 종결 (튜닝완료와 동일 green — 아이콘·라벨로 구분) |
| `rejected` | 반려 | `--danger` (빨강) | 사람이 반려, 종결 |
| `failed` | 실패 | `--danger` (빨강) | AI 튜닝/반영 중 오류, 종결 |
| `cancelled` | 취소 | `--danger` tone (약화) | 사용자·정책 취소, 종결 |
| `no_improve` | 개선없음 | `--text-muted` (회색) | AI 분석 정상 완료·개선 여지 없음, 종결 |

**색상 의미 매핑 (2026-04-09 개정)**: 진행 단계는 **회색(작업중) → 초록(AI 성공) → 파랑(배포 큐) → 초록(반영 종결)**. 모든 진행 상태가 positive 톤. amber는 더 이상 "사람 검토 시급" 신호로 쓰지 않는다 — 그건 정렬·필터·sticky 위치가 담당. amber는 자동중단·큐 일시정지 등 진짜 주의 상황에만 사용.

#### Owner 축 (상태 축과 직교 — 2026-04-09 신설·재정의)
상태 축이 "어디까지 왔는가"라면, Owner 축은 **"이 상태의 주어가 누구인가"**(주체)를 표시. AI가 할/하는/한 일과 사람이 할 일을 아이콘으로 분리한다.

트리아지 신호(시선 끌기)는 정렬(상단 sticky)·필터 프리셋이 담당하므로, Owner 아이콘은 "공의 위치"가 아닌 **상태의 주체**를 전달한다. 아이콘 모양 = 주체, 아이콘 색상 = 진행 단계 — 두 정보 동시 표현.

| Owner | 아이콘 | 해당 상태 | 의미 |
|-------|--------|----------|------|
| scheduled | ⏰ CalendarClock | `scheduled` | 시각 대기 — 주어는 시각(예정) |
| ai | BotMessageSquare | `pending`, `tuning`, `approval_pending` | AI가 주도 — 할/하고있는/한 일 (`BotMessageSquare 튜닝완료` = AI가 완료한 결과) |
| human | 👤 User | `apply_pending` | 사람이 주도 — 할 일 (반영 버튼 클릭) |
| done | ✅ CheckCircle2 | `applied` | 종결 (성공) |
| error | ⚠️ AlertCircle | `rejected`, `failed`, `cancelled` | 종결 (비정상) — 아이콘 공유, 라벨로 구분 |
| none | − Minus | `no_improve` | 종결 (개선 여지 없음) — 조용한 완료 |

**규칙**: failed / rejected / cancelled 는 동일한 ⚠️ 아이콘을 공유한다. 색상·라벨로만 구분하고, 아이콘으로 차별화하지 말 것. (아이콘 종류가 많아지면 시각 노이즈가 커진다.)

**규칙 (2026-04-09 재정의)**: `approval_pending`은 Owner 축상 `ai`(BotMessageSquare)에 귀속된다. 라벨 `튜닝완료`는 AI의 완료 결과를 표현하므로 아이콘도 AI 측에 붙는다. "사람의 판단이 필요함"은 **정렬(최상단)·필터 프리셋**으로 전달한다. 색상(success green)은 "AI 성공" 신호이지 "주의" 신호가 아니다.

#### 용어 체계 (2026-04-03 확정 → 2026-04-09 개정)
<!-- 2026-04-09: 승인→확인, 적용→반영 일괄 치환. "적용" 용어 전면 제거. -->
- **검증** = 시스템이 수행 (실행결과/정합성 자동 확인)
- **검토** = 사람이 상세를 살펴보는 행위 (행 클릭 → 상세 진입)
- **확인** = 사람이 버튼 클릭하여 상태 전이 (approval_pending → apply_pending). UI 버튼 라벨.
- **반영** = 운영 DB에 실제 변경을 적용하는 행위. "적용"이라는 단어는 더 이상 사용하지 않음.
- **튜닝완료** 상태에서 3갈래: 확인 → 반영대기 / 반려 / 재튜닝 요청
- 버튼 라벨 매핑: 승인 → **확인**, 적용 → **반영**
- 상태 라벨 매핑: 승인대기 → **튜닝완료**, 적용대기 → **반영대기**, 적용완료 → **반영완료**, 튜닝요소 없음 → **개선없음**

#### 데이터 출처 (기존 유지)
| 출처 | 배경 | 텍스트 |
|------|------|--------|
| MaxGauge | `#F3E8FF` | `#7E22CE` |
| AWR | `#DBEAFE` | `#1D4ED8` |
| V$SQL | `#F5F5F4` | `#57534E` |

### 간격 체계 (Spacing Scale)
4px 기반, Tailwind 기본 스케일 사용:

| 토큰 | 값 | 용도 |
|------|-----|------|
| `1` | 4px | 아이콘-텍스트 간격, 인라인 요소 |
| `2` | 8px | 뱃지 내부, 밀집 요소 간격 |
| `3` | 12px | 컴팩트 카드 내부 패딩 |
| `4` | 16px | 기본 요소 간격 (gap-4) |
| `6` | 24px | 카드 패딩 (p-6), 섹션 간 간격 |
| `8` | 32px | 큰 섹션 구분 |

**규칙:**
- 카드 패딩: `p-6` 통일 (대형/소형 무관)
- 섹션 간 세로 간격: `space-y-6`
- 요소 간 간격: `gap-4`
- 대시보드 콘텐츠: `max-w-[1200px]` (테이블 페이지는 제약 없음)
- 페이지 타이틀: `text-lg` (28px), 카드 내 타이틀도 `text-lg` 이하

### 모션
- 모든 애니메이션: 정보 기능이 없으면 제거
- 버튼 호버/활성: 100ms ease-out
- 슬라이드 패널 열기: 200ms ease-out / 닫기: 150ms ease-in
- 플로팅바 등장: 150ms ease-out
- `prefers-reduced-motion`: 모든 duration → 0ms

### 상호작용 상태 (모든 인터랙티브 요소)
Default → Hover(한 단계 어둡게) → Focus(ring-2 info) → Active(두 단계+scale 0.98) → Disabled(opacity-50) → Loading(spinner) → Error(danger 테두리) → Success(체크 피드백)
- **Focus ring**: `ring-info/40` 또는 `ring-code/40` 사용. brand ring 금지.
- **Dirty CTA**: `bg-action ring-2 ring-info/40` (cool 액센트로 "변경됨" 표시)

### 접근성
- 텍스트/배경 대비 WCAG AA 4.5:1 이상
- 색상만으로 상태 구분 금지 — 항상 텍스트 레이블 + 아이콘 동반
- 포커스 순서: 필터 → 테이블 → 상세 패널 → 액션 버튼
- 터치 대상: 최소 44x44px (향후 모바일 대응)

## 기술 스택
- React + TypeScript
- Tailwind CSS v4
- Vite
- 라이트 모드 우선 (다크모드 추후)
