# Thunder Subtitle

字幕搜索下载工具，支持 CLI（TypeScript / Python）和 WebApp 三种方式获取迅雷电鳎 API 字幕。

## 项目结构

```
thunder-subtitle-srt/
├── thunder-subtitle-cli/    # CLI 工具 (TypeScript, 交互式 TUI)
├── thunder-subtitle-py/     # CLI 工具 (Python, 纯命令行参数)
├── thunder-subtitle-web/    # WebApp
├── .trellis/               # Trellis 工作流配置
└── AGENTS.md               # AI 代理说明
```

## 功能特性

- [x] 字幕搜索（通过迅雷电鳎 API）
- [x] 中文字幕过滤（`--chinese-only`）
- [x] 中文优先模式（`--chinese-first`，无中文时降级下载其他语言）
- [x] 智能中文检测（languages 字段 + 文件名关键字 zh/CN/Chinese/中文）
- [x] 视频时长匹配筛选（`--max-duration`，最接近但不超过）
- [x] 单选/多选字幕（TS 交互式 / Python 参数式）
- [x] 字幕下载（单文件/批量）
- [x] 下载文件名规则：`{搜索名}{.zh}.{ext}`，中文字幕自动加 `.zh` 标识

## 快速开始

### CLI 工具 (TypeScript)

```bash
cd thunder-subtitle-cli
pnpm install

# 搜索字幕
pnpm search "电影名称"

# 仅中文字幕
pnpm search "电影名称" --chinese-only

# 中文优先（有中文下中文，无中文降级下载其他语言）
pnpm search "电影名称" --chinese-first

# 多选批量下载
pnpm search "电影名称" --multi-select

# 按视频时长筛选（支持 h/m/s 组合）
pnpm search "电影名称" --max-duration 1h30m
pnpm search "电影名称" -d 90m
```

### CLI 工具 (Python)

```bash
cd thunder-subtitle-py
pip install -r requirements.txt

# 搜索并显示结果
python3 cli.py search "电影名称"

# 按序号下载（1-based，支持逗号/范围）
python3 cli.py search "电影名称" -i 1
python3 cli.py search "电影名称" -i 1,3,5
python3 cli.py search "电影名称" -i 1-3

# 下载全部
python3 cli.py search "电影名称" --all

# 组合筛选
python3 cli.py search "电影名称" -c -d 2h -f --all

# 限制显示条数
python3 cli.py search "电影名称" --limit 10

# 直接下载指定 URL
python3 cli.py download "url" "filename" -o ~/subtitles
```

### WebApp

```bash
cd thunder-subtitle-web
pnpm install
pnpm dev
```

访问 http://localhost:3000

## 命令参数速查

### `search` 命令

| 参数 | 简写 | 说明 |
|------|------|------|
| `--chinese-only` | `-c` | 仅显示中文字幕 |
| `--chinese-first` | `-f` | 中文优先，无中文时降级到其他语言 |
| `--max-duration` | `-d` | 最大视频时长筛选（如 `1h30m`、`90m`） |
| `--output` | `-o` | 下载输出目录 |
| `--multi-select` | `-m` | 多选模式（仅 TS 版） |
| `--index` | `-i` | 下载指定序号（仅 Python 版，如 `1,3,5`） |
| `--all` | `-a` | 下载全部结果（仅 Python 版） |
| `--limit` | | 限制显示前 N 条（仅 Python 版） |

### 文件名规则

下载的字幕文件按以下规则命名：

```
{搜索关键词}{.zh}.{扩展名}
```

| 场景 | 示例 |
|------|------|
| 中文字幕 | `流浪地球.zh.srt` |
| 非中文字幕 | `inception.srt` |
| `-f` 降级非中文 | `stranger things.srt`（不误导加 .zh） |

## 技术栈

| 组件 | TS CLI | Python CLI | WebApp |
|------|--------|------------|--------|
| 语言 | TypeScript | Python 3.10+ | TypeScript |
| 框架 | Node.js | argparse | Next.js 15 + React |
| UI | Inquirer (TUI) | 纯命令行 | TailwindCSS |
| HTTP | axios | requests | fetch + API Route |

## API

项目使用迅雷电鳎公开字幕 API：

- Endpoint: `https://api-shoulei-ssl.xunlei.com/oracle/subtitle?name={name}`
- 返回格式: JSON with `code:0` and `data[]` array

WebApp 通过 `/api/subtitle` 代理请求以解决 CORS 问题。

## 许可证

MIT
