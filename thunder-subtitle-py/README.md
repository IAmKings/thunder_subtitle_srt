# Thunder Subtitle

迅雷字幕 CLI 工具 — 搜索、下载中文字幕，支持 Jellyfin 媒体库自动扫描。

## 安装

```bash
pip install thunder-subtitle
```

或开发模式安装：

```bash
git clone <repo>
cd thunder-subtitle-py
pip install -e ".[dev]"
```

## 使用方法

### 搜索字幕

```bash
# 基本搜索
thunder-subtitle search "Movie Name"

# 仅中文字幕
thunder-subtitle search "Movie Name" --chinese-only

# 按视频时长筛选 (过滤时长不匹配的字幕)
thunder-subtitle search "Movie Name" --max-duration 1h30m

# 下载全部结果
thunder-subtitle search "Movie Name" --all -o ./subs/

# 按序号下载
thunder-subtitle search "Movie Name" --index 1,3,5
```

### 全量下载（dump）

```bash
# 直接搜索下载
thunder-subtitle dump "Movie Name"

# 从目录读取 movie.nfo 自动获取时长
thunder-subtitle dump --dir /path/to/movie
```

### Jellyfin 目录扫描

扫描演员/电影目录结构，自动搜索并下载缺失的字幕。支持断点续扫、并行下载。

```bash
# 基础扫描
thunder-subtitle scan /path/to/jellyfin/media

# 预览模式（不实际下载）
thunder-subtitle scan /path/to/jellyfin/media --dry-run

# 并行处理（4线程）
thunder-subtitle scan /path/to/jellyfin/media --parallel 4

# 过滤特定电影
thunder-subtitle scan /path/to/jellyfin/media --filter "电影名"

# 断点续扫
thunder-subtitle scan /path/to/jellyfin/media --resume

# 仅处理 N 天前发布的电影
thunder-subtitle scan /path/to/jellyfin/media --min-age 7

# 全量下载模式（每部电影下载所有匹配字幕）
thunder-subtitle scan /path/to/jellyfin/media --dump
```

### 字幕审查

审查已下载字幕质量，给出百分制评分。

```bash
# 审查目录
thunder-subtitle review /path/to/jellyfin/media

# 标记审查状态
thunder-subtitle review --mark "电影名"            # 标记通过
thunder-subtitle review --mark-fail "电影名"       # 标记失败（不再尝试下载）
thunder-subtitle review --unmark "电影名"          # 取消标记
thunder-subtitle review --mark-all                 # 全部标记
```

### 配置管理

```bash
# 查看配置
thunder-subtitle config

# 设置配置项
thunder-subtitle config --set media_paths /path1,/path2
thunder-subtitle config --set rate_limit 5
thunder-subtitle config --set preferred_groups "KitaujiSub,DMG"

# 重置为默认
thunder-subtitle config --reset
```

配置项：

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `output_dir` | str | `""` | 默认下载目录 |
| `timeout` | int | `30` | API 超时（秒） |
| `rate_limit` | int | `3` | 扫描模式查询间隔（秒） |
| `retry_count` | int | `3` | 下载失败重试次数 |
| `retry_delay` | int | `2` | 重试基础间隔（秒，指数退避） |
| `preferred_groups` | str | `""` | 偏好字幕组（逗号分隔） |
| `media_paths` | str | `""` | 默认媒体库路径（逗号分隔） |

### 直接下载

```bash
thunder-subtitle download "https://..." "filename.srt"
```

## Jellyfin 目录结构

```
媒体库/
├── 演员A/
│   ├── 电影1/
│   │   ├── movie.nfo
│   │   └── 视频文件
│   └── 电影2/
│       └── movie.nfo
└── 演员B/
    └── 电影3/
        └── movie.nfo
```

## 开发

```bash
pip install -e ".[dev]"    # 安装开发依赖
pytest tests/ -v           # 运行测试（126 用例）
ruff check .               # 代码检查
```

## CI/CD

- **CI**：push/PR 时自动运行 ruff lint + 编译检查 + pytest
- **发布**：推送 `v*` tag 自动构建 wheel 并发布到 PyPI

## 要求

- Python >= 3.10
- `requests`
