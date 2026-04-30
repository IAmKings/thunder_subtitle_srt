#!/usr/bin/env python3
"""
Thunder Subtitle Python CLI - Entry Point

字幕搜索下载工具，纯命令行参数方式
"""

import argparse
import os
import sys

from src.api import SubtitleApiClient
from src.config import Config
from src.ui import display_subtitle_list, display_error, display_success
from src.download import download_subtitle, download_batch, get_default_download_dir
from src.utils import parse_duration
from src.scanner import process_scanned_movies
from src.reviewer import review_directory


def cmd_search(args: argparse.Namespace) -> None:
    """执行搜索命令"""
    client = SubtitleApiClient()
    output_dir = args.output or get_default_download_dir()

    # 解析 max_duration
    max_duration_ms: int | None = None
    if args.max_duration:
        try:
            max_duration_ms = parse_duration(args.max_duration)
        except ValueError as e:
            display_error(str(e))
            sys.exit(1)

    # 显示筛选信息
    print(f"\033[1m\n  Searching for: \"{args.name}\"\033[0m", flush=True)
    if args.chinese_only:
        print(f"\033[90m  Filtering: Chinese subtitles only\033[0m", flush=True)
    if args.max_duration:
        print(f"\033[90m  Filtering: Max video duration {args.max_duration}\033[0m", flush=True)
    if args.chinese_first and not args.chinese_only:
        print(f"\033[90m  Priority: Chinese subtitles first\033[0m", flush=True)
    print(flush=True)

    try:
        # 搜索字幕
        result = client.search_subtitles(args.name)

        if result.total == 0:
            display_error("No subtitles found for the given search term.")
            sys.exit(1)

        # 应用中文筛选
        subtitles = result.subtitles
        if args.chinese_only:
            subtitles = client.filter_chinese_subtitles(subtitles)
            if not subtitles:
                display_error(
                    "No Chinese subtitles found for the given search term."
                )
                sys.exit(1)

        # 应用时长筛选
        if max_duration_ms is not None:
            subtitles = client.filter_by_max_duration(subtitles, max_duration_ms)
            if not subtitles:
                display_error(
                    f"No subtitles found with video duration within "
                    f"{args.max_duration} ({max_duration_ms}ms)."
                )
                sys.exit(1)

        # 显示筛选统计
        print(f"\033[32m\n  Found {result.total} subtitle(s)\033[0m")
        filter_parts = []
        if args.chinese_only:
            filter_parts.append(f"Chinese-only: {len(subtitles)}")
        if max_duration_ms is not None:
            filter_parts.append(f"Max duration {args.max_duration}: {len(subtitles)}")
        if args.chinese_first and not args.chinese_only:
            filter_parts.append("Chinese-first")
        if filter_parts:
            print(f"\033[32m  Filtered ({', '.join(filter_parts)})\033[0m")

        # 中文字幕优先排序：中文排前面，非中文排后面
        if args.chinese_first and not args.chinese_only:
            subtitles.sort(key=lambda s: 0 if client.is_chinese_subtitle(s) else 1)

        # 应用 limit
        if args.limit and args.limit > 0:
            subtitles = subtitles[: args.limit]

        # 显示字幕列表
        display_subtitle_list(subtitles)

        # 处理下载逻辑
        if args.all:
            # 下载全部（chinese-first 模式下优先下载中文）
            if args.chinese_first and not args.chinese_only:
                chinese_subs = [s for s in subtitles if client.is_chinese_subtitle(s)]
                if chinese_subs:
                    subtitles = chinese_subs
            _do_download(subtitles, output_dir, args.name, client)
        elif args.index is not None:
            # 下载指定序号
            indices = _parse_indices(args.index)
            selected = []
            for i in indices:
                if 1 <= i <= len(subtitles):
                    selected.append(subtitles[i - 1])
                else:
                    display_error(f"Invalid index: {i} (valid range: 1-{len(subtitles)})")
                    sys.exit(1)
            _do_download(selected, output_dir, args.name, client)
        else:
            # 不下载，仅显示
            print(
                f"\033[90m  Use --index N or --all to download. "
                f"Use --help for more options.\033[0m\n"
            )

    except RuntimeError as e:
        display_error(str(e))
        sys.exit(1)


def cmd_download(args: argparse.Namespace) -> None:
    """执行下载命令"""
    from src.types import Subtitle

    output_dir = args.output or get_default_download_dir()

    # 构造一个简单的 Subtitle 对象
    subtitle = Subtitle(
        gcid="",
        cid="",
        url=args.url,
        ext=args.filename.split(".")[-1] if args.filename and "." in args.filename else "srt",
        name=args.filename or "subtitle",
        duration=0,
        languages=[],
        source=0,
        score=0.0,
        fingerprintf_score=0.0,
        extra_name="",
        mt=0,
    )

    result = download_subtitle(subtitle, output_dir, custom_filename=args.filename)
    if result.success:
        display_success(f"Downloaded: {result.filename}")
    else:
        display_error(f"Download failed: {result.error}")
        sys.exit(1)


def cmd_scan(args: argparse.Namespace) -> None:
    """执行 Jellyfin 扫描命令"""
    config = Config.load()
    process_scanned_movies(
        args.directory,
        dry_run=args.dry_run,
        name_filters=args.filters,
        config=config,
        resume=args.resume,
        log=args.log,
        min_age_days=args.min_age,
    )


def cmd_config(args: argparse.Namespace) -> None:
    """配置管理"""
    config = Config.load()

    if args.reset:
        config = Config()
        config.save()
        print(f"\033[32m\n  ✓ Config reset to defaults\033[0m\n")
        return

    if args.set_pair:
        key, value = args.set_pair[0], args.set_pair[1]
        if not hasattr(config, key):
            valid = ", ".join(Config.__dataclass_fields__.keys())
            print(f"\033[31m\n  ✗ Unknown key: {key}\033[0m")
            print(f"\033[90m  Valid keys: {valid}\033[0m\n")
            return
        current = getattr(config, key)
        if isinstance(current, int):
            setattr(config, key, int(value))
        else:
            setattr(config, key, value)
        config.save()
        print(f"\033[32m\n  ✓ {key} = {getattr(config, key)}\033[0m\n")
        return

    config.show()


def cmd_dump(args: argparse.Namespace) -> None:
    """全量下载字幕：搜索后下载全部匹配结果，按 1.{ext}, 2.{ext} 命名"""
    client = SubtitleApiClient()
    output_dir = args.output or "."

    # 解析时长
    max_duration_ms: int | None = None
    if args.max_duration:
        try:
            max_duration_ms = parse_duration(args.max_duration)
        except ValueError as e:
            display_error(str(e))
            sys.exit(1)

    print(f"\033[1m\n  Dumping all subtitles for: \"{args.name}\"\033[0m")
    if args.max_duration:
        print(f"\033[90m  Filtering: Max video duration {args.max_duration}\033[0m")
    print(f"\033[90m  Output: {os.path.abspath(output_dir)}\033[0m\n")

    try:
        result = client.search_subtitles(args.name)
        if result.total == 0:
            display_error("No subtitles found.")
            sys.exit(1)

        subtitles = result.subtitles

        # 中文筛选
        if args.chinese_only:
            subtitles = client.filter_chinese_subtitles(subtitles)
        elif args.chinese_first:
            subtitles.sort(key=lambda s: 0 if client.is_chinese_subtitle(s) else 1)

        # 时长筛选
        if max_duration_ms is not None:
            with_dur = [s for s in subtitles if s.duration > 0]
            without_dur = [s for s in subtitles if s.duration == 0]
            subtitles = client.filter_by_max_duration(with_dur, max_duration_ms) + without_dur

        if not subtitles:
            display_error("No subtitles match the filters.")
            sys.exit(1)

        print(f"\033[32m  Found {len(subtitles)} subtitle(s)\033[0m\n")

        os.makedirs(output_dir, exist_ok=True)
        downloaded = 0
        for i, sub in enumerate(subtitles, 1):
            filename = f"{i}.{sub.ext}"
            print(f"\033[90m  [{i}/{len(subtitles)}]\033[0m {filename} ← {sub.name}")

            dl = download_subtitle(sub, output_dir, custom_filename=filename)
            if dl.success:
                downloaded += 1

        print(f"\n\033[32m  ✓ Downloaded {downloaded}/{len(subtitles)}\033[0m\n")

    except RuntimeError as e:
        display_error(str(e))
        sys.exit(1)


def cmd_review(args: argparse.Namespace) -> None:
    """执行字幕审查或标记操作"""
    review_directory(
        args.directory,
        name_filters=args.filters,
        log=args.log,
        mark=args.mark,
        unmark=args.unmark,
        mark_all=args.mark_all,
    )


def _do_download(subtitles: list, output_dir: str, search_name: str, client) -> None:
    """执行下载（单个或批量），文件名使用搜索名 + .zh 标识"""

    def build_filename(sub) -> str:
        is_chinese = client.is_chinese_subtitle(sub)
        suffix = ".zh" if is_chinese else ""
        return f"{search_name}{suffix}.{sub.ext}"

    if len(subtitles) == 1:
        filename = build_filename(subtitles[0])
        result = download_subtitle(subtitles[0], output_dir, custom_filename=filename)
        if result.success:
            display_success(f"Downloaded: {result.filename}")
        else:
            display_error(f"Download failed: {result.error}")
            sys.exit(1)
    else:
        filenames = [build_filename(sub) for sub in subtitles]
        batch = download_batch(subtitles, output_dir, filenames=filenames)
        display_success(
            f"Batch download complete: {batch['successful']} successful, "
            f"{batch['failed']} failed"
        )


def _parse_indices(index_str: str) -> list[int]:
    """解析序号字符串，如 '1' 或 '1,3,5' 或 '1-3'"""
    indices: list[int] = []
    for part in index_str.split(","):
        part = part.strip()
        if "-" in part:
            start, end = part.split("-", 1)
            indices.extend(range(int(start), int(end) + 1))
        else:
            indices.append(int(part))
    return indices


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
    dump_parser.add_argument("name", help="Movie name to search")
    dump_parser.add_argument(
        "-o", "--output", type=str, default=".",
        help="Output directory (default: current dir)",
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
    review_parser.add_argument("directory", help="Base directory to review (演员/电影 structure)")
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

    # ===== scan 命令 =====
    scan_parser = subparsers.add_parser(
        "scan",
        help="Scan Jellyfin movie directories and auto-download subtitles",
    )
    scan_parser.add_argument(
        "directory",
        help="Base directory to scan (演员/电影 structure)",
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
