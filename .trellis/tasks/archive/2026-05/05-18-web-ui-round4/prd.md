# Web UI Round 4: Docker构建验证 + E2E运行测试 + 视觉对齐

## Goal

验证 Web UI 可以作为 Docker 镜像端到端运行，修复运行时问题，并对齐设计稿视觉效果。

## What I already know

### 遗留问题

1. **Docker 未实际构建验证** — Dockerfile 配置正确但未 `docker build` + `docker run` 测试
2. **端到端运行时问题** — CLI 模块在 Docker 中的 Python import 路径、scan/review 流程需实际验证
3. **设计稿视觉对齐** — 深色主题 token 已应用，但未逐页面对比设计稿

### 已完成的 3 轮工作

- Round 1: 骨架（FastAPI + Next.js + Docker + JWT）
- Round 2: 后端集成（任务引擎 + 认证中间件 + 页面功能绑定）
- Round 3: 修复（i18n 硬编码 + 密码修改 API + Docker env）

## Requirements (evolving)

### Docker 构建与运行

- `docker build` 成功构建镜像
- `docker run` 启动后 FastAPI (:8000) 和 Next.js (:3000) 都正常响应
- supervisord 正确管理两个进程
- CLI 模块在 Docker 容器内可正确 import（thunder_subtitle 包路径问题）
- 媒体库路径 `-v /host/media:/media` 正确挂载

### 端到端运行验证

- 登录流程正常（JWT 获取 + 存储 + 验证）
- Search 页面可搜索字幕并通过 Next.js 代理路由正常返回
- Scanner 页面可创建 scan 任务（后台执行依赖 CLI 模块可用）
- Settings 页面可读取/保存配置
- 认证中间件正常拦截未授权请求

### 视觉对齐

- 对比 4 个设计稿 HTML 文件，调整页面布局/间距/字体
- 设计稿文件：
  - `design/thunder_subtitle_1/` — Settings 页面
  - `design/thunder_subtitle_2/` — Verification 页面
  - `design/thunder_subtitle_3/` — Search 页面
  - `design/jellyfin_thunder_subtitle/` — Scanner 页面

### 代码质量

- 修复 `docker build` 和运行时暴露的所有问题
- tsc --noEmit 通过
- pnpm lint 通过

## Acceptance Criteria (evolving)

- [ ] `docker build` 成功
- [ ] `docker run -e ADMIN_PASSWORD=xxx -p 3000:3000 -v /path:/media` 启动正常
- [ ] FastAPI /api/auth/login 返回 JWT
- [ ] Next.js 页面可加载且深色主题正确
- [ ] 修复所有构建/运行时错误
- [ ] 视觉与设计稿基本一致（间距、颜色、布局）

## Definition of Done

- Docker 镜像可构建可运行
- 端到端关键流程可走通
- 视觉对齐到设计稿 90%+
- lint/typecheck 通过

## Out of Scope (explicit)

- 安卓客户端
- 多用户系统
- 新功能开发
- pixel-perfect 视觉还原