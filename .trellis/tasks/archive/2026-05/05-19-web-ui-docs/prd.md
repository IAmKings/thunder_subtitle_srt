# Web UI 部署文档 + 人工验证清单

## Goal

为 Thunder Subtitle Web UI 编写部署和验证文档，方便人工校验。

## Requirements

- 项目根目录新增 `README_DEPLOY.md`，包含：
  1. 本地开发启动方式（前端 + 后端）
  2. Docker 构建和运行方式
  3. 环境变量说明
  4. 人工验证清单（逐项可勾选）

## Acceptance Criteria

- [ ] `README_DEPLOY.md` 存在且包含上述 4 部分内容
- [ ] 内容基于实际代码（Dockerfile、supervisord.conf、docker-compose.yml）
- [ ] 验证清单覆盖所有 PRD AC 项

## Out of Scope

- 代码变更
- 自动化测试