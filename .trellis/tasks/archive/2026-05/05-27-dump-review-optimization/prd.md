# 暴力下载字幕组标识 + 大库审查性能优化

## Goal

1. 暴力下载时标记偏好字幕组字幕
2. 解决 4000+ 文件审查页面性能问题

## 问题 1：暴力下载字幕组标识

### 需求

暴力下载时以 `1.srt`、`2.srt` 重命名所有字幕，用户无法知道哪个是偏好字幕组的。需要一个旁路标记——不影响 `.dumped`/`.rejected` 的增量更新逻辑。

### 方案：独立 `.preferred` 文件

**生命周期**：

```
dump 开始 → clear_file(.preferred)  ← 清空旧映射，避免编号复用误判
dump 下载 → 每下载成功一个，检查 preferred_groups
           → 命中则写 .preferred: "3.srt: hhd800.com@11123-zh-CN"
mark fail → .preferred 保留（标记仍有意义）
下次 dump → .preferred 清空重建
```

**文件格式**：`文件名: 字幕原名`（每行一条，用于人工和审查器识别）

**关键约束**：
- `.preferred` 不存 GCID，只存文件名→原名映射
- 不参与 `dump_subtitles` 的增量跳过逻辑
- 不参与 `_review_one_file` 的评分计算
- 与 `.dumped` 同时清空，避免旧编号映射残留

### 文件
- `_processor.py`: `_dump_all_subtitles` 新增 `clear_file(.preferred)` + 写入逻辑
- `_review.py`: 可读取 `.preferred` 显示标记，不影响 score

---

## 问题 2：4000+ 文件审查超时

### 根因：`review_directory` 全量跑了 `_review_one_file()`

```
验证页电影列表需要的数据：
  filePath, fileName, fileCount, reviewStatus
  → 全部来自文件系统（os.listdir + .reviewed 检查）
  → 无需 encoding/SRT/CJK

review_directory 实际做了：
  每部电影 × 每个字幕文件 × _review_one_file()
  = 8000 次 encoding检测 + SRT解析 + CJK占比
  = ~24 分钟白算
```

`review_directory` 是 CLI 一次性全量工具，被 Web UI 的电影列表视图原样复用。电影列表不展示 score/encoding/cn_ratio，但为每个文件跑完了全套深审。

### Bug 2a：错误提示残留

`loadReviews` 成功后未清 `error` 状态。第一次超时设了 error → 第二次成功但 `setError(null)` 没调 → 红色错误条残留。

### 修复计划

**PR1：紧急止血（5 行，即时见效）**

| 文件 | 改动 |
|------|------|
| `verification/page.tsx` | `loadReviews` 成功时加 `setError(null)` |
| `verification/page.tsx` | 多目录循环加 try/catch，单个失败不阻塞 |
| `api.ts` | `DEFAULT_TIMEOUT` 30s → 90s |

**PR2：拆分轻量发现 + 按需深审（核心优化，~100 行）**

新增 `list_review_movies(base_dir)` 函数（CLI + API 两端）：

```
list_review_movies()  ← 电影列表用，只做文件系统操作
  ├── scan_movie_dirs()
  ├── parse_nfo()
  ├── _find_all_subtitle_files()
  ├── .reviewed 检查
  └── 返回轻量 MovieEntry[] {path, name, fileCount, reviewStatus}

review_subtitle_file()  ← 字幕详情用，按需深审单个文件
  └── _review_one_file()
```

| 场景 | 当前 | 修复后 |
|------|------|--------|
| 电影列表加载 4000 部 | ~24 分钟（超时） | ~5 秒 |
| 点入某个电影字幕列表 | 已有数据（白算的） | 按需深审 ~6 秒 |
| 总首次体验 | 超时/白屏 | 5 秒进入 + 按需加载 |

**PR3：审查结果缓存（后续版本）**

`.review-cache` JSON 文件，mtime 不变则跳过深审。

### 文件改动汇总

| PR | 文件 | 改动量 |
|----|------|--------|
| PR1 | `verification/page.tsx`, `api.ts` | 5 行 |
| PR2 | `reviewer/__init__.py` (新增 `list_review_movies`) | 40 行 |
| PR2 | `review_service.py` (新增 `list_movies` 端点) | 20 行 |
| PR2 | `review.py` (API route) | 15 行 |
| PR2 | `verification/page.tsx` (调用新接口) | 15 行 |
| PR2 | `i18n.ts` | 可选 |
| PR3 | 后续 |

## Acceptance Criteria

- [ ] 电影列表加载 4000 部不超时
- [ ] 错误提示不残留
- [ ] 字幕详情按需加载深审数据
- [ ] 暴力下载偏好字幕组有标记
- `tsc --noEmit` 零错误
- `ruff check` 全绿
