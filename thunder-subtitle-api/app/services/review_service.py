"""Review service — wraps the CLI reviewer for subtitle quality operations."""

from typing import Optional

from app.models.schemas import (
    ReviewListResponse,
    ReviewMarkResponse,
    ReviewState,
)


class ReviewService:
    """Service that wraps the CLI reviewer for review operations."""

    def list_reviews(
        self, base_dir: str, name_filter: Optional[str] = None
    ) -> ReviewListResponse:
        """List review items for a directory."""
        try:
            from src.reviewer import review_directory
            from src.scanner import scan_movie_dirs
        except ImportError:
            # Placeholder when CLI source is not available
            return ReviewListResponse(items=[], total=0)

        # TODO: Implement async review listing with progress
        return ReviewListResponse(items=[], total=0)

    def mark_review(
        self, base_dir: str, path: str, status: str
    ) -> ReviewMarkResponse:
        """Mark a directory as reviewed (ok/fail)."""
        try:
            from src.reviewer import mark_directory
            from src.types import ReviewState as PyReviewState
        except ImportError:
            return ReviewMarkResponse(success=False, message="Review module not available")

        # Convert string status to ReviewState enum
        review_status = PyReviewState.ok if status == "ok" else PyReviewState.fail

        try:
            if status == "ok":
                mark_directory(base_dir, mark_path=path)
            else:
                mark_directory(base_dir, mark_fail_path=path)
            return ReviewMarkResponse(success=True, message=f"Marked as {status}")
        except Exception as e:
            return ReviewMarkResponse(success=False, message=str(e))