from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    bot_token: str
    admin_tg_ids: str = ""

    openai_base_url: str = "https://api.openai.com/v1"
    openai_api_key: str
    openai_model: str = "gpt-4o-mini"

    whisper_model: str = "medium"
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"
    whisper_language: str = "ru"

    data_dir: Path = Field(default=Path("./data"))

    default_telemost_url: str = ""

    audio_input_device: str = "BlackHole 2ch"
    listener_hard_cap_minutes: int = 180
    listener_idle_minutes: int = 5
    listener_display_name: str = "📝 GP Notetaker"
    headless: bool = False

    log_level: str = "INFO"

    @property
    def admin_ids(self) -> set[int]:
        return {int(x) for x in self.admin_tg_ids.split(",") if x.strip()}

    @property
    def db_path(self) -> Path:
        return self.data_dir / "bot.db"

    @property
    def recordings_dir(self) -> Path:
        return self.data_dir / "recordings"

    @property
    def transcripts_dir(self) -> Path:
        return self.data_dir / "transcripts"

    def ensure_dirs(self) -> None:
        for p in (self.data_dir, self.recordings_dir, self.transcripts_dir):
            p.mkdir(parents=True, exist_ok=True)


settings = Settings()  # type: ignore[call-arg]
settings.ensure_dirs()
