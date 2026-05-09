"""search 命令：搜索字幕"""

from src.api import SubtitleApiClient
from src.exceptions import CLIExit, ThunderSubtitleError
from src.ui import BOLD, DIM, GREEN, RESET, display_subtitle_list, display_error, display_success
from src.download import download_subtitle, download_batch, get_default_download_dir
from src.utils import parse_duration


def cmd_search(args) -> None:
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
            raise CLIExit()

    # 显示筛选信息
    print(f"{BOLD}\n  Searching for: \"{args.name}\"{RESET}", flush=True)
    if args.chinese_only:
        print(f"{DIM}  Filtering: Chinese subtitles only{RESET}", flush=True)
    if args.max_duration:
        print(f"{DIM}  Filtering: Max video duration {args.max_duration}{RESET}", flush=True)
    if args.chinese_first and not args.chinese_only:
        print(f"{DIM}  Priority: Chinese subtitles first{RESET}", flush=True)
    print(flush=True)

    try:
        # 搜索字幕
        result = client.search_subtitles(args.name)

        if result.total == 0:
            display_error("No subtitles found for the given search term.")
            raise CLIExit()

        # 应用中文筛选
        subtitles = result.subtitles
        if args.chinese_only:
            subtitles = client.filter_chinese_subtitles(subtitles)
            if not subtitles:
                display_error(
                    "No Chinese subtitles found for the given search term."
                )
                raise CLIExit()

        # 应用时长筛选
        if max_duration_ms is not None:
            subtitles = client.filter_by_max_duration(subtitles, max_duration_ms)
            if not subtitles:
                display_error(
                    f"No subtitles found with video duration within "
                    f"{args.max_duration} ({max_duration_ms}ms)."
                )
                raise CLIExit()

        # 显示筛选统计
        total = result.total
        limit_tag = f"{DIM} (API returns up to {total}){RESET}" if total >= 100 else ""
        print(f"{GREEN}\n  Found {len(subtitles)} subtitle(s){RESET}{limit_tag}")
        filter_parts = []
        if args.chinese_only:
            filter_parts.append(f"Chinese-only: {len(subtitles)}")
        if max_duration_ms is not None:
            filter_parts.append(f"Max duration {args.max_duration}: {len(subtitles)}")
        if args.chinese_first and not args.chinese_only:
            filter_parts.append("Chinese-first")
        if filter_parts:
            print(f"{GREEN}  Filtered ({', '.join(filter_parts)}){RESET}")

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
                    raise CLIExit()
            _do_download(selected, output_dir, args.name, client)
        else:
            # 不下载，仅显示
            print(
                f"{DIM}  Use --index N or --all to download. "
                f"Use --help for more options.{RESET}\n"
            )

    except ThunderSubtitleError as e:
        display_error(str(e))
        raise CLIExit()


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
            raise CLIExit()
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
