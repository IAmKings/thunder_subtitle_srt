"""单部电影处理：NFO解析 → 跳过检查 → 搜索 → 下载"""

import hashlib
import os
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime

from ..api import SubtitleApiClient
from ..config import Config
from ..download import download_subtitle, dump_subtitles
from ..types import ScanStatus, DryState
from ..ui import BOLD, BOLD_CYAN, DIM, GREEN, RED, RESET, YELLOW
from ..utils import NfoInfo, parse_nfo, seconds_to_duration_str

from ._dir import scan_movie_dirs


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
    name_lower = subtitle.name.lower()
    return any(g.lower() in name_lower for g in groups)


def _existing_subtitle_file(movie_path: str, movie_name: str) -> str | None:
    """检查目录中是否已有字幕文件（含标准命名和dump数字命名）"""
    # 标准命名：{movie_name}{.zh}.{ext}
    for ext in ("zh.srt", "srt", "zh.ass", "ass", "zh.ssa", "ssa", "zh.sub", "sub", "zh.vtt", "vtt"):
        path = os.path.join(movie_path, f"{movie_name}.{ext}")
        if os.path.isfile(path):
            return f"{movie_name}.{ext}"
    # dump 数字命名：1.srt, 2.ass, ...
    return _find_dump_subtitle(movie_path)


def _find_dump_subtitle(movie_path: str) -> str | None:
    """查找 dump 模式下载的字幕文件（1.srt, 2.ass, ...）"""
    try:
        for fname in sorted(os.listdir(movie_path)):
            base, ext = os.path.splitext(fname)
            if base.isdigit() and ext.lower() in (".srt", ".ass", ".ssa", ".sub", ".vtt"):
                return fname
    except OSError:
        pass
    return None


# ---- 跳过检查 ----

def _has_zh_prefix(filename: str) -> bool:
    """检查文件名是否包含 .zh. 标识"""
    return ".zh." in filename


def _is_review_fail(reviewed_file: str) -> bool:
    """检查 .reviewed 文件是否标记为审查不及格"""
    try:
        with open(reviewed_file, "r", encoding="utf-8") as f:
            return f.read().strip().lower() == "fail"
    except OSError:
        return False


def _check_skip(
    movie_path: str, movie_name: str, nfo, dry_run: bool = False,
    min_age_days: int = 0, force: bool = False, reset_fail: bool = False,
) -> tuple[str | None, str]:
    """
    检查是否应跳过该电影，返回 (跳过原因或None, dry_run_state)
    dry_state: need_download / need_review / reviewed_ok / reviewed_fail / skipped / ""
    """
    dry_state = ""

    # 审查失败处理
    reviewed_file = os.path.join(movie_path, ".reviewed")
    is_fail = _is_review_fail(reviewed_file)

    # reset-fail：清除审查失败标记 + 已拒绝指纹（最优先）
    if reset_fail and is_fail:
        if dry_run:
            print(f"{YELLOW}    ⚠ Would reset mark-fail → need review{RESET}")
        else:
            os.remove(reviewed_file)
            rejected = os.path.join(movie_path, ".rejected")
            if os.path.isfile(rejected):
                os.remove(rejected)
            print(f"{GREEN}    ✓ Mark-fail cleared, status reset{RESET}")
        is_fail = False

    # 审查失败硬跳过（force 模式可覆盖）
    if is_fail and not force:
        if dry_run:
            has_new_subs = bool(_find_dump_subtitle(movie_path))
            if has_new_subs:
                print(f"{YELLOW}    ⚠ Review FAILED but new subtitles exist — needs re-review{RESET}")
            else:
                print(f"{RED}    ✗ Review FAILED — find subtitles elsewhere{RESET}")
        return ("Review FAILED — find subtitles elsewhere", DryState.reviewed_fail if dry_run else DryState.reviewed_fail)

    # force 模式覆盖 mark-fail：下载但不重置状态
    if force and is_fail:
        print(f"{YELLOW}    ⚠ Force refresh: bypassing mark-fail (state kept){RESET}")

    # dry-run 时检查状态提示
    if dry_run:
        has_sub = bool(_existing_subtitle_file(movie_path, movie_name)) or nfo.has_chinese_subtitle
        if has_sub:
            if not os.path.isfile(reviewed_file):
                dry_state = DryState.need_review
                print(f"{YELLOW}    ⚠ Not yet reviewed — run: thunder-subtitle review{RESET}")
            else:
                dry_state = DryState.reviewed_ok
                print(f"{GREEN}    ✓ Reviewed{RESET}")
        else:
            dry_state = DryState.need_download
            print(f"{DIM}    ◇ No subtitles — will download{RESET}")

    if nfo.has_chinese_subtitle and not (force and is_fail):
        return ("NFO has Chinese subtitle tag", dry_state)

    # 发布日期检查：新片不满 min_age_days 天跳过
    if min_age_days > 0 and nfo.release_date:
        try:
            rd = datetime.strptime(nfo.release_date[:10], "%Y-%m-%d")  # noqa: DTZ007
            age = (datetime.now() - rd).days
            if age < min_age_days:
                return (f"Released {age}d ago (< {min_age_days}d), skip", ScanStatus.skipped)
        except (ValueError, IndexError):
            pass

    existing = _existing_subtitle_file(movie_path, movie_name)
    if existing and not (force and is_fail):
        if dry_run and not _has_zh_prefix(existing):
            print(f"{YELLOW}    ⚠ {existing} lacks .zh prefix, may not be Chinese subtitle{RESET}")
        return (f"{existing} already exists", dry_state)

    return (None, DryState.need_download if dry_run else "")


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
    except Exception as e:
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
