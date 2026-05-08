"""review 命令：字幕审查"""

from src.config import Config
from src.exceptions import CLIExit
from src.reviewer import review_directory
from src.ui import BOLD_CYAN, RED, RESET


def cmd_review(args) -> None:
    """执行字幕审查或标记操作"""
    config = Config.load()
    has_mark = any([args.mark, args.unmark, args.mark_all,
                    args.mark_path, args.unmark_path,
                    args.mark_fail, args.mark_fail_path])
    if has_mark:
        # 标记操作：仅处理传入目录或配置第一个路径
        d = args.directory or (config.media_paths_list[0] if config.media_paths_list else "")
        if not d:
            print(f"{RED}\n  ✗ No directory specified.{RESET}\n")
            return
        review_directory(d, name_filters=args.filters, log=False,
                         mark=args.mark, unmark=args.unmark, mark_all=args.mark_all,
                         mark_path=args.mark_path, unmark_path=args.unmark_path,
                         mark_fail=args.mark_fail, mark_fail_path=args.mark_fail_path)
        return

    # 审查模式：支持多仓库
    dirs = _resolve_review_dirs(args.directory, config)
    for d in dirs:
        if len(dirs) > 1:
            print(f"\n{BOLD_CYAN}━━━ {d} ━━━{RESET}")
        review_directory(d, name_filters=args.filters, log=args.log)


def _resolve_review_dirs(args_dir: str | None, config: Config) -> list[str]:
    """解析 review 目录：优先参数，其次配置"""
    if args_dir:
        return [args_dir]
    paths = config.media_paths_list
    if not paths:
        print(f"{RED}\n  ✗ No directory specified and media_paths not configured.{RESET}\n")
        raise CLIExit()
    return paths
