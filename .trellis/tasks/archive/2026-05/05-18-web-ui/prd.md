# Thunder Subtitle Web UI 开发

## Goal

基于 Python CLI 的功能，开发一个完整的 Web 界面，使用户可以通过浏览器使用字幕搜索、下载、扫描、审查等功能。最终需要打包为 Docker 镜像部署。

## What I already know

### 项目现状

- `thunder-subtitle-py/` — Python CLI 工具，已验收，包含 6 个命令：search, download, scan, review, dump, config
- `thunder-subtitle-web/` — 现有 Next.js 16 应用，仅实现了基础搜索功能（轻色主题，简单布局）
- `demo/` — Vite + React + Tailwind 演示应用，包含 4 个视图（Search, Scanner, Verification, Settings），使用深色主题
- `design/` — 4 个高保真 HTML 设计文件 + DESIGN.md 设计系统文档
  - `thunder_subtitle_1`: Settings 页面
  - `thunder_subtitle_2`: Verification & Tagging 页面
  - `thunder_subtitle_3`: Search 页面
  - `jellyfin_thunder_subtitle`: Scanner/Dashboard 页面

### CLI 功能列表

1. **search** — 搜索字幕，支持中文过滤、时长筛选、中文优先
2. **download** — 通过 URL 下载字幕
3. **scan** — 扫描 Jellyfin 媒体库目录，自动下载字幕
4. **review** — 审查字幕质量（编码、时间轴、中文占比等）
5. **dump** — 全量下载某电影所有字幕
6. **config** — 查看/修改配置

### 设计系统规格

- 深色主题（Dark Theme），背景 #0f1417
- 主色 Electric Blue #7bd0ff / #00A4DC
- 字体 Inter
- Material Icons / Lucide Icons
- 圆角 8-12px，间距以 8px 为基准

### D4: Docker 部署 → 单镜像 + supervisord

**Context**: 需要同时运行 FastAPI 后端和 Next.js 前端，媒体库需要文件系统访问。

**Decision**: 单个 Docker 镜像，supervisord 管理 FastAPI + Next.js 两个进程。媒体库路径通过 `-v /host/media:/media` 挂载。

**Consequences**:
- `docker run -v /host/media:/media -p 3000:3000` 即可运行
- supervisord 统一管理进程生命周期和日志
- 配置文件通过环境变量或 volume 挂载注入

### D5: 认证方案 → 简单 JWT（单管理员）

**Context**: 自托管场景为主，未来需支持安卓客户端。

**Decision**: 单管理员账号，密码通过环境变量 `ADMIN_PASSWORD` 设置（首次访问强制设置页）。JWT 签发 token，所有写操作 API 需认证。搜索 API 可选公开。

**Consequences**:
- MVP 快速上线，无需注册流程
- 安卓客户端通过 JWT 认证访问
- 未来可扩展为多用户/角色系统

## Decisions

### D1: 后端架构 → FastAPI 后端 + Next.js 前端

**Context**: 需要文件系统访问（scan/review/dump），且未来要支持安卓客户端做 review 和 dump 指令下发。

**Decision**: 新增 Python FastAPI 后端，封装 CLI 核心模块为 REST API。Next.js 前端通过 HTTP 调用 FastAPI。Docker 内两个进程通过 supervisord 管理。

**Consequences**:
- API 层天然支持多端（Web + Android + 任意客户端）
- 认证层可独立演进（JWT → OAuth2）
- scan/review/dump 等文件操作在服务端完成，客户端只需发命令
- 媒体库路径通过 Docker volume 挂载，客户端无需直接访问文件系统

### D3: 项目基础 → 在 thunder-subtitle-web 上重构

**Context**: 现有 thunder-subtitle-web 有可复用的 API route、类型定义、项目结构。demo 有接近目标的高保真 UI。

**Decision**: 在 thunder-subtitle-web 基础上重构。保留已有 API route 和类型定义，UI 全面替换为设计稿的深色主题 + 4 页面布局，参考 demo 的组件结构和样式。新增 FastAPI 后端处理 CLI 功能。

**Consequences**:
- 复用已有的 `/api/subtitle` 代理路由和 `Subtitle` 类型定义
- 复用 `SubtitleApiClient`（需扩展）
- UI 从零重写（浅色→深色主题，单页→4 页面）
- demo 的 React 组件作为 UI 参考，不走 Vite 路线

### D2: 功能范围 → 全量 MVP（4 页面 + 认证）

**Context**: 设计稿已完整覆盖 4 个页面，未来还需支持安卓客户端。

**Decision**: 第一版即实现全部 4 页面 + 用户认证系统。

4 个页面对应 CLI 功能：
- **Search** → search 命令（搜索字幕、中文过滤、时长筛选、下载）
- **Scanner** → scan 命令（扫描媒体库、自动下载字幕、进度跟踪）
- **Verification** → review 命令 + dump 命令（字幕质量审查、标记通过/失败）
- **Settings** → config 命令（配置管理、媒体库路径、下载偏好）

认证系统：
- JWT token 认证
- 注册/登录
- 为后续安卓客户端预留 API

## Requirements (evolving)

### 架构

- **前端**：Next.js 16（在 thunder-subtitle-web 上重构），深色主题，4 页面布局
- **后端**：FastAPI（新增，封装 CLI 核心模块为 REST API）
- **部署**：单 Docker 镜像 + supervisord，`-v /host/media:/media` 挂载
- **认证**：简单 JWT（单管理员，环境变量配置密码）
- **实时通信**：WebSocket 推送扫描/审查进度
- **任务系统**：后台任务队列（扫描、审查等长时间运行的操作）
- **配置热重载**：修改配置后无需重启服务

### API 设计

- `/api/auth/` — 认证（登录、获取 token）
- `/api/subtitle/` — 字幕搜索（代理迅雷 API）
- `/api/config/` — 配置读写
- `/api/tasks/` — 任务管理（扫描、审查等）
- `/api/tasks/{id}/progress` — 任务进度（WebSocket + 轮询双模式）
- `/api/media/` — 媒体库信息（目录列表、NFO 元数据）
- `/api/review/` — 审查操作（标记通过/失败/偏移）

### 页面

1. Search 页面：搜索字幕、结果展示（海报卡片+语言标签）、过滤（中文优先/仅中文/时长）、下载、搜索历史
2. Scanner 页面：媒体库路径配置、扫描进度（实时）、扫描结果列表（状态标签）、断点续扫、dry-run 预览
3. Verification 页面：待审查字幕列表（左侧面板）、字幕内容预览+时间轴（右侧）、质量评分展示、标记通过/失败/偏移/语言错误
4. Settings 页面：下载路径配置、语言偏好、Jellyfin 集成（URL/API Key）、字幕源管理、自动化开关、用户账号管理

## Acceptance Criteria (evolving)

- [ ] Search 页面：搜索字幕、过滤、下载，与设计稿视觉一致
- [ ] Scanner 页面：配置媒体库路径、启动扫描、实时进度、结果列表
- [ ] Verification 页面：字幕列表、内容预览、质量评分、标记审查结果
- [ ] Settings 页面：配置管理、Jellyfin 集成、自动化开关
- [ ] 登录页面：管理员认证
- [ ] WebSocket 推送任务进度
- [ ] 后台任务队列（扫描/审查）
- [ ] 配置热重载
- [ ] FastAPI 后端所有 API 端点可用
- [ ] Docker 镜像构建成功，`docker run` 可运行
- [ ] 媒体库路径通过 volume 挂载访问

## Definition of Done

- 代码 lint / typecheck 通过
- 所有页面功能可用
- Docker 构建成功
- 与设计稿视觉一致

## Out of Scope (explicit)

- 安卓客户端（API 已预留，但本期只做 Web）
- 多用户/角色权限系统
- SaaS 化功能（付费、配额等）
- 视频播放器集成
- 自动化定时扫描（cron 调度，MVP 用手动触发）

## Technical Notes

### 现有 thunder-subtitle-web 技术栈
- Next.js 16.2.4 + React 19.2.4
- TailwindCSS 4
- TypeScript 5
- 仅 /api/subtitle 代理路由

### 现有 demo 技术栈
- Vite + React 19 + TailwindCSS 4
- Framer Motion（动画）
- Lucide React（图标）
- i18n 国际化支持（en/zh）

### Python CLI 核心模块
- `api.py` — SubtitleApiClient（搜索、中文过滤、时长匹配）
- `config.py` — 配置管理（JSON 文件持久化）
- `scanner/` — Jellyfin 目录扫描器
- `reviewer/` — 字幕质量审查器
- `download.py` — 字幕下载器
- `types.py` — 数据类型定义

### CLI 需要文件系统访问的功能
- scan：需要遍历媒体目录、读取 NFO 文件、写入字幕文件
- review：需要遍历目录、审查字幕内容、写入 .reviewed 标记
- dump：需要写入字幕文件到磁盘
- config：需要读写 ~/.thunder-subtitle.json