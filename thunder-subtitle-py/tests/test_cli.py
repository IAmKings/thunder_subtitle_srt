"""Tests for CLI argument parsing and helper functions"""

import sys
from contextlib import redirect_stdout
from io import StringIO
from unittest.mock import patch

import pytest

from cli import main
from commands.search import _parse_indices


class TestParseIndices:
    def test_single(self):
        assert _parse_indices("1") == [1]

    def test_comma_separated(self):
        assert _parse_indices("1,3,5") == [1, 3, 5]

    def test_range(self):
        assert _parse_indices("1-3") == [1, 2, 3]

    def test_mixed(self):
        assert _parse_indices("1,3-5,7") == [1, 3, 4, 5, 7]

    def test_with_spaces(self):
        assert _parse_indices(" 1 , 3 , 5 ") == [1, 3, 5]


class TestMainParser:
    def test_no_args_shows_help(self):
        with patch.object(sys, "argv", ["thunder-subtitle"]):
            try:
                main()
            except SystemExit:
                pass

    def test_help_flag(self):
        with patch.object(sys, "argv", ["thunder-subtitle", "--help"]):
            with pytest.raises(SystemExit) as exc:
                main()
            assert exc.value.code == 0

    def test_search_help(self):
        with patch.object(sys, "argv", ["thunder-subtitle", "search", "--help"]):
            with pytest.raises(SystemExit):
                main()

    def test_download_help(self):
        with patch.object(sys, "argv", ["thunder-subtitle", "download", "--help"]):
            with pytest.raises(SystemExit):
                main()

    def test_config_help(self):
        with patch.object(sys, "argv", ["thunder-subtitle", "config", "--help"]):
            with pytest.raises(SystemExit):
                main()

    def test_dump_help(self):
        with patch.object(sys, "argv", ["thunder-subtitle", "dump", "--help"]):
            with pytest.raises(SystemExit):
                main()

    def test_review_help(self):
        with patch.object(sys, "argv", ["thunder-subtitle", "review", "--help"]):
            with pytest.raises(SystemExit):
                main()

    def test_scan_help(self):
        with patch.object(sys, "argv", ["thunder-subtitle", "scan", "--help"]):
            with pytest.raises(SystemExit):
                main()

    def test_invalid_command(self):
        with patch.object(sys, "argv", ["thunder-subtitle", "invalid_cmd"]):
            with pytest.raises(SystemExit) as exc:
                main()
            assert exc.value.code != 0


class TestSearchArgs:
    def test_minimal_search(self):
        """search 命令至少需要 name 参数"""
        with patch.object(sys, "argv", ["thunder-subtitle", "search", "MovieName"]):
            # 会尝试网络请求，mock 掉
            with patch("commands.search.SubtitleApiClient") as mock_client_class:
                mock_client = mock_client_class.return_value
                mock_result = mock_client.search_subtitles.return_value
                mock_result.total = 0
                mock_result.subtitles = []
                try:
                    main()
                except SystemExit:
                    pass

    def test_search_with_flags(self):
        with patch.object(sys, "argv", [
            "thunder-subtitle", "search", "MovieName",
            "--chinese-only", "--max-duration", "1h30m", "--limit", "10"
        ]):
            with patch("commands.search.SubtitleApiClient") as mock_client_class:
                mock_client = mock_client_class.return_value
                mock_result = mock_client.search_subtitles.return_value
                mock_result.total = 0
                mock_result.subtitles = []
                try:
                    main()
                except SystemExit:
                    pass


class TestConfigArgs:
    def test_config_show(self):
        """config 不带参数显示配置"""
        with patch.object(sys, "argv", ["thunder-subtitle", "config"]):
            with redirect_stdout(StringIO()):
                main()

    def test_config_set(self):
        with patch.object(sys, "argv", ["thunder-subtitle", "config", "--set", "timeout", "60"]):
            with redirect_stdout(StringIO()):
                main()

    def test_config_set_unknown_key(self):
        with patch.object(sys, "argv", ["thunder-subtitle", "config", "--set", "invalid_key", "value"]):
            with redirect_stdout(StringIO()):
                main()

    def test_config_reset(self):
        with patch.object(sys, "argv", ["thunder-subtitle", "config", "--reset"]):
            with redirect_stdout(StringIO()):
                main()


class TestDumpArgs:
    def test_dump_requires_name_or_dir(self):
        with patch.object(sys, "argv", ["thunder-subtitle", "dump"]):
            with pytest.raises(SystemExit):
                main()

    def test_dump_with_dir_nonexistent(self):
        with patch.object(sys, "argv", ["thunder-subtitle", "dump", "--dir", "/nonexistent/path"]):
            with pytest.raises(SystemExit) as exc:
                main()
            assert exc.value.code == 1
