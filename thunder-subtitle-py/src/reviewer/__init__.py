"""字幕审查器 — 深度检测已下载字幕文件质量，给出百分制评分"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import datetime

from ..scanner import scan_movie_dirs
from ..models import ReviewState
from ..ui import BOLD, DIM, RED, RESET, YELLOW
from ..utils import matches

from ..scanner import _existing_subtitle_file, _find_dump_subtitle
from ..utils import parse_nfo

from ._marker import _batch_mark, _is_reviewed
from ._review import _find_all_subtitle_files, _review_one_file, ReviewItem
from ._output import (
    _print_review_item,
    _print_review_summary,
    _write_review_log,
    _write_review_summary,
)

__all__ = [
    "mark_directory",
    "review_directory",
    "list_review_movies",
    "review_subtitle_file",
    "MovieEntry",
    "ReviewItem",
]


@dataclass
class MovieEntry:
    """轻量电影条目 — 仅文件系统操作，无深审"""

    path: str
    name: str
    sub_files: list[str] = field(default_factory=list)
    review_status: str = "not_reviewed"
    review_date: str = ""
    duration_seconds: int = 0  # NFO 片长（秒），0 表示未知


def mark_directory(
    base_dir: str,
    mark: str | None = None,
    unmark: str | None = None,
    mark_all: bool = False,
    mark_path: str | None = None,
    unmark_path: str | None = None,
    mark_fail: str | None = None,
    mark_fail_path: str | None = None,
) -> None:
    """标记/取消标记电影目录的审查状态

    支持精确路径和关键词模糊匹配两种方式。
    """
    has_op = (
        mark
        or unmark
        or mark_all
        or mark_path
        or unmark_path
        or mark_fail
        or mark_fail_path
    )
    if not has_op:
        return

    mark_status = ReviewState.fail if (mark_fail or mark_fail_path) else ReviewState.ok

    # mark-fail + keyword → 重新绑定
    if mark_fail:
        mark, mark_status = mark_fail, ReviewState.fail

    # ---- 精确路径操作 ----
    if mark_fail_path:
        full = (
            os.path.join(base_dir, mark_fail_path)
            if not os.path.isabs(mark_fail_path)
            else mark_fail_path
        )
        if os.path.isdir(full):
            _batch_mark([full], True, status=ReviewState.fail)
        else:
            print(f"{RED}  ✗ Directory not found: {mark_fail_path}{RESET}\n")
        return

    if mark_path:
        full = (
            os.path.join(base_dir, mark_path)
            if not os.path.isabs(mark_path)
            else mark_path
        )
        if os.path.isdir(full):
            _batch_mark([full], True, status=mark_status)
        else:
            print(f"{RED}  ✗ Directory not found: {mark_path}{RESET}\n")
        return

    if unmark_path:
        full = (
            os.path.join(base_dir, unmark_path)
            if not os.path.isabs(unmark_path)
            else unmark_path
        )
        if os.path.isdir(full):
            _batch_mark([full], False)
        else:
            print(f"{RED}  ✗ Directory not found: {unmark_path}{RESET}\n")
        return

    # ---- 关键词模糊匹配 ----
    movie_dirs = scan_movie_dirs(base_dir)
    if mark_all:
        _batch_mark(movie_dirs, True, status=mark_status)
    elif mark:
        filtered = [d for d in movie_dirs if matches(mark, os.path.basename(d))]
        _batch_mark(filtered, True, mark, status=mark_status)
    elif unmark:
        filtered = [d for d in movie_dirs if matches(unmark, os.path.basename(d))]
        _batch_mark(filtered, False, unmark)


def review_directory(
    base_dir: str,
    name_filters: list[str] | None = None,
    log: bool = False,
) -> list[ReviewItem]:
    """审查目录下所有字幕文件质量，返回审查结果列表"""
    movie_dirs = scan_movie_dirs(base_dir)
    if name_filters:
        movie_dirs = [
            d
            for d in movie_dirs
            if any(matches(f, os.path.basename(d)) for f in name_filters)
        ]

    if not movie_dirs:
        kw = ", ".join(name_filters) if name_filters else ""
        tag = f" matching [{kw}]" if kw else ""
        print(f"{DIM}  No movie directories{tag} found.{RESET}\n")
        return []

    if name_filters:
        print(
            f"{BOLD}\n  Reviewing {len(movie_dirs)} movie(s) matching [{', '.join(name_filters)}]{RESET}\n"
        )
    else:
        print(f"{BOLD}\n  Reviewing {len(movie_dirs)} movie(s){RESET}\n")

    log_path = ""
    if log:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_path = os.path.join(base_dir, f"review_{ts}.log")

    items: list[ReviewItem] = []
    for i, movie_path in enumerate(movie_dirs, 1):
        movie_name = os.path.basename(movie_path)
        actor_name = os.path.basename(os.path.dirname(movie_path))
        label = f"{actor_name}/{movie_name}"
        print(f"{YELLOW}  [{i}/{len(movie_dirs)}]{RESET} {BOLD}{label}{RESET}")

        # 轻量 dry_state 检查：无字幕或已审查通过 → 跳过
        try:
            nfo = parse_nfo(os.path.join(movie_path, "movie.nfo"))
            has_sub = (
                bool(_existing_subtitle_file(movie_path, movie_name))
                or nfo.has_chinese_subtitle
            )
        except Exception:
            has_sub = bool(_existing_subtitle_file(movie_path, movie_name))

        if not has_sub:
            print(f"{DIM}    (no subtitle files found){RESET}")
            continue

        # 已审查过 → 检查是否需要在验证页显示
        reviewed_file = os.path.join(movie_path, ".reviewed")
        if os.path.isfile(reviewed_file):
            try:
                with open(reviewed_file, "r", encoding="utf-8") as f:
                    content = f.read().strip().lower()
            except OSError:
                content = ""
            if content != "fail":
                # 审查通过 → 跳过
                print(f"{DIM}    ✓ Already reviewed — skip{RESET}")
                continue
            # 审查失败：只有存在 dump 数字字幕时才需要重审
            if not _find_dump_subtitle(movie_path):
                print(
                    f"{DIM}    ✗ Review FAILED — no new subtitles to re-review{RESET}"
                )
                continue

        sub_files = _find_all_subtitle_files(movie_path, movie_name)
        if not sub_files:
            print(f"{DIM}    (no subtitle files found){RESET}")
            continue

        # 检查人工审查标记
        review_status, review_date = _is_reviewed(movie_path)
        if review_status == ReviewState.fail:
            print(f"{RED}    ✗ Review FAILED ({review_date}){RESET}")
        elif review_status == ReviewState.ok:
            print(f"{DIM}    Reviewed: {review_date}{RESET}")

        for filepath, filename in sub_files:
            item = _review_one_file(filepath, filename, movie_path, movie_name)
            item.reviewed = review_status is not None
            item.reviewed_date = review_date
            items.append(item)
            _print_review_item(item)

            if log_path:
                _write_review_log(log_path, item)

    _print_review_summary(items)

    if log_path:
        _write_review_summary(log_path, items)
        print(f"{DIM}  Report saved: {log_path}{RESET}\n")

    return items


# ---- count_only 轻量辅助函数 ----

_SUB_EXTS_SET = frozenset({".srt", ".ass", ".ssa", ".sub", ".vtt"})


def _check_review_status_fast(movie_path: str) -> str:
    """单次读取 .reviewed 状态 — 不读日期，不复读，不构建对象。"""
    reviewed_file = os.path.join(movie_path, ".reviewed")
    if not os.path.isfile(reviewed_file):
        return "not_reviewed"
    try:
        with open(reviewed_file, "r", encoding="utf-8") as f:
            content = f.read().strip().lower()
    except OSError:
        return "not_reviewed"
    return "fail" if content == "fail" else "ok"


def _has_any_subtitle(movie_path: str, movie_name: str) -> bool:
    """Early-exit os.scandir：目录下是否有匹配电影名的字幕文件。"""
    try:
        for entry in os.scandir(movie_path):
            if not entry.is_file():
                continue
            base, ext = os.path.splitext(entry.name)
            if ext.lower() not in _SUB_EXTS_SET:
                continue
            if (base == movie_name
                    or base.startswith(movie_name + ".")
                    or base.startswith(movie_name + "-")
                    or base.isdigit()):
                return True
    except OSError:
        pass
    return False


def _has_dump_subtitle_fast(movie_path: str) -> bool:
    """Early-exit os.scandir：是否有 dump 数字命名字幕。"""
    try:
        for entry in os.scandir(movie_path):
            if not entry.is_file():
                continue
            base, ext = os.path.splitext(entry.name)
            if base.isdigit() and ext.lower() in _SUB_EXTS_SET:
                return True
    except OSError:
        pass
    return False


def list_review_movies(
    base_dir: str,
    name_filter: str | None = None,
    parse_duration: bool = False,
    count_only: bool = False,
) -> list[MovieEntry]:
    """
    轻量发现待审查电影 — 只做文件名收集和 .reviewed 检查，不做 encoding/SRT/CJK 深审。

    Args:
        parse_duration: 是否解析 NFO 获取 duration_seconds（计数场景无需此开销）
        count_only: 纯计数模式 — os.scandir early-exit，不构建字幕列表，
                    不重复读 .reviewed，不读日期/NFO。返回的 MovieEntry 仅含
                    path/name/review_status。

    替代 review_directory 用于验证页电影列表。
    """
    movie_dirs = scan_movie_dirs(base_dir)
    if name_filter:
        movie_dirs = [
            d for d in movie_dirs if matches(name_filter, os.path.basename(d))
        ]

    entries: list[MovieEntry] = []
    for movie_path in movie_dirs:
        movie_name = os.path.basename(movie_path)

        # --- count_only 轻量路径：只做计数所需的最小 I/O ---
        if count_only:
            review_status = _check_review_status_fast(movie_path)
            if review_status == "ok":
                continue
            if review_status == "not_reviewed" and not _has_any_subtitle(movie_path, movie_name):
                continue
            if review_status == "fail" and not _has_dump_subtitle_fast(movie_path):
                continue
            entries.append(MovieEntry(
                path=movie_path, name=movie_name,
                sub_files=[], review_status=review_status,
            ))
            continue

        # 跳过无字幕的
        sub_files = _find_all_subtitle_files(movie_path, movie_name)
        if not sub_files:
            continue

        sub_names = [fname for _, fname in sub_files]

        # 检查 .reviewed 状态
        review_status = "not_reviewed"
        review_date = ""
        reviewed_file = os.path.join(movie_path, ".reviewed")
        if os.path.isfile(reviewed_file):
            try:
                with open(reviewed_file, "r", encoding="utf-8") as f:
                    content = f.read().strip().lower()
            except OSError:
                content = ""
            if content == "fail":
                # 纯 fail 无 dump 字幕 → 跳过（无重审意义）
                if not _find_dump_subtitle(movie_path):
                    continue
                review_status = "fail"
            else:
                # 审查通过 → 跳过
                continue
            # 读取审查日期
            _, review_date = _is_reviewed(movie_path)

        # 读取 NFO 获取片长（仅 parse_duration=True 时，计数场景跳过）
        duration_seconds = 0
        if parse_duration:
            nfo_path = os.path.join(movie_path, "movie.nfo")
            if os.path.isfile(nfo_path):
                try:
                    nfo = parse_nfo(nfo_path)
                    duration_seconds = nfo.duration_seconds
                except Exception:
                    pass

        entries.append(
            MovieEntry(
                path=movie_path,
                name=movie_name,
                sub_files=sub_names,
                review_status=review_status,
                review_date=review_date,
                duration_seconds=duration_seconds,
            )
        )

    return entries


def review_subtitle_file(
    filepath: str, filename: str, movie_path: str, movie_name: str
) -> ReviewItem:
    """按需深审单个字幕文件（编码+SRT+CJK），用于验证页字幕详情

    自动读取 NFO 片长和 mt 元数据传递到评审函数。
    """
    # 读取 NFO 片长
    nfo_duration_seconds = 0
    nfo_path = os.path.join(movie_path, "movie.nfo")
    if os.path.isfile(nfo_path):
        try:
            nfo = parse_nfo(nfo_path)
            nfo_duration_seconds = nfo.duration_seconds
        except Exception:
            pass

    # 读取 mt 元数据
    mt = 0
    mt_path = filepath + ".mt"
    if os.path.isfile(mt_path):
        try:
            with open(mt_path, "r", encoding="utf-8") as f:
                mt = int(f.read().strip())
        except (OSError, ValueError):
            pass

    item = _review_one_file(
        filepath,
        filename,
        movie_path,
        movie_name,
        nfo_duration_seconds=nfo_duration_seconds,
        mt=mt,
    )
    review_status, review_date = _is_reviewed(movie_path)
    item.reviewed = review_status is not None
    item.reviewed_date = review_date
    return item
