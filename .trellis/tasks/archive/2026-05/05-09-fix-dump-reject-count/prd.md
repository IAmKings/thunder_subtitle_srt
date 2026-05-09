# fix: --dump reject统计混入download计数 + 空gcid去重

## Goal

修复 `scan --dump` 模式下两个关联的统计/去重 bug：
1. 全部被 reject 的影片仍被计入 "Downloaded"
2. 空 gcid 字幕绕过 reject 和去重检查

## Requirements

* [x] `_dump_all_subtitles` 根据 `r.downloaded` 设置 ScanStatus：有下载 → `downloaded`，无下载 → `no_match`
* [x] 空 gcid 字幕用 `md5(url)` 作为 fallback 去重键，统一 reject/去重流程
* [x] `--force` 尊重 `.rejected` 增量更新（设计如此，非Bug）

## Acceptance Criteria

* [ ] `scan --dump` 下，全部被 reject 的影片统计为 "No match" 而非 "Downloaded"
* [ ] 空 gcid 字幕可被 `.rejected` 正确拦截，不会重复下载
* [ ] 空 gcid 字幕在同一个 dump 会话内可被去重（不重复下载同 URL）
* [ ] 有 gcid 的字幕行为不变（向后兼容）
* [ ] 现有测试通过 + 新增测试覆盖上述场景

## Technical Approach

### Fix 1: `_dump_all_subtitles` 状态判断 (`_processor.py:189-203`)

```python
def _dump_all_subtitles(...):
    ...
    r = dump_subtitles(...)
    if r.downloaded > 0:
        return ScanResult(..., ScanStatus.downloaded, ...)
    return ScanResult(..., ScanStatus.no_match, "All subtitles rejected or failed")
```

### Fix 2: URL hash fallback (`download.py:147-196`)

引入 `_dedup_key(sub)` 辅助函数：

```python
def _dedup_key(sub: Subtitle) -> str:
    """去重键：gcid 优先，空则用 url 的 md5"""
    return sub.gcid or hashlib.md5(sub.url.encode()).hexdigest()
```

`dump_subtitles()` 中所有 `if gcid and gcid in ...` 替换为 `key = _dedup_key(sub)` + 基于 key 的判断。

参数 `rejected_gcids` 语义上变为 `rejected_keys`，`.rejected` 文件格式不变（每行一个标识符字符串）。

## Decision (ADR-lite)

**Context**: 空 gcid 字幕无法参与去重和 reject
**Decision**: 使用 `md5(url)` 作为 gcid 空值时的 fallback 去重键
**Consequences**:
- 统一了去重/reject 流程，消除特殊 case
- `.rejected` 文件向后兼容（gcid 和 url hash 都是 hex 字符串）
- URL 变更会导致历史 reject 失效（风险等同 gcid 变更）

## Out of Scope

* 下载失败计数（`r.failed`）- 当前下载失败不进入任何计数器，本次不改
* `--force` 绕过 `.rejected` - 设计如此，用 `--reset-fail` 实现

## Implementation Plan

两个 fix 在同一个函数调用链上，一个 PR 搞定：

1. **`src/download.py`** — 加 `_dedup_key()`，改 `dump_subtitles()` 去重/reject 逻辑
2. **`src/scanner/_processor.py`** — `_dump_all_subtitles()` 加 `r.downloaded > 0` 判断
3. **`tests/`** — 新增：空 gcid reject 拦截、全 reject 影片状态测试

## Technical Notes

* `src/download.py:147-196` — `dump_subtitles()` + `DumpResult`
* `src/scanner/_processor.py:189-203` — `_dump_all_subtitles()`
* `src/scanner/_io.py:53-96` — `_print_scan_summary()` (无需改动)
* `src/types.py:37-50` — `Subtitle` 数据类
