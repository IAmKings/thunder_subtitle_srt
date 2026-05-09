"""thunder-subtitle 自定义异常体系"""


class ThunderSubtitleError(Exception):
    """应用异常的基类，所有自定义异常继承于此"""
    pass


class ApiError(ThunderSubtitleError):
    """API 调用错误（响应 code != 0、无效响应等）"""
    pass


class NetworkError(ThunderSubtitleError):
    """网络相关错误（超时、连接失败、HTTP 错误等）"""
    pass


class ConfigError(ThunderSubtitleError):
    """配置相关错误（格式错误、缺失键等）"""
    pass


class DownloadError(ThunderSubtitleError):
    """下载相关错误（文件写入失败、完整性校验失败等）"""
    pass


class CLIExit(SystemExit):
    """命令执行失败，退出码 1。调用方应已在 raise 前打印了错误信息"""

    def __init__(self, code: int = 1) -> None:
        super().__init__(code)
