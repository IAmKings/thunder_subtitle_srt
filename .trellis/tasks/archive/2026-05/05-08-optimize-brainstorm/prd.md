# brainstorm: 工程优化方向分析（2026-05-10 更新）

## Goal

全面审查工程状态，识别剩余优化空间。**不修改代码，只规划。**

---

## 一、已完成项（自 05-08 以来）

| 原始 PRD 条目 | 完成提交 | 说明 |
|---|---|---|
| P0-1 `cli.py` 重构 | `67f28ce` / `4b1cb9a` | `_build_parser()` + `_COMMANDS` 注册表，`main()` 精简 |
| P0-2 `_check_skip()` 拆分 | `67f28ce` | 拆为 `_handle_reset_fail` / `_check_fail_skip` / `_check_nfo_skip` / `_check_release_age` / `_check_existing_skip` / `_get_dry_state` |
| P0-3 `_search_and_download()` 拆分 | `ea8f17f` | 拆为 `_select_primary_alt` / `_dump_all_subtitles` / `_content_fingerprint` |
| P0-4 沉默 OSError | `ea8f17f` | **19 处全部**改为 `logger.warning()` |
| P0-5 `review_directory()` 拆分 | `ea8f17f` | 拆为 `mark_directory()` + `review_directory()`，消除 `**kwargs` |
| P1-6 代码重复消除 | `67f28ce` / `ea8f17f` | `filter_by_duration` → `utils.py`, `load_gcid_file` → `utils.py`, `clear_file` → `utils.py`, CJK 范围统一为 `CJK_RE` |
| P1-7 测试覆盖 | `ea8f17f` | 37 → **196** 用例 |
| P1-8 硬编码常量 → Config | `4b1cb9a` / `ea8f17f` | `timeout`, `download_timeout`, `chunk_size`, `rate_limit`, `retry_count`, `retry_delay` 已入 Config |
| P2-10 异常体系 | `ea8f17f` | `ThunderSubtitleError` → `ApiError`, `NetworkError`, `ConfigError`, `DownloadError` |
| P2-12 `format_duration()` | `ea8f17f` | 已支持小时，`3600000ms` → `"1h 0m 0s"` |

---

## 二、剩余优化项

### 🟡 P1 — 建议处理

#### 1. `.zh.` 前缀字符串硬编码（3处）

| 位置 | 代码 |
|---|---|
| `_skip.py:18` | `return ".zh." in filename` |
| `_processor.py:164` | `f"{movie_name}-alt.zh.{alt.ext}"` |
| `_review.py:119` | `if ".zh." in filename` |

**方案**：定义 `ZH_PREFIX = ".zh."` 常量，3处引用。影响面极小。

#### 2. reviewer 硬编码常量仍散落

| 常量 | 位置 | 当前值 |
|---|---|---|
| `MIN_FILE_SIZE` | `_review.py:9` | 200 bytes |
| `MIN_CN_RATIO` | `_review.py:10` | 0.05 |
| `MIN_SUB_DURATION_MS` | `_srt.py:7` | 500ms |
| `MAX_LINE_LENGTH` | `_srt.py:8` | 60 |
| `MAX_NORMAL_SCORE` | `_review.py:12` | 5.0 |

**方案**：权衡 — 这些是 reviewer 内部算法参数，暴露为配置可能过度设计。保持 review 模块内常量定义即可，不需要入 Config。

---

### 🟢 P2 — 锦上添花

#### 3. 注释语言混合

部分模块中文注释，部分英文。项目整体偏好中文注释，少量英文残留。

**方案**：统一为中文注释，一次性批量修正。优先级低，不影响功能。

#### 4. import 风格不完全统一

- 顶级 import 为主流
- 少数延迟 import（`cli.py:32` `from importlib.metadata import ...`）
- 少数内联 import（在函数体内 import）

**方案**：延迟 import 保留（有版本检查目的），内联 import 提到文件顶部。

#### 5. 无结构化日志输出

`print()` 用于用户输出，`logging` 用于诊断。但缺少：
- `--quiet` 静默模式
- `--verbose` 详细模式
- 日志级别控制

**方案**：为 CLI 添加 `-q` / `-v` flag，用户消息通过 `src/ui.py` 模块统一输出。

---

## 三、当前指标

| 指标 | 05-08 | 当前 |
|---|---|---|
| 测试用例数 | 37 | **196** |
| 最长函数 | 232行 (`main`) | ~50行 |
| 沉默异常 | 11处 | **0** |
| 测试覆盖缺口 | 7个核心函数 | **0**（全部覆盖） |
| 代码重复块 | 5处 | 0 |
| 外部依赖 | `requests` | `requests` |
| `.zh.` 硬编码 | 3处 | 3处 |

---

## 四、建议路线

```
本轮（0.5天）:
├── .zh. 前缀常量化（3处 → 1处定义）
└── 确认 PRD 状态，归档或继续

下轮（可选，0.5天）:
├── 注释语言统一
└── import 风格清理

长期（0.5-1天）:
└── 结构化日志（--quiet / --verbose）
```

---

## 五、结论

**P0/P1 核心优化已在 `67f28ce`、`4b1cb9a`、`ea8f17f` 三个提交中全部完成。** 剩余工作属于锦上添花级别，不影响工程质量和可维护性。

唯一个值得本轮处理的：`.zh.` 前缀常量化（3行改动，消除最后的魔法字符串）。
