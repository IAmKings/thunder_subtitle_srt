"""
Utility functions for Thunder Subtitle Python CLI
"""

import re


def parse_duration(duration_str: str) -> int:
    """
    解析人类可读的时长字符串，返回毫秒数
    支持格式: 1h, 30m, 45s, 1h30m, 2h30m20s
    """
    trimmed = duration_str.strip().lower()
    if not trimmed:
        raise ValueError("Duration string cannot be empty")

    total_ms = 0
    has_match = False

    # 匹配小时
    hours_match = re.search(r"(\d+)h", trimmed)
    if hours_match:
        total_ms += int(hours_match.group(1)) * 3600000
        has_match = True

    # 匹配分钟
    minutes_match = re.search(r"(\d+)m", trimmed)
    if minutes_match:
        total_ms += int(minutes_match.group(1)) * 60000
        has_match = True

    # 匹配秒
    seconds_match = re.search(r"(\d+)s", trimmed)
    if seconds_match:
        total_ms += int(seconds_match.group(1)) * 1000
        has_match = True

    if not has_match:
        raise ValueError(
            f'Invalid duration format: "{duration_str}". '
            f"Expected format like 1h30m, 90m, 45s"
        )

    return total_ms


def format_duration(ms: int) -> str:
    """将毫秒转为可读的时长字符串"""
    if ms == 0:
        return "Unknown"

    seconds = ms // 1000
    minutes = seconds // 60
    remaining_seconds = seconds % 60

    if minutes > 0:
        return f"{minutes}m {remaining_seconds}s"
    return f"{remaining_seconds}s"
