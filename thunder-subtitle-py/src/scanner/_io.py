"""IO辅助：进度保存、日志写入、扫描汇总输出"""

import logging
import os
from datetime import datetime

from ..models import DryState
from ..ui import BOLD, DIM, GREEN, RED, RESET, YELLOW

from ._processor import ScanResult

logger = logging.getLogger(__name__)


def _count_scan_statuses(results: list[ScanResult]) -> dict[str, int]:
    """统计扫描结果中各状态的数量"""
    counts: dict[str, int] = {
        "downloaded": 0,
        "skipped": 0,
        "no_match": 0,
        "error": 0,
    }
    for r in results:
        if r.status in counts:
            counts[r.status] += 1
    return counts


def _save_progress(progress_file: str, movie_path: str) -> None:
    """追加一条已处理记录到进度文件"""
    try:
        with open(progress_file, "a", encoding="utf-8") as f:
            f.write(movie_path + "\n")
    except OSError:
        logger.warning("无法写入进度文件: %s", progress_file)


def _write_log(log_path: str, movie_path: str, result: ScanResult) -> None:
    """写入单条日志"""
    ts = datetime.now().strftime("%H:%M:%S")
    status_map = {
        "downloaded": "OK",
        "skipped": "SKIP",
        "no_match": "NONE",
        "error": "ERR",
    }
    tag = status_map.get(result.status, "??")
    extra = (
        f" - {result.filename}"
        if result.filename
        else f" - {result.reason}"
        if result.reason
        else ""
    )
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"[{ts}] [{tag}] {os.path.basename(movie_path)}{extra}\n")
    except OSError:
        logger.warning("无法写入日志文件: %s", log_path)


def _write_log_summary(log_path: str, results: list[ScanResult]) -> None:
    """写入汇总到日志末尾"""
    counts = _count_scan_statuses(results)
    total = len(results)
    ok, skip, none, err = (
        counts["downloaded"],
        counts["skipped"],
        counts["no_match"],
        counts["error"],
    )
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write("\n--- Summary ---\n")
            f.write(
                f"Total: {total}  OK: {ok}  Skip: {skip}  None: {none}  Err: {err}\n"
            )
    except OSError:
        logger.warning("无法写入日志汇总: %s", log_path)


def _print_scan_summary(results: list[ScanResult]) -> None:
    """打印扫描汇总"""
    # dry-run 模式：按状态分类统计
    dry_states = [r.dry_state for r in results if r.dry_state]
    if dry_states:
        counts = {
            DryState.need_download: dry_states.count(DryState.need_download),
            DryState.need_review: dry_states.count(DryState.need_review),
            DryState.reviewed_ok: dry_states.count(DryState.reviewed_ok),
            DryState.reviewed_fail: dry_states.count(DryState.reviewed_fail),
            "skipped": dry_states.count("skipped"),
        }
        print()
        print(f"{BOLD}  Scan Summary:{RESET}")
        if counts[DryState.need_download] > 0:
            print(f"{DIM}    ◇ Need download: {counts['need_download']}{RESET}")
        if counts[DryState.need_review] > 0:
            print(f"{YELLOW}    ⚠ Need review: {counts['need_review']}{RESET}")
        if counts[DryState.reviewed_ok] > 0:
            print(f"{GREEN}    ✓ Reviewed: {counts['reviewed_ok']}{RESET}")
        if counts[DryState.reviewed_fail] > 0:
            print(f"{RED}    ✗ Failed: {counts['reviewed_fail']}{RESET}")
        if counts["skipped"] > 0:
            print(f"{DIM}    - Other skip: {counts['skipped']}{RESET}")
        print()
        return

    # 正常下载模式：按结果状态统计
    counts = _count_scan_statuses(results)
    dl, sk, nm, er = (
        counts["downloaded"],
        counts["skipped"],
        counts["no_match"],
        counts["error"],
    )

    print()
    print(f"{BOLD}  Scan Summary:{RESET}")
    if dl > 0:
        print(f"{GREEN}    ✓ Downloaded: {dl}{RESET}")
    if sk > 0:
        print(f"{DIM}    - Skipped: {sk}{RESET}")
    if nm > 0:
        print(f"{YELLOW}    - No match: {nm}{RESET}")
    if er > 0:
        print(f"{RED}    ✗ Errors: {er}{RESET}")
    print()
