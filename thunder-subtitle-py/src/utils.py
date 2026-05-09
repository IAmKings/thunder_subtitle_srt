"""
Utility functions for Thunder Subtitle Python CLI
"""

import logging
import os
import re
import xml.etree.ElementTree as ET
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

# CJK 统一表意文字范围 (U+4E00 – U+9FFF)
CJK_RE = re.compile(r"[\u4e00-\u9fff]")

logger = logging.getLogger(__name__)


@dataclass
class NfoInfo:
    """movie.nfo 解析结果"""
    duration_seconds: int = 0
    has_chinese_subtitle: bool = False
    release_date: str = ""  # YYYY-MM-DD


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

    total_seconds = ms // 1000
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60

    parts = []
    if hours > 0:
        parts.append(f"{hours}h")
    if minutes > 0 or hours > 0:
        parts.append(f"{minutes}m")
    parts.append(f"{seconds}s")
    return " ".join(parts)


def seconds_to_duration_str(total_seconds: int) -> str:
    """将秒数转为人类可读的时长参数格式（用于 --max-duration）"""
    if total_seconds <= 0:
        return ""

    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60

    parts = []
    if hours > 0:
        parts.append(f"{hours}h")
    if minutes > 0:
        parts.append(f"{minutes}m")
    if seconds > 0 or not parts:
        parts.append(f"{seconds}s")

    return "".join(parts)


# ---- NFO 解析 ----

def parse_nfo(nfo_path: str) -> NfoInfo:
    """解析 movie.nfo XML 文件，提取时长和中文状态"""
    tree = ET.parse(nfo_path)
    root = tree.getroot()
    info = NfoInfo()

    # durationinseconds：fileinfo > streamdetails > video > durationinseconds
    video = _find_elem(root, (".//fileinfo", "streamdetails", "video"))
    if video is not None:
        dur_elem = video.find("durationinseconds")
        if dur_elem is not None and dur_elem.text:
            try:
                info.duration_seconds = int(dur_elem.text.strip())
            except (ValueError, TypeError):
                info.duration_seconds = 0

    # releasedate（年-月-日格式）
    rd = root.find("releasedate")
    if rd is not None and rd.text:
        info.release_date = rd.text.strip()

    # 检查是否已有中文字幕标记
    for elem in root.iter():
        if elem.text and "中文字幕" in elem.text:
            info.has_chinese_subtitle = True
            break

    return info


def matches(needle: str, haystack: str) -> bool:
    """不区分大小写的子串匹配"""
    return needle.lower() in haystack.lower()


def _find_elem(parent, tags: tuple[str, ...]):
    """按层级路径查找 XML 元素"""
    node = parent
    for tag in tags:
        if node is None:
            return None
        node = node.find(tag)
    return node


# ---- 通用文件/数据工具 ----


def filter_by_duration(subtitles: list[Any], max_duration_ms: int, filter_fn: Callable[[list[Any], int], list[Any]]) -> list[Any]:
    """按时长筛选字幕，同时保留 duration=0（无时长信息）的字幕"""
    with_dur = [s for s in subtitles if s.duration > 0]
    without_dur = [s for s in subtitles if s.duration == 0]
    return filter_fn(with_dur, max_duration_ms) + without_dur


def load_gcid_file(filepath: str) -> set[str]:
    """加载 GCID 文件（每行一个 ID），返回集合"""
    if not os.path.isfile(filepath):
        return set()
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return {line.strip() for line in f if line.strip()}
    except OSError:
        logger.warning("无法读取 GCID 文件: %s", filepath)
        return set()


def clear_file(filepath: str) -> bool:
    """清空文件内容（用于重置 .dumped 等），返回是否成功"""
    try:
        open(filepath, "w").close()
        return True
    except OSError:
        logger.warning("无法清空文件: %s", filepath)
        return False
