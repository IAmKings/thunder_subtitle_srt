"""dump 命令：全量下载字幕"""

import logging
import os
import xml.etree.ElementTree as ET

from src.api import SubtitleApiClient
from src.exceptions import CLIExit, ThunderSubtitleError
from src.ui import BOLD, DIM, GREEN, RESET, display_error
from src.download import dump_subtitles
from src.utils import (
    parse_duration,
    parse_nfo,
    seconds_to_duration_str,
    filter_by_duration,
    load_gcid_file,
    clear_file,
)

logger = logging.getLogger(__name__)


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
            max_duration_ms = (
                nfo.duration_seconds * 1000 if nfo.duration_seconds > 0 else None
            )
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

    print(f'{BOLD}\n  Dumping all subtitles for: "{movie_name}"{RESET}')
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
            subtitles = filter_by_duration(
                subtitles, max_duration_ms, client.filter_by_max_duration
            )

        if not subtitles:
            display_error("No subtitles match the filters.")
            raise CLIExit()

        print(f"{GREEN}  Found {len(subtitles)} subtitle(s){RESET}\n")

        # 加载已拒绝 gcid（.rejected + 上次 .dumped，避免未审核时重复下载）
        rejected = load_gcid_file(os.path.join(output_dir, ".rejected"))
        old_dumped = load_gcid_file(os.path.join(output_dir, ".dumped"))
        rejected |= old_dumped

        os.makedirs(output_dir, exist_ok=True)
        dumped_path = os.path.join(output_dir, ".dumped")
        clear_file(dumped_path)  # 清空旧 .dumped
        # 把旧的 gcids 写回 .dumped，保持完整历史记录
        for gcid in sorted(old_dumped):
            with open(dumped_path, "a", encoding="utf-8") as _f:
                _f.write(gcid + "\n")
        r = dump_subtitles(subtitles, output_dir, rejected, dumped_path=dumped_path)

        total = len(subtitles)
        parts = []
        if r.dupes > 0:
            parts.append(f"{r.dupes} dupes")
        if r.skipped > 0:
            parts.append(f"{r.skipped} rejected")
        dup_msg = f" ({', '.join(parts)})" if parts else ""
        print(f"\n{GREEN}  ✓ Downloaded {r.downloaded}/{total}{dup_msg}{RESET}\n")

    except ThunderSubtitleError as e:
        display_error(str(e))
        raise CLIExit()
