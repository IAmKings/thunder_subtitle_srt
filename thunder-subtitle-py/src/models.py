"""
Type definitions for Thunder Subtitle Python CLI
"""

from dataclasses import dataclass, field
from enum import Enum


class ScanStatus(str, Enum):
    downloaded = "downloaded"
    skipped = "skipped"
    no_match = "no_match"
    error = "error"


class ReviewState(str, Enum):
    ok = "ok"
    fail = "fail"
    not_reviewed = "not_reviewed"  # 等价于 None


class DryState(str, Enum):
    need_download = "need_download"
    need_review = "need_review"
    reviewed_ok = "reviewed_ok"
    reviewed_fail = "reviewed_fail"
    skipped = "skipped"


class ReviewQuality(str, Enum):
    ok = "ok"
    warn = "warn"
    fail = "fail"


@dataclass
class Subtitle:
    """字幕数据结构"""
    gcid: str
    cid: str
    url: str
    ext: str
    name: str
    duration: int  # 毫秒
    languages: list[str]
    source: int
    score: float
    fingerprintf_score: float
    extra_name: str
    mt: int


@dataclass
class ApiResponse:
    """API 响应结构"""
    code: int
    data: list[dict]
    msg: str = ""


@dataclass
class SearchResult:
    """搜索结果"""
    subtitles: list[Subtitle]
    total: int


@dataclass
class DownloadResult:
    """下载结果"""
    success: bool
    filename: str
    filepath: str = ""
    error: str = ""
