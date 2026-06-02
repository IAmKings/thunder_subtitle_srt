"""Health service — wraps the CLI health check module."""

import logging

from app._cli_imports import cli_import
from app.models.schemas import HealthCheckItem

logger = logging.getLogger(__name__)


class HealthService:
    """Service that runs directory structure health checks using the CLI module."""

    def run_health_check(self, base_dir: str) -> list[HealthCheckItem]:
        """Run health checks on a media library directory.

        Uses the CLI health module (dual-import fallback) to perform
        file-system-only checks on each movie directory.

        Args:
            base_dir: Media library root directory path.

        Returns:
            List of HealthCheckItem results.
        """
        mod = cli_import("src.health")

        # Read poster_systems from config
        config_mod = cli_import("src.config")
        config = config_mod.Config.load()
        poster_systems = getattr(config, "poster_systems", ["kodi"])

        results = mod.run_health_check(base_dir, poster_systems=poster_systems)

        return [
            HealthCheckItem(
                level=r.level,
                path=r.path,
                movie_name=r.movie_name,
                message=r.message,
            )
            for r in results
        ]


# Singleton instance
health_service = HealthService()
