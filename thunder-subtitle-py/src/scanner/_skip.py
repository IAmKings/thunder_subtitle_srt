"""跳过检查：决定是否跳过一部电影的下载"""

import os
from datetime import datetime

from ..types import ScanStatus, DryState
from ..ui import DIM, GREEN, RED, RESET, YELLOW


def _has_zh_prefix(filename: str) -> bool:
    """检查文件名是否包含 .zh. 标识"""
    return ".zh." in filename


def _find_dump_subtitle(movie_path: str) -> str | None:
    """查找 dump 模式下载的字幕文件（1.srt, 2.ass, ...）"""
    try:
        for fname in sorted(os.listdir(movie_path)):
            base, ext = os.path.splitext(fname)
            if base.isdigit() and ext.lower() in (".srt", ".ass", ".ssa", ".sub", ".vtt"):
                return fname
    except OSError:
        pass
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
        return False


def _check_skip(
    movie_path: str, movie_name: str, nfo, dry_run: bool = False,
    min_age_days: int = 0, force: bool = False, reset_fail: bool = False,
) -> tuple[str | None, str]:
    """
    检查是否应跳过该电影，返回 (跳过原因或None, dry_run_state)
    dry_state: need_download / need_review / reviewed_ok / reviewed_fail / skipped / ""
    """
    dry_state = ""

    # 审查失败处理
    reviewed_file = os.path.join(movie_path, ".reviewed")
    is_fail = _is_review_fail(reviewed_file)

    # reset-fail：清除审查失败标记 + 已拒绝指纹（最优先）
    if reset_fail and is_fail:
        if dry_run:
            print(f"{YELLOW}    ⚠ Would reset mark-fail → need review{RESET}")
        else:
            os.remove(reviewed_file)
            rejected = os.path.join(movie_path, ".rejected")
            if os.path.isfile(rejected):
                os.remove(rejected)
            print(f"{GREEN}    ✓ Mark-fail cleared, status reset{RESET}")
        is_fail = False

    # 审查失败硬跳过（force 模式可覆盖）
    if is_fail and not force:
        if dry_run:
            has_new_subs = bool(_find_dump_subtitle(movie_path))
            if has_new_subs:
                print(f"{YELLOW}    ⚠ Review FAILED but new subtitles exist — needs re-review{RESET}")
            else:
                print(f"{RED}    ✗ Review FAILED — find subtitles elsewhere{RESET}")
        return ("Review FAILED — find subtitles elsewhere", DryState.reviewed_fail if dry_run else DryState.reviewed_fail)

    # force 模式覆盖 mark-fail：下载但不重置状态
    if force and is_fail:
        print(f"{YELLOW}    ⚠ Force refresh: bypassing mark-fail (state kept){RESET}")

    # dry-run 时检查状态提示
    if dry_run:
        has_sub = bool(_existing_subtitle_file(movie_path, movie_name)) or nfo.has_chinese_subtitle
        if has_sub:
            if not os.path.isfile(reviewed_file):
                dry_state = DryState.need_review
                print(f"{YELLOW}    ⚠ Not yet reviewed — run: thunder-subtitle review{RESET}")
            else:
                dry_state = DryState.reviewed_ok
                print(f"{GREEN}    ✓ Reviewed{RESET}")
        else:
            dry_state = DryState.need_download
            print(f"{DIM}    ◇ No subtitles — will download{RESET}")

    if nfo.has_chinese_subtitle and not (force and is_fail):
        return ("NFO has Chinese subtitle tag", dry_state)

    # 发布日期检查：新片不满 min_age_days 天跳过
    if min_age_days > 0 and nfo.release_date:
        try:
            rd = datetime.strptime(nfo.release_date[:10], "%Y-%m-%d")  # noqa: DTZ007
            age = (datetime.now() - rd).days
            if age < min_age_days:
                return (f"Released {age}d ago (< {min_age_days}d), skip", ScanStatus.skipped)
        except (ValueError, IndexError):
            pass

    existing = _existing_subtitle_file(movie_path, movie_name)
    if existing and not (force and is_fail):
        if dry_run and not _has_zh_prefix(existing):
            print(f"{YELLOW}    ⚠ {existing} lacks .zh prefix, may not be Chinese subtitle{RESET}")
        return (f"{existing} already exists", dry_state)

    return (None, DryState.need_download if dry_run else "")
