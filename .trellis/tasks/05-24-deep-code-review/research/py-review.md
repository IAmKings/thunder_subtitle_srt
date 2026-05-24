# CLI Python 深度代码审查报告

## 审查概览
- 审查文件数：20
- 发现问题数：24（P0: 1, P1: 11, P2: 12）

## P0（严重 — Bug/安全）

### P0-1: `_processor.py` 的 `_process_one_movie` 在 `_search_and_download` 中未传递 `has_queried` 到 `filter_by_duration`

**文件**: `thunder-subtitle-py/src/scanner/_processor.py:83`
**严重度**: P0
**类型**: Bug

`_process_one_movie` 接收 `has_queried: bool` 参数，但其值被用于两个用途：
1. 传递给 `_search_and_download` 的 `needs_delay` 参数（第 83 行）：控制 `time.sleep(config.rate_limit)` —— 只有非首部电影才需要延迟。
2. **但是**：串行模式中 `_process_one_movie` 被逐个调用（`_parallel.py:101`），每次传递的 `has_queried` 是从外部循环传入的全局布尔值，可能导致并发模式下多个线程同时访问该值。

在并行模式（`_process_parallel`）中，每个线程调用 `_process_one_movie(..., has_queried=False, ...)`（第 171-172 行），强制所有线程的 `has_queried` 为 False。这意味着**并行模式下的 rate_limit 实际失效**：所有线程都不等待。虽然没有数据竞争，但并行模式下所有请求同时发出，可能触发 API 限流。

**修复建议**：并行模式应使用跨线程的 rate_limit 协调机制（如 `threading.Semaphore` 或时间戳锁），或者为每个线程维护独立的 `has_queried`。

---

## P1（重要 — 代码质量）

### P1-1: `_processor.py` 的 `_select_primary_alt` 使用对象身份 `id(s)` 做排序键

**文件**: `thunder-subtitle-py/src/scanner/_processor.py:99`
**严重度**: P1
**类型**: 代码质量

```python
orig_order = {id(s): i for i, s in enumerate(result.subtitles)}
```
使用 `id(s)`（对象内存地址）作为字典键来跟踪原始排序。这是脆弱的：如果 Python 运行时发生 GC 回收了 List 中的对象引用（CPython 引用计数在 List 内不会发生，但理论上在其他实现中可能），`id(s)` 可能被重用。更安全的方式是用字幕的唯一业务键（如 `gcid` 或 `url`）。

**修复建议**：用 `subtitle.gcid or subtitle.url` 代替 `id(s)` 作为排序键。

### P1-2: 跨模块内部导入 (_private 模块)

**文件**:
- `thunder-subtitle-py/src/reviewer/__init__.py:12`
- `thunder-subtitle-py/src/scanner/_skip.py:18`
**严重度**: P1
**类型**: 代码组织

reviewer 模块直接导入 scanner 的内部模块：
```python
from ..scanner._skip import _existing_subtitle_file, _find_dump_subtitle
```
以 `_` 前缀的模块/函数按约定是私有的，不应被外部（即使是同级的 reviewer）导入。导致 scanner 和 reviewer 之间产生紧耦合——修改 scanner 的内部实现可能意外破坏 reviewer。

**修复建议**：
1. 将 `_existing_subtitle_file` 和 `_find_dump_subtitle` 提升为 scanner 公共 API（移到 `scanner/__init__.py` 或专门的 `scanner/_util.py` 并公开）。
2. 或者将共享逻辑提取到 `src/_shared.py` 或 `src/utils.py`。

### P1-3: `_processor._load_gcids` 与 `utils.load_gcid_file` 重复

**文件**:
- `thunder-subtitle-py/src/scanner/_processor.py:212-222`
- `thunder-subtitle-py/src/utils.py:162-171`
**严重度**: P1
**类型**: DRY 违反

`_processor._load_gcids()` 和 `utils.load_gcid_file()` 有完全相同的逻辑（读取文件、按行拆分、返回 set），只是参数名和 OS 错误处理略有不同。应统一为一个函数。

### P1-4: `_skip.py` 中 `.reviewed` 文件在单个电影处理中被多次重复读取

**文件**: `thunder-subtitle-py/src/scanner/_skip.py`
**严重度**: P1
**类型**: 性能

在 `_check_skip` 的调用路径中，`.reviewed` 文件被重复读取：
1. `_handle_reset_fail()` → 第 62-65 行调用 `_is_review_fail()`（打开文件）
2. `_check_fail_skip()` → 第 80-81 行再次调用 `_is_review_fail()`（再次打开文件）
3. `_check_skip()` → 第 178 行第 3 次调用 `_is_review_fail()`（第 3 次打开文件）
4. `_get_dry_state()` → 第 104 行调用 `os.path.isfile()`（第 4 次文件系统访问）

对于大型媒体库（数千部电影），每次扫描多出 3 次不必要的文件打开/读取，叠加后产生显著的 I/O 开销。

**修复建议**：在 `_check_skip` 中读取一次 `.reviewed` 内容并缓存，传递到各个子函数。

### P1-5: `_skip.py` 中 `_get_dry_state` 和 `_check_existing_skip` 重复调用 `_existing_subtitle_file`

**文件**: `thunder-subtitle-py/src/scanner/_skip.py:102-105, 140-151`
**严重度**: P1
**类型**: 性能 / DRY

`_get_dry_state` 在第 105 行调用 `_existing_subtitle_file()`，随后 `_check_existing_skip` 在第 144 行再次调用同一个函数。每次调用都扫描整个目录（`os.listdir`）。同样对于数千部电影产生不必要的目录扫描开销。

**修复建议**：在 `_check_skip` 中调用一次 `_existing_subtitle_file`，将结果传递给子函数。

### P1-6: `_encoding.py` 中 `_calc_cn_ratio` 的 CJK 检查重复

**文件**: `thunder-subtitle-py/src/reviewer/_encoding.py:28-29`
**严重度**: P1
**类型**: 性能

```python
cn_count = sum(1 for ch in text if CJK_RE.search(ch))
meaningful = sum(1 for ch in text if ch.isalnum() or CJK_RE.search(ch))
```
对每个字符执行两次 `CJK_RE.search()`。对于大文件（数万字符）这加倍了正则匹配开销。

**修复建议**：合并为单次遍历：
```python
cn = 0
meaningful = 0
for ch in text:
    is_cjk = bool(CJK_RE.search(ch))
    if is_cjk or ch.isalnum():
        meaningful += 1
        if is_cjk:
            cn += 1
```

### P1-7: `_parallel.py` 和 `_processor.py` 中多个函数缺少类型标注

**文件**:
- `thunder-subtitle-py/src/scanner/_parallel.py:76-79`
- `thunder-subtitle-py/src/scanner/_processor.py:91-92`
**严重度**: P1
**类型**: 类型安全

```python
def _do_scan_loop(
    movie_dirs, dry_run, client, config,
    min_age_days, dump_mode, force, reset_fail,
    parallel, resume, progress_file, log_path,
) -> list:
```
11 个参数全无类型标注。`_select_primary_alt` 的 `result` 参数无类型标注（第 92 行），返回类型为 `tuple` 而非具名元组。

### P1-8: `_io.py` 中 `_write_log` 的状态映射混合了枚举值和字面量

**文件**: `thunder-subtitle-py/src/scanner/_io.py:27`
**严重度**: P1
**类型**: 类型安全

```python
status_map = {ScanStatus.downloaded: "OK", ScanStatus.skipped: "SKIP", "no_match": "NONE", "error": "ERR"}
```
键类型不一致：前两个是 `ScanStatus` 枚举，后两个是字符串字面量。`_print_scan_summary` 和 `_write_log_summary` 中同样存在此问题（第 39-41 行、第 81-83 行）。

**修复建议**：统一使用枚举值或字符串常量。

### P1-9: `_skip.py` 中 `from __future__ import annotations` 放在 docstring 之前

**文件**:
- `thunder-subtitle-py/src/scanner/_skip.py:1`
- `thunder-subtitle-py/src/scanner/_processor.py:1`
- `thunder-subtitle-py/src/scanner/_parallel.py:1`
- `thunder-subtitle-py/src/reviewer/__init__.py:1`
- `thunder-subtitle-py/src/reviewer/_marker.py:1`
- `thunder-subtitle-py/src/reviewer/_srt.py:3`
- `thunder-subtitle-py/src/download.py:1`
**严重度**: P1
**类型**: 代码质量

Python 要求模块 docstring 必须是文件中的第一个表达式，否则不会被识别为 `__doc__`。上述文件中 `from __future__ import annotations` 出现在 docstring 之前，导致 docstring 退化为一个未绑定的字符串表达式，不会成为模块的 `__doc__` 属性。

**修复建议**：将 docstring 移到第一行，`from __future__` 放在其后。

### P1-10: `_srt.py` 中 `_parse_srt_entries` 的 regex 在函数内反复编译

**文件**: `thunder-subtitle-py/src/reviewer/_srt.py:19`
**严重度**: P1
**类型**: 性能

```python
pattern = re.compile(
    r"(\d+)\s*\n..."
    re.MULTILINE | re.DOTALL,
)
```
每次调用 `_parse_srt_entries` 都编译一次正则表达式。对于大文件（数千条 SRT 字幕），虽然编译开销只是 O(1)，但仍应提升为模块级常量。

### P1-11: `_marker.py` 的 `_batch_mark` 中 `status` 参数类型应为 `ReviewState` 而非 `str`

**文件**: `thunder-subtitle-py/src/reviewer/_marker.py:43`
**严重度**: P1
**类型**: 类型安全

```python
def _batch_mark(movie_dirs: list[str], mark: bool, keyword: str = "", status: str = ReviewQuality.ok) -> None:
```
传入 `ReviewQuality.ok` 默认为 `"ok"`，但 `action_map` 中使用 `(True, ReviewQuality.ok)` 和 `(True, ReviewQuality.fail)` 作为键。`ReviewQuality.ok` 是 `"ok"`，`ReviewState.fail` 是 `"fail"`——混用了两个不同的 Enum。

### P1-12: `config.py` 中配置损坏时完全静默

**文件**: `thunder-subtitle-py/src/config.py:65-66`
**严重度**: P1
**类型**: 可用性

```python
except (json.JSONDecodeError, OSError):
    pass  # 文件损坏则用默认值
```
配置文件损坏时使用默认值但不给任何反馈。用户不知道配置未生效。至少应输出 warning 日志。

---

## P2（建议 — 优化）

### P2-1: Web API `scan_service.py` 未传递 CLI 的全部参数

**文件**: `thunder-subtitle-api/app/services/scan_service.py:231-241`
**严重度**: P2
**类型**: 一致性

`_execute_scan` 调用 `_process_one_movie` 时未传递以下 CLI 支持的参数：
- `min_age_days`（默认 0，CLI `--min-age-days` 支持）
- `reset_fail`（默认 False，CLI `--reset-fail` 支持）

虽然默认值满足了当前 Web 需求，但 Web API 的 `TaskCreate.params` 没有定义这些字段的模式，导致 CLI 和 Web API 之间存在功能差异。

### P2-2: `_skip.py` 中 `_is_review_fail` 在 `_handle_reset_fail` 和 `_check_fail_skip` 之间被重复调用

**文件**: `thunder-subtitle-py/src/scanner/_skip.py:60-74, 78-99`
**严重度**: P2
**类型**: 微小性能

`_check_skip` 第 169 行调用 `_check_fail_skip`，其中第 81 行调用 `_is_review_fail(reviewed_file)`。但在 `_handle_reset_fail`（第 60 行）中第 63 行已经调用了 `_is_review_fail(reviewed_file)`。同一次扫描中 `.reviewed` 文件被打开至少 2 次以上。参见 P1-4 的更完整分析。

### P2-3: `_srt.py` 的 `_check_srt_quality` 在模块中间导入 `ReviewState`

**文件**: `thunder-subtitle-py/src/reviewer/_srt.py:50`
**严重度**: P2
**类型**: 导入风格

```python
def _check_srt_quality(item: ReviewItem, entries: list[dict]) -> None:
    from ..models import ReviewState
```
`ReviewState` 在函数体内导入（用于第 44 行的类型比较），但文件顶部 `from __future__ import annotations` 已启用延迟评估。应移到模块顶部的 `TYPE_CHECKING` 块或顶层导入。

注意：`ReviewState` 在运行时用于比较 `item.status == ReviewState.fail`（第 44 行），所以不能移到 `TYPE_CHECKING` 块。但至少应放在模块顶部而非函数体内，且不在 `TYPE_CHECKING` 下的条件导入。

### P2-4: `download.py` 的 `download_batch` 未被 CLI 主流程调用

**文件**: `thunder-subtitle-py/src/download.py:111-133`
**严重度**: P2
**类型**: 死代码

`download_batch` 函数从未在 CLI 扫描/审查流程中被调用。仅在 Web API 通过 `_execute_dump` 间接使用 `dump_subtitles`（但没用 `download_batch`）。如果确认外部没有调用者，应标记为废弃或移除。

### P2-5: `_processor.py` 的 `_content_fingerprint` 使用了 `hashlib.md5()` 用于内容去重

**文件**: `thunder-subtitle-py/src/scanner/_processor.py:250`
**严重度**: P2
**类型**: 性能

MD5 虽快但内容去重建议改用更快的非加密哈希（如 xxhash 或 Python 内置的 `hash()` 对元组做指纹）以提升大文件的处理速度。

### P2-6: `api.py` 中 `is_chinese_subtitle` 的语言字段正则编译在每次调用时进行

**文件**: `thunder-subtitle-py/src/api.py:83-84`
**严重度**: P2
**类型**: 性能

```python
has_chinese_lang = any(
    re.search(r"chinese|中文|简体|繁体|cn", lang, re.IGNORECASE)
    for lang in subtitle.languages
)
```
每次调用 `is_chinese_subtitle` 时都编译正则。建议提升为模块级常量。

### P2-7: `_io.py` 的 `_write_log_summary` 和 `_print_scan_summary` 有相似的状态统计逻辑

**文件**:
- `thunder-subtitle-py/src/scanner/_io.py:39-51`
- `thunder-subtitle-py/src/scanner/_io.py:81-96`
**严重度**: P2
**类型**: DRY

`_write_log_summary` 和 `_print_scan_summary` 都对扫描结果做相同的状态计数。虽然输出方式不同（日志 vs 打印），计数逻辑可提取为共享辅助函数。

### P2-8: `_review.py` 的 `_find_all_subtitle_files` 和 `_skip._existing_subtitle_file` 有关联的目录遍历逻辑

**文件**:
- `thunder-subtitle-py/src/reviewer/_review.py:37-54`
- `thunder-subtitle-py/src/scanner/_skip.py:37-44`
**严重度**: P2
**类型**: DRY

两个函数都用于在电影目录中查找字幕文件，但使用不同的匹配策略（`_find_all_subtitle_files` 搜索所有变体，`_existing_subtitle_file` 优先搜索标准命名）。如果未来添加新的字幕格式扩展，两个函数都需要分别更新。

### P2-9: `_output.py` 的 `_print_review_summary` 导入 `ReviewState` 但只用了一次

**文件**: `thunder-subtitle-py/src/reviewer/_output.py:52`
**严重度**: P2
**类型**: 导入风格

```python
fail_count = sum(1 for r in items if r.status == ReviewState.fail)
```
但 `ReviewState.fail` 和 `ReviewQuality.fail` 的值相同（都是 `"fail"`），这里可以使用 `ReviewQuality.fail` 以保持与 `ok_count` 和 `warn_count` 的一致性。

### P2-10: `_skip.py` 的 `_check_release_age` 中日期解析失败时静默跳过

**文件**: `thunder-subtitle-py/src/scanner/_skip.py:135-136`
**严重度**: P2
**类型**: 错误处理

```python
except (ValueError, IndexError):
    pass
```
当 `release_date` 格式异常时（虽然不常见），静默返回 `None`（不跳过）。虽然没有安全风险，但如果日志级别为 DEBUG，建议输出警告以帮助调试。

### P2-11: `_processor.py` 的 `_print_status` 辅助函数定义在文件末尾

**文件**: `thunder-subtitle-py/src/scanner/_processor.py:257-260`
**严重度**: P2
**类型**: 可读性

`_print_status` 在第 57-58 行、第 67 行等多处被调用，但定义在文件末尾（第 257 行）。对于可读性，工具函数应放在文件顶部或模块的末尾统一区域。

### P2-12: `_dir.py` 的 `scan_movie_dirs` 中硬编码了 `.` 前缀目录过滤

**文件**: `thunder-subtitle-py/src/scanner/_dir.py:20, 28`
**严重度**: P2
**类型**: 健壮性

```python
if not os.path.isdir(entry_path) or entry.startswith("."):
```
以 `.` 开头的目录被跳过（如 `.scanner-progress`、`.dumped`）。这是合理的，但如果用户有合法的目录以 `.` 开头（罕见但可能），会导致漏扫。可用更精确的过滤（只跳过已知的标记文件）。

---

## 模块级评分

| 模块 | SOLID | 错误处理 | 类型安全 | 一致性 | 综合 |
|------|-------|---------|---------|--------|------|
| scanner (6 files) | B+ | B | C+ | B | B |
| reviewer (6 files) | A- | B+ | B | B | B+ |
| api + download (2 files) | A | A- | B+ | A | A- |
| config / models / exceptions (3 files) | A | B+ | A | A | A |
| utils / ui (3 files) | B+ | A- | B | B+ | B+ |

### 各模块分析要点

**Scanner 模块**：按职责合理拆分为 5 个子模块（_dir / _skip / _processor / _parallel / _io），单一职责贯彻较好。主要问题在于类型标注不完整（_parallel 中 11 个无类型参数）、.reviewed 文件的重复 I/O 导致性能损耗、以及 `_load_gcids` 与 `utils.load_gcid_file` 的 DRY 违反。

**Reviewer 模块**：拆分为 _marker / _review / _encoding / _srt / _output，职责清晰，评分的扣分逻辑可追溯。跨模块导入（从 scanner._skip 导入内部函数）是主要耦合问题。

**API + Download**：整体质量最高。API 客户端有完善的错误处理（超时、HTTP 错误、NetworkError 分类）、Session 管理、context manager 支持。`download_subtitle` 的指数退避重试和完整性校验设计良好。

**Config + Models**：配置加载/保存逻辑简洁清晰，异常层级设计合理（ThunderSubtitleError 基类 → 4 个子类），dataclass 类型准确。微小改进是配置损坏时应有至少一行 warning 日志。

**Utils + UI**：功能实用、函数职责单一。`filter_by_duration` 使用 `Any` 类型虽在 CLI 中够用但与 Web API 类型不协调。`format_duration` / `seconds_to_duration_str` 之间存在格式差异（分隔符不一致），建议统一。

### 与 Web API 的一致性总结

| 特性 | CLI 支持 | Web API 支持 | 一致性 |
|------|---------|-------------|--------|
| 扫描 (scan) | 全参数 | 缺少 min_age_days / reset_fail | 部分 |
| 审查 (review) | review_directory | 调用同一函数 | 一致 |
| 标记 (mark) | 7 种操作模式 | 只有 mark_path / mark_fail_path | 部分 |
| dump 下载 | dump_mode | 通过 process_scanned_movies | 一致 |
| 进度/日志 | 控制台 + 文件 | WebSocket 实时推送 | 不一致 |
| 参数命名 | snake_case | snake_case | 一致 |

CLI 的 `mark_directory` 支持 7 种标记操作（mark / unmark / mark_all / mark_path / unmark_path / mark_fail / mark_fail_path），但 Web API 的 `ReviewService.mark_review` 只使用了 `mark_path` 和 `mark_fail_path`。其余操作模式在 Web 端未暴露。

---

## 审查结果汇总

| 维度 | 评价 |
|------|------|
| SOLID | 良好。模块拆分合理，scanner 和 reviewer 各有清晰的子模块。主要问题：reviewer 跨模块导入 scanner._skip 内部函数。 |
| DRY | 一般。`_load_gcids` / `load_gcid_file` 重复、scanner 中 `.reviewed` 的重复读取、_calc_cn_ratio 中 CJK 重复检查。 |
| 错误处理 | 良好。网络请求有超时/重试/完整性校验，文件 I/O 有 try/except。次要：config 损坏时无反馈。 |
| 类型安全 | 一般。scanner 模块多个函数缺少类型标注；list 缺少泛型类型参数；部分参数类型使用 str 而非 Enum。 |
| 一致性 | 良好。CLI 核心能力与 Web API 对齐。CLI 的 min_age_days / reset_fail 以及 mark 的 5 种额外操作模式在 Web 端未暴露。 |
