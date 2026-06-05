"""Scan service — wraps the CLI scanner for directory scanning tasks."""

import asyncio
import json
import logging
import os
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
from uuid import uuid4

from app._cli_imports import cli_import
from app.models.schemas import (
    MediaDirectory,
    NfoInfoResponse,
    ScanResultItem,
    ScheduledTask,
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


def _get_scheduled_config_path() -> str:
    """Get the path to the scheduled tasks config JSON file."""
    config_dir = Path.home() / ".thunder-subtitle"
    config_dir.mkdir(parents=True, exist_ok=True)
    return str(config_dir / "scheduled_tasks.json")


def _load_scheduled_configs() -> dict[str, dict]:
    """Load scheduled task configs from JSON file."""
    path = _get_scheduled_config_path()
    if not os.path.isfile(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data
    except (json.JSONDecodeError, OSError):
        logger.exception("Failed to load scheduled configs")
    return {}


def _save_scheduled_configs(configs: dict[str, dict]) -> None:
    """Save scheduled task configs to JSON file."""
    path = _get_scheduled_config_path()
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(configs, f, indent=2, ensure_ascii=False)
    except OSError:
        logger.exception("Failed to save scheduled configs")


def _parse_cron(cron_expr: str) -> tuple[list[int], list[int], list[int], list[int], list[int]]:
    """Parse a cron expression into sets of allowed values for each field.

    Supports: minute(0-59), hour(0-23), day-of-month(1-31), month(1-12), day-of-week(0-6, 0=Sunday).
    Returns a tuple of 5 lists of ints. A single ``*`` means "all values".
    """
    fields = cron_expr.strip().split()
    if len(fields) != 5:
        raise ValueError(f"Invalid cron expression: expected 5 fields, got {len(fields)}")

    ranges = [
        (0, 59),  # minute
        (0, 23),  # hour
        (1, 31),  # day of month
        (1, 12),  # month
        (0, 6),  # day of week (0=Sunday)
    ]

    result = []
    for i, field in enumerate(fields):
        lo, hi = ranges[i]
        if field == "*":
            result.append(list(range(lo, hi + 1)))
        else:
            values: list[int] = []
            for part in field.split(","):
                if "-" in part:
                    a, b = part.split("-", 1)
                    values.extend(range(int(a), int(b) + 1))
                else:
                    values.append(int(part))
            for v in values:
                if v < lo or v > hi:
                    raise ValueError(f"Value {v} out of range [{lo}, {hi}] in cron field {i}")
            result.append(sorted(set(values)))
    return tuple(result)  # type: ignore[return-value]


def _cron_matches(cron_expr: str, dt: datetime) -> bool:
    """Check if a datetime matches a cron expression."""
    parsed = _parse_cron(cron_expr)
    minute_vals, hour_vals, day_vals, month_vals, dow_vals = parsed
    return (
        dt.minute in minute_vals
        and dt.hour in hour_vals
        and dt.day in day_vals
        and dt.month in month_vals
        and dt.weekday() in dow_vals  # weekday(): 0=Monday, cron: 0=Sunday → adjust
    )


def _cron_next_run(cron_expr: str, after: Optional[datetime] = None) -> Optional[datetime]:
    """Calculate the next datetime matching the cron expression after ``after``.

    Returns None if no match within 1 year (prevents infinite loop).
    """
    now = after or datetime.now(timezone.utc)
    # Search up to 1 year ahead
    for days_offset in range(367):
        check = now + timedelta(days=days_offset)
        # For the first day, start from the current minute; for subsequent days, start from midnight
        start_minute = check.minute if days_offset == 0 else 0
        check = check.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(
            minutes=start_minute + days_offset * 24 * 60 - (0 if days_offset == 0 else 0)
        )
        # Recalculate more carefully
        if days_offset == 0:
            current = now.replace(second=0, microsecond=0)
        else:
            current = (now + timedelta(days=days_offset)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )

        for _ in range(1440):  # Check up to 1440 minutes in a day (skip current day when midnight)
            if _cron_matches(cron_expr, current):
                if current > now:
                    return current
            current += timedelta(minutes=1)
            if current.day != (now + timedelta(days=days_offset)).day:
                break
        if days_offset == 0:
            # Skip the remaining minutes of the first day if at end of day
            pass
    return None


def _format_cron_preview(cron_expr: str) -> str:
    """Generate a human-readable preview of the next few cron triggers."""
    next_run = _cron_next_run(cron_expr)
    if next_run:
        return next_run.strftime("%Y-%m-%d %H:%M")
    return "—"


class ScanService:
    """Service that wraps the CLI scanner for media library operations."""

    # 单例模式 — _tasks 在所有实例间共享
    # (ScanService is a singleton via scan_service module-level instance)
    _tasks: dict[str, TaskResponse] = {}
    _task_handles: dict[str, asyncio.Task] = {}
    _tasks_lock: asyncio.Lock = asyncio.Lock()

    # Scheduler state
    _scheduled_configs: dict[str, dict] = {}  # dir_path -> config dict
    _scheduler_tasks: dict[str, asyncio.Task] = {}  # dir_path -> scheduler asyncio.Task
    _scheduler_stop: threading.Event = threading.Event()
    _scheduler_lock: asyncio.Lock = asyncio.Lock()

    async def create_task(self, request: TaskCreate) -> TaskResponse:
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
        async with self._tasks_lock:
            self._tasks[task_id] = task
        return task

    async def get_task(self, task_id: str) -> Optional[TaskResponse]:
        """Get a task by ID."""
        async with self._tasks_lock:
            return self._tasks.get(task_id)

    async def list_tasks(
        self,
        status_filter: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[TaskResponse], int]:
        """List tasks with optional filtering."""
        async with self._tasks_lock:
            tasks = list(self._tasks.values())
        if status_filter:
            tasks = [t for t in tasks if t.status.value == status_filter]
        total = len(tasks)
        # Sort by created_at descending
        tasks.sort(key=lambda t: t.created_at, reverse=True)
        tasks = tasks[offset : offset + limit]
        return tasks, total

    async def cancel_task(self, task_id: str) -> Optional[TaskResponse]:
        """Cancel a running task."""
        async with self._tasks_lock:
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
        async with self._tasks_lock:
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
            async with self._tasks_lock:
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
                    message=f"{movie_name}: {step}" + (f" ({detail})" if detail else ""),
                    status=TaskStatus.RUNNING,
                    current_movie=movie_name,
                    current_step=step,
                    download_progress=detail if step == "downloading" else None,
                ).model_dump(exclude={"progress", "total", "result"})
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
        """List configured media directories with file counts and pending review counts."""
        dirs = []
        for path in _get_media_paths():
            if os.path.isdir(path):
                try:
                    entries = os.listdir(path)
                    movie_count = sum(1 for e in entries if os.path.isdir(os.path.join(path, e)))
                    pending_count = self._count_pending_review(path)
                    dirs.append(
                        MediaDirectory(
                            path=path,
                            name=os.path.basename(path),
                            movie_count=movie_count,
                            pending_review_count=pending_count,
                        )
                    )
                except OSError:
                    dirs.append(
                        MediaDirectory(
                            path=path,
                            name=os.path.basename(path),
                            movie_count=0,
                            pending_review_count=0,
                        )
                    )
        return dirs

    def _count_pending_review(self, base_dir: str) -> int:
        """Count subtitle files with review_status != 'ok' in a media directory."""
        try:
            reviewer_mod = cli_import("src.reviewer")
            movies = reviewer_mod.list_review_movies(base_dir)
            if not movies:
                return 0
            total = 0
            for movie in movies:
                if movie.review_status != "ok":
                    total += len(movie.sub_files)
            return total
        except Exception:
            logger.exception("Failed to count pending reviews for %s", base_dir)
            return 0

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

    # ---- Scheduler API ----

    def get_scheduled_tasks(self) -> list[ScheduledTask]:
        """Get all scheduled task configs."""
        configs = self._scheduled_configs
        tasks: list[ScheduledTask] = []
        for dir_path, cfg in configs.items():
            tasks.append(
                ScheduledTask(
                    directory_path=dir_path,
                    enabled=cfg.get("enabled", False),
                    cron=cfg.get("cron", "0 2 * * *"),
                    mode=cfg.get("mode", "scan"),
                    last_run=cfg.get("last_run", ""),
                    last_status=cfg.get("last_status", ""),
                )
            )
        return tasks

    def save_scheduled_task(self, path: str, update: dict) -> ScheduledTask:
        """Save a scheduled task config for a directory."""
        cfg = self._scheduled_configs.get(path, {})
        cfg["enabled"] = update.get("enabled", False)
        cfg["cron"] = update.get("cron", "0 2 * * *")
        cfg["mode"] = update.get("mode", "scan")
        cfg.setdefault("last_run", "")
        cfg.setdefault("last_status", "")
        self._scheduled_configs[path] = cfg
        _save_scheduled_configs(self._scheduled_configs)
        return ScheduledTask(
            directory_path=path,
            enabled=cfg["enabled"],
            cron=cfg["cron"],
            mode=cfg["mode"],
            last_run=cfg.get("last_run", ""),
            last_status=cfg.get("last_status", ""),
        )

    def delete_scheduled_task(self, path: str) -> bool:
        """Delete a scheduled task config for a directory."""
        if path in self._scheduled_configs:
            del self._scheduled_configs[path]
            _save_scheduled_configs(self._scheduled_configs)
            return True
        return False

    # ---- Scheduler Lifecycle ----

    async def start_scheduler(self) -> None:
        """Start the scheduler: load configs and begin cron loops for each directory."""
        logger.info("Starting scheduler...")
        self._scheduled_configs = _load_scheduled_configs()
        self._scheduler_stop.clear()
        for dir_path, cfg in self._scheduled_configs.items():
            if cfg.get("enabled", False):
                await self._start_scheduler_for_dir(dir_path)

    async def stop_scheduler(self) -> None:
        """Stop the scheduler and cancel all running scheduler tasks."""
        logger.info("Stopping scheduler...")
        self._scheduler_stop.set()
        async with self._scheduler_lock:
            for dir_path, handle in self._scheduler_tasks.items():
                handle.cancel()
            self._scheduler_tasks.clear()

    async def restart_scheduler_for_dir(self, dir_path: str) -> None:
        """Restart the scheduler for a specific directory (after config change)."""
        await self._stop_scheduler_for_dir(dir_path)
        cfg = self._scheduled_configs.get(dir_path, {})
        if cfg.get("enabled", False):
            await self._start_scheduler_for_dir(dir_path)

    async def _start_scheduler_for_dir(self, dir_path: str) -> None:
        """Start the cron loop for a single directory."""
        async with self._scheduler_lock:
            if dir_path in self._scheduler_tasks:
                self._scheduler_tasks[dir_path].cancel()
            task = asyncio.create_task(self._scheduler_loop(dir_path))
            self._scheduler_tasks[dir_path] = task

    async def _stop_scheduler_for_dir(self, dir_path: str) -> None:
        """Stop the cron loop for a single directory."""
        async with self._scheduler_lock:
            handle = self._scheduler_tasks.pop(dir_path, None)
            if handle and not handle.done():
                handle.cancel()
                try:
                    await handle
                except (asyncio.CancelledError, Exception):
                    pass

    async def _scheduler_loop(self, dir_path: str) -> None:
        """Main cron loop for a directory. Sleeps until next trigger time."""
        cfg = self._scheduled_configs.get(dir_path, {})
        cron_expr = cfg.get("cron", "0 2 * * *")

        while not self._scheduler_stop.is_set():
            now = datetime.now(timezone.utc)
            next_run = _cron_next_run(cron_expr, after=now)
            if next_run is None:
                logger.warning("No future cron match for %s: %s", dir_path, cron_expr)
                break

            # Sleep until next run
            sleep_seconds = (next_run - datetime.now(timezone.utc)).total_seconds()
            if sleep_seconds > 0:
                try:
                    await asyncio.wait_for(
                        self._wait_for_stop(timeout=sleep_seconds),
                        timeout=sleep_seconds + 1,
                    )
                    break  # Stop was requested
                except asyncio.TimeoutError:
                    pass  # Time to run
                except asyncio.CancelledError:
                    break

            if self._scheduler_stop.is_set():
                break

            # Check if this dir_path still has an enabled config
            current_cfg = self._scheduled_configs.get(dir_path, {})
            if not current_cfg.get("enabled", False):
                break

            # Check if previous task is still running
            if self._has_running_task_for_dir(dir_path):
                logger.info("Skipping scheduled run for %s: previous task still running", dir_path)
                self._update_scheduled_status(dir_path, "skipped", datetime.now(timezone.utc))
                continue

            # Execute the scheduled scan
            await self._run_scheduled(dir_path)

    async def _wait_for_stop(self, timeout: float) -> None:
        """Wait for the stop event, up to ``timeout`` seconds."""
        for _ in range(int(timeout * 2)):
            if self._scheduler_stop.is_set():
                return
            await asyncio.sleep(0.5)

    def _has_running_task_for_dir(self, dir_path: str) -> bool:
        """Check if there is a running/pending task for this directory."""
        for task in self._tasks.values():
            if task.status in (TaskStatus.RUNNING, TaskStatus.PENDING):
                params = task.params
                task_paths = params.get("paths", params.get("path", ""))
                if isinstance(task_paths, list):
                    if dir_path in task_paths:
                        return True
                elif isinstance(task_paths, str) and task_paths == dir_path:
                    return True
        return False

    async def _run_scheduled(self, dir_path: str) -> None:
        """Execute a scheduled scan for a directory."""
        cfg = self._scheduled_configs.get(dir_path, {})
        mode = cfg.get("mode", "scan")
        logger.info("Running scheduled %s for %s", mode, dir_path)

        try:
            task_req = TaskCreate(
                type=TaskType.SCAN if mode != "review" else TaskType.REVIEW,
                params={"paths": [dir_path], "mode": mode},
            )
            task = await self.create_task(task_req)
            asyncio.create_task(self.start_task(task.id))

            # Poll until task completes
            while True:
                await asyncio.sleep(1)
                current = await self.get_task(task.id)
                if current is None:
                    break
                if current.status in (
                    TaskStatus.COMPLETED,
                    TaskStatus.FAILED,
                    TaskStatus.CANCELLED,
                ):
                    self._update_scheduled_status(
                        dir_path, current.status.value, datetime.now(timezone.utc)
                    )
                    break
        except Exception:
            logger.exception("Scheduled task failed for %s", dir_path)
            self._update_scheduled_status(dir_path, "failed", datetime.now(timezone.utc))

    def _update_scheduled_status(self, dir_path: str, status: str, run_time: datetime) -> None:
        """Update last_run and last_status for a scheduled task config."""
        cfg = self._scheduled_configs.get(dir_path)
        if cfg is None:
            return
        cfg["last_run"] = run_time.isoformat()
        cfg["last_status"] = status
        _save_scheduled_configs(self._scheduled_configs)


# Singleton instance for task storage
scan_service = ScanService()
