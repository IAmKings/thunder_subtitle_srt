"""Task management endpoints — scan, review, dump operations."""

import asyncio
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.models.schemas import (
    TaskCreate,
    TaskResponse,
    TaskListResponse,
    TaskProgressUpdate,
)
from app.services.scan_service import ScanService

router = APIRouter()


def get_scan_service() -> ScanService:
    """Dependency: create a ScanService instance."""
    return ScanService()


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List all tasks with optional status filter."""
    # TODO: Implement task storage (in-memory dict for now)
    return TaskListResponse(tasks=[], total=0, limit=limit, offset=offset)


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    body: TaskCreate,
    service: ScanService = Depends(get_scan_service),
):
    """Create a new task (scan, review, or dump)."""
    task = service.create_task(body)
    return task


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str):
    """Get task status and progress."""
    # TODO: Implement task lookup
    raise HTTPException(status_code=404, detail="Task not found")


@router.post("/{task_id}/cancel", response_model=TaskResponse)
async def cancel_task(task_id: str):
    """Cancel a running task."""
    # TODO: Implement task cancellation
    raise HTTPException(status_code=404, detail="Task not found")


@router.get("/{task_id}/progress", response_model=TaskProgressUpdate)
async def get_task_progress(task_id: str):
    """Get detailed task progress (also available via WebSocket)."""
    # TODO: Implement progress lookup
    raise HTTPException(status_code=404, detail="Task not found")