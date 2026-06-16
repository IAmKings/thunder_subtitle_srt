# 优化 SRT 解析容错与片尾关键词覆盖

## Goal

修复验证页 debug 模式反馈的两类高频问题：
1. SRT 正则解析过于严格，非标准格式的 .srt 文件只匹配到 1-2 条字幕
2. 片尾关键词覆盖不足，导致片尾名单漏过，时长统计偏差

## What I already know

- `_SRT_PATTERN` 需要严格 `\n\n` 双换行分隔，BOM/多余空格/空行格式偏差导致匹配失败
- `_CREDIT_KEYWORDS` 只有 10 个词，大量常见片尾行（监制/导演/特效/鸣谢等）漏过
- 前两个 commit（`e943ed5`、`d33d472`）已改为 `startswith` 匹配并删除日常词（感谢/致敬/特别）
- NFO 不存在时 `_apply_duration_match` 直接 return，整个时长体系瘫痪
- `_find_last_content_end` 50 条全跳过时兜底返回物理最后一条的 `end_ms`（仍是片尾时间）

## Requirements

### P0: SRT 解析容错
1. 检测并跳过 UTF-8 BOM（`\ufeff`）
2. 空行容错：连续空行（`\n\n\n`）和带空格空行（`\n \n`）均视为分隔符
3. 解析前做文本预处理，统一换行和空白

### P0: 片尾关键词扩充
4. `_CREDIT_KEYWORDS` 增加 20+ 常见片尾词
5. "字幕"泛词限缩为只在以"字幕"开头且该行包含冒号时才匹配

### P1: NFO 缺失降级
6. 无 NFO 时使用 SRT 最后有效时间戳（跳过片尾后）反推片长
7. `_apply_duration_match` 在无 NFO 时不直接 return，而是用 SRT 推算片长做质量标记

### P2: 兜底优化
8. `_find_last_content_end` 50 条全被跳过时，扩大扫描窗口到 100 条

## Acceptance Criteria

* [ ] SRT 文件带 BOM 头能正确解析全部条目
* [ ] 空行格式不标准的 SRT 文件能正确解析
* [ ] 片尾"监制：XX"、"导演：XX"、"后期制作：XX"等被正确识别并跳过
* [ ] "字幕"不误伤正片对白
* [ ] 无 NFO 时也能输出可参考的片长（基于 SRT 最后有效时间戳）
* [ ] lint / type check 通过
* [ ] 现有测试通过

## Out of Scope

* SSA/ASS 格式支持
* 正则引擎替换

## Technical Notes

* 涉及文件:
  - `thunder-subtitle-py/src/reviewer/_srt.py` — `_parse_srt_entries`、`_CREDIT_KEYWORDS`、`_find_last_content_end`
  - `thunder-subtitle-py/src/reviewer/_review.py` — `_apply_duration_match`
  - `thunder-subtitle-py/src/reviewer/__init__.py` — `debug_review_subtitle`
* 现有测试: `thunder-subtitle-py/tests/test_reviewer.py`
