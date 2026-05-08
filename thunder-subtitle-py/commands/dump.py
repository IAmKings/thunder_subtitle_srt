"""dump 命令：全量下载字幕"""

import os
import xml.etree.ElementTree as ET

from src.api import SubtitleApiClient
from src.config import Config
from src.exceptions import CLIExit
from src.ui import BOLD, DIM, GREEN, RED, RESET, display_error
from src.download import dump_subtitles, get_default_download_dir
from src.utils import parse_duration, parse_nfo, seconds_to_duration_str


def cmd_dump(args) -> None:
    """全量下载字幕：搜索后下载全部匹配结果，按 1.{ext}, 2.{ext} 命名"""
    client = SubtitleApiClient()

    # --dir 模式：从目录读取电影名和时长
    if args.dir:
        if not os.path.isdir(args.dir):
            display_error(f"Directory not found: {args.dir}")
            raise CLIExit()
        movie_name = os.path.basename(args.dir.rstrip("/"))
        output_dir = args.output if args.output is not None else args.dir
        # 读取 movie.nfo 获取时长
        nfo_path = os.path.join(args.dir, "movie.nfo")
        try:
            nfo = parse_nfo(nfo_path)
            max_duration_ms = nfo.duration_seconds * 1000 if nfo.duration_seconds > 0 else None
            duration_str = seconds_to_duration_str(nfo.duration_seconds)
        except (ET.ParseError, OSError):
            max_duration_ms = None
            duration_str = "unknown"
    else:
        if not args.name:
            display_error("Either movie name or --dir is required")
            raise CLIExit()
        movie_name = args.name
        output_dir = args.output if args.output is not None else "."
        duration_str = args.max_duration or ""
        max_duration_ms = None
        if args.max_duration:
            try:
                max_duration_ms = parse_duration(args.max_duration)
            except ValueError as e:
                display_error(str(e))
                raise CLIExit()

    print(f"{BOLD}\n  Dumping all subtitles for: \"{movie_name}\"{RESET}")
    if max_duration_ms:
        print(f"{DIM}  Max video duration: {duration_str} (from NFO){RESET}")
    if max_duration_ms and duration_str:
        print(f"{DIM}  Filtering: Max video duration {duration_str}{RESET}")
    print(f"{DIM}  Output: {os.path.abspath(output_dir)}{RESET}\n")

    try:
        result = client.search_subtitles(movie_name)
        if result.total == 0:
            display_error("No subtitles found.")
            raise CLIExit()

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
            raise CLIExit()

        print(f"{GREEN}  Found {len(subtitles)} subtitle(s){RESET}\n")

        # 加载已拒绝 gcid
        rejected: set[str] = set()
        rejected_file = os.path.join(output_dir, ".rejected")
        if os.path.isfile(rejected_file):
            try:
                with open(rejected_file, "r", encoding="utf-8") as f:
                    rejected = {line.strip() for line in f if line.strip()}
            except OSError:
                pass

        os.makedirs(output_dir, exist_ok=True)
        dumped_path = os.path.join(output_dir, ".dumped")
        # 清空旧 .dumped
        try:
            open(dumped_path, "w").close()
        except OSError:
            pass
        r = dump_subtitles(subtitles, output_dir, rejected, dumped_path=dumped_path)

        total = len(subtitles)
        parts = []
        if r.dupes > 0:
            parts.append(f"{r.dupes} dupes")
        if r.skipped > 0:
            parts.append(f"{r.skipped} rejected")
        dup_msg = f" ({', '.join(parts)})" if parts else ""
        print(f"\n{GREEN}  ✓ Downloaded {r.downloaded}/{total}{dup_msg}{RESET}\n")

    except RuntimeError as e:
        display_error(str(e))
        raise CLIExit()
