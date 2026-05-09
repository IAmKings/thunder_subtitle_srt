# brainstorm: 工程优化方向分析

## Goal

全面审查 thunder-subtitle-py 工程，识别优化空间并给出可行方案，**不修改代码**。

---

## 一、项目概览

| 指标 | 数值 |
|---|---|
| 总 Python 文件数 | 30 |
| 总代码行数 | ~3,842 |
| 外部依赖 | 仅 `requests>=2.31.0` |
| 测试用例数 | 37+ |
| Python 版本 | ≥3.10 |

### 模块行数分布

| 文件 | 行数 | 状态 |
|---|---|---|
| `cli.py` | 263 | ⚠️ 臃肿 — `main()` 232行，argparse+dispatch 混在一起 |
| `commands/search.py` | 153 | ⚠️ 偏大 — `cmd_search()` 105行，搜索+过滤+下载一把梭 |
| `commands/dump.py` | 112 | ⚠️ 偏大 — `cmd_dump()` 98行，两套模式内联 |
| `src/scanner/_processor.py` | 237 | ⚠️ 臃肿 — `_search_and_download()` 81行，7+职责 |
| `src/scanner/_parallel.py` | 205 | ⚠️ 臃肿 — 3个函数都超标 |
| `src/scanner/_skip.py` | 120 | ⚠️ 复杂 — `_check_skip()` 73行，8+决策点 |
| `src/scanner/_io.py` | 94 | ✅ 合理 |
| `src/reviewer/__init__.py` | 135 | ⚠️ 臃肿 — `review_directory()` 119行，双模式混用 |
| `src/reviewer/_review.py` | 136 | ⚠️ 偏大 — `_review_one_file()` 85行 |
| `src/reviewer/_marker.py` | 106 | ⚠️ 偏大 |
| `src/reviewer/_srt.py` | 105 | ⚠️ 偏大 |
| `src/reviewer/_output.py` | 96 | ✅ 合理 |
| `src/download.py` | 195 | ✅ 合理 |
| `src/api.py` | 119 | ✅ 合理 |
| `src/utils.py` | 135 | ✅ 合理 |
| `src/types.py` | 74 | ✅ 合理 |
| `src/ui.py` | 70 | ✅ 合理 |
| `src/config.py` | 70 | ✅ 合理 |

---

## 二、高优先级优化项

### 🔴 P0 — 必须优先处理

#### 1. `cli.py` `main()` 重构（232行）

**问题**：一个函数干了三件事 — argparse 定义（7个子命令）、dispatch if/elif 链、错误处理。新增命令需要同时修改 parser 和 dispatch。

**优化方向**：
- 抽离 `_build_parser()` 函数独立构建 argparse
- 用命令注册表替代 if/elif 链：`{"search": cmd_search, ...}`
- 目标：`main()` ≤ 30 行

#### 2. `_check_skip()` 复杂度爆炸（73行，8+决策点）

**问题**：`src/scanner/_skip.py:47-120`，一个函数处理失败状态、强制模式、重置失败、dry-run、NFO标签、发布日期、已有文件检查。**零测试覆盖**。

**优化方向**：
- 拆分为责任链：`_check_fail_state()` → `_check_force_skip()` → `_check_dry_run()` → `_check_nfo()` → `_check_date()` → `_check_existing_file()`
- 每个拆分后的函数 ≤ 20 行，独立可测试

#### 3. `_search_and_download()` 职责过多（81行，7+职责）

**问题**：`src/scanner/_processor.py:86-167`，包含限速等待、API搜索、时长过滤、首选组排序、中文检测、去重、文件命名、下载分发、结果报告。**零测试覆盖**。

**优化方向**：
- `dump_mode` 分支拆成独立函数 `_dump_all_for_movie()`
- 抽取 `_filter_and_rank_subtitles()` 处理过滤/排序/去重
- `_search_and_download()` 只做编排，≤ 30 行

#### 4. 11处沉默 OSError（`except OSError: pass`）

**问题**：文件系统错误（磁盘满、权限拒绝、NFS断开）被完全淹没，生产环境排查极难。

**位置**：
- `src/scanner/_io.py:18, 31, 48`
- `src/scanner/_processor.py:178, 199-200`
- `src/reviewer/_output.py:74, 89`
- `src/reviewer/_marker.py:96, 105`

**优化方向**：至少用 `logging.warning()` 输出错误信息 + 文件路径

#### 5. `review_directory()` 双模式混淆（119行）

**问题**：`src/reviewer/__init__.py:16-135`，mark/unmark 操作和 review 操作混在一个函数里，用 `**kwargs` 传参。

**优化方向**：
- 拆分为 `mark_directory()` 和 `review_directory()` 两个入口
- 消除 `**kwargs`，换成显式参数

---

### 🟡 P1 — 应该尽快处理

#### 6. 代码重复

| 重复内容 | 出现位置 | 建议 |
|---|---|---|
| 时长过滤逻辑 | `commands/search.py:53-54`, `commands/dump.py:72-74`, `src/scanner/_processor.py:102-104` | 抽取 `filter_by_duration()` 到 `src/utils.py` |
| 被拒 GCID 加载 | `src/scanner/_processor.py:172`, `commands/dump.py:83-90` | 抽取到 `src/utils.py` 或独立模块 |
| `.dumped` 文件清理 | `src/scanner/_processor.py:175-178`, `commands/dump.py:94-98` | 统一到 `src/download.py` |
| CJK 字符范围定义 | `src/api.py:69-81` (`\u4e00-\u9fff`), `src/reviewer/_encoding.py:22-30` (`\u4e00-\u9fa5`), `src/ui.py:29` | 统一范围并定义为常量 `CJK_RANGE` |
| 摘要统计逻辑 | `src/scanner/_io.py`, `src/reviewer/_output.py` | 考虑统一的统计计算函数 |

#### 7. 测试覆盖缺口（关键逻辑零测试）

| 未测试函数 | 位置 | 风险 |
|---|---|---|
| `_check_skip()` | `src/scanner/_skip.py:47` | 高 — 最复杂函数 |
| `_search_and_download()` | `src/scanner/_processor.py:86` | 高 — 核心算法 |
| `_process_one_movie()` | `src/scanner/_processor.py:43` | 高 — 单电影处理管线 |
| `review_directory()` | `src/reviewer/__init__.py:16` | 高 — review 全流程 |
| `_batch_mark()` | `src/reviewer/_marker.py:37` | 中 — 批量标记逻辑 |
| `dump_subtitles()` | `src/download.py:135` | 中 — dump 模式 |
| `scan_movie_dirs()` | `src/scanner/_dir.py` | 中 — 目录扫描 |

#### 8. 硬编码常量应可配置

| 常量 | 位置 | 当前值 |
|---|---|---|
| `DEFAULT_TIMEOUT` | `src/api.py:11` | 30s |
| 下载超时 | `src/download.py:59` | 60s |
| `chunk_size` | `src/download.py:66` | 8192 |
| `MIN_FILE_SIZE` | `src/reviewer/_review.py:9` | 200 bytes |
| `MIN_CN_RATIO` | `src/reviewer/_review.py:10` | 0.05 |
| `MIN_SUB_DURATION_MS` | `src/reviewer/_srt.py:7` | 500ms |
| `MAX_LINE_LENGTH` | `src/reviewer/_srt.py:8` | 60 |
| `.zh.` 前缀常量 | 3处硬编码 | — |

**建议**：纳入 `Config` dataclass 或环境变量，并提供合理默认值。

---

### 🟢 P2 — 可以稍后处理

#### 9. 缺少日志子系统

整个项目用 `print()` 做输出，无法区分用户消息和诊断日志。不支持：
- 静默/安静模式
- 日志写文件 + stdout 输出分离
- 按严重级别过滤

**建议**：引入 `logging` 标准库，用户消息保留 `print()` 或走 `src/ui.py`。

#### 10. 异常类型过于粗糙

全局用 `RuntimeError` 做通用异常，`CLIExit` 仅用于命令控制流。

**建议**：建立异常层次 — `ApiError`, `NetworkError`, `ConfigError`, `DownloadError` 继承 `ThunderSubtitleError`。

#### 11. 不一致问题

| 问题 | 影响 |
|---|---|
| 注释语言混用（中/英） | 可读性差 |
| 类型注解覆盖不均 | mypy 检查不完整 |
| `import` 风格不一致（顶层/延迟/内联） | 维护困难 |
| `src/scanner/` 内部循环依赖（`_parallel → _io → _processor → _skip`） | 脆弱 |

#### 12. `format_duration()` 不支持小时

`format_duration(3600000)` 输出 `"60m 0s"` 而非 `"1h 0m 0s"`，实现不完整。

---

## 三、优化路线图建议

```
Phase 1 (1-2天): 安全加固
├── 11处 OSError 沉默 → logging.warning
├── 统一 CJK 字符范围常量
└── 异常体系建立（ThunderSubtitleError 基类）

Phase 2 (2-3天): 核心重构
├── _check_skip() 拆分 + 测试
├── _search_and_download() 拆分
├── cli.py main() 拆分
└── review_directory() 拆分为 mark/review

Phase 3 (1-2天): 消除重复
├── 时长过滤统一
├── GCID 加载统一
├── .dumped 清理统一
└── 硬编码常量 → Config

Phase 4 (1-2天): 补齐测试
├── _check_skip() 测试（最重要）
├── _search_and_download() 测试
├── review_directory() 测试
├── dump_subtitles() 测试
└── 其他缺口补齐

Phase 5 (1天): 工程改进
├── 引入 logging 模块
├── 统一 import 风格
├── 统一类型注解
├── 统一注释语言
└── 修复 format_duration() 小时支持
```

---

## 四、不变更项（保持现状）

- **外部依赖**：保持 `requests` 唯一依赖，不引入 aiohttp/httpx 等
- **Python 版本**：保持 ≥3.10 基线
- **包结构**：`commands/` 和 `src/` 的顶层分离暂不调整（涉及 pyproject.toml 入口点变更风险）
- **架构风格**：保持函数式 + dataclass 风格，不引入 OOP 继承体系

---

## 五、关键指标

| 指标 | 当前 | Phase 1后 | Phase 3后 |
|---|---|---|---|
| 最长函数行数 | 232 (`main`) | 232 | ≤ 50 |
| `_check_skip` 决策点 | 8+ | 8+ | ≤ 3/函数 |
| 沉默异常数 | 11 | 0 | 0 |
| 测试覆盖缺口 | 7个核心函数 | 7 | 0 |
| 代码重复块 | 5处 | 5 | 0 |
| 硬编码配置常量 | 8个 | 8 | 0 |

---

## Acceptance Criteria

- [ ] 所有 P0 项有明确的优化方案（拆分方案、函数签名草案）
- [ ] 所有 P1 项有可行的优化方向
- [ ] 优化路线图时间估算合理
- [ ] **不修改任何代码**
