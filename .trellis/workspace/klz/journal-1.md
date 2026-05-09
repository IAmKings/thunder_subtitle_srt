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
