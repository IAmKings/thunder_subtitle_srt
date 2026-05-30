"""图片资源检查 — 检查 folder.jpg, landscape.jpg, backdrop*.jpg"""

import glob
import os

from ..base import CheckResult


class ImageAssetsChecker:
    """检查电影目录的图片资源完整性。

    检测项:
      - folder.jpg + landscape.jpg 必须都存在 → warning
      - backdrop*.jpg 至少一个 → warning
    """

    name = "image_assets"
    description = "检查电影目录图片资源 (folder.jpg / landscape.jpg / backdrop*.jpg)"

    def check(self, movie_path: str) -> list[CheckResult]:
        results: list[CheckResult] = []

        if not os.path.isdir(movie_path):
            return results

        movie_name = os.path.basename(movie_path)

        # 1. 检查 folder.jpg + landscape.jpg
        has_folder = os.path.isfile(os.path.join(movie_path, "folder.jpg"))
        has_landscape = os.path.isfile(os.path.join(movie_path, "landscape.jpg"))

        if not has_folder and not has_landscape:
            results.append(
                CheckResult(
                    level="warning",
                    movie_name=movie_name,
                    path=movie_path,
                    message="缺少 folder.jpg 和 landscape.jpg 图片",
                )
            )
        elif not has_folder:
            results.append(
                CheckResult(
                    level="warning",
                    movie_name=movie_name,
                    path=movie_path,
                    message="缺少 folder.jpg 图片",
                )
            )
        elif not has_landscape:
            results.append(
                CheckResult(
                    level="warning",
                    movie_name=movie_name,
                    path=movie_path,
                    message="缺少 landscape.jpg 图片",
                )
            )

        # 2. 检查 backdrop*.jpg
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
