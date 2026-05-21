# Journal - klz (Part 1)

> AI development session journal
> Started: 2026-04-23

---



## Session 1: Phase 1 CLI 完成

**Date**: 2026-04-23
**Task**: Phase 1 CLI 完成
**Branch**: `master`

### Summary

完成字幕下载 CLI 工具 Phase 1：API 探索、搜索、TUI 选择、下载功能

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `f10a455` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 2: Phase 2 WebApp 完成

**Date**: 2026-04-23
**Task**: Phase 2 WebApp 完成
**Branch**: `master`

### Summary

完成字幕下载 WebApp Phase 2：Next.js 搜索下载界面、API Route 代理、历史记录功能

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `28bdff4` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 3: Python CLI 全功能开发：扫描器、配置、重试、日志、断点续扫

**Date**: 2026-04-30
**Task**: Python CLI 全功能开发：扫描器、配置、重试、日志、断点续扫
**Branch**: `master`

### Summary

Python 版 CLI 从零到稳定：新增 thunder-subtitle-py 项目，完全对齐 TS 版功能。Jellyfin 扫描器支持自动扫描 演员/电影 目录批量下载字幕（双字幕策略、-U 优先级、多关键词过滤、断点续扫）。配置文件持久化（~/.thunder-subtitle.json）。下载失败自动重试。扫描日志。多项体验优化（跳过时不白等 rate_limit、duration=0 不排除、字幕跳过扩展全格式覆盖）。代码重构：拆分为单职责函数。修复死代码。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `99a184c` | (see git log) |
| `27cd2e3` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 4: 修复 --dump reject 统计混入 download + 空gcid url_hash 去重

**Date**: 2026-05-10
**Task**: 修复 --dump reject 统计混入 download + 空gcid url_hash 去重
**Branch**: `master`

### Summary

修复两个关联bug：1) _dump_all_subtitles 在 r.downloaded==0 时仍返回 downloaded 状态，导致全reject影片在汇总中被计为 Downloaded；2) 空 gcid 字幕绕过去重和 reject 检查，引入 _dedup_key() 用 md5(url) 做 fallback。新增2个测试覆盖空gcid场景。196测试全过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `70a931b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 5: README 文档同步 + 修复 CI ruff 缺失

**Date**: 2026-05-10
**Task**: README 文档同步 + 修复 CI ruff 缺失
**Branch**: `master`

### Summary

README.md 同步最新功能：测试数量更新、scan --force/--reset-fail文档化、.rejected增量机制说明。pyproject.toml dev依赖补ruff修复CI command not found。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `4e77301` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 6: 工程优化方向分析：交叉验证 + .zh. 常量化

**Date**: 2026-05-10
**Task**: 工程优化方向分析：交叉验证 + .zh. 常量化
**Branch**: `master`

### Summary

交叉验证05-08 PRD：P0/P1全部完成（已在67f28ce/4b1cb9a/ea8f17f中实现）。剩余.zh.魔法字符串3处 → _ZH_PREFIX常量。196测试全过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `c1f1d1b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 7: Thunder Subtitle Web UI implementation + finish

**Date**: 2026-05-18
**Task**: Thunder Subtitle Web UI implementation + finish
**Branch**: `master`

### Summary

FastAPI backend + Next.js frontend + Docker deployment 全量实现（4页面+认证+WebSocket+任务系统），spec 架构文档重写，任务归档

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `6075c40` | (see git log) |
| `3d7c361` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 8: Web UI Round 2: backend integration + task engine + auth + pages

**Date**: 2026-05-18
**Task**: Web UI Round 2: backend integration + task engine + auth + pages
**Branch**: `master`

### Summary

Complete Web UI: asyncio task engine, auth middleware, Scanner/Verification/Settings pages wired to backend, Search sort, Docker fix

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `fde0a3a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 9: Web UI Round 3: i18n fixes + change-password + Docker

**Date**: 2026-05-18
**Task**: Web UI Round 3: i18n fixes + change-password + Docker
**Branch**: `master`

### Summary

Fix 32 hardcoded strings to use t(), add change-password API endpoint, wire Settings form, fix docker-compose env

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `bccaa0f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 10: Web UI Round 4: Docker config review + visual alignment assessment

**Date**: 2026-05-19
**Task**: Web UI Round 4: Docker config review + visual alignment assessment
**Branch**: `master`

### Summary

Verified Dockerfile config correct, dual-import fallback works in container, no code changes needed in this round

### Main Changes

(Add details)

### Git Commits

(No commits - planning session)

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 11: Web UI deployment docs + verification checklist

**Date**: 2026-05-19
**Task**: Web UI deployment docs + verification checklist
**Branch**: `master`

### Summary

Added README_DEPLOY.md with local dev setup, Docker build/run, env vars, 10-category human verification checklist, and troubleshooting guide

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `8a47d62` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 12: Docker 构建修复：pnpm v11 兼容、Alpine musl 适配、Python 模块名冲突、Release 工作流

**Date**: 2026-05-21
**Task**: Docker 构建修复：pnpm v11 兼容、Alpine musl 适配、Python 模块名冲突、Release 工作流
**Branch**: `master`

### Summary

修复 Docker 多阶段构建中的一系列问题：pnpm v11 废弃 onlyBuiltDependencies 改用 allowBuilds、CI=true 跳过 TTY 确认、backend-builder 从 Debian 切换到 Alpine 避免 glibc/musl 跨平台不兼容、pip --target 平铺安装解决 Alpine sys.path 不包含 /usr/local 的问题、types.py 重命名为 models.py 避免遮蔽 Python stdlib、新增 GitHub Actions Docker 镜像构建发布工作流。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e80002d` | (see git log) |
| `c500f7d` | (see git log) |
| `c680f4b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 13: Docker构建修复、PyPI发布、Web前端多项优化、扫描器路径配置统一

**Date**: 2026-05-21
**Task**: Docker构建修复、PyPI发布、Web前端多项优化、扫描器路径配置统一
**Branch**: `master`

### Summary

Docker构建修复（pnpm v11、Alpine musl、PYTHONPATH、types→models）、Docker Release工作流、PyPI项目名修改、README更新、Web默认中文+语言缓存、搜索排序国际化、搜索状态Context持久化、扫描器路径配置统一（env var优先+JSON回退+前端路径编辑+关键词过滤+轮播优化）、枚举标准化、Python 3.9兼容

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `7c79838` | (see git log) |
| `9a680b8` | (see git log) |
| `c6a6e51` | (see git log) |
| `49b0442` | (see git log) |
| `893f7b8` | (see git log) |
| `2c9f34a` | (see git log) |
| `ea48dc7` | (see git log) |
| `26e5720` | (see git log) |
| `feb564c` | (see git log) |
| `e80002d` | (see git log) |
| `c500f7d` | (see git log) |
| `c680f4b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
