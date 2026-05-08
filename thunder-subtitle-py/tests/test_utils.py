"""Tests for src/utils.py"""

import pytest
from src.utils import parse_duration, format_duration, seconds_to_duration_str


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
        assert format_duration(3_600_000) == "60m 0s"


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
