# 1.1.0 预发布前最终审查优化

## Goal

1.1.0 版本发布前轻量验证——确认全量 lint/typecheck、版本号统一、Docker 配置正确、无遗漏问题。

## Decision (ADR-lite)

**Context**: 1.1.0 增量 8 个 bug 修复 + 3 个审查优化 + 移动端适配，所有改动已逐一验收通过。
**Decision**: 轻量验证——全量检查 + 版本号更新 + Docker 配置扫一眼，不做逐文件精读。
**Consequences**: 快速发布，信任之前的验收结果。

## Requirements

1. 全量 lint/typecheck 通过
2. 版本号 `1.0.2` → `1.1.0`（`package.json` / `pyproject.toml`）
3. Docker 配置验证（Dockerfile / supervisord / nginx.conf）
4. `README_DEPLOY.md` 端口说明检查（8000 已移除？）
5. 确认无遗漏的硬编码中文或 `console.log`

## Acceptance Criteria

- [x] `tsc --noEmit` 零错误
- [x] `pnpm lint` 零 error
- [x] `ruff check` + `ruff format --check` 全绿
- [ ] 版本号统一为 `1.1.0`
- [ ] Docker 配置可正常构建

## Out of Scope

- 逐文件精读
- 大规模重构
- 新功能开发
- E2E 测试
