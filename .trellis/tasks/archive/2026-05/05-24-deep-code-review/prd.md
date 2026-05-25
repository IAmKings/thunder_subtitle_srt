# 三包深度代码质量审查

## Goal

对 thunder-subtitle-web（Next.js）、thunder-subtitle-api（FastAPI）、thunder-subtitle-py（CLI）三个包进行深度代码质量审查，分三批进行。

## Decision (ADR-lite)

**Context**: 90 文件 12K 行，需系统性审查。
**Decision**: 分批进行 — web 前端 → api 后端 → py CLI，每批审查后确认再继续。
**Consequences**: 审查结果按包独立输出，问题按严重度排序。

## 审查维度

| 维度 | 标准 |
|------|------|
| **SOLID** | 单一职责、开闭原则、接口隔离 |
| **DRY** | 重复代码块、重复逻辑 |
| **KISS** | 过度设计、不必要的抽象 |
| **错误处理** | 异常捕获、边界条件、空值处理 |
| **类型安全** | any 类型、@ts-ignore、类型标注完整性 |
| **安全** | 认证、注入、敏感信息 |
| **性能** | 不必要的重渲染、N+1 查询、内存泄漏 |

## Requirements

### 第一批：thunder-subtitle-web（32 文件）
- 4 个核心页面：verification(900) / scanner(833) / settings(597) / search(427)
- 共享组件：AppShell, Sidebar, TopBar, ConfirmDialog, StatusBadge 等
- lib 文件：api.ts(367), auth.tsx, i18n.ts(435), types.ts, 3 个 state context
- 审查重点：组件拆分、状态管理、重复代码、类型安全

### 第二批：thunder-subtitle-api（21 文件）
- 路由：config, media, review, subtitle, tasks
- 服务层：config_service, review_service, scan_service(441), subtitle_service
- 审查重点：错误处理、参数校验、HTTP 状态码

### 第三批：thunder-subtitle-py（37 文件）
- scanner 模块（_skip, _processor, _parallel, _dir, _io）
- reviewer 模块（_marker, _review, _encoding, _srt, _output）
- 审查重点：代码组织、函数职责、CLI 与 API 的一致性

## Acceptance Criteria

- [ ] 每批审查完成，输出问题清单（严重度 + 文件 + 行号 + 修复建议）
- [ ] 问题按 P0（安全/Bug）/ P1（代码质量）/ P2（优化建议）分级
- [ ] `tsc --noEmit` / `ruff check` 全绿

## Out of Scope

- 修复代码（仅审查，不改动）
- 测试文件审查
- 配置文件（Dockerfile/supervisord/nginx）
