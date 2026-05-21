"""download 命令：通过 URL 下载字幕"""

from src.exceptions import CLIExit
from src.models import Subtitle
from src.ui import display_error, display_success
from src.download import download_subtitle, get_default_download_dir


def cmd_download(args) -> None:
    """执行下载命令"""
    output_dir = args.output or get_default_download_dir()

    # 构造一个简单的 Subtitle 对象
    subtitle = Subtitle(
        gcid="",
        cid="",
        url=args.url,
        ext=args.filename.split(".")[-1] if args.filename and "." in args.filename else "srt",
        name=args.filename or "subtitle",
        duration=0,
        languages=[],
        source=0,
        score=0.0,
        fingerprintf_score=0.0,
        extra_name="",
        mt=0,
    )

    result = download_subtitle(subtitle, output_dir, custom_filename=args.filename)
    if result.success:
        display_success(f"Downloaded: {result.filename}")
    else:
        display_error(f"Download failed: {result.error}")
        raise CLIExit()
