# Thunder Subtitle

字幕搜索下载工具，支持 CLI 和 WebApp 两种方式获取迅雷电鳎 API 中文字幕。

## 项目结构

```
thunder-subtitle-srt/
├── thunder-subtitle-cli/    # CLI 工具
├── thunder-subtitle-web/    # WebApp
├── .trellis/               # Trellis 工作流配置
└── AGENTS.md               # AI 代理说明
```

## 功能特性

- [x] 字幕搜索（通过迅雷电鳎 API）
- [x] 中文字幕过滤
- [x] 单选/多选字幕
- [x] 字幕下载（单文件/批量）
- [x] 搜索历史记录
- [x] 下载历史记录

## 快速开始

### CLI 工具

```bash
cd thunder-subtitle-cli
pnpm install

# 搜索字幕
pnpm search "电影名称"

# 仅中文字幕
pnpm search "电影名称" --chinese-only

# 多选批量下载
pnpm search "电影名称" --multi-select
```

### WebApp

```bash
cd thunder-subtitle-web
pnpm install
pnpm dev
```

访问 http://localhost:3000

## 技术栈

| 组件 | CLI | WebApp |
|------|-----|--------|
| 框架 | Node.js + TypeScript | Next.js 15 + React |
| UI | Inquirer (TUI) | TailwindCSS |
| API | axios | fetch + API Route |
| 状态 | - | localStorage |

## API

项目使用迅雷电鳎公开字幕 API：

- Endpoint: `https://api-shoulei-ssl.xunlei.com/oracle/subtitle?name={name}`
- 返回格式: JSON with `code:0` and `data[]` array

WebApp 通过 `/api/subtitle` 代理请求以解决 CORS 问题。

## 开发

```bash
# 安装依赖
pnpm install

# 类型检查
pnpm type-check

# 构建
pnpm build
```

## 许可证

MIT
