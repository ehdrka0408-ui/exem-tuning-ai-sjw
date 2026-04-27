from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "exem_tuning_ai backend"
    database_url: str = "postgresql+psycopg://exemone:exemone@127.0.0.1:5432/exem_tuning_ai"
    secret_key: str = "CHANGE_ME_IN_PROD"
    cors_origins: list[str] = [
        "http://localhost:3005",
        "http://10.10.45.119:3005",
    ]
    # ── Local LLM (vLLM OpenAI-compatible) ──
    local_llm_base: str = "http://10.10.48.89:8606/v1"
    local_llm_model: str = "axis-v1"
    local_llm_fallback_model: Optional[str] = None


settings = Settings()
