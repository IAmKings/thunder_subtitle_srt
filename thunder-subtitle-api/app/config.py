"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


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

    # CORS
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    # Tasks
    max_concurrent_tasks: int = 2
    task_poll_interval: float = 0.5


settings = Settings()
