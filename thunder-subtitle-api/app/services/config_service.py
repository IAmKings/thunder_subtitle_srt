"""Config service — reads/writes the same ~/.thunder-subtitle.json as the CLI."""

import os

from app.models.schemas import AppConfig, AppConfigUpdate


class ConfigService:
    """Service for reading and writing application configuration."""

    @staticmethod
    def _effective_media_paths(config: object) -> str:
        """Return media_paths: JSON priority, env var as fallback seed."""
        json_val = getattr(config, "media_paths", "").strip()
        if json_val:
            return json_val
        return os.environ.get("MEDIA_PATHS", "").strip()

    def get_config(self) -> AppConfig:
        """Load current configuration."""
        try:
            from src.config import Config
        except ImportError:
            from thunder_subtitle.config import Config  # type: ignore[import-untyped]

        config = Config.load()
        return AppConfig(
            output_dir=config.output_dir,
            timeout=config.timeout,
            download_timeout=config.download_timeout,
            chunk_size=config.chunk_size,
            rate_limit=config.rate_limit,
            retry_count=config.retry_count,
            retry_delay=config.retry_delay,
            preferred_groups=config.preferred_groups,
            media_paths=self._effective_media_paths(config),
        )

    def update_config(self, update: AppConfigUpdate) -> AppConfig:
        """Update configuration fields and save to disk."""
        try:
            from src.config import Config
        except ImportError:
            from thunder_subtitle.config import Config  # type: ignore[import-untyped]

        config = Config.load()

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
        return AppConfig(
            output_dir=config.output_dir,
            timeout=config.timeout,
            download_timeout=config.download_timeout,
            chunk_size=config.chunk_size,
            rate_limit=config.rate_limit,
            retry_count=config.retry_count,
            retry_delay=config.retry_delay,
            preferred_groups=config.preferred_groups,
            media_paths=self._effective_media_paths(config),
        )

    def reload_config(self) -> AppConfig:
        """Hot-reload configuration from disk."""
        return self.get_config()
