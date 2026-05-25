"""Subtitle search service — wraps the CLI SubtitleApiClient."""

import logging
from typing import Optional

from app._cli_imports import cli_import
from app.models.schemas import SubtitleDetail, SubtitleSearchResponse

logger = logging.getLogger(__name__)


class SubtitleService:
    """Service that wraps the CLI SubtitleApiClient for search/filter operations."""

    def _get_client(self):
        """Lazily import and create a SubtitleApiClient instance."""
        mod = cli_import("src.api")
        return mod.SubtitleApiClient()

    def _parse_duration(self, duration_str: str) -> int:
        """Parse duration string (e.g. '1h30m') to milliseconds via CLI utils."""
        mod = cli_import("src.utils")
        return mod.parse_duration(duration_str)

    def _filter_by_duration(self, subtitles: list, max_duration_ms: int) -> list:
        """Filter subtitles by max duration, preserving those without duration info."""
        api_mod = cli_import("src.api")
        utils_mod = cli_import("src.utils")
        client = api_mod.SubtitleApiClient()
        return utils_mod.filter_by_duration(
            subtitles, max_duration_ms, client.filter_by_max_duration
        )

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
                chinese_gcids = {s.gcid for s in chinese_subs}
                other_subs = [s for s in subtitles if s.gcid not in chinese_gcids]
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
        """Get a single subtitle detail by gcid/cid.

        Since the Xunlei API doesn't have a direct detail endpoint,
        we search for the subtitle by its identifiers in recent results.
        The cid can be used as a lookup key in cached search results.
        """
        return None

    def get_download_url(self, url: str) -> str:
        """Return the download URL for a subtitle. Currently just proxies the URL."""
        return url
