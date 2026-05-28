"""NFO 检查 — 检查 movie.nfo 是否存在"""

import os

from .. import CheckResult


class NFOExistsChecker:
    """检查电影目录的 movie.nfo 是否存在。

    检测项:
      - movie.nfo 必须存在 → error
    """

    name = "nfo_exists"
    description = "检查 movie.nfo 是否存在"

    def check(self, movie_path: str) -> list[CheckResult]:
        results: list[CheckResult] = []

        if not os.path.isdir(movie_path):
            return results

        movie_name = os.path.basename(movie_path)
        nfo_path = os.path.join(movie_path, "movie.nfo")

        if not os.path.isfile(nfo_path):
            results.append(
                CheckResult(
                    level="error",
                    movie_name=movie_name,
                    path=movie_path,
                    message="缺少 movie.nfo 元数据文件",
                )
            )

        return results
