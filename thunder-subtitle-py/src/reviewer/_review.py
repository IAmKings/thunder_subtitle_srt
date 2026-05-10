"""字幕文件审查：单文件深度审查"""

import logging
import os
from dataclasses import dataclass, field

from ..types import ReviewQuality
from ._encoding import _detect_encoding, _calc_cn_ratio
from ._srt import _parse_srt_entries, _check_srt_quality

logger = logging.getLogger(__name__)

MIN_FILE_SIZE = 200     # 最小文件大小（字节）
MIN_CN_RATIO = 0.05     # .zh 文件最低中文占比
_ZH_PREFIX = ".zh."     # 中文字幕文件名标识


@dataclass
class ReviewItem:
    """单文件审查结果"""
    movie_path: str
    movie_name: str
    filename: str
    score: int = 100
    status: str = ReviewQuality.ok       # ReviewQuality.ok | ReviewQuality.warn | ReviewQuality.fail
    checks: list[str] = field(default_factory=list)
    deductions: list[str] = field(default_factory=list)  # 扣分明细
    size_bytes: int = 0
    line_count: int = 0
    entry_count: int = 0     # SRT 条目数
    encoding: str = ""
    cn_ratio: float = 0.0
    reviewed: bool = False      # 是否已人工审查
    reviewed_date: str = ""     # 审查日期


def _find_all_subtitle_files(movie_path: str, movie_name: str) -> list[tuple[str, str]]:
    """查找目录下所有匹配电影名的字幕文件（含 alt/new 变体）"""
    result = []
    sub_exts = {".srt", ".ass", ".ssa", ".sub", ".vtt"}
    try:
        for fname in sorted(os.listdir(movie_path)):
            base, ext = os.path.splitext(fname)
            valid = (
                base == movie_name
                or base.startswith(movie_name + ".")
                or base.startswith(movie_name + "-")
            )
            if valid and ext.lower() in sub_exts:
                result.append((os.path.join(movie_path, fname), fname))
    except OSError:
        logger.warning("无法扫描字幕目录: %s", movie_path)
    return result


def _review_one_file(filepath: str, filename: str, movie_path: str, movie_name: str) -> ReviewItem:
    """深度审查单个字幕文件，返回带评分的 ReviewItem"""
    item = ReviewItem(
        movie_path=movie_path,
        movie_name=movie_name,
        filename=filename,
    )

    # ---- 文件基础检查 ----
    if not os.path.isfile(filepath):
        item.deductions.append("file_not_found")
        item.score = 0
        item.status = ReviewQuality.fail
        return item

    item.size_bytes = os.path.getsize(filepath)
    if item.size_bytes < MIN_FILE_SIZE:
        item.deductions.append(f"文件过小 ({item.size_bytes}B)")
        item.score = 0
        item.status = ReviewQuality.fail
        return item

    try:
        with open(filepath, "rb") as f:
            raw = f.read()
    except OSError as e:
        item.deductions.append(f"无法读取: {e}")
        item.score = 0
        item.status = ReviewQuality.fail
        return item

    # ---- 编码检测 ----
    item.encoding = _detect_encoding(raw)
    if item.encoding not in ("utf-8", "ascii"):
        item.score -= 10
        item.deductions.append(f"非UTF-8编码({item.encoding}) -10")
    else:
        item.checks.append("encoding")

    # 解码
    try:
        text = raw.decode(item.encoding)
    except (UnicodeDecodeError, LookupError):
        text = raw.decode("utf-8", errors="replace")
        item.score -= 5
        item.deductions.append("编码回退UTF-8(replace) -5")

    lines = text.splitlines()
    item.line_count = len(lines)

    # ---- SRT 深度解析 ----
    is_srt = filename.lower().endswith(".srt")
    if is_srt:
        entries = _parse_srt_entries(text)
        item.entry_count = len(entries)

        if not entries:
            item.score -= 30
            item.deductions.append("无有效SRT时间轴 -30")
        else:
            item.checks.append("srt_structure")
            _check_srt_quality(item, entries)

    # ---- 中文内容检查 ----
    if _ZH_PREFIX in filename:
        item.cn_ratio = _calc_cn_ratio(text)
        if item.cn_ratio < MIN_CN_RATIO:
            item.score -= 20
            item.deductions.append(f"中文占比过低({item.cn_ratio:.0%}) -20")
        else:
            item.checks.append("cn_content")

    # 扣分上限保护
    item.score = max(0, item.score)

    # 综合判定
    if item.score >= 80:
        item.status = ReviewQuality.ok
    elif item.score >= 50:
        item.status = ReviewQuality.warn
    else:
        item.status = ReviewQuality.fail

    return item
