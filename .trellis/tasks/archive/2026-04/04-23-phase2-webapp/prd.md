# Phase 2: 字幕下载 WebApp

## Goal

基于 Phase 1 CLI 经验，开发 WebApp 版本，提供用户友好的图形界面搜索和下载字幕功能。

## What We Already Know

* **API**: `https://api-shoulei-ssl.xunlei.com/oracle/subtitle?name={name}`
* **API Response**: JSON with `code:0` and `data[]` array
* **Subtitle Fields**: `name`, `url`, `ext`, `duration`, `languages`, `gcid`, `cid`
* **Tech Stack**: Node.js/TypeScript + Next.js (from Phase 1 decision)

## Requirements

* Phase 2 - WebApp
  * [ ] 用户友好的 Web 界面
  * [ ] 搜索功能
  * [ ] 字幕列表展示
  * [ ] 单选/多选字幕
  * [ ] 下载功能（单文件/批量）
  * [ ] 搜索历史记录
  * [ ] 下载历史记录

## Acceptance Criteria

* [ ] WebApp 提供图形化操作界面
* [ ] WebApp 支持搜索功能
* [ ] WebApp 支持字幕选择和下载
* [ ] WebApp 支持批量下载
* [ ] WebApp 支持搜索历史记录
* [ ] WebApp 支持下载历史记录

## Definition of Done

* WebApp 可正常运行，API 集成完成
* 界面美观，操作流畅
* 历史记录功能正常

## Technical Approach

### 项目结构

```
thunder-subtitle-web/
├── app/                      # Next.js App Router
│   ├── page.tsx             # 首页/搜索页
│   ├── layout.tsx           # 布局
│   └── results/
│       └── page.tsx         # 结果展示
├── components/              # React 组件
│   ├── SearchBox.tsx
│   ├── SubtitleList.tsx
│   ├── SubtitleItem.tsx
│   └── HistoryList.tsx
├── lib/                     # 共享逻辑
│   ├── api.ts              # API 调用（可复用 CLI 逻辑）
│   └── types.ts            # 类型定义
├── store/                   # 状态管理
│   └── history.ts          # 历史记录（localStorage）
└── package.json
```

### 核心功能实现

1. **搜索页面**: 输入框 + 搜索按钮
2. **结果展示**: 字幕列表，支持多选 checkbox
3. **下载**: 点击下载 / 批量下载
4. **历史记录**: localStorage 存储搜索和下载历史

## Out of Scope

* 用户系统/登录
* 多语言字幕处理
* 字幕格式转换
* 服务器端存储（使用 localStorage）

## Technical Notes

* API 已验证可用
* 考虑复用 thunder-subtitle-cli 的 api.ts 逻辑
