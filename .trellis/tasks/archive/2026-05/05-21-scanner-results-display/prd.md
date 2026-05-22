# 扫描结果详细展示：电影级进度 + 下载状态列表

## Goal

扫描完成后展示详细的电影级处理结果，替代当前仅一行 "Scan completed. Processed 7 movies." 的简陋状态。

## What I already know

### 现有数据

`process_scanned_movies` 返回 `list[ScanResult]`，每个元素包含：

```python
@dataclass
class ScanResult:
    movie_path: str     # 完整路径
    movie_name: str     # 电影名（目录名）
    status: str         # ScanStatus: downloaded/skipped/no_match/error
    reason: str         # 原因说明
    filename: str       # 下载的字幕文件名
    dry_state: str      # DryState 或空
```

### 当前问题

1. 后端拿了 `results` 只做 `len(results)` 计数，详细数据全丢弃
2. 前端 `findings` 数组永远为空，表格无数据
3. 扫描完成提示只有一行文字，用户不知道哪些成功了哪些失败了
4. WebSocket 只传进度百分比，不传电影级详情

### 理想用户体验

参考 Jellyfin/Emby 扫描器的设计：
- 扫描过程中显示正在处理的电影名
- 完成后展示结果列表：电影名 + 状态（已下载/跳过/无匹配/错误）+ 字幕文件名
- 顶部汇总：总数 / 下载成功 / 跳过 / 失败

## Requirements

### R1: 后端返回扫描结果列表

`_execute_scan` 将 `ScanResult` 列表存入 task 对象的 `results` 字段，通过 `GET /api/tasks/{id}` 返回给前端。

### R2: TaskResponse 扩展 results 字段

Pydantic 模型增加 `results: list[dict] | None` 字段，序列化 ScanResult 的核心字段。

### R3: 前端结果显示

扫描完成后 `findings` 表展示真实数据：
- 电影名（movie_name）
- 状态：已下载/跳过/无匹配/错误，带颜色标识
- 字幕文件名
- 原因说明

### R4: 汇总卡片

顶部 stats 卡片在扫描完成后更新：
- 文件总数 → 保留
- 缺失字幕 → 替换为「扫描结果」：成功数 / 失败数 / 跳过数

### R5: 渐进式结果推送（WebSocket）

每处理完一个电影，后端通过 WebSocket 推送该条 `ScanResult`（含 movie_name、status、filename、reason）。前端逐条追加到结果列表，用户实时看到进度。

完成后 WebSocket 发送 `status: "completed"` 消息，前端停止接收。

## Acceptance Criteria

* [ ] 扫描完成后前端展示详细结果列表（电影名 + 状态 + 文件名）
* [ ] 结果卡片汇总：下载成功 X / 跳过 X / 无匹配 X / 错误 X
* [ ] 扫描过程中 WebSocket 渐进推送每条结果，前端逐条展示
* [ ] 结果列表按状态排序（失败 > 错误 > 跳过 > 下载，失败项排最前）

## Out of Scope

* 结果持久化到数据库
* 历史扫描记录
* 扫描日志文件下载

## Open Questions

（无——需求已明确）
