"""Review operations endpoints — mark subtitle quality, browse review state."""

import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.models.schemas import (
    ReviewListResponse,
    ReviewMarkRequest,
    ReviewMarkResponse,
    SubtitlePreviewResponse,
)
from app.services.config_service import ConfigService
from app.services.review_service import ReviewService


def _get_allowed_roots() -> list[str]:
    """Return realpath-normalized list of allowed media root directories."""
    config_service = ConfigService()
    config = config_service.get_config()
    raw = config.media_paths or ""
    paths = [p.strip() for p in raw.split(",") if p.strip()]
    return [os.path.realpath(p) for p in paths if os.path.isdir(p)]


def _validate_subtitle_path(path: str) -> str:
    """Validate that the resolved path is within an allowed media root directory.

    Raises HTTPException 403 if the path is outside allowed directories.
    Returns the realpath of the given path.
    """
    real = os.path.realpath(path)
    allowed = _get_allowed_roots()
    if not allowed:
        # No roots configured — allow (backward-compatible)
        return real
    for root in allowed:
        if real.startswith(root + "/") or real == root:
            return real
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Path outside allowed media directories",
    )


router = APIRouter()


def _detect_and_read_preview(file_path: str) -> tuple[str, str, int]:
    """Read subtitle file with encoding detection. Returns (content, encoding, total_lines).

    Tries utf-8, gbk, utf-16 in order; falls back to latin-1 (which never fails)
    but reports encoding as "unknown".
    """
    encodings_to_try = ["utf-8", "gbk", "utf-16"]
    content = None
    used_encoding = "utf-8"
    for enc in encodings_to_try:
        try:
            with open(file_path, "r", encoding=enc) as f:
                content = f.read()
            used_encoding = enc
            break
        except (UnicodeDecodeError, UnicodeError):
            continue

    if content is None:
        # Fallback: read as latin-1 (never fails) but report as unknown
        with open(file_path, "r", encoding="latin-1") as f:
            content = f.read()
        used_encoding = "unknown"

    lines = content.splitlines()
    total_lines = len(lines)
    preview_content = content  # return full content, frontend paginates

    return preview_content, used_encoding, total_lines


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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Directory not found")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/preview", response_model=SubtitlePreviewResponse)
async def preview_subtitle(
    path: str = Query(..., description="Full path to subtitle file"),
    _user: str = Depends(get_current_user),
):
    """Preview first 50 lines of a subtitle file."""
    validated_path = _validate_subtitle_path(path)
    if not os.path.exists(validated_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subtitle file not found")
    if not os.path.isfile(validated_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Path is not a file")

    try:
        content, encoding, total_lines = _detect_and_read_preview(validated_path)
        return SubtitlePreviewResponse(
            content=content,
            encoding=encoding,
            total_lines=total_lines,
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.delete("/file")
async def delete_subtitle_file(
    path: str = Query(..., description="Full path to subtitle file"),
    _user: str = Depends(get_current_user),
):
    """Delete a subtitle file from disk."""
    validated = _validate_subtitle_path(path)
    if not os.path.isfile(validated):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    try:
        os.remove(validated)
        return {"success": True}
    except OSError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


class RenameRequest(BaseModel):
    path: str  # current full path
    new_name: str


@router.post("/rename")
async def rename_subtitle_file(
    body: RenameRequest,
    _user: str = Depends(get_current_user),
):
    """Rename a subtitle file. Returns error if target exists."""
    validated = _validate_subtitle_path(body.path)
    if not os.path.isfile(validated):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    new_path = os.path.join(os.path.dirname(validated), body.new_name)
    new_path = _validate_subtitle_path(new_path)
    if os.path.exists(new_path):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Target file already exists"
        )
    try:
        os.rename(validated, new_path)
        return {"success": True, "new_path": new_path}
    except OSError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
