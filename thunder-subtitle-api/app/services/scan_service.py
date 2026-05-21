"""Scan service — wraps the CLI scanner for directory scanning tasks."""

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from app.models.schemas import (
    MediaDirectory,
    NfoInfoResponse,
    ScanResultItem,
    TaskCreate,
    TaskProgressUpdate,
    TaskResponse,
    TaskStatus,
    TaskType,
)
from app.ws.manager import manager as ws_manager

logger = logging.getLogger(__name__)


def _get_media_paths() -> list[str]:
    """Helper: load media paths from CLI config (env var > JSON)."""
    try:
        from src.config import Config
    except ImportError:
        from thunder_subtitle.config import Config  # type: ignore[import-untyped]
    return Config.load().media_paths_list


class ScanService:
    """Service that wraps the CLI scanner for media library operations."""

    # Class-level task storage (shared across all instances)
    _tasks: dict[str, TaskResponse] = {}
    _task_handles: dict[str, asyncio.Task] = {}

    def create_task(self, request: TaskCreate) -> TaskResponse:
        """Create a new scan/review/dump task."""
        task_id = str(uuid4())
        now = datetime.now(timezone.utc).isoformat()
        task = TaskResponse(
            id=task_id,
            type=request.type,
            status=TaskStatus.PENDING,
            progress=0.0,
            message="Task created, waiting to start",
            params=request.params,
            created_at=now,
            updated_at=now,
        )
        self._tasks[task_id] = task
        return task

    def get_task(self, task_id: str) -> Optional[TaskResponse]:
        """Get a task by ID."""
        return self._tasks.get(task_id)

    def list_tasks(
        self,
        status_filter: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[TaskResponse], int]:
        """List tasks with optional filtering."""
        tasks = list(self._tasks.values())
        if status_filter:
            tasks = [t for t in tasks if t.status.value == status_filter]
        total = len(tasks)
        # Sort by created_at descending
        tasks.sort(key=lambda t: t.created_at, reverse=True)
        tasks = tasks[offset : offset + limit]
        return tasks, total

    def cancel_task(self, task_id: str) -> Optional[TaskResponse]:
        """Cancel a running task."""
        task = self._tasks.get(task_id)
        if task is None:
            return None

        # Cancel the asyncio task if running
        handle = self._task_handles.get(task_id)
        if handle and not handle.done():
            handle.cancel()

        task.status = TaskStatus.CANCELLED
        task.updated_at = datetime.now(timezone.utc).isoformat()
        task.message = "Task cancelled by user"
        return task

    async def start_task(self, task_id: str) -> None:
        """Start executing a task in the background."""
        task = self._tasks.get(task_id)
        if task is None:
            return

        task.status = TaskStatus.RUNNING
        task.progress = 0.0
        task.message = "Task started"
        task.updated_at = datetime.now(timezone.utc).isoformat()

        try:
            if task.type == TaskType.SCAN:
                await self._execute_scan(task)
            elif task.type == TaskType.REVIEW:
                await self._execute_review(task)
            elif task.type == TaskType.DUMP:
                await self._execute_dump(task)
            else:
                task.status = TaskStatus.FAILED
                task.message = f"Unknown task type: {task.type}"
        except asyncio.CancelledError:
            task.status = TaskStatus.CANCELLED
            task.message = "Task was cancelled"
        except Exception as e:
            logger.exception("Task %s failed", task_id)
            task.status = TaskStatus.FAILED
            task.message = f"Task failed: {e}"
        finally:
            task.updated_at = datetime.now(timezone.utc).isoformat()
            # Broadcast final state
            await ws_manager.broadcast(
                task_id,
                TaskProgressUpdate(
                    task_id=task_id,
                    progress=task.progress,
                    message=task.message,
                    status=task.status,
                ).model_dump(),
            )
            # Clean up handle
            self._task_handles.pop(task_id, None)

    async def _execute_scan(self, task: TaskResponse) -> None:
        """Execute a scan task using the CLI scanner."""
        try:
            from src.config import Config
            from src.scanner import process_scanned_movies
        except ImportError:
            try:
                from thunder_subtitle.config import Config  # type: ignore[import-untyped]
                from thunder_subtitle.scanner import (  # type: ignore[import-untyped]
                    process_scanned_movies,
                )
            except ImportError:
                raise RuntimeError("Scanner module not available")

        # Determine which path(s) to scan
        paths_param = task.params.get("paths", None)
        if paths_param is not None and isinstance(paths_param, list):
            paths = [p for p in paths_param if isinstance(p, str)]
        else:
            scan_path = task.params.get("path", "")
            if scan_path:
                paths = [scan_path]
            else:
                # Use all configured media paths (env var > JSON)
                paths = _get_media_paths()

        if not paths:
            task.status = TaskStatus.FAILED
            task.message = "No media paths configured"
            return

        # Extract optional keyword filters
        filters: list[str] = task.params.get("filters", [])
        if isinstance(filters, str):
            # Split by space or comma
            import re

            filters = [f.strip() for f in re.split(r"[ ,]+", filters) if f.strip()]
        filters = filters if filters else None

        config = Config.load()
        processed = 0
        all_results: list[dict] = []

        for path in paths:
            if not os.path.isdir(path):
                continue

            task.message = f"Scanning: {path}"
            task.updated_at = datetime.now(timezone.utc).isoformat()

            await ws_manager.broadcast(
                task.id,
                TaskProgressUpdate(
                    task_id=task.id,
                    progress=task.progress,
                    message=task.message,
                    status=TaskStatus.RUNNING,
                ).model_dump(),
            )

            try:
                # Determine scan mode from params
                mode = task.params.get("mode", "scan")
                scan_kwargs: dict[str, object] = {}
                if mode == "dry_run":
                    scan_kwargs["dry_run"] = True
                elif mode == "dump":
                    scan_kwargs["dump_mode"] = True
                elif mode == "dump_force":
                    scan_kwargs["dump_mode"] = True
                    scan_kwargs["force"] = True
                else:  # "scan" (default)
                    scan_kwargs["dry_run"] = False
                    scan_kwargs["dump_mode"] = False

                # process_scanned_movies handles scan_movie_dirs + filter internally
                results = await asyncio.to_thread(
                    process_scanned_movies,
                    path,
                    name_filters=filters,
                    config=config,
                    **scan_kwargs,
                )

                # Accumulate results across all paths
                batch_results = [
                    {
                        "movie_name": r.movie_name,
                        "status": r.status,
                        "reason": r.reason,
                        "filename": r.filename,
                    }
                    for r in results
                ]
                all_results.extend(batch_results)

                # Broadcast each result via WebSocket for progressive display
                for r in results:
                    await ws_manager.broadcast(
                        task.id,
                        TaskProgressUpdate(
                            task_id=task.id,
                            progress=task.progress,
                            message=f"{r.movie_name}: {r.status}",
                            status=TaskStatus.RUNNING,
                            result=ScanResultItem(
                                movie_name=r.movie_name,
                                status=r.status,
                                reason=r.reason,
                                filename=r.filename,
                            ),
                        ).model_dump(),
                    )
                    await asyncio.sleep(0.05)

                processed += len(results)
            except Exception as e:
                logger.warning("Failed to process %s: %s", path, e)

        # Store all accumulated results
        task.results = all_results

        task.status = TaskStatus.COMPLETED
        task.progress = 100.0
        task.message = f"Scan completed. Processed {processed} movies."
        task.updated_at = datetime.now(timezone.utc).isoformat()

    async def _execute_review(self, task: TaskResponse) -> None:
        """Execute a review task using the CLI reviewer."""
        try:
            from src.reviewer import review_directory
        except ImportError:
            try:
                from thunder_subtitle.reviewer import (
                    review_directory,  # type: ignore[import-untyped]
                )
            except ImportError:
                raise RuntimeError("Reviewer module not available")

        base_dir = task.params.get("path", "")
        if not base_dir:
            paths = _get_media_paths()
            base_dir = paths[0] if paths else ""

        if not base_dir or not os.path.isdir(base_dir):
            task.status = TaskStatus.FAILED
            task.message = f"Invalid review path: {base_dir}"
            return

        task.message = f"Reviewing: {base_dir}"
        task.updated_at = datetime.now(timezone.utc).isoformat()

        await ws_manager.broadcast(
            task.id,
            TaskProgressUpdate(
                task_id=task.id,
                progress=10.0,
                message=task.message,
                status=TaskStatus.RUNNING,
            ).model_dump(),
        )

        # Run review in thread (it's sync CLI code)
        items = await asyncio.to_thread(review_directory, base_dir)

        task.progress = 100.0
        task.status = TaskStatus.COMPLETED
        task.message = f"Review completed. Found {len(items)} subtitle files."
        task.updated_at = datetime.now(timezone.utc).isoformat()

    async def _execute_dump(self, task: TaskResponse) -> None:
        """Execute a dump task (download all subtitles for a path)."""
        # Dump is similar to scan but with dump_mode=True
        try:
            from src.config import Config
            from src.scanner import process_scanned_movies, scan_movie_dirs
        except ImportError:
            try:
                from thunder_subtitle.config import Config  # type: ignore[import-untyped]
                from thunder_subtitle.scanner import (  # type: ignore[import-untyped]
                    process_scanned_movies,
                    scan_movie_dirs,
                )
            except ImportError:
                raise RuntimeError("Scanner module not available")

        scan_path = task.params.get("path", "")
        paths = [scan_path] if scan_path else _get_media_paths()

        config = Config.load()
        total_processed = 0

        for path in paths:
            if not os.path.isdir(path):
                continue

            movie_dirs = await asyncio.to_thread(scan_movie_dirs, path)

            for i, movie_path in enumerate(movie_dirs):
                movie_name = os.path.basename(movie_path)
                ratio = (total_processed + i + 1) / max(len(movie_dirs), 1)
                task.progress = min(ratio * 100, 100.0)
                task.message = f"Dumping: {movie_name}"
                task.updated_at = datetime.now(timezone.utc).isoformat()

                await ws_manager.broadcast(
                    task.id,
                    TaskProgressUpdate(
                        task_id=task.id,
                        progress=task.progress,
                        message=task.message,
                        status=TaskStatus.RUNNING,
                    ).model_dump(),
                )

                try:
                    await asyncio.to_thread(
                        process_scanned_movies,
                        movie_path,
                        dry_run=False,
                        name_filters=None,
                        config=config,
                        resume=False,
                        dump_mode=True,
                    )
                except Exception as e:
                    logger.warning("Dump failed for %s: %s", movie_name, e)

            total_processed += len(movie_dirs)

        task.status = TaskStatus.COMPLETED
        task.progress = 100.0
        task.message = f"Dump completed. Processed {total_processed} directories."
        task.updated_at = datetime.now(timezone.utc).isoformat()

    def list_media_directories(self) -> list[MediaDirectory]:
        """List configured media directories with file counts."""
        dirs = []
        for path in _get_media_paths():
            if os.path.isdir(path):
                try:
                    entries = os.listdir(path)
                    movie_count = sum(1 for e in entries if os.path.isdir(os.path.join(path, e)))
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


# Singleton instance for task storage
scan_service = ScanService()
