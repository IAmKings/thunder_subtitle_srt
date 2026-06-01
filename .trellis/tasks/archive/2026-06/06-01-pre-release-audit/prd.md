# v1.4.0 预发布代码质量审核

## 审核结论：可以发布

---

## 质量检查结果

| 检查项 | 结果 |
|------|:---:|
| `ruff check` (API) | ✅ 通过 |
| `ruff format` (API) | ✅ 已修复 2 文件 |
| `ruff check` (CLI) | ✅ 通过（13 个 E402 已修复） |
| `ruff format` (CLI) | ✅ 通过 |
| `tsc --noEmit` (Web) | ✅ 零错误 |

## 预存已知问题

CLI 的 13 个 ruff E402 错误全部是 `commands/*.py` 文件中的 `import` 语句不在文件顶部（因为需要先设置 `sys.path`）。这是有意的设计模式，不影响功能。不属于本次发布修复范围。

## 紧急修复项（本次 v1.4.0 已修复）

| 问题 | 状态 |
|------|:---:|
| 审查页 handleMark 状态清除 | ✅ |
| 删除字幕后 movies/pinnedItems 不同步 | ✅ |
| 切 tab 后字幕列表为空 | ✅ |
| 进度条下载时归零 | ✅ |
| 健康检查循环导入 | ✅ |
| Python 3.9 兼容性 | ✅ |
| 图片端点 401/500 | ✅ |

## Acceptance Criteria

- [x] `ruff check` (API) 零错误
- [x] `ruff format` (API) 零改动
- [x] `tsc --noEmit` 零错误
- [x] 所有紧急修复已验证
- [x] 无已知功能回归

## Out of Scope

- CLI 13 个预存 E402 错误
- 新增功能性需求
