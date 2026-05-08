"""Tests for SubtitleApiClient"""

from unittest.mock import Mock, patch

import pytest

from src.api import SubtitleApiClient
from src.types import Subtitle


class TestApiClientInit:
    def test_default_base_url(self):
        client = SubtitleApiClient()
        assert "shoulei-ssl.xunlei.com" in client.base_url

    def test_default_timeout(self):
        client = SubtitleApiClient()
        assert client.timeout == 30

    def test_custom_params(self):
        client = SubtitleApiClient(base_url="http://test.local", timeout=10)
        assert client.base_url == "http://test.local"
        assert client.timeout == 10

    def test_close(self):
        client = SubtitleApiClient()
        with patch.object(client._session, "close") as mock_close:
            client.close()
            mock_close.assert_called_once()

    def test_context_manager(self):
        with patch("src.api.requests.Session") as mock_session_cls:
            mock_session = mock_session_cls.return_value
            with SubtitleApiClient() as client:
                assert client is not None
            mock_session.close.assert_called_once()


class TestSearchSubtitles:
    def test_successful_search(self):
        client = SubtitleApiClient()
        mock_response = Mock()
        mock_response.json.return_value = {
            "code": 0,
            "data": [
                {
                    "gcid": "abc123",
                    "cid": "c1",
                    "url": "http://dl.example.com/sub.srt",
                    "ext": "srt",
                    "name": "测试字幕",
                    "duration": 7140000,
                    "languages": ["中文", "英语"],
                    "source": 1,
                    "score": 4.5,
                    "fingerprintf_score": 3.2,
                    "extra_name": "",
                    "mt": 0,
                }
            ],
        }

        with patch.object(client._session, "get", return_value=mock_response):
            result = client.search_subtitles("Movie Name")

        assert result.total == 1
        assert len(result.subtitles) == 1
        sub = result.subtitles[0]
        assert sub.gcid == "abc123"
        assert sub.name == "测试字幕"
        assert sub.ext == "srt"
        assert sub.duration == 7140000
        assert "中文" in sub.languages

    def test_search_with_empty_name(self):
        client = SubtitleApiClient()
        with pytest.raises(ValueError, match="cannot be empty"):
            client.search_subtitles("")

    def test_search_with_whitespace_name(self):
        client = SubtitleApiClient()
        with pytest.raises(ValueError, match="cannot be empty"):
            client.search_subtitles("   ")

    def test_api_error_code(self):
        client = SubtitleApiClient()
        mock_response = Mock()
        mock_response.json.return_value = {"code": 500, "msg": "Internal Error"}

        with patch.object(client._session, "get", return_value=mock_response):
            with pytest.raises(RuntimeError, match="API error"):
                client.search_subtitles("Movie")

    def test_empty_data_list(self):
        client = SubtitleApiClient()
        mock_response = Mock()
        mock_response.json.return_value = {"code": 0, "data": []}

        with patch.object(client._session, "get", return_value=mock_response):
            result = client.search_subtitles("No Results")
        assert result.total == 0
        assert result.subtitles == []

    def test_http_error(self):
        client = SubtitleApiClient()
        mock_response = Mock()
        mock_response.raise_for_status.side_effect = pytest.importorskip(
            "requests"
        ).HTTPError("404 Not Found", response=Mock(status_code=404, reason="Not Found"))

        with patch.object(client._session, "get", return_value=mock_response):
            with pytest.raises(RuntimeError, match="API request failed"):
                client.search_subtitles("Movie")

    def test_timeout(self):
        client = SubtitleApiClient()
        import requests

        with patch.object(client._session, "get", side_effect=requests.Timeout):
            with pytest.raises(RuntimeError, match="timeout"):
                client.search_subtitles("Movie")

    def test_network_error(self):
        client = SubtitleApiClient()
        import requests

        with patch.object(
            client._session, "get",
            side_effect=requests.RequestException("Connection refused"),
        ):
            with pytest.raises(RuntimeError, match="Network error"):
                client.search_subtitles("Movie")


class TestIsChineseSubtitle:
    def test_chinese_language(self):
        client = SubtitleApiClient()
        sub = _make_sub(languages=["中文"])
        assert client.is_chinese_subtitle(sub) is True

    def test_chinese_name_in_english(self):
        """name 含 'cn' 但 languages 非空时，不判定为中文"""
        client = SubtitleApiClient()
        sub = _make_sub(languages=["English"], name="CN Sub")
        # 仅当 languages 为空时才用 name 兜底判断
        assert client.is_chinese_subtitle(sub) is False

    def test_chinese_name_with_empty_languages(self):
        """name 含中文，languages 为空时判定为中文"""
        client = SubtitleApiClient()
        sub = _make_sub(languages=[], name="CN Sub")
        assert client.is_chinese_subtitle(sub) is True

    def test_chinese_characters_in_name(self):
        client = SubtitleApiClient()
        sub = _make_sub(languages=[""], name="简体中文字幕")
        assert client.is_chinese_subtitle(sub) is True

    def test_empty_languages(self):
        client = SubtitleApiClient()
        sub = _make_sub(languages=[], name="Some English Sub")
        assert client.is_chinese_subtitle(sub) is False

    def test_non_chinese(self):
        client = SubtitleApiClient()
        sub = _make_sub(languages=["English", "Japanese"])
        assert client.is_chinese_subtitle(sub) is False


class TestFilterChineseSubtitles:
    def test_filters_correctly(self):
        client = SubtitleApiClient()
        subs = [
            _make_sub(name="中文字幕"),
            _make_sub(name="English Sub"),
            _make_sub(name="简体"),
            _make_sub(name="日本語"),  # 日语汉字会误判为中文 — 已知限制
        ]
        result = client.filter_chinese_subtitles(subs)
        # "中文字幕", "简体", "日本語" (汉字误判) 都会被识别为中文
        assert len(result) == 3
        names = {s.name for s in result}
        assert "English Sub" not in names

    def test_empty_list(self):
        client = SubtitleApiClient()
        assert client.filter_chinese_subtitles([]) == []


class TestFilterByMaxDuration:
    def test_filters_by_duration(self):
        client = SubtitleApiClient()
        subs = [
            _make_sub(name="short", duration=1_800_000),  # 30 min
            _make_sub(name="long", duration=14_400_000),  # 240 min
            _make_sub(name="zero", duration=0),
        ]
        result = client.filter_by_max_duration(subs, 7_200_000)  # 120 min
        assert len(result) == 1
        assert result[0].name == "short"

    def test_sorted_desc_by_duration(self):
        client = SubtitleApiClient()
        subs = [
            _make_sub(name="a", duration=1_800_000),
            _make_sub(name="b", duration=7_200_000),
            _make_sub(name="c", duration=3_600_000),
        ]
        result = client.filter_by_max_duration(subs, 7_200_000)
        durations = [s.duration for s in result]
        assert durations == sorted(durations, reverse=True)

    def test_all_excluded(self):
        client = SubtitleApiClient()
        subs = [
            _make_sub(name="x", duration=10_000_000),
            _make_sub(name="y", duration=0),
        ]
        result = client.filter_by_max_duration(subs, 1_000)
        assert result == []


class TestParseSubtitle:
    def test_full_dict(self):
        raw = {
            "gcid": "g1",
            "cid": "c1",
            "url": "http://example.com/sub.srt",
            "ext": "srt",
            "name": "Test",
            "duration": 3600000,
            "languages": ["en"],
            "source": 1,
            "score": 4.0,
            "fingerprintf_score": 3.5,
            "extra_name": "extra",
            "mt": 1,
        }
        sub = SubtitleApiClient._parse_subtitle(raw)
        assert sub.gcid == "g1"
        assert sub.ext == "srt"
        assert sub.duration == 3600000
        assert sub.mt == 1

    def test_missing_keys_get_defaults(self):
        raw: dict[str, object] = {}
        sub = SubtitleApiClient._parse_subtitle(raw)
        assert sub.gcid == ""
        assert sub.url == ""
        assert sub.duration == 0
        assert sub.languages == []
        assert sub.score == 0.0


# ---- helpers ----

def _make_sub(**kwargs: object) -> Subtitle:
    """快捷构造 Subtitle 对象"""
    defaults: dict[str, object] = {
        "gcid": "",
        "cid": "",
        "url": "",
        "ext": "srt",
        "name": "",
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
