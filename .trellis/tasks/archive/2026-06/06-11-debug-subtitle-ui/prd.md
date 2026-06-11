# brainstorm: 审核页字幕DEBUG按钮一键诊断

## Goal

将 CLI `review --debug <subtitle_path>` 的完整诊断功能集成到审核页面 UI：配置文件加开关，开启后在字幕列表每个 item 显示 debug 按钮，点击后弹出完整诊断结果（含复制功能）。

## Requirements

* [ ] 配置文件增加 `debug_subtitle_enabled: bool` 开关（默认 false）
* [ ] 开关打开时，审核页面 `VerificationSubtitleList` 每项显示 debug 按钮
* [ ] 开关关闭时，debug 按钮不显示
* [ ] 点击 debug 按钮调用新 API `GET /api/review/subtitle/debug?path=&file_name=&base_dir=&duration_seconds=`
* [ ] API 返回 CLI `--debug` 同款完整诊断数据（文件信息 + SRT 解析统计 + 逐条扣分详情 + AI 标记 + 文件诊断 + 片长匹配扫描日志）
* [ ] 弹出框以分区折叠面板展示（5 个 section：文件信息 / SRT解析 / 扣分明细 / AI标记 / 片长匹配），默认全部展开
* [ ] 弹出框含复制功能（一键复制全部诊断文本）
* [ ] 点击 Modal 外部或关闭按钮可关闭
* [ ] 路径变动/文件不存在时直接报错提示
* [ ] 按钮防抖处理，避免快速连续点击发起多个请求

## Acceptance Criteria

* [ ] ruff check + tsc 零错误
* [ ] 设置页 debug 开关可切换，状态持久化到 `~/.thunder-subtitle.json`
* [ ] 开关关闭时字幕列表无 debug 按钮
* [ ] 开关打开时每个字幕 item 右侧显示 debug 按钮
* [ ] 点击 debug 按钮发起 API 请求，loading 状态可见
* [ ] 弹出 Modal 展示 5 个可折叠诊断区块，默认全部展开
* [ ] Modal 含"复制诊断报告"按钮，点击后复制全部文本到剪贴板
* [ ] 文件不存在时弹错误提示
* [ ] 快速连续点击时只发起最后一次请求（防抖 500ms）
* [ ] 点击 Modal 外部或关闭按钮可关闭

## Technical Approach

### 新增/修改文件清单

| 层 | 文件 | 改动 |
|----|------|------|
| CLI | `thunder-subtitle-py/src/config.py` | 添加 `debug_subtitle_enabled: bool = False` |
| API schema | `thunder-subtitle-api/app/models/schemas.py` | `AppConfig`/`AppConfigUpdate` 加 `debug_subtitle_enabled`<br>新增 `DebugReviewResponse` schema |
| API service | `thunder-subtitle-api/app/services/review_service.py` | 新增 `debug_subtitle_file()` 方法 |
| API endpoint | `thunder-subtitle-api/app/api/review.py` | 新增 `GET /api/review/subtitle/debug` |
| Config service | `thunder-subtitle-api/app/services/config_service.py` | `_to_app_config` 映射新字段 |
| Reviewer | `thunder-subtitle-py/src/reviewer/__init__.py` | 新增 `debug_review_subtitle()` 函数，整合 debug 逻辑 |
| Reviewer | `thunder-subtitle-py/src/reviewer/_srt.py` | 确保 debug=True 参数链可用（已有） |
| Frontend types | `thunder-subtitle-web/src/lib/types.ts` | `AppConfig` 加 `debug_subtitle_enabled`<br>新增 `DebugReviewResult` 接口 |
| Frontend API | `thunder-subtitle-web/src/lib/api.ts` | 新增 `debugSubtitleFile()` 方法 |
| Frontend list | `thunder-subtitle-web/src/components/VerificationSubtitleList.tsx` | 每个 item 加 debug 按钮（条件渲染） |
| Frontend modal | `thunder-subtitle-web/src/components/DebugModal.tsx` | **新建** — 折叠面板 + 复制功能的调试结果弹窗 |
| Frontend page | `thunder-subtitle-web/src/app/verification/page.tsx` | 集成 DebugModal，管理 debug 状态 |
| Settings | `thunder-subtitle-web/src/app/settings/page.tsx` | 加 debug 开关 UI 控件 |

### debug API 返回数据结构 (DebugReviewResponse)

```python
class DebugReviewResponse(BaseModel):
    # 基础信息
    file_path: str
    file_name: str
    score: int
    status: str  # ok / warn / fail
    encoding: str
    size_bytes: int
    cn_ratio: float

    # 常规审查字段
    deductions: list[str]
    checks: list[str]
    ai_flags: list[str]
    entry_count: int
    last_index: int
    last_end_ms: int

    # debug 专属字段
    srt_parse: SrtParseDebug   # SRT 解析诊断
    debug_deductions: list[DeductionDetail]  # 逐条扣分详情（含行号+内容摘要）
    last_content_scan: list[str]  # 片长匹配扫描日志
    entry_diagnosis: EntryDiagnosis  # 文件诊断

class SrtParseDebug(BaseModel):
    match_count: int
    total_lines: int
    unmatched_tail_offset: int

class DeductionDetail(BaseModel):
    issue_type: str  # gap / overlap / too_short / fast_read / ...
    entry_index: int
    line_range: str  # "L12-L15"
    detail: str
    content_snippet: str

class EntryDiagnosis(BaseModel):
    size_kb: float
    valid_lines: int
    srt_match_count: int
    unmatched_tail_bytes: int
```

### 前端 DebugModal 结构

```
┌─ Debug Modal ──────────────────────────────┐
│  file_name                    [复制报告] [✕] │
├─────────────────────────────────────────────┤
│  ▼ 文件信息                                 │
│    路径 / 大小 / 编码 / 评分 / 状态          │
├─────────────────────────────────────────────┤
│  ▼ SRT 解析                                 │
│    match_count / total_lines / unmatched    │
├─────────────────────────────────────────────┤
│  ▼ 扣分明细 (N条)                           │
│    #123 L45-L48  阅读速度过快(12.3字/秒)     │
│    #256 L89-L92  与下一条间隔过大(45s)       │
│    ...                                       │
├─────────────────────────────────────────────┤
│  ▼ AI 标记                                  │
│    large_gaps / repeated_lines / ...        │
├─────────────────────────────────────────────┤
│  ▼ 片长匹配                                 │
│    最后字幕: 01:23:45 / 片长: 01:30:00      │
│    匹配度: 93%  扫描日志: ...               │
└─────────────────────────────────────────────┘
```

### 防抖策略

前端 `handleDebugClick` 用 `useRef` 记录上次点击时间，500ms 内重复点击直接忽略。`useRef` 避免额外 re-render，比 `useState` + `useEffect` 更轻量。

## Decision (ADR-lite)

**Context**: 将 CLI `--debug` 完整诊断集成到 UI
**Decision**: 完整版 — 新增 debug API 端点，改造 reviewer 模块支持 debug 参数链，前端分区折叠面板 + 复制功能 + 防抖
**Consequences**: 需修改 12 个文件（含 1 个新建组件），跨 3 个包（thunder-subtitle-py、thunder-subtitle-api、thunder-subtitle-web）

## Out of Scope

* 批量字幕 debug
* 扫描结果页 debug 按钮
* 搜索结果页 debug 按钮
* debug 结果导出为文件（仅支持复制到剪贴板）

## Technical Notes

**关键现有文件**:
- CLI debug: `thunder-subtitle-py/commands/review.py:105-211` `cmd_review_debug`
- SRT debug: `thunder-subtitle-py/src/reviewer/_srt.py` `_parse_srt_entries(debug=True)`, `_check_srt_quality(debug=True)`, `_find_last_content_end(debug=True)`
- 审查 API: `thunder-subtitle-api/app/api/review.py:139-162` `GET /api/review/subtitle/file`
- 审查 service: `thunder-subtitle-api/app/services/review_service.py:108-170`
- 字幕列表: `thunder-subtitle-web/src/components/VerificationSubtitleList.tsx`
- 配置链路: `src/config.py Config` → `ConfigService` → `AppConfig` → API → TypeScript `AppConfig`
