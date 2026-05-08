"""CLI 自定义异常 — 用于控制流而非到处 sys.exit()"""


class CLIExit(SystemExit):
    """命令执行失败，退出码 1。调用方应已在 raise 前打印了错误信息"""

    def __init__(self, code: int = 1) -> None:
        super().__init__(code)
