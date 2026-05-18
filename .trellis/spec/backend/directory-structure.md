# Directory Structure

This document describes the project layout and module organization for the FastAPI backend.

## Project Layout

```
thunder-subtitle-api/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI app, lifespan, CORS, router registration
│   ├── config.py                  # pydantic_settings BaseSettings (single Settings class)
│   ├── api/                        # API route handlers (one file per domain)
│   │   ├── __init__.py
│   │   ├── subtitle.py            # /api/subtitle (search, detail, download)
│   │   ├── config.py              # /api/config (GET, PUT, reload)
│   │   ├── tasks.py               # /api/tasks (CRUD + progress)
│   │   ├── media.py               # /api/media (directories, nfo)
│   │   └── review.py              # /api/review (list, mark)
│   ├── auth/
│   │   ├── __init__.py
│   │   └── router.py              # /api/auth (login, verify) JWT auth
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py             # All Pydantic models for request/response
│   ├── services/
│   │   ├── __init__.py
│   │   ├── subtitle_service.py    # Wraps CLI SubtitleApiClient
│   │   ├── config_service.py      # Wraps CLI Config
│   │   ├── scan_service.py        # Wraps CLI scanner
│   │   └── review_service.py      # Wraps CLI reviewer
│   └── ws/
│       ├── __init__.py
│       └── manager.py             # WebSocket ConnectionManager + endpoint
├── Dockerfile
├── pyproject.toml
└── requirements.txt
```

## Key Conventions

### `api/` — Route Handlers

Each domain gets its own file. The file exports a single `router = APIRouter()` and defines route handler functions with `Depends()` for service injection.

```python
# app/api/subtitle.py
from fastapi import APIRouter, Depends

from app.services.subtitle_service import SubtitleService

router = APIRouter()

def get_subtitle_service() -> SubtitleService:
    return SubtitleService()

@router.get("/search", response_model=SubtitleSearchResponse)
async def search_subtitles(
    name: str = Query(...),
    service: SubtitleService = Depends(get_subtitle_service),
):
    ...
```

### `auth/` — Authentication Module

Separate from `api/` for clarity. Contains JWT creation, verification, and token extraction helpers alongside the route handlers.

### `models/schemas.py` — Single File for All Schemas

All Pydantic models live in one file, grouped by domain with comment headers:

```python
# ---- Subtitle ----
class SubtitleDetail(BaseModel): ...
class SubtitleSearchResponse(BaseModel): ...

# ---- Config ----
class AppConfig(BaseModel): ...
class AppConfigUpdate(BaseModel): ...

# ---- Tasks ----
class TaskCreate(BaseModel): ...
class TaskResponse(BaseModel): ...
```

### `services/` — CLI Wrapper Layer

Each service wraps the corresponding CLI module using the **dual-import fallback pattern**:

```python
try:
    from src.api import SubtitleApiClient
except ImportError:
    from thunder_subtitle.api import SubtitleApiClient
```

### `ws/` — WebSocket Management

`ConnectionManager` class with connect/disconnect/broadcast, plus the WebSocket endpoint route.

## Adding a New API Domain

1. Create `app/api/<domain>.py` with `router = APIRouter()`
2. Add Pydantic models to `app/models/schemas.py`
3. Create `app/services/<domain>_service.py` if CLI wrapping is needed
4. Register the router in `app/main.py`:
   ```python
   from app.api.<domain> import router as <domain>_router
   app.include_router(<domain>_router, prefix="/api/<domain>", tags=["<domain>"])
   ```