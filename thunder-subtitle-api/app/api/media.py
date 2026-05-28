"""Media library endpoints — directory listing, NFO metadata, image serving."""

import logging
import os
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from PIL import Image

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


@router.get("/image")
async def get_media_image(
    path: str = Query(..., description="Full path to image file"),
    width: int = Query(128, description="Max width in pixels (auto-height)"),
    _user: str = Depends(get_current_user),
):
    """Serve a resized thumbnail of a media image."""
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="图片不存在")

    try:
        img = Image.open(path)
        img = img.convert("RGB")
        w_percent = width / float(img.size[0])
        h_size = int(float(img.size[1]) * w_percent)
        img = img.resize((width, h_size), Image.LANCZOS)

        buf = BytesIO()
        img.save(buf, format="JPEG", quality=85)
        buf.seek(0)
        return StreamingResponse(buf, media_type="image/jpeg")
    except Exception as e:
        logger.error("get_media_image failed: %s", e)
        raise HTTPException(status_code=500, detail="图片处理失败")
