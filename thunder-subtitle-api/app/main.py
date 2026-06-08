import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

import time  # noqa: E402

from fastapi import FastAPI, Request  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from app.config import override_password_from_config, settings  # noqa: E402
from app.ws.manager import manager as ws_manager  # noqa: E402

# Add thunder-subtitle-py/ to sys.path so `from src.config import Config` works
_cli_src = Path(__file__).resolve().parent.parent.parent / "thunder-subtitle-py"
if _cli_src.is_dir() and str(_cli_src) not in sys.path:
    sys.path.insert(0, str(_cli_src))

# Load persisted password from config file (overrides env var / default)
override_password_from_config()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize services on startup, cleanup on shutdown."""
    # Startup: verify CLI imports are available
    _verify_cli_imports()
    # Startup: warn about default credentials
    _check_default_secrets()
    # Startup: initialize services
    await ws_manager.start()
    # Startup: start scheduler
    from app.services.scan_service import scan_service

    await scan_service.start_scheduler()
    yield
    # Shutdown: stop scheduler
    await scan_service.stop_scheduler()
    # Shutdown: cleanup
    await ws_manager.stop()
    # Shutdown: close shared httpx client connection pool
    from app.api.subtitle import _httpx_client as _sub_httpx_client

    if _sub_httpx_client is not None:
        await _sub_httpx_client.aclose()


def _check_default_secrets() -> None:
    """生产环境使用默认密码/JWT secret 时拒绝启动。debug 模式仅警告。"""
    password_default = settings.admin_password == "changeme"
    jwt_default = settings.jwt_secret == "thunder-subtitle-secret-change-in-production"

    if not password_default and not jwt_default:
        return  # 都已自定义，无需警告

    if settings.debug:
        if password_default:
            logger.warning(
                "ADMIN_PASSWORD is still the default ('changeme'). Set ADMIN_PASSWORD env var."
            )
        if jwt_default:
            logger.warning("JWT_SECRET is still the default. Set JWT_SECRET env var.")
    else:
        errors = []
        if password_default:
            errors.append("ADMIN_PASSWORD 仍为默认值 'changeme'，请通过环境变量设置")
        if jwt_default:
            errors.append("JWT_SECRET 仍为默认值，请通过环境变量设置")
        raise RuntimeError(
            "安全配置错误 — 生产环境不能使用默认凭证:\n  "
            + "\n  ".join(errors)
            + "\n\n  开发环境可设置 DEBUG=true 跳过此检查。"
        )


def _verify_cli_imports() -> None:
    """Verify that key CLI modules can be imported. Raises RuntimeError if not."""
    errors: list[str] = []
    for module_name, fallback in [
        ("src.config", "thunder_subtitle.config"),
        ("src.reviewer", "thunder_subtitle.reviewer"),
        ("src.health", "thunder_subtitle.health"),
    ]:
        try:
            __import__(module_name)
        except ImportError:
            try:
                __import__(fallback)
            except ImportError:
                errors.append(f"{module_name} (also tried {fallback})")
    if errors:
        raise RuntimeError(
            f"CLI modules not available: {', '.join(errors)}. "
            f"Ensure thunder-subtitle-py/ is in sys.path or the package is installed."
        )


app = FastAPI(
    title="Thunder Subtitle API",
    description="REST API for Thunder Subtitle - subtitle search, scan, and review management",
    version="1.4.1",
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


# Timing middleware — log request duration
@app.middleware("http")
async def log_request_time(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = (time.time() - start) * 1000
    logger.info(f"{request.method} {request.url.path} → {response.status_code} ({duration:.0f}ms)")
    return response


# Register routers
from app.api.config import router as config_router  # noqa: E402
from app.api.health_check import router as health_check_router  # noqa: E402
from app.api.media import router as media_router  # noqa: E402
from app.api.review import router as review_router  # noqa: E402
from app.api.subtitle import router as subtitle_router  # noqa: E402
from app.api.tasks import router as tasks_router  # noqa: E402
from app.api.tasks import scheduled_router  # noqa: E402
from app.auth.router import router as auth_router  # noqa: E402
from app.ws.manager import router as ws_router  # noqa: E402

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(subtitle_router, prefix="/api/subtitle", tags=["subtitle"])
app.include_router(config_router, prefix="/api/config", tags=["config"])
app.include_router(tasks_router, prefix="/api/tasks", tags=["tasks"])
app.include_router(scheduled_router, prefix="/api/scheduled", tags=["scheduled"])
app.include_router(media_router, prefix="/api/media", tags=["media"])
app.include_router(review_router, prefix="/api/review", tags=["review"])
app.include_router(health_check_router, prefix="/api", tags=["health"])
app.include_router(ws_router, prefix="/ws", tags=["websocket"])


@app.get("/api/health", tags=["health"])
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "version": "1.4.0"}
