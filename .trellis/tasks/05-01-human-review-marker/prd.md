# 人工审查标识系统

## Goal

轻量级 `.reviewed` touch 文件标记系统，与 `review` / `scan --dry-run` 联动。

## Decision (ADR-lite)

**Context**: 需要标记已人工校验的字幕，避免多系列电影遗漏
**Decision**: 方案 A — 目录级 `.reviewed` 空文件标记
**Consequences**: 零解析开销，移目录自动带标记

## Requirements

1. `review` 命令显示审查状态（评分 + 是否已人工标记）
2. `review --mark "关键词"` 标记电影为已审查
3. `review --unmark "关键词"` 取消标记
4. `review --mark-all` 批量标记全部
5. `scan --dry-run` 联动：已有字幕但未人工标记的 ⚠ 提示
6. 手动 `touch {电影目录}/.reviewed` 也生效（文件管理器也能标记）

## Acceptance Criteria

- [ ] `.reviewed` 文件标记/取消
- [ ] `review` 输出显示 "Reviewed ✓" 或 "Not reviewed"
- [ ] `scan --dry-run` 对已有字幕未审查的显示 ⚠ 提示
- [ ] `--mark` / `--unmark` / `--mark-all` 正常

## Out of Scope

- 数据库存储
- 审查历史记录

## Technical Approach

- 复用 `scan_movie_dirs` 扫描目录
- `.reviewed` 文件创建时间 = 审查时间
- `review` 和 `scan` 均读取 `.reviewed` 状态
