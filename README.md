# Thunder Subtitle

字幕搜索下载工具，支持 CLI 命令行和 WebApp 两种方式获取迅雷电鳎 API 字幕。

## 功能特性

- 字幕搜索下载（中文字幕过滤、时长匹配、多选/批量）
- Jellyfin 媒体库自动扫描（双字幕下载、断点续扫、增量刷新）
- 字幕质量审查（编码/时间轴/中文占比检测 + 百分制评分）
- WebApp 全功能 UI（搜索/扫描/审查/配置 + 移动端适配 + PWA）

## 快速开始

### pip install

```bash
pip install thunder-subtitle-srt
thunder-subtitle search "电影名称" --chinese-only
```

### Docker

```bash
docker pull ghcr.io/iamkings/thunder_subtitle_srt:latest

docker run -d \
  -p 3000:3000 \
  -e ADMIN_PASSWORD=your-password \
  -v /path/to/media:/media \
  -v /path/to/data:/root \
  ghcr.io/iamkings/thunder_subtitle_srt:latest
```

访问 http://localhost:3000

## 项目结构

```
thunder-subtitle-srt/
├── thunder-subtitle-py/     # CLI 工具 (Python)
├── thunder-subtitle-web/    # WebApp 前端 (Next.js)
├── thunder-subtitle-api/    # FastAPI 后端
├── thunder-subtitle-cli/    # CLI 工具 (TypeScript, 已归档)
├── README_DEPLOY.md         # Docker 详细部署指南
└── .trellis/                # Trellis 工作流配置
```

## 模块文档

| 模块 | 说明 | 文档 |
|------|------|------|
| **CLI (Python)** | 命令行搜索/扫描/审查/配置 | [README](./thunder-subtitle-py/README.md) |
| **WebApp** | Next.js 前端 UI | [README](./thunder-subtitle-web/README.md) |
| **API** | FastAPI 后端服务 | [README](./thunder-subtitle-api/README.md) |
| **部署** | Docker 构建、compose、验证 | [README_DEPLOY.md](./README_DEPLOY.md) |

## 技术栈

| 组件 | 技术 |
|------|------|
| CLI | Python 3.10+ / requests / argparse |
| Web 前端 | Next.js 16 / React 19 / TailwindCSS 4 / TypeScript |
| API 后端 | FastAPI / Pydantic / JWT / WebSocket |
| 部署 | Docker (Alpine) / Nginx / supervisord / GitHub Actions |
| 数据源 | 迅雷电鳎公开字幕 API |

## 许可证

MIT
