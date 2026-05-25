import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import override_password_from_config, settings
from app.ws.manager import manager as ws_manager

# Add thunder-subtitle-py/ to sys.path so `from src.config import Config` works
_cli_src = Path(__file__).resolve().parent.parent.parent / "thunder-subtitle-py"
if _cli_src.is_dir() and str(_cli_src) not in sys.path:
    sys.path.insert(0, str(_cli_src))

# Load persisted password from config file (overrides env var / default)
override_password_from_config()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize services on startup, cleanup on shutdown."""
    # Startup: initialize services
    await ws_manager.start()
    yield
    # Shutdown: cleanup
    await ws_manager.stop()


app = FastAPI(
    title="Thunder Subtitle API",
    description="REST API for Thunder Subtitle - subtitle search, scan, and review management",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
from app.api.config import router as config_router  # noqa: E402
from app.api.media import router as media_router  # noqa: E402
from app.api.review import router as review_router  # noqa: E402
from app.api.subtitle import router as subtitle_router  # noqa: E402
from app.api.tasks import router as tasks_router  # noqa: E402
from app.auth.router import router as auth_router  # noqa: E402
from app.ws.manager import router as ws_router  # noqa: E402

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(subtitle_router, prefix="/api/subtitle", tags=["subtitle"])
app.include_router(config_router, prefix="/api/config", tags=["config"])
app.include_router(tasks_router, prefix="/api/tasks", tags=["tasks"])
app.include_router(media_router, prefix="/api/media", tags=["media"])
app.include_router(review_router, prefix="/api/review", tags=["review"])
app.include_router(ws_router, prefix="/ws", tags=["websocket"])


@app.get("/api/health", tags=["health"])
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "version": "0.1.0"}
