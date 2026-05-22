from __future__ import annotations
"""字幕审查器 — 深度检测已下载字幕文件质量，给出百分制评分"""

import os
from datetime import datetime

from ..scanner import scan_movie_dirs
from ..models import ReviewState, ReviewQuality
from ..ui import BOLD, DIM, GREEN, RED, RESET, YELLOW, CYAN
from ..utils import matches

from ..scanner._skip import _existing_subtitle_file
from ..utils import parse_nfo

from ._marker import _batch_mark, _is_reviewed
from ._review import _find_all_subtitle_files, _review_one_file, ReviewItem
from ._output import _print_review_item, _print_review_summary, _write_review_log, _write_review_summary

__all__ = ["mark_directory", "review_directory", "ReviewItem"]


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
    has_op = mark or unmark or mark_all or mark_path or unmark_path or mark_fail or mark_fail_path
    if not has_op:
        return

    mark_status = ReviewState.fail if (mark_fail or mark_fail_path) else ReviewState.ok

    # mark-fail + keyword → 重新绑定
    if mark_fail:
        mark, mark_status = mark_fail, ReviewState.fail

    # ---- 精确路径操作 ----
    if mark_fail_path:
        full = os.path.join(base_dir, mark_fail_path) if not os.path.isabs(mark_fail_path) else mark_fail_path
        if os.path.isdir(full):
            _batch_mark([full], True, status=ReviewState.fail)
        else:
            print(f"{RED}  ✗ Directory not found: {mark_fail_path}{RESET}\n")
        return

    if mark_path:
        full = os.path.join(base_dir, mark_path) if not os.path.isabs(mark_path) else mark_path
        if os.path.isdir(full):
            _batch_mark([full], True, status=mark_status)
        else:
            print(f"{RED}  ✗ Directory not found: {mark_path}{RESET}\n")
        return

    if unmark_path:
        full = os.path.join(base_dir, unmark_path) if not os.path.isabs(unmark_path) else unmark_path
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
            d for d in movie_dirs
            if any(matches(f, os.path.basename(d)) for f in name_filters)
        ]

    if not movie_dirs:
        kw = ", ".join(name_filters) if name_filters else ""
        tag = f" matching [{kw}]" if kw else ""
        print(f"{DIM}  No movie directories{tag} found.{RESET}\n")
        return []

    if name_filters:
        print(f"{BOLD}\n  Reviewing {len(movie_dirs)} movie(s) matching [{', '.join(name_filters)}]{RESET}\n")
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
            has_sub = bool(_existing_subtitle_file(movie_path, movie_name)) or nfo.has_chinese_subtitle
        except Exception:
            has_sub = bool(_existing_subtitle_file(movie_path, movie_name))

        if not has_sub:
            print(f"{DIM}    (no subtitle files found){RESET}")
            continue

        # 已审查通过 → 跳过
        reviewed_file = os.path.join(movie_path, ".reviewed")
        if os.path.isfile(reviewed_file):
            try:
                with open(reviewed_file, "r", encoding="utf-8") as f:
                    if f.read().strip().lower() != "fail":
                        print(f"{DIM}    ✓ Already reviewed — skip{RESET}")
                        continue
            except OSError:
                pass

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
