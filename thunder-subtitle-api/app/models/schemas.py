"""Pydantic schemas for API request/response models."""

from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field

# ---- Enums ----


class TaskType(str, Enum):
    SCAN = "scan"
    REVIEW = "review"
    DUMP = "dump"


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ReviewState(str, Enum):
    ok = "ok"
    fail = "fail"
    not_reviewed = "not_reviewed"


# ---- Subtitle ----


class SubtitleDetail(BaseModel):
    gcid: str
    cid: str
    url: str
    ext: str
    name: str
    duration: int = 0
    languages: list[str] = Field(default_factory=list)
    source: int = 0
    score: float = 0.0
    fingerprintf_score: float = 0.0
    extra_name: str = ""
    mt: int = 0
    is_chinese: bool = False


class SubtitleSearchResponse(BaseModel):
    subtitles: list[SubtitleDetail] = Field(default_factory=list)
    total: int = 0


# ---- Config ----


class AppConfig(BaseModel):
    output_dir: str = ""
    timeout: int = 30
    download_timeout: int = 60
    chunk_size: int = 8192
    rate_limit: int = 3
    retry_count: int = 3
    retry_delay: int = 2
    preferred_groups: str = ""
    media_paths: str = ""
    poster_systems: list[str] = Field(default_factory=lambda: ["kodi"])


class AppConfigUpdate(BaseModel):
    output_dir: Optional[str] = None
    timeout: Optional[int] = None
    download_timeout: Optional[int] = None
    chunk_size: Optional[int] = None
    rate_limit: Optional[int] = None
    retry_count: Optional[int] = None
    retry_delay: Optional[int] = None
    preferred_groups: Optional[str] = None
    media_paths: Optional[str] = None
    poster_systems: Optional[list[str]] = None


# ---- Tasks ----


class TaskCreate(BaseModel):
    type: TaskType
    params: dict = Field(default_factory=dict)


class ScanResultItem(BaseModel):
    movie_name: str
    status: str
    reason: str = ""
    filename: str = ""
    dry_state: str = ""


class TaskResponse(BaseModel):
    id: str
    type: TaskType
    status: TaskStatus
    progress: float = 0.0
    message: str = ""
    params: dict = Field(default_factory=dict)
    created_at: str = ""
    updated_at: str = ""
    results: Optional[list[ScanResultItem]] = None


class TaskListResponse(BaseModel):
    tasks: list[TaskResponse] = Field(default_factory=list)
    total: int = 0
    limit: int = 50
    offset: int = 0


class TaskProgressUpdate(BaseModel):
    task_id: str
    progress: float = 0.0
    message: str = ""
    status: TaskStatus = TaskStatus.RUNNING
    result: Optional[ScanResultItem] = None
    total: int = 0
    current_movie: Optional[str] = None
    current_step: Optional[str] = None
    download_progress: Optional[str] = None


# ---- Scheduled Tasks ----


class ScheduledTask(BaseModel):
    directory_path: str
    enabled: bool = False
    cron: str = "0 2 * * *"
    mode: str = "scan"  # scan / dry_run / dump / dump_force
    last_run: str = ""  # ISO datetime or empty
    last_status: str = ""  # completed / failed / skipped / cancelled / ""
    last_duration_seconds: int = 0  # 上次执行耗时（秒）


class ScheduledTaskUpdate(BaseModel):
    directory_path: Optional[str] = None
    enabled: bool = False
    cron: str = "0 2 * * *"
    mode: str = "scan"


# ---- Media ----


class MediaDirectory(BaseModel):
    path: str
    name: str
    movie_count: int = 0
    pending_review_count: int = 0


class NfoInfoResponse(BaseModel):
    path: str
    duration_seconds: int = 0
    has_chinese_subtitle: bool = False
    release_date: str = ""


# ---- Review ----


class ReviewItemResponse(BaseModel):
    file_path: str
    file_name: str
    quality: str = "unknown"
    score: int = 0
    size_bytes: int = 0
    chinese_ratio: float = 0.0
    encoding: str = ""
    review_status: ReviewState = ReviewState.not_reviewed
    review_date: str = ""
    preferred: bool = False
    ai_flags: list[str] = Field(default_factory=list)
    last_end_ms: int = 0
    deductions: list[str] = Field(default_factory=list)
    checks: list[str] = Field(default_factory=list)
    entry_count: int = 0
    last_index: int = 0


class MovieEntryResponse(BaseModel):
    """轻量电影条目 — 仅文件系统操作，无深审数据"""

    path: str
    name: str
    sub_files: list[str] = Field(default_factory=list)
    review_status: ReviewState = ReviewState.not_reviewed
    review_date: str = ""
    duration_seconds: int = 0


class MovieListResponse(BaseModel):
    movies: list[MovieEntryResponse] = Field(default_factory=list)


class ReviewListResponse(BaseModel):
    items: list[ReviewItemResponse] = Field(default_factory=list)
    total: int = 0


class ReviewMarkRequest(BaseModel):
    base_dir: str
    path: str
    status: Literal["ok", "fail"]


class TokenVerifyRequest(BaseModel):
    token: str


class ReviewMarkResponse(BaseModel):
    success: bool
    message: str = ""


class SubtitlePreviewResponse(BaseModel):
    content: str
    encoding: str
    total_lines: int


# ---- Health Check ----
class HealthCheckItem(BaseModel):
    """单个健康检查结果项"""

    level: str  # "ok" | "warning" | "info" | "error"
    path: str = ""
    movie_name: str = ""
    message: str = ""


class HealthCheckResponse(BaseModel):
    """健康检查结果列表"""

    results: list[HealthCheckItem] = Field(default_factory=list)
    total: int = 0
