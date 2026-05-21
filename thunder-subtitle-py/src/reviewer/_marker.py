from __future__ import annotations
"""标记操作：审查状态标记/取消标记/归档"""

import logging
import os
from datetime import datetime

from ..models import ReviewState, ReviewQuality
from ..ui import BOLD, GREEN, RED, RESET, YELLOW

logger = logging.getLogger(__name__)

REVIEWED_FILE = ".reviewed"


def _is_reviewed(movie_path: str) -> tuple[str | None, str]:
    """
    检查电影审查状态，返回 (状态, 日期字符串)
    状态: None=未审查, ReviewState.ok=审查通过, ReviewState.fail=审查不及格
    """
    rf = os.path.join(movie_path, REVIEWED_FILE)
    if not os.path.isfile(rf):
        return None, ""

    try:
        mtime = os.path.getmtime(rf)
        dt = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d")
    except OSError:
        logger.warning("无法读取文件修改时间: %s", rf)
        dt = ""

    # 读取状态：空文件或 ReviewState.ok = 通过，ReviewState.fail = 不及格
    try:
        with open(rf, "r", encoding="utf-8") as f:
            content = f.read().strip().lower()
    except OSError:
        logger.warning("无法读取审查状态文件: %s", rf)
        content = ""
    status = ReviewState.fail if content == "fail" else ReviewState.ok
    return status, dt


def _batch_mark(movie_dirs: list[str], mark: bool, keyword: str = "", status: str = ReviewQuality.ok) -> None:
    """批量标记/取消标记，status: ok=通过, fail=不及格"""
    action_map = {
        (True, ReviewQuality.ok): "Marked",
        (True, ReviewQuality.fail): "Marked as FAIL",
        (False, ""): "Unmarked",
    }
    action = action_map.get((mark, status), "Updated")
    kw_tag = f" matching \"{keyword}\"" if keyword else "s"
    print(f"{BOLD}\n  {action} {len(movie_dirs)} movie{kw_tag}{RESET}\n")
    for d in movie_dirs:
        rf = os.path.join(d, REVIEWED_FILE)
        name = os.path.basename(d)
        if mark:
            try:
                content = "fail" if status == ReviewState.fail else ""
                with open(rf, "w", encoding="utf-8") as f:
                    if content:
                        f.write(content)
                # mark-fail：归档 .dumped → .rejected
                if status == ReviewState.fail:
                    _archive_dumped(d)
                tag = f"{RED}✗ FAIL{RESET}" if status == ReviewState.fail else f"{GREEN}✓{RESET}"
                print(f"  {tag} {name}")
            except OSError as e:
                print(f"  {RED}✗{RESET} {name} — {e}")
        else:
            if os.path.isfile(rf):
                os.remove(rf)
            # 同时清理 .rejected
            _cleanup_rejected(d)
            print(f"  {YELLOW}-{RESET} {name}")
    print()


def _archive_dumped(movie_path: str) -> None:
    """mark-fail 时：合并 .dumped 到 .rejected（不覆盖旧拒绝记录）"""
    dumped = os.path.join(movie_path, ".dumped")
    rejected = os.path.join(movie_path, ".rejected")
    if not os.path.isfile(dumped):
        return
    try:
        # 读取已有拒绝记录
        existing: set[str] = set()
        if os.path.isfile(rejected):
            with open(rejected, "r", encoding="utf-8") as f:
                existing = {line.strip() for line in f if line.strip()}
        # 合并新指纹
        with open(dumped, "r", encoding="utf-8") as f:
            for line in f:
                gcid = line.strip()
                if gcid:
                    existing.add(gcid)
        # 写回
        with open(rejected, "w", encoding="utf-8") as f:
            f.write("\n".join(sorted(existing)) + "\n")
        # 清理 .dumped
        os.remove(dumped)
    except OSError:
        logger.warning("无法归档 .dumped 文件: %s", dumped)


def _cleanup_rejected(movie_path: str) -> None:
    """unmark 时：清理 .rejected"""
    rejected = os.path.join(movie_path, ".rejected")
    if os.path.isfile(rejected):
        try:
            os.remove(rejected)
        except OSError:
            logger.warning("无法清理 .rejected 文件: %s", rejected)
