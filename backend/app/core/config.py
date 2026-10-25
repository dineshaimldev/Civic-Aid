from pydantic import ConfigDict, model_validator
from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List

class Settings(BaseSettings):
    app_name: str = "CivicAid API"
    app_version: str = "2.0.0"
    app_env: str = "development"
    app_secret_key: str = "change-this-in-production"
    reminder_sweep_token: str = ""

    # AI API — Groq (free, no payment needed)
    # Get your free key at console.groq.com
    groq_api_key: str = ""
    # Primary Groq model. Change in .env when Groq retires a model.
    # See https://console.groq.com/docs/models
    groq_model: str = "openai/gpt-oss-120b"

    # Cache
    redis_url: str = "redis://localhost:6379"
    database_url: str = "sqlite:///./data/civicaid.db"

    # CORS
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    # RAG
    embedding_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    faiss_index_path: str = "app/data/knowledge_base/faiss_index"
    knowledge_base_path: str = "app/data/knowledge_base/tn_legal_kb.json"
    eval_set_path: str = "app/data/eval/benchmark_150q.json"
    rag_top_k: int = 5
    rag_confidence_threshold: float = 0.35
    bm25_weight: float = 0.3
    dense_weight: float = 0.7

    # Rate limits
    rate_limit_chat: str = "20/minute"
    rate_limit_upload: str = "5/minute"

    # OCR
    tesseract_path: str = "/usr/bin/tesseract"
    max_upload_mb: int = 10

    # WhatsApp (Twilio Sandbox — free for testing)
    # Get free sandbox credentials at twilio.com/console
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_whatsapp_number: str = "whatsapp:+14155238886"  # Twilio sandbox default
    rate_limit_whatsapp: str = "30/minute"

    @property
    def origins_list(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    model_config = ConfigDict(env_file=".env", extra="ignore")

    @model_validator(mode="after")
    def validate_production_settings(self):
        if not self.is_production:
            return self
        if self.app_secret_key == "change-this-in-production" or len(self.app_secret_key) < 32:
            raise ValueError("APP_SECRET_KEY must be a random value of at least 32 characters in production.")
        if not self.groq_api_key:
            raise ValueError("GROQ_API_KEY is required in production.")
        if not self.reminder_sweep_token or len(self.reminder_sweep_token) < 32:
            raise ValueError("REMINDER_SWEEP_TOKEN must be configured in production.")
        if self.redis_url.startswith(("redis://localhost", "redis://127.0.0.1", "rediss://localhost", "rediss://127.0.0.1")):
            raise ValueError("REDIS_URL must point to a managed Redis instance in production.")
        if not self.database_url or self.database_url.startswith("sqlite:///./"):
            raise ValueError("DATABASE_URL must point to managed durable storage in production.")
        if any(origin == "*" for origin in self.origins_list):
            raise ValueError("ALLOWED_ORIGINS must not contain '*' in production.")
        return self

@lru_cache
def get_settings() -> Settings:
    return Settings()
