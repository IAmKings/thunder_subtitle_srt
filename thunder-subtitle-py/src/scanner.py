"""
Jellyfin 目录扫描器 - 扫描演员/电影目录，自动搜索并下载字幕
"""

import hashlib
import os
import re
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime

from .api import SubtitleApiClient
from .config import Config
from .download import download_subtitle
from .utils import seconds_to_duration_str


@dataclass
class NfoInfo:
    """movie.nfo 解析结果"""
    duration_seconds: int = 0
    has_chinese_subtitle: bool = False
    release_date: str = ""  # YYYY-MM-DD


@dataclass
class ScanResult:
    """单个电影处理结果"""
    movie_path: str
    movie_name: str
    status: str  # "skipped" | "downloaded" | "no_match" | "error"
    reason: str = ""
    filename: str = ""
    dry_state: str = ""  # dry-run 状态: need_download/need_review/reviewed_ok/reviewed_fail/skipped


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

    # releasedate（年-月-日格式）
    rd = root.find("releasedate")
    if rd is not None and rd.text:
        info.release_date = rd.text.strip()

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
    """检查目录中是否有 dump 模式的数字命名字幕文件"""
    sub_exts = {".srt", ".ass", ".ssa", ".sub", ".vtt"}
    try:
        for fname in os.listdir(movie_path):
            base, ext = os.path.splitext(fname)
            if ext.lower() in sub_exts and base.isdigit():
                return fname
    except OSError:
        pass
    return None


# ---- 主流程 ----

def process_scanned_movies(
    base_dir: str,
    dry_run: bool = False,
    name_filters: list[str] | None = None,
    config: Config | None = None,
    resume: bool = False,
    log: bool = False,
    min_age_days: int = 0,
    dump_mode: bool = False,
    force: bool = False,
) -> list[ScanResult]:
    """扫描并处理所有电影目录（force=True 时覆盖 mark-fail 跳过）"""
    if config is None:
        config = Config.load()

    log_path = ""
    if log:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_path = os.path.join(base_dir, f"scan_{ts}.log")

    progress_file = os.path.join(base_dir, ".scan-progress")

    movie_dirs = _apply_filters(scan_movie_dirs(base_dir), name_filters)
    if not movie_dirs:
        return []

    # 断点续扫：加载已完成的电影列表，跳过
    completed_paths: set[str] = set()
    if resume and os.path.isfile(progress_file):
        with open(progress_file, "r", encoding="utf-8") as f:
            completed_paths = {line.strip() for line in f if line.strip()}
        skipped_count = sum(1 for d in movie_dirs if d in completed_paths)
        movie_dirs = [d for d in movie_dirs if d not in completed_paths]
        if skipped_count > 0:
            print(f"\033[90m  Resuming: {skipped_count} already done, {len(movie_dirs)} remaining\033[0m")

    if not movie_dirs:
        print(f"\033[90m  All movies already processed, nothing to do.\033[0m\n")
        return []

    client = SubtitleApiClient()
    results: list[ScanResult] = []
    has_queried = False

    for i, movie_path in enumerate(movie_dirs, 1):
        actor_name = os.path.basename(os.path.dirname(movie_path))
        movie_name = os.path.basename(movie_path)
        label = f"{actor_name}/{movie_name}"

        print(f"\033[33m  [{i}/{len(movie_dirs)}]\033[0m \033[1m{label}\033[0m", flush=True)

        result = _process_one_movie(
            movie_path, movie_name, dry_run, client, config, has_queried, min_age_days, dump_mode, force
        )
        results.append(result)

        if result.status in ("downloaded", "no_match"):
            has_queried = True

        # 断点续扫：记录已处理电影
        if resume and result.status != "error":
            _save_progress(progress_file, movie_path)

        # 日志：写入结果
        if log_path:
            _write_log(log_path, movie_path, result)

    # 全部完成，清理进度文件
    if resume and os.path.isfile(progress_file):
        os.remove(progress_file)

    _print_scan_summary(results)

    # 日志：写入汇总
    if log_path:
        _write_log_summary(log_path, results)
        print(f"\033[90m  Log saved: {log_path}\033[0m\n")

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
    min_age_days: int = 0,
    dump_mode: bool = False,
    force: bool = False,
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
    skip_reason, dry_state = _check_skip(movie_path, movie_name, nfo, dry_run, min_age_days, force)
    if skip_reason:
        _print_status("✓", skip_reason)
        return ScanResult(movie_path, movie_name, "skipped", skip_reason, dry_state=dry_state)

    duration_str = seconds_to_duration_str(nfo.duration_seconds)
    if not duration_str:
        _print_status("✗", "No duration info in NFO")
        return ScanResult(movie_path, movie_name, "error", "Missing duration in movie.nfo")

    print(f"\033[90m    Duration: {duration_str}\033[0m")

    if dry_run:
        print(f"\033[90m    [DRY RUN] Would search: \"{movie_name}\" -d {duration_str}\033[0m")
        return ScanResult(movie_path, movie_name, "skipped", "dry-run", dry_state=dry_state)

    # ---- 搜索 + 下载 ----
    try:
        return _search_and_download(movie_path, movie_name, nfo, client, config, has_queried, dump_mode)
    except Exception as e:
        print(f"\033[31m    ✗ Error: {e}\033[0m")
        return ScanResult(movie_path, movie_name, "error", str(e))


def _check_skip(movie_path: str, movie_name: str, nfo: NfoInfo, dry_run: bool = False, min_age_days: int = 0, force: bool = False) -> tuple[str | None, str]:
    """
    检查是否应跳过该电影，返回 (跳过原因或None, dry_run_state)
    dry_state: need_download / need_review / reviewed_ok / reviewed_fail / skipped / ""
    """
    dry_state = ""

    # 审查失败硬跳过（最高优先级，force 模式可覆盖）
    reviewed_file = os.path.join(movie_path, ".reviewed")
    if _is_review_fail(reviewed_file) and not force:
        if dry_run:
            print(f"\033[31m    ✗ Review FAILED — find subtitles elsewhere\033[0m")
        return ("Review FAILED — find subtitles elsewhere", "reviewed_fail" if dry_run else "reviewed_fail")

    # force 模式覆盖 mark-fail：移除 .reviewed 重置状态（非 dry-run）
    if force and _is_review_fail(reviewed_file):
        if not dry_run:
            os.remove(reviewed_file)
        print(f"\033[33m    ⚠ Force refresh: mark-fail cleared, will re-download\033[0m")

    # dry-run 时检查状态提示
    if dry_run:
        has_sub = bool(_existing_subtitle_file(movie_path, movie_name)) or nfo.has_chinese_subtitle
        if has_sub:
            if not os.path.isfile(reviewed_file):
                dry_state = "need_review"
                print(f"\033[33m    ⚠ Not yet reviewed — run: thunder-subtitle review\033[0m")
            else:
                dry_state = "reviewed_ok"
                print(f"\033[32m    ✓ Reviewed\033[0m")
        else:
            dry_state = "need_download"
            print(f"\033[90m    ◇ No subtitles — will download\033[0m")

    if nfo.has_chinese_subtitle:
        return ("NFO has Chinese subtitle tag", dry_state)

    # 发布日期检查：新片不满 min_age_days 天跳过
    if min_age_days > 0 and nfo.release_date:
        try:
            rd = datetime.strptime(nfo.release_date[:10], "%Y-%m-%d")  # noqa: DTZ007 (only API timezone)
            age = (datetime.now() - rd).days
            if age < min_age_days:
                return (f"Released {age}d ago (< {min_age_days}d), skip", "skipped")
        except (ValueError, IndexError):
            pass

    existing = _existing_subtitle_file(movie_path, movie_name)
    if existing:
        if dry_run and not _has_zh_prefix(existing):
            print(f"\033[33m    ⚠ {existing} lacks .zh prefix, may not be Chinese subtitle\033[0m")
        return (f"{existing} already exists", dry_state)

    return (None, "need_download" if dry_run else "")


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


def _search_and_download(
    movie_path: str,
    movie_name: str,
    nfo: NfoInfo,
    client: SubtitleApiClient,
    config: Config,
    needs_delay: bool = False,
    dump_mode: bool = False,
) -> ScanResult:
    """搜索字幕并下载（主力+备选 或 dump全量）"""
    if needs_delay and config.rate_limit > 0:
        time.sleep(config.rate_limit)

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
    print(f"\033[90m    {', '.join(parts)}, Primary: {primary.name}\033[0m")

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
        dl = download_subtitle(sub, movie_path, custom_filename=fname,
                               max_retries=config.retry_count,
                               retry_delay=config.retry_delay)
        if dl.success:
            downloaded_files.append(dl.filename)
        else:
            print(f"\033[31m    ✗ Download failed: {dl.error}\033[0m")

    if downloaded_files:
        _print_status("✓", f"Downloaded: {', '.join(downloaded_files)}", green=True)
        return ScanResult(movie_path, movie_name, "downloaded", filename=", ".join(downloaded_files))

    _print_status("✗", "All downloads failed")
    return ScanResult(movie_path, movie_name, "error", "All downloads failed")


def _dump_all_subtitles(movie_path: str, movie_name: str, subtitles: list) -> ScanResult:
    """全量下载字幕，编号命名 + 内容去重"""
    downloaded = 0
    dupes = 0
    seen_hashes: dict[str, str] = {}  # fingerprint → filename

    for i, sub in enumerate(subtitles, 1):
        filename = f"{i}.{sub.ext}"
        print(f"\033[90m    [{i}/{len(subtitles)}]\033[0m {filename} ← {sub.name}")

        dl = download_subtitle(sub, movie_path, custom_filename=filename)
        if dl.success:
            fp = _content_fingerprint(os.path.join(movie_path, filename))
            if fp and fp in seen_hashes:
                os.remove(os.path.join(movie_path, filename))
                print(f"\033[90m    ↳ Duplicate of {seen_hashes[fp]}, removed\033[0m")
                dupes += 1
            else:
                if fp:
                    seen_hashes[fp] = filename
                downloaded += 1

    dup_msg = f" ({dupes} dupes)" if dupes > 0 else ""
    _print_status("✓", f"Dumped {downloaded}/{len(subtitles)}{dup_msg}", green=True)
    return ScanResult(movie_path, movie_name, "downloaded", filename=f"dumped {downloaded} files")


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


def _save_progress(progress_file: str, movie_path: str) -> None:
    """追加一条已处理记录到进度文件"""
    try:
        with open(progress_file, "a", encoding="utf-8") as f:
            f.write(movie_path + "\n")
    except OSError:
        pass  # 写进度文件失败不影响主流程


def _write_log(log_path: str, movie_path: str, result: ScanResult) -> None:
    """写入单条日志"""
    ts = datetime.now().strftime("%H:%M:%S")
    status_map = {"downloaded": "OK", "skipped": "SKIP", "no_match": "NONE", "error": "ERR"}
    tag = status_map.get(result.status, "??")
    extra = f" - {result.filename}" if result.filename else f" - {result.reason}" if result.reason else ""
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"[{ts}] [{tag}] {os.path.basename(movie_path)}{extra}\n")
    except OSError:
        pass


def _write_log_summary(log_path: str, results: list[ScanResult]) -> None:
    """写入汇总到日志末尾"""
    counts = {"downloaded": 0, "skipped": 0, "no_match": 0, "error": 0}
    for r in results:
        if r.status in counts:
            counts[r.status] += 1
    total = len(results)
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"\n--- Summary ---\n")
            f.write(f"Total: {total}  OK: {counts['downloaded']}  "
                    f"Skip: {counts['skipped']}  None: {counts['no_match']}  "
                    f"Err: {counts['error']}\n")
    except OSError:
        pass


# ---- 输出辅助 ----

def _print_status(marker: str, msg: str, green: bool = False) -> None:
    """统一状态输出"""
    color = "\033[32m" if green else "\033[90m"
    print(f"{color}    {marker} {msg}\033[0m")


def _print_scan_summary(results: list[ScanResult]) -> None:
    """打印扫描汇总"""
    # dry-run 模式：按状态分类统计
    dry_states = [r.dry_state for r in results if r.dry_state]
    if dry_states:
        counts = {
            "need_download": dry_states.count("need_download"),
            "need_review": dry_states.count("need_review"),
            "reviewed_ok": dry_states.count("reviewed_ok"),
            "reviewed_fail": dry_states.count("reviewed_fail"),
            "skipped": dry_states.count("skipped"),
        }
        print()
        print(f"\033[1m  Scan Summary:\033[0m")
        if counts["need_download"] > 0:
            print(f"\033[90m    ◇ Need download: {counts['need_download']}\033[0m")
        if counts["need_review"] > 0:
            print(f"\033[33m    ⚠ Need review: {counts['need_review']}\033[0m")
        if counts["reviewed_ok"] > 0:
            print(f"\033[32m    ✓ Reviewed: {counts['reviewed_ok']}\033[0m")
        if counts["reviewed_fail"] > 0:
            print(f"\033[31m    ✗ Failed: {counts['reviewed_fail']}\033[0m")
        if counts["skipped"] > 0:
            print(f"\033[90m    - Other skip: {counts['skipped']}\033[0m")
        print()
        return

    # 正常下载模式：按结果状态统计
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
