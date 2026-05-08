"""扫描循环：串行/并行执行，过滤器，进度管理"""

import os
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

from ..config import Config
from ..api import SubtitleApiClient
from ..types import ScanStatus
from ..ui import BOLD, DIM, GREEN, RED, RESET, YELLOW, BOLD_CYAN
from ..utils import matches

from ._processor import ScanResult, _process_one_movie
from ._io import _save_progress, _write_log, _write_log_summary, _print_scan_summary


def process_scanned_movies(
    base_dir: str,
    dry_run: bool = False,
    name_filters: list[str] | None = None,
    config: Config | None = None,
    resume: bool = False,
    log: bool = False,
    min_age_days: int = 0,
    dump_mode: bool = False,
    force: bool = False,
    reset_fail: bool = False,
    parallel: int = 1,
) -> list[ScanResult]:
    """扫描并处理所有电影目录（parallel>1 时并发下载）"""
    from ._dir import scan_movie_dirs

    if config is None:
        config = Config.load()

    log_path = ""
    if log:
        from datetime import datetime
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_path = os.path.join(base_dir, f"scan_{ts}.log")

    progress_file = os.path.join(base_dir, ".scan-progress")

    movie_dirs = _apply_filters(scan_movie_dirs(base_dir), name_filters)
    if not movie_dirs:
        return []

    # 断点续扫：加载已完成的电影列表，跳过
    completed_paths: set[str] = set()
    if resume and os.path.isfile(progress_file):
        with open(progress_file, "r", encoding="utf-8") as f:
            completed_paths = {line.strip() for line in f if line.strip()}
        skipped_count = sum(1 for d in movie_dirs if d in completed_paths)
        movie_dirs = [d for d in movie_dirs if d not in completed_paths]
        if skipped_count > 0:
            print(f"{DIM}  Resuming: {skipped_count} already done, {len(movie_dirs)} remaining{RESET}")

    if not movie_dirs:
        print(f"{DIM}  All movies already processed, nothing to do.{RESET}\n")
        return []

    client = SubtitleApiClient()

    try:
        results = _do_scan_loop(movie_dirs, dry_run, client, config,
                                min_age_days, dump_mode, force, reset_fail,
                                parallel, resume, progress_file, log_path)
    except KeyboardInterrupt:
        print(f"\n{YELLOW}  ⚠ Interrupted. Progress saved.{RESET}\n")
        return []

    return results


def _do_scan_loop(
    movie_dirs, dry_run, client, config,
    min_age_days, dump_mode, force, reset_fail,
    parallel, resume, progress_file, log_path,
) -> list:
    """执行扫描循环（串行或并行）"""

    if parallel > 1 and not dry_run:
        parallel_results = _process_parallel(movie_dirs, dry_run, client, config,
                                             min_age_days, dump_mode, force, reset_fail,
                                             parallel, resume, progress_file, log_path)
        _print_scan_summary(parallel_results)
        return parallel_results

    # 串行模式
    results: list = []
    has_queried = False

    for i, movie_path in enumerate(movie_dirs, 1):
        actor_name = os.path.basename(os.path.dirname(movie_path))
        movie_name = os.path.basename(movie_path)
        label = f"{actor_name}/{movie_name}"

        print(f"{YELLOW}  [{i}/{len(movie_dirs)}]{RESET} {BOLD}{label}{RESET}", flush=True)

        result = _process_one_movie(
            movie_path, movie_name, dry_run, client, config, has_queried, min_age_days, dump_mode, force, reset_fail
        )
        results.append(result)

        if result.status in (ScanStatus.downloaded, "no_match"):
            has_queried = True

        # 断点续扫：记录已处理电影
        if resume and result.status != "error":
            _save_progress(progress_file, movie_path)

        # 日志：写入结果
        if log_path:
            _write_log(log_path, movie_path, result)

    # 全部完成，清理进度文件
    if resume and os.path.isfile(progress_file):
        os.remove(progress_file)

    _print_scan_summary(results)

    # 日志：写入汇总
    if log_path:
        _write_log_summary(log_path, results)
        print(f"{DIM}  Log saved: {log_path}{RESET}\n")

    return results


def _apply_filters(movie_dirs: list[str], name_filters: list[str] | None) -> list[str]:
    """按电影名过滤"""
    if not name_filters:
        if movie_dirs:
            print(f"{BOLD}\n  Found {len(movie_dirs)} movie(s) to process{RESET}\n")
        else:
            print(f"{DIM}  No movie directories with movie.nfo found.{RESET}\n")
        return movie_dirs

    filtered = [
        d for d in movie_dirs
        if any(matches(f, os.path.basename(d)) for f in name_filters)
    ]
    if filtered:
        kw = ", ".join(name_filters)
        print(f"{BOLD}\n  Found {len(filtered)} movie(s) matching [{kw}]{RESET}\n")
    else:
        kw = ", ".join(name_filters)
        print(f"{DIM}  No movies matching [{kw}] found.{RESET}\n")
    return filtered


def _process_parallel(
    movie_dirs: list[str], dry_run: bool, client, config,
    min_age_days: int, dump_mode: bool, force: bool, reset_fail: bool,
    workers: int, resume: bool, progress_file: str, log_path: str,
) -> list:
    """并行处理多部电影"""
    results: list = []
    lock = threading.Lock()
    done = 0
    total = len(movie_dirs)

    def process_one(idx: int, movie_path: str):
        nonlocal done
        actor = os.path.basename(os.path.dirname(movie_path))
        name = os.path.basename(movie_path)
        with lock:
            done += 1
            print(f"{YELLOW}  [{done}/{total}]{RESET} {BOLD}{actor}/{name}{RESET}", flush=True)
        return _process_one_movie(movie_path, name, dry_run, client, config,
                                  False, min_age_days, dump_mode, force, reset_fail)

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(process_one, i, d): (i, d)
                   for i, d in enumerate(movie_dirs, 1)}
        try:
            for future in as_completed(futures):
                _, movie_path = futures[future]
                try:
                    r = future.result()
                except (RuntimeError, OSError) as e:
                    r = ScanResult(movie_path, os.path.basename(movie_path),
                                   ScanStatus.error, str(e))
                results.append(r)
                if resume and r.status != ScanStatus.error:
                    _save_progress(progress_file, movie_path)
                if log_path:
                    _write_log(log_path, movie_path, r)
        except KeyboardInterrupt:
            for f in futures:
                f.cancel()
            executor.shutdown(wait=False, cancel_futures=True)
            raise

    # 按原始顺序排序结果
    order = {d: i for i, d in enumerate(movie_dirs)}
    results.sort(key=lambda r: order.get(r.movie_path, 9999))

    if resume and os.path.isfile(progress_file):
        os.remove(progress_file)
    if log_path:
        _write_log_summary(log_path, results)
        print(f"{DIM}  Log saved: {log_path}{RESET}\n")

    return results
