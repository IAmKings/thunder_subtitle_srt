"""Pydantic schemas for API request/response models."""

from enum import Enum
from typing import Optional

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


# ---- Tasks ----


class TaskCreate(BaseModel):
    type: TaskType
    params: dict = Field(default_factory=dict)


class TaskResponse(BaseModel):
    id: str
    type: TaskType
    status: TaskStatus
    progress: float = 0.0
    message: str = ""
    params: dict = Field(default_factory=dict)
    created_at: str = ""
    updated_at: str = ""


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


# ---- Media ----


class MediaDirectory(BaseModel):
    path: str
    name: str
    movie_count: int = 0


class NfoInfoResponse(BaseModel):
    path: str
    duration_seconds: int = 0
    has_chinese_subtitle: bool = False
    release_date: str = ""


# ---- Review ----


class ReviewListRequest(BaseModel):
    base_dir: str
    name_filter: Optional[str] = None


class ReviewItemResponse(BaseModel):
    file_path: str
    file_name: str
    quality: str = "unknown"
    chinese_ratio: float = 0.0
    encoding: str = ""
    review_status: ReviewState = ReviewState.not_reviewed
    review_date: str = ""


class ReviewListResponse(BaseModel):
    items: list[ReviewItemResponse] = Field(default_factory=list)
    total: int = 0


class ReviewMarkRequest(BaseModel):
    base_dir: str
    path: str
    status: str  # "ok" or "fail"


class ReviewMarkResponse(BaseModel):
    success: bool
    message: str = ""