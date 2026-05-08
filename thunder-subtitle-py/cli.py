#!/usr/bin/env python3
"""
Thunder Subtitle Python CLI - Entry Point

字幕搜索下载工具，纯命令行参数方式
"""

import argparse

from commands.search import cmd_search
from commands.download import cmd_download
from commands.config import cmd_config
from commands.dump import cmd_dump
from commands.review import cmd_review
from commands.scan import cmd_scan


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="thunder-subtitle",
        description="CLI tool for searching and downloading Chinese subtitles via Xunlei API",
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # ===== search 命令 =====
    search_parser = subparsers.add_parser(
        "search", help="Search for subtitles by name"
    )
    search_parser.add_argument("name", help="Search keyword for subtitles")
    search_parser.add_argument(
        "-c", "--chinese-only",
        action="store_true",
        default=False,
        help="Filter to Chinese subtitles only",
    )
    search_parser.add_argument(
        "-d", "--max-duration",
        type=str,
        default=None,
        help="Filter by max video duration (e.g., 1h30m, 90m, 45s)",
    )
    search_parser.add_argument(
        "-f", "--chinese-first",
        action="store_true",
        default=False,
        help="Prioritize Chinese subtitles, fallback to others if none found",
    )
    search_parser.add_argument(
        "-o", "--output",
        type=str,
        default=None,
        help="Output directory for downloads",
    )
    search_parser.add_argument(
        "-i", "--index",
        type=str,
        default=None,
        help="Download specific subtitle(s) by index (e.g., 1 or 1,3,5 or 1-3)",
    )
    search_parser.add_argument(
        "-a", "--all",
        action="store_true",
        default=False,
        help="Download all search results",
    )
    search_parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit the number of results shown",
    )

    # ===== download 命令 =====
    download_parser = subparsers.add_parser(
        "download", help="Download subtitle by URL"
    )
    download_parser.add_argument("url", help="Subtitle download URL")
    download_parser.add_argument("filename", nargs="?", default=None, help="Output filename")
    download_parser.add_argument(
        "-o", "--output",
        type=str,
        default=None,
        help="Output directory for downloads",
    )

    # ===== config 命令 =====
    config_parser = subparsers.add_parser(
        "config", help="View or update configuration"
    )
    config_parser.add_argument(
        "--set", nargs=2, metavar=("KEY", "VALUE"), dest="set_pair",
        help="Set a config value (e.g., --set rate_limit 5)",
    )
    config_parser.add_argument(
        "--reset", action="store_true", default=False,
        help="Reset config to defaults",
    )

    # ===== dump 命令 =====
    dump_parser = subparsers.add_parser(
        "dump", help="Download ALL subtitles for a movie, numbered 1.srt, 2.srt, ..."
    )
    dump_parser.add_argument("name", nargs="?", default=None, help="Movie name to search")
    dump_parser.add_argument(
        "--dir", type=str, default=None,
        help="Movie directory (auto-reads name from basename, duration from movie.nfo)",
    )
    dump_parser.add_argument(
        "-o", "--output", type=str, default=None,
        help="Output directory (default: current dir, or movie dir if --dir)",
    )
    dump_parser.add_argument(
        "-d", "--max-duration", type=str, default=None,
        help="Filter by max video duration (e.g., 1h30m)",
    )
    dump_parser.add_argument(
        "-c", "--chinese-only", action="store_true", default=False,
        help="Only Chinese subtitles",
    )
    dump_parser.add_argument(
        "-f", "--chinese-first", action="store_true", default=False,
        help="Prioritize Chinese subtitles first",
    )

    # ===== review 命令 =====
    review_parser = subparsers.add_parser(
        "review", help="Review downloaded subtitle files for quality issues"
    )
    review_parser.add_argument("directory", nargs="?", default=None,
                                help="Base directory to review (uses media_paths if omitted)")
    review_parser.add_argument(
        "--filter", type=str, action="append", default=None, dest="filters",
        help="Only review movies matching this keyword (can repeat)",
    )
    review_parser.add_argument(
        "--log", action="store_true", default=False,
        help="Save review report to the scan directory",
    )
    review_parser.add_argument(
        "--mark", type=str, default=None,
        help="Mark matching movies as reviewed",
    )
    review_parser.add_argument(
        "--unmark", type=str, default=None,
        help="Remove review mark from matching movies",
    )
    review_parser.add_argument(
        "--mark-all", action="store_true", default=False,
        help="Mark all movies as reviewed",
    )
    review_parser.add_argument(
        "--mark-path", type=str, default=None,
        help="Mark a specific movie directory as reviewed",
    )
    review_parser.add_argument(
        "--unmark-path", type=str, default=None,
        help="Remove review mark from a specific movie directory",
    )
    review_parser.add_argument(
        "--mark-fail", type=str, default=None,
        help="Mark matching movies as review FAILED (all subs unusable)",
    )
    review_parser.add_argument(
        "--mark-fail-path", type=str, default=None,
        help="Mark specific movie dir as review FAILED (relative/absolute)",
    )

    # ===== scan 命令 =====
    scan_parser = subparsers.add_parser(
        "scan",
        help="Scan Jellyfin movie directories and auto-download subtitles",
    )
    scan_parser.add_argument(
        "directory", nargs="?", default=None,
        help="Base directory to scan (演员/电影 structure, uses media_paths if omitted)",
    )
    scan_parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Show what would be done without downloading",
    )
    scan_parser.add_argument(
        "--filter",
        type=str,
        action="append",
        default=None,
        dest="filters",
        help="Only process movies matching this keyword (can repeat)",
    )
    scan_parser.add_argument(
        "--resume",
        action="store_true",
        default=False,
        help="Resume from last interruption, skip already-processed movies",
    )
    scan_parser.add_argument(
        "--log",
        action="store_true",
        default=False,
        help="Save scan log to the scan directory",
    )
    scan_parser.add_argument(
        "--min-age",
        type=int,
        default=0,
        help="Only process movies released N+ days ago (default 0 = immediate)",
    )
    scan_parser.add_argument(
        "--dump",
        action="store_true",
        default=False,
        dest="dump",
        help="Brute-force: download ALL subtitles per movie (1.srt, 2.srt...)",
    )
    scan_parser.add_argument(
        "--force",
        action="store_true",
        default=False,
        help="Force re-download even for mark-fail movies (keeps fail state)",
    )
    scan_parser.add_argument(
        "--reset-fail",
        action="store_true",
        default=False,
        help="Clear mark-fail status, reset to need-review",
    )
    scan_parser.add_argument(
        "-p", "--parallel",
        type=int, default=1,
        help="Number of parallel workers (default 1 = serial)",
    )

    args = parser.parse_args()

    if args.command == "search":
        cmd_search(args)
    elif args.command == "download":
        cmd_download(args)
    elif args.command == "scan":
        cmd_scan(args)
    elif args.command == "review":
        cmd_review(args)
    elif args.command == "dump":
        cmd_dump(args)
    elif args.command == "config":
        cmd_config(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
