"""
字幕审查器 — 深度检测已下载字幕文件质量，给出百分制评分
"""

import os
import re
from dataclasses import dataclass, field
from datetime import datetime

from .scanner import scan_movie_dirs

MIN_FILE_SIZE = 200  # 最小文件大小（字节）
MIN_CN_RATIO = 0.05  # .zh 文件最低中文占比
MAX_LINE_LENGTH = 60  # 单行最大推荐字符数
MIN_SUB_DURATION_MS = 500  # 单条字幕最短推荐时长


@dataclass
class ReviewItem:
    """单文件审查结果"""
    movie_path: str
    movie_name: str
    filename: str
    score: int = 100
    status: str = "ok"       # "ok" | "warn" | "fail"
    checks: list[str] = field(default_factory=list)
    deductions: list[str] = field(default_factory=list)  # 扣分明细
    size_bytes: int = 0
    line_count: int = 0
    entry_count: int = 0     # SRT 条目数
    encoding: str = ""
    cn_ratio: float = 0.0
    reviewed: bool = False      # 是否已人工审查
    reviewed_date: str = ""     # 审查日期


def review_directory(
    base_dir: str,
    name_filters: list[str] | None = None,
    log: bool = False,
    mark: str | None = None,
    unmark: str | None = None,
    mark_all: bool = False,
    **kwargs: str | None,
) -> list[ReviewItem] | None:
    """审查目录下所有字幕文件（或执行标记操作）"""
    # ---- 标记操作 ----
    mark_path: str | None = kwargs.get("mark_path")
    unmark_path: str | None = kwargs.get("unmark_path")
    mark_fail: str | None = kwargs.get("mark_fail")
    mark_fail_path: str | None = kwargs.get("mark_fail_path")

    if mark or unmark or mark_all or mark_path or unmark_path or mark_fail or mark_fail_path:
        mark_status = "fail" if (mark_fail or mark_fail_path) else "ok"
        if mark_fail:
            mark, mark_status = mark_fail, "fail"
        # 精确路径操作 - fail 路径
        if mark_fail_path:
            full = os.path.join(base_dir, mark_fail_path) if not os.path.isabs(mark_fail_path) else mark_fail_path
            if os.path.isdir(full):
                _batch_mark([full], True, status="fail")
            else:
                print(f"\033[31m  ✗ Directory not found: {mark_fail_path}\033[0m\n")
            return None
        # 精确路径操作（相对 base_dir）
        if mark_path:
            full = os.path.join(base_dir, mark_path) if not os.path.isabs(mark_path) else mark_path
            if os.path.isdir(full):
                _batch_mark([full], True, status=mark_status)
            else:
                print(f"\033[31m  ✗ Directory not found: {mark_path}\033[0m\n")
            return None
        if unmark_path:
            full = os.path.join(base_dir, unmark_path) if not os.path.isabs(unmark_path) else unmark_path
            if os.path.isdir(full):
                _batch_mark([full], False)
            else:
                print(f"\033[31m  ✗ Directory not found: {unmark_path}\033[0m\n")
            return None

        # 关键词模糊匹配
        movie_dirs = scan_movie_dirs(base_dir)
        if mark_all:
            _batch_mark(movie_dirs, True, status=mark_status)
        elif mark or mark_fail:
            kw = mark or mark_fail or ""
            filtered = [d for d in movie_dirs if kw.lower() in os.path.basename(d).lower()]
            _batch_mark(filtered, True, kw, status=mark_status)
        elif unmark:
            filtered = [d for d in movie_dirs if unmark.lower() in os.path.basename(d).lower()]
            _batch_mark(filtered, False, unmark)
        return None

    # ---- 审查模式 ----
    movie_dirs = scan_movie_dirs(base_dir)
    if name_filters:
        movie_dirs = [
            d for d in movie_dirs
            if any(f.lower() in os.path.basename(d).lower() for f in name_filters)
        ]

    if not movie_dirs:
        kw = ", ".join(name_filters) if name_filters else ""
        tag = f" matching [{kw}]" if kw else ""
        print(f"\033[90m  No movie directories{tag} found.\033[0m\n")
        return []

    if name_filters:
        print(f"\033[1m\n  Reviewing {len(movie_dirs)} movie(s) matching [{', '.join(name_filters)}]\033[0m\n")
    else:
        print(f"\033[1m\n  Reviewing {len(movie_dirs)} movie(s)\033[0m\n")

    log_path = ""
    if log:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_path = os.path.join(base_dir, f"review_{ts}.log")

    items: list[ReviewItem] = []
    for i, movie_path in enumerate(movie_dirs, 1):
        movie_name = os.path.basename(movie_path)
        actor_name = os.path.basename(os.path.dirname(movie_path))
        label = f"{actor_name}/{movie_name}"
        print(f"\033[33m  [{i}/{len(movie_dirs)}]\033[0m \033[1m{label}\033[0m")

        sub_files = _find_all_subtitle_files(movie_path, movie_name)
        if not sub_files:
            print(f"\033[90m    (no subtitle files found)\033[0m")
            continue

        # 检查人工审查标记
        review_status, review_date = _is_reviewed(movie_path)
        if review_status == "fail":
            print(f"\033[31m    ✗ Review FAILED ({review_date})\033[0m")
        elif review_status == "ok":
            print(f"\033[90m    Reviewed: {review_date}\033[0m")

        for filepath, filename in sub_files:
            item = _review_one_file(filepath, filename, movie_path, movie_name)
            item.reviewed = review_status is not None
            item.reviewed_date = review_date
            items.append(item)
            _print_review_item(item)

            if log_path:
                _write_review_log(log_path, item)

    _print_review_summary(items)

    if log_path:
        _write_review_summary(log_path, items)
        print(f"\033[90m  Report saved: {log_path}\033[0m\n")

    return items


REVIEWED_FILE = ".reviewed"


def _is_reviewed(movie_path: str) -> tuple[str | None, str]:
    """
    检查电影审查状态，返回 (状态, 日期字符串)
    状态: None=未审查, "ok"=审查通过, "fail"=审查不及格
    """
    rf = os.path.join(movie_path, REVIEWED_FILE)
    if not os.path.isfile(rf):
        return None, ""

    try:
        mtime = os.path.getmtime(rf)
        dt = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d")
    except OSError:
        dt = ""

    # 读取状态：空文件或 "ok" = 通过，"fail" = 不及格
    try:
        with open(rf, "r", encoding="utf-8") as f:
            content = f.read().strip().lower()
    except OSError:
        content = ""
    status = "fail" if content == "fail" else "ok"
    return status, dt


def _batch_mark(movie_dirs: list[str], mark: bool, keyword: str = "", status: str = "ok") -> None:
    """批量标记/取消标记，status: ok=通过, fail=不及格"""
    action_map = {
        (True, "ok"): "Marked",
        (True, "fail"): "Marked as FAIL",
        (False, ""): "Unmarked",
    }
    action = action_map.get((mark, status), "Updated")
    kw_tag = f" matching \"{keyword}\"" if keyword else "s"
    print(f"\033[1m\n  {action} {len(movie_dirs)} movie{kw_tag}\033[0m\n")
    for d in movie_dirs:
        rf = os.path.join(d, REVIEWED_FILE)
        name = os.path.basename(d)
        if mark:
            try:
                content = "fail" if status == "fail" else ""
                with open(rf, "w", encoding="utf-8") as f:
                    if content:
                        f.write(content)
                tag = "\033[31m✗ FAIL\033[0m" if status == "fail" else "\033[32m✓\033[0m"
                print(f"  {tag} {name}")
            except OSError as e:
                print(f"  \033[31m✗\033[0m {name} — {e}")
        else:
            if os.path.isfile(rf):
                os.remove(rf)
                print(f"  \033[33m-\033[0m {name}")
    print()


def _find_all_subtitle_files(movie_path: str, movie_name: str) -> list[tuple[str, str]]:
    """查找目录下所有匹配电影名的字幕文件（含 alt/new 变体）"""
    result = []
    sub_exts = {".srt", ".ass", ".ssa", ".sub", ".vtt"}
    try:
        for fname in sorted(os.listdir(movie_path)):
            base, ext = os.path.splitext(fname)
            valid = (
                base == movie_name
                or base.startswith(movie_name + ".")
                or base.startswith(movie_name + "-")
            )
            if valid and ext.lower() in sub_exts:
                result.append((os.path.join(movie_path, fname), fname))
    except OSError:
        pass
    return result


# ---- 核心审查逻辑 ----

def _review_one_file(filepath: str, filename: str, movie_path: str, movie_name: str) -> ReviewItem:
    """深度审查单个字幕文件，返回带评分的 ReviewItem"""
    item = ReviewItem(
        movie_path=movie_path,
        movie_name=movie_name,
        filename=filename,
    )

    # ---- 文件基础检查 ----
    if not os.path.isfile(filepath):
        item.deductions.append("file_not_found")
        item.score = 0
        item.status = "fail"
        return item

    item.size_bytes = os.path.getsize(filepath)
    if item.size_bytes < MIN_FILE_SIZE:
        item.deductions.append(f"文件过小 ({item.size_bytes}B)")
        item.score = 0
        item.status = "fail"
        return item

    try:
        with open(filepath, "rb") as f:
            raw = f.read()
    except OSError as e:
        item.deductions.append(f"无法读取: {e}")
        item.score = 0
        item.status = "fail"
        return item

    # ---- 编码检测 ----
    item.encoding = _detect_encoding(raw)
    if item.encoding not in ("utf-8", "ascii"):
        item.score -= 10
        item.deductions.append(f"非UTF-8编码({item.encoding}) -10")
    else:
        item.checks.append("encoding")

    # 解码
    try:
        text = raw.decode(item.encoding)
    except (UnicodeDecodeError, LookupError):
        text = raw.decode("utf-8", errors="replace")
        item.score -= 5
        item.deductions.append("编码回退UTF-8(replace) -5")

    lines = text.splitlines()
    item.line_count = len(lines)

    # ---- SRT 深度解析 ----
    is_srt = filename.lower().endswith(".srt")
    if is_srt:
        entries = _parse_srt_entries(text)
        item.entry_count = len(entries)

        if not entries:
            item.score -= 30
            item.deductions.append("无有效SRT时间轴 -30")
        else:
            item.checks.append("srt_structure")
            _check_srt_quality(item, entries)

    # ---- 中文内容检查 ----
    if ".zh." in filename:
        item.cn_ratio = _calc_cn_ratio(text)
        if item.cn_ratio < MIN_CN_RATIO:
            item.score -= 20
            item.deductions.append(f"中文占比过低({item.cn_ratio:.0%}) -20")
        else:
            item.checks.append("cn_content")

    # 扣分上限保护
    item.score = max(0, item.score)

    # 综合判定
    if item.score >= 80:
        item.status = "ok"
    elif item.score >= 50:
        item.status = "warn"
    else:
        item.status = "fail"

    return item


def _parse_srt_entries(text: str) -> list[dict]:
    """解析 SRT 文件为条目列表"""
    entries = []
    # SRT 格式：序号\n时间轴\n文本\n\n
    pattern = re.compile(
        r"(\d+)\s*\n"
        r"(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*\n"
        r"((?:(?!\n\n).)+)",
        re.MULTILINE | re.DOTALL,
    )

    for m in pattern.finditer(text):
        idx = int(m.group(1))
        start = _ts_to_ms(m.group(2))
        end = _ts_to_ms(m.group(3))
        content = m.group(4).strip()
        entries.append({
            "index": idx,
            "start_ms": start,
            "end_ms": end,
            "content": content,
        })

    return entries


def _ts_to_ms(ts: str) -> int:
    """时间戳 'HH:MM:SS,mmm' → 毫秒"""
    h, m, s_ms = ts.split(":")
    s, ms = s_ms.replace(",", ".").split(".")
    return int(h) * 3600000 + int(m) * 60000 + int(s) * 1000 + int(ms)


def _check_srt_quality(item: ReviewItem, entries: list[dict]) -> None:
    """SRT 质量深度检测"""
    gaps = 0
    missing = 0
    overlaps = 0
    too_short = 0
    too_long = 0

    prev_idx = 0
    prev_end = 0

    for e in entries:
        # 序号连续性
        if e["index"] != prev_idx + 1:
            gaps += 1
        prev_idx = e["index"]

        # 空内容
        if not e["content"] or len(e["content"]) < 2:
            missing += 1

        # 时间重叠
        if prev_end > 0 and e["start_ms"] < prev_end:
            overlaps += 1
        prev_end = e["end_ms"]

        # 时长过短
        dur = e["end_ms"] - e["start_ms"]
        if dur < MIN_SUB_DURATION_MS:
            too_short += 1

        # 单行过长
        for line_text in e["content"].split("\n"):
            if len(line_text) > MAX_LINE_LENGTH:
                too_long += 1

    if gaps > 0:
        penalty = min(gaps, 10)
        item.score -= penalty
        item.deductions.append(f"序号不连续({gaps}处) -{penalty}")

    if missing > 0:
        penalty = min(missing * 2, 10)
        item.score -= penalty
        item.deductions.append(f"空内容条目({missing}处) -{penalty}")

    if overlaps > 0:
        penalty = min(overlaps * 5, 15)
        item.score -= penalty
        item.deductions.append(f"时间轴重叠({overlaps}处) -{penalty}")

    if too_short > 0:
        penalty = min(too_short, 5)
        item.score -= penalty
        item.deductions.append(f"时长过短({too_short}处<{MIN_SUB_DURATION_MS}ms) -{penalty}")

    if too_long > 0:
        penalty = min(too_long, 10)
        item.score -= penalty
        item.deductions.append(f"单行过长({too_long}处>{MAX_LINE_LENGTH}字) -{penalty}")


# ---- 编码检测 ----

def _detect_encoding(raw: bytes) -> str:
    """检测文本编码"""
    try:
        raw.decode("utf-8")
        return "utf-8"
    except UnicodeDecodeError:
        pass

    for enc in ("gbk", "gb2312", "big5", "shift_jis", "euc-kr"):
        try:
            raw.decode(enc)
            return enc
        except (UnicodeDecodeError, LookupError):
            continue

    return "unknown"


def _calc_cn_ratio(text: str) -> float:
    """计算中文字符占比"""
    if not text:
        return 0.0
    cn_count = sum(1 for ch in text if "\u4e00" <= ch <= "\u9fff")
    meaningful = sum(1 for ch in text if ch.isalnum() or "\u4e00" <= ch <= "\u9fff")
    if meaningful == 0:
        return 0.0
    return cn_count / meaningful


# ---- 输出 ----

def _score_color(score: int) -> str:
    if score >= 80:
        return "\033[32m"
    elif score >= 50:
        return "\033[33m"
    return "\033[31m"


def _print_review_item(item: ReviewItem) -> None:
    """打印单条审查结果"""
    color = _score_color(item.score)
    markers = {"ok": "\033[32m✓\033[0m", "warn": "\033[33m⚠\033[0m", "fail": "\033[31m✗\033[0m"}
    marker = markers.get(item.status, "?")

    extra = []
    if item.size_bytes > 0:
        extra.append(f"{_human_size(item.size_bytes)}")
    if item.entry_count > 0:
        extra.append(f"{item.entry_count}条")
    elif item.line_count > 0:
        extra.append(f"{item.line_count}行")
    if item.encoding:
        extra.append(item.encoding)
    if item.cn_ratio > 0:
        extra.append(f"中文{item.cn_ratio:.0%}")

    detail = ", ".join(extra)
    review_tag = f"\033[32m✓ Reviewed {item.reviewed_date}\033[0m" if item.reviewed else "\033[90m◇ Not reviewed\033[0m"
    print(f"  {marker} {item.filename} — {color}{item.score}/100\033[0m ({detail}) {review_tag}")

    for d in item.deductions:
        c = "\033[31m" if item.status == "fail" else "\033[33m"
        print(f"    {c}  - {d}\033[0m")


def _print_review_summary(items: list[ReviewItem]) -> None:
    """打印审查汇总"""
    ok_count = sum(1 for r in items if r.status == "ok")
    warn_count = sum(1 for r in items if r.status == "warn")
    fail_count = sum(1 for r in items if r.status == "fail")
    avg_score = sum(r.score for r in items) // max(len(items), 1)

    print()
    print(f"\033[1m  Review Summary\033[0m (\033[36mavg {avg_score}/100\033[0m):")
    if ok_count > 0:
        print(f"\033[32m    ✓ OK: {ok_count}\033[0m")
    if warn_count > 0:
        print(f"\033[33m    ⚠ WARN: {warn_count}\033[0m")
    if fail_count > 0:
        print(f"\033[31m    ✗ FAIL: {fail_count}\033[0m")
    print()


# ---- 日志 ----

def _write_review_log(log_path: str, item: ReviewItem) -> None:
    """写入单条日志"""
    ts = datetime.now().strftime("%H:%M:%S")
    status_map = {"ok": "OK", "warn": "WARN", "fail": "FAIL"}
    tag = status_map.get(item.status, "??")
    ded = "; ".join(item.deductions) if item.deductions else ""
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"[{ts}] [{tag}] {item.movie_name}/{item.filename} "
                    f"Score={item.score}/100 {ded}\n")
    except OSError:
        pass


def _write_review_summary(log_path: str, items: list[ReviewItem]) -> None:
    """写入审查汇总"""
    ok_count = sum(1 for r in items if r.status == "ok")
    warn_count = sum(1 for r in items if r.status == "warn")
    fail_count = sum(1 for r in items if r.status == "fail")
    avg_score = sum(r.score for r in items) // max(len(items), 1)
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"\n--- Summary ---\n")
            f.write(f"Total: {len(items)}  OK: {ok_count}  WARN: {warn_count}  "
                    f"FAIL: {fail_count}  Avg Score: {avg_score}/100\n")
    except OSError:
        pass


def _human_size(size: int) -> str:
    """字节转人类可读"""
    if size < 1024:
        return f"{size}B"
    return f"{size // 1024}KB"
