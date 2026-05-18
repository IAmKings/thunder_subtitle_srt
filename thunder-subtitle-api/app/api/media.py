"""Media library endpoints — directory listing, NFO metadata."""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth.dependencies import get_current_user
from app.models.schemas import MediaDirectory, NfoInfoResponse
from app.services.scan_service import ScanService, scan_service

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
        raise HTTPException(status_code=404, detail="movie.nfo not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))