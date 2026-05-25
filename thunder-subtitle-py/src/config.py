"""
配置文件管理
"""

import json
import os
import stat
from dataclasses import dataclass, asdict
from pathlib import Path

from .ui import BOLD, RESET, YELLOW

CONFIG_PATH: str = os.environ.get(
    "THUNDER_SUBTITLE_CONFIG",
    os.path.join(str(Path.home()), ".thunder-subtitle.json"),
)


@dataclass
class Config:
    """应用配置"""

    output_dir: str = ""  # 默认下载目录（空=用系统默认）
    timeout: int = 30  # API 超时（秒）
    download_timeout: int = 60  # 下载超时（秒）
    chunk_size: int = 8192  # 下载分块大小（字节）
    rate_limit: int = 3  # 扫描模式下查询间隔（秒）
    retry_count: int = 3  # 下载失败重试次数
    retry_delay: int = 2  # 重试间隔（秒）
    preferred_groups: str = ""  # 偏好字幕组（逗号分隔，如 KitaujiSub,DMG）
    media_paths: str = ""  # 默认媒体库路径（逗号分隔，缺省时自动使用）
    password: str = ""  # 管理密码（持久化存储）

    @property
    def preferred_groups_list(self) -> list[str]:
        """返回偏好字幕组列表"""
        if not self.preferred_groups.strip():
            return []
        return [g.strip() for g in self.preferred_groups.split(",") if g.strip()]

    @property
    def media_paths_list(self) -> list[str]:
        """返回媒体库路径列表，过滤不存在的路径。

        JSON 配置值优先，env var 仅作初始种子。
        """
        raw = self.media_paths.strip()
        if not raw:
            raw = os.environ.get("MEDIA_PATHS", "").strip()
        if not raw:
            return []
        return [
            p.strip() for p in raw.split(",") if p.strip() and os.path.isdir(p.strip())
        ]

    @classmethod
    def load(cls) -> "Config":
        """加载配置，文件不存在则使用默认值"""
        config = cls()
        if os.path.isfile(CONFIG_PATH):
            try:
                with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for key, value in data.items():
                    if hasattr(config, key):
                        setattr(config, key, value)
            except (json.JSONDecodeError, OSError):
                pass  # 文件损坏则用默认值
        return config

    def save(self) -> None:
        """保存配置到文件（含密码持久化），文件权限 0600"""
        os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
        data = asdict(self)
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.chmod(CONFIG_PATH, stat.S_IRUSR | stat.S_IWUSR)

    def show(self) -> None:
        """打印当前配置"""
        print(f"{BOLD}\n  Config ({CONFIG_PATH}):{RESET}\n")
        for key, value in asdict(self).items():
            display = value if value else "(default)"
            print(f"  {YELLOW}{key}{RESET} = {display}")
        print()
