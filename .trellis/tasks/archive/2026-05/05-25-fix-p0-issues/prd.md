# 修复 5 个 P0 严重问题

## Goal

修复三包深度审查发现的 5 个 P0 问题。

## Requirements

### P0-1: setListPage 类型兼容
- `VerificationFilterBar.tsx`: `setListPage: (v: number) => void`
- `verification/page.tsx`: 简化包装函数

### P0-2: download 端点鉴权
- `subtitle.py`: download 路由加 `Depends(get_current_user)`

### P0-3: 路径遍历修复
- `review.py`: 新增 `_validate_subtitle_path()` 校验路径在媒体根目录内
- 动态读取 ConfigService.media_paths 作为白名单

### P0-4: 密码持久化
- `config.py` (CLI): `Config.save()` 加 `password` 字段 + `os.chmod 0600`
- `config.py` (CLI): `Config.load()` 优先读文件的 password，fallback env
- `auth/router.py`: `change_password` 调 `ConfigService.save_password()`

### P0-5: 并行 rate_limit
- `_parallel.py`: 新增线程安全 `_rate_limit_wait()` + 全局时间戳锁

## Acceptance Criteria

- [ ] `tsc --noEmit` 零错误
- [ ] `pnpm lint` 零 error
- [ ] `ruff check` 全绿
- [ ] download 端点无 token 返回 401
- [ ] 路径穿越 payload 返回 403
- [ ] 改密码后重启容器密码仍生效
