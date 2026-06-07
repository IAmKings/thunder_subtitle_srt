# 定时任务调度 — 自动扫描/下载字幕

## 设计决策

| 决策 | 选择 |
|------|------|
| 调度粒度 | Cron 表达式 |
| 支持模式 | 全部 4 种（扫描/仅预览/暴力下载/暴力刷新） |
| 目录粒度 | 按目录独立配置 |
| 并发策略 | 上一个未完成则跳过 |
| UI 位置 | 扫描器页面 + 库信息卡片 |

## 架构

```
┌─────────────────────────────────────────┐
│ Settings → 每个目录的 cron + mode 配置    │
│ /api/tasks/scheduled (CRUD)             │
│ ScanService._scheduler (asyncio loop)   │
└─────────────────────────────────────────┘
                    │
    cron 触发 → create_task → start_task → WebSocket 通知
```

### 调度器

- API 启动时读取所有目录的定时配置
- 用 `asyncio` 事件循环 + cron 解析驱动
- 每个目录一个 `asyncio.Task`，休眠到下次触发时间
- 触发时检查：该目录的上次任务是否还在 running → 是则跳过
- 任务完成后更新目录状态（上次执行时间、结果摘要）

### 数据模型

```python
class ScheduledTask(BaseModel):
    directory_path: str       # 媒体目录路径
    enabled: bool = False     # 是否启用
    cron: str = "0 2 * * *"  # cron 表达式
    mode: str = "scan"        # scan / dry_run / dump / dump_force
    last_run: datetime | None # 上次执行时间
    last_status: str | None   # 上次执行结果
```

### API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tasks/scheduled` | 列出所有目录的定时配置 |
| PUT | `/api/tasks/scheduled/{path}` | 保存单个目录的定时配置 |
| DELETE | `/api/tasks/scheduled/{path}` | 删除定时配置 |

## 前端

### 扫描器页面 — 库信息卡片

每个目录显示：
- 目录名 + 路径
- 电影总数
- **待审核数**（review_status = not_reviewed 的字幕文件数）
- 定时任务状态（已启用/已禁用 + cron + 模式）
- 上次执行时间 + 结果
- 设置按钮 → 弹窗配置 cron + 模式

### 定时任务配置弹窗

- 开关：启用/禁用
- Cron 表达式输入框 + 快捷预设（每小时/每天 3 点/每周一 3 点）
- 模式下拉：扫描 / 仅预览 / 暴力下载 / 暴力刷新
- 预览下次执行时间

### 待审核数计算

`listMovies` API 已有 `sub_files` 和 `review_status` 字段。新增 `pending_review_count: int` 字段统计该目录下所有电影中 `review_status != "ok"` 的字幕文件总数。

## 改动范围

| 层 | 文件 | 改动 |
|------|------|------|
| API schema | `schemas.py` | 新增 `ScheduledTask`、`MediaDirectory` 加 `pending_review_count` |
| API service | `scan_service.py` | 新增调度器逻辑、`pending_review_count` 统计 |
| API route | `tasks.py` | 新增 CRUD 端点 + 启动/停止调度 |
| CLI | `reviewer/__init__.py` | `list_movies` 统计 `pending_review_count` |
| Frontend type | `types.ts` | 新增 `ScheduledTask` 类型、`MediaDirectory` 加字段 |
| Frontend i18n | `i18n.ts` | 新增定时任务相关翻译 |
| Frontend page | `scanner/page.tsx` | 库信息卡片重构 + 定时配置弹窗 |

## Acceptance Criteria

- [ ] Settings 中每个目录可配置 cron + 扫描模式
- [ ] 定时触发后自动创建扫描任务，WebSocket 推送进度
- [ ] 上一次未完成时跳过当次触发
- [ ] 库信息卡片显示待审核数量
- [ ] 快捷 cron 预设可用（每小时/每天/每周）
- [ ] API 重启后调度器自动恢复
- [ ] `ruff check` + `tsc --noEmit` 零错误

## Out of Scope

- 全局定时任务（仅按目录）
- 任务执行历史记录（仅显示上次）
- 邮件/通知提醒
- 分布式调度（多实例）
