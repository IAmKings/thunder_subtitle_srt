"""Tests for src/download.py"""

import os
import tempfile
from unittest.mock import Mock, patch

from src.download import _sanitize_filename, download_subtitle
from src.types import Subtitle


class TestSanitizeFilename:
    def test_normal_name(self):
        assert _sanitize_filename("movie.srt") == "movie.srt"

    def test_invalid_chars(self):
        assert _sanitize_filename('movie<>:"/\\|?*.srt') == "movie_________.srt"

    def test_leading_trailing_spaces(self):
        assert _sanitize_filename("  movie.srt  ") == "movie.srt"

    def test_empty_after_cleanup(self):
        assert _sanitize_filename("   ") == "subtitle"


class TestDownloadSubtitle:
    def test_skip_existing_file(self, tmp_path):
        """文件已存在时直接返回成功"""
        sub = _make_sub(url="http://example.com/sub.srt", ext="srt")
        # 预创建文件
        existing = tmp_path / "sub.srt"
        existing.write_text("existing content")

        result = download_subtitle(sub, str(tmp_path), custom_filename="sub.srt")
        assert result.success is True
        assert result.filename == "sub.srt"

    def test_incomplete_download_retries(self, tmp_path):
        """content-length > 实际写入 → 抛异常触发重试"""
        sub = _make_sub(url="http://example.com/sub.srt", ext="srt")

        mock_response = Mock()
        mock_response.headers = {"content-length": "500"}
        # 返回的 chunk 远小于 500 bytes
        mock_response.iter_content.return_value = [b"short"]

        with patch("src.download.requests.get", return_value=mock_response):
            result = download_subtitle(
                sub, str(tmp_path), custom_filename="sub.srt",
                max_retries=2, retry_delay=0,
            )

        # 2次重试都失败 → success = False
        assert result.success is False

    def test_successful_download(self, tmp_path):
        """正常下载：content-length 与实际一致"""
        content = b"hello world" * 10  # 110 bytes
        sub = _make_sub(url="http://example.com/sub.srt", ext="srt")

        mock_response = Mock()
        mock_response.headers = {"content-length": str(len(content))}
        mock_response.iter_content.return_value = [content]

        with patch("src.download.requests.get", return_value=mock_response):
            result = download_subtitle(
                sub, str(tmp_path), custom_filename="sub.srt",
                max_retries=1, retry_delay=0,
            )

        assert result.success is True
        assert os.path.getsize(result.filepath) == len(content)

    def test_no_content_length_header(self, tmp_path):
        """无 content-length header → 跳过完整性校验，直接成功"""
        content = b"some data"
        sub = _make_sub(url="http://example.com/sub.ass", ext="ass")

        mock_response = Mock()
        mock_response.headers = {}  # 无 content-length
        mock_response.iter_content.return_value = [content]

        with patch("src.download.requests.get", return_value=mock_response):
            result = download_subtitle(
                sub, str(tmp_path), custom_filename="sub.ass",
                max_retries=1, retry_delay=0,
            )

        assert result.success is True


# ---- helpers ----

def _make_sub(**kwargs: object) -> Subtitle:
    defaults: dict[str, object] = {
        "gcid": "",
        "cid": "",
        "url": "",
        "ext": "srt",
        "name": "Test",
        "duration": 0,
        "languages": [],
        "source": 0,
        "score": 0.0,
        "fingerprintf_score": 0.0,
        "extra_name": "",
        "mt": 0,
    }
    defaults.update(kwargs)
    return Subtitle(**defaults)  # type: ignore[arg-type]
