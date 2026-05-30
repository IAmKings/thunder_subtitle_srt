# FastAPI Architecture

This document covers the core architectural patterns for the Thunder Subtitle API backend — FastAPI project setup, routing, dependency injection, service layer, Pydantic schemas, JWT authentication, WebSocket progress, and error handling.

## 1. FastAPI Project Setup

### App Factory & Lifespan

The app is created in `app/main.py` using FastAPI's `lifespan` context manager for startup/shutdown logic:

```python
# app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.ws.manager import manager as ws_manager

@asynccontextmanager
async def lifespan(app: FastAPI):
    await ws_manager.start()
    yield
    await ws_manager.stop()

app = FastAPI(
    title="Thunder Subtitle API",
    version="1.4.0",
    lifespan=lifespan,
)
```

**Key points**:
- Lifespan is for initializing/cleaning up services that need async startup (e.g. WebSocket manager).
- Routers are registered after middleware to ensure correct middleware stacking.

### CORS Middleware

All origins from `settings.cors_origins` are allowed with credentials:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Settings (pydantic-settings)

Configuration is centralized in `app/config.py` using `pydantic_settings.BaseSettings`. All settings are loaded from environment variables with sensible defaults:

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    admin_password: str = "changeme"
    jwt_secret: str = "thunder-subtitle-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440  # 24 hours
    media_paths: str = "/media"
    config_path: str = ""
    cors_origins: list[str] = ["http://localhost:3000", ...]
    max_concurrent_tasks: int = 2
    task_poll_interval: float = 0.5

    @property
    def media_paths_list(self) -> list[str]:
        return [p.strip() for p in self.media_paths.split(",") if p.strip()]

settings = Settings()  # Module-level singleton
```

**Convention**: Import `from app.config import settings` — never instantiate `Settings()` more than once.

## 2. Router Pattern

### Router Registration

Each domain owns an `APIRouter()` and is mounted under a URL prefix in `main.py`:

```python
# app/main.py
from app.api.subtitle import router as subtitle_router
from app.api.config import router as config_router
from app.api.tasks import router as tasks_router
from app.api.media import router as media_router
from app.api.review import router as review_router
from app.auth.router import router as auth_router
from app.ws.manager import router as ws_router

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(subtitle_router, prefix="/api/subtitle", tags=["subtitle"])
app.include_router(config_router, prefix="/api/config", tags=["config"])
app.include_router(tasks_router, prefix="/api/tasks", tags=["tasks"])
app.include_router(media_router, prefix="/api/media", tags=["media"])
app.include_router(review_router, prefix="/api/review", tags=["review"])
app.include_router(ws_router, prefix="/ws", tags=["websocket"])
```

### Route Handler Structure

Route handlers are thin — they validate input, delegate to a service, and return the response model:

```python
@router.get("/search", response_model=SubtitleSearchResponse)
async def search_subtitles(
    name: str = Query(..., min_length=1, description="Search keyword"),
    chinese_only: bool = Query(False, description="Filter Chinese subtitles only"),
    service: SubtitleService = Depends(get_subtitle_service),
):
    try:
        result = service.search(name=name, chinese_only=chinese_only)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Search failed: {e}")
```

**Conventions**:
- Always declare `response_model` on each route.
- Use `Query(...)`, `Path(...)`, `Body(...)` for validation with descriptions.
- Catch domain exceptions and convert to `HTTPException`.
- Keep business logic in the service layer, not in route handlers.

## 3. Dependency Injection

### Service Factory Pattern

Services are injected via FastAPI's `Depends()` using factory functions:

```python
def get_subtitle_service() -> SubtitleService:
    return SubtitleService()

@router.get("/search", response_model=SubtitleSearchResponse)
async def search_subtitles(
    name: str = Query(...),
    service: SubtitleService = Depends(get_subtitle_service),
):
    ...
```

**Why factory functions instead of classes?**
- Simple: most services are stateless wrappers around CLI modules.
- Easy to swap for testing: override the dependency with a mock.
- When stateful dependency is needed (e.g. DB session), extend to generator-based dependency.

### Future: Database Session Dependency

When a database is added, use generator-based dependencies:

```python
# Future pattern
async def get_db():
    async with async_session() as session:
        yield session

@router.get("/items")
async def list_items(db: AsyncSession = Depends(get_db)):
    ...
```

## 4. Service Layer (CLI Wrapper Pattern)

### Dual-Import Fallback

Services wrap CLI modules. Because the CLI can be imported either as `src.*` (source checkout) or `thunder_subtitle.*` (installed package), every import uses a fallback:

```python
class SubtitleService:
    def _get_client(self):
        try:
            from src.api import SubtitleApiClient
        except ImportError:
            try:
                from thunder_subtitle.api import SubtitleApiClient
            except ImportError:
                logger.error("Could not import SubtitleApiClient from any source")
                raise
        return SubtitleApiClient()
```

**Convention**: Always use this pattern for any import from the CLI package. Never import at module top level — use lazy imports inside methods.

### Resource Cleanup

CLI clients may hold resources (HTTP sessions, file handles). Services **must** clean up in a `finally` block:

```python
def search(self, name: str, ...):
    client = self._get_client()
    try:
        result = client.search_subtitles(name)
        # ... transform result
        return result
    finally:
        client.close()
```

### Service Method Return Types

Service methods return **Pydantic models** (from `app/models/schemas.py`), not raw CLI objects. The service is responsible for mapping CLI data classes to response models:

```python
items = []
for sub in subtitles:
    items.append(SubtitleDetail(
        gcid=sub.gcid,
        cid=sub.cid,
        url=sub.url,
        ...
    ))
return SubtitleSearchResponse(subtitles=items, total=len(items))
```

## 5. Pydantic Schemas

### File Location

All schemas live in `app/models/schemas.py`. Schemas are grouped by domain with comment headers:

```python
# ---- Enums ----
class TaskType(str, Enum):
    scan = "scan"
    review = "review"
    dump = "dump"

class TaskStatus(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"

# ---- Subtitle ----
class SubtitleDetail(BaseModel): ...
class SubtitleSearchResponse(BaseModel): ...

# ---- Config ----
class AppConfig(BaseModel): ...
class AppConfigUpdate(BaseModel): ...
```

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Request body model | `{Entity}{Action}Request` or `{Entity}Create` | `TaskCreate`, `ReviewMarkRequest` |
| Response model | `{Entity}Response` | `TaskResponse`, `SubtitleSearchResponse` |
| Update model (partial) | `{Entity}Update` | `AppConfigUpdate` |
| Enum | PascalCase, singular noun | `TaskType`, `ReviewState` |
| List response | `{Entity}ListResponse` | `TaskListResponse`, `ReviewListResponse` |

### Default Values

Use `Field(default_factory=list)` for mutable defaults and `Field(default=0)` / `Field(default="")` for immutable ones:

```python
class SubtitleSearchResponse(BaseModel):
    subtitles: list[SubtitleDetail] = Field(default_factory=list)
    total: int = 0
```

### Update Pattern (Partial Updates)

Update models use `Optional[str/int/...] = None` — the service layer checks `is not None` before applying:

```python
class AppConfigUpdate(BaseModel):
    output_dir: Optional[str] = None
    timeout: Optional[int] = None
    ...

# In service:
if update.timeout is not None:
    config.timeout = update.timeout
```

## 6. Authentication (JWT)

### Architecture

Single admin account, password from environment variable. JWT tokens issued on login, verified on subsequent requests.

### Token Creation & Verification

Defined in `app/auth/router.py`:

```python
from jose import JWTError, jwt

def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.jwt_expire_minutes)
    )
    to_encode = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)

def verify_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError:
        return None
```

### Auth Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Authenticate, return JWT |
| GET | `/api/auth/verify` | Verify Bearer token from header |
| POST | `/api/auth/verify` | Verify token from request body |

### Protecting Endpoints

To add auth to an endpoint, extract the token and verify:

```python
from app.auth.router import extract_token_from_request, verify_access_token

@router.post("/protected")
async def protected_endpoint(request: Request):
    token = extract_token_from_request(request)
    if not token:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    payload = verify_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    # proceed with authenticated logic
```

**Future improvement**: Create a reusable `get_current_user` dependency function to avoid repeating this pattern:

```python
# Future pattern
async def get_current_user(request: Request) -> dict:
    token = extract_token_from_request(request)
    if not token:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    payload = verify_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload
```

## 7. WebSocket Task Progress

### ConnectionManager

The `ConnectionManager` in `app/ws/manager.py` handles WebSocket connections per task:

```python
class ConnectionManager:
    def __init__(self):
        self._connections: dict[str, list[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, task_id: str): ...
    async def disconnect(self, websocket: WebSocket, task_id: str): ...
    async def broadcast(self, task_id: str, message: dict): ...
```

**Key patterns**:
- `asyncio.Lock` protects `_connections` dict mutations.
- `broadcast()` copies the connection list before iterating to avoid mutation during send.
- Failed sends are silently caught (client may have disconnected).

### WebSocket Endpoint

```python
@router.websocket("/progress/{task_id}")
async def websocket_progress(websocket: WebSocket, task_id: str):
    await manager.connect(websocket, task_id)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(websocket, task_id)
```

### Thread→EventLoop Bridge (Progress Callback)

When CLI code runs inside `asyncio.to_thread()` and needs to push progress updates via WebSocket, use `asyncio.Queue` + `asyncio.run_coroutine_threadsafe`:

```python
import asyncio
import threading

def _make_callback(loop: asyncio.AbstractEventLoop, queue: asyncio.Queue):
    """创建线程安全的进度回调。在 to_thread 线程内调用，通过队列桥接到事件循环。"""
    def _on_progress(step: str, detail: str):
        try:
            asyncio.run_coroutine_threadsafe(queue.put((step, detail)), loop)
        except Exception:
            pass  # 事件循环已停止
    return _on_progress

async def _consume_progress(queue: asyncio.Queue, ws_manager, task_id: str, stop_event: threading.Event):
    """事件循环侧消费队列，通过 WebSocket 广播进度。"""
    while not stop_event.is_set():
        try:
            step, detail = await asyncio.wait_for(queue.get(), timeout=1.0)
        except asyncio.TimeoutError:
            continue
        await ws_manager.broadcast(task_id, {
            "type": "task_progress",
            "current_step": step,
            "download_progress": detail,
        })
```

**Why this pattern**:
- `asyncio.run_coroutine_threadsafe` is the only safe way to schedule a coroutine from a non-async thread.
- `asyncio.Queue` decouples the producer (sync thread) from the consumer (event loop).
- `threading.Event` controls the consumer task lifecycle independently of the queue.

**Don't**: Call `ws_manager.broadcast()` directly from the to_thread thread — it will raise `RuntimeError` because WebSocket operations must run in the event loop.

### WebSocket Keep-Alive

Long-running operations (scan/download) can cause WebSocket disconnection due to proxy/load balancer timeouts. Use bidirectional keep-alive:

**Server-side** (`ws/manager.py`):
```python
async def _server_ping_loop(websocket: WebSocket, stop_event: asyncio.Event):
    """每 20s 发送 ping，保活 WebSocket 连接"""
    while not stop_event.is_set():
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=20)
            break
        except asyncio.TimeoutError:
            try:
                await websocket.send_json({"type": "ping"})
            except Exception:
                break
```

**Client-side** (`api.ts`):
```typescript
// ProgressWebSocket: 每 15s 发送 ping，比服务端间隔短以确保服务端 30s 超时前收到消息
this.pingInterval = setInterval(() => {
  if (this.ws?.readyState === WebSocket.OPEN) {
    this.ws.send(JSON.stringify({ type: "ping" }));
  }
}, 15000);

// onmessage 中过滤 ping 响应
this.ws.onmessage = (event) => {
  if (data.type === "ping") return;
  onProgress(data);
};
```

**Nginx** (`nginx.conf`):
```nginx
location /ws/ {
    proxy_pass http://fastapi;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 300s;  # 匹配长耗时操作
}
```

**Key numbers**: client ping 15s < server receive timeout 30s → prevented. Server ping 20s < nginx 60s default → prevented. Extended timeout 300s covers worst-case download scenarios.

## 8. Error Handling

See [error-handling.md](./error-handling.md) for the full error handling spec. Key patterns:

### HTTPException in Route Handlers

Always use `HTTPException` with proper status codes:

```python
from fastapi import HTTPException, status

raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subtitle not found")
raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Search failed: {e}")
raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Download failed: upstream returned {e.response.status_code}")
raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail=f"Download failed: {e}")
```

### Exception Handling Flow

1. Route handler catches domain exceptions.
2. Converts to `HTTPException` with appropriate status code.
3. Re-raises `HTTPException` (don't wrap HTTPException in another HTTPException).
4. Service layer raises domain exceptions (ValueError, FileNotFoundError, etc.).
5. Route handler maps domain exceptions to HTTP status codes.

### Proxy Download Pattern

For endpoints that proxy external resources (e.g., subtitle download), use httpx and map upstream errors:

```python
async with httpx.AsyncClient(timeout=60.0) as client:
    response = await client.get(url, follow_redirects=True)
    response.raise_for_status()
```

- `httpx.HTTPStatusError` → 502 Bad Gateway
- `httpx.RequestError` → 504 Gateway Timeout

## 9. Deployment

### Docker (Backend Only)

```Dockerfile
FROM python:3.12-slim AS backend
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ADMIN_PASSWORD` | `changeme` | Admin login password |
| `JWT_SECRET` | `thunder-subtitle-secret-change-in-production` | JWT signing secret |
| `JWT_ALGORITHM` | `HS256` | JWT algorithm |
| `JWT_EXPIRE_MINUTES` | `1440` | Token expiry (24h) |
| `MEDIA_PATHS` | `/media` | Comma-separated media directories |
| `CORS_ORIGINS` | `["http://localhost:3000", ...]` | JSON array of allowed origins |
| `DEBUG` | `false` | 设置 `true` 跳过生产环境安全凭证检查（仅开发） |

### Running

```bash
# 生产环境（需设置 ADMIN_PASSWORD + JWT_SECRET 环境变量）
ADMIN_PASSWORD=xxx JWT_SECRET=xxx uvicorn app.main:app --host 0.0.0.0 --port 8000
```

For development with auto-reload:

```bash
DEBUG=true uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```