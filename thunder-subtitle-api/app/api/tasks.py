"""Task management endpoints — scan, review, dump operations."""

import asyncio
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import get_current_user
from app.models.schemas import (
    TaskCreate,
    TaskListResponse,
    TaskProgressUpdate,
    TaskResponse,
)
from app.services.scan_service import scan_service

router = APIRouter()


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _user: str = Depends(get_current_user),
):
    """List all tasks with optional status filter."""
    tasks, total = scan_service.list_tasks(status_filter=status_filter, limit=limit, offset=offset)
    return TaskListResponse(tasks=tasks, total=total, limit=limit, offset=offset)


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    body: TaskCreate,
    _user: str = Depends(get_current_user),
):
    """Create a new task (scan, review, or dump) and start it in the background."""
    task = scan_service.create_task(body)

    # Start the task in the background
    asyncio.create_task(scan_service.start_task(task.id))

    return task


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    _user: str = Depends(get_current_user),
):
    """Get task status and progress."""
    task = scan_service.get_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("/{task_id}/cancel", response_model=TaskResponse)
async def cancel_task(
    task_id: str,
    _user: str = Depends(get_current_user),
):
    """Cancel a running task."""
    task = scan_service.cancel_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/{task_id}/progress", response_model=TaskProgressUpdate)
async def get_task_progress(
    task_id: str,
    _user: str = Depends(get_current_user),
):
    """Get detailed task progress (also available via WebSocket)."""
    task = scan_service.get_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskProgressUpdate(
        task_id=task.id,
        progress=task.progress,
        message=task.message,
        status=task.status,
    )
