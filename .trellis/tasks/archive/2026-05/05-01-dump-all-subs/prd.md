# 全量字幕下载（dump 模式）

## Goal

当审查评分低或人工校验失败时，下载电影的全部匹配字幕，按 1.srt, 2.srt, ... 命名，方便用户逐个筛选最佳版本。

## What I already know

- `search --all` 已支持下载全部结果，但命名用 `{搜索名}.{ext}`
- `scan` 下载到电影目录，只下载 2 个（主力+备选）
- 审查标记用 `.reviewed` 空文件

## Open Questions

- 独立 `dump` 命令 vs 扩展现有 `search`？
