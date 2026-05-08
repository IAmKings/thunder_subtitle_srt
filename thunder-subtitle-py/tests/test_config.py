"""Tests for Config"""

import json
import os

from src.config import Config


class TestConfigDefaults:
    def test_default_output_dir(self):
        c = Config()
        assert c.output_dir == ""

    def test_default_timeout(self):
        c = Config()
        assert c.timeout == 30

    def test_default_rate_limit(self):
        c = Config()
        assert c.rate_limit == 3

    def test_default_retry_count(self):
        c = Config()
        assert c.retry_count == 3

    def test_preferred_groups_list_empty(self):
        c = Config()
        assert c.preferred_groups_list == []

    def test_preferred_groups_list_single(self):
        c = Config(preferred_groups="KitaujiSub")
        assert c.preferred_groups_list == ["KitaujiSub"]

    def test_preferred_groups_list_multiple(self):
        c = Config(preferred_groups="KitaujiSub, DMG, SweetSub")
        assert c.preferred_groups_list == ["KitaujiSub", "DMG", "SweetSub"]

    def test_preferred_groups_list_whitespace(self):
        c = Config(preferred_groups="  ,  , KitaujiSub ,,  ")
        assert c.preferred_groups_list == ["KitaujiSub"]

    def test_media_paths_list_empty(self):
        c = Config()
        assert c.media_paths_list == []

    def test_media_paths_list_filters_nonexistent(self):
        c = Config(media_paths="/tmp,/nonexistent/path/xyz")
        result = c.media_paths_list
        assert "/tmp" in result
        assert "/nonexistent/path/xyz" not in result


class TestConfigLoadSave:
    def test_load_nonexistent_file(self, monkeypatch):
        monkeypatch.setattr("src.config.CONFIG_PATH", "/tmp/__nonexistent_config__.json")
        c = Config.load()
        assert c.timeout == 30
        assert c.rate_limit == 3

    def test_save_and_load_roundtrip(self, monkeypatch, tmp_path):
        path = str(tmp_path / "config.json")
        monkeypatch.setattr("src.config.CONFIG_PATH", path)

        c = Config(timeout=60, rate_limit=5, preferred_groups="DMG")
        c.save()
        assert os.path.isfile(path)

        loaded = Config.load()
        assert loaded.timeout == 60
        assert loaded.rate_limit == 5
        assert loaded.preferred_groups == "DMG"

    def test_load_corrupted_json(self, monkeypatch, tmp_path):
        path = str(tmp_path / "bad.json")
        with open(path, "w") as f:
            f.write("not valid json {{{")
        monkeypatch.setattr("src.config.CONFIG_PATH", path)

        c = Config.load()
        # 应回退到默认值
        assert c.timeout == 30

    def test_load_partial_keys(self, monkeypatch, tmp_path):
        """配置文件中只有部分 key 时，其余保持默认"""
        path = str(tmp_path / "partial.json")
        with open(path, "w") as f:
            json.dump({"timeout": 99}, f)
        monkeypatch.setattr("src.config.CONFIG_PATH", path)

        c = Config.load()
        assert c.timeout == 99
        assert c.rate_limit == 3  # 默认值

    def test_save_creates_parent_dir(self, monkeypatch, tmp_path):
        path = str(tmp_path / "subdir" / "config.json")
        monkeypatch.setattr("src.config.CONFIG_PATH", path)

        c = Config()
        c.save()
        assert os.path.isfile(path)

    def test_show_does_not_crash(self, capsys):
        c = Config()
        c.show()
        captured = capsys.readouterr()
        assert "Config" in captured.out
        assert "timeout" in captured.out
