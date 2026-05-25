# API 后端深度代码审查报告

## 审查概览

- **审查文件数**：21（含 6 个空 `__init__.py`，17 个代码文件）
- **代码行数**：约 1,800 行
- **发现问题数**：22（P0: 3, P1: 9, P2: 10）

---

## P0（严重 -- Bug/安全）

### P0-1: `/api/subtitle/download` 缺少鉴权依赖

**文件**：`thunder-subtitle-api/app/api/subtitle.py:69-74`

```python
@router.get("/download")
async def download_subtitle(
    url: str = Query(..., description="Subtitle download URL"),
    filename: Optional[str] = Query(None, description="Optional filename for the download"),
):
```

与同文件及其他路由文件对照：
```python
# subtitle.py search 有鉴权
async def search_subtitles(..., _user: str = Depends(get_current_user)):
```

`download_subtitle` 缺少 `_user: str = Depends(get_current_user)` 参数，导致该端点未受保护。任何未认证用户均可通过此代理下载字幕文件，消耗服务器带宽和上游 API 配额。

**修复建议**：添加 `_user: str = Depends(get_current_user)` 参数。

---

### P0-2: 文件删除/重命名端点存在路径遍历风险

**文件**：`thunder-subtitle-api/app/api/review.py:114-151`

`delete_subtitle_file`（第 115 行）和 `rename_subtitle_file`（第 135 行）接受用户提供的任意文件路径，直接传入 `os.remove()` / `os.rename()`，未经任何路径校验或沙箱化：

```python
@router.delete("/file")
async def delete_subtitle_file(
    path: str = Query(..., description="Full path to subtitle file"),
    _user: str = Depends(get_current_user),
):
    if not os.path.isfile(path):
        raise HTTPException(...)
    os.remove(path)  # <-- 认证用户可以删除任意文件
```

认证用户可以删除或重命名服务器上任何路径的文件（只要有权限），不限于字幕目录。

**修复建议**：
1. 使用 `os.path.realpath()` 规范化路径
2. 校验路径是否在以 `base_dir` 为前缀的允许目录内
3. 或将路径解析委托给 `ReviewService` 统一处理

---

### P0-3: `change_password` 仅在内存中修改密码，重启后丢失

**文件**：`thunder-subtitle-api/app/auth/router.py:156`

```python
# Update password (for single-admin MVP: update the settings object)
settings.admin_password = body.new_password
```

`Settings` 是 Pydantic `BaseSettings` 实例，密码仅在进程内存中更新。服务器重启后恢复为环境变量值（或默认 `"changeme"`）。用户会看到"成功"响应，但重启后旧密码仍然有效，造成安全隐患和用户体验问题。

**修复建议**：将密码持久化到文件（如 `~/.thunder-subtitle.json` 或独立密码文件），或移除该端点并明确文档化密码仅通过环境变量设置。

---

## P1（重要 -- 代码质量）

### P1-1: sys.path 运行时 hack 耦合 CLI 目录结构

**文件**：`thunder-subtitle-api/app/main.py:12-14`

```python
_cli_src = Path(__file__).resolve().parent.parent.parent / "thunder-subtitle-py"
if _cli_src.is_dir() and str(_cli_src) not in sys.path:
    sys.path.insert(0, str(_cli_src))
```

这是一种对项目目录布局的隐性依赖。如果 `thunder-subtitle-py/` 不存在于预期的相对位置（如 pip 安装时），导入会静默失败，然后在后续调用中抛出 `ImportError`。此外，`sys.path.insert(0, ...)` 可能覆盖其他同名模块。

**修复建议**：
1. 将 `thunder-subtitle-py` 发布为独立 pip 包，通过 `pyproject.toml` 依赖引用
2. 或部署时使用 `PYTHONPATH` 环境变量
3. 或至少添加启动时验证：在 lifespan 中提前导入并检查是否成功

---

### P1-2: review_service 静默吞噬异常

**文件**：`thunder-subtitle-api/app/services/review_service.py`

list_reviews 第 83-85 行：
```python
except Exception:
    logger.exception("Failed to list reviews for %s", base_dir)
    return ReviewListResponse(items=[], total=0)
```

mark_review 第 106-108 行：
```python
except Exception as e:
    logger.exception("Failed to mark review for %s", path)
    return ReviewMarkResponse(success=False, message=str(e))
```

两个方法都将异常转换为"空结果"或"失败响应"，而不是传播给调用方。这意味着前端显示"0 条记录"而非错误提示，用户无法区分"没有需要审查的字幕"和"审查模块崩溃"。

**修复建议**：允许特定关键异常（如 ImportError）传播到路由层，让路由层决定 HTTP 状态码。仅将可恢复的异常转换为空结果。

---

### P1-3: 路由层直接操作文件系统（违反了分层职责）

**文件**：`thunder-subtitle-api/app/api/review.py:114-151`

`delete_subtitle_file` 和 `rename_subtitle_file` 直接在路由层调用 `os.remove()` / `os.rename()`，没有委托给 `ReviewService`。这违反了分层架构的单一职责原则——路由层应只做参数校验和 HTTP 响应转换。

**修复建议**：将文件删除和重命名操作移至 `ReviewService`，路由层仅负责调用服务并处理结果。

---

### P1-4: preview_subtitle 无路径校验

**文件**：`thunder-subtitle-api/app/api/review.py:92-111`

```python
@router.get("/preview", response_model=SubtitlePreviewResponse)
async def preview_subtitle(
    path: str = Query(..., description="Full path to subtitle file"),
    _user: str = Depends(get_current_user),
):
    if not os.path.exists(path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, ...)
    if not os.path.isfile(path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, ...)
```

接受任意文件路径（P0-2 的子集）。认证用户可读取服务器上任何文件的内容，不限于字幕目录。

**修复建议**：与 P0-2 一致的路径沙箱化方案。

---

### P1-5: create_task 缺少异常处理

**文件**：`thunder-subtitle-api/app/api/tasks.py:32-43`

```python
@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(body: TaskCreate, _user: str = Depends(get_current_user)):
    task = scan_service.create_task(body)
    asyncio.create_task(scan_service.start_task(task.id))
    return task
```

`scan_service.create_task(body)` 和 `scan_service.start_task(task.id)` 均未包在 try/except 中。如果 `create_task` 抛出异常，FastAPI 返回 500 但用户看到原始错误。更严重的是，`asyncio.create_task(start_task(...))` 是 fire-and-forget：如果 `start_task` 在异步执行中失败，异常不会被任何地方捕获或记录。

**修复建议**：
1. 为 `create_task` 添加 try/except
2. 使用 `asyncio.ensure_future` 或添加回调记录未捕获异常

---

### P1-6: auth/router.py 与 dependencies.py 重复的 token 验证逻辑

**文件**：
- `thunder-subtitle-api/app/auth/router.py`（verify_token_get 第 97-114 行，change_password 第 135-147 行）
- `thunder-subtitle-api/app/auth/dependencies.py`（get_current_user 第 8-35 行）

三个位置重复了相同的"提取 token + 验证 token + 检查 payload"模式。每个位置独立实现，稍有差异（错误信息不同，状态码处理不同）。

**修复建议**：`dependencies.py` 的 `get_current_user` 应作为统一入口，路由中的鉴权逻辑可直接复用该依赖，或在独立函数中封装 token 验证流程。

---

### P1-7: jwt_secret 和 admin_password 默认值无保护

**文件**：`thunder-subtitle-api/app/config.py:15-16`

```python
admin_password: str = "changeme"
jwt_secret: str = "thunder-subtitle-secret-change-in-production"
```

如果部署时忘记设置环境变量，默认密码和密钥是公开已知的。Pydantic `BaseSettings` 不会警告未设置的关键字段。

**修复建议**：
1. 使用 `Field(validation_alias=...)` 设置环境变量名
2. 在 lifespan 中检查：如果密码/密钥为默认值，打印警告日志
3. 或使用 Pydantic `Field(min_length=...)` 校验

---

### P1-8: download_subtitle 每次请求创建新的 HTTP 客户端

**文件**：`thunder-subtitle-api/app/api/subtitle.py:76`

```python
async with httpx.AsyncClient(timeout=60.0) as client:
    response = await client.get(url, follow_redirects=True)
```

每次下载请求都创建和销毁 `AsyncClient`，无法复用连接池，在高并发场景下存在性能问题。

**修复建议**：创建全局或懒加载的共享 `httpx.AsyncClient` 实例。

---

### P1-9: scan_service._tasks 为类级可变共享状态

**文件**：`thunder-subtitle-api/app/services/scan_service.py:38-39`

```python
_tasks: dict[str, TaskResponse] = {}
_task_handles: dict[str, asyncio.Task] = {}
```

类级 `dict` 在所有实例间共享。虽然当前通过 `scan_service = ScanService()` 单例模式使用，但如果将来创建多个实例，它们将共享同一任务存储，可能导致竞态条件和数据污染。

**修复建议**：明确文档化为单例模式，或将存储迁移到实例级（配合依赖注入）。

---

## P2（建议 -- 优化）

### P2-1: ReviewMarkRequest.status 应使用枚举而非 str

**文件**：`thunder-subtitle-api/app/models/schemas.py:170`

```python
class ReviewMarkRequest(BaseModel):
    base_dir: str
    path: str
    status: str  # "ok" or "fail"
```

`status` 使用 `str` 类型，运行时需在路由层/服务层手动校验。应使用 `ReviewState` 枚举或 `Literal["ok", "fail"]` 获得编译时校验和更好的 IDE 支持。

---

### P2-2: TaskResponse.results 使用 list[dict] 丢失类型

**文件**：`thunder-subtitle-api/app/models/schemas.py:107`

```python
results: Optional[list[dict]] = None
```

实际存储扫描结果的 dict 结构与 `ScanResultItem` 一致。应使用 `list[ScanResultItem]` 保持类型一致性，防止前端和后端的类型漂移。

---

### P2-3: verify_token_post 使用 untyped dict 请求体

**文件**：`thunder-subtitle-api/app/auth/router.py:118`

```python
async def verify_token_post(body: dict):
```

这是整个代码库中唯一使用裸 `dict` 作为请求体的端点。应创建对应的 Pydantic 模型。

---

### P2-4: 双导入模式在整个代码库重复 20+ 次

**文件**：所有 service 文件和 review.py、scan_service.py 等

```python
try:
    from src.config import Config
except ImportError:
    try:
        from thunder_subtitle.config import Config  # type: ignore[import-untyped]
    except ImportError:
        raise RuntimeError("Module not available")
```

此模式在 17 个代码文件中出现了 20+ 次，散落在各个服务方法中。每次新增 CLI 模块导入都需要复制粘贴此模式。

**修复建议**：创建一个 `cli_imports.py` 或 `_imports.py` 工具模块，集中管理 CLI 模块的导入懒加载：

```python
# app/_cli_imports.py
import importlib

_CLI_MODULES: dict[str, object] = {}

def _import(name: str):
    """Import from CLI package with fallbacks."""
    if name not in _CLI_MODULES:
        for pkg in ("src", "thunder_subtitle"):
            try:
                _CLI_MODULES[name] = importlib.import_module(f"{pkg}.{name}")
                break
            except ImportError:
                continue
        else:
            raise ImportError(f"CLI module {name} not available")
    return _CLI_MODULES[name]
```

---

### P2-5: 错误响应泄露内部异常信息

**文件**：多个路由文件

```python
# config.py:29
detail=f"Failed to load configuration: {e}"

# media.py:33
detail=str(e)

# subtitle.py:44
detail=f"Search failed: {e}"
```

将原始异常消息包含在 HTTP 响应中，可能泄露内部实现细节（文件路径、网络配置等）。

**修复建议**：返回通用错误消息，将 `str(e)` 记录到日志而非响应正文。

---

### P2-6: ConfigService 中 AppConfig 构造重复 3 次

**文件**：`thunder-subtitle-api/app/services/config_service.py`

`AppConfig(...)` 构造在 `get_config`（第 27-37 行）和 `update_config`（第 69-79 行）中完全相同，`reload_config`（第 83 行）也间接调用。应提取为 `_to_app_config(config)` 方法。

---

### P2-7: subtitle_service 的 fallback 逻辑重复 CLI 功能

**文件**：`thunder-subtitle-api/app/services/subtitle_service.py`

`_parse_duration` 第 39-67 行和 `_filter_by_duration` 第 87-96 行包含了完整的 fallback 实现，复制了 CLI `utils.py` 中的逻辑。如果 CLI 更新了这些函数，fallback 不会自动同步。

**修复建议**：将 CLI 模块标记为必需依赖（删除 fallback），或从 CLI 导入并使用这些函数。

---

### P2-8: WebSocket 端点缺少心跳检测

**文件**：`thunder-subtitle-api/app/ws/manager.py:72-79`

```python
try:
    while True:
        await websocket.receive_text()
except WebSocketDisconnect:
    pass
```

无限循环调用 `receive_text()` 没有任何超时。如果客户端意外断开且未发送 `WebSocketDisconnect`（如网络故障），此协程可能永久挂起。

**修复建议**：添加 `asyncio.wait_for()` 超时或实现心跳 ping/pong 机制。

---

### P2-9: ReviewListRequest 已定义但未使用

**文件**：`thunder-subtitle-api/app/models/schemas.py:145-148`

```python
class ReviewListRequest(BaseModel):
    base_dir: str
    name_filter: Optional[str] = None
```

该模型已定义但从未在任何路由或服务中使用，属于死代码。

**修复建议**：移除或使用 `Depends()` 注入。

---

### P2-10: SubtitleService.filter_by_duration 中 `__contains__` 不可靠

**文件**：`thunder-subtitle-api/app/services/subtitle_service.py:116`

```python
other_subs = [s for s in subtitles if s not in chinese_subs]
```

`not in` 依赖于对象的 `__eq__` 和 `__hash__` 方法。如果 CLI 的 subtitle 对象没有正确实现这些方法，此过滤将产生意外结果。

**修复建议**：使用唯一标识符（如 `gcid`）进行比较。

---

## 文件级评分

| 文件 | 行数 | SOLID | 错误处理 | 类型安全 | 安全 | 综合 | 关键问题 |
|------|------|-------|---------|---------|------|------|---------|
| `api/subtitle.py` | 116 | A | B | A | **F** | C | P0-1 缺失鉴权 |
| `api/review.py` | 152 | B- | B | A | **F** | C+ | P0-2 路径遍历, P1-3/4 |
| `api/tasks.py` | 85 | A | B- | A | A | B+ | P1-5 缺少异常处理 |
| `api/config.py` | 66 | A | B | A | A | B+ | P2-5 错误泄露 |
| `api/media.py` | 34 | A | B- | A | B | B+ | P2-5: 检查路径安全 |
| `auth/router.py` | 159 | A- | B | B+ | **D** | C+ | P0-3 密码持久化, P1-6/8 |
| `auth/dependencies.py` | 36 | A | A | A | A | A | 良好 |
| `services/scan_service.py` | 442 | C | B | B- | N/A | C+ | P1-9 共享状态, P1-5 |
| `services/review_service.py` | 109 | B | D | B+ | N/A | C | P1-2 静默吞噬异常 |
| `services/config_service.py` | 84 | A | B+ | A- | N/A | B+ | P2-6 重复构造 |
| `services/subtitle_service.py` | 163 | B | B+ | B- | N/A | B | P2-7/10 fallback/比较 |
| `models/schemas.py` | 182 | A | N/A | B+ | N/A | B+ | P2-1/2/9 类型改进 |
| `config.py` | 35 | A | B- | A | C | B- | P1-7 默认值暴露 |
| `main.py` | 65 | A | N/A | A | N/A | B | P1-1 sys.path hack |
| `ws/manager.py` | 80 | A | B | A | N/A | B+ | P2-8 心跳检测 |

评分等级：A(优秀) B(良好) C(及格) D(较差) F(不及格)

---

## 跨文件模式总结

### 1. 双导入模式（影响 8+ 文件，20+ 处）
每个 service 文件和路由文件中反复出现 `try: from src... except ImportError: from thunder_subtitle...` 模式。应集中管理 CLI 模块导入。

### 2. 文件路径安全（影响 1 个文件，3 个端点）
`review.py` 的 `delete`/`rename`/`preview` 三个端点都直接接受文件路径，缺少路径沙箱化校验。

### 3. 错误响应泄露（影响 5+ 个文件）
多个路由将 `str(e)` 直接包含在 HTTP 响应中。应统一为"记录日志 + 返回通用错误"。

---

## 总结

本次审查覆盖 thunder-subtitle-api 全部 21 个 Python 文件，发现 3 个 P0 级安全/Bug 问题、9 个 P1 级代码质量问题、10 个 P2 级优化建议。

**最关键的发现**：
1. `/api/subtitle/download` 端点没有鉴权保护（P0）
2. 文件删除/重命名/预览端点存在路径遍历漏洞（P0）
3. 密码修改仅在内存中生效，重启丢失（P0）

**架构层面的建议**：将 CLI 模块发布为独立 pip 包，删除 `sys.path.insert` hack 和 20+ 处双导入模式，统一提升代码可维护性。
