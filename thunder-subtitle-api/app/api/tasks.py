"""Task management endpoints — scan, review, dump, and scheduled operations."""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import get_current_user
from app.models.schemas import (
    ScheduledTask,
    ScheduledTaskUpdate,
    TaskCreate,
    TaskListResponse,
    TaskProgressUpdate,
    TaskResponse,
)
from app.services.scan_service import scan_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _user: str = Depends(get_current_user),
):
    """List all tasks with optional status filter."""
    tasks, total = await scan_service.list_tasks(
        status_filter=status_filter, limit=limit, offset=offset
    )
    return TaskListResponse(tasks=tasks, total=total, limit=limit, offset=offset)


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    body: TaskCreate,
    _user: str = Depends(get_current_user),
):
    """Create a new task (scan, review, or dump) and start it in the background."""
    try:
        task = await scan_service.create_task(body)
    except Exception as e:
        logger.error("Failed to create task: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建任务失败",
        )

    # 手动扫描优先：取消同目录正在运行的任务（排除自身）
    await scan_service.cancel_tasks_for_paths(body.params, exclude_id=task.id)

    # Start the task in the background with error logging
    background_task = asyncio.create_task(scan_service.start_task(task.id))
    background_task.add_done_callback(_log_task_error)

    return task


def _log_task_error(future: asyncio.Task) -> None:
    """Log any unhandled exception from background tasks."""
    try:
        exc = future.exception()
        if exc:
            logger.error("Background task failed with unhandled exception: %s", exc)
    except (asyncio.CancelledError, Exception):
        pass


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    _user: str = Depends(get_current_user),
):
    """Get task status and progress."""
    task = await scan_service.get_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("/{task_id}/cancel", response_model=TaskResponse)
async def cancel_task(
    task_id: str,
    _user: str = Depends(get_current_user),
):
    """Cancel a running task."""
    task = await scan_service.cancel_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/{task_id}/progress", response_model=TaskProgressUpdate)
async def get_task_progress(
    task_id: str,
    _user: str = Depends(get_current_user),
):
    """Get detailed task progress (also available via WebSocket)."""
    task = await scan_service.get_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskProgressUpdate(
        task_id=task.id,
        progress=task.progress,
        message=task.message,
        status=task.status,
    )


# ---- Scheduled Task Endpoints (独立 router，避免与 tasks router 冲突) ----

scheduled_router = APIRouter()


@scheduled_router.get("", response_model=list[ScheduledTask])
async def list_scheduled_tasks(
    _user: str = Depends(get_current_user),
):
    """List all scheduled task configurations."""
    return scan_service.get_scheduled_tasks()


@scheduled_router.put("", response_model=ScheduledTask)
async def save_scheduled_task(
    body: ScheduledTaskUpdate,
    _user: str = Depends(get_current_user),
):
    """Save a scheduled task configuration for a directory (directory_path in body)."""
    if not body.directory_path:
        raise HTTPException(status_code=400, detail="directory_path is required")
    # Validate cron expression
    try:
        from app.services.scan_service import _parse_cron

        _parse_cron(body.cron)
    except (ValueError, Exception) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"无效的 cron 表达式: {e}",
        )

    result = scan_service.save_scheduled_task(body.directory_path, body.model_dump())
    await scan_service.restart_scheduler_for_dir(body.directory_path)
    return result


@scheduled_router.delete("")
async def delete_scheduled_task(
    path: str = Query(..., description="Media directory path"),
    _user: str = Depends(get_current_user),
):
    """Delete a scheduled task configuration for a directory."""
    found = scan_service.delete_scheduled_task(path)
    if not found:
        raise HTTPException(status_code=404, detail="Scheduled task not found")
    await scan_service.restart_scheduler_for_dir(path)
    return {"success": True}
