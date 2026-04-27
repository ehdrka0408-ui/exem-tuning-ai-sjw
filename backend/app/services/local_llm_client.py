"""Local LLM 클라이언트 (vLLM OpenAI-compatible) — Oracle SQL 튜닝용.

설계:
- vLLM `/v1/chat/completions` 사용. 키 불필요 (빈 키)
- 기본 모델 `axis-v1` (LoRA SQL 튜닝 fine-tuned), fallback `qwen-coder-32b`
- 인터페이스: 기존 `ClaudeClient.tune_sql(ctx) -> TuningResult` 동일 시그니처 유지
- prompt caching은 vLLM 측 prefix cache가 처리(앱 응답엔 metric 없음 → cached_tokens=None)
- 5xx/timeout 1회 재시도, 그 외 즉시 raise
- llm_call_log 적재 헬퍼 동일 (claude_client.log_call 재사용 가능 — 본 모듈은 self-contained 로 다시 정의)
"""
import json
import logging
import os
import re
import time
from dataclasses import dataclass, field
from typing import Optional

import httpx
from sqlalchemy import text as sql_text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# settings (pydantic-settings) 에서 .env 자동 로드. os.environ 우선 (export 가능성).
def _resolve_env():
    try:
        from app.core.config import settings
        base = os.environ.get("LOCAL_LLM_BASE") or settings.local_llm_base
        model = os.environ.get("LOCAL_LLM_MODEL") or settings.local_llm_model
        fb = os.environ.get("LOCAL_LLM_FALLBACK_MODEL") or settings.local_llm_fallback_model
    except Exception:
        base = os.environ.get("LOCAL_LLM_BASE", "http://10.10.48.89:8606/v1")
        model = os.environ.get("LOCAL_LLM_MODEL", "axis-v1")
        fb = os.environ.get("LOCAL_LLM_FALLBACK_MODEL")
    return base, model, fb

LOCAL_LLM_BASE, LOCAL_LLM_MODEL, LOCAL_LLM_FALLBACK_MODEL = _resolve_env()
PROVIDER_NAME = "vllm"

SYSTEM_PROMPT = """\
당신은 Oracle SQL 튜닝 전문가입니다. AS-IS SQL과 실행계획, 스키마/바인드 정보를 받아 \
의미가 동일하고 성능이 개선된 TO-BE SQL을 생성합니다.

작업 원칙:
1. 결과(반환 row 집합)는 AS-IS와 동일해야 합니다. SELECT 절·WHERE 절·ORDER BY를 함부로 바꾸지 마십시오.
2. 인덱스 액세스 경로 개선, 조인 순서·방식 변경, 서브쿼리 평탄화 등 검증 가능한 기법을 우선 적용합니다.
3. 힌트(/*+ ... */)는 명확한 근거가 있을 때만 사용합니다.
4. 바인드 변수는 그대로 보존합니다.
5. 추측 기반 변경은 금지. 실행계획상 비효율 지점을 짚어 인과적으로 설명합니다.
6. 새 인덱스가 필요한 튜닝이라면 `index_ddls` 배열에 `CREATE INDEX ...` 구문을 포함합니다. \
   세미콜론은 제외하고, INVISIBLE 여부는 시스템이 자동으로 적용하니 명시하지 않습니다. \
   인덱스가 필요 없으면 빈 배열 `[]` 을 반환합니다.

출력은 반드시 아래 JSON 스키마를 따릅니다:
{
  "tuned_sql": "<TO-BE SQL 전문, 세미콜론 제외>",
  "rationale": "<튜닝 근거 — 비효율 지점, 적용한 기법, 기대 효과를 한국어 3~6문장으로>",
  "index_ddls": ["<CREATE INDEX ... >", ...]
}
JSON 외 다른 출력 금지. 마크다운 코드펜스로 감싸지 마십시오.
"""


@dataclass
class TuningResult:
    tuned_sql: str
    rationale: str
    input_tokens: int
    output_tokens: int
    cached_tokens: Optional[int]            # vLLM 미지원 → None
    cache_creation_tokens: Optional[int]    # 동일
    latency_ms: int
    model: str
    provider: str = PROVIDER_NAME
    index_ddls: list[str] = field(default_factory=list)


@dataclass
class TuningContext:
    sql_text: str
    plan_text: Optional[str] = None
    bind_variables: list[dict] = field(default_factory=list)
    schema_name: Optional[str] = None
    user_instruction: Optional[str] = None
    previous_attempts: list[dict] = field(default_factory=list)  # 재튜닝 시 이전 시도 메타


class LocalLLMClient:
    """vLLM OpenAI-compatible 클라이언트."""

    def __init__(self, base: Optional[str] = None,
                 default_model: Optional[str] = None, timeout: float = 120.0):
        self._base = (base or LOCAL_LLM_BASE).rstrip("/")
        self._default_model = default_model or LOCAL_LLM_MODEL
        self._timeout = timeout

    @staticmethod
    def pick_model(complex_case: bool = False) -> str:
        # complex_case 무관 — 단일 axis-v1 사용. 필요 시 fallback 모델로 전환
        return LOCAL_LLM_MODEL

    def tune_sql(
        self,
        ctx: TuningContext,
        *,
        model: Optional[str] = None,
        max_tokens: int = 4096,
    ) -> TuningResult:
        chosen = model or self._default_model
        user_text = self._build_user_message(ctx)
        params = {
            "model": chosen,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_text},
            ],
            "max_tokens": max_tokens,
            "temperature": 0.0,
            "response_format": {"type": "json_object"},
        }

        t0 = time.time()
        resp = self._post_with_retry(params, fallback_model=LOCAL_LLM_FALLBACK_MODEL)
        latency_ms = int((time.time() - t0) * 1000)
        actual_model = resp.get("model") or chosen

        text_out = self._extract_content(resp)
        tuned_sql, rationale, index_ddls = self._parse_response(text_out)
        usage = resp.get("usage") or {}
        return TuningResult(
            tuned_sql=tuned_sql,
            rationale=rationale,
            index_ddls=index_ddls,
            input_tokens=int(usage.get("prompt_tokens") or 0),
            output_tokens=int(usage.get("completion_tokens") or 0),
            cached_tokens=None,                 # vLLM 미제공
            cache_creation_tokens=None,
            latency_ms=latency_ms,
            model=actual_model,
        )

    def _build_user_message(self, ctx: TuningContext) -> str:
        lines: list[str] = []

        # 이전 시도 섹션 (재튜닝 요청 시만)
        if ctx.previous_attempts:
            n = len(ctx.previous_attempts)
            lines += [
                f"## 이전 튜닝 시도 정보 (재튜닝 요청)",
                f"",
                f"이 SQL 은 앞서 {n}회 튜닝 시도했으나 개선이 미흡했습니다.",
                f"아래 시도들과 **다른 접근**으로 튜닝안을 제시해 주세요.",
                f"",
            ]
            for i, prev in enumerate(ctx.previous_attempts, 1):
                label = "가장 최근" if i == 1 else "그 이전"
                tuned_sql = prev.get("tuned_sql") or None
                rationale = prev.get("rationale") or None
                before_ph = prev.get("before_plan_hash") or "N/A"
                after_ph = prev.get("after_plan_hash") or "N/A"
                elapsed = prev.get("after_elapsed_sec")
                buffers = prev.get("after_buffer_gets")

                lines += [f"### 이전 시도 #{i} ({label})"]
                lines += ["- 이전 TO-BE SQL:"]
                if tuned_sql:
                    # plan_text 5000자 초과 시 truncate (tuned_sql 에는 적용 안 함)
                    lines += [f"  ```sql", f"  {tuned_sql}", f"  ```"]
                else:
                    lines += ["  ```sql", "  (실패 - tuned_sql 없음)", "  ```"]
                rat_text = (rationale[:300] + "...") if rationale and len(rationale) > 300 else (rationale or "(없음)")
                after_plan_raw = prev.get("after_plan_text") or None
                if after_plan_raw:
                    _apt = after_plan_raw[:3000] + ("...(truncated)" if len(after_plan_raw) > 3000 else "")
                else:
                    _apt = "(plan_text 없음)"
                lines += [
                    f"- 이전 근거: {rat_text}",
                    f"- Before plan_hash: {before_ph} / After plan_hash: {after_ph}",
                    f"- After 성능: elapsed={elapsed}s, buffers={buffers}",
                    f"- 이전 After Plan (이 경로를 피해야 함):",
                    "  ```",
                    f"  {_apt}",
                    "  ```",
                    "",
                ]
            lines += [
                "---",
                "**중요**: 위에 제시된 이전 TO-BE SQL 과 동일하거나 공백만 다른 SQL 을 출력하면 안 됩니다.",
                "반드시 힌트(INDEX/NO_INDEX/PARALLEL/USE_HASH 등), CTE materialization, 조인 순서 변경,",
                "서브쿼리 구조 변경 등 구체적으로 다른 접근을 택하세요.",
                "",
            ]

        lines += ["[AS-IS SQL]", ctx.sql_text.strip()]
        if ctx.plan_text:
            lines += ["", "[BEFORE EXECUTION PLAN]", ctx.plan_text.strip()]
        if ctx.bind_variables:
            lines += ["", "[BIND VARIABLES]",
                      json.dumps(ctx.bind_variables, ensure_ascii=False)]
        if ctx.schema_name:
            lines += ["", f"[SCHEMA] {ctx.schema_name}"]
        if ctx.user_instruction:
            lines += ["", "[USER INSTRUCTION]", ctx.user_instruction.strip()]
        lines += ["",
                  "위 정보를 바탕으로 TO-BE SQL을 생성하세요. JSON 한 객체만 출력합니다."]
        return "\n".join(lines)

    def _post_with_retry(self, params: dict, *, fallback_model: Optional[str]) -> dict:
        url = f"{self._base}/chat/completions"
        last_err: Optional[Exception] = None
        for attempt in range(2):  # 최초 + 1회 재시도
            try:
                with httpx.Client(timeout=self._timeout) as client:
                    r = client.post(url, json=params)
                if r.status_code == 200:
                    return r.json()
                # 모델 미존재(404) 시 fallback model 1회 시도
                if r.status_code == 404 and fallback_model and params["model"] != fallback_model:
                    logger.warning(f"model {params['model']} 404 → fallback {fallback_model}")
                    params = {**params, "model": fallback_model}
                    continue
                if 500 <= r.status_code < 600:
                    last_err = RuntimeError(f"vLLM {r.status_code}: {r.text[:300]}")
                    if attempt == 0:
                        logger.warning(f"server {r.status_code}, retry once")
                        time.sleep(1.5)
                        continue
                # 그 외(4xx) 즉시 실패
                raise RuntimeError(f"vLLM HTTP {r.status_code}: {r.text[:300]}")
            except (httpx.TimeoutException, httpx.NetworkError) as e:
                last_err = e
                if attempt == 0:
                    logger.warning(f"network err {type(e).__name__}: retry once")
                    time.sleep(1.5)
                    continue
                raise
        if last_err:
            raise last_err
        raise RuntimeError("vLLM 호출 실패: 사유 없음")

    @staticmethod
    def _extract_content(resp: dict) -> str:
        try:
            return resp["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, TypeError):
            return ""

    @staticmethod
    def _parse_response(text: str) -> tuple[str, str, list[str]]:
        cleaned = text.strip()
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        try:
            obj = json.loads(cleaned)
        except json.JSONDecodeError:
            m = re.search(r"\{[\s\S]*\}", cleaned)
            if not m:
                raise ValueError(f"LLM 응답 JSON 파싱 실패: {text[:200]}")
            obj = json.loads(m.group(0))
        tuned = (obj.get("tuned_sql") or "").strip()
        rationale = (obj.get("rationale") or "").strip()
        raw_ddls = obj.get("index_ddls") or []
        ddls = [d.strip().rstrip(';').strip() for d in raw_ddls if isinstance(d, str) and d.strip()]
        if not tuned:
            raise ValueError("LLM 응답에 tuned_sql 가 없습니다")
        return tuned, rationale, ddls


# ── llm_call_log 적재 헬퍼 (claude_client.log_call 와 동일 시그니처) ──
def log_call(
    db: Session,
    *,
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    latency_ms: int,
    status: str,
    sql_id: Optional[str] = None,
    work_id: Optional[str] = None,
    error: Optional[str] = None,
    cached_tokens: Optional[int] = None,
    cache_creation_tokens: Optional[int] = None,
    request_id: Optional[str] = None,
) -> None:
    db.execute(
        sql_text(
            "INSERT INTO llm_call_log "
            "(provider, model, sql_id, work_id, input_tokens, output_tokens, latency_ms, "
            " status, error, cached_tokens, cache_creation_tokens, request_id) "
            "VALUES (:provider, :model, :sql_id, :work_id, :input_tokens, :output_tokens, "
            "        :latency_ms, :status, :error, :cached, :cache_creation, :req_id)"
        ),
        dict(
            provider=provider, model=model, sql_id=sql_id, work_id=work_id,
            input_tokens=input_tokens, output_tokens=output_tokens,
            latency_ms=latency_ms, status=status, error=error,
            cached=cached_tokens, cache_creation=cache_creation_tokens,
            req_id=request_id,
        ),
    )
    db.commit()
