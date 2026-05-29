"""Review operations endpoints — mark subtitle quality, browse review state."""

import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.models.schemas import (
    MovieListResponse,
    ReviewItemResponse,
    ReviewListResponse,
    ReviewMarkRequest,
    ReviewMarkResponse,
    SubtitlePreviewResponse,
)
from app.services.config_service import ConfigService
from app.services.review_service import ReviewService

logger = logging.getLogger(__name__)


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
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No media paths configured — access denied",
        )
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
        validated_base = _validate_subtitle_path(base_dir)
        result = service.list_reviews(base_dir=validated_base, name_filter=name_filter)
        return result
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="审核模块不可用",
        )
    except Exception as e:
        logger.error("list_reviews failed: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="操作失败")


@router.get("/movies", response_model=MovieListResponse)
async def list_movies(
    base_dir: str = Query(..., description="Base directory to scan"),
    name_filter: Optional[str] = Query(None, description="Filter by name keyword"),
    service: ReviewService = Depends(get_review_service),
    _user: str = Depends(get_current_user),
):
    """轻量电影发现 — 只做文件系统操作，不做深审（用于验证页电影列表）"""
    try:
        validated_base = _validate_subtitle_path(base_dir)
        result = service.list_movies(base_dir=validated_base, name_filter=name_filter)
        return result
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="审核模块不可用",
        )
    except Exception as e:
        logger.error("list_movies failed: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="操作失败")


@router.get("/subtitle/file", response_model=ReviewItemResponse)
async def review_subtitle_file(
    path: str = Query(..., description="Movie directory relative path"),
    file_name: str = Query(..., description="Subtitle file name"),
    base_dir: str = Query(..., description="Base media directory"),
    service: ReviewService = Depends(get_review_service),
    _user: str = Depends(get_current_user),
):
    """按需深审单个字幕文件（编码+SRT+CJK），用于验证页字幕详情"""
    try:
        result = service.review_subtitle_file(
            base_dir=base_dir, file_path=path, file_name=file_name
        )
        return result
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="审核模块不可用",
        )
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="字幕文件不存在")
    except Exception as e:
        logger.error("review_subtitle_file failed: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="操作失败")


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
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="审核模块不可用",
        )
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="目录不存在")
    except Exception as e:
        logger.error("mark_review failed: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="操作失败")


@router.get("/preview", response_model=SubtitlePreviewResponse)
async def preview_subtitle(
    path: str = Query(..., description="Full path to subtitle file"),
    _user: str = Depends(get_current_user),
):
    """Preview first 50 lines of a subtitle file."""
    validated_path = _validate_subtitle_path(path)
    if not os.path.exists(validated_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="字幕文件不存在")
    if not os.path.isfile(validated_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="路径不是文件")

    try:
        content, encoding, total_lines = _detect_and_read_preview(validated_path)
        return SubtitlePreviewResponse(
            content=content,
            encoding=encoding,
            total_lines=total_lines,
        )
    except Exception as e:
        logger.error("preview_subtitle failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="读取预览失败",
        )


@router.delete("/file")
async def delete_subtitle_file(
    path: str = Query(..., description="Full path to subtitle file"),
    service: ReviewService = Depends(get_review_service),
    _user: str = Depends(get_current_user),
):
    """Delete a subtitle file from disk."""
    validated = _validate_subtitle_path(path)
    if not os.path.isfile(validated):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")
    try:
        service.delete_file(validated)
        return {"success": True}
    except OSError as e:
        logger.error("delete_file failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除文件失败",
        )


class RenameRequest(BaseModel):
    path: str  # current full path
    new_name: str


@router.post("/rename")
async def rename_subtitle_file(
    body: RenameRequest,
    service: ReviewService = Depends(get_review_service),
    _user: str = Depends(get_current_user),
):
    """Rename a subtitle file. Returns error if target exists."""
    validated = _validate_subtitle_path(body.path)
    if not os.path.isfile(validated):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")
    new_path = os.path.join(os.path.dirname(validated), body.new_name)
    new_path = _validate_subtitle_path(new_path)
    if os.path.exists(new_path):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="目标文件已存在")
    try:
        service.rename_file(validated, new_path)
        return {"success": True, "new_path": new_path}
    except OSError as e:
        logger.error("rename_file failed: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="重命名失败")
