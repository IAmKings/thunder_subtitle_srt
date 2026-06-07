"""SRT 解析与质量检测"""

from __future__ import annotations

import re
import statistics
from typing import TYPE_CHECKING, overload

if TYPE_CHECKING:
    from ._review import ReviewItem

MIN_SUB_DURATION_MS = 500  # 单条字幕最短推荐时长
MAX_LINE_LENGTH = 60  # 单行最大推荐字符数
MAX_SUB_DURATION_MS = 7000  # 单条字幕最长推荐时长（ms）
MAX_READ_SPEED = 10  # 最大阅读速度（字/秒）
MAX_GAP_MS = 30000  # 相邻字幕最大推荐间隔（30 秒），超过可能缺失
CJK_RE = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]")  # CJK 统一表意文字

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


@overload
def _parse_srt_entries(text: str, debug: bool = False) -> list[dict]: ...
@overload
def _parse_srt_entries(text: str, debug: bool = True) -> tuple[list[dict], dict]: ...
def _parse_srt_entries(
    text: str, debug: bool = False
) -> list[dict] | tuple[list[dict], dict]:
    """解析 SRT 文件为条目列表

    Args:
        text: SRT 文件文本内容
        debug: 是否返回调试信息。为 True 时返回 (entries, debug_info)

    正常模式返回 entries 列表
    debug 模式返回 (entries, debug_info)，其中 debug_info 包含:
        - match_count: 正则匹配命中数
        - total_lines: 非空行数（行号参照用）
        - unmatched_tail_offset: 最后一条匹配后的文本偏移量
        - line_ranges: [(start_line, end_line), ...] 每条条目对应的行号范围
    """
    entries = []
    line_ranges: list[tuple[int, int]] = []
    last_end_pos = 0
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
        if debug:
            start_line = text[: m.start()].count("\n") + 1
            end_line = text[: m.end()].count("\n") + 1
            line_ranges.append((start_line, end_line))
        last_end_pos = m.end()

    if debug:
        total_lines = len([ln for ln in text.splitlines() if ln.strip()])
        unmatched_tail_offset = len(text) - last_end_pos if last_end_pos > 0 else 0
        debug_info = {
            "match_count": len(entries),
            "total_lines": total_lines,
            "unmatched_tail_offset": unmatched_tail_offset,
            "line_ranges": line_ranges,
        }
        return entries, debug_info

    return entries


def _ts_to_ms(ts: str) -> int:
    """时间戳 'HH:MM:SS,mmm' → 毫秒"""
    h, m, s_ms = ts.split(":")
    s, ms = s_ms.replace(",", ".").split(".")
    return int(h) * 3600000 + int(m) * 60000 + int(s) * 1000 + int(ms)


def _ms_to_ts(ms: int) -> str:
    """毫秒 → 时间戳 'HH:MM:SS'"""
    total_seconds = ms // 1000
    h = total_seconds // 3600
    m = (total_seconds % 3600) // 60
    s = total_seconds % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


def _ms_to_ts_ms(ms: int) -> str:
    """毫秒 → 时间戳 'HH:MM:SS,mmm'（SRT 格式）"""
    abs_ms = abs(ms)
    total_seconds = abs_ms // 1000
    h = total_seconds // 3600
    m = (total_seconds % 3600) // 60
    s = total_seconds % 60
    millis = abs_ms % 1000
    return f"{h:02d}:{m:02d}:{s:02d},{millis:03d}"


@overload
def _find_last_content_end(entries: list[dict], nfo_duration_ms: int, debug: bool = False) -> int: ...
@overload
def _find_last_content_end(entries: list[dict], nfo_duration_ms: int, debug: bool = True) -> tuple[int, list[str]]: ...
def _find_last_content_end(
    entries: list[dict], nfo_duration_ms: int, debug: bool = False
) -> int | tuple[int, list[str]]:
    """逆向扫描条目，跳过片尾名单和宣传字幕，返回最后有效字幕的 end_ms。
    最多扫描最后 50 条，避免片尾名单超过 15 条时兜底失效。

    debug 模式返回 (end_ms, scan_log)，scan_log 记录每次跳过的理由。
    """
    if not entries:
        return (0, []) if debug else 0

    scan_log: list[str] = []
    scan_count = min(len(entries), 50)
    for e in reversed(entries[-scan_count:]):
        idx = e["index"]
        end_ms = e["end_ms"]
        content = e["content"]
        first_line = content.split("\n")[0][:40]

        # 跳过宣传字幕（end_ms >> nfo duration）
        if nfo_duration_ms > 0 and end_ms > nfo_duration_ms * 1.5:
            ratio = end_ms / nfo_duration_ms
            scan_log.append(
                f"    #{idx} 跳过 \u2192 宣传字幕 (end > NFO \u00d7 {ratio:.1f}) "
                f'"{first_line}"'
            )
            continue

        # 跳过片尾名单
        matched_kw = next((kw for kw in _CREDIT_KEYWORDS if kw in content), None)
        if matched_kw:
            scan_log.append(
                f'    #{idx} 跳过 \u2192 片尾名单 "{matched_kw}..." "{first_line}"'
            )
            continue

        scan_log.append(
            f'    #{idx} \u2713 最后有效 \u2192 {_ms_to_ts(end_ms)} 结束 "{first_line}"'
        )
        if debug:
            return int(end_ms), scan_log
        return int(end_ms)

    # 50 条全被跳过（极端情况），返回物理最后一条
    last_end = int(entries[-1]["end_ms"])
    scan_log.append(
        f"    #{entries[-1]['index']} (兜底) \u2192 {_ms_to_ts(last_end)} 结束"
    )
    if debug:
        return last_end, scan_log
    return last_end


@overload
def _check_srt_quality(
    item: ReviewItem, entries: list[dict],
    debug: bool = False, line_ranges: list[tuple[int, int]] | None = None,
) -> list[str]: ...
@overload
def _check_srt_quality(
    item: ReviewItem, entries: list[dict],
    debug: bool = True, line_ranges: list[tuple[int, int]] | None = None,
) -> tuple[list[str], dict]: ...
def _check_srt_quality(
    item: ReviewItem,
    entries: list[dict],
    debug: bool = False,
    line_ranges: list[tuple[int, int]] | None = None,
) -> list[str] | tuple[list[str], dict]:
    """SRT 质量深度检测，返回 ai_flags 列表

    debug 模式返回 (ai_flags, issues)，每个 issue 为 dict:
        type, entry_index, line_start, line_end, start_ms, end_ms, content, detail
    """
    gaps = 0
    missing = 0
    overlaps = 0
    too_short = 0
    inverted_ts = 0  # 时间戳倒置（end < start）
    too_long_lines = 0
    fast_read = 0
    single_long = 0
    large_gaps = 0

    prev_idx = 0
    prev_end = 0

    # debug 模式收集详细问题
    issues: list[dict] = []
    # 追踪前一条条目信息用于 overlap 检测
    prev_entry: dict | None = None
    # 收集大段空白触发条目
    large_gap_entries: list[int] = []

    for i, e in enumerate(entries):
        idx = e["index"]
        start = e["start_ms"]
        end = e["end_ms"]
        content = e["content"]
        line_start = line_ranges[i][0] if line_ranges else 0
        line_end = line_ranges[i][1] if line_ranges else 0
        content_trunc = content[:40].replace("\n", " | ")

        # 序号连续性
        if idx != prev_idx + 1:
            gaps += 1
            if debug and prev_idx > 0:
                issues.append(
                    {
                        "type": "gap",
                        "entry_index": idx,
                        "line_start": line_start,
                        "line_end": line_end,
                        "start_ms": start,
                        "end_ms": end,
                        "content": content_trunc,
                        "detail": f"缺少条目 {prev_idx + 1}\u2192{idx - 1}",
                    }
                )
        prev_idx = idx

        # 空内容
        if not content or len(content) < 2:
            missing += 1
            if debug:
                issues.append(
                    {
                        "type": "empty_content",
                        "entry_index": idx,
                        "line_start": line_start,
                        "line_end": line_end,
                        "start_ms": start,
                        "end_ms": end,
                        "content": "(empty)",
                        "detail": "",
                    }
                )

        dur = end - start

        # 时间戳倒置（结构性错误）
        if dur < 0:
            inverted_ts += 1
            if debug:
                issues.append(
                    {
                        "type": "inverted_ts",
                        "entry_index": idx,
                        "line_start": line_start,
                        "line_end": line_end,
                        "start_ms": start,
                        "end_ms": end,
                        "content": content_trunc,
                        "detail": f"{_ms_to_ts_ms(start)} --> {_ms_to_ts_ms(end)}",
                    }
                )
            prev_end = max(prev_end, end)  # 仍追踪正确结束时间
            prev_entry = e
            continue  # 跳过该条目的其他检测

        # 时间重叠：重叠时不更新 prev_end，保留正确的结束时间
        if prev_end > 0 and start < prev_end:
            overlaps += 1
            if debug:
                prev_ls = line_ranges[i - 1][0] if line_ranges and i > 0 else 0
                prev_le = line_ranges[i - 1][1] if line_ranges and i > 0 else 0
                _ps = _ms_to_ts(prev_entry["start_ms"]) if prev_entry else "???"
                issues.append(
                    {
                        "type": "overlap",
                        "entry_index": idx,
                        "line_start": line_start,
                        "line_end": line_end,
                        "start_ms": start,
                        "end_ms": end,
                        "content": content_trunc,
                        "detail": (
                            f"与 #{prev_idx} 重叠"
                            f"（行 {prev_ls}\u223c{prev_le}，{_ps} 开始）"
                        ),
                    }
                )
            prev_end = max(prev_end, end)  # 取最大值，不丢失信息
        else:
            # 大段空白检测（非重叠时才检测）
            if prev_end > 0 and start - prev_end > MAX_GAP_MS:
                large_gaps += 1
                large_gap_entries.append(idx)
            prev_end = end

        # 时长过短
        if dur < MIN_SUB_DURATION_MS:
            too_short += 1
            if debug:
                issues.append(
                    {
                        "type": "too_short",
                        "entry_index": idx,
                        "line_start": line_start,
                        "line_end": line_end,
                        "start_ms": start,
                        "end_ms": end,
                        "content": content_trunc,
                        "detail": f"时长 {dur}ms < {MIN_SUB_DURATION_MS}ms",
                    }
                )

        # 单行过长
        for line_text in content.split("\n"):
            if len(line_text) > MAX_LINE_LENGTH:
                too_long_lines += 1
                if debug:
                    issues.append(
                        {
                            "type": "too_long_lines",
                            "entry_index": idx,
                            "line_start": line_start,
                            "line_end": line_end,
                            "start_ms": start,
                            "end_ms": end,
                            "content": content_trunc,
                            "detail": f"行{line_text[:30]}...({len(line_text)}字>{MAX_LINE_LENGTH})",
                        }
                    )

        # 阅读速度（CJK 字/秒，双语字幕更准确）
        if dur > 0:
            cjk_chars = len(CJK_RE.findall(content))
            if cjk_chars > 0:
                speed = cjk_chars / (dur / 1000.0)
            else:
                # 无 CJK 时退回到全字符统计
                chars = len(content.replace("\n", ""))
                speed = chars / (dur / 1000.0) if chars > 0 else 0
            if speed > MAX_READ_SPEED:
                fast_read += 1
                if debug:
                    char_info = (
                        f"CJK {cjk_chars} 字" if cjk_chars > 0 else f"全字符 {chars} 字"
                    )
                    issues.append(
                        {
                            "type": "fast_read",
                            "entry_index": idx,
                            "line_start": line_start,
                            "line_end": line_end,
                            "start_ms": start,
                            "end_ms": end,
                            "content": content_trunc,
                            "detail": (
                                f"时长 {dur}ms | 文本 {char_info} | 速度 {speed:.1f} 字/秒"
                            ),
                        }
                    )

        # 单条持续过长（> 7 秒且 ≤ 2 行）
        if dur > MAX_SUB_DURATION_MS and len(content.split("\n")) <= 2:
            single_long += 1
            if debug:
                issues.append(
                    {
                        "type": "single_long",
                        "entry_index": idx,
                        "line_start": line_start,
                        "line_end": line_end,
                        "start_ms": start,
                        "end_ms": end,
                        "content": content_trunc,
                        "detail": f"持续 {dur / 1000:.1f}s > {MAX_SUB_DURATION_MS / 1000}s",
                    }
                )

        prev_entry = e

    if gaps > 0:
        penalty = min(gaps, 10)
        item.score -= penalty
        item.deductions.append(f"序号不连续({gaps}处) -{penalty}")

    if missing > 0:
        penalty = min(missing * 2, 10)
        item.score -= penalty
        item.deductions.append(f"空内容条目({missing}处) -{penalty}")

    if inverted_ts > 0:
        penalty = min(inverted_ts * 5, 15)
        item.score -= penalty
        item.deductions.append(f"时间戳倒置({inverted_ts}处) -{penalty}")

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

    # 大段空白（> 30 秒，> 3 处），可能字幕不完整
    if large_gaps > 3:
        ai_flags.append("large_gaps")

    # 长句重复：同句 ≥ 15 字出现 ≥ 3 次
    text_counts: dict[str, list[int]] = {}
    for i, e in enumerate(entries):
        text = e["content"].replace("\n", " ").strip()
        if len(text) >= 15:
            if text not in text_counts:
                text_counts[text] = []
            text_counts[text].append(e["index"])
    if any(len(indices) >= 3 for indices in text_counts.values()):
        ai_flags.append("repeated_long_lines")
    # debug 模式下收集重复文本详情
    repeated_text_detail: list[dict] = []
    if debug:
        for text, indices in text_counts.items():
            if len(indices) >= 3:
                entry_details = []
                for idx in indices:
                    entry = next((e for e in entries if e["index"] == idx), None)
                    if entry:
                        e_i = entries.index(entry)
                        ls = line_ranges[e_i][0] if line_ranges else 0
                        entry_details.append(f"#{idx}(行{ls})")
                repeated_text_detail.append(
                    {
                        "text": text[:40],
                        "count": len(indices),
                        "entries": ", ".join(entry_details),
                    }
                )

    # 时间轴均匀度：帧间隔标准差 < 2500ms
    if len(entries) >= 10:
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

    if debug:
        debug_info = {
            "issues": issues,
            "repeated_lines": repeated_text_detail,
            "large_gap_entries": large_gap_entries[:10],
        }
        return ai_flags, debug_info

    return ai_flags
