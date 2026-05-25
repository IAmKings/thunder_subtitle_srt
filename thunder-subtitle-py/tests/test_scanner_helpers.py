"""Tests for scanner helper functions"""

import os
import tempfile

from src.api import SubtitleApiClient
from src.scanner._processor import _content_fingerprint, _select_primary_alt
from src.scanner._skip import (
    _has_zh_prefix,
    _find_dump_subtitle,
    _is_review_fail,
    _check_fail_skip,
    _check_nfo_skip,
    _check_release_age,
    _check_existing_skip,
    _check_skip,
)
from src.models import DryState, Subtitle, SearchResult
from src.utils import NfoInfo, parse_nfo


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


# ---- _check_skip 子函数测试 ----


def _make_nfo(
    duration: int = 7200, has_chinese: bool = False, release_date: str = ""
) -> NfoInfo:
    """快捷构造 NfoInfo"""
    return NfoInfo(
        duration_seconds=duration,
        has_chinese_subtitle=has_chinese,
        release_date=release_date,
    )


class TestCheckFailSkip:
    """_check_fail_skip 单元测试"""

    def test_no_reviewed_file(self):
        """无 .reviewed 文件 → 不跳过"""
        with tempfile.TemporaryDirectory() as d:
            result = _check_fail_skip(d, force=False, dry_run=False, is_fail=False)
            assert result is None

    def test_fail_skip(self):
        """标记 fail → 硬跳过"""
        with tempfile.TemporaryDirectory() as d:
            with open(os.path.join(d, ".reviewed"), "w") as f:
                f.write("fail")
            result = _check_fail_skip(d, force=False, dry_run=False, is_fail=True)
            assert result is not None
            assert "Review FAILED" in result[0]
            assert result[1] == DryState.reviewed_fail

    def test_fail_but_force(self):
        """标记 fail + force → 不跳过"""
        with tempfile.TemporaryDirectory() as d:
            with open(os.path.join(d, ".reviewed"), "w") as f:
                f.write("fail")
            result = _check_fail_skip(d, force=True, dry_run=False, is_fail=True)
            assert result is None


class TestCheckNfoSkip:
    """_check_nfo_skip 单元测试"""

    def test_with_chinese_tag(self):
        nfo = _make_nfo(has_chinese=True)
        assert (
            _check_nfo_skip(nfo, force=False, is_fail=False)
            == "NFO has Chinese subtitle tag"
        )

    def test_no_chinese_tag(self):
        nfo = _make_nfo(has_chinese=False)
        assert _check_nfo_skip(nfo, force=False, is_fail=False) is None

    def test_chinese_tag_but_force_fail(self):
        """force+fail 模式覆盖 NFO 中文标记"""
        nfo = _make_nfo(has_chinese=True)
        assert _check_nfo_skip(nfo, force=True, is_fail=True) is None


class TestCheckReleaseAge:
    """_check_release_age 单元测试"""

    def test_no_min_age(self):
        nfo = _make_nfo(release_date="2026-01-01")
        assert _check_release_age(nfo, min_age_days=0) is None

    def test_no_release_date(self):
        nfo = _make_nfo()
        assert _check_release_age(nfo, min_age_days=30) is None

    def test_old_enough(self):
        """发布日期足够久 → 不跳过"""
        nfo = _make_nfo(release_date="2020-01-01")
        assert _check_release_age(nfo, min_age_days=30) is None

    def test_too_recent(self):
        """发布日期太新 → 跳过"""
        from datetime import datetime, timedelta

        recent = (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d")
        nfo = _make_nfo(release_date=recent)
        reason = _check_release_age(nfo, min_age_days=30)
        assert reason is not None
        assert "skip" in reason

    def test_invalid_date(self):
        """无效日期 → 不跳过"""
        nfo = _make_nfo(release_date="not-a-date")
        assert _check_release_age(nfo, min_age_days=30) is None


class TestCheckExistingSkip:
    """_check_existing_skip 单元测试"""

    def test_no_existing_file(self):
        with tempfile.TemporaryDirectory() as d:
            assert (
                _check_existing_skip(
                    d, "movie", force=False, is_fail=False, dry_run=False, existing=None
                )
                is None
            )

    def test_has_existing_srt(self):
        with tempfile.TemporaryDirectory() as d:
            open(os.path.join(d, "movie.srt"), "w").close()
            reason = _check_existing_skip(
                d,
                "movie",
                force=False,
                is_fail=False,
                dry_run=False,
                existing="movie.srt",
            )
            assert reason is not None
            assert "already exists" in reason

    def test_force_fail_overrides(self):
        with tempfile.TemporaryDirectory() as d:
            open(os.path.join(d, "movie.srt"), "w").close()
            assert (
                _check_existing_skip(
                    d,
                    "movie",
                    force=True,
                    is_fail=True,
                    dry_run=False,
                    existing="movie.srt",
                )
                is None
            )


class TestCheckSkipIntegration:
    """_check_skip 完整流程集成测试"""

    def test_skip_by_nfo_tag(self):
        """NFO 中文标记 → 跳过"""
        nfo = _make_nfo(has_chinese=True)
        reason, state = _check_skip("/tmp/fake", "movie", nfo)
        assert reason == "NFO has Chinese subtitle tag"

    def test_skip_by_existing_file(self):
        """已有字幕 → 跳过"""
        nfo = _make_nfo(has_chinese=False)
        with tempfile.TemporaryDirectory() as d:
            movie_path = os.path.join(d, "movie")
            os.makedirs(movie_path)
            open(os.path.join(movie_path, "movie.srt"), "w").close()
            reason, state = _check_skip(movie_path, "movie", nfo)
            assert reason is not None
            assert "already exists" in reason

    def test_no_skip_need_download(self):
        """无任何跳过条件 → need_download (dry_run)"""
        nfo = _make_nfo(has_chinese=False)
        with tempfile.TemporaryDirectory() as d:
            movie_path = os.path.join(d, "movie")
            os.makedirs(movie_path)
            reason, state = _check_skip(movie_path, "movie", nfo, dry_run=True)
            assert reason is None
            assert state == DryState.need_download

    def test_fail_skip(self):
        """审查失败 → 跳过"""
        nfo = _make_nfo(has_chinese=False)
        with tempfile.TemporaryDirectory() as d:
            movie_path = os.path.join(d, "movie")
            os.makedirs(movie_path)
            with open(os.path.join(movie_path, ".reviewed"), "w") as f:
                f.write("fail")
            reason, state = _check_skip(movie_path, "movie", nfo)
            assert reason is not None and "Review FAILED" in reason

    def test_fail_force_override(self):
        """审查失败 + force → 继续下载"""
        nfo = _make_nfo(has_chinese=False)
        with tempfile.TemporaryDirectory() as d:
            movie_path = os.path.join(d, "movie")
            os.makedirs(movie_path)
            with open(os.path.join(movie_path, ".reviewed"), "w") as f:
                f.write("fail")
            reason, state = _check_skip(movie_path, "movie", nfo, force=True)
            # force 不跳过 fail，但会检查其他条件（这里没有其他字幕文件）
            assert reason is None or "Review FAILED" not in reason

    def test_reset_fail_clears_mark(self):
        """reset-fail 清除标记后可正常下载（非 dry_run）"""
        nfo = _make_nfo(has_chinese=False)
        with tempfile.TemporaryDirectory() as d:
            movie_path = os.path.join(d, "movie")
            os.makedirs(movie_path)
            with open(os.path.join(movie_path, ".reviewed"), "w") as f:
                f.write("fail")
            reason, state = _check_skip(
                movie_path, "movie", nfo, reset_fail=True, dry_run=False
            )
            # reset 后 .reviewed 被删除，不再被 fail 跳过
            assert os.path.exists(os.path.join(movie_path, ".reviewed")) is False
            assert reason is None or "Review FAILED" not in reason

    def test_reset_fail_dry_run_keeps_file(self):
        """dry_run 模式下 reset-fail 不删文件，仍会跳过"""
        nfo = _make_nfo(has_chinese=False)
        with tempfile.TemporaryDirectory() as d:
            movie_path = os.path.join(d, "movie")
            os.makedirs(movie_path)
            reviewed = os.path.join(movie_path, ".reviewed")
            with open(reviewed, "w") as f:
                f.write("fail")
            reason, state = _check_skip(
                movie_path, "movie", nfo, reset_fail=True, dry_run=True
            )
            # dry_run 模式下文件保留，fail 状态仍在
            assert os.path.exists(reviewed) is True
            assert reason is not None and "Review FAILED" in reason


# ---- _select_primary_alt 测试 ----


def _make_sub(**kwargs: object) -> Subtitle:
    defaults: dict[str, object] = {
        "gcid": "",
        "cid": "",
        "url": "",
        "ext": "srt",
        "name": "Test",
        "duration": 3600000,
        "languages": ["English"],
        "source": 0,
        "score": 0.0,
        "fingerprintf_score": 0.0,
        "extra_name": "",
        "mt": 0,
    }
    defaults.update(kwargs)
    return Subtitle(**defaults)  # type: ignore[arg-type]


class TestSelectPrimaryAlt:
    """_select_primary_alt 单元测试"""

    def test_basic_selection(self):
        """基本场景：API 第一条=主力，算法最佳=备选"""
        s1 = _make_sub(name="SubA", duration=3600000)
        s2 = _make_sub(name="SubB", duration=7200000)
        subtitles = [s1, s2]
        result = SearchResult(subtitles=[s1, s2], total=2)
        client = SubtitleApiClient()

        primary, alt = _select_primary_alt(subtitles, result, client, [])
        assert primary is s1  # API 第一条
        assert alt is s2  # 算法最佳（duration 更长）

    def test_chinese_preferred_as_alt(self):
        """中文优先：中文排在前"""
        s1 = _make_sub(name="English Sub", duration=7200000, languages=["English"])
        s2 = _make_sub(name="中文 Sub", duration=3600000, languages=["Chinese"])
        subtitles = [s1, s2]
        result = SearchResult(subtitles=[s1, s2], total=2)
        client = SubtitleApiClient()

        primary, alt = _select_primary_alt(subtitles, result, client, [])
        assert primary is s1  # API 第一条
        assert alt is s2  # 中文优先

    def test_same_primary_alt_uses_second_api(self):
        """主力=备选时，取 API 第二条作为备选"""
        s1 = _make_sub(name="OnlyChinese", duration=7200000, languages=["Chinese"])
        s2 = _make_sub(name="Other", duration=3600000, languages=["English"])
        subtitles = [s1, s2]
        result = SearchResult(subtitles=[s1, s2], total=2)
        client = SubtitleApiClient()

        primary, alt = _select_primary_alt(subtitles, result, client, [])
        assert primary is s1
        assert alt is s2

    def test_preferred_group_sort(self):
        """偏好字幕组优先"""
        s1 = _make_sub(name="Random Sub", duration=3600000, languages=["English"])
        s2 = _make_sub(
            name="KitaujiSub Release", duration=1800000, languages=["English"]
        )
        subtitles = [s1, s2]
        result = SearchResult(subtitles=[s1, s2], total=2)
        client = SubtitleApiClient()

        primary, alt = _select_primary_alt(subtitles, result, client, ["KitaujiSub"])
        assert primary is s1
        assert alt is s2  # 偏好组最优

    def test_single_subtitle(self):
        """只有一个字幕时，主备选相同"""
        s1 = _make_sub(name="Only", duration=3600000)
        subtitles = [s1]
        result = SearchResult(subtitles=[s1], total=1)
        client = SubtitleApiClient()

        primary, alt = _select_primary_alt(subtitles, result, client, [])
        assert primary is s1
        assert alt is s1
