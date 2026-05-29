"""SRT 解析与质量检测"""

from __future__ import annotations

import re
import statistics
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ._review import ReviewItem

MIN_SUB_DURATION_MS = 500  # 单条字幕最短推荐时长
MAX_LINE_LENGTH = 60  # 单行最大推荐字符数
MAX_SUB_DURATION_MS = 7000  # 单条字幕最长推荐时长（ms）
MAX_READ_SPEED = 10  # 最大阅读速度（字/秒）

# 片尾名单关键词 — 用于 _find_last_content_end 跳过
_CREDIT_KEYWORDS = [
    "翻译",
    "校对",
    "时间轴",
    "压制",
    "字幕组",
    "字幕",
    "发布",
    "感谢",
    "致敬",
    "特别",
    "www.",
    "http",
    "下载",
]

# SRT 格式：序号\n时间轴\n文本\n\n
_SRT_PATTERN = re.compile(
    r"(\d+)\s*\n"
    r"(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*\n"
    r"((?:(?!\n\n).)+)",
    re.MULTILINE | re.DOTALL,
)


def _parse_srt_entries(text: str) -> list[dict]:
    """解析 SRT 文件为条目列表"""
    entries = []
    for m in _SRT_PATTERN.finditer(text):
        idx = int(m.group(1))
        start = _ts_to_ms(m.group(2))
        end = _ts_to_ms(m.group(3))
        content = m.group(4).strip()
        entries.append(
            {
                "index": idx,
                "start_ms": start,
                "end_ms": end,
                "content": content,
            }
        )

    return entries


def _ts_to_ms(ts: str) -> int:
    """时间戳 'HH:MM:SS,mmm' → 毫秒"""
    h, m, s_ms = ts.split(":")
    s, ms = s_ms.replace(",", ".").split(".")
    return int(h) * 3600000 + int(m) * 60000 + int(s) * 1000 + int(ms)


def _find_last_content_end(entries: list[dict], nfo_duration_ms: int) -> int:
    """逆向扫描最后 15 条，跳过片尾名单和宣传字幕，返回最后有效字幕的 end_ms"""
    tail = entries[-15:] if len(entries) >= 15 else entries
    for e in reversed(tail):
        end_ms = e["end_ms"]
        content = e["content"]

        # 跳过宣传字幕（end_ms >> nfo duration）
        if nfo_duration_ms > 0 and end_ms > nfo_duration_ms * 1.5:
            continue

        # 跳过片尾名单
        if any(kw in content for kw in _CREDIT_KEYWORDS):
            continue

        return end_ms

    # 未找到有效条目，返回最后一条的 end_ms 作为兜底
    return entries[-1]["end_ms"] if entries else 0


def _check_srt_quality(item: ReviewItem, entries: list[dict]) -> list[str]:
    """SRT 质量深度检测，返回 ai_flags 列表"""
    gaps = 0
    missing = 0
    overlaps = 0
    too_short = 0
    too_long_lines = 0
    fast_read = 0
    single_long = 0

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
                too_long_lines += 1

        # 阅读速度（字/秒）
        if dur > 0:
            chars = len(e["content"].replace("\n", ""))
            speed = chars / (dur / 1000.0)
            if speed > MAX_READ_SPEED:
                fast_read += 1

        # 单条持续过长（> 7 秒且 ≤ 2 行）
        if dur > MAX_SUB_DURATION_MS and len(e["content"].split("\n")) <= 2:
            single_long += 1

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
        item.deductions.append(
            f"时长过短({too_short}处<{MIN_SUB_DURATION_MS}ms) -{penalty}"
        )

    if too_long_lines > 0:
        penalty = min(too_long_lines, 10)
        item.score -= penalty
        item.deductions.append(
            f"单行过长({too_long_lines}处>{MAX_LINE_LENGTH}字) -{penalty}"
        )

    if fast_read > 0:
        penalty = min(fast_read, 5)
        item.score -= penalty
        item.deductions.append(
            f"阅读速度过快({fast_read}处>{MAX_READ_SPEED}字/秒) -{penalty}"
        )

    if single_long > 0:
        penalty = min(single_long, 5)
        item.score -= penalty
        item.deductions.append(
            f"单条持续过长({single_long}处>{MAX_SUB_DURATION_MS}ms) -{penalty}"
        )

    # ---- AI 嫌疑检测（不参与 score） ----
    ai_flags: list[str] = []

    # 长句重复：同句 ≥ 15 字出现 ≥ 3 次
    text_counts: dict[str, int] = {}
    for e in entries:
        text = e["content"].replace("\n", " ").strip()
        if len(text) >= 15:
            text_counts[text] = text_counts.get(text, 0) + 1
    if any(count >= 3 for count in text_counts.values()):
        ai_flags.append("repeated_long_lines")

    # 时间轴均匀度：帧间隔标准差 < 2500ms
    if len(entries) >= 30:
        intervals: list[float] = []
        prev_start = 0
        for e in entries:
            if prev_start > 0:
                intervals.append(e["start_ms"] - prev_start)
            prev_start = e["start_ms"]

        if len(intervals) >= 10:
            try:
                std_dev = statistics.stdev(intervals)
                mean = statistics.mean(intervals)
                if mean > 0 and std_dev < 2500 and (std_dev / mean) < 0.3:
                    ai_flags.append("uniform_timing")
            except statistics.StatisticsError:
                pass

    return ai_flags
