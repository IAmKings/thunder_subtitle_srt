# 移动端扫描审核 — 方案规划

## Goal

改造现有 Next.js Web 应用为响应式布局，用户通过手机浏览器（内网/外网均可）进行扫描与审核字幕操作。

## Decision (ADR-lite)

**Context**: 需要移动端访问，Docker 主机可内网+外网访问。
**Decision**: 响应式 Web — 改造现有 4 个页面适配移动端，TailwindCSS 响应式断点实现。零后端改动，零新项目。
**Consequences**: 一套代码双端适配，`md:` 断点以上保持桌面布局不动。

## Requirements

### 布局改造
1. **AppShell** — 移动端：侧边栏隐藏 → 底部固定 TabBar（4 个图标：Search/Scanner/Verification/Settings），`md:` 以上恢复侧边栏
2. **TopBar** — 移动端缩小，语言切换保留

### 页面改造（4 个全做）
3. **Scanner** — 表格 → 卡片列表；路径轮播 2 卡片 → 1 卡片；筛选器折叠；进度条保留
4. **Verification** — 左右分栏 → 上下堆叠；左侧列表 → 全宽卡片；右侧预览面板 → 底部弹出/独立区域；操作按钮固定底部
5. **Search** — 已有卡片布局，适配量最小；搜索框 + 过滤芯片 + 结果卡片堆叠
6. **Settings** — grid 2 列 → 单列堆叠；表单输入全宽

### 通用改动
7. 所有 `p-8` → `p-4 md:p-8`
8. 所有 `text-sm` 在移动端保持可读
9. 对话框 `max-w-sm` → `mx-4 max-w-sm`（已适配）
10. Toast/提示 移动端顶部显示

### PWA 可安装
11. `public/manifest.json` — App 名称 "Thunder Subtitle"，图标、全屏启动
12. `public/sw.js` — 简单 service worker，缓存静态资源，触发安装提示
13. `app/layout.tsx` — 注册 manifest + service worker

## Acceptance Criteria

- [ ] iPhone SE (375px) / iPhone 14 (390px) / iPad (768px) 三种宽度下 4 页面可用
- [ ] 桌面端布局无回归（`md:` 1024px 以上保持原样）
- [ ] 扫描触发、进度查看、结果列表移动端可操作
- [ ] 验证页字幕列表可选择、预览可读、ok/fail/删除可操作
- [ ] 登录页适配移动端
- [ ] Chrome/Safari 移动端弹出"添加到主屏幕"提示
- [ ] `tsc --noEmit` 零错误 / `pnpm lint` 零 error

## Out of Scope

- React Native / 独立移动 App
- 新功能开发
- 后端改动

## Implementation Plan

```
PR1: AppShell 底部 TabBar + 全局布局适配 + PWA
  - 移动端底部导航栏
  - 通用间距/字号响应式
  - 登录页适配
  - manifest.json + sw.js + layout.tsx 注册

PR2: Scanner + Search 页面适配
  - 表格→卡片、路径轮播、筛选折叠

PR3: Verification + Settings 页面适配
  - 分栏→堆叠、预览面板移动端布局
  - Settings 单列表单

PR4: 全量测试 + 各断点验证
```

## Implementation Plan

```
PR1: AppShell 底部 TabBar + 全局布局适配
  - 移动端底部导航栏
  - 通用间距/字号响应式
  - 登录页适配

PR2: Scanner + Search 页面适配
  - 表格→卡片、路径轮播、筛选折叠

PR3: Verification + Settings 页面适配
  - 分栏→堆叠、预览面板移动端布局
  - Settings 单列表单

PR4: 全量测试 + 各断点验证
```

## Technical Notes

- TailwindCSS 4 断点：`sm:640px md:768px lg:1024px xl:1280px`
- 移动端目标：375px - 767px
- 平板目标：768px - 1023px（保持侧边栏但调整内容区）
- 桌面端：1024px+（保持现有布局不动）
- 所有改动走 `md:` 前缀，不改桌面端已测试过的布局
