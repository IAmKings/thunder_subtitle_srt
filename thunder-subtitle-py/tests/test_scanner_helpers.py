"""Tests for scanner helper functions"""

import os
import tempfile

from src.scanner._processor import _content_fingerprint
from src.scanner._skip import _has_zh_prefix, _find_dump_subtitle, _is_review_fail
from src.utils import parse_nfo


class TestHasZhPrefix:
    def test_with_zh(self):
        assert _has_zh_prefix("movie.zh.srt") is True

    def test_without_zh(self):
        assert _has_zh_prefix("movie.srt") is False
        assert _has_zh_prefix("movie.ass") is False

    def test_zh_in_middle(self):
        # .zh. anywhere counts as chinese-flagged
        assert _has_zh_prefix("movie.zh.part.srt") is True


class TestFindDumpSubtitle:
    def test_numbered_files(self):
        with tempfile.TemporaryDirectory() as d:
            open(os.path.join(d, "1.srt"), "w").close()
            open(os.path.join(d, "2.ass"), "w").close()
            open(os.path.join(d, "movie.nfo"), "w").close()
            result = _find_dump_subtitle(d)
            assert result is not None
            assert result in ("1.srt", "2.ass")

    def test_no_numbered_files(self):
        with tempfile.TemporaryDirectory() as d:
            open(os.path.join(d, "movie.srt"), "w").close()
            assert _find_dump_subtitle(d) is None

    def test_empty_dir(self):
        with tempfile.TemporaryDirectory() as d:
            assert _find_dump_subtitle(d) is None


class TestIsReviewFail:
    def test_fail_content(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, ".reviewed")
            with open(path, "w") as f:
                f.write("fail")
            assert _is_review_fail(path) is True

    def test_empty_file(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, ".reviewed")
            open(path, "w").close()
            assert _is_review_fail(path) is False

    def test_ok_content(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, ".reviewed")
            with open(path, "w") as f:
                f.write("ok")
            assert _is_review_fail(path) is False

    def test_no_file(self):
        assert _is_review_fail("/nonexistent/.reviewed") is False


class TestParseNfo:
    def test_with_duration(self):
        nfo = """<?xml version="1.0"?>
<movie>
  <fileinfo>
    <streamdetails>
      <video>
        <durationinseconds>7140</durationinseconds>
      </video>
    </streamdetails>
  </fileinfo>
</movie>"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".nfo", delete=False) as f:
            f.write(nfo)
            path = f.name
        try:
            info = parse_nfo(path)
            assert info.duration_seconds == 7140
        finally:
            os.unlink(path)

    def test_chinese_tag(self):
        nfo = """<?xml version="1.0"?>
<movie>
  <genre>中文字幕</genre>
</movie>"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".nfo", delete=False) as f:
            f.write(nfo)
            path = f.name
        try:
            info = parse_nfo(path)
            assert info.has_chinese_subtitle is True
        finally:
            os.unlink(path)

    def test_chinese_in_tag(self):
        nfo = """<?xml version="1.0"?>
<movie>
  <tag>包含中文字幕</tag>
</movie>"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".nfo", delete=False) as f:
            f.write(nfo)
            path = f.name
        try:
            info = parse_nfo(path)
            assert info.has_chinese_subtitle is True
        finally:
            os.unlink(path)

    def test_no_chinese(self):
        nfo = """<?xml version="1.0"?>
<movie>
  <genre>科幻</genre>
  <fileinfo><streamdetails><video>
    <durationinseconds>7200</durationinseconds>
  </video></streamdetails></fileinfo>
</movie>"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".nfo", delete=False) as f:
            f.write(nfo)
            path = f.name
        try:
            info = parse_nfo(path)
            assert info.has_chinese_subtitle is False
            assert info.duration_seconds == 7200
        finally:
            os.unlink(path)


class TestContentFingerprint:
    def test_same_content_different_timing(self):
        srt1 = "1\n00:00:01,000 --> 00:00:03,000\n你好世界\n\n"
        srt2 = "1\n00:00:01,200 --> 00:00:03,100\n你好世界\n\n"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".srt", delete=False) as f:
            f.write(srt1)
            p1 = f.name
        with tempfile.NamedTemporaryFile(mode="w", suffix=".srt", delete=False) as f:
            f.write(srt2)
            p2 = f.name
        try:
            assert _content_fingerprint(p1) == _content_fingerprint(p2)
        finally:
            os.unlink(p1)
            os.unlink(p2)

    def test_different_content(self):
        srt1 = "1\n00:00:01,000 --> 00:00:03,000\n你好世界\n\n"
        srt2 = "1\n00:00:01,000 --> 00:00:03,000\n完全不同的内容\n\n"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".srt", delete=False) as f:
            f.write(srt1)
            p1 = f.name
        with tempfile.NamedTemporaryFile(mode="w", suffix=".srt", delete=False) as f:
            f.write(srt2)
            p2 = f.name
        try:
            assert _content_fingerprint(p1) != _content_fingerprint(p2)
        finally:
            os.unlink(p1)
            os.unlink(p2)

    def test_nonexistent_file(self):
        assert _content_fingerprint("/nonexistent/file.srt") is None
