"""字幕审查器 — 深度检测已下载字幕文件质量，给出百分制评分"""

import os

from ..scanner import scan_movie_dirs
from ..ui import BOLD, DIM, GREEN, RED, RESET, YELLOW, CYAN

from ._marker import _batch_mark, _is_reviewed
from ._review import _find_all_subtitle_files, _review_one_file, ReviewItem
from ._output import _print_review_item, _print_review_summary, _write_review_log, _write_review_summary

__all__ = ["review_directory", "ReviewItem"]


def review_directory(
    base_dir: str,
    name_filters: list[str] | None = None,
    log: bool = False,
    mark: str | None = None,
    unmark: str | None = None,
    mark_all: bool = False,
    **kwargs: str | None,
) -> list[ReviewItem] | None:
    """审查目录下所有字幕文件（或执行标记操作）"""
    from ..types import ReviewState, ReviewQuality

    # ---- 标记操作 ----
    mark_path: str | None = kwargs.get("mark_path")
    unmark_path: str | None = kwargs.get("unmark_path")
    mark_fail: str | None = kwargs.get("mark_fail")
    mark_fail_path: str | None = kwargs.get("mark_fail_path")

    if mark or unmark or mark_all or mark_path or unmark_path or mark_fail or mark_fail_path:
        mark_status = ReviewState.fail if (mark_fail or mark_fail_path) else ReviewState.ok
        if mark_fail:
            mark, mark_status = mark_fail, ReviewState.fail
        # 精确路径操作 - fail 路径
        if mark_fail_path:
            full = os.path.join(base_dir, mark_fail_path) if not os.path.isabs(mark_fail_path) else mark_fail_path
            if os.path.isdir(full):
                _batch_mark([full], True, status=ReviewState.fail)
            else:
                print(f"{RED}  ✗ Directory not found: {mark_fail_path}{RESET}\n")
            return None
        # 精确路径操作（相对 base_dir）
        if mark_path:
            full = os.path.join(base_dir, mark_path) if not os.path.isabs(mark_path) else mark_path
            if os.path.isdir(full):
                _batch_mark([full], True, status=mark_status)
            else:
                print(f"{RED}  ✗ Directory not found: {mark_path}{RESET}\n")
            return None
        if unmark_path:
            full = os.path.join(base_dir, unmark_path) if not os.path.isabs(unmark_path) else unmark_path
            if os.path.isdir(full):
                _batch_mark([full], False)
            else:
                print(f"{RED}  ✗ Directory not found: {unmark_path}{RESET}\n")
            return None

        # 关键词模糊匹配
        movie_dirs = scan_movie_dirs(base_dir)
        if mark_all:
            _batch_mark(movie_dirs, True, status=mark_status)
        elif mark or mark_fail:
            kw = mark or mark_fail or ""
            filtered = [d for d in movie_dirs if kw.lower() in os.path.basename(d).lower()]
            _batch_mark(filtered, True, kw, status=mark_status)
        elif unmark:
            filtered = [d for d in movie_dirs if unmark.lower() in os.path.basename(d).lower()]
            _batch_mark(filtered, False, unmark)
        return None

    # ---- 审查模式 ----
    movie_dirs = scan_movie_dirs(base_dir)
    if name_filters:
        movie_dirs = [
            d for d in movie_dirs
            if any(f.lower() in os.path.basename(d).lower() for f in name_filters)
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
        from datetime import datetime
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_path = os.path.join(base_dir, f"review_{ts}.log")

    items: list[ReviewItem] = []
    for i, movie_path in enumerate(movie_dirs, 1):
        movie_name = os.path.basename(movie_path)
        actor_name = os.path.basename(os.path.dirname(movie_path))
        label = f"{actor_name}/{movie_name}"
        print(f"{YELLOW}  [{i}/{len(movie_dirs)}]{RESET} {BOLD}{label}{RESET}")

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
