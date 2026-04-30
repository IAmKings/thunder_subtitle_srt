# CLI 支持时间长度匹配筛选

## Goal
给 `search` 命令添加 `--max-duration` 参数，支持按视频时长筛选字幕，以"最接近但不超过"为匹配标准。

## Requirements
- 添加 `-d, --max-duration <duration>` 参数，支持人类可读格式（h/m/s）
- 筛选 `duration ≤ targetDuration` 的字幕，排除 duration=0（Unknown）的结果
- 按 duration 降序排列，最接近目标时长的排前面
- 无符合条件的结果时给出明确提示

## Acceptance Criteria
- [ ] `thunder-subtitle search "movie" -d 1h30m` 正常工作
- [ ] 支持 `1h`、`30m`、`45s`、`1h30m20s` 等组合格式
- [ ] 筛选后结果按 duration 降序排列
- [ ] duration=0 的字幕被排除
- [ ] 无符合条件字幕时给出错误提示

## Technical Notes
- 修改文件：`src/index.ts`、`src/search.ts`、`src/api.ts`
- `parseDuration` 工具函数放在 `api.ts`
- `filterByMaxDuration` 方法放在 `SubtitleApiClient`
