"""Media library endpoints — directory listing, NFO metadata."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth.dependencies import get_current_user
from app.models.schemas import MediaDirectory, NfoInfoResponse
from app.services.scan_service import scan_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/directories", response_model=list[MediaDirectory])
async def list_media_directories(
    _user: str = Depends(get_current_user),
):
    """List configured media directories with stats."""
    dirs = scan_service.list_media_directories()
    return dirs


@router.get("/nfo", response_model=NfoInfoResponse)
async def get_nfo_info(
    path: str = Query(..., description="Path to movie directory"),
    _user: str = Depends(get_current_user),
):
    """Parse movie.nfo from a media directory."""
    try:
        nfo = scan_service.get_nfo_info(path)
        return nfo
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="movie.nfo 不存在")
    except Exception as e:
        logger.error("get_nfo_info failed: %s", e)
        raise HTTPException(status_code=500, detail="读取 NFO 信息失败")
