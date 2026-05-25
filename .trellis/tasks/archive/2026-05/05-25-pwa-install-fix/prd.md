# PWA 安装提示 — HTTPS 自签名证书方案

## Goal

Docker 容器内置自签名 HTTPS，解决局域网 HTTP 访问无法触发 Chrome PWA 安装提示的问题。

## Decision (ADR-lite)

**Context**: PWA manifest + service worker 配置正确，但 Chrome 要求 HTTPS（localhost 除外），局域网 HTTP 无法触发安装提示。
**Decision**: Docker 内置自签名证书，Nginx 同时监听 443。HTTP 3000 端口保持不变。
**Consequences**: 用户访问 `https://192.168.1.x:3443` → 首次警告 → 继续 → PWA 提示出现。HTTP 3000 不受影响。

## Requirements

1. Dockerfile 加 openssl
2. nginx.conf 加 HTTPS server 块
3. docker-entrypoint.sh 启动时自动生成自签名证书
4. docker-compose.yml 暴露 3443:443
5. HTTP 3000 端口不受影响

## Acceptance Criteria

- [ ] `http://localhost:3000` 正常工作（无变化）
- [ ] `https://localhost:3443` 可访问（自签名证书）
- [ ] Chrome Android HTTP 3000 不弹安装提示（预期）
- [ ] Chrome Android HTTPS 3443 弹安装提示
