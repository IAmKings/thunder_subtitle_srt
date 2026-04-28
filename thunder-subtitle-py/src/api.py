"""
API client for Xunlei Subtitle API
"""

import re
import requests
from typing import Optional

from .types import Subtitle, SearchResult

API_BASE_URL = "https://api-shoulei-ssl.xunlei.com/oracle"
DEFAULT_TIMEOUT = 30


class SubtitleApiClient:
    """迅雷字幕 API 客户端"""

    def __init__(self, base_url: str = API_BASE_URL, timeout: int = DEFAULT_TIMEOUT):
        self.base_url = base_url
        self.timeout = timeout

    def search_subtitles(self, name: str) -> SearchResult:
        """按关键词搜索字幕"""
        if not name or not name.strip():
            raise ValueError("Search keyword cannot be empty")

        try:
            response = requests.get(
                f"{self.base_url}/subtitle",
                params={"name": name.strip()},
                timeout=self.timeout,
                headers={"Accept": "application/json"},
            )
            response.raise_for_status()
            data = response.json()

            if data.get("code") != 0:
                msg = data.get("msg", "unknown")
                raise RuntimeError(f"API error: code {data.get('code')}, msg: {msg}")

            raw_list = data.get("data", [])
            subtitles = [self._parse_subtitle(item) for item in raw_list]

            return SearchResult(subtitles=subtitles, total=len(subtitles))

        except requests.Timeout:
            raise RuntimeError("Request timeout - please try again")
        except requests.HTTPError as e:
            raise RuntimeError(
                f"API request failed: {e.response.status_code} {e.response.reason}"
            )
        except requests.RequestException as e:
            raise RuntimeError(f"Network error: {e}")

    def is_chinese_subtitle(self, subtitle: Subtitle) -> bool:
        """判断单个字幕是否为中文"""
        has_chinese_lang = any(
            re.search(r"chinese|中文|简体|繁体|cn", lang, re.IGNORECASE)
            for lang in subtitle.languages
        )
        has_chinese_name = bool(
            re.search(r"[\u4e00-\u9fa5]", subtitle.name)
            or re.search(r"zh|cn|chinese|中文", subtitle.name, re.IGNORECASE)
        )
        is_empty_lang = len(subtitle.languages) == 0 or subtitle.languages[0] == ""

        return has_chinese_lang or (has_chinese_name and is_empty_lang)

    def filter_chinese_subtitles(self, subtitles: list[Subtitle]) -> list[Subtitle]:
        """筛选中文字幕（按语言字段或名称中的中文检测）"""
        return [sub for sub in subtitles if self.is_chinese_subtitle(sub)]

        return result

    def filter_by_max_duration(
        self, subtitles: list[Subtitle], max_duration_ms: int
    ) -> list[Subtitle]:
        """
        按最大视频时长筛选字幕
        只保留 0 < duration <= max_duration_ms 的字幕
        按 duration 降序排列（最接近目标时长的排前面）
        """
        filtered = [
            sub
            for sub in subtitles
            if sub.duration > 0 and sub.duration <= max_duration_ms
        ]
        filtered.sort(key=lambda sub: sub.duration, reverse=True)
        return filtered

    @staticmethod
    def _parse_subtitle(raw: dict) -> Subtitle:
        """将 API 返回的原始字典转为 Subtitle 对象"""
        return Subtitle(
            gcid=raw.get("gcid", ""),
            cid=raw.get("cid", ""),
            url=raw.get("url", ""),
            ext=raw.get("ext", ""),
            name=raw.get("name", ""),
            duration=raw.get("duration", 0),
            languages=raw.get("languages", []),
            source=raw.get("source", 0),
            score=raw.get("score", 0.0),
            fingerprintf_score=raw.get("fingerprintf_score", 0.0),
            extra_name=raw.get("extra_name", ""),
            mt=raw.get("mt", 0),
        )
