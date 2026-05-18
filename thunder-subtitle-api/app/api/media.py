"""Media library endpoints — directory listing, NFO metadata."""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.models.schemas import MediaDirectory, NfoInfoResponse
from app.services.scan_service import ScanService

router = APIRouter()


def get_scan_service() -> ScanService:
    """Dependency: create a ScanService instance."""
    return ScanService()


@router.get("/directories", response_model=list[MediaDirectory])
async def list_media_directories(
    service: ScanService = Depends(get_scan_service),
):
    """List configured media directories with stats."""
    dirs = service.list_media_directories()
    return dirs


@router.get("/nfo", response_model=NfoInfoResponse)
async def get_nfo_info(
    path: str = Query(..., description="Path to movie directory"),
    service: ScanService = Depends(get_scan_service),
):
    """Parse movie.nfo from a media directory."""
    try:
        nfo = service.get_nfo_info(path)
        return nfo
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="movie.nfo not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))