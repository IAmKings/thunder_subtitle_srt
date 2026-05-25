# Thunder Subtitle Web

迅雷字幕 WebApp 前端，基于 Next.js 16 + React 19 + TailwindCSS 4 + TypeScript。

## 功能页面

| 页面 | 功能 |
|------|------|
| Search | 字幕搜索、中英文过滤、多维度排序、下载 |
| Scanner | 媒体库扫描（扫描/预览/暴力下载/暴力刷新）、进度条、结果表格 |
| Verification | 字幕审查（评分/预览/标记/删除/重命名）、Pin 固定 |
| Settings | 系统配置、密码修改、字幕源管理 |

## 快速开始

```bash
cd thunder-subtitle-web
pnpm install
pnpm dev
```

访问 http://localhost:3000

> 需要同时启动 FastAPI 后端，详见 [thunder-subtitle-api](../thunder-subtitle-api/README.md)

## Docker 部署

```bash
docker pull ghcr.io/iamkings/thunder_subtitle_srt:latest

docker run -d \
  -p 3000:3000 \
  -e ADMIN_PASSWORD=your-password \
  -v /path/to/media:/media \
  -v /path/to/data:/root \
  ghcr.io/iamkings/thunder_subtitle_srt:latest
```

详细部署文档：[README_DEPLOY.md](../README_DEPLOY.md)

## 架构

```
Nginx :3000 (统一入口)
  ├── /api/*  + /ws/* → FastAPI :8000
  └── /* → Next.js :3001
```

单端口访问，Nginx 反代自动路由。

## 开发

```bash
pnpm dev          # 开发服务器
pnpm build        # 生产构建
pnpm lint         # ESLint
npx tsc --noEmit  # 类型检查
```

### 移动端适配

全响应式布局：移动端底部 TabBar 导航（Search/Scanner/Verification/Settings），桌面端保持侧边栏。所有页面适配小屏（表格→卡片、左右分栏→上下堆叠）。

### PWA

支持 PWA 可安装（manifest.json + service worker + `skipWaiting` 强制更新），移动端浏览器可"添加到主屏幕"。

### i18n

中英文双语支持，通过 TopBar 语言切换按钮切换。

## 技术栈

TypeScript / Next.js 16 / React 19 / TailwindCSS 4 / lucide-react / PWA
