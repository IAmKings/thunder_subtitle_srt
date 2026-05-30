"""健康检查基类 — 避免循环导入，独立于 __init__.py"""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class CheckResult:
    """单个健康检查结果"""

    level: str = "ok"  # "ok" | "warning" | "info" | "error"
    path: str = ""  # 电影目录路径
    movie_name: str = ""  # 电影名称
    message: str = ""  # 中文提示


class BaseChecker(ABC):
    """检查器基类，可继承扩展自定义规则"""

    name: str = ""
    description: str = ""

    @abstractmethod
    def check(self, movie_path: str) -> list[CheckResult]:
        """检查单个电影目录，返回问题列表"""
        ...
