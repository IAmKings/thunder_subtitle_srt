"""审查输出：评分颜色、单条打印、汇总打印、日志写入"""

import logging
from datetime import datetime

from ..models import ReviewQuality
from ..ui import BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW
from ._review import ReviewItem

logger = logging.getLogger(__name__)


def _score_color(score: int) -> str:
    if score >= 80:
        return GREEN
    elif score >= 50:
        return YELLOW
    return RED


def _print_review_item(item: ReviewItem) -> None:
    """打印单条审查结果"""
    color = _score_color(item.score)
    markers: dict[str, str] = {
        ReviewQuality.ok: f"{GREEN}✓{RESET}",
        ReviewQuality.warn: f"{YELLOW}⚠{RESET}",
        ReviewQuality.fail: f"{RED}✗{RESET}",
    }
    marker = markers.get(item.status, "?")

    extra = []
    if item.size_bytes > 0:
        extra.append(f"{_human_size(item.size_bytes)}")
    if item.entry_count > 0:
        extra.append(f"{item.entry_count}条")
    elif item.line_count > 0:
        extra.append(f"{item.line_count}行")
    if item.encoding:
        extra.append(item.encoding)
    if item.cn_ratio > 0:
        extra.append(f"中文{item.cn_ratio:.0%}")

    detail = ", ".join(extra)
    review_tag = (
        f"{GREEN}✓ Reviewed {item.reviewed_date}{RESET}"
        if item.reviewed
        else f"{DIM}◇ Not reviewed{RESET}"
    )
    print(
        f"  {marker} {item.filename} — {color}{item.score}/100{RESET} ({detail}) {review_tag}"
    )

    for d in item.deductions:
        c = RED if item.status == ReviewQuality.fail else YELLOW
        print(f"    {c}  - {d}{RESET}")


def _print_review_summary(items: list[ReviewItem]) -> None:
    """打印审查汇总"""
    ok_count = sum(1 for r in items if r.status == ReviewQuality.ok)
    warn_count = sum(1 for r in items if r.status == ReviewQuality.warn)
    fail_count = sum(1 for r in items if r.status == ReviewQuality.fail)
    avg_score = sum(r.score for r in items) // max(len(items), 1)

    print()
    print(f"{BOLD}  Review Summary{RESET} ({CYAN}avg {avg_score}/100{RESET}):")
    if ok_count > 0:
        print(f"{GREEN}    ✓ OK: {ok_count}{RESET}")
    if warn_count > 0:
        print(f"{YELLOW}    ⚠ WARN: {warn_count}{RESET}")
    if fail_count > 0:
        print(f"{RED}    ✗ FAIL: {fail_count}{RESET}")
    print()


def _write_review_log(log_path: str, item: ReviewItem) -> None:
    """写入单条日志"""
    ts = datetime.now().strftime("%H:%M:%S")
    status_map: dict[str, str] = {
        ReviewQuality.ok: "OK",
        ReviewQuality.warn: "WARN",
        ReviewQuality.fail: "FAIL",
    }
    tag = status_map.get(item.status, "??")
    ded = "; ".join(item.deductions) if item.deductions else ""
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(
                f"[{ts}] [{tag}] {item.movie_name}/{item.filename} "
                f"Score={item.score}/100 {ded}\n"
            )
    except OSError:
        logger.warning("无法写入审查日志: %s", log_path)


def _write_review_summary(log_path: str, items: list[ReviewItem]) -> None:
    """写入审查汇总"""
    ok_count = sum(1 for r in items if r.status == ReviewQuality.ok)
    warn_count = sum(1 for r in items if r.status == ReviewQuality.warn)
    fail_count = sum(1 for r in items if r.status == ReviewQuality.fail)
    avg_score = sum(r.score for r in items) // max(len(items), 1)
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write("\n--- Summary ---\n")
            f.write(
                f"Total: {len(items)}  OK: {ok_count}  WARN: {warn_count}  "
                f"FAIL: {fail_count}  Avg Score: {avg_score}/100\n"
            )
    except OSError:
        logger.warning("无法写入审查汇总: %s", log_path)


def _human_size(size: int) -> str:
    """字节转人类可读"""
    if size < 1024:
        return f"{size}B"
    return f"{size // 1024}KB"
