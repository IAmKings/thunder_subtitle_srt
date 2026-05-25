# PWA 移动端 UI 三个问题修复

## Goal

修复 PWA standalone 模式三个 UI 问题，桌面端零影响。

## Decision (ADR-lite)

**Context**: 三个 PWA UI 问题——表格竖排/筛选挤压/审查上下结构。
**Decision**: 表格→卡片 + 筛选分行 + 审查切换模式。全部走断点隔离，桌面端零改动。
**Consequences**: scanner 和 verification 页面各加一套移动端专属 JSX，用 `md:hidden`/`hidden md:block` 控制。

## Requirements

1. 扫描器表格移动端→卡片列表（`md:hidden` 卡片 + `hidden md:table` 表格）
2. 扫描器标题+筛选→移动端上下分行（`flex-col md:flex-row`）
3. 审查页移动端→列表↔预览切换模式（`lg:hidden` 切换 + `hidden lg:grid` 左右分栏）

## Acceptance Criteria

- [ ] PWA 下扫描器结果卡片展示，无竖排文字
- [ ] PWA 下扫描器标题筛选分两行
- [ ] PWA 下审查页选中文件全屏预览，←返回列表
- [ ] 桌面端布局零回归
- `tsc --noEmit` 零错误
- `pnpm lint` 零 error

## Out of Scope

- 桌面端布局改动
- 新功能逻辑
- settings/search 页面
