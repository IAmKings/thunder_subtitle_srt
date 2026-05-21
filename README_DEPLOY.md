# Thunder Subtitle Web UI — 部署与验证指南

## 1. 本地开发启动

### 前提

- Node.js 20+
- pnpm
- Python 3.10+
- 已安装 `thunder_subtitle` 包（`pip install -e ./thunder-subtitle-py`）

### 后端（FastAPI）

```bash
cd thunder-subtitle-api

# 安装依赖
pip install -r requirements.txt

# 设置环境变量（可选，有默认值）
export ADMIN_PASSWORD=changeme
export JWT_SECRET=thunder-subtitle-secret-change-in-production
export MEDIA_PATHS=/media

# 启动（开发模式，自动重载）
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

后端启动后访问：
- API 文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/api/health

### 前端（Next.js）

```bash
cd thunder-subtitle-web

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

前端启动后访问：http://localhost:3000

### 环境变量

| 变量 | 位置 | 默认值 | 说明 |
|------|------|--------|------|
| `ADMIN_PASSWORD` | 后端 | `changeme` | 管理员登录密码 |
| `JWT_SECRET` | 后端 | `thunder-subtitle-secret-change-in-production` | JWT 签名密钥 |
| `JWT_ALGORITHM` | 后端 | `HS256` | JWT 算法 |
| `JWT_EXPIRE_MINUTES` | 后端 | `1440` | Token 过期时间（24h） |
| `MEDIA_PATHS` | 后端 | `/media` | 逗号分隔的媒体库路径 |
| `CONFIG_PATH` | 后端 | `""` | 配置文件路径（空=默认） |
| `CORS_ORIGINS` | 后端 | `["http://localhost:3000", ...]` | CORS 允许源 |
| `NEXT_PUBLIC_API_URL` | 前端 | `http://localhost:8000` | FastAPI 后端地址 |
| `FASTAPI_URL` | 前端（SSR） | `http://localhost:8000` | 服务端代理地址 |

---

## 2. Docker 构建

### 构建镜像

```bash
# 在项目根目录
docker build -t thunder-subtitle .

# 或使用 docker-compose
docker compose build
```

### 运行容器

```bash
# 直接运行
docker run -d \
  -p 3000:3000 \
  -p 8000:8000 \
  -e ADMIN_PASSWORD=your-password \
  -e JWT_SECRET=your-secret \
  -e MEDIA_PATHS=/media \
  -v /path/to/your/media:/media \
  thunder-subtitle

# 或使用 docker-compose
# 修改 docker-compose.yml 中的 volumes 和 environment
docker compose up -d
```

### Docker 架构

```
┌─────────────────────────────────────────┐
│  Thunder Subtitle Container              │
│                                          │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │  Next.js     │  │  FastAPI          │  │
│  │  :3000       │  │  :8000            │  │
│  │  (frontend)  │  │  (backend)         │  │
│  └─────────────┘  └──────────────────┘  │
│                                          │
│  ┌─────────────────────────────────────┐  │
│  │  supervisord                        │  │
│  │  (进程管理器)                        │  │
│  └─────────────────────────────────────┘  │
│                                          │
│  /media ← Docker volume 挂载             │
└─────────────────────────────────────────┘
```

### 端口说明

| 端口 | 服务 | 说明 |
|------|------|------|
| 3000 | Next.js | 前端 Web UI |
| 8000 | FastAPI | 后端 API |

> **注意**：`NEXT_PUBLIC_API_URL` 是构建时环境变量，在 `docker build` 时注入。如需在浏览器中直接访问 FastAPI（非 Next.js 代理），确保该值指向浏览器可达的地址（如 `http://your-server:8000`），而非容器内部地址。

---

## 3. API 端点概览

| 方法 | 端点 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/auth/login` | 否 | 登录获取 JWT |
| POST | `/api/auth/verify` | 否 | 验证 token |
| POST | `/api/auth/change-password` | JWT | 修改密码 |
| GET | `/api/subtitle/search` | 否 | 搜索字幕 |
| GET | `/api/subtitle/download` | 否 | 下载字幕 |
| GET | `/api/config` | JWT | 获取配置 |
| PUT | `/api/config` | JWT | 更新配置 |
| POST | `/api/config/reload` | JWT | 重载配置 |
| POST | `/api/tasks` | JWT | 创建任务 |
| GET | `/api/tasks` | JWT | 任务列表 |
| GET | `/api/tasks/{id}` | JWT | 任务详情 |
| POST | `/api/tasks/{id}/cancel` | JWT | 取消任务 |
| GET | `/api/media/directories` | JWT | 媒体目录列表 |
| GET | `/api/media/nfo` | JWT | NFO 元数据 |
| GET | `/api/review/list` | JWT | 审查列表 |
| POST | `/api/review/mark` | JWT | 标记审查结果 |
| GET | `/api/health` | 否 | 健康检查 |
| WS | `/ws/progress/{task_id}` | 否 | 任务进度推送 |

---

## 4. 人工验证清单

### 4.1 Docker 构建验证

- [x] `docker build -t thunder-subtitle .` 构建成功（无报错）
- [x] `docker compose down
  docker compose build --no-cache
  docker compose up -d` compose 构建
- [x] 镜像大小合理（预期 < 1GB）
- [x] 构建日志中 next.js standalone 输出正确

### 4.2 Docker 运行验证

- [x] `docker compose up -d` 启动无报错
- [x] `docker compose logs` 中 FastAPI 日志显示 `Uvicorn running on http://0.0.0.0:8000`
- [x] `docker compose logs` 中 Next.js 日志显示 `Ready on http://0.0.0.0:3000`
- [x] 访问 http://localhost:3000 显示登录页面
- [x] 访问 http://localhost:8000/docs 显示 Swagger UI

### 4.3 认证流程验证

- [x] 访问 http://localhost:3000 自动跳转到 /login
- [x] 使用 `admin` / `changeme` 登录成功
- [x] 登录后跳转到 /search 页面
- [x] 刷新页面后仍保持登录状态
- [x] 点击 Logout 后跳转到登录页

### 4.4 Search 页面验证

- [x] 搜索框可输入关键词
- [x] 点击搜索或 Enter 触发搜索
- [x] 搜索结果展示字幕列表
- [x] 中文过滤芯片（All / Chinese Only / Chinese First）可切换
- [x] 排序控件（Relevance / Newest / Score）可切换
- [x] 点击下载按钮可触发下载

### 4.5 Scanner 页面验证

- [x] 页面显示媒体库路径列表（来自 FastAPI）
- [ ] Scan Now 按钮可点击，创建扫描任务
- [ ] 扫描进度条实时更新
- [ ] 扫描结果列表展示
- [ ] 取消按钮可终止扫描任务

### 4.6 Verification 页面验证

- [ ] 页面加载待审查字幕列表
- [ ] 点击左侧文件项，右侧显示详情
- [ ] 质量评分和编码信息正常展示
- [ ] Correct / Off Sync / Wrong Language 按钮可点击
- [ ] 标记后列表状态更新

### 4.7 Settings 页面验证

- [ ] 页面加载后填充当前配置值
- [ ] 修改配置字段后 Save Changes 按钮可点击
- [ ] 保存后显示成功提示
- [ ] Reset Defaults 按钮恢复默认配置
- [ ] 密码修改表单：输入旧密码 + 新密码可提交
- [ ] 旧密码错误时显示错误提示

### 4.8 深色主题 / 视觉验证

- [ ] 页面背景色为 #0f1417
- [ ] 侧边栏背景色为 #171c20
- [ ] 主色调为 Electric Blue (#7bd0ff)
- [ ] 按钮有 hover 态变化
- [ ] 字体为 Inter
- [ ] 间距以 8px 为基准
- [ ] 卡片圆角为 8-12px

### 4.9 API 认证中间件验证

- [x] 无 token 访问 /api/config 返回 401/403
- [x] 带 token 访问 /api/config 返回 200
- [x] Token 过期后自动跳转登录页

### 4.10 i18n 验证

- [x] 页面默认语言为英文
- [x] TopBar 语言切换按钮可点击
- [x] 切换到中文后所有文本变为中文
- [x] 切回英文后恢复

---

## 5. 故障排查

### 常见问题

| 问题 | 可能原因 | 解决方案 |
|------|---------|---------|
| 登录后 401 | JWT_SECRET 不匹配 | 确保前后端使用相同的 JWT_SECRET |
| 搜索无结果 | 迅雷 API 不可达 | 检查网络连接，确认不是在国内受限环境 |
| 扫描无进度 | CLI 模块导入失败 | 检查 PYTHONPATH，确认 `from src.api import SubtitleApiClient` 可用 |
| 页面空白 | Next.js 构建失败 | 检查 `NEXT_PUBLIC_API_URL` 是否正确设置 |
| CORS 错误 | CORS 配置不包含前端地址 | 在后端 Settings.cors_origins 中添加前端地址 |

### 日志查看

```bash
# Docker 容器日志
docker compose logs -f

# 仅后端日志
docker compose logs -f thunder-subtitle | grep backend

# 仅前端日志
docker compose logs -f thunder-subtitle | grep frontend
```