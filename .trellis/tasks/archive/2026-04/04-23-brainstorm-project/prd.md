# brainstorm: 字幕下载工具项目

## Goal

开发一个字幕下载工具，第一阶段为 CLI 工具，第二阶段为 WebApp，核心功能是通过迅雷电鳎 API 获取中文字幕。

## What I already know

* **目标 API**: `https://api-shoulei-ssl.xunlei.com/oracle/subtitle?name={name}`
* **核心功能**: 中文字幕挑选下载
* **分两阶段**: CLI (调试) → WebApp (用户友好)
* **无特定技术约束** - 可自主选择技术栈

## Assumptions (temporary)

* API 返回字幕文件内容（二进制/SRT/ASS 等格式）
* 需要按名称/关键词搜索字幕
* 字幕需要支持下载到本地

## Research Notes

### What similar tools do

1. **ihciah's subtitle_downloader** (2016, Python)
   - Old API: `http://subtitle.kankan.xunlei.com:8000/submatch/{cid[:2]}/{cid[-2:]}/{cid}.lua`
   - Computed SHA1 hash of video file to get CID
   - Fetched subtitle URLs via regex pattern
   - Downloaded via direct HTTP requests

2. **weaming/thunder-subtitle** (2018) - 已不可用，迅雷改接口

3. **xunleipy** (PyPI) - 迅雷 SDK for Python

### Key Insight

旧的字幕 API 通过视频文件的 SHA1 哈希值（CID）查询字幕。
新的 API (`api-shoulei-ssl.xunlei.com`) 使用 `name` 参数，简化了搜索流程。

### Feasible approaches here

**Approach A: 先探索 API，再开发 CLI** (Recommended)

1. 用 curl 探索接口返回格式（JSON? 二进制?）
2. 确定正确的参数和返回值
3. 基于实际响应开发 CLI

**Approach B: 直接参考博客源码开发**

1. 参考 `anxiaoxi.com` 的单页源码
2. 复刻其 API 调用逻辑
3. 开发 CLI 工具

**Approach C: Python 优先**

1. 用 Python requests 先调试 API
2. 确认接口后迁移到 Node.js/TypeScript
3. CLI 和 WebApp 共享核心逻辑

### API 探索计划

1. `curl "https://api-shoulei-ssl.xunlei.com/oracle/subtitle?name=nmsl028"` 查看响应
2. 分析返回的字幕列表结构
3. 确定下载链接格式

## Open Questions

* [x] ~~API 的完整接口规范~~ → 待探索，见 API 探索计划
* [x] ~~CLI 工具的交互方式~~ → TUI 交互式选择
* [x] ~~是否需要历史记录/收藏功能~~ → 需要历史记录
* [x] ~~WebApp 的技术栈偏好~~ → Node.js/TypeScript (Next.js for WebApp)

## Requirements (evolving)

* Phase 1 - CLI 工具
  * [ ] 连接测试 API 接口
  * [ ] 实现字幕搜索功能
  * [ ] 实现 TUI 交互式字幕选择（单选/多选）
  * [ ] 实现字幕下载功能（单文件/批量）
  * [ ] 支持中文字幕过滤

* Phase 2 - WebApp
  * [ ] 用户友好的 Web 界面
  * [ ] 搜索和下载交互
  * [ ] 搜索/下载历史记录
  * [ ] 批量下载支持

## Acceptance Criteria

* [ ] CLI 能成功调用 API 获取字幕列表
* [ ] CLI TUI 能正确显示字幕列表并支持单选/多选
* [ ] CLI 能下载并保存字幕文件（单文件/批量）
* [ ] CLI 能过滤中文字幕
* [ ] WebApp 提供图形化操作界面
* [ ] WebApp 支持历史记录
* [ ] WebApp 支持批量下载

## Definition of Done (team quality bar)

* Phase 1: CLI 工具可正常运行，API 集成完成
* Phase 2: WebApp 可部署上线

## Decision (ADR-lite)

**Context**: 需要统一的技术栈覆盖 CLI 和 WebApp 两阶段
**Decision**: Node.js/TypeScript
**Consequences**:
- CLI 和 WebApp 共享核心逻辑
- 便于后续集成 Next.js 开发 WebApp
- TypeScript 提供类型安全

**Context**: CLI 交互方式选择
**Decision**: TUI 交互式选择 (inquirer/blessed)
**Consequences**:
- 用户体验更好，适合非技术用户
- 支持单选/多选字幕
- 便于调试阶段快速迭代

**Context**: WebApp 功能范围
**Decision**: 搜索 + 下载 + 历史记录 + 批量下载
**Consequences**:
- 最小化功能集，快速上线
- 历史记录提升复用性

## Out of Scope (explicit)

* 用户系统/登录（Phase 2 暂不考虑）
* 多语言字幕处理（仅中文字幕）
* 字幕格式转换（SRT ↔ ASS）

## Technical Notes

* API Endpoint: `https://api-shoulei-ssl.xunlei.com/oracle/subtitle?name=xxx`
* 需先探索 API 接口规范
