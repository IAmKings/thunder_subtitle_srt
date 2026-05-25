# Thunder Subtitle CLI (Python)

迅雷字幕搜索下载命令行工具，支持 Jellyfin 媒体库自动扫描、字幕质量审查、配置文件管理。

## 安装

```bash
pip install thunder-subtitle-srt
```

## 快速开始

```bash
thunder-subtitle search "电影名称" --chinese-only
thunder-subtitle scan /path/to/media --dry-run
thunder-subtitle review /path/to/media
thunder-subtitle config --set media_paths /media/movies
```

## 命令参考

### `search` — 搜索字幕

| 参数 | 简写 | 说明 |
|------|------|------|
| `--chinese-only` | `-c` | 仅显示中文字幕 |
| `--chinese-first` | `-f` | 中文优先，无中文时降级到其他语言 |
| `--max-duration` | `-d` | 最大视频时长筛选（如 `1h30m`） |
| `--output` | `-o` | 下载输出目录 |
| `--index` | `-i` | 下载指定序号（`1,3,5` 或 `1-3`） |
| `--all` | `-a` | 下载全部结果 |
| `--limit` | | 限制显示前 N 条 |

### `scan` — 媒体库扫描

| 参数 | 说明 |
|------|------|
| `directory` | 扫描根目录（演员/电影 结构） |
| `--dry-run` | 预览模式，不实际下载 |
| `--filter` | 仅处理匹配电影（可重复） |
| `--resume` | 断点续扫 |
| `--log` | 保存扫描日志 |
| `--min-age` | 仅处理发布 N 天后的电影 |
| `--dump` | 暴力模式：全量下载 + 内容去重 |
| `--force` | 强制刷新，读取 `.rejected` 增量下载 |
| `--reset-fail` | 清除 mark-fail + 已拒绝指纹 |
| `-p N` | 并行 worker 数（默认 1） |

### `review` — 字幕审查

| 参数 | 说明 |
|------|------|
| `directory` | 审查目录 |
| `--filter` | 仅审查匹配电影（可重复） |
| `--log` | 保存审查报告 |
| `--mark` | 标记为已审查通过 |
| `--mark-fail` | 标记为审查失败（合并 `.dumped` → `.rejected`） |
| `--unmark` | 取消审查标记 |

审查项：编码检测、文件大小、SRT 解析（序号/重叠/时长）、中文占比。百分制评分。

### `dump` — 全量下载

| 参数 | 简写 | 说明 |
|------|------|------|
| `name` | | 搜索的电影名 |
| `--output` | `-o` | 输出目录 |
| `--max-duration` | `-d` | 视频时长筛选 |
| `--chinese-only` | `-c` | 仅中文字幕 |
| `--chinese-first` | `-f` | 中文优先 |
| `--dir` | | 直接指定电影目录（读 NFO 获取片名+时长） |

### `config` — 配置管理

| 参数 | 说明 |
|------|------|
| （无参数） | 查看当前配置 |
| `--set K V` | 设置配置项 |
| `--reset` | 恢复默认 |

配置文件 `~/.thunder-subtitle.json`，环境变量 `THUNDER_SUBTITLE_CONFIG` 可覆盖路径。

## 扫描器工作原理

### 目录结构

```
/path/to/media/
├── 演员/
│   └── 电影/
│       ├── movie.nfo          # 元数据（必需）
│       └── 电影.zh.srt        # 已有字幕（跳过）
```

### 跳过条件

- NFO 含"中文字幕"标签
- `{电影名}.zh.{ext}` 已存在
- movie.nfo 无 `durationinseconds`
- 发布天数 < `--min-age`
- mark-fail + 非 force 模式

### 下载策略

每次下载两个字幕：主力（API 第一条）+ 备选（按优先级算法选择），文件命名为 `{电影名}.zh.{ext}` 和 `{电影名}-alt.zh.{ext}`。

### dry_run 状态

`scan --dry-run` 每部电影输出状态标签：

| 状态 | 含义 |
|------|------|
| `need_download` | 无字幕，需下载 |
| `need_review` | 有字幕但未审查 |
| `reviewed_ok` | 审查通过 |
| `reviewed_fail` | 审查失败，无新字幕 |
| `reviewed_fail_new_subs` | 审查失败但有新 dump 字幕，**待重审** |
| `skipped` | 其他原因跳过 |

### 增量刷新

```bash
thunder-subtitle scan /media --dump                    # 1. 全量下载
thunder-subtitle review /media --mark-fail "电影"       # 2. 标记失败（合并指纹 → .rejected）
thunder-subtitle scan /media --dump --force             # 3. 增量刷新（跳过已拒绝，仅下载新字幕）
```

> 验证页仅显示 `not_reviewed` 和存在新 dump 字幕的 `fail` 电影，纯 fail 无新字幕的电影不再显示。

### 文件名规则

中文字幕自动加 `.zh` 标识：`流浪地球.zh.srt`。非中文不加：`inception.srt`。

## 开发

```bash
cd thunder-subtitle-py
pip install -e ".[dev]"
pytest
```

## 技术栈

Python 3.10+ / requests / argparse / dataclasses
