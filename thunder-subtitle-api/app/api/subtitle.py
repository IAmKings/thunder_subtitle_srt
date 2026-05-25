"""Subtitle search proxy endpoint — wraps the Xunlei API."""

import asyncio
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import get_current_user
from app.models.schemas import (
    SubtitleDetail,
    SubtitleSearchResponse,
)
from app.services.subtitle_service import SubtitleService

logger = logging.getLogger(__name__)

router = APIRouter()

# Module-level lazy httpx client reuse
_httpx_client: Optional[httpx.AsyncClient] = None
_httpx_client_lock = asyncio.Lock()


async def _get_httpx_client() -> httpx.AsyncClient:
    """Get or create the shared httpx AsyncClient instance."""
    global _httpx_client
    if _httpx_client is None:
        async with _httpx_client_lock:
            if _httpx_client is None:
                _httpx_client = httpx.AsyncClient(timeout=60.0)
    return _httpx_client


def get_subtitle_service() -> SubtitleService:
    """Dependency: create a SubtitleService instance."""
    return SubtitleService()


@router.get("/search", response_model=SubtitleSearchResponse)
async def search_subtitles(
    name: str = Query(..., min_length=1, description="Search keyword"),
    chinese_only: bool = Query(False, description="Filter Chinese subtitles only"),
    chinese_first: bool = Query(False, description="Sort Chinese subtitles first"),
    max_duration: Optional[str] = Query(None, description="Max duration filter (e.g. 2h30m)"),
    service: SubtitleService = Depends(get_subtitle_service),
):
    """Search subtitles by name keyword."""
    try:
        result = service.search(
            name=name,
            chinese_only=chinese_only,
            chinese_first=chinese_first,
            max_duration=max_duration,
        )
        return result
    except ValueError as e:
        logger.error("Search failed: %s", e)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="操作失败")
    except Exception as e:
        logger.error("Search failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="搜索失败",
        )


@router.get("/detail", response_model=SubtitleDetail)
async def get_subtitle_detail(
    gcid: str = Query(..., description="Subtitle gcid"),
    cid: str = Query("", description="Subtitle cid"),
    service: SubtitleService = Depends(get_subtitle_service),
):
    """Get detail for a single subtitle."""
    try:
        result = service.get_detail(gcid=gcid, cid=cid)
        if result is None:
            raise HTTPException(status_code=404, detail="Subtitle not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Detail lookup failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="查询详情失败",
        )


@router.get("/download")
async def download_subtitle(
    url: str = Query(..., description="Subtitle download URL"),
    filename: Optional[str] = Query(None, description="Optional filename for the download"),
    _user: str = Depends(get_current_user),
):
    """Proxy download a subtitle file from the given URL."""
    try:
        client = await _get_httpx_client()
        response = await client.get(url, follow_redirects=True)
        response.raise_for_status()

        # Determine content type and filename
        content_type = response.headers.get("content-type", "application/octet-stream")
        if not filename:
            # Try to extract filename from Content-Disposition header
            cd = response.headers.get("content-disposition", "")
            if "filename=" in cd:
                filename = cd.split("filename=")[-1].strip("\"'")
            else:
                # Generate a filename based on content type
                ext_map = {
                    "application/zip": ".zip",
                    "application/x-rar-compressed": ".rar",
                    "text/plain": ".srt",
                    "application/x-subrip": ".srt",
                }
                ext = ext_map.get(content_type, ".srt")
                filename = f"subtitle{ext}"

        # Return the file content
        from fastapi.responses import Response

        return Response(
            content=response.content,
            media_type=content_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except httpx.HTTPStatusError as e:
        logger.error("Download failed: upstream returned %s", e.response.status_code)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="下载失败，上游服务异常",
        )
    except httpx.RequestError as e:
        logger.error("Download failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="下载超时",
        )
