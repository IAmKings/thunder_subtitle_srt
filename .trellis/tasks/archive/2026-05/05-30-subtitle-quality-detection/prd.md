# 字幕质量检测增强 — AI 字幕识别 + 不流畅性检测 + 片长匹配

## 设计原则

1. **评分是推荐，不是审判** — 自动检测结果只辅助用户决策，绝不自动拒绝字幕
2. **AI 特征 ≠ 质量差** — 新电影没有字幕组介入时，AI 字幕是唯一选择，应可用
3. **维度独立，互不污染** — 结构性缺陷可以 fail；AI 嫌疑和截断判定只标记不否决
4. **用户验证 > 算法判断** — 最终质量判定必须经过用户审查确认

## 背景

当前审核系统已有百分制评分，覆盖结构性检测。但缺少三个关键能力：
1. AI/机器翻译字幕识别
2. 字幕片长与电影 NFO 片长对比（版本匹配检测）
3. 超长时间戳（宣传字幕）和截断检测

## 三检测体系

### 检测体系 1：结构质量（已有 + 扩展）— 影响 `score`

字幕文件的**物理质量**：

| 检测项 | 扣分 |
|------|:---:|
| 文件不存在/过小 | 直接 fail |
| **文件过大 (> 5MB)**（新增） | -20 |
| SRT 无有效条目 | -30 |
| 时间轴重叠 | -15 |
| .zh 文件中文占比 < 5% | -20 |
| 序号不连续 | -10 |
| 空内容条目 | -10 |
| 非 UTF-8 编码 | -10 |
| 单行 > 60 字 | -10 |
| **阅读速度 > 10 字/秒**（新增） | -5 |
| **单条持续 > 7 秒**（新增） | -5 |
| 时长 < 500ms | -5 |
| 解码回退 | -5 |

→ 结构评分 ≤ 50 才算 fail

### 检测体系 2：AI 嫌疑（新增）— 独立 `ai_flags` 列表，不参与 score

| 检测项 | 触发条件 | flag |
|------|------|------|
| 机翻标志 | `mt != 0` | `machine_translation` |
| 长句重复 | 同句 ≥ 15 字出现 ≥ 3 次 | `repeated_long_lines` |
| 时间轴均匀 | 帧间隔标准差 < 阈值 | `uniform_timing` |

AI 嫌疑项**只写入 `ai_flags`**，不参与 score，绝不导致 fail。

### 检测体系 3：片长匹配（新增）— 影响 `score` + `ai_flags`

对比 SRT 最后有效时间戳与 NFO 片长，检测版本匹配问题。

**找"最后有效字幕"算法**：

```
1. 从末尾逆向扫描最后 15 条
2. 跳过片尾名单模式（匹配关键词：翻译、校对、字幕组、压制、发布、感谢、致敬、www、http）
3. 跳过异常时间戳：end_ms > NFO片长 × 1.5 → 这是 9999 秒宣传字幕、陋习
4. 第一条不匹配的 → "最后有效内容字幕"
```

片尾关键词模式：
`"翻译"、"校对"、"时间轴"、"压制"、"字幕组"、"字幕"、"发布"、"感谢"、"致敬"、"特别"、"www."、"http"、"下载"`

**时长比分级**（last_end_ms / nfo_duration_ms）：

| ratio | 判定 | 动作 |
|------|------|------|
| 85%~100% | 正常 — 字幕在片尾前结束 | 无 |
| 100%~105% | 略超 — NFO 精度浮动 | -5 |
| 105%~120% | 超出 — 可能不同版本 | -15 |
| > 120% | 严重超出 — 大概率版本不匹配 | -25 |
| 50%~70% | **可能截断** — 只到一半 | `possibly_truncated` flag（不扣分） |
| < 50% | 远低 — 可能截断或文件不完整 | `possibly_truncated` flag + 丢入 AI flags |

**跳过条件**（以下情况不做片长对比）：
- `nfo_duration_seconds == 0` — NFO 无时长信息
- `entries < 10` — SRT 条目太少，可能不完整
- `nfo_duration_seconds < 1800`（30 分钟）— 短片/剧集，使用宽松阈值（> 110% 才触发）

**关于 `possibly_truncated` flag 的说明**：
为什么只标记不扣分？因为字幕行几乎不以句号结尾，无法用文本模式判断是否截断。电影对话密度差异巨大（动作片 vs 话痨片），条目数和文件大小也不能直接判定。只用 `< 70%` 的时长比作为信号，供用户参考，不自动扣分。

## 边界情况处理总结

| 边界情况 | 处理方式 |
|------|------|
| 9999 秒宣传字幕 | end_ms > NFO × 1.5 → 跳过，往上找 |
| 截断 SRT（只到一半） | ratio < 70% → `possibly_truncated` flag |
| NFO 无 duration | 跳过片长检测 |
| 短片/剧集 | < 30min → 宽松阈值 |
| 条目 < 10 | 跳过检测 |

## 改动范围

| 文件 | 改动 |
|------|------|
| `thunder-subtitle-py/src/reviewer/_srt.py` | `_check_srt_quality()` 新增：阅读速度、长句重复、时间轴均匀度、单条过长。返回值新增 `ai_flags`；新增 `_find_last_content_end()` 函数 |
| `thunder-subtitle-py/src/reviewer/_review.py` | `ReviewItem` 新增 `ai_flags: list[str]` + `last_end_ms: int`；`_review_one_file` 接入 `nfo_duration_seconds` 和 `mt` |
| `thunder-subtitle-py/src/scanner/_processor.py` | `_search_and_download` 传递 `mt` |
| `thunder-subtitle-api/app/models/schemas.py` | `ReviewItemResponse` 新增 `ai_flags: list[str]` + `last_end_ms: int` |
| `thunder-subtitle-api/app/services/review_service.py` | `review_subtitle_file` 传 NFO 时长 + mt；执行片长对比检测 |
| `thunder-subtitle-web/src/lib/types.ts` | `ReviewItem` 新增 `ai_flags: string[]` + `last_end_ms: number` + `deductions: string[]` + `checks: string[]` |
| `thunder-subtitle-web/src/components/VerificationSubtitleList.tsx` | 字幕条目显示评分 + 点击展开扣分明细 + AI 嫌疑标签 |

## Acceptance Criteria

- [ ] `mt != 0` → `ai_flags` 含 `machine_translation`
- [ ] 同句 ≥ 15 字出现 ≥ 3 次 → `ai_flags` 含 `repeated_long_lines`
- [ ] 时间轴均匀度过高 → `ai_flags` 含 `uniform_timing`
- [ ] ratio < 70% → `ai_flags` 含 `possibly_truncated`
- [ ] ratio > 120% → 扣 25 分
- [ ] ratio 105%~120% → 扣 15 分
- [ ] 9999 秒宣传字幕 → end_ms 被跳过，不影响计算结果
- [ ] AI 嫌疑项不参与结构评分，不导致自动 fail
- [ ] 结构质量检测行为与改前一致（回归）
- [ ] `ruff check` 零错误 / `tsc --noEmit` 零错误

## Out of Scope

- 自动审核/自动拒绝
- NLP/LLM 语义分析
- 翻译腔文本特征
- 上传者信誉系统
- 用户反馈闭环
- 多字幕评分推荐排序（后续 PRD，本次打基础）
