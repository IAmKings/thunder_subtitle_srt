"""SRT 解析与质量检测"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ._review import ReviewItem

MIN_SUB_DURATION_MS = 500  # 单条字幕最短推荐时长
MAX_LINE_LENGTH = 60  # 单行最大推荐字符数


def _parse_srt_entries(text: str) -> list[dict]:
    """解析 SRT 文件为条目列表"""
    entries = []
    # SRT 格式：序号\n时间轴\n文本\n\n
    pattern = re.compile(
        r"(\d+)\s*\n"
        r"(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*\n"
        r"((?:(?!\n\n).)+)",
        re.MULTILINE | re.DOTALL,
    )

    for m in pattern.finditer(text):
        idx = int(m.group(1))
        start = _ts_to_ms(m.group(2))
        end = _ts_to_ms(m.group(3))
        content = m.group(4).strip()
        entries.append({
            "index": idx,
            "start_ms": start,
            "end_ms": end,
            "content": content,
        })

    return entries


def _ts_to_ms(ts: str) -> int:
    """时间戳 'HH:MM:SS,mmm' → 毫秒"""
    h, m, s_ms = ts.split(":")
    s, ms = s_ms.replace(",", ".").split(".")
    return int(h) * 3600000 + int(m) * 60000 + int(s) * 1000 + int(ms)


def _check_srt_quality(item: ReviewItem, entries: list[dict]) -> None:
    """SRT 质量深度检测"""
    from ..models import ReviewState

    gaps = 0
    missing = 0
    overlaps = 0
    too_short = 0
    too_long = 0

    prev_idx = 0
    prev_end = 0

    for e in entries:
        # 序号连续性
        if e["index"] != prev_idx + 1:
            gaps += 1
        prev_idx = e["index"]

        # 空内容
        if not e["content"] or len(e["content"]) < 2:
            missing += 1

        # 时间重叠
        if prev_end > 0 and e["start_ms"] < prev_end:
            overlaps += 1
        prev_end = e["end_ms"]

        # 时长过短
        dur = e["end_ms"] - e["start_ms"]
        if dur < MIN_SUB_DURATION_MS:
            too_short += 1

        # 单行过长
        for line_text in e["content"].split("\n"):
            if len(line_text) > MAX_LINE_LENGTH:
                too_long += 1

    if gaps > 0:
        penalty = min(gaps, 10)
        item.score -= penalty
        item.deductions.append(f"序号不连续({gaps}处) -{penalty}")

    if missing > 0:
        penalty = min(missing * 2, 10)
        item.score -= penalty
        item.deductions.append(f"空内容条目({missing}处) -{penalty}")

    if overlaps > 0:
        penalty = min(overlaps * 5, 15)
        item.score -= penalty
        item.deductions.append(f"时间轴重叠({overlaps}处) -{penalty}")

    if too_short > 0:
        penalty = min(too_short, 5)
        item.score -= penalty
        item.deductions.append(f"时长过短({too_short}处<{MIN_SUB_DURATION_MS}ms) -{penalty}")

    if too_long > 0:
        penalty = min(too_long, 10)
        item.score -= penalty
        item.deductions.append(f"单行过长({too_long}处>{MAX_LINE_LENGTH}字) -{penalty}")
