"""
Jellyfin 目录扫描器 - 扫描演员/电影目录，自动搜索并下载字幕
"""

import os
import re
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass

from .api import SubtitleApiClient
from .config import Config
from .download import download_subtitle
from .utils import seconds_to_duration_str


@dataclass
class NfoInfo:
    """movie.nfo 解析结果"""
    duration_seconds: int = 0
    has_chinese_subtitle: bool = False


@dataclass
class ScanResult:
    """单个电影处理结果"""
    movie_path: str
    movie_name: str
    status: str  # "skipped" | "downloaded" | "no_match" | "error"
    reason: str = ""
    filename: str = ""


# ---- 目录扫描 ----

def scan_movie_dirs(base_dir: str) -> list[str]:
    """
    扫描 Jellyfin 目录结构，自动识别两种模式：
      - 媒体库根目录：base_dir/演员/电影/movie.nfo
      - 单个演员目录：base_dir/电影/movie.nfo
    """
    movie_dirs: list[str] = []

    if not os.path.isdir(base_dir):
        return movie_dirs

    # 检测是否为演员目录：直接子目录下是否有 movie.nfo
    for entry in sorted(os.listdir(base_dir)):
        entry_path = os.path.join(base_dir, entry)
        if not os.path.isdir(entry_path) or entry.startswith("."):
            continue
        if os.path.isfile(os.path.join(entry_path, "movie.nfo")):
            return _scan_actor_dir(base_dir)

    # 媒体库根目录模式
    for actor_name in sorted(os.listdir(base_dir)):
        actor_path = os.path.join(base_dir, actor_name)
        if not os.path.isdir(actor_path) or actor_name.startswith("."):
            continue
        movie_dirs.extend(_scan_actor_dir(actor_path))

    return movie_dirs


def _scan_actor_dir(actor_path: str) -> list[str]:
    """扫描单个演员目录下的电影目录"""
    movie_dirs: list[str] = []
    for movie_name in sorted(os.listdir(actor_path)):
        movie_path = os.path.join(actor_path, movie_name)
        if not os.path.isdir(movie_path) or movie_name.startswith("."):
            continue
        if os.path.isfile(os.path.join(movie_path, "movie.nfo")):
            movie_dirs.append(movie_path)
    return movie_dirs


# ---- NFO 解析 ----

def parse_nfo(nfo_path: str) -> NfoInfo:
    """解析 movie.nfo XML 文件，提取时长和中文状态"""
    tree = ET.parse(nfo_path)
    root = tree.getroot()
    info = NfoInfo()

    # durationinseconds：fileinfo > streamdetails > video > durationinseconds
    video = _find_elem(root, (".//fileinfo", "streamdetails", "video"))
    if video is not None:
        dur_elem = video.find("durationinseconds")
        if dur_elem is not None and dur_elem.text:
            try:
                info.duration_seconds = int(dur_elem.text.strip())
            except (ValueError, TypeError):
                info.duration_seconds = 0

    # 检查是否已有中文字幕标记
    for elem in root.iter():
        if elem.text and "中文字幕" in elem.text:
            info.has_chinese_subtitle = True
            break

    return info


def _find_elem(parent, tags: tuple[str, ...]):
    """按层级路径查找 XML 元素"""
    node = parent
    for tag in tags:
        if node is None:
            return None
        node = node.find(tag)
    return node


# ---- 字幕筛选辅助 ----

def _has_u_suffix(subtitle) -> bool:
    """字幕名称是否以 -U 结尾（可用度最高标记）"""
    return bool(re.search(r"-u\.\w+$", subtitle.name, re.IGNORECASE))


def _existing_subtitle_file(movie_path: str, movie_name: str) -> str | None:
    """检查目录中是否已有字幕文件，返回找到的文件名"""
    for ext in ("zh.srt", "srt", "zh.ass", "ass", "zh.ssa", "ssa", "zh.sub", "sub", "zh.vtt", "vtt"):
        path = os.path.join(movie_path, f"{movie_name}.{ext}")
        if os.path.isfile(path):
            return f"{movie_name}.{ext}"
    return None


# ---- 主流程 ----

def process_scanned_movies(
    base_dir: str,
    dry_run: bool = False,
    name_filters: list[str] | None = None,
    config: Config | None = None,
) -> list[ScanResult]:
    """扫描并处理所有电影目录"""
    if config is None:
        config = Config.load()

    movie_dirs = _apply_filters(scan_movie_dirs(base_dir), name_filters)
    if not movie_dirs:
        return []

    client = SubtitleApiClient()
    results: list[ScanResult] = []
    has_queried = False

    for i, movie_path in enumerate(movie_dirs, 1):
        actor_name = os.path.basename(os.path.dirname(movie_path))
        movie_name = os.path.basename(movie_path)
        label = f"{actor_name}/{movie_name}"

        print(f"\033[33m  [{i}/{len(movie_dirs)}]\033[0m \033[1m{label}\033[0m")

        # 查询间隔控制
        if has_queried and config.rate_limit > 0:
            time.sleep(config.rate_limit)

        result = _process_one_movie(
            movie_path, movie_name, dry_run, client, config, has_queried
        )
        results.append(result)

        if result.status in ("downloaded", "no_match"):
            has_queried = True

    _print_scan_summary(results)
    return results


def _apply_filters(movie_dirs: list[str], name_filters: list[str] | None) -> list[str]:
    """按电影名过滤"""
    if not name_filters:
        if movie_dirs:
            print(f"\033[1m\n  Found {len(movie_dirs)} movie(s) to process\033[0m\n")
        else:
            print(f"\033[90m  No movie directories with movie.nfo found.\033[0m\n")
        return movie_dirs

    filtered = [
        d for d in movie_dirs
        if any(f.lower() in os.path.basename(d).lower() for f in name_filters)
    ]
    if filtered:
        kw = ", ".join(name_filters)
        print(f"\033[1m\n  Found {len(filtered)} movie(s) matching [{kw}]\033[0m\n")
    else:
        kw = ", ".join(name_filters)
        print(f"\033[90m  No movies matching [{kw}] found.\033[0m\n")
    return filtered


def _process_one_movie(
    movie_path: str,
    movie_name: str,
    dry_run: bool,
    client: SubtitleApiClient,
    config: Config,
    has_queried: bool,
) -> ScanResult:
    """处理单部电影：解析 NFO → 跳过检查 → 搜索 → 下载"""

    # ---- NFO 解析 ----
    nfo_path = os.path.join(movie_path, "movie.nfo")
    try:
        nfo = parse_nfo(nfo_path)
    except ET.ParseError as e:
        _print_status("✗", f"Invalid XML: {e}")
        return ScanResult(movie_path, movie_name, "error", f"NFO parse error: {e}")
    except FileNotFoundError:
        _print_status("✗", "movie.nfo not found")
        return ScanResult(movie_path, movie_name, "error", "movie.nfo not found")

    # ---- 跳过检查 ----
    skip_reason = _check_skip(movie_path, movie_name, nfo)
    if skip_reason:
        _print_status("✓", skip_reason)
        return ScanResult(movie_path, movie_name, "skipped", skip_reason)

    duration_str = seconds_to_duration_str(nfo.duration_seconds)
    if not duration_str:
        _print_status("✗", "No duration info in NFO")
        return ScanResult(movie_path, movie_name, "error", "Missing duration in movie.nfo")

    print(f"\033[90m    Duration: {duration_str}\033[0m")

    if dry_run:
        print(f"\033[90m    [DRY RUN] Would search: \"{movie_name}\" -d {duration_str}\033[0m")
        return ScanResult(movie_path, movie_name, "skipped", "dry-run")

    # ---- 搜索 + 下载 ----
    try:
        return _search_and_download(movie_path, movie_name, nfo, client)
    except Exception as e:
        print(f"\033[31m    ✗ Error: {e}\033[0m")
        return ScanResult(movie_path, movie_name, "error", str(e))


def _check_skip(movie_path: str, movie_name: str, nfo: NfoInfo) -> str | None:
    """检查是否应跳过该电影，返回跳过原因或 None"""
    if nfo.has_chinese_subtitle:
        return "NFO has Chinese subtitle tag"

    existing = _existing_subtitle_file(movie_path, movie_name)
    if existing:
        return f"{existing} already exists"

    return None


def _search_and_download(
    movie_path: str,
    movie_name: str,
    nfo: NfoInfo,
    client: SubtitleApiClient,
) -> ScanResult:
    """搜索字幕并下载（主力 + 备选）"""
    result = client.search_subtitles(movie_name)

    if result.total == 0:
        _print_status("✗", "No subtitles found")
        return ScanResult(movie_path, movie_name, "no_match", "No subtitles found")

    # 按时长筛选：有时长的在前，duration=0 的保留在后
    max_duration_ms = nfo.duration_seconds * 1000
    with_dur = [s for s in result.subtitles if s.duration > 0]
    without_dur = [s for s in result.subtitles if s.duration == 0]
    subtitles = client.filter_by_max_duration(with_dur, max_duration_ms) + without_dur

    if not subtitles:
        _print_status("✗", "No subtitles found")
        return ScanResult(movie_path, movie_name, "no_match", "No subtitles within duration")

    # 按 API 原始顺序排（第一条 = 最新上传）
    orig_order = {id(s): i for i, s in enumerate(result.subtitles)}
    by_api = sorted(subtitles, key=lambda s: orig_order.get(id(s), 9999))
    primary = by_api[0]  # 主力：API 第一条

    # 按优先级排（-U > 中文 > duration）
    subtitles.sort(key=lambda s: (
        0 if _has_u_suffix(s) else 1,
        0 if client.is_chinese_subtitle(s) else 1,
        -s.duration,
    ))
    alt = subtitles[0]  # 备选：算法最佳

    # 去重
    if alt is primary and len(by_api) > 1:
        alt = by_api[1]

    # 统计信息
    u_count = sum(1 for s in subtitles if _has_u_suffix(s))
    cn_count = sum(1 for s in subtitles if client.is_chinese_subtitle(s))
    if u_count:
        print(f"\033[90m    -U: {u_count}, Chinese: {cn_count}, Primary: {primary.name}\033[0m")
    else:
        print(f"\033[90m    Chinese: {cn_count}, Primary: {primary.name}\033[0m")

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
        print(f"\033[90m    Downloading{tag}: {sub.name} → {fname}\033[0m")
        dl = download_subtitle(sub, movie_path, custom_filename=fname)
        if dl.success:
            downloaded_files.append(dl.filename)
        else:
            print(f"\033[31m    ✗ Download failed: {dl.error}\033[0m")

    if downloaded_files:
        _print_status("✓", f"Downloaded: {', '.join(downloaded_files)}", green=True)
        return ScanResult(movie_path, movie_name, "downloaded", filename=", ".join(downloaded_files))

    _print_status("✗", "All downloads failed")
    return ScanResult(movie_path, movie_name, "error", "All downloads failed")


# ---- 输出辅助 ----

def _print_status(marker: str, msg: str, green: bool = False) -> None:
    """统一状态输出"""
    color = "\033[32m" if green else "\033[90m"
    print(f"{color}    {marker} {msg}\033[0m")


def _print_scan_summary(results: list[ScanResult]) -> None:
    """打印扫描汇总"""
    counts = {"downloaded": 0, "skipped": 0, "no_match": 0, "error": 0}
    for r in results:
        if r.status in counts:
            counts[r.status] += 1

    print()
    print(f"\033[1m  Scan Summary:\033[0m")
    if counts["downloaded"] > 0:
        print(f"\033[32m    ✓ Downloaded: {counts['downloaded']}\033[0m")
    if counts["skipped"] > 0:
        print(f"\033[90m    - Skipped: {counts['skipped']}\033[0m")
    if counts["no_match"] > 0:
        print(f"\033[33m    - No match: {counts['no_match']}\033[0m")
    if counts["error"] > 0:
        print(f"\033[31m    ✗ Errors: {counts['error']}\033[0m")
    print()
