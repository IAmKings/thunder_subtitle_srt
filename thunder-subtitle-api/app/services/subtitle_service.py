"""Subtitle search service — wraps the CLI SubtitleApiClient."""

import logging
import uuid
from dataclasses import asdict
from typing import Optional

from app.models.schemas import SubtitleDetail, SubtitleSearchResponse

logger = logging.getLogger(__name__)


class SubtitleService:
    """Service that wraps the CLI SubtitleApiClient for search/filter operations."""

    def _get_client(self):
        """Lazily import and create a SubtitleApiClient instance."""
        try:
            from src.api import SubtitleApiClient
        except ImportError:
            try:
                from thunder_subtitle.api import SubtitleApiClient  # type: ignore[import-untyped]
            except ImportError:
                logger.error("Could not import SubtitleApiClient from any source")
                raise

        return SubtitleApiClient()

    def _parse_duration(self, duration_str: str) -> int:
        """Parse duration string (e.g. '1h30m') to milliseconds."""
        try:
            from src.utils import parse_duration
            return parse_duration(duration_str)
        except ImportError:
            try:
                from thunder_subtitle.utils import parse_duration  # type: ignore[import-untyped]
                return parse_duration(duration_str)
            except ImportError:
                # Fallback: simple parser
                import re
                trimmed = duration_str.strip().lower()
                if not trimmed:
                    raise ValueError("Duration string cannot be empty")

                total_ms = 0
                has_match = False

                hours_match = re.search(r"(\d+)h", trimmed)
                if hours_match:
                    total_ms += int(hours_match.group(1)) * 3600000
                    has_match = True

                minutes_match = re.search(r"(\d+)m", trimmed)
                if minutes_match:
                    total_ms += int(minutes_match.group(1)) * 60000
                    has_match = True

                seconds_match = re.search(r"(\d+)s", trimmed)
                if seconds_match:
                    total_ms += int(seconds_match.group(1)) * 1000
                    has_match = True

                if not has_match:
                    raise ValueError(f"Invalid duration format: {duration_str}")

                return total_ms

    def _filter_by_duration(self, subtitles: list, max_duration_ms: int) -> list:
        """Filter subtitles by max duration, preserving those without duration info."""
        try:
            from src.api import SubtitleApiClient
            from src.utils import filter_by_duration
            client = SubtitleApiClient()
            return filter_by_duration(subtitles, max_duration_ms, client.filter_by_max_duration)
        except ImportError:
            try:
                from thunder_subtitle.api import SubtitleApiClient  # type: ignore[import-untyped]
                from thunder_subtitle.utils import filter_by_duration  # type: ignore[import-untyped]
                client = SubtitleApiClient()
                return filter_by_duration(subtitles, max_duration_ms, client.filter_by_max_duration)
            except ImportError:
                # Fallback: simple filter
                filtered = [
                    sub for sub in subtitles
                    if hasattr(sub, 'duration') and 0 < sub.duration <= max_duration_ms
                ]
                no_dur = [
                    sub for sub in subtitles
                    if hasattr(sub, 'duration') and sub.duration == 0
                ]
                return filtered + no_dur

    def search(
        self,
        name: str,
        chinese_only: bool = False,
        chinese_first: bool = False,
        max_duration: Optional[str] = None,
    ) -> SubtitleSearchResponse:
        """Search subtitles by keyword, optionally filtering for Chinese or max duration."""
        client = self._get_client()
        try:
            result = client.search_subtitles(name)
            subtitles = result.subtitles

            if chinese_only:
                subtitles = client.filter_chinese_subtitles(subtitles)

            if chinese_first and not chinese_only:
                chinese_subs = client.filter_chinese_subtitles(subtitles)
                other_subs = [s for s in subtitles if s not in chinese_subs]
                subtitles = chinese_subs + other_subs

            if max_duration:
                max_ms = self._parse_duration(max_duration)
                subtitles = self._filter_by_duration(subtitles, max_ms)

            items = []
            for sub in subtitles:
                items.append(
                    SubtitleDetail(
                        gcid=sub.gcid,
                        cid=sub.cid,
                        url=sub.url,
                        ext=sub.ext,
                        name=sub.name,
                        duration=sub.duration,
                        languages=sub.languages,
                        source=sub.source,
                        score=sub.score,
                        fingerprintf_score=sub.fingerprintf_score,
                        extra_name=sub.extra_name,
                        mt=sub.mt,
                        is_chinese=client.is_chinese_subtitle(sub),
                    )
                )

            return SubtitleSearchResponse(subtitles=items, total=len(items))
        finally:
            client.close()

    def get_detail(self, gcid: str, cid: str) -> Optional[SubtitleDetail]:
        """Get a single subtitle detail by gcid/cid. Requires searching first."""
        # The Xunlei API doesn't have a direct detail endpoint;
        # this is a placeholder for future enhancement
        return None

    def get_download_url(self, url: str) -> str:
        """Return the download URL for a subtitle. Currently just proxies the URL."""
        # The Xunlei API provides direct download URLs
        # The frontend can download directly from these URLs
        return url