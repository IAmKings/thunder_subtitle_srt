# Web 前端深度代码审查报告

## 审查概览
- 审查文件数：27
- 发现问题数：27（P0: 1, P1: 12, P2: 14）

---

## P0（严重 — Bug/安全）

### [verification/page.tsx:507-513] `setListPage` 回调类型与 `dispatchFilter` 不兼容
- **问题**: `VerificationFilterBar` 的 `setListPage` prop 声明类型为 `(v: number | ((prev: number) => number)) => void`，但页面传入的自定义包装函数中，当 `v` 为函数时会尝试 `dispatchFilter({ type: "SET_LIST_PAGE", payload: v(listPage) })`。然而 `useReducer` 的 `dispatch` 不接受函数 updater（这是 `useState` 的特性），`v(listPage)` 会将 dispatch action 的 payload 设置为 `v(listPage)` 的返回值（一个 number），这在数值上偶然正确，但类型误导非常危险。如果未来有人真的传入函数 updater，dispatch 会失败。
- **影响**: 当前未触发实际 bug（所有调用处都传 number），但类型签名误导开发者，未来很可能引入 bug。
- **建议**: 将 `setListPage` 的类型改为 `(v: number) => void`，删除函数类型的联合。页面端的包装函数也应简化。

---

## P1（重要 — 代码质量）

### [verification/page.tsx:127-132] `getDisabledPaths` 定义在组件函数体内导致每次重渲染都读取 localStorage
- **问题**: `getDisabledPaths()` 直接定义在 `VerificationPage` 函数体内，每次渲染都执行 `localStorage.getItem` + `JSON.parse`。该方法被 `loadReviews`（useCallback 记忆）和 `useEffect` 直接调用。虽然 useCallback 内部会捕获最新引用，但 localStorage 读取本身是同步 I/O，在频繁重渲染时产生不必要的开销。
- **影响**: 性能影响轻微但属于不规范的 SSR-safe localStorage 使用模式。
- **建议**: 将 `getDisabledPaths` 提取到组件外部（module level）作为纯函数，或使用 `useRef` 缓存。或者将其整合到 `scanner-state.tsx` 的 context 中统一管理。

### [verification/page.tsx:160-172] 首次 useEffect 发起两次 `listMediaDirectories` 请求
- **问题**: 第一个 useEffect 调用 `fastApiClient.listMediaDirectories()` 获取目录列表，然后条件性地调用 `startTransition(() => { loadReviews(); })`，而 `loadReviews` 内部再次调用 `listMediaDirectories()`。这意味着组件挂载时重复获取同一资源。
- **影响**: 不必要的网络请求，在慢速连接下增加加载时间。
- **建议**: 在 useEffect 中获取目录后立即执行 `loadReviews(enabledDirs)`，或将目录作为参数传入 `loadReviews` 避免重复请求。

### [verification/page.tsx:160-172] 初始目录加载错误被静默吞噬
- **问题**: `.catch(() => {})` 完全忽略了 `listMediaDirectories()` 的初始加载错误。如果首次加载失败，用户不会收到任何错误提示，`isLoading` 也永远不会变为 false。
- **影响**: 用户看到永久 loading 状态，没有错误反馈。
- **建议**: 在 catch 中至少调用 `setIsLoading(false)`，并考虑展示错误信息。

### [scanner/page.tsx:140-145] 运行中任务检查错误被静默吞噬
- **问题**: `.catch(() => {})` — 检查挂载时的运行中任务时，如果 API 请求失败（例如网络问题），错误被完全忽略。
- **影响**: 用户无法知道是否有任务正在运行，可能导致触发重复扫描。
- **建议**: 至少使用 `console.error` 记录，或设置一个本地 error state 提示用户。

### [scanner/page.tsx:168-170] Polling 间隔中的错误被静默吞噬
- **问题**: `.catch(() => {})` — 任务轮询错误完全被忽略。如果连续多次失败，用户不会收到任何通知。
- **影响**: 后台扫描静默停止工作，用户无法感知。
- **建议**: 记录错误，并考虑在连续失败后停止轮询并提示用户。

### [scanner/page.tsx:174-211] HTTP 轮询与 WebSocket 双重连接导致冗余请求
- **问题**: 组件同时启用 3 秒 HTTP 轮询（`setInterval`）和 WebSocket 实时连接。当任务活跃时，每 3 秒额外发起一次 HTTP 请求，而 WebSocket 已经提供实时进度更新。
- **影响**: 每 3 秒的无用 HTTP 请求增加服务器负载和网络开销。
- **建议**: 当 WebSocket 连接成功并接收消息时，关闭 HTTP 轮询；仅在 WebSocket 不可用时（如本地开发）启用轮询作为 fallback。

### [scanner/page.tsx:163-166, 204-209] 多处 TypeScript `as` 类型断言
- **问题**: 第 164 行 `task.results as ScanResultItem[]`、第 176-182 行 `data as {...}`、第 205 行 `task.results as ScanResultItem[]` 均使用类型断言而非类型验证。当后端返回的数据格式不符合预期时，会导致运行时静默错误而非编译时捕获。
- **影响**: 类型安全被破坏，后端 schema 变更时难以发现。
- **建议**: 对 API 响应定义明确的接口类型，通过 `fastApiFetch<TaskResponse<ScanResultItem>>` 等方式传递泛型。避免直接 `as` 转换。

### [scanner/page.tsx:190-196] 非空断言 `!` 使用
- **问题**: `update.result!.movie_name` 使用非空断言。虽然上一行已经检查了 `update.result` 的存在性，但 TypeScript 的 narrowing 在回调 `setFindings` 内部无法跟踪这一检查。
- **影响**: 如果 `update.result` 在检查之后被意外修改（在当前代码中不可能，但增加了维护风险），会引发运行时崩溃。
- **建议**: 在回调外部将结果保存到局部变量：`const result = update.result; if (!result) return;`。然后在闭包中引用局部变量。

### [settings/page.tsx:544-553] 保存按钮硬编码 `text-white` 类名
- **问题**: 按钮使用 `text-white`，但组件规范要求使用设计 token（如 `text-on-primary-container`）。虽然当前背景（`bg-primary-container`）确保可读性，但主题切换后可能失效。
- **影响**: 在暗色主题下可能仍然可读但不一致；在自定义主题中可能无效。
- **建议**: 使用 `text-on-primary` 或 `text-on-primary-container` 替代 `text-white`。

### [api.ts:77] `AbortSignal.timeout` 可能导致未捕获的 `TimeoutError`
- **问题**: `AbortSignal.timeout(DEFAULT_TIMEOUT)` 创建的信号在超时时会抛出一个 `DOMException: TimeoutError`。如果调用方没有正确处理 `error.name === 'TimeoutError'` 的情况，超时错误会以通用方式被捕获。
- **影响**: 用户看到"API request failed: 0"等难以理解的错误信息。
- **建议**: 在 `fastApiFetch` 内部统一处理超时错误，抛出语义明确的错误信息，或记录日志。

### [api.ts:74-84] `fastApiFetch` 未处理 401 导致 token 过期后无重定向
- **问题**: 当 token 过期时，API 返回 401 状态码。`fastApiFetch` 直接抛出 `Error("API request failed: 401 ...")`，页面展示通用错误信息而不是自动跳转到登录页。
- **影响**: 用户在 token 过期后必须手动刷新页面才能看到登录页。
- **建议**: 在 `!response.ok` 分支中检查 `response.status === 401`，调用 `clearAuthToken()` 并触发全局重定向到 `/login`。

### [search/page.tsx:121] 主搜索失败后错误被静默吞噬
- **问题**: `catch {}`（无参数）在 `fastApiClient.searchSubtitles` 失败后完全忽略错误，直接 fallback 到 legacy `SubtitleApiClient`。用户和开发者都无法知道主搜索失败的原因（网络问题 vs API 变更）。
- **影响**: 调试困难，可能掩盖后端 API 的异常行为。
- **建议**: 主搜索失败时至少 `console.warn` 记录错误，让 fallback 机制可观测。

---

## P2（建议 — 优化）

### [verification/page.tsx:268-279] `togglePin` 和 `isPinned` 未使用 useMemo 记忆
- **问题**: `isPinned` 是 `useCallback` 但内部执行 `pinnedKeys.includes(...)` 数组查找。当 pinnedKeys 很大时，每次渲染的查找开销累积。虽然不是大问题，但作为高频调用可以优化。
- **建议**: 改用 `Set<string>` 存储 pinnedKeys，或在 context 层暴露 `isPinned(key)` 方法。注意 `Set` 需要每次从数组重建，需评估性能收益。

### [verification/page.tsx] 多个 ConfirmDialog 实例高度重复
- **问题**: 5 个 ConfirmDialog（reject/deleteAll/markAllFail/keepOnly/rename）共享相同的 props 模式。每次添加新操作都需要重复样板代码。
- **影响**: 代码膨胀，维护成本增加。
- **建议**: 考虑使用统一的操作模式：`{ type: 'deleteAll' | 'reject' | ..., open: boolean, isLoading: boolean, onConfirm: () => void }` 状态对象驱动单个 ConfirmDialog。

### [scanner/page.tsx:598-623] Desktop/Mobile filter 输入框重复定义
- **问题**: 两段几乎相同的 filter input 代码，只是外层容器类从 `hidden md:block` 和 `md:hidden` 切换。
- **影响**: 代码重复，修改时需要同步两处。
- **建议**: 使用一个 input 加 CSS responsive visibility，而不是复制 JSX 结构。

### [scanner/page.tsx:299-303] `statusOrder` 每次渲染重新创建
- **问题**: `const statusOrder: Record<string, number> = { ... }` 定义在组件函数体内，每次渲染都创建新对象。
- **影响**: 极小开销，但可轻松优化为模块级常量。
- **建议**: 将 `statusOrder` 移到组件外部作为模块级常量。

### [search/page.tsx:37-71] filterSubtitles 函数每次调用创建新 SubtitleApiClient 实例
- **问题**: `filterSubtitles` 中的 `new SubtitleApiClient()` 在每次过滤操作时创建新实例。`filterChineseSubtitles` 方法不依赖实例状态（纯函数），不需要实例化。
- **影响**: 不必要的对象创建和 GC 压力。
- **建议**: 将 `filterChineseSubtitles` 提取为模块级纯函数，或直接导出为静态方法。

### [search/page.tsx:420-424] HistoryPanel 接受 `t` 作为 prop
- **问题**: `HistoryPanel` 将 `t` 翻译函数作为 prop 传递。按照组件规范，子组件应直接使用 `useTranslations()` hook。
- **影响**: 组件可复用性降低，每个使用处都需要传入翻译函数。
- **建议**: `HistoryPanel` 内部直接调用 `useTranslations()`。

### [components/ConfirmDialog.tsx:24-26] cancelLabel 和 loadingLabel 有硬编码英文默认值
- **问题**: `cancelLabel = "Cancel"` 和 `loadingLabel = "Loading..."` 在未传入 prop 时使用硬编码英文。虽然调用方通常传入翻译后的字符串，但默认值在使用时不会被翻译。
- **影响**: 如果未来有人忘记传入这些 prop，弹出的对话框会出现英文文字，破坏国际化一致性。
- **建议**: 移除默认值，或者传入 `t("cancel")` 等翻译值作为默认值。但注意 ConfirmDialog 是通用组件不应依赖 `useTranslations`，因此建议调用方始终传入 prop。

### [components/VerificationSubtitleList.tsx:14-25] getReviewStatusColor 与 StatusBadge 模式重复
- **问题**: 组件内部实现了 `getReviewStatusColor` 函数用于 review_status 的颜色映射。这与 `StatusBadge` 的 `getStatusColor` 模式类似但针对不同的状态集。而 review_status 颜色逻辑与 `VerificationStats` 中的评分颜色逻辑也不同。
- **影响**: 多处维护颜色映射逻辑。
- **建议**: 创建一个 `getReviewStatusColor` 工具函数（在 `StatusBadge.tsx` 中或单独 utility），统一 review_status 的颜色映射。

### [components/VerificationSubtitleList.tsx:56-60] 评分颜色逻辑与 VerificationStats 重复
- **问题**: 两个组件（VerificationSubtitleList 和 VerificationStats）都有 `score >= 80 ? green : score >= 60 ? tertiary : error` 的颜色逻辑。
- **影响**: 如果评分阈值调整，必须同步修改两处。
- **建议**: 提取共享的评分颜色工具函数。

### [components/MovieList.tsx:11-14] getMovieName 与 verification/page.tsx 重复
- **问题**: `MovieList` 组件的 `getMovieName` 函数与 `verification/page.tsx` 第 32-35 行的 `getMovieName` 功能完全一致。
- **影响**: 代码重复。
- **建议**: 将 `getMovieName` 提取到共享工具函数（如 `lib/utils.ts`）。

### [components/TopBar.tsx:35-46] Bell 和 Wifi 按钮没有 onClick 处理函数
- **问题**: 通知和连接状态按钮没有绑定任何事件处理函数，是纯粹的装饰性 UI。用户点击后没有任何反馈。
- **影响**: 可能误导用户以为功能可用。
- **建议**: 添加 `title` 属性说明"即将推出"或绑定实际功能。

### [lib/search-state.tsx:119, 126-127] setHistory 与 localStorage 同步模式"读写分离"
- **问题**: `addToHistory` 写入 localStorage，然后 `setHistory(loadHistory())` 重新读取来确保一致。这种模式容易出现 race condition 且不够直观。
- **影响**: 如果多个 tab 同时操作同一 localStorage key，可能丢失数据。但单 tab 场景下工作正常。
- **建议**: 使用统一的数据模型：维护内存中的 `history` 状态，每次变更时同步写入 localStorage，而不是依赖 reload。

### [lib/verification-state.tsx:56-59] actions useMemo 依赖数组为空
- **问题**: `useMemo(() => ({ setItems, setIsLoading, ... }), [])` 的依赖数组为空数组。由于 `useState` 的 setter 在 React 中保证稳定引用，这实际上是安全的。但 eslint-plugin-react-hooks 通常会警告。
- **影响**: 无实际 bug，但不符合最佳实践，可能遗漏审查时的注意。
- **建议**: 要么添加注释说明空数组的理由，要么不使用 useMemo（使用 useRef 或直接传递）。

### [lib/auth.tsx:179-180] withAuth 在不认证时返回 null
- **问题**: 当 `!isAuthenticated` 时返回 `null`，依赖 `AuthProvider` 的 redirect effect 跳转到登录页。这意味着在 redirect 生效前，页面会短暂渲染空白。
- **影响**: 用户体验上出现瞬间空白闪烁。
- **建议**: 返回 loading 动画（与 isLoading 状态相同的 spinner），直到 redirect 完成。

---

## 文件级评分

| 文件 | 行数 | SOLID | DRY | 错误处理 | 类型安全 | 性能 | 综合 |
|------|------|-------|-----|---------|---------|------|------|
| verification/page.tsx | 900 | ★★☆ | ★★☆ | ★★★ | ★★★ | ★★☆ | ★★☆ |
| scanner/page.tsx | 833 | ★★☆ | ★★☆ | ★☆☆ | ★☆☆ | ★★☆ | ★★☆ |
| settings/page.tsx | 597 | ★★★ | ★★★ | ★★★ | ★★★ | ★★★ | ★★★ |
| search/page.tsx | 427 | ★★★ | ★★★ | ★★☆ | ★★★ | ★★★ | ★★★ |
| AppShell.tsx | 71 | ★★★ | ★★★ | N/A | ★★★ | ★★★ | ★★★ |
| Sidebar.tsx | 73 | ★★★ | ★★★ | N/A | ★★★ | ★★★ | ★★★ |
| TopBar.tsx | 57 | ★★★ | ★★★ | N/A | ★★★ | ★★★ | ★★☆ |
| ConfirmDialog.tsx | 78 | ★★★ | ★★★ | N/A | ★★★ | ★★★ | ★★★ |
| StatusBadge.tsx | 67 | ★★★ | ★★★ | N/A | ★★★ | ★★★ | ★★★ |
| SubtitlePreview.tsx | 108 | ★★★ | ★★★ | ★★★ | ★★★ | ★★★ | ★★★ |
| MovieList.tsx | 47 | ★★★ | ★★☆ | N/A | ★★★ | ★★★ | ★★★ |
| VerificationSubtitleList.tsx | 87 | ★★☆ | ★★☆ | N/A | ★★★ | ★★★ | ★★☆ |
| VerificationFilterBar.tsx | 125 | ★★★ | ★★☆ | N/A | ★★★ | ★★★ | ★★☆ |
| VerificationStats.tsx | 33 | ★★★ | ★★☆ | N/A | ★★★ | ★★★ | ★★★ |
| ThemeProvider.tsx | 91 | ★★★ | ★★★ | ★★★ | ★★★ | ★★★ | ★★★ |
| api.ts | 368 | ★★☆ | ★★☆ | ★★☆ | ★★☆ | ★★★ | ★★☆ |
| auth.tsx | 185 | ★★★ | ★★★ | ★★★ | ★★★ | ★★★ | ★★★ |
| i18n.ts | 435 | ★★★ | ★★★ | ★★★ | ★★★ | ★★★ | ★★★ |
| types.ts | 116 | N/A | N/A | N/A | ★★★ | N/A | ★★★ |
| scanner-state.tsx | 109 | ★★★ | ★★★ | N/A | ★★★ | ★★★ | ★★★ |
| verification-state.tsx | 81 | ★★★ | ★★★ | N/A | ★★★ | ★★★ | ★★★ |
| search-state.tsx | 212 | ★★★ | ★★★ | ★★★ | ★★★ | ★★★ | ★★★ |

---

## 审查总结

### 总体评价

thunder-subtitle-web 代码整体质量良好，各文件职责清晰，类型定义相对完整，国际化覆盖较好。核心问题集中在以下领域：

### 关键发现

1. **Scanner 页面错误处理较弱**: 多处 `.catch(() => {})` 静默吞掉错误（P1 x3），WebSocket 与 HTTP 轮询双重连接导致冗余请求。
2. **类型安全在 Scanner 页面薄弱**: `as` 类型断言和对 WebSocket 数据的非空断言（P1 x2）是运行时隐患。
3. **Verification 页面体积接近上限**: 900 行仍接近千行边界（组件规范 800 行），虽然已提取子组件，但逻辑密度仍然较高。
4. **代码重复**: 评分颜色逻辑（VerificationSubtitleList + VerificationStats）、getMovieName（MovieList + verification/page）、Desktop/Mobile filter input（scanner/page）均有不同程度重复。
5. **401 未处理**: token 过期后用户不会自动跳转到登录页，API 层缺少全局 401 拦截（P1）。
6. **ConfirmDialog 国际化缺陷**: 默认值 (`"Cancel"`, `"Loading..."`) 为硬编码英文（P2）。

### 建议改进优先级

| 优先级 | 问题 | 影响 |
|--------|------|------|
| 高 | Scanner 静默错误处理 | 用户无法感知后台异常 |
| 高 | 401 无重定向 | 认证过期后体验断裂 |
| 高 | TypeScript 类型断言+非空断言 | 运行时类型安全风险 |
| 中 | WebSocket + HTTP 双请求 | 额外服务器负载 |
| 中 | Verification 页面体积 | 后续维护困难 |
| 低 | 重复颜色/逻辑提取 | 代码整洁性 |
| 低 | 装饰按钮无处理 | 用户预期管理 |
