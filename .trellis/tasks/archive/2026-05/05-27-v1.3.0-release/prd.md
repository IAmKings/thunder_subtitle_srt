# 1.3.0 预发布审查

## Goal

1.3.0 版本发布前轻量验证 + 版本更新。

## What I already know

- `tsc --noEmit`：零错误
- `pnpm lint`：0 error
- `ruff check`：全绿
- 版本号：`1.2.1`（需更新为 `1.3.0`）
- 1.2.1→1.3.0 增量：审查性能优化(轻量发现+按需深审)、扫描50ms sleep移除、`.preferred`偏好标记、API timing middleware、日志修复、422修复

## Requirements

1. 版本号更新三包 → `1.3.0`
2. 全量 lint/typecheck 确认
3. Docker 配置确认

## Acceptance Criteria

- [ ] `tsc --noEmit` 零错误
- [ ] `pnpm lint` / `ruff check` 全绿
- [ ] 版本号 `1.3.0`
