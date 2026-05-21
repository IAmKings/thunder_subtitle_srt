# 统一扫描器库路径配置源，修复双重配置问题

## Goal

消除扫描器库路径的双重配置源（`MEDIA_PATHS` 环境变量 vs `~/.thunder-subtitle.json`），统一为单一数据源，修复前端扫描页路径展示、多路径扫描等问题。

## What I already know

### 当前架构问题

1. **双重配置源**：`Settings.media_paths`（env var）和 `Config.media_paths`（JSON 文件）独立存在，从不互相同步
2. **前端展示用 env var**：`GET /api/media/directories` → `Settings.media_paths_list`
3. **Web 端配置写入 JSON 文件**：`PUT /api/config` → `Config.save()` → `~/.thunder-subtitle.json`
4. **CLI 读写 JSON 文件**：`thunder-subtitle config --set media_paths` → `~/.thunder-subtitle.json`
5. **扫描回退用 env var**：`scan_service._execute_scan()` 无路径时 → `settings.media_paths_list`
6. **前端只扫第一个目录**：`handleScanNow()` 只取 `mediaDirs[0].path`
7. **env var 不检查目录存在**：`Settings.media_paths_list` 只 split 逗号，不过滤不存在的目录
8. **CLI 检查目录存在**：`Config.media_paths_list` 用 `os.path.isdir()` 过滤
9. **前端无路径管理 UI**：扫描页只能看不能改

### 相关文件

| 文件 | 角色 |
|---|---|
| `thunder-subtitle-api/app/config.py` | API Settings（env var 源） |
| `thunder-subtitle-api/app/api/media.py` | `GET /api/media/directories` |
| `thunder-subtitle-api/app/api/config.py` | `GET/PUT /api/config` |
| `thunder-subtitle-api/app/services/config_service.py` | 读写 `~/.thunder-subtitle.json` |
| `thunder-subtitle-api/app/services/scan_service.py` | 扫描逻辑 + 路径回退 |
| `thunder-subtitle-py/src/config.py` | CLI Config 数据类 |
| `thunder-subtitle-web/src/app/scanner/page.tsx` | 前端扫描页 |

## Assumptions

* Docker 部署时 `MEDIA_PATHS` 应作为初始值/回退值，最终路径以 JSON 文件为准
* 前端应以 JSON 文件中的路径为准（与 CLI 一致）

## Requirements

### R1: 统一配置源

单一路径来源。所有路径查询（前端展示、扫描回退）统一从 `~/.thunder-subtitle.json` 读取。

### R2: 前端路径管理（扫描页 + 设置页双向同步）

扫描页和设置页都能编辑媒体库路径，共享同一数据源，确保用户从哪改都行。

### R3: 多路径扫描 + 关键词过滤

前端 `Scan Now` 扫描全部配置路径（非仅第一条）。提供可选的关键词过滤输入框（空格/逗号分隔多关键词），映射到 CLI 的 `--filter` 参数。留空则扫描全部文件夹。

### R4: 路径可用性检查

API 返回路径时过滤不存在的目录（与 CLI 行为一致）。

### R5: env var 优先，JSON 作持久化回退

`MEDIA_PATHS` 环境变量存在时始终优先使用（标准 12-factor 模式）。无 env var 时回退到 `~/.thunder-subtitle.json` 的值。Web 端编辑路径写入 JSON，Docker 重启后 env var 重新覆盖。

## Acceptance Criteria

* [ ] `GET /api/media/directories` 返回 JSON 文件中配置的路径（存在性过滤后）
* [ ] 扫描页支持编辑媒体路径
* [ ] 扫描页 `Scan Now` 扫描全部路径，支持关键词过滤输入（空格/逗号分隔多关键词）
* [ ] 过滤留空 = 扫描全部文件夹
* [ ] `MEDIA_PATHS` env var 存在时始终优先，无 env var 时回退 JSON 值
* [ ] CLI `config --set media_paths` 和 Web `PUT /api/config` 修改后前端即时可见

## Technical Approach

**Decision**: `Config.media_paths` 读取逻辑改为 env var 优先 + JSON 回退。`Config.load()` 检查 `os.environ.get("MEDIA_PATHS")`，有则用 env var，无则读 JSON。`ScanService` 统一走 `Config.load().media_paths_list`。

具体变更：
1. `Config.load()` / `Config.media_paths_list` 增加 env var 优先逻辑
2. 删除 `Settings.media_paths` 字段（不再需要独立 env var 路径）
3. `ScanService.list_media_directories()` 改为读 `Config.load().media_paths_list`
4. `ScanService._execute_scan/review/dump()` 回退路径改为 `Config.load().media_paths_list`
5. 前端扫描页 + 设置页添加路径管理入口
6. `handleScanNow()` 传全部路径 + filter 关键词

## Out of Scope

* 扫描结果表数据流修复（独立任务）
* WebSocket 数据推送优化
* `config_path` 死代码清理（独立小任务）

## Open Questions

（无——需求已明确）
