# Thunder Subtitle 路线图

> 当前版本：v1.4.1 | 最后更新：2026-06-08

## 已完成

### v1.0 — 基础可用
- [x] 字幕搜索（CLI + Web UI）
- [x] 中文过滤 / 中文优先 / 时长匹配
- [x] Jellyfin 媒体库扫描器
- [x] 字幕审查（百分制评分 + 人工标记）
- [x] Docker 部署（Nginx 反代、单端口 3000）
- [x] JWT 认证
- [x] 设置页（保存路径、字幕组偏好、媒体路径、高级配置）

### v1.1 — 移动端 + 性能
- [x] 移动端响应式适配（底部 TabBar、4 页面适配）
- [x] PWA 可安装（manifest + service worker）
- [x] Nginx HTTPS 自签名证书（局域网 PWA 触发安装）
- [x] 审查页搜索文字保留（进电影+返回不丢失）
- [x] 扫描器 HTTP 轮询兜底（WebSocket 不可用时仍展示结果）

### v1.2 — 代码质量 + CI
- [x] P0 安全修复（鉴权、路径遍历、密码持久化）
- [x] P1+P2 代码质量全面修复（67 项）
- [x] `_cli_imports.py` 集中双导入管理
- [x] 文档结构优化（根 README 精简 + 三模块 README）
- [x] 扫描器轮播"剩 N 页"提示
- [x] 库路径卡片文件夹名显示
- [x] PWA 安装提示修复（PNG 图标 + purpose）
- [x] ConfirmDialog 仅关闭模式（双取消按钮修复）

### v1.3 — 审查 + 扫描加速
- [x] 审查性能优化：轻量发现（5s） + 按需深审（6s），原 24 分钟 → 5 秒
- [x] 扫描 50ms sleep 移除（946 部 dry_run 48s→5s）
- [x] `.preferred` 偏好字幕组标记文件
- [x] API timing middleware（请求耗时日志）
- [x] 审查页字幕列表显示偏好字幕组星标（蓝色 ⭐）
- [x] 错误提示残留修复 + 多目录容错

---

## 短期（v1.4–v1.5）

### 扫描/审查统计面板
首页 Dashboard：总库数、已下载/跳过/无匹配统计、待审查数、最近扫描时间线

- 改动量：~200 行
- 涉及：前端新页面 `dashboard/page.tsx` + 后端统计 API

### 自动化定时扫描
Settings 页"自动化"开关接入后台定时任务（cron/APScheduler），可按固定间隔自动扫描

- 改动量：~80 行
- 涉及：`scan_service.py` 定时调度 + `settings/page.tsx`

### 扫描结果导出 CSV
一键导出当前扫描结果为 CSV 文件（电影名、状态、字幕文件、原因）

- 改动量：~50 行
- 涉及：后端 CSV 生成 + 下载端点

### 库路径批量 ON/OFF
多个库路径时加"全部启用/禁用"按钮

- 改动量：~10 行
- 涉及：`scanner/page.tsx`

---

## 中期（v1.6–v2.0）

### 电视剧集支持
扩展扫描器支持 TV 剧集目录结构（`剧集/Season 01/episode.nfo`），按季分组

- 改动量：~300 行
- 涉及：`_dir.py` + `scanner` 模块 + 前端展示

### 审查缓存（SQLite）
`.review-cache` 替代方案：SQLite 存储每文件审查结果 + mtime 对比，仅在文件变更时重审

- 改动量：~200 行
- 涉及：`reviewer` 模块 + `review_service.py`

### 通知推送
Webhook 通知（企业微信 / 飞书 / Telegram）扫描完成、新字幕待审查

- 改动量：~100 行
- 涉及：`scan_service.py` 回调 + Settings 配置

### 字幕详情对比视图
同电影多个字幕并排对比：score、encoding、cn_ratio、预览片段

- 改动量：~150 行
- 涉及：`verification/page.tsx` 新卡片布局

---

## 长期（v2.0+）

| 功能 | 说明 |
|------|------|
| 多用户/多权限 | admin + viewer（只看不操作） |
| Sonarr/Radarr 集成 | 对接 arr 生态，自动获取媒体库 |
| 视频内嵌字幕预览 | Web UI 内播放视频片段 + 字幕叠加 |
| 字幕在线编辑器 | Web 端直接编辑 SRT 时间轴/文本 |
| 移动端原生 App | SwiftUI / Jetpack Compose 或 Capacitor |

---

## 技术债务

| 项目 | 优先级 | 说明 |
|------|--------|------|
| 前端测试覆盖 | 中 | 当前无前端单元/集成测试 |
| E2E 测试 | 低 | Playwright/Cypress 自动化回归 |
| CI 增加前端 build 检查 | 中 | 当前仅 mypy + pytest |
| 日志级别可配置 | 低 | 当前硬编码 INFO |
| CLI TypeScript 版本退役 | 低 | 功能已被 Python CLI 完全覆盖 |
