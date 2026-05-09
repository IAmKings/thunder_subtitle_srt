# docs: README 同步 --force/--reset-fail/测试数量/reject说明

## Goal

更新 README.md 反映已实现的功能和当前项目状态。

## Requirements

* [x] 测试数量更新：126 → 196
* [x] scan 命令补充 `--force` 和 `--reset-fail` 参数说明
* [x] scan --dump 补充 `.rejected` 增量更新机制说明
* [x] dump 命令补充 `.rejected` 行为和 `--reset-fail` 重置说明

## Technical Notes

* 文件：`thunder-subtitle-py/README.md`
* 最近的提交：
  - `70a931b` — --dump reject不再计入download + 空gcid url_hash去重
  - `ea8f17f` — 异常体系+核心重构+去重+测试补齐
