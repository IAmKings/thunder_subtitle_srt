"""IO辅助：进度保存、日志写入、扫描汇总输出"""

import logging
import os
from datetime import datetime

from ..types import ScanStatus, DryState
from ..ui import BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW

from ._processor import ScanResult

logger = logging.getLogger(__name__)


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
    status_map = {ScanStatus.downloaded: "OK", ScanStatus.skipped: "SKIP", "no_match": "NONE", "error": "ERR"}
    tag = status_map.get(result.status, "??")
    extra = f" - {result.filename}" if result.filename else f" - {result.reason}" if result.reason else ""
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"[{ts}] [{tag}] {os.path.basename(movie_path)}{extra}\n")
    except OSError:
        logger.warning("无法写入日志文件: %s", log_path)


def _write_log_summary(log_path: str, results: list[ScanResult]) -> None:
    """写入汇总到日志末尾"""
    counts = {ScanStatus.downloaded: 0, ScanStatus.skipped: 0, "no_match": 0, "error": 0}
    for r in results:
        if r.status in counts:
            counts[r.status] += 1
    total = len(results)
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write("\n--- Summary ---\n")
            f.write(f"Total: {total}  OK: {counts['downloaded']}  "
                    f"Skip: {counts['skipped']}  None: {counts['no_match']}  "
                    f"Err: {counts['error']}\n")
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
            ScanStatus.skipped: dry_states.count(ScanStatus.skipped),
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
        if counts[ScanStatus.skipped] > 0:
            print(f"{DIM}    - Other skip: {counts['skipped']}{RESET}")
        print()
        return

    # 正常下载模式：按结果状态统计
    counts = {ScanStatus.downloaded: 0, ScanStatus.skipped: 0, "no_match": 0, "error": 0}
    for r in results:
        if r.status in counts:
            counts[r.status] += 1

    print()
    print(f"{BOLD}  Scan Summary:{RESET}")
    if counts[ScanStatus.downloaded] > 0:
        print(f"{GREEN}    ✓ Downloaded: {counts['downloaded']}{RESET}")
    if counts[ScanStatus.skipped] > 0:
        print(f"{DIM}    - Skipped: {counts['skipped']}{RESET}")
    if counts["no_match"] > 0:
        print(f"{YELLOW}    - No match: {counts['no_match']}{RESET}")
    if counts["error"] > 0:
        print(f"{RED}    ✗ Errors: {counts['error']}{RESET}")
    print()
