"""review 命令：字幕审查"""

from __future__ import annotations

import os

from src.config import Config
from src.exceptions import CLIExit
from src.reviewer import mark_directory, review_directory
from src.reviewer._encoding import _detect_encoding
from src.reviewer._review import ReviewItem
from src.reviewer._srt import (
    _check_srt_quality,
    _find_last_content_end,
    _ms_to_ts,
    _parse_srt_entries,
)
from src.ui import BOLD, BOLD_CYAN, CYAN, DIM, GREEN, RED, RESET, YELLOW
from src.utils import parse_nfo


def cmd_review(args) -> None:
    """执行字幕审查或标记操作"""
    # ---- 调试模式：对单个文件输出详细评分报告 ----
    if args.debug:
        cmd_review_debug(args.debug, nfo_path=args.nfo)
        return

    config = Config.load()
    has_mark = any(
        [
            args.mark,
            args.unmark,
            args.mark_all,
            args.mark_path,
            args.unmark_path,
            args.mark_fail,
            args.mark_fail_path,
        ]
    )
    if has_mark:
        # 标记操作：仅处理传入目录或配置第一个路径
        d = args.directory or (
            config.media_paths_list[0] if config.media_paths_list else ""
        )
        if not d:
            print(f"{RED}\n  \u2717 No directory specified.{RESET}\n")
            return
        mark_directory(
            d,
            mark=args.mark,
            unmark=args.unmark,
            mark_all=args.mark_all,
            mark_path=args.mark_path,
            unmark_path=args.unmark_path,
            mark_fail=args.mark_fail,
            mark_fail_path=args.mark_fail_path,
        )
        return

    # 审查模式：支持多仓库
    dirs = _resolve_review_dirs(args.directory, config)
    for d in dirs:
        if len(dirs) > 1:
            print(f"\n{BOLD_CYAN}\u2501\u2501\u2501 {d} \u2501\u2501\u2501{RESET}")
        review_directory(d, name_filters=args.filters, log=args.log)


def _resolve_review_dirs(args_dir: str | None, config: Config) -> list[str]:
    """解析 review 目录：优先参数，其次配置"""
    if args_dir:
        return [args_dir]
    paths = config.media_paths_list
    if not paths:
        print(
            f"{RED}\n  \u2717 No directory specified and media_paths not configured.{RESET}\n"
        )
        raise CLIExit()
    return paths


# ---- Debug 调试模式 ----

_ISSUE_LABELS: dict[str, str] = {
    "gap": "序号不连续",
    "empty_content": "空内容",
    "inverted_ts": "时间戳倒置",
    "overlap": "时间轴重叠",
    "too_short": "时长过短",
    "too_long_lines": "单行过长",
    "fast_read": "阅读速度过快",
    "single_long": "单条持续过长",
}

# 箱形图字符 (Unicode)
_H_LINE = "\u2500"  # ─
_H_LINE_THICK = "\u2501"  # ━
_V_LINE = "\u2502"  # │
_CORNER_TL = "\u2552"  # ╒
_CORNER_TR = "\u2555"  # ╕
_CORNER_BL = "\u2558"  # ╘
_CORNER_BR = "\u255d"  # ╝


def cmd_review_debug(file_path: str, nfo_path: str | None = None) -> None:
    """执行字幕文件调试评分检测

    Args:
        file_path: 字幕文件路径
        nfo_path: NFO 文件路径（可选）
    """
    if not os.path.isfile(file_path):
        print(f"{RED}\n  \u2717 File not found: {file_path}{RESET}\n")
        return

    # ---- 读取 NFO ----
    nfo_duration_seconds = 0
    if nfo_path:
        if not os.path.isfile(nfo_path):
            print(f"{YELLOW}  \u26a0 NFO file not found: {nfo_path}{RESET}")
        else:
            try:
                nfo = parse_nfo(nfo_path)
                nfo_duration_seconds = nfo.duration_seconds
            except Exception as e:
                print(f"{YELLOW}  \u26a0 NFO parse error: {e}{RESET}")

    # ---- 读取文件 ----
    size_bytes = os.path.getsize(file_path)

    try:
        with open(file_path, "rb") as f:
            raw = f.read()
    except OSError as e:
        print(f"{RED}\n  \u2717 Cannot read file: {e}{RESET}\n")
        return

    encoding = _detect_encoding(raw)
    try:
        text = raw.decode(encoding)
    except (UnicodeDecodeError, LookupError):
        text = raw.decode("utf-8", errors="replace")

    # ---- 解析 SRT 条目 ----
    filename = os.path.basename(file_path)
    is_srt = filename.lower().endswith(".srt")
    if not is_srt:
        print(f"{RED}\n  \u2717 Only .srt files are supported for debug mode.{RESET}\n")
        return

    entries, debug_info = _parse_srt_entries(text, debug=True)  # type: ignore
    match_count = debug_info["match_count"]
    total_lines = debug_info["total_lines"]
    unmatched_offset = debug_info["unmatched_tail_offset"]
    line_ranges = debug_info["line_ranges"]

    entry_count = len(entries)
    last_index = entries[-1]["index"] if entries else 0

    # ---- 创建 ReviewItem 并评分 ----
    item = ReviewItem(
        movie_path=os.path.dirname(file_path),
        movie_name=os.path.basename(os.path.dirname(file_path)),
        filename=filename,
    )
    item.size_bytes = size_bytes
    item.encoding = encoding
    item.line_count = total_lines
    item.entry_count = entry_count
    item.last_index = last_index

    ai_flags, debug_issues = _check_srt_quality(
        item, entries, debug=True, line_ranges=line_ranges
    )  # type: ignore
    issues = debug_issues["issues"]
    repeated_lines = debug_issues["repeated_lines"]
    large_gap_entries = debug_issues["large_gap_entries"]

    # 片长匹配
    nfo_duration_ms = nfo_duration_seconds * 1000
    last_end = 0
    scan_log: list[str] = []
    if nfo_duration_ms > 0 and entries:
        last_end, scan_log = _find_last_content_end(
            entries, nfo_duration_ms, debug=True
        )  # type: ignore
        item.last_end_ms = last_end

    # ---- 计算总扣分 ----
    total_penalty = 100 - item.score

    # ---- 格式化输出 ----
    _print_debug_header(file_path, size_bytes, encoding, last_index, entry_count)

    _print_basic_info(
        entry_count,
        last_index,
        entries,
        nfo_duration_seconds,
        last_end,
    )

    _print_deductions(item, issues, total_penalty)

    _print_ai_flags(ai_flags, repeated_lines, large_gap_entries)

    _print_last_content_scan(scan_log, entries, nfo_duration_ms)

    _print_entry_diagnosis(size_bytes, total_lines, match_count, unmatched_offset, text)

    print()


def _section_header(title: str, color: str = BOLD) -> None:
    """打印居中的章节标题（仿箱形线）"""
    sep = _H_LINE_THICK * 60
    print(f"  {color}{sep}{RESET}")
    print(f"  {color}{_V_LINE}{RESET}  {title}")
    print(f"  {color}{sep}{RESET}")


def _print_debug_header(
    file_path: str,
    size_bytes: int,
    encoding: str,
    last_index: int,
    entry_count: int,
) -> None:
    """打印调试报告头部"""
    size_kb = size_bytes / 1024
    sep = _H_LINE_THICK * 44
    print(f"\n{CYAN}{sep}{RESET}")
    print(f"  {BOLD}字幕评分调试报告{RESET}")
    print(f"{CYAN}{sep}{RESET}")
    print(f"  {DIM}文件:{RESET} {file_path}")
    print(
        f"  {DIM}大小:{RESET} {size_kb:.0f} KB  "
        f"{DIM}编码:{RESET} {encoding}  "
        f"{DIM}条目:{RESET} {last_index}/{entry_count}"
    )
    print()


def _print_basic_info(
    entry_count: int,
    last_index: int,
    entries: list[dict],
    nfo_duration_seconds: int,
    last_end_ms: int,
) -> None:
    """打印基本信息"""
    _section_header("基本信息")

    print(f"  {DIM}实际解析条目数:{RESET}    {entry_count}")
    print(f"  {DIM}最后序号:{RESET}          {last_index}")

    index_diff = last_index - entry_count
    if index_diff > 0:
        print(f"  {DIM}序号差异:{RESET}          {index_diff} 条缺失")
    else:
        print(f"  {DIM}序号差异:{RESET}          {index_diff} (无缺失)")

    last_ts = ""
    last_sec = 0
    if entries:
        last_end = entries[-1]["end_ms"]
        last_ts = _ms_to_ts(last_end)
        last_sec = last_end // 1000
    print(f"  {DIM}最后字幕时间:{RESET}       {last_ts} ({last_sec} 秒)")

    if nfo_duration_seconds > 0:
        nfo_ts = _ms_to_ts(nfo_duration_seconds * 1000)
        print(f"  {DIM}NFO 片长:{RESET}          {nfo_ts} ({nfo_duration_seconds} 秒)")

        if last_end_ms > 0:
            ratio = last_end_ms / (nfo_duration_seconds * 1000) * 100
            if 85 <= ratio <= 105:
                status = f"{GREEN}OK{RESET}"
            elif 50 <= ratio < 85 or 105 < ratio <= 120:
                status = f"{YELLOW}WARN{RESET}"
            else:
                status = f"{RED}FAIL{RESET}"
            print(f"  {DIM}片长匹配度:{RESET}        {ratio:.1f}% -> {status}")
    else:
        print(f"  {DIM}NFO 片长:{RESET}          -- (未提供)")
    print()


def _print_deductions(item: ReviewItem, issues: list[dict], total_penalty: int) -> None:
    """打印扣分项明细"""
    _section_header(f"扣分项 (共 -{total_penalty} 分，最终得分 {item.score})")

    # 按类型分组显示
    type_order = [
        "inverted_ts",
        "overlap",
        "gap",
        "empty_content",
        "fast_read",
        "too_short",
        "too_long_lines",
        "single_long",
    ]
    shown = 0
    for t in type_order:
        type_issues = [i for i in issues if i["type"] == t]
        if not type_issues:
            continue
        label = _ISSUE_LABELS.get(t, t)
        for iss in type_issues:
            idx = iss["entry_index"]
            ls = iss["line_start"]
            le = iss["line_end"]
            content = iss["content"]
            detail = iss.get("detail", "")

            print(f"  {RED}\u2718{RESET} {label} #{idx} (行 {ls}~{le})")
            if t in ("inverted_ts", "overlap", "gap", "fast_read"):
                print(f"     {detail}")
            else:
                if detail:
                    print(f"     {detail}")
            print(f'     {DIM}内容:{RESET} "{content}"')
            shown += 1

    if shown == 0:
        print(f"  {GREEN}\u2713{RESET} 无扣分项")
    print()


def _print_ai_flags(
    ai_flags: list[str],
    repeated_lines: list[dict],
    large_gap_entries: list[int],
) -> None:
    """打印 AI 嫌疑标记"""
    if not ai_flags:
        return

    _section_header("AI 嫌疑标记")

    for flag in ai_flags:
        if flag == "repeated_long_lines":
            for rep in repeated_lines:
                text = rep["text"]
                count = rep["count"]
                entries_str = rep["entries"]
                print(f'  {YELLOW}\u26a0{RESET}  {flag} -- "{text}"')
                print(f"     出现 {count} 次: {entries_str}")
        elif flag == "large_gaps":
            entries_str = ", ".join(f"#{e}" for e in large_gap_entries[:5])
            print(
                f"  {YELLOW}\u26a0{RESET}  {flag} -- 大段空白 ({len(large_gap_entries)} 处)"
            )
            if large_gap_entries:
                print(f"     触发条目: {entries_str}")
        elif flag == "uniform_timing":
            print(f"  {YELLOW}\u26a0{RESET}  {flag} -- 时间轴过于均匀（AI 生成嫌疑）")
        elif flag == "possibly_truncated":
            print(f"  {YELLOW}\u26a0{RESET}  {flag} -- 字幕可能被截断")
        else:
            print(f"  {YELLOW}\u26a0{RESET}  {flag}")
    print()


def _print_last_content_scan(
    scan_log: list[str],
    entries: list[dict],
    nfo_duration_ms: int,
) -> None:
    """打印最后有效字幕定位过程"""
    if not entries:
        return

    _section_header("最后有效字幕定位")

    if scan_log:
        print(f"  {DIM}逆向扫描跳过:{RESET}")
        for line in scan_log:
            print(f"  {line}")
    else:
        # 非 debug 模式（无 NFO）不输出详细扫描过程
        last_end = _find_last_content_end(entries, 0)
        if last_end:
            print(f"  {DIM}最后有效时间戳:{RESET} {_ms_to_ts(last_end)}")
    print()


def _print_entry_diagnosis(
    size_bytes: int,
    total_lines: int,
    match_count: int,
    unmatched_offset: int,
    text: str,
) -> None:
    """打印条目数诊断"""
    _section_header("条目数诊断")
    print(f"  {DIM}文件大小:{RESET} {size_bytes / 1024:.1f} KB ({size_bytes} 字节)")
    print(f"  {DIM}有效行数:{RESET} {total_lines} 行")
    print(f"  {DIM}SRT 正则匹配命中:{RESET} {match_count} 次")
    if unmatched_offset == 0:
        print(f"  {DIM}未匹配的尾部文本:{RESET} {unmatched_offset} 字节（无截断）")
    else:
        print(f"  {DIM}未匹配的尾部文本:{RESET} {unmatched_offset} 字节")

    # 异常情况：匹配太少或文件太小
    is_small = size_bytes < 5000 or match_count < 5
    if is_small:
        print(f"\n  {YELLOW}  {'--'} 异常情况示例 {'--'}{RESET}")
        print(f"  文件大小: {size_bytes / 1024:.1f} KB")
        print(f"  有效行数: {total_lines} 行")
        print(f"  SRT 正则匹配命中: {match_count} 次（仅匹配到 {match_count} 条）")
        if match_count <= 1:
            print(f"  {YELLOW}\u26a0{RESET} 文件可能不是标准 SRT 格式，或内容不完整")
        print(f"  {DIM}原始文本预览:{RESET}")
        print(f"  > {text[:500]}")
        print(f"  {DIM}... 尾部文本:{RESET}")
        print(f"  > {text[-200:]}")
