# v1.3 版本发布前全面代码审查

## 审查范围

| 维度 | 文件数 | 发现数 |
|------|:---:|:---:|
| 前端 (Next.js/React/TS) | 33 | 41 |
| 后端 (Python/FastAPI/CLI) | 38 | 33 |
| 跨层+部署+安全 | 全局 | 17 |
| **合计** | **71+** | **91** |

详细报告见 `research/` 目录。

---

## 致命发现 (10 项) — 发布前必须修复

### 安全漏洞 (7 项)

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 1 | **路径穿越** — `/api/media/image` 直接用 `Image.open(path)` 无校验 | `media.py:46` | 任意文件读取 |
| 2 | **路径穿越** — `/api/review/subtitle/file` 跳过 `_validate_subtitle_path()` | `review.py:135` | 目录逃逸 |
| 3 | **SSRF** — 下载端点 `url` 参数无白名单校验 | `subtitle.py:91` | 内网探测 |
| 4 | **明文密码** — `passlib` 声明但未用，密码明文存 JSON | `config.py:35` | 文件泄露=密码泄露 |
| 5 | **JWT 库过时** — `python-jose` 2021 年停更，已知 CVE | `requirements.txt:3` | JWT 可伪造 |
| 6 | **默认密码** — admin/changeme + 硬编码 JWT secret | `config.py:19` | 默认部署可被接管 |
| 7 | **JWT 存 localStorage** — XSS 即可窃取 token | `auth.tsx:68` | 会话劫持 |

### 功能缺陷 (3 项)

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 8 | **Docker 搜索彻底损坏** — legacy `SubtitleApiClient` 路由在 Docker 中 404 | `ThunderSubtitleApp.tsx:40` | 搜索功能不可用 |
| 9 | **`dangerouslySetInnerHTML`** — layout.tsx 注入 SW 脚本 | `layout.tsx:34` | XSS 防护绕过 |
| 10 | **Pillow 未声明依赖** — `media.py` 导入 `PIL` 但 `requirements.txt` 无此项 | `media.py:9` | 生产部署 ImportError |

---

## 高优先级 (17 项) — 建议发布前修复

| # | 问题 | 位置 |
|---|------|------|
| 11 | 登录端点无速率限制（暴力破解） | `auth/router.py:62` |
| 12 | `httpx.AsyncClient` 永不关闭（连接池泄漏） | `subtitle.py:22` |
| 13 | WebSocket broadcast 死连接不清理 | `ws/manager.py:54` |
| 14 | `ScanService._tasks` 无锁（竞态条件） | `scan_service.py:38` |
| 15 | `max_concurrent_tasks=2` 从未强制执行 | `tasks.py:51` |
| 16 | 下载链接无错误处理 | `SubtitleList.tsx:27` |
| 17 | `withAuth` HOC 无 fallback（无限 spinner） | `auth.tsx:179` |
| 18 | 登录页面未国际化 | `login/page.tsx` |
| 19 | 搜索页输入框缺少 `<label>`（WCAG） | `search/page.tsx:132` |
| 20 | `t()` 函数用 `string` 类型无编译时校验 | `i18n.ts:472` |
| 21 | API 代理缺 `proxy_read_timeout`（60s 太短） | `nginx.conf:15` |
| 22 | `review_service.py` 不用 `cli_import()`（不一致） | `review_service.py:84` |
| 23 | `ConfigService` 每次请求都实例化（性能） | `review_service.py:27` |
| 24 | 进度同步靠 `asyncio.sleep(0.2)` 魔法数字 | `scan_service.py:320` |
| 25 | 健康检查错误响应泄露堆栈 | `health_check.py:49` |

---

## 中低优先级 (64 项) — 可延后修复

详见各 `research/*.md`。摘要：

| 类别 | 数量 | 典型问题 |
|------|:---:|------|
| 类型安全 | 4 | `as Type` 无校验、Pydantic↔TS 类型不对齐 |
| i18n | 3 | key 命名不一致、遗留组件硬编码中文 |
| 可访问性 | 4 | 缺 `aria-label`、`aria-pressed`、`alt` 文本 |
| 代码质量 | 8 | 重复代码、全局可变状态、遗留组件 |
| 配置 | 5 | 敏感默认值、`.env.local` 提交、CORS 硬编码 |
| Nginx | 3 | 缺安全头、WebSocket 缓冲、SSL 端口 |
| 测试 | 1 | FastAPI 后端 0% 测试覆盖率 |

---

## 建议修复优先级

### 发布前（P0 致命，5 小时内可修完）

```
1. 路径穿越 ×2 → 加 _validate_subtitle_path() (30min)
2. SSRF → 加 URL allowlist (15min)
3. 密码 → 接入 passlib bcrypt (1h)
4. JWT 库 → 迁移 PyJWT (1h)
5. 默认密码 → 生产环境 env 为空时启动报错 (15min)
6. Pillow 依赖 → 加入 requirements.txt (5min)
7. Docker 搜索 → 切换 fastApiClient (1h)
8. dangerouslySetInnerHTML → 改为外部脚本 (30min)
```

### 发布后（P1 高，v1.3.1）

```
登录速率限制、死连接清理、线程安全锁、i18n 补全、Nginx 超时
```

### 后续版本（P2 中低，v1.4+）

```
类型对齐、可访问性、代码去重、测试覆盖
```

---

## Out of Scope

- 功能性新需求
- 架构重构
- 第三方 API 替换
