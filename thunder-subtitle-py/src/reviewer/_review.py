"""字幕文件审查：单文件深度审查"""

import logging
import os
from dataclasses import dataclass, field

from ..models import ReviewQuality
from ._encoding import _detect_encoding, _calc_cn_ratio
from ._srt import _parse_srt_entries, _check_srt_quality, _find_last_content_end

logger = logging.getLogger(__name__)

MIN_FILE_SIZE = 200  # 最小文件大小（字节）
MAX_FILE_SIZE = 5 * 1024 * 1024  # 最大文件大小（5MB）
MIN_CN_RATIO = 0.05  # .zh 文件最低中文占比
_ZH_PREFIX = ".zh."  # 中文字幕文件名标识


@dataclass
class ReviewItem:
    """单文件审查结果"""

    movie_path: str
    movie_name: str
    filename: str
    score: int = 100
    status: str = (
        ReviewQuality.ok
    )  # ReviewQuality.ok | ReviewQuality.warn | ReviewQuality.fail
    checks: list[str] = field(default_factory=list)
    deductions: list[str] = field(default_factory=list)  # 扣分明细
    size_bytes: int = 0
    line_count: int = 0
    entry_count: int = 0  # SRT 条目数
    encoding: str = ""
    cn_ratio: float = 0.0
    reviewed: bool = False  # 是否已人工审查
    reviewed_date: str = ""  # 审查日期
    ai_flags: list[str] = field(default_factory=list)  # AI 嫌疑标记
    last_end_ms: int = 0  # 最后有效内容字幕的时间戳（ms）


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
                or base.isdigit()  # dump 数字命名: 1.srt, 2.ass
            )
            if valid and ext.lower() in sub_exts:
                result.append((os.path.join(movie_path, fname), fname))
    except OSError:
        logger.warning("无法扫描字幕目录: %s", movie_path)
    return result


def _review_one_file(
    filepath: str,
    filename: str,
    movie_path: str,
    movie_name: str,
    nfo_duration_seconds: int = 0,
    mt: int = 0,
) -> ReviewItem:
    """深度审查单个字幕文件，返回带评分的 ReviewItem

    Args:
        filepath: 字幕文件完整路径
        filename: 字幕文件名
        movie_path: 电影目录路径
        movie_name: 电影名称（目录名）
        nfo_duration_seconds: NFO 片长（秒），0 表示未知
        mt: 机器翻译标记（0=非AI, 1+=AI）
    """
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

    # 文件过大（> 5MB）仅扣分，不直接 fail
    if item.size_bytes > MAX_FILE_SIZE:
        item.score -= 20
        item.deductions.append(f"文件过大 ({item.size_bytes / 1024 / 1024:.1f}MB) -20")

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
            ai_flags = _check_srt_quality(item, entries)
            item.ai_flags = ai_flags

            # 片长对比检测（检测体系 3）
            _apply_duration_match(item, entries, nfo_duration_seconds)

    # ---- AI 嫌疑：mt 标记 ----
    if mt != 0:
        if "machine_translation" not in item.ai_flags:
            item.ai_flags.append("machine_translation")

    # ---- 中文内容检查 ----
    item.cn_ratio = _calc_cn_ratio(text)
    if _ZH_PREFIX in filename and item.cn_ratio < MIN_CN_RATIO:
        item.score -= 20
        item.deductions.append(f"中文占比过低({item.cn_ratio:.0%}) -20")
    elif item.cn_ratio >= MIN_CN_RATIO:
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


def _apply_duration_match(
    item: ReviewItem, entries: list[dict], nfo_duration_seconds: int
) -> None:
    """片长对比检测：对比 SRT 最后有效时间戳与 NFO 片长

    注意：此函数在 _review_one_file 中被调用，score 改动后由 _review_one_file 统一
    做扣分上限保护和综合判定。本函数只做扣分和标记，不修改 item.status。
    """
    nfo_duration_ms = nfo_duration_seconds * 1000

    # 跳过条件
    if nfo_duration_seconds == 0:
        return
    if len(entries) < 10:
        return

    last_end = _find_last_content_end(entries, nfo_duration_ms)
    item.last_end_ms = last_end
    if last_end == 0:
        return

    ratio = last_end / nfo_duration_ms

    # 短片/剧集（< 30 分钟）使用宽松阈值
    is_short = nfo_duration_seconds < 1800
    if is_short:
        if ratio > 1.10:
            item.score -= 15
            item.deductions.append(f"片长超出({ratio:.0%}) -15")
        return

    if 0.85 <= ratio <= 1.00:
        # 正常
        pass
    elif 1.00 < ratio <= 1.05:
        item.score -= 5
        item.deductions.append(f"片长略超({ratio:.0%}) -5")
    elif 1.05 < ratio <= 1.20:
        item.score -= 15
        item.deductions.append(f"片长超出({ratio:.0%}) -15")
    elif ratio > 1.20:
        item.score -= 25
        item.deductions.append(f"片长严重超出({ratio:.0%}) -25")
    elif 0.50 <= ratio < 0.85:
        # 可能截断 — 只标记不扣分
        if "possibly_truncated" not in item.ai_flags:
            item.ai_flags.append("possibly_truncated")
    elif ratio < 0.50:
        item.score -= 25
        item.deductions.append(f"片长严重偏短({ratio:.0%}) -25")
        if "possibly_truncated" not in item.ai_flags:
            item.ai_flags.append("possibly_truncated")
