"""Integration tests — subprocess 端到端 + config 读写周期"""

import json
import subprocess
import sys
from unittest.mock import patch

import pytest

from cli import main


def _cli(*args: str) -> subprocess.CompletedProcess:
    """运行 CLI 命令并返回结果"""
    return subprocess.run(
        [sys.executable, "cli.py", *args],
        capture_output=True,
        text=True,
        timeout=10,
    )


class TestHelp:
    def test_help_flag(self):
        r = _cli("--help")
        assert r.returncode == 0
        assert "search" in r.stdout

    def test_search_help(self):
        r = _cli("search", "--help")
        assert r.returncode == 0
        assert "--chinese-only" in r.stdout

    def test_download_help(self):
        r = _cli("download", "--help")
        assert r.returncode == 0

    def test_config_help(self):
        r = _cli("config", "--help")
        assert r.returncode == 0
        assert "--set" in r.stdout

    def test_dump_help(self):
        r = _cli("dump", "--help")
        assert r.returncode == 0

    def test_review_help(self):
        r = _cli("review", "--help")
        assert r.returncode == 0

    def test_scan_help(self):
        r = _cli("scan", "--help")
        assert r.returncode == 0

    def test_invalid_command(self):
        r = _cli("invalid_cmd")
        assert r.returncode != 0


class TestArgsValidation:
    def test_search_requires_name(self):
        r = _cli("search")
        assert r.returncode != 0

    def test_dump_requires_name_or_dir(self):
        r = _cli("dump")
        assert r.returncode != 0

    def test_dump_nonexistent_dir(self):
        r = _cli("dump", "--dir", "/nonexistent/path/xyz")
        assert r.returncode != 0


class TestConfigRoundTrip:
    """配置读写完整周期（进程内 mock）"""

    def test_set_and_read(self, monkeypatch, tmp_path):
        tmp_cfg = str(tmp_path / "config.json")
        monkeypatch.setattr("src.config.CONFIG_PATH", tmp_cfg)
        monkeypatch.setattr("commands.config.CONFIG_PATH", tmp_cfg, raising=False)

        with patch.object(sys, "argv", ["thunder-subtitle", "config", "--set", "timeout", "99"]):
            main()

        with open(tmp_cfg) as f:
            data = json.load(f)
        assert data["timeout"] == 99

    def test_reset_restores_defaults(self, monkeypatch, tmp_path):
        tmp_cfg = str(tmp_path / "config.json")
        monkeypatch.setattr("src.config.CONFIG_PATH", tmp_cfg)

        with patch.object(sys, "argv", ["thunder-subtitle", "config", "--set", "timeout", "99"]):
            main()
        with patch.object(sys, "argv", ["thunder-subtitle", "config", "--reset"]):
            main()

        with open(tmp_cfg) as f:
            data = json.load(f)
        assert data["timeout"] == 30

    def test_set_unknown_key(self, monkeypatch, tmp_path):
        tmp_cfg = str(tmp_path / "config.json")
        monkeypatch.setattr("src.config.CONFIG_PATH", tmp_cfg)

        with patch.object(sys, "argv", ["thunder-subtitle", "config", "--set", "invalid_key", "value"]):
            main()

    def test_config_show_ok(self, monkeypatch, tmp_path):
        tmp_cfg = str(tmp_path / "config.json")
        monkeypatch.setattr("src.config.CONFIG_PATH", tmp_cfg)

        with patch.object(sys, "argv", ["thunder-subtitle", "config"]):
            main()
