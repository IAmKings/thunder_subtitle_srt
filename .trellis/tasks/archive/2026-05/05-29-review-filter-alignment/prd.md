# 扫描结果页筛选状态与扫描模式对齐

## 问题诊断

扫描结果页（`/scanner`）的筛选栏硬编码了 5 个按钮（`ScanStatus`）：

```
全部 | 已下载 | 已跳过 | 无匹配 | 错误
```

但在 **dry_run（仅预览）** 模式下，因为不发起网络请求，状态分布严重失衡：

| 筛选按钮 | dry_run 下出现概率 |
|------|:---:|
| 已下载 (downloaded) | ❌ 永不出现 |
| 无匹配 (no_match) | ❌ 永不出现 |
| 错误 (error) | ⚠️ 极罕见（仅 NFO 解析失败） |
| 已跳过 (skipped) | ✅ 几乎 100% |

5 个筛选按钮里 3 个是摆设，筛选功能在 dry_run 下形同虚设。

### 真正的信息在 dry_state

dry_run 模式下，扫描器为每部电影设置了 `dry_state` 字段（`models.py:22-28`），包含 6 种细分状态：

| dry_state | 含义 | 业务价值 |
|------|------|------|
| `need_download` | 无字幕，需要下载 | 高 — 用户需要知道哪些电影缺字幕 |
| `need_review` | 有字幕，待审查 | 高 — 用户需要去审查页处理 |
| `reviewed_ok` | 已审查通过 | 中 — 确认没问题 |
| `reviewed_fail` | 已审查失败 | 中 — 需要另外找字幕 |
| `reviewed_fail_new_subs` | 失败但 dump 出新字幕 | 中 — 需要重新审查 |
| `skipped` | 发布日期不够老 | 低 — 自动跳过，等时间到了再说 |

## 修复方案

### 方案 1（选定）：动态切换筛选栏

**核心思路**：筛选栏根据当前扫描模式动态切换按钮组。

| 扫描模式 | 筛选维度 | 按钮组 |
|------|------|------|
| scan / dump / dump_force | `ScanStatus` | 全部 / 已下载 / 已跳过 / 无匹配 / 错误 |
| dry_run | `dry_state` | 全部 / 需下载 / 待审查 / 已通过 / 已失败 / 有新字幕 / 已跳过 |

**优点**：
- dry_run 的筛选按钮直接对应业务场景
- 网络模式保持现有行为，零影响
- 实现简单：前端判断 `scanMode`，切换渲染的按钮数组

## 改动点

| 文件 | 改动 | 说明 |
|------|------|------|
| `thunder-subtitle-web/src/app/scanner/page.tsx` | 改 | 筛选栏根据 `scanMode` 切换渲染不同的按钮组；筛选逻辑新增 `dry_state` 字段匹配 |
| `thunder-subtitle-web/src/lib/i18n.ts` | 改 | 新增 dry_state 6 个状态的中文翻译 key |
| `thunder-subtitle-web/src/lib/scanner-state.tsx` | 可能改 | 如果筛选状态需要存储 `dry_state` 类型的过滤值 |

## i18n 新增 key

```
dry_state_need_download: "需下载"
dry_state_need_review: "待审查"
dry_state_reviewed_ok: "已通过"
dry_state_reviewed_fail: "已失败"
dry_state_reviewed_fail_new_subs: "有新字幕"
dry_state_skipped: "已跳过"
```

## Acceptance Criteria

- [ ] dry_run 模式下筛选栏显示 7 个按钮（全部 + 6 个 dry_state）
- [ ] scan/dump/dump_force 模式下筛选栏显示 5 个按钮（全部 + 4 个 ScanStatus）
- [ ] 切换扫描模式时筛选自动重置为"全部"
- [ ] dry_run 模式下筛选"需下载"只显示 `need_download` 的结果
- [ ] dry_run 模式下筛选"待审查"只显示 `need_review` 的结果
- [ ] 网络扫描模式下的筛选行为与改前一致
- `tsc --noEmit` 零错误

## Out of Scope

- 审查页（verification）的筛选栏改动 — 审查页用的是 `ReviewState`，不存在此问题
- dry_state 和 ScanStatus 的统一/合并
- 筛选栏 UI 组件重构
