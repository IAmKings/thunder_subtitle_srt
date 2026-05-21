from __future__ import annotations
"""跳过检查：决定是否跳过一部电影的下载"""

import logging
import os
from datetime import datetime

from ..models import ScanStatus, DryState
from ..ui import DIM, GREEN, RED, RESET, YELLOW

logger = logging.getLogger(__name__)

# 字幕文件扩展名全集
_SUB_EXTS = (".srt", ".ass", ".ssa", ".sub", ".vtt")

# 中文字幕标识前缀
_ZH_PREFIX = ".zh."


def _has_zh_prefix(filename: str) -> bool:
    """检查文件名是否包含 .zh. 标识"""
    return _ZH_PREFIX in filename


def _find_dump_subtitle(movie_path: str) -> str | None:
    """查找 dump 模式下载的字幕文件（1.srt, 2.ass, ...）"""
    try:
        for fname in sorted(os.listdir(movie_path)):
            base, ext = os.path.splitext(fname)
            if base.isdigit() and ext.lower() in _SUB_EXTS:
                return fname
    except OSError:
        logger.warning("无法扫描目录查找 dump 字幕: %s", movie_path)
    return None


def _existing_subtitle_file(movie_path: str, movie_name: str) -> str | None:
    """检查目录中是否已有字幕文件（含标准命名和dump数字命名）"""
    # 标准命名：{movie_name}{.zh}.{ext}
    for ext in ("zh.srt", "srt", "zh.ass", "ass", "zh.ssa", "ssa", "zh.sub", "sub", "zh.vtt", "vtt"):
        path = os.path.join(movie_path, f"{movie_name}.{ext}")
        if os.path.isfile(path):
            return f"{movie_name}.{ext}"
    # dump 数字命名：1.srt, 2.ass, ...
    return _find_dump_subtitle(movie_path)


def _is_review_fail(reviewed_file: str) -> bool:
    """检查 .reviewed 文件是否标记为审查不及格"""
    try:
        with open(reviewed_file, "r", encoding="utf-8") as f:
            return f.read().strip().lower() == "fail"
    except OSError:
        logger.warning("无法读取 .reviewed 文件: %s", reviewed_file)
        return False


# ---- _check_skip 拆分后的子函数 ----

def _handle_reset_fail(movie_path: str, dry_run: bool) -> bool:
    """处理 reset-fail：清除审查失败标记，返回是否执行了重置"""
    reviewed_file = os.path.join(movie_path, ".reviewed")
    is_fail = _is_review_fail(reviewed_file)
    if not is_fail:
        return False

    if dry_run:
        print(f"{YELLOW}    ⚠ Would reset mark-fail → need review{RESET}")
    else:
        os.remove(reviewed_file)
        rejected = os.path.join(movie_path, ".rejected")
        if os.path.isfile(rejected):
            os.remove(rejected)
        print(f"{GREEN}    ✓ Mark-fail cleared, status reset{RESET}")
    return True


def _check_fail_skip(movie_path: str, force: bool, dry_run: bool) -> tuple[str, str] | None:
    """检查审查失败导致的跳过，返回 (reason, dry_state) 或 None"""
    reviewed_file = os.path.join(movie_path, ".reviewed")
    is_fail = _is_review_fail(reviewed_file)

    if not is_fail:
        return None

    if force:
        # force 模式覆盖 mark-fail：下载但不重置状态
        print(f"{YELLOW}    ⚠ Force refresh: bypassing mark-fail (state kept){RESET}")
        return None

    # 硬跳过
    if dry_run:
        has_new_subs = bool(_find_dump_subtitle(movie_path))
        if has_new_subs:
            print(f"{YELLOW}    ⚠ Review FAILED but new subtitles exist — needs re-review{RESET}")
        else:
            print(f"{RED}    ✗ Review FAILED — find subtitles elsewhere{RESET}")
    return ("Review FAILED — find subtitles elsewhere", DryState.reviewed_fail)


def _get_dry_state(movie_path: str, movie_name: str, nfo) -> str:
    """dry-run 模式下确定电影的字幕状态"""
    review_file = os.path.join(movie_path, ".reviewed")
    has_sub = bool(_existing_subtitle_file(movie_path, movie_name)) or nfo.has_chinese_subtitle

    if not has_sub:
        print(f"{DIM}    ◇ No subtitles — will download{RESET}")
        return DryState.need_download

    if not os.path.isfile(review_file):
        print(f"{YELLOW}    ⚠ Not yet reviewed — run: thunder-subtitle review{RESET}")
        return DryState.need_review

    print(f"{GREEN}    ✓ Reviewed{RESET}")
    return DryState.reviewed_ok


def _check_nfo_skip(nfo, force: bool, is_fail: bool) -> str | None:
    """检查 NFO 中文字幕标记，返回跳过原因或 None"""
    if nfo.has_chinese_subtitle and not (force and is_fail):
        return "NFO has Chinese subtitle tag"
    return None


def _check_release_age(nfo, min_age_days: int) -> str | None:
    """检查发布日期是否满足最小年龄要求，返回跳过原因或 None"""
    if min_age_days <= 0 or not nfo.release_date:
        return None
    try:
        rd = datetime.strptime(nfo.release_date[:10], "%Y-%m-%d")  # noqa: DTZ007
        age = (datetime.now() - rd).days
        if age < min_age_days:
            return f"Released {age}d ago (< {min_age_days}d), skip"
    except (ValueError, IndexError):
        pass
    return None


def _check_existing_skip(
    movie_path: str, movie_name: str, force: bool, is_fail: bool, dry_run: bool,
) -> str | None:
    """检查是否已有字幕文件，返回跳过原因或 None"""
    existing = _existing_subtitle_file(movie_path, movie_name)
    if not existing:
        return None
    if force and is_fail:
        return None
    if dry_run and not _has_zh_prefix(existing):
        print(f"{YELLOW}    ⚠ {existing} lacks .zh prefix, may not be Chinese subtitle{RESET}")
    return f"{existing} already exists"


# ---- 主入口 ----

def _check_skip(
    movie_path: str, movie_name: str, nfo, dry_run: bool = False,
    min_age_days: int = 0, force: bool = False, reset_fail: bool = False,
) -> tuple[str | None, str]:
    """
    检查是否应跳过该电影，返回 (跳过原因或None, dry_run_state)
    dry_state: need_download / need_review / reviewed_ok / reviewed_fail / skipped / ""
    """
    # reset-fail：清除审查失败标记（最优先）
    if reset_fail:
        _handle_reset_fail(movie_path, dry_run)

    # 审查失败硬跳过
    fail_result = _check_fail_skip(movie_path, force, dry_run)
    if fail_result:
        return fail_result

    # dry-run 状态判定
    dry_state = _get_dry_state(movie_path, movie_name, nfo) if dry_run else ""

    # 重新读取 is_fail（可能已被 reset-fail 清除）
    reviewed_file = os.path.join(movie_path, ".reviewed")
    is_fail = _is_review_fail(reviewed_file)

    # NFO 中文标记
    reason = _check_nfo_skip(nfo, force, is_fail)
    if reason:
        return (reason, dry_state)

    # 发布日期检查
    reason = _check_release_age(nfo, min_age_days)
    if reason:
        return (reason, ScanStatus.skipped)

    # 已有字幕文件检查
    reason = _check_existing_skip(movie_path, movie_name, force, is_fail, dry_run)
    if reason:
        return (reason, dry_state)

    return (None, DryState.need_download if dry_run else "")
