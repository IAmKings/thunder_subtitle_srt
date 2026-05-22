"""Review service — wraps the CLI reviewer for subtitle quality operations."""

import logging
import os
from typing import Optional

from app.models.schemas import (
    ReviewItemResponse,
    ReviewListResponse,
    ReviewMarkResponse,
    ReviewState,
)

logger = logging.getLogger(__name__)


class ReviewService:
    """Service that wraps the CLI reviewer for review operations."""

    def list_reviews(
        self, base_dir: str, name_filter: Optional[str] = None
    ) -> ReviewListResponse:
        """List review items for a directory."""
        if not base_dir or not os.path.isdir(base_dir):
            return ReviewListResponse(items=[], total=0)

        try:
            from src.reviewer import review_directory
        except ImportError:
            try:
                from thunder_subtitle.reviewer import (
                    review_directory,  # type: ignore[import-untyped]
                )
            except ImportError:
                logger.warning("Reviewer module not available")
                return ReviewListResponse(items=[], total=0)

        try:
            name_filters = [name_filter] if name_filter else None
            items = review_directory(base_dir, name_filters=name_filters)

            # Map ReviewItem dataclass → ReviewItemResponse schema
            response_items = []
            for item in items:
                # Determine review_status from the reviewed flag and fail status
                review_status = ReviewState.not_reviewed
                if item.reviewed:
                    # Check .reviewed file content for status
                    try:
                        from src.reviewer._marker import _is_reviewed
                    except ImportError:
                        try:
                            from thunder_subtitle.reviewer._marker import (
                                _is_reviewed,  # type: ignore[import-untyped]
                            )
                        except ImportError:
                            _is_reviewed = None

                    if _is_reviewed:
                        status_str, date_str = _is_reviewed(item.movie_path)
                        if status_str == "fail":
                            review_status = ReviewState.fail
                        elif status_str == "ok":
                            review_status = ReviewState.ok
                        item.reviewed_date = date_str

                # Map quality status string to display string
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
        except Exception:
            logger.exception("Failed to list reviews for %s", base_dir)
            return ReviewListResponse(items=[], total=0)

    def mark_review(
        self, base_dir: str, path: str, status: str
    ) -> ReviewMarkResponse:
        """Mark a directory as reviewed (ok/fail)."""
        try:
            from src.reviewer import mark_directory
        except ImportError:
            try:
                from thunder_subtitle.reviewer import mark_directory  # type: ignore[import-untyped]
            except ImportError:
                return ReviewMarkResponse(success=False, message="Review module not available")

        try:
            if status == "ok":
                mark_directory(base_dir, mark_path=path)
            elif status == "fail":
                mark_directory(base_dir, mark_fail_path=path)
            else:
                return ReviewMarkResponse(success=False, message=f"Invalid status: {status}")

            return ReviewMarkResponse(success=True, message=f"Marked as {status}")
        except Exception as e:
            logger.exception("Failed to mark review for %s", path)
            return ReviewMarkResponse(success=False, message=str(e))
