# 修复验证页电影列表加载慢和显示未配置文件媒体目录

## Goal

修复验证页（`/verification`）两个问题：
1. 电影列表加载极慢 — `listMediaDirectories` 和 `listMovies` 做了不必要的耗时 I/O
2. 错误展示不合理 — 加载失败或超时后显示"未配置文件媒体目录"，实际目录已配置

## What I already know

* `listMediaDirectories` 默认 `include_pending=True`，触发 `_count_pending_review` → `scan_movie_dirs` 递归扫目录
* `list_movies` 调用 `list_review_movies(parse_duration=True)`，对每个电影目录读 `movie.nfo` + XML 解析
* 前端 `loadReviews` 用 `for...of` 串行请求每个目录的 `listMovies`
* 验证页电影列表阶段根本不需要 `pending_count` 和 `duration_seconds`
* 前端 `.catch(() => { setIsLoading(false); })` 静默吞错 → `baseDir` 为空 → 显示误导提示

## Requirements

1. 验证页 `listMediaDirectories` 调用传 `include_pending=false`，跳过待审核计数
2. `listMovies` 调用 `list_review_movies` 时 `parse_duration=False`，列表阶段不读 NFO
3. 前端 `loadReviews` 中用 `Promise.allSettled` 并行请求所有目录的电影列表
4. 错误展示区分三种空状态："请求失败" / "未配置目录" / "全部目录已禁用"
5. `duration_seconds` 改为选中电影后按需获取（已有 `/api/media/nfo` 端点可用）

## Acceptance Criteria

* [ ] 验证页初始加载不再触发 `_count_pending_review` 递归扫描
* [ ] 多目录时电影列表并行加载而非串行等待
* [ ] 列表阶段不读 `movie.nfo`，选中电影后再通过 `/api/media/nfo` 获取片长
* [ ] 未配置目录时正确显示"未配置"提示，请求失败时显示错误信息（而非误导为"未配置"）
* [ ] lint / typecheck 通过

## Definition of Done

* 前端 lint 通过
* 后端无新增 lint 错误
* 手动验证：打开验证页，列表加载时间显著缩短

## Technical Approach

三处改动：

1. **前端 `api.ts`**: `listMediaDirectories` 方法支持 `include_pending` 参数（默认 `false`），验证页用 `false`
2. **后端 `review_service.py`**: `list_movies` 中 `parse_duration` 改为 `False`
3. **前端 `verification/page.tsx`**:
   - `for...of` → `Promise.allSettled` 并行加载
   - 选中电影后调用 `/api/media/nfo` 获取片长
   - 优化空状态错误提示逻辑

## Decision (ADR-lite)

**Context**: NFO 解析和目录递归扫描在列表阶段是无效开销
**Decision**: 列表阶段只做文件名收集和状态检查，片长按需获取
**Consequences**: 列表加载速度大幅提升，选中电影时需要一次额外 API 调用换取片长（毫秒级）

## Out of Scope

* 后端 `list_review_movies` 的内部并行化（`scan_movie_dirs` 后对每个 movie 的 I/O 并行）

## Technical Notes

* 相关文件:
  - `thunder-subtitle-web/src/app/verification/page.tsx` — 验证页
  - `thunder-subtitle-web/src/lib/api.ts` — API 客户端
  - `thunder-subtitle-api/app/services/review_service.py:98` — `list_movies` 调用点
  - `thunder-subtitle-api/app/api/media.py` — `/api/media/nfo` 端点（已存在）
  - `thunder-subtitle-api/app/api/review.py` — `/api/review/movies` 端点
