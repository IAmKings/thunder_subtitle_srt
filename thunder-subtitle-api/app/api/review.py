"""Review operations endpoints — mark subtitle quality, browse review state."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth.dependencies import get_current_user
from app.models.schemas import (
    ReviewListRequest,
    ReviewListResponse,
    ReviewMarkRequest,
    ReviewMarkResponse,
)
from app.services.review_service import ReviewService

router = APIRouter()


def get_review_service() -> ReviewService:
    """Dependency: create a ReviewService instance."""
    return ReviewService()


@router.get("/list", response_model=ReviewListResponse)
async def list_reviews(
    base_dir: str = Query(..., description="Base directory to scan"),
    name_filter: Optional[str] = Query(None, description="Filter by name keyword"),
    service: ReviewService = Depends(get_review_service),
    _user: str = Depends(get_current_user),
):
    """List review items for subtitles in a directory."""
    try:
        result = service.list_reviews(base_dir=base_dir, name_filter=name_filter)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mark", response_model=ReviewMarkResponse)
async def mark_review(
    body: ReviewMarkRequest,
    service: ReviewService = Depends(get_review_service),
    _user: str = Depends(get_current_user),
):
    """Mark a subtitle directory as reviewed (ok/fail)."""
    try:
        result = service.mark_review(
            base_dir=body.base_dir,
            path=body.path,
            status=body.status,
        )
        return result
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Directory not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))