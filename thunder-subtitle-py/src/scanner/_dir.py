"""目录扫描：识别 Jellyfin 演员/电影目录结构"""

import os


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
        if not os.path.isdir(entry_path) or entry in {
            ".scan-progress",
            ".reviewed",
            ".dumped",
            ".rejected",
        }:
            continue
        if os.path.isfile(os.path.join(entry_path, "movie.nfo")):
            return _scan_actor_dir(base_dir)

    # 媒体库根目录模式
    for actor_name in sorted(os.listdir(base_dir)):
        actor_path = os.path.join(base_dir, actor_name)
        if not os.path.isdir(actor_path) or actor_name in {
            ".scan-progress",
            ".reviewed",
            ".dumped",
            ".rejected",
        }:
            continue
        movie_dirs.extend(_scan_actor_dir(actor_path))

    return movie_dirs


def _scan_actor_dir(actor_path: str) -> list[str]:
    """扫描单个演员目录下的电影目录"""
    movie_dirs: list[str] = []
    for movie_name in sorted(os.listdir(actor_path)):
        movie_path = os.path.join(actor_path, movie_name)
        if not os.path.isdir(movie_path) or movie_name in {
            ".scan-progress",
            ".reviewed",
            ".dumped",
            ".rejected",
        }:
            continue
        if os.path.isfile(os.path.join(movie_path, "movie.nfo")):
            movie_dirs.append(movie_path)
    return movie_dirs
