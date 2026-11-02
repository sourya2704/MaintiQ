from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ProviderMode = Literal["live", "mock", "disabled"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Mantiq"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://mantiq:mantiq@localhost:5432/mantiq"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])
    # Built frontend (Vite dist) to serve from the API in single-service deployments.
    static_dir: Path | None = None

    @field_validator("database_url")
    @classmethod
    def _psycopg_driver(cls, v: str) -> str:
        # Hosting platforms hand out postgres:// or postgresql:// URLs; SQLAlchemy needs the driver named.
        for prefix in ("postgres://", "postgresql://"):
            if v.startswith(prefix):
                return "postgresql+psycopg://" + v[len(prefix):]
        return v

    # Auth
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60 * 12
    auth_rate_limit_per_minute: int = 10

    # Audio storage and retention
    storage_dir: Path = Path("storage")
    max_audio_bytes: int = 10 * 1024 * 1024
    max_audio_seconds: float = 120.0  # longer notes are split into Prisma-sized chunks
    audio_retention_days: int = 30
    retention_interval_minutes: int = 60  # 0 disables the in-process retention sweep

    # Gnani Prisma (speech-to-text) - https://docs.gnani.ai
    prisma_mode: ProviderMode = "mock"
    gnani_api_key: str = ""
    gnani_base_url: str = "https://api.vachana.ai"
    prisma_model: str = "prisma-v3.0"
    prisma_language_code: str = "en-IN"
    prisma_timeout_seconds: float = 30.0
    prisma_max_clip_seconds: float = 30.0  # Prisma REST limit per request
    prisma_chunk_seconds: float = 28.0
    prisma_use_keyterms: bool = True  # Prisma v3.0 biasing with machine vocabulary

    # Gnani Evon (reasoning) - OpenAI-compatible chat completions route
    evon_mode: ProviderMode = "mock"
    evon_base_url: str = "http://localhost:30000/v1"
    evon_api_key: str = ""
    evon_model: str = "gnani/gnani-evon-v3.3-30b-a3b"
    evon_timeout_seconds: float = 90.0
    evon_max_attempts: int = 2
    evon_max_history_records: int = 3

    # Gnani Timbre (text-to-speech, optional)
    timbre_mode: ProviderMode = "disabled"
    timbre_model: str = "timbre-v2.5"
    timbre_voice: str = "Nalini"
    timbre_language: str = "en-IN"
    timbre_max_chars: int = 1000


@lru_cache
def get_settings() -> Settings:
    return Settings()
