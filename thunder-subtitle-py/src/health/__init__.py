"""媒体库目录结构健康检查 — 纯检测模式，不修改任何文件。"""

from typing import Callable

from src.scanner._dir import scan_movie_dirs

from .base import BaseChecker, CheckResult  # noqa: F401 - re-export
from .checkers.cleanup import CleanupRemindersChecker
from .checkers.image_assets import ImageAssetsChecker
from .checkers.nfo import NFOExistsChecker

# Re-export CheckResult + BaseChecker for external use
__all__ = ["CheckResult", "BaseChecker", "run_health_check"]


CheckerFunc = Callable[[str], list[CheckResult]]


def _default_checkers(poster_systems: list[str] | None = None) -> list[CheckerFunc]:
    """返回已注册的默认检查器列表

    Args:
        poster_systems: 启用的海报系统列表 ("kodi", "emby")
    """
    return [
        ImageAssetsChecker(poster_systems=poster_systems).check,
        NFOExistsChecker().check,
        CleanupRemindersChecker(poster_systems=poster_systems).check,
    ]


def run_health_check(
    base_dir: str,
    poster_systems: list[str] | None = None,
) -> list[CheckResult]:
    """运行所有已注册的健康检查器。

    Args:
        base_dir: 媒体库根目录路径
        poster_systems: 启用的海报系统列表 ("kodi", "emby")，None 则使用默认

    Returns:
        所有检查结果的列表
    """
    movie_dirs = scan_movie_dirs(base_dir)
    all_results: list[CheckResult] = []

    checkers = _default_checkers(poster_systems=poster_systems)

    for movie_path in movie_dirs:
        movie_name = movie_path.rstrip("/").split("/")[-1]
        for checker in checkers:
            try:
                results = checker(movie_path)
                for r in results:
                    if not r.movie_name:
                        r.movie_name = movie_name
                    if not r.path:
                        r.path = movie_path
                all_results.extend(results)
            except Exception:
                # 单个检查器失败不影响其他检查器
                all_results.append(
                    CheckResult(
                        level="error",
                        path=movie_path,
                        movie_name=movie_name,
                        message=f"检查器执行异常: {checker.__name__}",
                    )
                )

    return all_results
