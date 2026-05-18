# 完善 Web UI 页面功能与后端集成

## Goal

将 Round 1 的骨架代码完善为可交付的 MVP——所有 4 个页面的前端与后端真实集成，任务执行引擎可用，Docker 可运行。

## What I already know

### Round 1 完成度（差距分析）

| 区域 | 完成度 | 状态 |
|------|--------|------|
| Search 页面 | ~85% | 基本可用，缺海报图/排序 |
| Scanner 页面 | ~20% | UI 外壳，无后端交互 |
| Verification 页面 | ~15% | UI 外壳，无后端交互 |
| Settings 页面 | ~25% | UI 外壳，本地 state 无后端读写 |
| Login 页面 | ~90% | 基本可用 |
| FastAPI 后端 | 骨架 | 6 router 存在，但 task engine 不执行、review 返回空、无 auth 中间件 |
| Docker 配置 | 完成 | 需修复 NEXT_PUBLIC_API_URL 注入 |

### P0 缺失（核心功能）

1. **后端任务执行引擎**：create_task 创建任务但不执行，需 asyncio 后台执行 + 状态更新 + WebSocket 进度推送
2. **后端 review service**：list_reviews 返回空列表，mark_review 有 import bug
3. **后端认证中间件**：所有路由无 JWT 保护
4. **Scanner 页面**：无后端数据绑定（Scan Now 不触发 API，进度不更新，结果为空）
5. **Verification 页面**：无后端数据绑定（列表为空，标记按钮无响应）
6. **Settings 页面**：无后端数据绑定（getConfig/updateConfig 未调用）

### P1 体验增强

7. Scanner 扫描结果展示（文件类型/分辨率标签）
8. Verification 详情面板（质量评分、时间轴）
9. Search 视觉改进（排序控件）
10. Settings 密码管理

### P2 打磨

11. Docker NEXT_PUBLIC_API_URL 修复
12. ProgressWebSocket 前端集成
13. 任务历史面板

## Decisions

### D1: 任务执行引擎 → asyncio.create_task + 内存 dict + WebSocket

**Context**: scan/review 等操作可能运行几十分钟，需要后台执行并实时推送进度。

**Decision**: 使用 `asyncio.create_task()` 启动后台协程，任务状态存内存 dict，通过 WebSocket 推送进度。

**Consequences**:
- 轻量，无额外依赖（无需 Redis/Celery）
- 进程重启时任务状态丢失（MVP 可接受，用户可重新触发扫描）
- 需在 service 层用 `asyncio.to_thread()` 包装 CLI 的同步函数

## Assumptions (temporary)

- CLI 核心模块（thunder_subtitle）可正常 import
- 数据库不需要（配置用 JSON 文件，任务用内存 dict）
- MVP 阶段单管理员足够
- 进程重启后任务状态丢失可接受

## Open Questions

## Requirements (evolving)

### 后端

- 任务执行引擎：创建任务后真正异步执行 scan/review 逻辑
- 任务状态机：pending → running → completed / failed
- 任务进度推送：WebSocket 实时更新
- 认证中间件：写操作路由需 JWT 保护
- Review service：调用 CLI 模块实际执行审查
- Subtitle detail 端点：修复 get_detail 返回 None 的问题

### 前端

- Scanner 页面：绑定后端 API（listMediaDirectories, createTask, 进度轮询/WebSocket）
- Verification 页面：绑定后端 API（listReviews, markReview）
- Settings 页面：绑定后端 API（getConfig, updateConfig, reloadConfig）
- 所有页面：loading 状态 + 错误处理

### P1 体验增强

- Scanner 扫描结果：文件类型/分辨率/状态标签
- Verification 详情面板：质量评分、匹配百分比、时间轴、编码信息
- Search 视觉改进：排序控件（Newest/Score）
- Settings 密码管理 section

### P2 打磨

- Docker NEXT_PUBLIC_API_URL build-time 注入
- ProgressWebSocket 前端集成（Scanner + Verification 实时进度）
- i18n 语言切换器（TopBar 已有按钮，需确保切换生效）

## Acceptance Criteria (evolving)

- [ ] Scanner 页面：可启动扫描、看到实时进度、展示扫描结果
- [ ] Verification 页面：可加载审查列表、点击查看详情、标记审查结果
- [ ] Settings 页面：可读取/保存配置
- [ ] 后端任务引擎：scan 任务可真正执行并报告进度
- [ ] 后端 review：调用 CLI 模块执行审查
- [ ] 认证中间件：写操作需 JWT
- [ ] Scanner 结果展示：类型/分辨率/状态标签
- [ ] Verification 详情：质量评分 + 时间轴
- [ ] Search 排序控件
- [ ] Settings 密码修改
- [ ] Docker 构建成功 + API URL 正确注入
- [ ] WebSocket 实时进度推送可用
- [ ] i18n 切换器

## Definition of Done

- 后端所有 API 返回真实数据（非空/shell）
- 前端所有页面可交互（按钮有响应、数据从后端加载）
- lint / typecheck 通过
- Docker 构建成功

## Scope: P0 + P1 + P2（全部）

本轮完成所有差距项：核心功能 + 体验增强 + 打磨细节。

## Out of Scope (explicit)

- 安卓客户端
- 多用户系统
- 定时扫描（cron）