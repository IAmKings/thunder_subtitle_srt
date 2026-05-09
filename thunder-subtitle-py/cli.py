#!/usr/bin/env python3
"""
Thunder Subtitle Python CLI - Entry Point

字幕搜索下载工具，纯命令行参数方式
"""

import argparse
from typing import Callable

from commands.search import cmd_search
from commands.download import cmd_download
from commands.config import cmd_config
from commands.dump import cmd_dump
from commands.review import cmd_review
from commands.scan import cmd_scan


# 命令注册表：dispatch 时直接查表，无需 if/elif 链
_COMMANDS: dict[str, Callable] = {
    "search": cmd_search,
    "download": cmd_download,
    "scan": cmd_scan,
    "review": cmd_review,
    "dump": cmd_dump,
    "config": cmd_config,
}


def _get_version() -> str:
    """从已安装包的 metadata 读取版本号"""
    from importlib.metadata import PackageNotFoundError, version
    try:
        return version("thunder-subtitle")
    except PackageNotFoundError:
        return "dev"


def _build_parser() -> argparse.ArgumentParser:
    """构建命令行参数解析器"""
    parser = argparse.ArgumentParser(
        prog="thunder-subtitle",
        description="CLI tool for searching and downloading Chinese subtitles via Xunlei API",
    )
    parser.add_argument("--version", action="version", version=f"thunder-subtitle {_get_version()}")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # ===== search 命令 =====
    p = subparsers.add_parser("search", help="Search for subtitles by name")
    p.add_argument("name", help="Search keyword for subtitles")
    p.add_argument("-c", "--chinese-only", action="store_true", default=False,
                   help="Filter to Chinese subtitles only")
    p.add_argument("-d", "--max-duration", type=str, default=None,
                   help="Filter by max video duration (e.g., 1h30m, 90m, 45s)")
    p.add_argument("-f", "--chinese-first", action="store_true", default=False,
                   help="Prioritize Chinese subtitles, fallback to others if none found")
    p.add_argument("-o", "--output", type=str, default=None,
                   help="Output directory for downloads")
    p.add_argument("-i", "--index", type=str, default=None,
                   help="Download specific subtitle(s) by index (e.g., 1 or 1,3,5 or 1-3)")
    p.add_argument("-a", "--all", action="store_true", default=False,
                   help="Download all search results")
    p.add_argument("--limit", type=int, default=None,
                   help="Limit the number of results shown")

    # ===== download 命令 =====
    p = subparsers.add_parser("download", help="Download subtitle by URL")
    p.add_argument("url", help="Subtitle download URL")
    p.add_argument("filename", nargs="?", default=None, help="Output filename")
    p.add_argument("-o", "--output", type=str, default=None,
                   help="Output directory for downloads")

    # ===== config 命令 =====
    p = subparsers.add_parser("config", help="View or update configuration")
    p.add_argument("--set", nargs=2, metavar=("KEY", "VALUE"), dest="set_pair",
                   help="Set a config value (e.g., --set rate_limit 5)")
    p.add_argument("--reset", action="store_true", default=False,
                   help="Reset config to defaults")

    # ===== dump 命令 =====
    p = subparsers.add_parser("dump", help="Download ALL subtitles for a movie, numbered 1.srt, 2.srt, ...")
    p.add_argument("name", nargs="?", default=None, help="Movie name to search")
    p.add_argument("--dir", type=str, default=None,
                   help="Movie directory (auto-reads name from basename, duration from movie.nfo)")
    p.add_argument("-o", "--output", type=str, default=None,
                   help="Output directory (default: current dir, or movie dir if --dir)")
    p.add_argument("-d", "--max-duration", type=str, default=None,
                   help="Filter by max video duration (e.g., 1h30m)")
    p.add_argument("-c", "--chinese-only", action="store_true", default=False,
                   help="Only Chinese subtitles")
    p.add_argument("-f", "--chinese-first", action="store_true", default=False,
                   help="Prioritize Chinese subtitles first")

    # ===== review 命令 =====
    p = subparsers.add_parser("review", help="Review downloaded subtitle files for quality issues")
    p.add_argument("directory", nargs="?", default=None,
                   help="Base directory to review (uses media_paths if omitted)")
    p.add_argument("--filter", type=str, action="append", default=None, dest="filters",
                   help="Only review movies matching this keyword (can repeat)")
    p.add_argument("--log", action="store_true", default=False,
                   help="Save review report to the scan directory")
    p.add_argument("--mark", type=str, default=None,
                   help="Mark matching movies as reviewed")
    p.add_argument("--unmark", type=str, default=None,
                   help="Remove review mark from matching movies")
    p.add_argument("--mark-all", action="store_true", default=False,
                   help="Mark all movies as reviewed")
    p.add_argument("--mark-path", type=str, default=None,
                   help="Mark a specific movie directory as reviewed")
    p.add_argument("--unmark-path", type=str, default=None,
                   help="Remove review mark from a specific movie directory")
    p.add_argument("--mark-fail", type=str, default=None,
                   help="Mark matching movies as review FAILED (all subs unusable)")
    p.add_argument("--mark-fail-path", type=str, default=None,
                   help="Mark specific movie dir as review FAILED (relative/absolute)")

    # ===== scan 命令 =====
    p = subparsers.add_parser("scan", help="Scan Jellyfin movie directories and auto-download subtitles")
    p.add_argument("directory", nargs="?", default=None,
                   help="Base directory to scan (演员/电影 structure, uses media_paths if omitted)")
    p.add_argument("--dry-run", action="store_true", default=False,
                   help="Show what would be done without downloading")
    p.add_argument("--filter", type=str, action="append", default=None, dest="filters",
                   help="Only process movies matching this keyword (can repeat)")
    p.add_argument("--resume", action="store_true", default=False,
                   help="Resume from last interruption, skip already-processed movies")
    p.add_argument("--log", action="store_true", default=False,
                   help="Save scan log to the scan directory")
    p.add_argument("--min-age", type=int, default=0,
                   help="Only process movies released N+ days ago (default 0 = immediate)")
    p.add_argument("--dump", action="store_true", default=False, dest="dump",
                   help="Brute-force: download ALL subtitles per movie (1.srt, 2.srt...)")
    p.add_argument("--force", action="store_true", default=False,
                   help="Force re-download even for mark-fail movies (keeps fail state)")
    p.add_argument("--reset-fail", action="store_true", default=False,
                   help="Clear mark-fail status, reset to need-review")
    p.add_argument("-p", "--parallel", type=int, default=1,
                   help="Number of parallel workers (default 1 = serial)")

    return parser


def main() -> None:
    """CLI 入口：构建 parser → 解析参数 → 分发命令"""
    parser = _build_parser()
    args = parser.parse_args()

    handler = _COMMANDS.get(args.command)
    if handler:
        handler(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
