# 1.0.1 版本发布代码审查与优化

## Goal

对 1.0.1 版本进行全面代码审查与深度重构，消除代码坏味道、修复 bug、提升可维护性，确保版本可安全发布。

## Decision (ADR-lite)

**Context**: 1.0.1 增量提交导致 verification (1098行)、scanner (847行)、settings (530行) 三个页面严重膨胀，需要决定优化深度。
**Decision**: 深度重构 — 拆分巨型组件、抽取共享模块、useReducer 改造、i18n 完整覆盖。
**Consequences**: 改动范围大，需要仔细验证功能无回归；但一次到位避免后续持续欠债。

## Requirements

### P0: Bug 修复
1. **handleMark 闭包 bug** — 先 `setSelectedMovie(null)` 再 filter 中使用 `selectedMovie`，改用局部变量保存值
2. **scanner setFindings 重复调用** — `handleScanNow` 中 line 213/216 重复

### P1: 组件拆分 (verification/page.tsx)
3. 抽取 **ConfirmDialog** 通用确认对话框组件（替代 4 个内联对话框）
4. 抽取 **SubtitlePreview** 预览面板组件
5. 抽取 **MovieList** / **SubtitleList** 列表组件
6. 抽取 **VerificationStats** 统计卡片组件
7. `handleReject` 逻辑简化，提取排序/查找为独立工具函数

### P1: 共享工具函数
8. 抽取 **statusColorMap** / **dryStateColorMap** 颜色映射工具（消除 scanner 3 处重复）
9. 抽取 **StatusBadge** / **DryStateBadge** 通用标签组件

### P2: useState → useReducer
10. **settings/page.tsx** — 20+ useState 合并为 useReducer
11. **verification/page.tsx** — 筛选状态合并为 useReducer

### P2: i18n 完整性
12. Pin 状态持久化到 localStorage（`verification-state.tsx`）
13. 清理 `i18n.ts` 未使用的翻译键
14. 补充缺失的翻译键（对话框硬编码中文等）

### P3: 后端精修
15. `config_service.py` — `_effective_media_paths` 优化 `# type: ignore` 写法

## Acceptance Criteria

- [ ] `tsc --noEmit` 零错误
- [ ] `pnpm lint` 零警告
- [ ] `ruff check` 零错误
- [ ] verification/page.tsx ≤ 400 行（拆分后主文件）
- [ ] 所有用户可见字符串支持 i18n（中/英）
- [ ] Pin 状态刷新页面后保持
- [ ] scanner 颜色映射无重复代码
- [ ] 功能无回归

## Definition of Done

- Lint / typecheck 全部通过
- 无巨型函数（单个函数 ≤ 50 行）
- 无重复代码块（DRY）
- 硬编码 UI 字符串全部 i18n 化
- 不涉及 git commit（用户未要求）

## Implementation Plan

```
PR1: 抽取共享组件 + 工具函数
  - components/ConfirmDialog.tsx
  - components/StatusBadge.tsx
  - lib/scan-utils.ts (颜色映射)
  - 验证 scanner 功能正常

PR2: 拆分 verification/page.tsx
  - components/SubtitlePreview.tsx
  - components/MovieList.tsx
  - components/SubtitleList.tsx
  - 修复 handleMark 闭包 bug
  - Pin localStorage 持久化

PR3: useReducer 改造 + i18n 收尾
  - settings/page.tsx → useReducer
  - verification 筛选状态 → useReducer
  - i18n 清理 + 补充
  - 后端精修
  - 全量 lint/typecheck
```

## Out of Scope

- 新功能开发
- Docker 构建验证
- 端到端测试
- git commit / 分支操作

## Technical Notes

- 改动文件: verification/page.tsx, scanner/page.tsx, settings/page.tsx, verification-state.tsx, i18n.ts, review_service.py, config_service.py
- 新增文件: ConfirmDialog.tsx, StatusBadge.tsx, SubtitlePreview.tsx, MovieList.tsx, SubtitleList.tsx, scan-utils.ts
- 前端 spec: `.trellis/spec/frontend/quality.md`, `components.md`, `hooks.md`, `state-management.md`
- 后端 spec: `.trellis/spec/backend/quality.md`
- 参考: `.trellis/spec/frontend/css-layout.md` (设计令牌规范)

## Open Questions

* 无 — 全部确认完毕
