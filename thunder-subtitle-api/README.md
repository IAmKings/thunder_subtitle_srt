# Thunder Subtitle API

迅雷字幕 FastAPI 后端，提供 REST API + WebSocket 服务。

## 快速开始

```bash
cd thunder-subtitle-api
pip install -r requirements.txt

# 设置环境变量（可选）
export ADMIN_PASSWORD=changeme
export MEDIA_PATHS=/media

# 开发环境需设置 DEBUG=true 跳过安全凭证检查
DEBUG=true uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

访问 http://localhost:8000/docs 查看 Swagger API 文档。

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `ADMIN_PASSWORD` | `changeme` | 管理员密码 |
| `JWT_SECRET` | 内置默认 | JWT 签名密钥 |
| `JWT_ALGORITHM` | `HS256` | JWT 算法 |
| `JWT_EXPIRE_MINUTES` | `1440` | Token 过期（24h） |
| `MEDIA_PATHS` | `/media` | 媒体库路径（逗号分隔） |
| `THUNDER_SUBTITLE_CONFIG` | `~/.thunder-subtitle.json` | CLI 配置文件路径 |
| `CORS_ORIGINS` | `localhost:3000` | CORS 白名单 |

## API 端点

### 认证

| 方法 | 端点 | 认证 |
|------|------|------|
| POST | `/api/auth/login` | 否 |
| POST | `/api/auth/verify` | 否 |
| POST | `/api/auth/change-password` | JWT |

### 字幕

| 方法 | 端点 | 认证 |
|------|------|------|
| GET | `/api/subtitle/search` | 否 |
| GET | `/api/subtitle/download` | JWT |

### 配置

| 方法 | 端点 | 认证 |
|------|------|------|
| GET | `/api/config` | JWT |
| PUT | `/api/config` | JWT |
| POST | `/api/config/reload` | JWT |

### 任务

| 方法 | 端点 | 认证 |
|------|------|------|
| POST | `/api/tasks` | JWT |
| GET | `/api/tasks` | JWT |
| GET | `/api/tasks/{id}` | JWT |
| POST | `/api/tasks/{id}/cancel` | JWT |

### 媒体

| 方法 | 端点 | 认证 |
|------|------|------|
| GET | `/api/media/directories` | JWT |
| GET | `/api/media/nfo` | JWT |

### 审查

| 方法 | 端点 | 认证 |
|------|------|------|
| GET | `/api/review/list` | JWT |
| POST | `/api/review/mark` | JWT |
| DELETE | `/api/review/file` | JWT |
| PUT | `/api/review/file/rename` | JWT |
| GET | `/api/review/preview` | JWT |

### WebSocket

| 端点 | 说明 |
|------|------|
| `ws://host:8000/ws/progress/{task_id}` | 任务进度实时推送 |

## 架构

```
FastAPI Router (参数校验 + 鉴权)
       ↓
Service Layer (业务逻辑)
       ↓
CLI Python Modules (thunder-subtitle-py 复用)
       ↓
File System (媒体路径、配置文件、字幕文件)
```

服务层通过 dual-import 模式（`try: from src.xxx except: from thunder_subtitle.xxx`）复用 CLI 模块。

## 密码持久化

密码修改后写入 `~/.thunder-subtitle.json`（权限 0600）。读取优先级：配置文件 > `ADMIN_PASSWORD` 环境变量 > `changeme` 默认值。

Docker 部署时需挂载 `/root` 目录以持久化密码：

```yaml
volumes:
  - /path/to/data:/root
```

## 开发

```bash
ruff check .          # Lint
ruff format --check . # 格式检查
```

## 技术栈

Python 3.10+ / FastAPI / Pydantic / python-jose (JWT) / WebSocket / uvicorn
