"""单部电影处理：NFO解析 → 跳过检查 → 搜索 → 下载"""

import hashlib
import os
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass

from ..api import SubtitleApiClient
from ..config import Config
from ..download import download_subtitle, dump_subtitles
from ..types import ScanStatus, DryState
from ..ui import DIM, GREEN, RED, RESET, YELLOW
from ..utils import NfoInfo, matches, parse_nfo, seconds_to_duration_str



@dataclass
class ScanResult:
    """单个电影处理结果"""
    movie_path: str
    movie_name: str
    status: str = ScanStatus.skipped
    reason: str = ""
    filename: str = ""
    dry_state: str = ""  # DryState 值或空字符串


# ---- 字幕筛选辅助 ----

def _has_preferred_group(subtitle, groups: list[str]) -> bool:
    """字幕名称是否来自偏好字幕组"""
    if not groups:
        return False
    return any(matches(g, subtitle.name) for g in groups)


from ._skip import _check_skip  # noqa: E402


# ---- 处理主循环 ----

def _process_one_movie(
    movie_path: str, movie_name: str, dry_run: bool, client: SubtitleApiClient,
    config: Config, has_queried: bool, min_age_days: int = 0,
    dump_mode: bool = False, force: bool = False, reset_fail: bool = False,
) -> ScanResult:
    """处理单部电影：解析 NFO → 跳过检查 → 搜索 → 下载"""

    # ---- NFO 解析 ----
    nfo_path = os.path.join(movie_path, "movie.nfo")
    try:
        nfo = parse_nfo(nfo_path)
    except ET.ParseError as e:
        _print_status("✗", f"Invalid XML: {e}")
        return ScanResult(movie_path, movie_name, ScanStatus.error, f"NFO parse error: {e}")
    except FileNotFoundError:
        _print_status("✗", "movie.nfo not found")
        return ScanResult(movie_path, movie_name, ScanStatus.error, "movie.nfo not found")

    # ---- 跳过检查 ----
    skip_reason, dry_state = _check_skip(movie_path, movie_name, nfo, dry_run, min_age_days, force, reset_fail)
    if skip_reason:
        _print_status("✓", skip_reason)
        return ScanResult(movie_path, movie_name, ScanStatus.skipped, skip_reason, dry_state=dry_state)

    duration_str = seconds_to_duration_str(nfo.duration_seconds)
    if not duration_str:
        _print_status("✗", "No duration info in NFO")
        return ScanResult(movie_path, movie_name, ScanStatus.error, "Missing duration in movie.nfo")

    print(f"{DIM}    Duration: {duration_str}{RESET}")

    if dry_run:
        print(f"{DIM}    [DRY RUN] Would search: \"{movie_name}\" -d {duration_str}{RESET}")
        return ScanResult(movie_path, movie_name, ScanStatus.skipped, "dry-run", dry_state=dry_state)

    # ---- 搜索 + 下载 ----
    try:
        return _search_and_download(movie_path, movie_name, nfo, client, config, has_queried, dump_mode)
    except (RuntimeError, OSError) as e:
        print(f"{RED}    ✗ Error: {e}{RESET}")
        return ScanResult(movie_path, movie_name, ScanStatus.error, str(e))


def _search_and_download(
    movie_path: str, movie_name: str, nfo: NfoInfo, client: SubtitleApiClient,
    config: Config, needs_delay: bool = False, dump_mode: bool = False,
) -> ScanResult:
    """搜索字幕并下载（主力+备选 或 dump全量）"""
    if needs_delay and config.rate_limit > 0:
        time.sleep(config.rate_limit)

    result = client.search_subtitles(movie_name)

    if result.total == 0:
        _print_status("✗", "No subtitles found")
        return ScanResult(movie_path, movie_name, ScanStatus.no_match, "No subtitles found")

    # 按时长筛选：有时长的在前，duration=0 的保留在后
    max_duration_ms = nfo.duration_seconds * 1000
    with_dur = [s for s in result.subtitles if s.duration > 0]
    without_dur = [s for s in result.subtitles if s.duration == 0]
    subtitles = client.filter_by_max_duration(with_dur, max_duration_ms) + without_dur

    if not subtitles:
        _print_status("✗", "No subtitles found")
        return ScanResult(movie_path, movie_name, ScanStatus.no_match, "No subtitles within duration")

    # ---- dump 模式：全量下载 + 内容去重 ----
    if dump_mode:
        return _dump_all_subtitles(movie_path, movie_name, subtitles)

    # 按 API 原始顺序排（第一条 = 最新上传）
    orig_order = {id(s): i for i, s in enumerate(result.subtitles)}
    by_api = sorted(subtitles, key=lambda s: orig_order.get(id(s), 9999))
    primary = by_api[0]  # 主力：API 第一条

    # 按优先级排（偏好字幕组 > 中文 > duration）
    preferred = config.preferred_groups_list
    subtitles.sort(key=lambda s: (
        0 if _has_preferred_group(s, preferred) else 1,
        0 if client.is_chinese_subtitle(s) else 1,
        -s.duration,
    ))
    alt = subtitles[0]  # 备选：算法最佳

    # 去重
    if alt is primary and len(by_api) > 1:
        alt = by_api[1]

    # 统计信息
    pref_count = sum(1 for s in subtitles if _has_preferred_group(s, preferred))
    cn_count = sum(1 for s in subtitles if client.is_chinese_subtitle(s))
    parts = []
    if preferred:
        parts.append(f"Pref: {pref_count}")
    parts.append(f"Chinese: {cn_count}")
    print(f"{DIM}    {', '.join(parts)}, Primary: {primary.name}{RESET}")

    # 组装下载列表
    to_download: list[tuple] = []
    pfx = ".zh" if client.is_chinese_subtitle(primary) else ""
    to_download.append((primary, f"{movie_name}{pfx}.{primary.ext}"))

    if alt is not primary:
        to_download.append((alt, f"{movie_name}-alt.zh.{alt.ext}"))

    # 下载
    downloaded_files = []
    for sub, fname in to_download:
        tag = " [alt]" if "-alt" in fname else " [primary]"
        print(f"{DIM}    Downloading{tag}: {sub.name} → {fname}{RESET}")
        dl = download_subtitle(sub, movie_path, custom_filename=fname,
                               max_retries=config.retry_count,
                               retry_delay=config.retry_delay)
        if dl.success:
            downloaded_files.append(dl.filename)
        else:
            print(f"{RED}    ✗ Download failed: {dl.error}{RESET}")

    if downloaded_files:
        _print_status("✓", f"Downloaded: {', '.join(downloaded_files)}", green=True)
        return ScanResult(movie_path, movie_name, ScanStatus.downloaded, filename=", ".join(downloaded_files))

    _print_status("✗", "All downloads failed")
    return ScanResult(movie_path, movie_name, ScanStatus.error, "All downloads failed")


def _dump_all_subtitles(movie_path: str, movie_name: str, subtitles: list) -> ScanResult:
    """全量下载字幕，gcid 去重 + 增量跳过"""
    rejected = _load_gcids(movie_path, ".rejected")
    dumped_path = os.path.join(movie_path, ".dumped")
    # 清空旧的 .dumped（避免上次残留）
    try:
        open(dumped_path, "w").close()
    except OSError:
        pass
    r = dump_subtitles(subtitles, movie_path, rejected, dumped_path=dumped_path)

    parts = []
    if r.dupes > 0:
        parts.append(f"{r.dupes} dupes")
    if r.skipped > 0:
        parts.append(f"{r.skipped} rejected")
    dup_msg = f" ({', '.join(parts)})" if parts else ""
    _print_status("✓", f"Dumped {r.downloaded}/{len(subtitles)}{dup_msg}", green=True)
    return ScanResult(movie_path, movie_name, ScanStatus.downloaded, filename=f"dumped {r.downloaded} files")


def _load_gcids(movie_path: str, filename: str) -> set[str]:
    """加载 gcid 文件，每行一个"""
    path = os.path.join(movie_path, filename)
    if not os.path.isfile(path):
        return set()
    try:
        with open(path, "r", encoding="utf-8") as f:
            return {line.strip() for line in f if line.strip()}
    except OSError:
        return set()


def _content_fingerprint(filepath: str) -> str | None:
    """字幕内容指纹：纯文本行，去序号和时间轴"""
    try:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            text = f.read()
    except OSError:
        return None

    lines = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.isdigit():
            continue
        if "-->" in line and ":" in line:
            continue
        if line.startswith("[") and line.endswith("]"):
            continue
        if line.startswith("Dialogue:") or line.startswith("Format:"):
            continue
        lines.append(line)

    if not lines:
        return None

    h = hashlib.md5()
    h.update("\n".join(lines).encode("utf-8"))
    return h.hexdigest()


# ---- 输出辅助 ----

def _print_status(marker: str, msg: str, green: bool = False) -> None:
    """统一状态输出"""
    color = GREEN if green else DIM
    print(f"{color}    {marker} {msg}{RESET}")
