"""可清理文件提示 — 提示 extrafanart 文件夹和 thumb.jpg 可清理"""

import os

from .. import CheckResult


class CleanupRemindersChecker:
    """提示可清理的文件/文件夹（仅提示不操作）。

    检测项:
      - extrafanart/ 目录存在 → info
      - thumb.jpg 存在 → info
    """

    name = "cleanup_reminders"
    description = "提示 extrafanart 文件夹和 thumb.jpg 可清理"

    def check(self, movie_path: str) -> list[CheckResult]:
        results: list[CheckResult] = []

        if not os.path.isdir(movie_path):
            return results

        movie_name = os.path.basename(movie_path)

        # 1. 检查 extrafanart/ 目录
        extrafanart_path = os.path.join(movie_path, "extrafanart")
        if os.path.isdir(extrafanart_path):
            results.append(
                CheckResult(
                    level="info",
                    movie_name=movie_name,
                    path=movie_path,
                    message="存在 extrafanart/ 文件夹（可清理）",
                )
            )

        # 2. 检查 thumb.jpg
        thumb_path = os.path.join(movie_path, "thumb.jpg")
        if os.path.isfile(thumb_path):
            results.append(
                CheckResult(
                    level="info",
                    movie_name=movie_name,
                    path=movie_path,
                    message="存在 thumb.jpg 文件（可清理）",
                )
            )

        return results
