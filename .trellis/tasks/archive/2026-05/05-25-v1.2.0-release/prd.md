# 1.2.0 预发布审查与归档

## Goal

1.2.0 版本发布前轻量审查 + 版本更新 + 文档同步。

## What I already know

- `tsc --noEmit`: 零错误
- `pnpm lint`: 0 error
- `ruff check`: All checks passed
- 版本号: `1.1.0`（需更新为 `1.2.0`）
- 文档已经在上次重构（根 README + 三模块 README）
- 1.1.0→1.2.0 增量：P0×5 + P1/P2×67 + HTTPS自签名 + PWA优化 + PWA三UI修复 + 库路径文件夹名

## Requirements

1. 版本号更新：`package.json` / `thunder-subtitle-api/pyproject.toml` / `thunder-subtitle-py/pyproject.toml` → `1.2.0`
2. 全量 lint/typecheck 确认
3. README 文档同步（检查模块 README 是否需要更新以反映新特性）
4. Docker 配置确认

## Acceptance Criteria

- [ ] `tsc --noEmit` 零错误
- [ ] `pnpm lint` 零 error
- [ ] `ruff check` / `ruff format --check` 全绿
- [ ] 版本号统一为 `1.2.0`
- [ ] README 文档无遗漏新特性
