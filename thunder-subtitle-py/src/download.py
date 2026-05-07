"""
Download logic for Thunder Subtitle Python CLI
"""

import os
import time
from pathlib import Path
from typing import Optional

import requests

from .types import Subtitle, DownloadResult
from .ui import display_download_progress, display_download_complete


def get_default_download_dir() -> str:
    """获取默认下载目录"""
    return os.path.join(str(Path.home()), "Downloads", "thunder-subtitles")


def download_subtitle(
    subtitle: Subtitle,
    output_dir: str,
    custom_filename: Optional[str] = None,
    max_retries: int = 3,
    retry_delay: int = 2,
) -> DownloadResult:
    """
    下载单个字幕文件，失败自动重试
    返回 DownloadResult
    """
    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)

    # 确定文件名
    if custom_filename:
        safe_name = _sanitize_filename(custom_filename)
    else:
        safe_name = _sanitize_filename(subtitle.name)

    if not safe_name.endswith(f".{subtitle.ext}"):
        safe_name = f"{safe_name}.{subtitle.ext}"

    filepath = os.path.join(output_dir, safe_name)

    # 文件已存在则跳过
    if os.path.exists(filepath):
        return DownloadResult(
            success=True,
            filename=safe_name,
            filepath=filepath,
        )

    last_error = ""
    for attempt in range(1, max_retries + 1):
        try:
            response = requests.get(subtitle.url, stream=True, timeout=60)
            response.raise_for_status()

            total_size = int(response.headers.get("content-length", 0))
            downloaded = 0

            with open(filepath, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0:
                            display_download_progress(safe_name, downloaded, total_size)

            display_download_complete(safe_name, filepath)
            return DownloadResult(success=True, filename=safe_name, filepath=filepath)

        except requests.RequestException as e:
            last_error = str(e)
            if os.path.exists(filepath):
                os.unlink(filepath)

            if attempt < max_retries:
                print(f"\033[33m    ⚠ Retry {attempt}/{max_retries} after {retry_delay}s: {last_error}\033[0m")
                time.sleep(retry_delay)

    return DownloadResult(success=False, filename=safe_name, error=last_error)


def download_batch(
    subtitles: list[Subtitle],
    output_dir: str,
    filenames: Optional[list[str]] = None,
) -> dict:
    """
    批量下载字幕
    返回 { 'successful': int, 'failed': int, 'results': list[DownloadResult] }
    """
    results: list[DownloadResult] = []
    successful = 0
    failed = 0

    for i, sub in enumerate(subtitles):
        custom_name = filenames[i] if filenames and i < len(filenames) else None
        result = download_subtitle(sub, output_dir, custom_filename=custom_name)
        results.append(result)
        if result.success:
            successful += 1
        else:
            failed += 1

    return {"successful": successful, "failed": failed, "results": results}


from dataclasses import dataclass


@dataclass
class DumpResult:
    """dump 下载结果"""
    downloaded: int = 0
    dupes: int = 0       # 会话内重复
    skipped: int = 0     # 已拒绝跳过
    gcids: set = None    # 本次下载的 gcid 集合

    def __post_init__(self):
        if self.gcids is None:
            self.gcids = set()


def dump_subtitles(
    subtitles: list[Subtitle],
    output_dir: str,
    rejected_gcids: set[str] | None = None,
) -> DumpResult:
    """
    全量下载字幕，gcid 去重 + 增量跳过
    返回 DumpResult（下载数、重复数、跳过数、新 gcid 集合）
    """
    if rejected_gcids is None:
        rejected_gcids = set()

    result = DumpResult()
    seen: set[str] = set()
    total = len(subtitles)

    for i, sub in enumerate(subtitles, 1):
        filename = f"{i}.{sub.ext}"
        gcid = sub.gcid

        # 下载前去重
        if gcid and gcid in seen:
            print(f"\033[90m    [{i}/{total}]\033[0m {filename} ← {sub.name}")
            print(f"\033[90m    ↳ Duplicate gcid, skipped\033[0m")
            result.dupes += 1
            continue
        if gcid and gcid in rejected_gcids:
            print(f"\033[90m    [{i}/{total}]\033[0m {filename} ← {sub.name}")
            print(f"\033[90m    ↳ Previously rejected, skipped\033[0m")
            result.skipped += 1
            continue

        print(f"\033[90m    [{i}/{total}]\033[0m {filename} ← {sub.name}")
        dl = download_subtitle(sub, output_dir, custom_filename=filename)
        if dl.success:
            if gcid:
                seen.add(gcid)
                result.gcids.add(gcid)
            result.downloaded += 1

    return result


def _sanitize_filename(name: str) -> str:
    """清理文件名中的非法字符"""
    # 移除或替换文件系统不允许的字符
    invalid_chars = '<>:"/\\|?*'
    for char in invalid_chars:
        name = name.replace(char, "_")
    # 去除首尾空格和点
    name = name.strip(" .")
    return name if name else "subtitle"
