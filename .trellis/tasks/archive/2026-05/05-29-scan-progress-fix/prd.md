# 修复扫描进度条卡死问题

## 问题诊断

### 根因链

```
暴力刷新 (dump_force) / 暴力下载 (dump)
  → 一部电影下载 N 个字幕（API 返回多少下多少，这是业务设计，不是 bug）
    → 每个字幕下载：timeout=60s，重试 3 次（2s→4s→8s 指数退避）
      → 单字幕最坏耗时：186 秒（3次 × 60s timeout + 回退休眠）
        → 20 个字幕 × 186s = 62 分钟/部电影
          → asyncio.to_thread 完全阻塞 scan_service.py:221
            → 后端不发任何 WebSocket 进度消息
              → WebSocket 30s 无消息自动断开 (ws/manager.py:76)
                → 前端进度条彻底卡死
```

**核心矛盾**：暴力模式下大批量下载是产品的核心竞争力（下载全部字幕 → 审查筛选），不能砍。问题不是"下载太多"，而是"下载期间没有任何进度反馈"。

### 三个叠加因素

| # | 问题 | 位置 | 严重度 |
|---|------|------|--------|
| 1 | `_process_one_movie` 内部零进度推送，dump 模式下载 N 个字幕全部阻塞在一个 `asyncio.to_thread` 调用中 | `scan_service.py:221`, `_processor.py:266-325` | **致命** |
| 2 | WebSocket 30s 无消息超时 + 前端无心跳 ping | `ws/manager.py:76`, `api.ts:359-407` | 高 |
| 3 | 预扫描阶段（文件遍历）也无进度推送，大型库开局就"卡死" | `scan_service.py:180-186` | 中 |

### 正常模式 vs 暴力模式耗时对比

| 模式 | 单部电影下载数 | 好网络(单部) | 差网络(单部) |
|------|:---:|------|------|
| 正常扫描 (scan) | 1~2 | 5~15s | ~7min |
| 暴力下载 (dump) | N (API返回全部) | 1~5min | ~30min |
| 暴力刷新 (dump_force) | N (API返回全部) | 1~5min | ~62min |

---

## 修复方案

### 方案 1（治本）：细粒度进度回调

**核心思路**：给 `_process_one_movie` 注入进度回调，在下载循环中每完成一个字幕就通过 WebSocket 推送进度更新。用户能看到 "正在下载：阿甘正传 (3/18)"，而不是进度条卡死。

**改动点**：

| 文件 | 改动 | 说明 |
|------|------|------|
| `thunder-subtitle-py/src/scanner/_processor.py` | 改 | `_process_one_movie` 新增 `progress_callback` 参数，`_dump_all_subtitles` 中每下载一个字幕调用一次回调 |
| `thunder-subtitle-py/src/scanner/_parallel.py` | 改 | `process_scanned_movies` 和 `_do_scan_loop` 传递进度回调 |
| `thunder-subtitle-api/app/services/scan_service.py` | 改 | `_execute_scan` 传入回调函数，通过 `ws_manager.broadcast` 发送颗粒度进度 |

**进度消息格式**（新增字段）：

```json
{
  "type": "task_progress",
  "task_id": "...",
  "progress": 45.5,
  "total": 100,
  "processed": 45,
  "current_movie": "阿甘正传 (1994)",
  "current_step": "downloading",
  "download_progress": "3/18"
}
```

**关键逻辑**：回调在 `asyncio.to_thread` 的线程内被调用，但 WebSocket broadcast 需要在事件循环中执行。解决方式：
- 线程内将进度事件放入 `asyncio.Queue`
- 事件循环侧有一个 `asyncio.Task` 消费队列并 broadcast

### 方案 2（治标）：WebSocket 保活 + 超时拉长

**改动点**：

| 文件 | 改动 | 说明 |
|------|------|------|
| `thunder-subtitle-api/app/ws/manager.py` | 改 | WebSocket 接收超时从 30s → 300s；服务端每 20s 发一次 ping |
| `thunder-subtitle-web/src/lib/api.ts` | 改 | `ProgressWebSocket` 每 15s 发送 ping 消息 |
| `nginx.conf` | 改 | `/ws/` location 新增 `proxy_read_timeout 300s` |

### 方案 3（体验优化）：预扫描进度提示

**改动点**：

| 文件 | 改动 | 说明 |
|------|------|------|
| `thunder-subtitle-api/app/services/scan_service.py` | 改 | 预扫描阶段发送 "正在扫描目录..." 进度消息 |

---

## 实施优先级

| 优先级 | 方案 | 工作量 | 效果 |
|:---:|------|:---:|------|
| **P0** | 方案 2 — WebSocket 保活 | 小（3 个文件，~30 行） | 阻止断开，但不解决"无更新" |
| **P0** | 方案 3 — 预扫描提示 | 小（1 个文件，~5 行） | 解决开局卡死 |
| **P1** | 方案 1 — 细粒度进度回调 | 中（3 个文件，~80 行） | **根本解决**：暴力模式下用户能看到每部电影的下载进度 |

**建议**：三个方案全部实施，优先级按 P0 → P1 顺序。

---

## Acceptance Criteria

- [ ] 暴力刷新/暴力下载模式下，进度条持续更新（不会卡在同一百分比超过 30 秒）
- [ ] WebSocket 在扫描全过程中保持连接（不掉线）
- [ ] 预扫描阶段能看到 "正在扫描目录..." 提示
- [ ] 进度消息显示当前处理的电影名和步骤（搜索中/下载中）
- [ ] dump 模式下能看到当前下载进度（如 "3/18"）
- [ ] 正常扫描模式不受影响
- `tsc --noEmit` 零错误 / `ruff check` 全绿

## Out of Scope

- 并行扫描架构重构（如 asyncio 并发下载）
- API 结果缓存
- 增量扫描
- 限制 dump 模式下载数量（暴力全量下载是产品特性，配合审查功能使用）
