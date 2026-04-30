"""
字幕审查器 — 检测已下载字幕文件的质量
"""

import os
import re
from dataclasses import dataclass
from datetime import datetime

from .scanner import scan_movie_dirs, _existing_subtitle_file

MIN_FILE_SIZE = 200  # 最小文件大小（字节）
MIN_CN_RATIO = 0.05  # .zh 文件最低中文占比


@dataclass
class ReviewItem:
    """单文件审查结果"""
    movie_path: str
    movie_name: str
    filename: str
    status: str       # "ok" | "warn" | "fail"
    checks: list[str]  # 通过的检查
    warnings: list[str]  # 警告
    errors: list[str]    # 失败
    size_bytes: int = 0
    line_count: int = 0
    encoding: str = ""
    cn_ratio: float = 0.0


def review_directory(
    base_dir: str,
    name_filters: list[str] | None = None,
    log: bool = False,
) -> list[ReviewItem]:
    """审查目录下所有字幕文件"""
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

        # 查找目录下所有字幕文件
        sub_files = _find_all_subtitle_files(movie_path, movie_name)
        if not sub_files:
            print(f"\033[90m    (no subtitle files found)\033[0m")
            continue

        for filepath, filename in sub_files:
            item = _review_one_file(filepath, filename, movie_path, movie_name)
            items.append(item)
            _print_review_item(item)

            if log_path:
                _write_review_log(log_path, item)

    # 汇总
    _print_review_summary(items)

    if log_path:
        _write_review_summary(log_path, items)
        print(f"\033[90m  Report saved: {log_path}\033[0m\n")

    return items


def _find_all_subtitle_files(movie_path: str, movie_name: str) -> list[tuple[str, str]]:
    """查找目录下所有匹配电影名的字幕文件（含 alt/new 变体）"""
    result = []
    sub_exts = {".srt", ".ass", ".ssa", ".sub", ".vtt"}
    try:
        for fname in sorted(os.listdir(movie_path)):
            base, ext = os.path.splitext(fname)
            # 匹配：电影名 / 电影名.zh / 电影名-alt / 电影名-alt.zh / 电影名-new 等
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


def _review_one_file(filepath: str, filename: str, movie_path: str, movie_name: str) -> ReviewItem:
    """审查单个字幕文件"""
    item = ReviewItem(
        movie_path=movie_path,
        movie_name=movie_name,
        filename=filename,
        status="ok",
        checks=[],
        warnings=[],
        errors=[],
    )

    # 文件存在检查
    if not os.path.isfile(filepath):
        item.errors.append("File not found")
        item.status = "fail"
        return item

    item.size_bytes = os.path.getsize(filepath)

    # 1. 文件大小检查
    if item.size_bytes < MIN_FILE_SIZE:
        item.errors.append(f"Size too small ({item.size_bytes}B < {MIN_FILE_SIZE}B)")
        item.status = "fail"
        return item
    item.checks.append("size")

    # 读取文件内容
    try:
        with open(filepath, "rb") as f:
            raw = f.read()
    except OSError as e:
        item.errors.append(f"Cannot read: {e}")
        item.status = "fail"
        return item

    # 2. 编码检测
    item.encoding = _detect_encoding(raw)
    if item.encoding not in ("utf-8", "ascii"):
        item.warnings.append(f"Encoding: {item.encoding} (non-UTF-8)")
    else:
        item.checks.append("encoding")

    # 解码
    try:
        text = raw.decode(item.encoding)
    except (UnicodeDecodeError, LookupError):
        text = raw.decode("utf-8", errors="replace")
        item.warnings.append("Encoding: fallback to UTF-8 (replace)")

    lines = text.splitlines()
    item.line_count = len(lines)

    # 3. SRT 结构检查（仅 .srt）
    if filename.lower().endswith(".srt"):
        if not _has_valid_srt_structure(text):
            item.errors.append("Invalid SRT structure (no timestamp lines)")
        else:
            item.checks.append("srt_structure")

    # 4. 中文内容检查（仅 .zh.* 文件）
    if ".zh." in filename:
        item.cn_ratio = _calc_cn_ratio(text)
        if item.cn_ratio < MIN_CN_RATIO:
            item.warnings.append(f"Low Chinese ratio ({item.cn_ratio:.0%} < {MIN_CN_RATIO:.0%})")
        else:
            item.checks.append("cn_content")

    # 综合判定
    if item.errors:
        item.status = "fail"
    elif item.warnings:
        item.status = "warn"

    return item


def _detect_encoding(raw: bytes) -> str:
    """检测文本编码"""
    # 尝试 UTF-8
    try:
        raw.decode("utf-8")
        return "utf-8"
    except UnicodeDecodeError:
        pass

    # 尝试常见中文编码
    for enc in ("gbk", "gb2312", "big5", "shift_jis", "euc-kr"):
        try:
            raw.decode(enc)
            return enc
        except (UnicodeDecodeError, LookupError):
            continue

    return "unknown"


def _has_valid_srt_structure(text: str) -> bool:
    """检查是否包含 SRT 时间轴格式"""
    return bool(re.search(r"\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}", text))


def _calc_cn_ratio(text: str) -> float:
    """计算中文字符占比"""
    if not text:
        return 0.0
    cn_count = sum(1 for ch in text if "\u4e00" <= ch <= "\u9fff")
    # 排除空白和标点
    meaningful = sum(1 for ch in text if ch.isalnum() or "\u4e00" <= ch <= "\u9fff")
    if meaningful == 0:
        return 0.0
    return cn_count / meaningful


# ---- 输出 ----

def _print_review_item(item: ReviewItem) -> None:
    """打印单条审查结果"""
    markers = {"ok": "\033[32m✓\033[0m", "warn": "\033[33m⚠\033[0m", "fail": "\033[31m✗\033[0m"}
    marker = markers.get(item.status, "?")

    extra = []
    if item.size_bytes > 0:
        extra.append(f"{_human_size(item.size_bytes)}")
    if item.line_count > 0:
        extra.append(f"{item.line_count}行")
    if item.encoding:
        extra.append(item.encoding)
    if item.cn_ratio > 0:
        extra.append(f"中文{item.cn_ratio:.0%}")

    detail = ", ".join(extra)
    print(f"  {marker} {item.filename} — {item.status.upper()} ({detail})")

    for w in item.warnings:
        print(f"    \033[33m  ⚠ {w}\033[0m")
    for e in item.errors:
        print(f"    \033[31m  ✗ {e}\033[0m")


def _print_review_summary(items: list[ReviewItem]) -> None:
    """打印审查汇总"""
    ok_count = sum(1 for r in items if r.status == "ok")
    warn_count = sum(1 for r in items if r.status == "warn")
    fail_count = sum(1 for r in items if r.status == "fail")

    print()
    print(f"\033[1m  Review Summary:\033[0m")
    if ok_count > 0:
        print(f"\033[32m    ✓ OK: {ok_count}\033[0m")
    if warn_count > 0:
        print(f"\033[33m    ⚠ WARN: {warn_count}\033[0m")
    if fail_count > 0:
        print(f"\033[31m    ✗ FAIL: {fail_count}\033[0m")
    print()


def _write_review_log(log_path: str, item: ReviewItem) -> None:
    """写入单条日志"""
    ts = datetime.now().strftime("%H:%M:%S")
    status_map = {"ok": "OK", "warn": "WARN", "fail": "FAIL"}
    tag = status_map.get(item.status, "??")
    warnings = "; ".join(item.warnings) if item.warnings else ""
    errors = "; ".join(item.errors) if item.errors else ""
    extra = ""
    if warnings:
        extra += f" [W: {warnings}]"
    if errors:
        extra += f" [E: {errors}]"
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"[{ts}] [{tag}] {item.movie_name}/{item.filename}{extra}\n")
    except OSError:
        pass


def _write_review_summary(log_path: str, items: list[ReviewItem]) -> None:
    """写入审查汇总"""
    ok_count = sum(1 for r in items if r.status == "ok")
    warn_count = sum(1 for r in items if r.status == "warn")
    fail_count = sum(1 for r in items if r.status == "fail")
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"\n--- Summary ---\n")
            f.write(f"Total: {len(items)}  OK: {ok_count}  WARN: {warn_count}  FAIL: {fail_count}\n")
    except OSError:
        pass


def _human_size(size: int) -> str:
    """字节转人类可读"""
    if size < 1024:
        return f"{size}B"
    return f"{size // 1024}KB"
