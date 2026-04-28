"""
Terminal output formatting for Thunder Subtitle Python CLI
"""

import sys

from .types import Subtitle
from .utils import format_duration

# ANSI color codes
RESET = "\033[0m"
BOLD = "\033[1m"
RED = "\033[31m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
GRAY = "\033[90m"
CYAN = "\033[36m"


def display_subtitle_list(subtitles: list[Subtitle]) -> None:
    """格式化显示字幕列表"""
    print(f"\n{BOLD}  Found subtitles:{RESET}\n")

    for idx, sub in enumerate(subtitles, 1):
        is_chinese = any("\u4e00" <= ch <= "\u9fa5" for ch in sub.name)
        tag = f"{GREEN}[CN]{RESET}" if is_chinese else f"{GRAY}[--]{RESET}"
        duration = format_duration(sub.duration)

        print(
            f"  {YELLOW}{str(idx).rjust(2)}{RESET}. {tag} {sub.name}"
        )
        print(
            f"      {GRAY}Duration:{RESET} {duration} | "
            f"{GRAY}Format:{RESET} {sub.ext.upper()}"
        )
        print()


def display_download_progress(filename: str, downloaded: int, total: int) -> None:
    """显示下载进度条"""
    if total <= 0:
        return
    percent = round(downloaded / total * 100)
    bar_len = 20
    filled = int(bar_len * percent / 100)
    bar = "\u2588" * filled + "\u2591" * (bar_len - filled)
    sys.stdout.write(f"\r  {CYAN}{filename}{RESET}: [{bar}] {percent}%")
    sys.stdout.flush()
    if downloaded >= total:
        sys.stdout.write("\n")


def display_download_complete(filename: str, filepath: str) -> None:
    """显示下载完成消息"""
    print(f"{GREEN}\n  \u2713 Downloaded: {filename}{RESET}")
    print(f"{GRAY}    Saved to: {filepath}{RESET}\n")


def display_error(message: str) -> None:
    """显示错误消息"""
    print(f"{RED}\n  \u2717 Error: {message}{RESET}\n", file=sys.stderr)


def display_success(message: str) -> None:
    """显示成功消息"""
    print(f"{GREEN}\n  \u2713 {message}{RESET}\n")
