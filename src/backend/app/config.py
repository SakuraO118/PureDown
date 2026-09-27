from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    host: str = "0.0.0.0"
    port: int = 3001
    data_dir: Path = Path("data")
    download_dir: Path = Path.home() / "Downloads" / "PureDown"
    database_url: str | None = None
    cookies_file: Path | None = None
    proxy_url: str = ""
    ytdlp_impersonate: str = "chrome-136"
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    llm_base_url: str = "https://api.openai.com/v1"
    llm_api_key: str = ""
    llm_model: str = ""
    llm_max_input_tokens: int = 24_000
    whisper_mode: str = "disabled"
    whisper_model: str = "base"
    whisper_language: str | None = None
    analysis_max_concurrency: int = Field(default=2, ge=1, le=8)
    playlist_max_items: int = Field(default=20, ge=1, le=200)
    frames_per_video: int = Field(default=6, ge=0, le=20)

    @property
    def resolved_database_url(self) -> str:
        return self.database_url or f"sqlite:///{self.data_dir / 'puredown.db'}"

    @property
    def origins(self) -> list[str]:
        return [value.strip() for value in self.allowed_origins.split(",") if value.strip()]

    @property
    def llm_configured(self) -> bool:
        return bool(self.llm_api_key and self.llm_model)


@lru_cache
def get_settings() -> Settings:
    return Settings()
