"""
Type definitions for Thunder Subtitle Python CLI
"""

from dataclasses import dataclass, field


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
