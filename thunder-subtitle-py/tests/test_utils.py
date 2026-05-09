"""Tests for src/utils.py"""

import os
import tempfile

import pytest
from src.utils import (
    parse_duration, format_duration, seconds_to_duration_str,
    filter_by_duration, load_gcid_file, clear_file,
)


class TestParseDuration:
    def test_hours(self):
        assert parse_duration("1h") == 3_600_000

    def test_minutes(self):
        assert parse_duration("30m") == 1_800_000

    def test_seconds(self):
        assert parse_duration("45s") == 45_000

    def test_combined(self):
        assert parse_duration("1h30m") == 5_400_000
        assert parse_duration("2h30m20s") == 9_020_000

    def test_whitespace(self):
        assert parse_duration(" 1h 30m ") == 5_400_000

    def test_invalid_empty(self):
        with pytest.raises(ValueError):
            parse_duration("")

    def test_invalid_format(self):
        with pytest.raises(ValueError):
            parse_duration("abc")


class TestFormatDuration:
    def test_zero(self):
        assert format_duration(0) == "Unknown"

    def test_seconds_only(self):
        assert format_duration(45_000) == "45s"

    def test_minutes_and_seconds(self):
        assert format_duration(90_000) == "1m 30s"

    def test_one_hour(self):
        assert format_duration(3_600_000) == "1h 0m 0s"

    def test_hours_and_minutes(self):
        assert format_duration(5_400_000) == "1h 30m 0s"  # 90 min

    def test_only_hours(self):
        assert format_duration(7_200_000) == "2h 0m 0s"  # 120 min


class TestSecondsToDurationStr:
    def test_zero(self):
        assert seconds_to_duration_str(0) == ""

    def test_seconds_only(self):
        assert seconds_to_duration_str(45) == "45s"

    def test_minutes_only(self):
        assert seconds_to_duration_str(1800) == "30m"

    def test_hours_only(self):
        assert seconds_to_duration_str(3600) == "1h"

    def test_combined(self):
        assert seconds_to_duration_str(3661) == "1h1m1s"
        assert seconds_to_duration_str(7140) == "1h59m"


# ---- filter_by_duration ----

class _FakeSub:
    """最小化字幕对象，仅含 name 和 duration"""
    def __init__(self, name: str, duration: int):
        self.name = name
        self.duration = duration


def _fake_filter(subs: list, max_ms: int) -> list:
    """模拟 filter_by_max_duration：保留 duration <= max_ms 的"""
    return [s for s in subs if s.duration <= max_ms]


class TestFilterByDuration:
    def test_includes_zero_duration(self):
        subs = [_FakeSub("a", 1000), _FakeSub("b", 0), _FakeSub("c", 5000)]
        result = filter_by_duration(subs, 3000, _fake_filter)
        names = [s.name for s in result]
        assert "a" in names
        assert "b" in names  # duration=0 被保留
        assert "c" not in names

    def test_all_zero_duration(self):
        subs = [_FakeSub("a", 0), _FakeSub("b", 0)]
        result = filter_by_duration(subs, 1000, _fake_filter)
        assert len(result) == 2

    def test_empty_list(self):
        assert filter_by_duration([], 1000, _fake_filter) == []

    def test_all_within_limit(self):
        subs = [_FakeSub("a", 500), _FakeSub("b", 300)]
        result = filter_by_duration(subs, 1000, _fake_filter)
        assert len(result) == 2


# ---- load_gcid_file ----

class TestLoadGcidFile:
    def test_normal(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".gcid", delete=False) as f:
            f.write("abc123\ndef456\n\nghi789\n")
            path = f.name
        try:
            result = load_gcid_file(path)
            assert result == {"abc123", "def456", "ghi789"}
        finally:
            os.unlink(path)

    def test_empty_file(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".gcid", delete=False) as f:
            path = f.name
        try:
            assert load_gcid_file(path) == set()
        finally:
            os.unlink(path)

    def test_nonexistent_file(self):
        assert load_gcid_file("/nonexistent/gcid.file") == set()


# ---- clear_file ----

class TestClearFile:
    def test_clears_content(self):
        with tempfile.NamedTemporaryFile(mode="w", delete=False) as f:
            f.write("some content")
            path = f.name
        try:
            assert clear_file(path) is True
            with open(path, "r") as f:
                assert f.read() == ""
        finally:
            os.unlink(path)

    def test_creates_if_not_exists(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "newfile.txt")
            assert clear_file(path) is True
            assert os.path.isfile(path)

    def test_readonly_dir_returns_false(self):
        """只读目录无法写入 → 返回 False"""
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "readonly", "test")
            os.makedirs(os.path.dirname(path))
            os.chmod(os.path.dirname(path), 0o444)
            try:
                result = clear_file(path)
                assert result is False
            finally:
                os.chmod(os.path.dirname(path), 0o755)
