"""Tests for src/download.py"""

from src.download import _sanitize_filename


class TestSanitizeFilename:
    def test_normal_name(self):
        assert _sanitize_filename("movie.srt") == "movie.srt"

    def test_invalid_chars(self):
        assert _sanitize_filename('movie<>:"/\\|?*.srt') == "movie_________.srt"

    def test_leading_trailing_spaces(self):
        assert _sanitize_filename("  movie.srt  ") == "movie.srt"

    def test_empty_after_cleanup(self):
        assert _sanitize_filename("   ") == "subtitle"
