"""Scan service — wraps the CLI scanner for directory scanning tasks."""

import os
from typing import Optional
from uuid import uuid4

from app.config import settings
from app.models.schemas import (
    MediaDirectory,
    NfoInfoResponse,
    TaskCreate,
    TaskResponse,
    TaskStatus,
    TaskType,
)


class ScanService:
    """Service that wraps the CLI scanner for media library operations."""

    # In-memory task storage (placeholder — use a proper store in production)
    _tasks: dict[str, TaskResponse] = {}

    def create_task(self, request: TaskCreate) -> TaskResponse:
        """Create a new scan/review/dump task."""
        task_id = str(uuid4())
        task = TaskResponse(
            id=task_id,
            type=request.type,
            status=TaskStatus.PENDING,
            progress=0,
            message="Task created, waiting to start",
            params=request.params,
            created_at="",
            updated_at="",
        )
        self._tasks[task_id] = task
        # TODO: Enqueue task for background execution via asyncio
        return task

    def list_media_directories(self) -> list[MediaDirectory]:
        """List configured media directories with file counts."""
        dirs = []
        for path in settings.media_paths_list:
            if os.path.isdir(path):
                try:
                    entries = os.listdir(path)
                    movie_count = sum(
                        1 for e in entries if os.path.isdir(os.path.join(path, e))
                    )
                    dirs.append(
                        MediaDirectory(
                            path=path,
                            name=os.path.basename(path),
                            movie_count=movie_count,
                        )
                    )
                except OSError:
                    dirs.append(
                        MediaDirectory(
                            path=path,
                            name=os.path.basename(path),
                            movie_count=0,
                        )
                    )
        return dirs

    def get_nfo_info(self, path: str) -> NfoInfoResponse:
        """Parse movie.nfo from a media directory."""
        try:
            from src.utils import parse_nfo
        except ImportError:
            from thunder_subtitle.utils import parse_nfo  # type: ignore[import-untyped]

        nfo_path = os.path.join(path, "movie.nfo")
        nfo = parse_nfo(nfo_path)
        return NfoInfoResponse(
            path=path,
            duration_seconds=nfo.duration_seconds,
            has_chinese_subtitle=nfo.has_chinese_subtitle,
            release_date=nfo.release_date,
        )