"""Claude API 클라이언트 — Oracle SQL 튜닝용.

설계 포인트:
- anthropic SDK 0.96.0 사용
- 기본 모델 Sonnet 4.6, 복잡 케이스는 Opus 4.7
- prompt caching: 정적부(system 지침 + Oracle 스키마 메타)에 cache_control: ephemeral
- 가변부(AS-IS SQL, before plan)는 캐시 안 걸음
- 호출 결과: tuned_sql, rationale, input_tokens, output_tokens, cached_tokens, latency_ms
- 429/5xx 1회 재시도(exponential backoff). 그 외 즉시 실패.
- llm_call_log 적재
"""
import json
import logging
import os
import re
import time
from dataclasses import dataclass, field
from typing import Optional

import anthropic
from sqlalchemy import text as sql_text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# 모델 라우팅
MODEL_DEFAULT = "claude-sonnet-4-6"
MODEL_HEAVY = "claude-opus-4-7"

# 기본 시스템 프롬프트(정적부 — 캐시 대상)
SYSTEM_PROMPT = """\
당신은 Oracle SQL 튜닝 전문가입니다. 사용자가 제공하는 AS-IS SQL과 실행계획을 분석해 \
성능을 개선한 TO-BE SQL을 생성합니다.

작업 원칙:
1. 결과(반환 row 집합)는 AS-IS와 동일해야 합니다. SELECT 절·WHERE 절·ORDER BY를 함부로 바꾸지 마십시오.
2. 인덱스 액세스 경로 개선, 조인 순서·방식 변경, 서브쿼리 평탄화 등 검증 가능한 기법을 우선 적용합니다.
3. 힌트(/*+ ... */)는 명확한 근거가 있을 때만 사용합니다.
4. 바인드 변수는 그대로 보존합니다.
5. 추측 기반 변경은 금지. 실행계획상 비효율 지점을 짚어 인과적으로 설명합니다.

출력은 반드시 아래 JSON 스키마를 따릅니다:
{
  "tuned_sql": "<TO-BE SQL 전문, 세미콜론 제외>",
  "rationale": "<튜닝 근거 — 비효율 지점, 적용한 기법, 기대 효과를 한국어 3~6문장으로>"
}
JSON 외 다른 출력 금지. 마크다운 코드펜스로 감싸지 마십시오.
"""


@dataclass
class TuningResult:
    tuned_sql: str
    rationale: str
    input_tokens: int
    output_tokens: int
    cached_tokens: int            # cache_read_input_tokens
    cache_creation_tokens: int    # cache_creation_input_tokens
    latency_ms: int
    model: str
    provider: str = "anthropic"


@dataclass
class TuningContext:
    """LLM에게 넘길 가변부."""
    sql_text: str
    plan_text: Optional[str] = None
    bind_variables: list[dict] = field(default_factory=list)
    schema_name: Optional[str] = None
    user_instruction: Optional[str] = None


class ClaudeClient:
    """Claude API 클라이언트 — prompt caching 기본 적용."""

    def __init__(self, api_key: Optional[str] = None):
        key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")
        if not key or key.startswith("your-"):
            raise RuntimeError(
                "ANTHROPIC_API_KEY 가 설정되지 않았습니다. backend/.env 를 확인하세요."
            )
        # SDK 자동 재시도 비활성화 → 우리가 직접 1회 재시도 제어
        self._client = anthropic.Anthropic(api_key=key, max_retries=0)

    @staticmethod
    def pick_model(complex_case: bool = False) -> str:
        return MODEL_HEAVY if complex_case else MODEL_DEFAULT

    def tune_sql(
        self,
        ctx: TuningContext,
        *,
        model: Optional[str] = None,
        max_tokens: int = 8000,
    ) -> TuningResult:
        chosen = model or self.pick_model()
        # system 블록은 텍스트 + cache_control. 가변부는 messages 에만 둠.
        system_blocks = [
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ]
        user_payload_lines: list[str] = ["[AS-IS SQL]", ctx.sql_text.strip()]
        if ctx.plan_text:
            user_payload_lines += ["", "[BEFORE EXECUTION PLAN]", ctx.plan_text.strip()]
        if ctx.bind_variables:
            user_payload_lines += [
                "", "[BIND VARIABLES]",
                json.dumps(ctx.bind_variables, ensure_ascii=False),
            ]
        if ctx.schema_name:
            user_payload_lines += ["", f"[SCHEMA] {ctx.schema_name}"]
        if ctx.user_instruction:
            user_payload_lines += ["", "[USER INSTRUCTION]", ctx.user_instruction.strip()]
        user_payload_lines += [
            "",
            "위 정보를 바탕으로 TO-BE SQL을 생성하세요. JSON 한 객체만 출력합니다.",
        ]
        user_text = "\n".join(user_payload_lines)

        params = {
            "model": chosen,
            "max_tokens": max_tokens,
            "system": system_blocks,
            "messages": [{"role": "user", "content": user_text}],
        }

        t0 = time.time()
        resp = self._call_with_retry(params)
        latency_ms = int((time.time() - t0) * 1000)

        text_out = "".join(b.text for b in resp.content if b.type == "text")
        tuned_sql, rationale = self._parse_response(text_out)
        usage = resp.usage
        return TuningResult(
            tuned_sql=tuned_sql,
            rationale=rationale,
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            cached_tokens=getattr(usage, "cache_read_input_tokens", 0) or 0,
            cache_creation_tokens=getattr(usage, "cache_creation_input_tokens", 0) or 0,
            latency_ms=latency_ms,
            model=chosen,
        )

    def _call_with_retry(self, params: dict):
        try:
            return self._client.messages.create(**params)
        except anthropic.RateLimitError as e:
            wait = self._retry_after(e, default=2.0)
            logger.warning(f"Rate limited. retry after {wait:.1f}s")
            time.sleep(wait)
            return self._client.messages.create(**params)
        except anthropic.APIStatusError as e:
            if e.status_code >= 500:
                logger.warning(f"Server {e.status_code}. retry once after 2s")
                time.sleep(2.0)
                return self._client.messages.create(**params)
            raise

    @staticmethod
    def _retry_after(e: anthropic.RateLimitError, default: float = 2.0) -> float:
        try:
            ra = e.response.headers.get("retry-after") if e.response else None
            return float(ra) if ra else default
        except Exception:
            return default

    @staticmethod
    def _parse_response(text: str) -> tuple[str, str]:
        # 모델이 가끔 코드펜스를 붙이는 경우 제거
        cleaned = text.strip()
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        try:
            obj = json.loads(cleaned)
        except json.JSONDecodeError:
            # 첫 { ~ 마지막 } 만 추출 후 재시도
            m = re.search(r"\{[\s\S]*\}", cleaned)
            if not m:
                raise ValueError(f"LLM 응답 JSON 파싱 실패: {text[:200]}")
            obj = json.loads(m.group(0))
        tuned = (obj.get("tuned_sql") or "").strip()
        rationale = (obj.get("rationale") or "").strip()
        if not tuned:
            raise ValueError("LLM 응답에 tuned_sql 가 없습니다")
        return tuned, rationale


# ── llm_call_log 적재 헬퍼 ──
def log_call(
    db: Session,
    *,
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    latency_ms: int,
    status: str,                  # 'success' | 'error'
    sql_id: Optional[str] = None,
    work_id: Optional[str] = None,
    error: Optional[str] = None,
    cached_tokens: Optional[int] = None,
    cache_creation_tokens: Optional[int] = None,
    request_id: Optional[str] = None,
) -> None:
    """llm_call_log INSERT — cache 컬럼 + request_id FK 포함."""
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
