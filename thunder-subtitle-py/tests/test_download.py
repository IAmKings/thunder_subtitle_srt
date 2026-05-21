"""Tests for src/download.py"""

import hashlib
import os
from unittest.mock import Mock, patch

from src.download import _sanitize_filename, download_subtitle, dump_subtitles, DumpResult
from src.models import Subtitle


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


# ---- DumpResult ----

class TestDumpResult:
    def test_defaults(self):
        r = DumpResult()
        assert r.downloaded == 0
        assert r.dupes == 0
        assert r.skipped == 0
        assert r.gcids == set()

    def test_custom_values(self):
        r = DumpResult(downloaded=5, dupes=2, skipped=1, gcids={"a", "b"})
        assert r.downloaded == 5
        assert r.dupes == 2
        assert r.skipped == 1
        assert r.gcids == {"a", "b"}


# ---- dump_subtitles ----

class TestDumpSubtitles:
    def test_empty_list(self, tmp_path):
        result = dump_subtitles([], str(tmp_path))
        assert result.downloaded == 0
        assert result.dupes == 0

    def test_skips_rejected_gcid(self, tmp_path):
        """已被拒绝的 gcid → 跳过"""
        sub = _make_sub(gcid="rej001", url="http://example.com/1.srt", name="Test")
        rejected = {"rej001"}

        with patch("src.download.download_subtitle") as mock_dl:
            result = dump_subtitles([sub], str(tmp_path), rejected_gcids=rejected)
            # 不应调用 download_subtitle
            mock_dl.assert_not_called()
            assert result.skipped == 1
            assert result.downloaded == 0

    def test_deduplicates_same_gcid(self, tmp_path):
        """同一 gcid 的多个字幕 → 只下载第一个"""
        s1 = _make_sub(gcid="dup001", url="http://example.com/1.srt", name="First")
        s2 = _make_sub(gcid="dup001", url="http://example.com/2.srt", name="Second")

        mock_result = Mock()
        mock_result.success = True
        mock_result.filename = "test.srt"

        with patch("src.download.download_subtitle", return_value=mock_result) as mock_dl:
            result = dump_subtitles([s1, s2], str(tmp_path))
            assert mock_dl.call_count == 1  # 只下载第一个
            assert result.dupes == 1
            assert result.downloaded == 1

    def test_downloads_all_unique(self, tmp_path):
        """不同 gcid 的字幕 → 全部下载"""
        subs = [
            _make_sub(gcid="g1", url="http://example.com/1.srt", name="A"),
            _make_sub(gcid="g2", url="http://example.com/2.srt", name="B"),
        ]

        mock_result = Mock()
        mock_result.success = True
        mock_result.filename = "test.srt"

        with patch("src.download.download_subtitle", return_value=mock_result) as mock_dl:
            result = dump_subtitles(subs, str(tmp_path))
            assert mock_dl.call_count == 2
            assert result.downloaded == 2
            assert result.dupes == 0

    def test_writes_dumped_file(self, tmp_path):
        """下载成功时逐条追加 .dumped"""
        sub = _make_sub(gcid="gc001", url="http://example.com/1.srt", name="Test")
        dumped_path = str(tmp_path / ".dumped")

        mock_result = Mock()
        mock_result.success = True
        mock_result.filename = "test.srt"

        with patch("src.download.download_subtitle", return_value=mock_result):
            result = dump_subtitles([sub], str(tmp_path), dumped_path=dumped_path)

        assert result.downloaded == 1
        assert os.path.isfile(dumped_path)
        with open(dumped_path, "r") as f:
            assert "gc001" in f.read()

    def test_failed_download_skips_gcid_write(self, tmp_path):
        """下载失败时不写入 gcid"""
        sub = _make_sub(gcid="gfail", url="http://example.com/1.srt", name="Test")
        dumped_path = str(tmp_path / ".dumped")

        mock_result = Mock()
        mock_result.success = False

        with patch("src.download.download_subtitle", return_value=mock_result):
            result = dump_subtitles([sub], str(tmp_path), dumped_path=dumped_path)

        assert result.downloaded == 0
        # .dumped 文件不存在或为空
        if os.path.isfile(dumped_path):
            with open(dumped_path, "r") as f:
                assert f.read() == ""

    def test_skips_rejected_url_when_gcid_empty(self, tmp_path):
        """gcid 为空时，url hash 命中 rejected → 跳过"""
        sub = _make_sub(gcid="", url="http://example.com/sub.srt", name="Test")
        url_hash = hashlib.md5(sub.url.encode()).hexdigest()
        rejected = {url_hash}

        with patch("src.download.download_subtitle") as mock_dl:
            result = dump_subtitles([sub], str(tmp_path), rejected_gcids=rejected)
            mock_dl.assert_not_called()
            assert result.skipped == 1
            assert result.downloaded == 0

    def test_deduplicates_same_url_when_gcid_empty(self, tmp_path):
        """gcid 为空时，相同 url 的字幕 → 只下载第一个"""
        s1 = _make_sub(gcid="", url="http://example.com/sub.srt", name="First")
        s2 = _make_sub(gcid="", url="http://example.com/sub.srt", name="Second")

        mock_result = Mock()
        mock_result.success = True
        mock_result.filename = "test.srt"

        with patch("src.download.download_subtitle", return_value=mock_result) as mock_dl:
            result = dump_subtitles([s1, s2], str(tmp_path))
            assert mock_dl.call_count == 1  # 只下载第一个
            assert result.dupes == 1
            assert result.downloaded == 1
