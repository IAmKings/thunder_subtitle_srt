# 扫描器 Web UI 增加 scan/dry-run/dump/dump-force 四种扫描模式选择

## Goal

前端扫描页增加扫描模式选择，对应 CLI 四种模式，用户可在 Web 端自由切换。

## What I already know

### CLI 四种模式

| 模式 | CLI 命令 | 行为 |
|---|---|---|
| `scan` | `scan` | 扫描+下载最佳字幕（主力+备选） |
| `dry-run` | `scan --dry-run` | 只扫描不下载 |
| `dump` | `scan --dump` | 暴力下载全部字幕 |
| `dump --force` | `scan --dump --force` | 暴力下载+刷新已处理电影 |

### 后端现状

`scan_service.py` 已实现 `_execute_scan` 和 `_execute_dump`，但缺少 `dry_run` 和 `force` 参数传递：

```python
# scan 模式
process_scanned_movies(path, dry_run=False, dump_mode=False)

# dump 模式
process_scanned_movies(movie_path, dry_run=False, dump_mode=True)
```

### 当前前端

扫描页只有一个「Scan Now」按钮，固定走 scan 模式。无模式选择 UI。

### 映射关系

| 模式 | process_scanned_movies 参数 |
|---|---|
| `scan` | `dry_run=False, dump_mode=False` |
| `dry_run` | `dry_run=True` |
| `dump` | `dry_run=False, dump_mode=True` |
| `dump_force` | `dry_run=False, dump_mode=True, force=True` |

## Requirements

### R1: 后端支持 mode 参数

`POST /api/tasks` 接受 `params.mode` 字段（`"scan" | "dry_run" | "dump" | "dump_force"`），默认为 `"scan"`。

### R2: `_execute_scan` 根据 mode 调用不同参数

### R3: 前端扫描模式分段控件

「Scan Now」按钮左侧增加分段控件（与搜索页 All/Chinese Only 同风格），四种模式：

| 模式 | 中文 | 英文 |
|---|---|---|
| `scan` | 扫描下载 | Scan |
| `dry_run` | 仅预览 | Preview |
| `dump` | 暴力下载 | Dump |
| `dump_force` | 暴力刷新 | Force Dump |

点击「Scan Now」即按当前选中模式执行。

## Acceptance Criteria

* [ ] 分段控件显示四种模式，默认选中「扫描下载」
* [ ] 选择「扫描下载」→ 实际下载字幕（scan）
* [ ] 选择「仅预览」→ 只扫描不下载（dry-run）
* [ ] 选择「暴力下载」→ 全部字幕下载（dump）
* [ ] 选择「暴力刷新」→ 强制刷新下载（dump --force）
* [ ] 扫描中分段控件 disabled，模式不可切换

## Out of Scope

* dump 的 `reset_fail` 参数暴露
* min_age / parallel 等高级参数

## Open Questions

（无——需求已明确）
