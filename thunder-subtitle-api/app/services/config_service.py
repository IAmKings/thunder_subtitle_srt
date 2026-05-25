"""Config service — reads/writes the same ~/.thunder-subtitle.json as the CLI."""

import os

from app._cli_imports import cli_import
from app.models.schemas import AppConfig, AppConfigUpdate


class ConfigService:
    """Service for reading and writing application configuration."""

    @staticmethod
    def _load_cli_config():
        """Load CLI Config object with dual-import fallback."""
        mod = cli_import("src.config")
        return mod.Config.load()

    @staticmethod
    def _effective_media_paths(config: object) -> str:
        """Return media_paths: JSON priority, env var as fallback seed."""
        json_val = getattr(config, "media_paths", "").strip()
        if json_val:
            return json_val
        return os.environ.get("MEDIA_PATHS", "").strip()

    @staticmethod
    def _to_app_config(config: object) -> AppConfig:
        """Build an AppConfig Pydantic model from a CLI Config dataclass."""
        return AppConfig(
            output_dir=getattr(config, "output_dir", ""),
            timeout=getattr(config, "timeout", 30),
            download_timeout=getattr(config, "download_timeout", 60),
            chunk_size=getattr(config, "chunk_size", 8192),
            rate_limit=getattr(config, "rate_limit", 3),
            retry_count=getattr(config, "retry_count", 3),
            retry_delay=getattr(config, "retry_delay", 2),
            preferred_groups=getattr(config, "preferred_groups", ""),
            media_paths=ConfigService._effective_media_paths(config),
        )

    def get_config(self) -> AppConfig:
        """Load current configuration."""
        config = self._load_cli_config()
        return self._to_app_config(config)

    def update_config(self, update: AppConfigUpdate) -> AppConfig:
        """Update configuration fields and save to disk."""
        config = self._load_cli_config()

        # Apply updates
        if update.output_dir is not None:
            config.output_dir = update.output_dir
        if update.timeout is not None:
            config.timeout = update.timeout
        if update.download_timeout is not None:
            config.download_timeout = update.download_timeout
        if update.chunk_size is not None:
            config.chunk_size = update.chunk_size
        if update.rate_limit is not None:
            config.rate_limit = update.rate_limit
        if update.retry_count is not None:
            config.retry_count = update.retry_count
        if update.retry_delay is not None:
            config.retry_delay = update.retry_delay
        if update.preferred_groups is not None:
            config.preferred_groups = update.preferred_groups
        if update.media_paths is not None:
            config.media_paths = update.media_paths

        config.save()
        return self._to_app_config(config)

    def save_password(self, password: str) -> None:
        """Persist admin password to config file."""
        config = self._load_cli_config()
        config.password = password
        config.save()

    def reload_config(self) -> AppConfig:
        """Hot-reload configuration from disk."""
        return self.get_config()
