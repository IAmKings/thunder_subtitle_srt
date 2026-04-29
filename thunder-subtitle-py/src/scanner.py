"""
Jellyfin 目录扫描器 - 扫描演员/电影目录，自动搜索并下载字幕
"""

import os
import re
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass

from .api import SubtitleApiClient
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


def scan_movie_dirs(base_dir: str) -> list[str]:
    """
    扫描 Jellyfin 目录结构，自动识别两种模式：
      - 媒体库根目录：base_dir/演员/电影/movie.nfo
      - 单个演员目录：base_dir/电影/movie.nfo
    返回包含 movie.nfo 的电影目录路径列表
    """
    movie_dirs: list[str] = []

    if not os.path.isdir(base_dir):
        return movie_dirs

    # 检测是否为演员目录：直接子目录下是否有 movie.nfo
    for entry in sorted(os.listdir(base_dir)):
        entry_path = os.path.join(base_dir, entry)
        if not os.path.isdir(entry_path) or entry.startswith("."):
            continue
        nfo_path = os.path.join(entry_path, "movie.nfo")
        if os.path.isfile(nfo_path):
            # 演员目录模式：base_dir 直接包含电影目录
            return _scan_actor_dir(base_dir)

    # 媒体库根目录模式：base_dir/演员/电影/
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
        nfo_path = os.path.join(movie_path, "movie.nfo")
        if os.path.isfile(nfo_path):
            movie_dirs.append(movie_path)
    return movie_dirs


def parse_nfo(nfo_path: str) -> NfoInfo:
    """
    解析 movie.nfo XML 文件
    提取时长和中文状态
    """
    tree = ET.parse(nfo_path)
    root = tree.getroot()

    info = NfoInfo()

    # 提取 durationinseconds（路径：fileinfo > streamdetails > video > durationinseconds）
    fileinfo = root.find(".//fileinfo")
    if fileinfo is not None:
        streamdetails = fileinfo.find("streamdetails")
        if streamdetails is not None:
            video = streamdetails.find("video")
            if video is not None:
                dur_elem = video.find("durationinseconds")
                if dur_elem is not None and dur_elem.text:
                    try:
                        info.duration_seconds = int(dur_elem.text.strip())
                    except (ValueError, TypeError):
                        info.duration_seconds = 0

    # 检查是否已有中文字幕标记：遍历所有元素
    for elem in root.iter():
        if elem.text and "中文字幕" in elem.text:
            info.has_chinese_subtitle = True
            break

    return info


def _has_u_suffix(subtitle) -> bool:
    """检测字幕名称是否以 -U 结尾（可用度最高标记）"""
    return bool(re.search(r"-u\.\w+$", subtitle.name, re.IGNORECASE))


def process_scanned_movies(
    base_dir: str,
    dry_run: bool = False,
    name_filter: str = "",
) -> list[ScanResult]:
    """
    扫描并处理所有电影目录
    name_filter: 电影名包含此关键词才处理（空字符串 = 全部处理）
    """
    movie_dirs = scan_movie_dirs(base_dir)

    # 按电影名过滤
    if name_filter:
        movie_dirs = [
            d for d in movie_dirs
            if name_filter.lower() in os.path.basename(d).lower()
        ]

    if not movie_dirs:
        if name_filter:
            print(f"\033[90m  No movies matching \"{name_filter}\" found.\033[0m\n")
        else:
            print(f"\033[90m  No movie directories with movie.nfo found.\033[0m\n")
        return []

    if name_filter:
        print(f"\033[1m\n  Found {len(movie_dirs)} movie(s) matching \"{name_filter}\"\033[0m\n")
    else:
        print(f"\033[1m\n  Found {len(movie_dirs)} movie(s) to process\033[0m\n")

    client = SubtitleApiClient()
    results: list[ScanResult] = []
    has_queried = False  # 用于请求间隔控制

    for i, movie_path in enumerate(movie_dirs, 1):
        movie_name = os.path.basename(movie_path)
        actor_name = os.path.basename(os.path.dirname(movie_path))
        label = f"{actor_name}/{movie_name}"

        print(f"\033[33m  [{i}/{len(movie_dirs)}]\033[0m \033[1m{label}\033[0m")

        nfo_path = os.path.join(movie_path, "movie.nfo")

        try:
            nfo = parse_nfo(nfo_path)
        except ET.ParseError as e:
            print(f"\033[90m    ✗ Invalid XML: {e}\033[0m")
            results.append(ScanResult(
                movie_path=movie_path,
                movie_name=movie_name,
                status="error",
                reason=f"NFO parse error: {e}",
            ))
            continue
        except FileNotFoundError:
            print(f"\033[90m    ✗ movie.nfo not found\033[0m")
            results.append(ScanResult(
                movie_path=movie_path,
                movie_name=movie_name,
                status="error",
                reason="movie.nfo not found",
            ))
            continue

        # 已有中文字幕标记在 NFO 中，跳过
        if nfo.has_chinese_subtitle:
            print(f"\033[90m    ✓ NFO has Chinese subtitle tag, skipped\033[0m")
            results.append(ScanResult(
                movie_path=movie_path,
                movie_name=movie_name,
                status="skipped",
                reason="NFO has Chinese subtitle tag",
            ))
            continue

        # 已存在 .zh.srt 字幕文件，跳过
        zh_srt_path = os.path.join(movie_path, f"{movie_name}.zh.srt")
        if os.path.isfile(zh_srt_path):
            print(f"\033[90m    ✓ {movie_name}.zh.srt already exists, skipped\033[0m")
            results.append(ScanResult(
                movie_path=movie_path,
                movie_name=movie_name,
                status="skipped",
                reason="Chinese subtitle file already exists",
            ))
            continue

        # 无时长信息
        duration_str = seconds_to_duration_str(nfo.duration_seconds)
        if not duration_str:
            print(f"\033[90m    ✗ No duration info in NFO\033[0m")
            results.append(ScanResult(
                movie_path=movie_path,
                movie_name=movie_name,
                status="error",
                reason="Missing duration in movie.nfo",
            ))
            continue

        print(f"\033[90m    Duration: {duration_str}\033[0m")

        if dry_run:
            print(f"\033[90m    [DRY RUN] Would search: \"{movie_name}\" -d {duration_str}\033[0m")
            continue

        # 搜索字幕（非首次查询间隔 3 秒，避免请求过频）
        try:
            if has_queried:
                time.sleep(3)
            has_queried = True

            result = client.search_subtitles(movie_name)

            if result.total == 0:
                print(f"\033[90m    ✗ No subtitles found\033[0m")
                results.append(ScanResult(
                    movie_path=movie_path,
                    movie_name=movie_name,
                    status="no_match",
                    reason="No subtitles found",
                ))
                continue

            # 按时长筛选（保留所有语言，后续再按优先级排序）
            subtitles = result.subtitles
            max_duration_ms = nfo.duration_seconds * 1000
            subtitles = client.filter_by_max_duration(subtitles, max_duration_ms)

            if not subtitles:
                print(f"\033[90m    ✗ No matching subtitles within duration\033[0m")
                results.append(ScanResult(
                    movie_path=movie_path,
                    movie_name=movie_name,
                    status="no_match",
                    reason="No subtitles within duration",
                ))
                continue

            u_count = sum(1 for s in subtitles if _has_u_suffix(s))
            cn_count = sum(1 for s in subtitles if client.is_chinese_subtitle(s))

            # 按 API 原始顺序排序（第一条 = 最新上传）
            orig_order = {id(s): i for i, s in enumerate(result.subtitles)}
            subtitles_by_api = sorted(subtitles, key=lambda s: orig_order.get(id(s), 9999))

            # 主字幕：API 返回第一条（80% 场景翻译质量最高）
            primary = subtitles_by_api[0]

            # 备选字幕：优先级算法最佳（-U > 中文 > duration）
            subtitles.sort(key=lambda s: (
                0 if _has_u_suffix(s) else 1,
                0 if client.is_chinese_subtitle(s) else 1,
                -s.duration,
            ))
            best = subtitles[0]

            # 去重：算法最佳和主字幕同一个时，后延取 API 顺序第二条
            if best is primary and len(subtitles_by_api) > 1:
                best = subtitles_by_api[1]

            to_download: list[tuple] = []

            # 主字幕
            primary_suffix = ".zh" if client.is_chinese_subtitle(primary) else ""
            primary_filename = f"{movie_name}{primary_suffix}.{primary.ext}"
            to_download.append((primary, primary_filename))

            # 备选字幕
            if best is not primary:
                alt_filename = f"{movie_name}-alt.zh.{best.ext}"
                to_download.append((best, alt_filename))

            if u_count:
                print(f"\033[90m    -U: {u_count}, Chinese: {cn_count}, Primary (newest): {primary.name}\033[0m")
            else:
                print(f"\033[90m    Chinese: {cn_count}, Primary (newest): {primary.name}\033[0m")

            # 执行下载
            downloaded_files = []
            for sub, fname in to_download:
                is_alt = "-alt" in fname
                tag = " [alt]" if is_alt else " [primary]"
                print(f"\033[90m    Downloading{tag}: {sub.name} → {fname}\033[0m")

                dl_result = download_subtitle(sub, movie_path, custom_filename=fname)

                if dl_result.success:
                    downloaded_files.append(dl_result.filename)
                else:
                    print(f"\033[31m    ✗ Download failed: {dl_result.error}\033[0m")

            if downloaded_files:
                print(f"\033[32m    ✓ Downloaded: {', '.join(downloaded_files)}\033[0m")
                results.append(ScanResult(
                    movie_path=movie_path,
                    movie_name=movie_name,
                    status="downloaded",
                    filename=", ".join(downloaded_files),
                ))
            else:
                print(f"\033[31m    ✗ All downloads failed\033[0m")
                results.append(ScanResult(
                    movie_path=movie_path,
                    movie_name=movie_name,
                    status="error",
                    reason="All downloads failed",
                ))

        except Exception as e:
            print(f"\033[31m    ✗ Error: {e}\033[0m")
            results.append(ScanResult(
                movie_path=movie_path,
                movie_name=movie_name,
                status="error",
                reason=str(e),
            ))

    # 汇总
    print()
    _print_scan_summary(results)

    return results


def _print_scan_summary(results: list[ScanResult]) -> None:
    """打印扫描汇总"""
    downloaded = sum(1 for r in results if r.status == "downloaded")
    skipped = sum(1 for r in results if r.status == "skipped")
    no_match = sum(1 for r in results if r.status == "no_match")
    errors = sum(1 for r in results if r.status == "error")

    print(f"\033[1m  Scan Summary:\033[0m")
    if downloaded > 0:
        print(f"\033[32m    ✓ Downloaded: {downloaded}\033[0m")
    if skipped > 0:
        print(f"\033[90m    - Skipped: {skipped}\033[0m")
    if no_match > 0:
        print(f"\033[33m    - No match: {no_match}\033[0m")
    if errors > 0:
        print(f"\033[31m    ✗ Errors: {errors}\033[0m")
    print()
