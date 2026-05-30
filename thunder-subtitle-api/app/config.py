"""Application configuration loaded from environment variables."""

from __future__ import annotations

import json
import os
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings


def _parse_cors_origins(v: str | list[str] | None) -> list[str]:
    """Parse CORS_ORIGINS env var (comma-separated URLs)."""
    if not v:
        return [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    if isinstance(v, list):
        return v
    return [origin.strip() for origin in v.split(",") if origin.strip()]


class Settings(BaseSettings):
    """Application settings derived from environment variables."""

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    # Auth
    admin_password: str = "changeme"
    jwt_secret: str = "thunder-subtitle-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440  # 24 hours

    # Config path (empty = use default ~/.thunder-subtitle.json)
    config_path: str = ""

    # CORS (browser requests go through Nginx on :3000)
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # Tasks
    max_concurrent_tasks: int = 2
    task_poll_interval: float = 0.5

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | list[str] | None) -> list[str]:
        return _parse_cors_origins(v)


settings = Settings()


def override_password_from_config() -> None:
    """Override settings.admin_password from config file (priority: config > env > default).

    Must be called after sys.path is set up so the CLI config module can be imported.
    This runs during lifespan startup in main.py.
    """
    config_path = os.environ.get(
        "THUNDER_SUBTITLE_CONFIG",
        os.path.join(str(Path.home()), ".thunder-subtitle.json"),
    )
    if not os.path.isfile(config_path):
        return
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        pw = data.get("password", "").strip()
        if pw:
            settings.admin_password = pw
    except (json.JSONDecodeError, OSError):
        pass
