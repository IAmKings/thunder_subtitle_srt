# 验证模块字幕内容预览功能

## Goal

选中字幕后，右侧面板展示字幕文件内容预览（前 N 行），帮助用户判断字幕质量。

## What I already know

- 当前右侧面板选中字幕后仅显示元数据（评分、中文占比、编码）
- `ReviewItem.file_path` = 电影目录路径，`file_name` = 字幕文件名
- 完整路径 = `{file_path}/{file_name}`
- 后端无读取字幕文件内容的 API

## Requirements

### R1: 后端预览 API

`GET /api/review/preview?path={subtitle_path}` — 返回字幕文件前 50 行文本内容

- 自动检测编码（utf-8 / gbk / utf-16）
- 返回 `{ content: string, encoding: string, total_lines: number }`
- 路径非法时返回 404

### R2: 前端预览展示

- 选中字幕时自动请求预览
- 右侧面板元数据卡片下方展示预览区域
- 暗色背景 + 等宽字体，前 50 行滚动显示
- 底部显示 "Preview: 50 / 1234 lines"

### R3: 预览交互

- 选中不同字幕时自动刷新预览
- 预览区域可独立滚动
- 加载中显示 spinner

## Acceptance Criteria

* [ ] 选中字幕后右侧面板显示内容预览
* [ ] 预览显示前 50 行，底部标注行数
* [ ] 切换字幕自动刷新预览
* [ ] 预览区域可滚动

## Out of Scope

* 全文预览
* 高亮中文字符
* 时间轴解析

## Open Questions

（无——需求已明确）
