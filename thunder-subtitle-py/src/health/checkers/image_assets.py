"""图片资源检查 — 检查 folder.jpg, landscape.jpg, backdrop*.jpg"""

import glob
import os

from ..base import CheckResult


class ImageAssetsChecker:
    """检查电影目录的图片资源完整性。

    检测项:
      - folder.jpg 必须存在 → warning（始终检查）
      - landscape.jpg 必须存在 → warning（仅 Kodi/Plex 系统）
      - backdrop*.jpg 至少一个 → warning（仅 Kodi/Plex 系统）
    """

    name = "image_assets"
    description = "检查电影目录图片资源 (folder.jpg / landscape.jpg / backdrop*.jpg)"

    def __init__(self, poster_systems: list[str] | None = None) -> None:
        self._check_kodi = poster_systems is None or "kodi" in poster_systems

    def check(self, movie_path: str) -> list[CheckResult]:
        results: list[CheckResult] = []

        if not os.path.isdir(movie_path):
            return results

        movie_name = os.path.basename(movie_path)

        # 1. 检查 folder.jpg（始终检查，所有系统都需要）
        has_folder = os.path.isfile(os.path.join(movie_path, "folder.jpg"))
        if not has_folder:
            results.append(
                CheckResult(
                    level="warning",
                    movie_name=movie_name,
                    path=movie_path,
                    message="缺少 folder.jpg 图片",
                )
            )

        # 2. Kodi/Plex 系统：检查 landscape.jpg + backdrop*.jpg
        if self._check_kodi:
            has_landscape = os.path.isfile(os.path.join(movie_path, "landscape.jpg"))
            if not has_landscape:
                results.append(
                    CheckResult(
                        level="warning",
                        movie_name=movie_name,
                        path=movie_path,
                        message="缺少 landscape.jpg 图片",
                    )
                )

            backdrop_files = glob.glob(os.path.join(movie_path, "backdrop*.jpg"))
            if not backdrop_files:
                results.append(
                    CheckResult(
                        level="warning",
                        movie_name=movie_name,
                        path=movie_path,
                        message="缺少 backdrop*.jpg 背景图片",
                    )
                )

        return results
