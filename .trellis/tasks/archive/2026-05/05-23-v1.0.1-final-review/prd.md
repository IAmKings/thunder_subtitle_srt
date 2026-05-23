# 1.0.1 预发布前最后一轮代码审查

## Goal

上一轮深度重构完成后的最终验证轮 — 逐文件精读、查漏补缺、确认零回归、确保发布就绪。

## Decision (ADR-lite)

**Context**: 上一轮完成了大规模重构，需要发布前最后一轮审查确保质量。
**Decision**: 逐文件精读 — 全面覆盖前后端所有改动文件，检查边界条件、错误处理、安全、性能。
**Consequences**: 审查范围广，但不做大改动，只修明确问题。

## Requirements

### 前端审查（逐文件）
1. **4个页面**: scanner, verification, settings, search — 边界条件、error/loading/empty 状态完整性
2. **7个新组件**: ConfirmDialog, StatusBadge, SubtitlePreview, MovieList, VerificationSubtitleList, VerificationFilterBar, VerificationStats — props 类型、边界值
3. **lib 文件**: api.ts, auth.tsx, i18n.ts, types.ts, scanner-state, verification-state, search-state
4. **硬编码中文扫描**: 区分 i18n fallback 和遗漏的硬编码

### 后端审查
5. **路由**: config, media, review, subtitle, tasks — 错误处理、参数校验
6. **服务层**: config_service, review_service, scan_service, subtitle_service — 资源清理

### 部署审查
7. **Dockerfile**: 构建步骤、依赖安装
8. **supervisord.conf**: 进程管理配置
9. **版本号**: pyproject.toml, package.json 一致性

## Acceptance Criteria

- [ ] `tsc --noEmit` 零错误
- [ ] `pnpm lint` 零 error
- [ ] `ruff check` + `ruff format --check` 零问题
- [ ] 前端所有页面 4 种状态完整（loading/error/empty/data）
- [ ] 用户可见字符串无硬编码中文
- [ ] Docker 配置可正常构建启动
- [ ] 版本号 1.0.1 在所有配置文件中一致

## Definition of Done

- 所有 lint/typecheck 全绿
- 审查发现的明确问题已修复
- 版本号一致
- 不涉及 git commit（用户未要求）

## Out of Scope

- 大规模重构/拆分
- 新功能开发
- E2E 测试
- CI/CD 配置变更

## Technical Notes

- 主要改动文件清单: scanner/page.tsx (817), verification/page.tsx (855), settings/page.tsx (597), search/page.tsx (429)
- 新增组件: ConfirmDialog, StatusBadge, SubtitlePreview, MovieList, VerificationSubtitleList, VerificationFilterBar, VerificationStats
- 后端改动: config_service.py, review_service.py + ruff format 文件
- Docker: Dockerfile, supervisord.conf
- 版本文件: pyproject.toml, package.json

## Open Questions

* 无
