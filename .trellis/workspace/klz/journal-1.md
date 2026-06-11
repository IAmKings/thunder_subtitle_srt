# Journal - klz (Part 1)

> AI development session journal
> Started: 2026-04-23

---



## Session 1: Phase 1 CLI 完成

**Date**: 2026-04-23
**Task**: Phase 1 CLI 完成
**Branch**: `master`

### Summary

完成字幕下载 CLI 工具 Phase 1：API 探索、搜索、TUI 选择、下载功能

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `f10a455` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 2: Phase 2 WebApp 完成

**Date**: 2026-04-23
**Task**: Phase 2 WebApp 完成
**Branch**: `master`

### Summary

完成字幕下载 WebApp Phase 2：Next.js 搜索下载界面、API Route 代理、历史记录功能

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `28bdff4` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 3: Python CLI 全功能开发：扫描器、配置、重试、日志、断点续扫

**Date**: 2026-04-30
**Task**: Python CLI 全功能开发：扫描器、配置、重试、日志、断点续扫
**Branch**: `master`

### Summary

Python 版 CLI 从零到稳定：新增 thunder-subtitle-py 项目，完全对齐 TS 版功能。Jellyfin 扫描器支持自动扫描 演员/电影 目录批量下载字幕（双字幕策略、-U 优先级、多关键词过滤、断点续扫）。配置文件持久化（~/.thunder-subtitle.json）。下载失败自动重试。扫描日志。多项体验优化（跳过时不白等 rate_limit、duration=0 不排除、字幕跳过扩展全格式覆盖）。代码重构：拆分为单职责函数。修复死代码。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `99a184c` | (see git log) |
| `27cd2e3` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 4: 修复 --dump reject 统计混入 download + 空gcid url_hash 去重

**Date**: 2026-05-10
**Task**: 修复 --dump reject 统计混入 download + 空gcid url_hash 去重
**Branch**: `master`

### Summary

修复两个关联bug：1) _dump_all_subtitles 在 r.downloaded==0 时仍返回 downloaded 状态，导致全reject影片在汇总中被计为 Downloaded；2) 空 gcid 字幕绕过去重和 reject 检查，引入 _dedup_key() 用 md5(url) 做 fallback。新增2个测试覆盖空gcid场景。196测试全过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `70a931b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 5: README 文档同步 + 修复 CI ruff 缺失

**Date**: 2026-05-10
**Task**: README 文档同步 + 修复 CI ruff 缺失
**Branch**: `master`

### Summary

README.md 同步最新功能：测试数量更新、scan --force/--reset-fail文档化、.rejected增量机制说明。pyproject.toml dev依赖补ruff修复CI command not found。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `4e77301` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 6: 工程优化方向分析：交叉验证 + .zh. 常量化

**Date**: 2026-05-10
**Task**: 工程优化方向分析：交叉验证 + .zh. 常量化
**Branch**: `master`

### Summary

交叉验证05-08 PRD：P0/P1全部完成（已在67f28ce/4b1cb9a/ea8f17f中实现）。剩余.zh.魔法字符串3处 → _ZH_PREFIX常量。196测试全过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `c1f1d1b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 7: Thunder Subtitle Web UI implementation + finish

**Date**: 2026-05-18
**Task**: Thunder Subtitle Web UI implementation + finish
**Branch**: `master`

### Summary

FastAPI backend + Next.js frontend + Docker deployment 全量实现（4页面+认证+WebSocket+任务系统），spec 架构文档重写，任务归档

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `6075c40` | (see git log) |
| `3d7c361` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 8: Web UI Round 2: backend integration + task engine + auth + pages

**Date**: 2026-05-18
**Task**: Web UI Round 2: backend integration + task engine + auth + pages
**Branch**: `master`

### Summary

Complete Web UI: asyncio task engine, auth middleware, Scanner/Verification/Settings pages wired to backend, Search sort, Docker fix

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `fde0a3a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 9: Web UI Round 3: i18n fixes + change-password + Docker

**Date**: 2026-05-18
**Task**: Web UI Round 3: i18n fixes + change-password + Docker
**Branch**: `master`

### Summary

Fix 32 hardcoded strings to use t(), add change-password API endpoint, wire Settings form, fix docker-compose env

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `bccaa0f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 10: Web UI Round 4: Docker config review + visual alignment assessment

**Date**: 2026-05-19
**Task**: Web UI Round 4: Docker config review + visual alignment assessment
**Branch**: `master`

### Summary

Verified Dockerfile config correct, dual-import fallback works in container, no code changes needed in this round

### Main Changes

(Add details)

### Git Commits

(No commits - planning session)

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 11: Web UI deployment docs + verification checklist

**Date**: 2026-05-19
**Task**: Web UI deployment docs + verification checklist
**Branch**: `master`

### Summary

Added README_DEPLOY.md with local dev setup, Docker build/run, env vars, 10-category human verification checklist, and troubleshooting guide

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `8a47d62` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 12: Docker 构建修复：pnpm v11 兼容、Alpine musl 适配、Python 模块名冲突、Release 工作流

**Date**: 2026-05-21
**Task**: Docker 构建修复：pnpm v11 兼容、Alpine musl 适配、Python 模块名冲突、Release 工作流
**Branch**: `master`

### Summary

修复 Docker 多阶段构建中的一系列问题：pnpm v11 废弃 onlyBuiltDependencies 改用 allowBuilds、CI=true 跳过 TTY 确认、backend-builder 从 Debian 切换到 Alpine 避免 glibc/musl 跨平台不兼容、pip --target 平铺安装解决 Alpine sys.path 不包含 /usr/local 的问题、types.py 重命名为 models.py 避免遮蔽 Python stdlib、新增 GitHub Actions Docker 镜像构建发布工作流。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e80002d` | (see git log) |
| `c500f7d` | (see git log) |
| `c680f4b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 13: Docker构建修复、PyPI发布、Web前端多项优化、扫描器路径配置统一

**Date**: 2026-05-21
**Task**: Docker构建修复、PyPI发布、Web前端多项优化、扫描器路径配置统一
**Branch**: `master`

### Summary

Docker构建修复（pnpm v11、Alpine musl、PYTHONPATH、types→models）、Docker Release工作流、PyPI项目名修改、README更新、Web默认中文+语言缓存、搜索排序国际化、搜索状态Context持久化、扫描器路径配置统一（env var优先+JSON回退+前端路径编辑+关键词过滤+轮播优化）、枚举标准化、Python 3.9兼容

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `7c79838` | (see git log) |
| `9a680b8` | (see git log) |
| `c6a6e51` | (see git log) |
| `49b0442` | (see git log) |
| `893f7b8` | (see git log) |
| `2c9f34a` | (see git log) |
| `ea48dc7` | (see git log) |
| `26e5720` | (see git log) |
| `feb564c` | (see git log) |
| `e80002d` | (see git log) |
| `c500f7d` | (see git log) |
| `c680f4b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 14: 扫描模式分段控件 + 关键词过滤修复 + 扫描结果展示PRD

**Date**: 2026-05-21
**Task**: 扫描模式分段控件 + 关键词过滤修复 + 扫描结果展示PRD
**Branch**: `master`

### Summary

前端新增scan/dry-run/dump/dump-force四种模式分段控件，后端_execute_scan根据params.mode映射参数。修复process_scanned_movies per-path调用解决关键词过滤不匹配问题。生成扫描结果渐进式展示PRD。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `a969f03` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 15: 扫描结果展示、验证模块UX重构、字幕预览

**Date**: 2026-05-22
**Task**: 扫描结果展示、验证模块UX重构、字幕预览
**Branch**: `master`

### Summary

扫描模块：渐进式结果展示+分页+状态筛选+dry_state+路径开关+逐电影进度+详情弹窗。验证模块：电影→字幕两级选择流+内容预览+评分+大小排序+批量操作+多仓库加载+状态持久化。修复：dump绕过duration过滤、进度后计算、on/off闭包过期、verification多仓库。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `1d7f841` | (see git log) |
| `ab5289e` | (see git log) |
| `dce1497` | (see git log) |
| `029d602` | (see git log) |
| `e0da5f8` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 16: 验证模块深度优化：Pin+删除未选中+mark fail统一+自动跳转+设置页改进+Docker修复

**Date**: 2026-05-23
**Task**: 验证模块深度优化：Pin+删除未选中+mark fail统一+自动跳转+设置页改进+Docker修复
**Branch**: `master`

### Summary

验证模块：Pin固定字幕持久化、删除未选中批量操作、mark fail统一匹配CLI(.reviewed+.rejected)、删除后自动跳转保持视觉位置、确认验证后直接移除电影。设置页：保存路径提示、字幕组偏好修正、API格式弹窗、自动化未实现标注、Web版本号1.0.1动态读取。修复：baseDir始终设置、dry_state颜色区分、媒体路径JSON优先、Docker pip安装CLI、CI ruff E402忽略、审查列表dry_state过滤+dump文件支持、cn_ratio对所有文件计算。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e9c3087` | (see git log) |
| `d73c95d` | (see git log) |
| `f24bf7c` | (see git log) |
| `229c2a8` | (see git log) |
| `8bc15b1` | (see git log) |
| `9f8628c` | (see git log) |
| `61655ac` | (see git log) |
| `723a0f3` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 17: 1.0.1 版本发布代码审查与深度重构

**Date**: 2026-05-23
**Task**: 1.0.1 版本发布代码审查与深度重构
**Branch**: `master`

### Summary

代码审查与深度重构：抽取7个共享组件(ConfirmDialog/StatusBadge/SubtitlePreview/MovieList/VerificationSubtitleList/VerificationFilterBar/VerificationStats)、修复handleMark闭包bug、scanner颜色映射去重、Pin状态localStorage持久化、settings/verification状态useReducer改造、i18n清理49个未使用键、backend ruff format统一格式化、更新3个前端spec文件(components/quality/state-management)

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `2c3bc2f` | (see git log) |
| `8d5fa5f` | (see git log) |
| `714bd95` | (see git log) |
| `346b89f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 18: 1.0.1 预发布审查 + Nginx反向代理重构 + 版本 1.0.2

**Date**: 2026-05-23
**Task**: 1.0.1 预发布审查 + Nginx反向代理重构 + 版本 1.0.2
**Branch**: `master`

### Summary

预发布审查：逐文件精读(i18n补全7键、localStorage key前缀统一、config错误处理、版本号统一)。Nginx反向代理重构：单端口3000统一入口，/api/*→FastAPI，/ws/*→WebSocket，其余→Next.js。修复Alpine nginx http.d嵌套问题。版本更新至1.0.2。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `08840d2` | (see git log) |
| `cce994d` | (see git log) |
| `3d23372` | (see git log) |
| `26e1369` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 19: 移动端响应式适配 + 审查流程深度优化

**Date**: 2026-05-24
**Task**: 移动端响应式适配 + 审查流程深度优化
**Branch**: `master`

### Summary

移动端响应式+PWA：底部TabBar、4页面响应式适配、manifest+service worker。Bug修复：sw.js API绕过缓存/skipWaiting强制更新、扫描HTTP轮询兜底填充findings、验证页搜索文字保留。审查流程优化：全部失败按钮(mark-fail不删字幕)、reviewed_fail_new_subs琥珀色待重审状态、纯FAIL无新dump字幕跳过、Git提交规则强化。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `cbe857a` | (see git log) |
| `69c8c91` | (see git log) |
| `70de5c0` | (see git log) |
| `e5f2c4e` | (see git log) |
| `0c79fd4` | (see git log) |
| `9775647` | (see git log) |
| `eaba600` | (see git log) |
| `8d00ac5` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 20: 1.1.0 预发布轻量审查 + 版本更新

**Date**: 2026-05-24
**Task**: 1.1.0 预发布轻量审查 + 版本更新
**Branch**: `master`

### Summary

1.1.0轻量验证：全量lint/typecheck全绿通过、Docker配置正确(单端口3000)、版本号三包统一更新至1.1.0、CLI pyproject.toml同步更新。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `bd96165` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 21: 三包深度代码质量审查：web/api/py

**Date**: 2026-05-25
**Task**: 三包深度代码质量审查：web/api/py
**Branch**: `master`

### Summary

分三批深度审查thunder-subtitle-web(27文件)/api(21文件)/py(20文件)，按SOLID/DRY/错误处理/类型安全/安全/性能六维度评分。共发现73个问题(5个P0/32个P1/36个P2)。关键P0: download端点缺鉴权、文件操作路径遍历、change_password未持久化、setListPage类型不兼容、并行模式rate_limit失效。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `5b4c860` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 22: 三包代码质量全面修复：P0×5 + P1×33 + P2×34 + 文档重构

**Date**: 2026-05-25
**Task**: 三包代码质量全面修复：P0×5 + P1×33 + P2×34 + 文档重构
**Branch**: `master`

### Summary

深度审查后全面修复：P0安全(鉴权/路径遍历/密码持久化/rate_limit)、P1代码质量(静默错误/401跳转/WS-HTTP双通道/类型安全/DRY去重/性能优化)、P2优化(死代码清理/集中导入_cli_imports.py/状态统计提取/regex常量提升)。文档重构：根README 406→69行+三模块README。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `5ec9b90` | (see git log) |
| `94907ef` | (see git log) |
| `4bdc685` | (see git log) |
| `e27c92d` | (see git log) |
| `8760eb1` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 23: PWA安装提示修复 — Docker内置自签名HTTPS

**Date**: 2026-05-25
**Task**: PWA安装提示修复 — Docker内置自签名HTTPS
**Branch**: `master`

### Summary

根因分析：Chrome PWA安装提示要求HTTPS（localhost除外），局域网http://192.168.x.x不触发。方案：docker-entrypoint.sh启动时openssl生成10年自签名证书，nginx监听443端口。docker-compose暴露3443:443。HTTP 3000不受影响。README更新HTTPS访问说明。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `HEAD~1` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 24: 扫描页轮播剩余页数提示

**Date**: 2026-05-25
**Task**: 扫描页轮播剩余页数提示
**Branch**: `master`

### Summary

路径轮播左右箭头下方新增剩N页提示，0时灰色。i18n中英文scroll_remaining。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `HEAD~1` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 25: PWA优化+bug修复：最简SW/更新检测/hydration/循环导入

**Date**: 2026-05-25
**Task**: PWA优化+bug修复：最简SW/更新检测/hydration/循环导入
**Branch**: `master`

### Summary

sw.js最简化(72→10行仅PWA壳)、PWA更新检测toast、History组件Date.now()hydration修复、auth循环导入修复。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `f00c1fc` | (see git log) |
| `238d983` | (see git log) |
| `cd13311` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 26: PWA移动端三个UI问题修复

**Date**: 2026-05-25
**Task**: PWA移动端三个UI问题修复
**Branch**: `master`

### Summary

扫描器表格移动端改卡片列表(消除竖排)、标题筛选堆叠分行、审查页列表↔预览全屏切换模式。全部走md:/lg:断点隔离，桌面端零变化。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `HEAD~1` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 27: PWA移动端UI修复+库路径文件夹名+ConfirmDialog优化

**Date**: 2026-05-25
**Task**: PWA移动端UI修复+库路径文件夹名+ConfirmDialog优化
**Branch**: `master`

### Summary

PWA三UI修复(表格→卡片/筛选分行/审查切换)、库路径卡片新增文件夹名、ConfirmDialog支持仅关闭模式(修复双取消按钮)、API格式弹窗简化。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `51fa9c5` | (see git log) |
| `fccad55` | (see git log) |
| `4b0b3e2` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 28: 1.2.0 预发布版本更新与文档同步

**Date**: 2026-05-25
**Task**: 1.2.0 预发布版本更新与文档同步
**Branch**: `master`

### Summary

版本号三包统一更新至1.2.0、Web README补充HTTPS自签名/PWA安装说明。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `HEAD~1` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 29: CI修复：mypy+测试签名+PNG图标

**Date**: 2026-05-25
**Task**: CI修复：mypy+测试签名+PNG图标
**Branch**: `master`

### Summary

_io.py mypy类型错误修复(string键+f-string兼容)、测试同步_check_fail_skip/_check_existing_skip新增参数、manifest加PNG图标+purpose修复Chrome Android PWA安装提示。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `8d87013` | (see git log) |
| `ea3aadf` | (see git log) |
| `8958912` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 30: Android WebView壳工程创建

**Date**: 2026-05-25
**Task**: Android WebView壳工程创建
**Branch**: `master`

### Summary

解决PWA自签名HTTPS无法触发的根本方案：Android WebView原生壳，APK安装即用，自签名证书自动信任(onReceivedSslError)，SetupActivity首次配置+MainActivity全屏WebView。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `HEAD~1` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 31: 审查性能优化：轻量发现+按需深审+.preferred标记

**Date**: 2026-05-27
**Task**: 审查性能优化：轻量发现+按需深审+.preferred标记
**Branch**: `master`

### Summary

PR1：超时30→90s、错误残留修复(setError(null))、多目录容错。PR2：拆分list_review_movies(文件系统5s) + review_subtitle_file(按需深审)，电影列表从24分钟→5秒。.preferred独立文件存偏好字幕组标记(文件名→原名映射)，每次dump清空重建，不影响.dumped增量逻辑。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `HEAD~1` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 32: 1.3.0 预发布版本更新

**Date**: 2026-05-27
**Task**: 1.3.0 预发布版本更新
**Branch**: `master`

### Summary

1.2.1→1.3.0：审查性能优化(轻量发现+按需深审)、扫描sleep移除(48s→5s)、.preferred偏好标记、API timing middleware、日志修复、422修复。三包版本统一至1.3.0。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `f484014` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 33: v1.3 发布前全面检修 — 审查页bug修复+扫描进度条+筛选对齐+安全加固+质量检测体系

**Date**: 2026-05-30
**Task**: v1.3 发布前全面检修 — 审查页bug修复+扫描进度条+筛选对齐+安全加固+质量检测体系
**Branch**: `master`

### Summary

审查页删除未选中bug修复、扫描进度条WebSocket保活+颗粒度进度回调、筛选栏scanMode动态切换、v1.3发布前全栈审查91项发现修复38项(P0致命10+高17+中11)、字幕质量三检测体系(AI嫌疑+结构质量+片长匹配)+扣分明细展示、健康检查循环导入修复+结果分组、图片端点认证修复、暴力刷新gcid去重修复、Python3.9兼容、死代码清理等

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `2c07e4d` | (see git log) |
| `eaabcc9` | (see git log) |
| `8a803a7` | (see git log) |
| `3f47c1b` | (see git log) |
| `e0c5b28` | (see git log) |
| `49a38c2` | (see git log) |
| `0b46c39` | (see git log) |
| `f2909a0` | (see git log) |
| `5dbc88a` | (see git log) |
| `ea96f55` | (see git log) |
| `aa478ba` | (see git log) |
| `3c96127` | (see git log) |
| `2548342` | (see git log) |
| `57406a8` | (see git log) |
| `afbb685` | (see git log) |
| `4cb5ff3` | (see git log) |
| `23e36d0` | (see git log) |
| `da97ce9` | (see git log) |
| `756fb13` | (see git log) |
| `5909e45` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 34: v1.4.0 紧急修复 — 审查页状态同步+进度条归零+SRT时长检测+同名字幕高亮+条目展示+预发布审核

**Date**: 2026-06-01
**Task**: v1.4.0 紧急修复 — 审查页状态同步+进度条归零+SRT时长检测+同名字幕高亮+条目展示+预发布审核
**Branch**: `master`

### Summary

审查页切tab卡死修复、删除字幕movies/pinnedItems同步、mypy类型修复、版本号更新、下载进度归零修复、SRT时长5项修复(prev_end/负时长/CJK阅读速度/大段空白/均匀度)、条目数展示、字幕时长展示、同名字幕高亮、CLI E402修复、预发布审核全绿

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `817038c` | (see git log) |
| `d2aed34` | (see git log) |
| `68d96d3` | (see git log) |
| `6dd362c` | (see git log) |
| `925e4ea` | (see git log) |
| `73ab82f` | (see git log) |
| `7dcb1b5` | (see git log) |
| `1ddcbd1` | (see git log) |
| `107b80c` | (see git log) |
| `613b272` | (see git log) |
| `0eeeca9` | (see git log) |
| `ad38205` | (see git log) |
| `d581d6a` | (see git log) |
| `36b932b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 35: v1.4.1 发布 — 海报系统配置+Python3.9兼容+缩略图缓存+hydration修复

**Date**: 2026-06-05
**Task**: v1.4.1 发布 — 海报系统配置+Python3.9兼容+缩略图缓存+hydration修复
**Branch**: `master`

### Summary

健康检查Kodi/Emby多选配置、Python 3.9 X|Y语法兼容修复(3文件)、电影缩略图lru_cache+C ache-Control双重缓存、搜索页HistoryPanel SSR hydration mismatch修复、v1.4.1版本号更新

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `988b7ab` | (see git log) |
| `9a42574` | (see git log) |
| `3e98202` | (see git log) |
| `f041894` | (see git log) |
| `3688e52` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 36: v1.4.2 功能增强 — 定时任务调度+CLI评分调试+时长展示+待审核统计

**Date**: 2026-06-07
**Task**: v1.4.2 功能增强 — 定时任务调度+CLI评分调试+时长展示+待审核统计
**Branch**: `master`

### Summary

定时任务调度(Cron+按目录+4模式)+CLI字幕评分调试工具(review--debug)+电影片长展示(NFO读取+审查页头部)+待审核统计改为电影数+parse_duration性能优化+定时弹窗UX修复

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `48ca670` | (see git log) |
| `41feb8d` | (see git log) |
| `653fdc1` | (see git log) |
| `09ad306` | (see git log) |
| `821d73e` | (see git log) |
| `530ca08` | (see git log) |
| `12840a1` | (see git log) |
| `a8dca71` | (see git log) |
| `55589b9` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 37: 定时任务调试+CLI评分工具+审查页优化

**Date**: 2026-06-08
**Task**: 定时任务调试+CLI评分工具+审查页优化
**Branch**: `master`

### Summary

定时任务调度(按目录cron+4模式+串行执行+时长展示+时区修正+手动优先)+CLI字幕评分调试(review--debug)+审查页时长展示+待审核电影计数+parse_duration优化+定时弹窗UX+mypy/cron/调度循环修复+gitignore更新

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `48ca670` | (see git log) |
| `41feb8d` | (see git log) |
| `653fdc1` | (see git log) |
| `09ad306` | (see git log) |
| `821d73e` | (see git log) |
| `530ca08` | (see git log) |
| `12840a1` | (see git log) |
| `a8dca71` | (see git log) |
| `55589b9` | (see git log) |
| `9072434` | (see git log) |
| `e786e2e` | (see git log) |
| `f4a8d04` | (see git log) |
| `6b472a4` | (see git log) |
| `8ec6556` | (see git log) |
| `8b80ca2` | (see git log) |
| `b27edb8` | (see git log) |
| `c1984e4` | (see git log) |
| `f3fd342` | (see git log) |
| `d3bd795` | (see git log) |
| `d4bd268` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 38: v1.4.2 预发布审核 — 扫描页性能回归分析与修复

**Date**: 2026-06-11
**Task**: v1.4.2 预发布审核 — 扫描页性能回归分析与修复
**Branch**: `master`

### Summary

分析扫描页面进入卡顿根因：48ca670 提交在 list_media_directories 中引入 _count_pending_review 调用，导致每次页面加载对每个媒体库根目录执行全量文件系统遍历。修复方案：(1) 后端加 include_pending=false 快速路径（仅 os.listdir 根目录）；(2) list_review_movies 加 count_only 轻量路径（os.scandir early-exit，不复读 .reviewed）；(3) 前端两阶段加载（先渲染目录卡片，后台异步加载待审核计数）。ruff check + tsc 零错误。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `b6e7f57` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 39: 审核页字幕DEBUG一键诊断 — brainstorm+实现+检查

**Date**: 2026-06-11
**Task**: 审核页字幕DEBUG一键诊断 — brainstorm+实现+检查
**Branch**: `master`

### Summary

将 CLI debug 功能集成到审核页 UI：配置文件加 debug_subtitle_enabled 开关，开启后字幕列表每项显示 debug 按钮，点击弹出完整诊断报告（文件信息/SRT解析/扣分明细/AI标记/片长匹配 5 个折叠区块），支持一键复制和 500ms 防抖。新增 GET /api/review/subtitle/debug 端点 + debug_review_subtitle() 函数 + DebugModal 组件。跨 3 个包共 13 个文件（含 1 个新建组件），ruff check + tsc 零错误通过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `1552e98` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 40: v1.4.3 预发布代码审查优化 — 全面审计+版本号更新

**Date**: 2026-06-11
**Task**: v1.4.3 预发布代码审查优化 — 全面审计+版本号更新
**Branch**: `master`

### Summary

v1.4.3 预发布全面代码审查：review 端点路径校验缺失修复(路径穿越)、mark_review 异常传播修复、RenameRequest 内联模型移至 schemas、_cron_next_run 死代码清理、DebugReviewResult.status 联合类型收窄、scanner 页 refreshDirInfo TDZ 修复、search 页 lint 修复。版本号 1.4.2→1.4.3 全量更新(5文件)。ruff check + tsc + ESLint 零错误。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `48c04d8` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 41: Docker runtime Python版本锁定修复 — pydantic_core ABI兼容

**Date**: 2026-06-11
**Task**: Docker runtime Python版本锁定修复 — pydantic_core ABI兼容
**Branch**: `master`

### Summary

Docker runtime阶段从node:22-alpine改为python:3.12-alpine基础镜像，消除builder(3.12)与runtime(apk python3→3.14)之间的Python版本漂移，修复pydantic_core C扩展ABI不兼容导致ModuleNotFoundError。apk中python3/py3-pip替换为nodejs(Next.js standalone运行时所需)。仅修改Dockerfile 2行。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `dcad570` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
