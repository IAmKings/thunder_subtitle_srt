# Web UI 遗留项修复：i18n、密码修改、Docker 验证

## Goal

修复 Round 2 遗留的 4 个未完成项，使 Web UI 达到可交付状态。

## What I already know

### 遗留问题清单

1. **i18n 硬编码字符串** — Scanner/Verification/Settings 页面中约 15-20 处 hardcoded 英文未使用 `t()`，违反 spec 规则
2. **Settings 密码修改** — 前端有 placeholder 表单，后端无改密 API
3. **Docker 端到端验证** — Dockerfile 已修复 API URL 注入，但未实际 `docker build` + `docker run` 验证
4. **端到端功能验证** — CLI 模块集成依赖实际运行，需验证 scan/review 流程可走通

## Decisions

### D1: 密码修改 API → POST /api/auth/change-password

**Context**: 前端 Settings 页面已有密码修改表单 placeholder。

**Decision**: 在 FastAPI auth router 中新增 `POST /api/auth/change-password` 端点，接收 `{ old_password, new_password }`，验证旧密码后更新。

**Consequences**:
- 前端表单可真正工作
- 单管理员模式下密码存在环境变量或配置中
- 未来扩展多用户时需要调整

## Requirements (evolving)

### i18n 修复

- Scanner 页面：所有 hardcoded 英文 → `t()` 调用
- Verification 页面：所有 hardcoded 英文 → `t()` 调用
- Settings 页面：所有 hardcoded 英文 → `t()` 调用
- 在 `i18n.ts` 中补充缺失的翻译 key（en + zh）

### 密码修改

- 后端：`POST /api/auth/change-password` 端点
- 前端：Settings 页面密码表单接入 API
- 错误处理：旧密码错误、新密码太短等

### Docker 验证

- `docker build` 成功
- `docker run -e ADMIN_PASSWORD=xxx -p 3000:3000` 可启动
- FastAPI + Next.js 两个进程通过 supervisord 正常运行

### 端到端验证

- 确认 scan_service 可正确调用 CLI scanner 模块
- 确认 review_service 可正确调用 CLI reviewer 模块
- 错误路径处理（模块不可用、文件不存在等）

## Acceptance Criteria (evolving)

- [ ] 所有页面零 hardcoded 英文字符串（全部使用 `t()`）
- [ ] 密码修改功能可用（前后端联调）
- [ ] Docker 构建成功 + 运行验证
- [ ] lint / typecheck 通过

## Definition of Done

- 所有页面 i18n 规范合规
- 密码修改端到端可用
- Docker 镜像可运行
- 代码 lint/typecheck 通过

## Out of Scope (explicit)

- 安卓客户端
- 多用户系统
- 新功能开发