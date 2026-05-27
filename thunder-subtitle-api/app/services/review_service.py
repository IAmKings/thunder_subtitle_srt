"""Review service — wraps the CLI reviewer for subtitle quality operations."""

import logging
import os
from typing import Literal, Optional

from app._cli_imports import cli_import
from app.models.schemas import (
    MovieEntryResponse,
    MovieListResponse,
    ReviewItemResponse,
    ReviewListResponse,
    ReviewMarkResponse,
    ReviewState,
)

logger = logging.getLogger(__name__)


class ReviewService:
    """Service that wraps the CLI reviewer for review operations."""

    def _import_reviewer(self):
        """Import reviewer module with dual-import fallback. Raises ImportError if unavailable."""
        mod = cli_import("src.reviewer")
        return mod.review_directory, mod.mark_directory

    def _get_is_reviewed(self):
        """Import _is_reviewed helper with dual-import fallback."""
        mod = cli_import("src.reviewer._marker")
        return mod._is_reviewed

    def list_reviews(self, base_dir: str, name_filter: Optional[str] = None) -> ReviewListResponse:
        """List review items for a directory."""
        if not base_dir or not os.path.isdir(base_dir):
            return ReviewListResponse(items=[], total=0)

        review_directory, _mark_directory = self._import_reviewer()

        name_filters = [name_filter] if name_filter else None
        items = review_directory(base_dir, name_filters=name_filters)

        # Map ReviewItem dataclass → ReviewItemResponse schema
        response_items = []
        for item in items:
            # Determine review_status from the reviewed flag and fail status
            review_status = ReviewState.not_reviewed
            if item.reviewed:
                try:
                    is_reviewed_fn = self._get_is_reviewed()
                    status_str, date_str = is_reviewed_fn(item.movie_path)
                    if status_str == "fail":
                        review_status = ReviewState.fail
                    elif status_str == "ok":
                        review_status = ReviewState.ok
                    item.reviewed_date = date_str
                except ImportError:
                    pass

            quality_display = str(item.status) if item.status else "unknown"

            response_items.append(
                ReviewItemResponse(
                    file_path=item.movie_path,
                    file_name=item.filename,
                    quality=quality_display,
                    score=getattr(item, "score", 0),
                    size_bytes=getattr(item, "size_bytes", 0),
                    chinese_ratio=item.cn_ratio,
                    encoding=item.encoding,
                    review_status=review_status,
                    review_date=item.reviewed_date or "",
                )
            )

        return ReviewListResponse(items=response_items, total=len(response_items))

    def list_movies(self, base_dir: str, name_filter: Optional[str] = None) -> MovieListResponse:
        """轻量电影发现 — 只做文件系统操作，不做深审（用于验证页电影列表）"""
        if not base_dir or not os.path.isdir(base_dir):
            return MovieListResponse(movies=[])

        try:
            from src.reviewer import list_review_movies
        except ImportError:
            from thunder_subtitle.reviewer import list_review_movies  # type: ignore

        entries = list_review_movies(base_dir, name_filter)
        movies = [
            MovieEntryResponse(
                path=e.path,
                name=e.name,
                sub_files=e.sub_files,
                review_status=e.review_status,
                review_date=e.review_date,
            )
            for e in entries
        ]
        return MovieListResponse(movies=movies)

    def review_subtitle_file(
        self, base_dir: str, file_path: str, file_name: str
    ) -> ReviewItemResponse:
        """按需深审单个字幕文件（编码+SRT+CJK），用于验证页字幕详情"""
        try:
            from src.reviewer import review_subtitle_file as _review_one
        except ImportError:
            from thunder_subtitle.reviewer import (
                review_subtitle_file as _review_one,  # type: ignore
            )

        movie_name = os.path.basename(file_path)
        full_filepath = os.path.join(base_dir, file_path, file_name)
        full_movie_path = os.path.join(base_dir, file_path)

        # Determine review_status from the reviewed flag
        review_status = ReviewState.not_reviewed
        review_date = ""
        try:
            is_reviewed_fn = self._get_is_reviewed()
            status_str, date_str = is_reviewed_fn(full_movie_path)
            if status_str == "fail":
                review_status = ReviewState.fail
            elif status_str == "ok":
                review_status = ReviewState.ok
            review_date = date_str
        except ImportError:
            pass

        item = _review_one(full_filepath, file_name, full_movie_path, movie_name)
        quality_display = str(item.status) if item.status else "unknown"

        return ReviewItemResponse(
            file_path=item.movie_path,
            file_name=item.filename,
            quality=quality_display,
            score=getattr(item, "score", 0),
            size_bytes=getattr(item, "size_bytes", 0),
            chinese_ratio=item.cn_ratio,
            encoding=item.encoding,
            review_status=review_status,
            review_date=review_date,
        )

    def mark_review(
        self, base_dir: str, path: str, status: Literal["ok", "fail"]
    ) -> ReviewMarkResponse:
        """Mark a directory as reviewed (ok/fail)."""
        _review_directory, mark_directory = self._import_reviewer()

        try:
            if status == "fail":
                mark_directory(base_dir, mark_fail_path=path)
            elif status == "ok":
                mark_directory(base_dir, mark_path=path)
            else:
                return ReviewMarkResponse(success=False, message=f"Invalid status: {status}")

            return ReviewMarkResponse(success=True, message=f"Marked as {status}")
        except Exception as e:
            logger.exception("Failed to mark review for %s", path)
            return ReviewMarkResponse(success=False, message=str(e))

    def delete_file(self, path: str) -> None:
        """Delete a subtitle file from disk. Raises OSError on failure."""
        os.remove(path)

    def rename_file(self, old_path: str, new_path: str) -> None:
        """Rename a subtitle file. Raises OSError on failure."""
        os.rename(old_path, new_path)
