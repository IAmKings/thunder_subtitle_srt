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
):
    """Serve a resized thumbnail of a media image. No auth required (img tag can't send headers)."""
    # 路径校验：仅允许访问 CLI 配置的媒体目录内的文件
    real_path = os.path.realpath(path)
    allowed = False
    try:
        from app.services.config_service import ConfigService

        config_svc = ConfigService()
        config = config_svc.get_config()
        for media_root in (p.strip() for p in (config.media_paths or "").split(",") if p.strip()):
            media_real = os.path.realpath(media_root)
            in_dir = real_path.startswith(media_real + os.sep) or real_path == media_real
            if os.path.isdir(media_real) and in_dir:
                allowed = True
                break
    except Exception:
        pass  # ConfigService 不可用时拒绝所有路径
    if not allowed:
        raise HTTPException(status_code=403, detail="无权访问此路径")

    if not os.path.isfile(real_path):
        raise HTTPException(status_code=404, detail="图片不存在")

    # Reject files over 50MB to prevent denial-of-service via large image processing
    max_image_size = 50 * 1024 * 1024  # 50 MB
    try:
        file_size = os.path.getsize(real_path)
    except OSError:
        raise HTTPException(status_code=500, detail="无法读取文件大小")
    if file_size > max_image_size:
        raise HTTPException(status_code=413, detail="图片文件过大（超过 50MB）")

    try:
        img = Image.open(real_path)
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
