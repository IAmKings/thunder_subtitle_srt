# 字幕审查模式 (review)

## Goal

独立 `review` 命令，扫描目录下已下载的字幕文件，自动检测质量问题，帮助用户在 dry-run 预览和下载后发现不可用字幕。

## Decision (ADR-lite)

**Context**: 批量下载后无法确认字幕可用性
**Decision**: 独立 `review` 命令（方案 A），与 `scan` 平级
**Consequences**: 扫描和审查分离，review 可对任何目录独立运行

## Requirements

1. `review` 命令扫描 `演员/电影/` 目录，检测字幕文件质量
2. 支持 `--dry-run` 仅报告不修改
3. 支持 `--log` 输出审查报告文件
4. 支持 `--filter` 按电影名筛选

### MVP 审查项

| 检查项 | 判定 | 说明 |
|--------|:--:|------|
| 文件编码 | ⚠️ Warn | 非 UTF-8 编码（GBK/Big5/未知）标记警告 |
| 文件大小 | ❌ Fail | < 200 bytes 视为空文件或损坏 |
| SRT 结构 | ❌ Fail | 无合法时间轴线 `00:00:00,000 --> ` 视为格式错误 |
| 中文内容 | ⚠️ Warn | .zh 文件但中文字符占比 < 5%，可能不是中文 |

### 输出格式

```
[1/5] 演员A/流浪地球
  ✓ 流浪地球.zh.srt — OK (UTF-8, 42KB, 856 lines, Chinese 62%)
  ✓ 流浪地球-alt.zh.srt — OK (UTF-8, 38KB, 720 lines, Chinese 58%)

[2/5] 演员B/盗梦空间
  ⚠ 盗梦空间.zh.srt — WARN: GBK encoding, may have garbled text
  ✗ 盗梦空间-alt.zh.srt — FAIL: only 156 bytes, likely corrupted

Summary: 2 OK, 1 WARN, 1 FAIL
```

## Acceptance Criteria

- [ ] `review` 命令可扫描演员/电影目录结构
- [ ] 检测字幕文件编码（UTF-8/GBK/其他）
- [ ] 检测文件大小异常
- [ ] 验证 SRT 格式合法性
- [ ] 检测 .zh 文件的中文内容占比
- [ ] dry-run 模式下显示审查信息
- [ ] 支持 `--log` 输出报告文件
- [ ] 汇总统计

## Out of Scope

- ASS/SSA 格式解析（只做 SRT）
- 自动修复字幕
- 翻译质量评估

## Technical Approach

- 新建 `src/reviewer.py`
- `cli.py` 添加 `review` 子命令
- 复用 `scanner.py` 的 `scan_movie_dirs` 目录扫描
- 复用 `scanner.py` 的 `_find_existing_subtitle` 查找字幕文件
