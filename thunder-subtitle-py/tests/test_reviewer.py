"""Tests for reviewer pure functions"""

import tempfile
import os

import pytest

from src.reviewer._srt import _parse_srt_entries, _ts_to_ms
from src.reviewer._encoding import _detect_encoding, _calc_cn_ratio
from src.reviewer._output import _human_size
from src.reviewer._review import _review_one_file, ReviewItem, MIN_FILE_SIZE
from src.models import ReviewQuality


class TestTsToMs:
    def test_simple(self):
        assert _ts_to_ms("00:00:01,000") == 1000

    def test_one_minute(self):
        assert _ts_to_ms("00:01:00,000") == 60000

    def test_one_hour(self):
        assert _ts_to_ms("01:00:00,000") == 3600000

    def test_complex(self):
        assert _ts_to_ms("01:23:45,678") == 5025678

    def test_dot_separator(self):
        """支持 . 作为毫秒分隔符"""
        assert _ts_to_ms("00:00:01.500") == 1500


class TestParseSrtEntries:
    def test_single_entry(self):
        srt = "1\n00:00:01,000 --> 00:00:03,000\nHello World\n\n"
        entries = _parse_srt_entries(srt)
        assert len(entries) == 1
        e = entries[0]
        assert e["index"] == 1
        assert e["start_ms"] == 1000
        assert e["end_ms"] == 3000
        assert e["content"] == "Hello World"

    def test_multiple_entries(self):
        srt = (
            "1\n00:00:01,000 --> 00:00:03,000\nLine 1\n\n"
            "2\n00:00:04,000 --> 00:00:06,000\nLine 2\n\n"
            "3\n00:00:07,000 --> 00:00:10,000\nLine 3\n\n"
        )
        entries = _parse_srt_entries(srt)
        assert len(entries) == 3
        assert [e["index"] for e in entries] == [1, 2, 3]

    def test_multiline_content(self):
        srt = "1\n00:00:01,000 --> 00:00:03,000\nLine 1\nLine 2\n\n"
        entries = _parse_srt_entries(srt)
        assert len(entries) == 1
        assert "Line 1\nLine 2" in entries[0]["content"]

    def test_empty_input(self):
        entries = _parse_srt_entries("")
        assert entries == []

    def test_invalid_format(self):
        entries = _parse_srt_entries("not srt content at all")
        assert entries == []

    def test_real_world_chinese(self):
        srt = (
            "1\n00:00:01,500 --> 00:00:04,000\n你好世界\n\n"
            "2\n00:00:05,000 --> 00:00:08,000\n欢迎使用字幕工具\n\n"
        )
        entries = _parse_srt_entries(srt)
        assert len(entries) == 2
        assert entries[0]["content"] == "你好世界"


class TestDetectEncoding:
    def test_utf8(self):
        raw = "Hello 世界".encode("utf-8")
        assert _detect_encoding(raw) == "utf-8"

    def test_ascii(self):
        raw = b"Hello World"
        assert _detect_encoding(raw) == "utf-8"

    def test_gbk(self):
        raw = "中文字幕".encode("gbk")
        assert _detect_encoding(raw) == "gbk"

    def test_empty_bytes(self):
        assert _detect_encoding(b"") == "utf-8"

    def test_unknown_fallback(self):
        # 随机字节无法被任何已知编码解码
        raw = bytes([0xFF, 0xFE, 0x00, 0x01, 0x80, 0x81])
        result = _detect_encoding(raw)
        assert result in ("utf-8", "gbk", "gb2312", "big5", "shift_jis", "euc-kr", "unknown")


class TestCalcCnRatio:
    def test_all_chinese(self):
        assert _calc_cn_ratio("你好世界") == 1.0

    def test_half_chinese(self):
        # "Hello你好" : alnum=5(H/e/l/l/o), cn=2(你/好) → meaningful=7, ratio=2/7≈0.286
        ratio = _calc_cn_ratio("Hello你好")
        assert 0.25 < ratio < 0.35

    def test_no_chinese(self):
        assert _calc_cn_ratio("Hello World") == 0.0

    def test_empty_string(self):
        assert _calc_cn_ratio("") == 0.0

    def test_mixed_with_numbers(self):
        ratio = _calc_cn_ratio("第1集 你好")
        # meaningful chars: 第1集你好(5), cn: 第集你好(4) → 0.8
        assert 0.75 < ratio < 0.85


class TestHumanSize:
    def test_bytes(self):
        assert _human_size(0) == "0B"
        assert _human_size(500) == "500B"

    def test_kilobytes(self):
        assert _human_size(1024) == "1KB"
        assert _human_size(2048) == "2KB"
        assert _human_size(1536) == "1KB"


class TestReviewOneFile:
    def test_file_too_small(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".srt", delete=False) as f:
            f.write("tiny")
            path = f.name
        try:
            item = _review_one_file(path, "tiny.srt", "/movies/test", "Test")
            assert item.status == ReviewQuality.fail
            assert item.score == 0
            assert item.size_bytes < MIN_FILE_SIZE
        finally:
            os.unlink(path)

    def test_valid_srt(self):
        # 多行内容确保文件 > MIN_FILE_SIZE (200B)
        entries = "\n\n".join(
            f"{i}\n00:00:{i:02d},000 --> 00:00:{i+2:02d},000\nSubtitle line {i}"
            for i in range(1, 12)
        )
        srt = entries + "\n\n"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".srt", encoding="utf-8", delete=False) as f:
            f.write(srt)
            path = f.name
        try:
            item = _review_one_file(path, "test.srt", "/movies/test", "Test")
            assert item.status in (ReviewQuality.ok, ReviewQuality.warn)
            assert item.score > 50
            assert item.entry_count == 11
            assert item.encoding in ("utf-8", "ascii")
        finally:
            os.unlink(path)

    def test_nonexistent_file(self):
        item = _review_one_file("/nonexistent/file.srt", "file.srt", "/movies/test", "Test")
        assert item.score == 0
        assert item.status == ReviewQuality.fail

    def test_zh_file_with_chinese_content(self):
        # 多行中文确保文件 > MIN_FILE_SIZE (200B)
        entries = "\n\n".join(
            f"{i}\n00:00:{i:02d},000 --> 00:00:{i+2:02d},000\n你好世界这是第{i}条字幕"
            for i in range(1, 12)
        )
        srt = entries + "\n\n"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".srt", encoding="utf-8", delete=False) as f:
            f.write(srt)
            path = f.name
        try:
            item = _review_one_file(path, "test.zh.srt", "/movies/test", "Test")
            assert item.cn_ratio > 0
            assert "cn_content" in item.checks
        finally:
            os.unlink(path)
