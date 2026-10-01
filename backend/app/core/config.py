from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List

class Settings(BaseSettings):
    app_name: str = "CivicAid API"
    app_version: str = "2.0.0"
    app_env: str = "development"
    app_secret_key: str = "change-this-in-production"

    # AI API — Groq (free, no payment needed)
    # Get your free key at console.groq.com
    groq_api_key: str = ""
    # Primary Groq model. Change in .env when Groq retires a model.
    # See https://console.groq.com/docs/models
    groq_model: str = "openai/gpt-oss-120b"

    # Cache
    redis_url: str = "redis://localhost:6379"

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
    rate_limit_status: str = "30/minute"

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

    class Config:
        env_file = ".env"
        extra = "ignore"

@lru_cache
def get_settings() -> Settings:
    return Settings()
