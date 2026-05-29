"""Scan service — wraps the CLI scanner for directory scanning tasks."""

import asyncio
import logging
import os
import threading
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from app._cli_imports import cli_import
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
    mod = cli_import("src.config")
    return mod.Config.load().media_paths_list


class ScanService:
    """Service that wraps the CLI scanner for media library operations."""

    # 单例模式 — _tasks 在所有实例间共享
    # (ScanService is a singleton via scan_service module-level instance)
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
        """Execute a scan task — process movies one by one for real-time progress."""
        api_mod = cli_import("src.api")
        config_mod = cli_import("src.config")
        scanner_mod = cli_import("src.scanner")
        processor_mod = cli_import("src.scanner._processor")
        scan_movie_dirs = scanner_mod.scan_movie_dirs
        _process_one_movie = processor_mod._process_one_movie

        # Determine which path(s) to scan
        paths_param = task.params.get("paths", None)
        if paths_param is not None and isinstance(paths_param, list):
            paths = [p for p in paths_param if isinstance(p, str)]
        else:
            scan_path = task.params.get("path", "")
            if scan_path:
                paths = [scan_path]
            else:
                paths = _get_media_paths()

        if not paths:
            task.status = TaskStatus.FAILED
            task.message = "No media paths configured"
            return

        # Extract optional keyword filters
        filters: list[str] = task.params.get("filters", [])
        if isinstance(filters, str):
            import re

            filters = [f.strip() for f in re.split(r"[ ,]+", filters) if f.strip()]
        filters = filters if filters else None

        # Determine scan mode
        mode = task.params.get("mode", "scan")
        dry_run = mode == "dry_run"
        dump_mode = mode in ("dump", "dump_force")
        force = mode == "dump_force"

        config = config_mod.Config.load()
        client = api_mod.SubtitleApiClient(timeout=config.timeout)
        all_results: list[ScanResultItem] = []

        # ---- Queue + Consumer for thread-safe WebSocket broadcast ----
        loop = asyncio.get_running_loop()
        progress_queue: asyncio.Queue[dict] = asyncio.Queue()

        # Consumer task: reads progress messages from the queue and broadcasts
        _consumer_stop = threading.Event()

        async def _progress_consumer():
            while not _consumer_stop.is_set():
                try:
                    msg = await asyncio.wait_for(progress_queue.get(), timeout=2.0)
                    await ws_manager.broadcast(task.id, msg)
                except asyncio.TimeoutError:
                    continue
                except Exception:
                    break

        consumer_task = asyncio.create_task(_progress_consumer())

        # Build a callback that can be called from within asyncio.to_thread
        def _make_callback(movie_name: str):
            def callback(step: str, detail: str) -> None:
                msg = TaskProgressUpdate(
                    task_id=task.id,
                    progress=0.0,
                    message=f"{movie_name}: {step}" + (f" ({detail})" if detail else ""),
                    status=TaskStatus.RUNNING,
                    current_movie=movie_name,
                    current_step=step,
                    download_progress=detail if step == "downloading" else None,
                ).model_dump()
                asyncio.run_coroutine_threadsafe(progress_queue.put(msg), loop)

            return callback

        try:
            # Broadcast pre-scan status so user sees immediate feedback
            await ws_manager.broadcast(
                task.id,
                TaskProgressUpdate(
                    task_id=task.id,
                    progress=0.0,
                    message="正在扫描目录...",
                    status=TaskStatus.RUNNING,
                ).model_dump(),
            )

            # Pre-scan all paths → collect movie directories
            all_movie_dirs: list[str] = []
            for path in paths:
                if not os.path.isdir(path):
                    continue
                movie_dirs = await asyncio.to_thread(scan_movie_dirs, path)
                all_movie_dirs.extend(movie_dirs)

            # Apply name filters
            if filters:
                utils_mod = cli_import("src.utils")
                matches = utils_mod.matches
                all_movie_dirs = [
                    d
                    for d in all_movie_dirs
                    if any(matches(f, os.path.basename(d)) for f in filters)
                ]

            total_movies = len(all_movie_dirs)
            if total_movies == 0:
                task.status = TaskStatus.COMPLETED
                task.progress = 100.0
                task.message = "No movies found matching filters"
                return

            total_movies_count = total_movies
            task.message = f"Found {total_movies_count} movie(s) to process"

            processed = 0

            # Process each movie one by one — real-time progress
            for i, movie_path in enumerate(all_movie_dirs):
                movie_name = os.path.basename(movie_path)
                task.message = f"Processing: {movie_name}"
                task.updated_at = datetime.now(timezone.utc).isoformat()

                # Extract optional scan params
                min_age_days = int(task.params.get("min_age_days", 0))
                reset_fail = bool(task.params.get("reset_fail", False))

                # Create per-movie progress callback
                movie_callback = _make_callback(movie_name)

                # Process single movie in thread (blocking)
                result = await asyncio.to_thread(
                    _process_one_movie,
                    movie_path,
                    movie_name,
                    dry_run=bool(dry_run),
                    client=client,
                    config=config,
                    has_queried=False,
                    min_age_days=min_age_days,
                    dump_mode=bool(dump_mode),
                    force=bool(force),
                    reset_fail=reset_fail,
                    progress_callback=movie_callback,
                )

                processed += 1
                all_results.append(
                    ScanResultItem(
                        movie_name=result.movie_name,
                        status=result.status,
                        reason=result.reason,
                        filename=result.filename,
                        dry_state=getattr(result, "dry_state", ""),
                    )
                )

                # Calculate progress AFTER download completes
                pct = (processed / max(total_movies_count, 1)) * 100
                task.progress = pct

                # Broadcast result immediately
                await ws_manager.broadcast(
                    task.id,
                    TaskProgressUpdate(
                        task_id=task.id,
                        progress=min(pct, 100.0),
                        message=f"{result.movie_name}: {result.status}",
                        status=TaskStatus.RUNNING,
                        total=total_movies_count,
                        result=ScanResultItem(
                            movie_name=result.movie_name,
                            status=result.status,
                            reason=result.reason,
                            filename=result.filename,
                            dry_state=getattr(result, "dry_state", ""),
                        ),
                    ).model_dump(),
                )
            # Small delay to ensure all WebSocket results arrive before COMPLETED
            await asyncio.sleep(0.2)

            task.results = all_results
            task.status = TaskStatus.COMPLETED
            task.progress = 100.0
            task.message = f"Scan completed. Processed {len(all_results)} movies."
        finally:
            _consumer_stop.set()
            consumer_task.cancel()
            client.close()

        task.updated_at = datetime.now(timezone.utc).isoformat()

    async def _execute_review(self, task: TaskResponse) -> None:
        """Execute a review task using the CLI reviewer."""
        reviewer_mod = cli_import("src.reviewer")
        review_directory = reviewer_mod.review_directory

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
        config_mod = cli_import("src.config")
        scanner_mod = cli_import("src.scanner")
        scan_movie_dirs = scanner_mod.scan_movie_dirs
        process_scanned_movies = scanner_mod.process_scanned_movies

        scan_path = task.params.get("path", "")
        paths = [scan_path] if scan_path else _get_media_paths()

        config = config_mod.Config.load()
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
        utils_mod = cli_import("src.utils")
        parse_nfo = utils_mod.parse_nfo
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
