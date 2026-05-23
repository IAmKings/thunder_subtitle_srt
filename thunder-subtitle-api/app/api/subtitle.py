"""Subtitle search proxy endpoint — wraps the Xunlei API."""

from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.models.schemas import (
    SubtitleDetail,
    SubtitleSearchResponse,
)
from app.services.subtitle_service import SubtitleService

router = APIRouter()


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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {e}",
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Detail lookup failed: {e}",
        )


@router.get("/download")
async def download_subtitle(
    url: str = Query(..., description="Subtitle download URL"),
    filename: Optional[str] = Query(None, description="Optional filename for the download"),
):
    """Proxy download a subtitle file from the given URL."""
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
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
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Download failed: upstream returned {e.response.status_code}",
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Download failed: {e}",
        )
