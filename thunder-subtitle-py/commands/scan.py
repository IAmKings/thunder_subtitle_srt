from __future__ import annotations
"""scan 命令：Jellyfin 目录扫描"""

from src.config import Config
from src.exceptions import CLIExit
from src.scanner import process_scanned_movies
from src.ui import BOLD_CYAN, DIM, RED, RESET


def cmd_scan(args) -> None:
    """执行 Jellyfin 扫描命令"""
    config = Config.load()
    dirs = _resolve_dirs(args.directory, config)
    for d in dirs:
        if len(dirs) > 1:
            print(f"\n{BOLD_CYAN}━━━ {d} ━━━{RESET}")
        process_scanned_movies(
            d,
            dry_run=args.dry_run,
            name_filters=args.filters,
            config=config,
            resume=args.resume,
            log=args.log,
            parallel=args.parallel,
            min_age_days=args.min_age,
            dump_mode=args.dump,
            force=args.force,
            reset_fail=args.reset_fail,
        )


def _resolve_dirs(args_dir: str | None, config: Config) -> list[str]:
    """解析目录：优先参数，其次配置 media_paths"""
    if args_dir:
        return [args_dir]
    paths = config.media_paths_list
    if not paths:
        print(f"{RED}\n  ✗ No directory specified and media_paths not configured.{RESET}")
        print(f"{DIM}  Set with: thunder-subtitle config --set media_paths /path1,/path2{RESET}\n")
        raise CLIExit()
    print(f"{DIM}  Using media_paths from config ({len(paths)} repo(s)){RESET}")
    return paths
