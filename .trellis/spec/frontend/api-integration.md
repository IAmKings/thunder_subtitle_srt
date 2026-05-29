# API Integration

This document covers the API client architecture for communicating with the FastAPI backend.

## Client Architecture

```
┌────────────────────┐     Direct HTTP      ┌──────────────┐
│   FastApiClient     │ ───────────────────► │  FastAPI       │
│   (auth + config +  │                     │  Backend       │
│    tasks + media +  │                     │  :8000         │
│    reviews)         │                     └──────────────┘
└────────────────────┘                            ▲
                                                   │
┌────────────────────┐     Next.js proxy      │
│   SubtitleApiClient │ ──► /api/subtitle ──────►│
│   (legacy search)    │     route.ts              │
└────────────────────┘                            │
                                                   │
┌────────────────────┐     WebSocket              │
│   ProgressWebSocket │ ◄──────────────────────────┘
│   (task progress)    │     /ws/progress/{taskId}
└────────────────────┘
```

## FastApiClient

The primary API client for all backend operations:

```typescript
import { fastApiClient } from '@/lib/api';

// Authentication
await fastApiClient.login(username, password);
await fastApiClient.verifyToken(token);

// Subtitle search (via FastAPI)
await fastApiClient.searchSubtitles(name, { chineseOnly: true, chineseFirst: true });

// Config
await fastApiClient.getConfig();
await fastApiClient.updateConfig(config);
await fastApiClient.reloadConfig();

// Tasks
await fastApiClient.createTask('scan', { path: '/media/movies' });
await fastApiClient.listTasks();
await fastApiClient.getTask(taskId);
await fastApiClient.cancelTask(taskId);

// Media
await fastApiClient.listMediaDirectories();
await fastApiClient.getNfoInfo(path);

// Reviews
await fastApiClient.listReviews(baseDir, nameFilter);
await fastApiClient.markReview(baseDir, path, 'ok');
```

### fastApiFetch Helper

All `FastApiClient` methods go through `fastApiFetch<T>()`, which:

1. Reads the auth token from localStorage
2. Injects `Authorization: Bearer <token>` header automatically
3. Sets `Content-Type: application/json` and `Accept: application/json`
4. Applies a 30-second timeout via `AbortSignal.timeout`
5. Returns parsed JSON with type assertion `as Promise<T>`
6. Throws `Error` on non-OK responses

```typescript
async function fastApiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json', ...existingHeaders };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${FASTAPI_BASE_URL}${path}`, {
    ...options,
    headers,
    signal: options.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT),
  });

  if (!response.ok) throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  return response.json() as Promise<T>;
}
```

### Environment Variable

`NEXT_PUBLIC_API_URL` (default: `http://localhost:8000`) — the FastAPI base URL.

## SubtitleApiClient (Legacy)

The legacy client routes through the Next.js proxy route:

```typescript
import { subtitleApiClient } from '@/lib/api';

await subtitleApiClient.searchSubtitles(name);
const chineseSubs = subtitleApiClient.filterChineseSubtitles(subtitles);
const downloadUrl = subtitleApiClient.getDownloadUrl(subtitle);
```

This client calls `/api/subtitle?name=...` which is proxied to the FastAPI backend via the Next.js API route at `app/api/subtitle/route.ts`.

For new code, prefer `fastApiClient.searchSubtitles()` which goes directly to FastAPI.

## ProgressWebSocket

Real-time task progress via WebSocket:

```typescript
import { ProgressWebSocket } from '@/lib/api';

const ws = new ProgressWebSocket();

// Connect to a specific task
ws.connect(taskId, (data) => {
  console.log('Progress update:', data);
  // data shape: { type, task_id, progress, total, processed, current_movie?, current_step?, download_progress? }
});

// Disconnect when done
ws.disconnect();
```

The WebSocket URL is derived by replacing `http` with `ws` in `FASTAPI_BASE_URL`, then connecting to `/ws/progress/{taskId}`.

### Connection Behavior

- Calling `connect()` closes any existing connection before creating a new one
- Malformed messages are silently ignored
- `onclose` sets `ws = null` (reconnect logic is the caller's responsibility)

### Keep-Alive

To prevent WebSocket disconnection during long-running operations:

```typescript
// ProgressWebSocket 内部每 15s 发送 ping
this.pingInterval = setInterval(() => {
  if (this.ws?.readyState === WebSocket.OPEN) {
    this.ws.send(JSON.stringify({ type: "ping" }));
  }
}, 15000);

// onmessage 过滤服务端 ping 消息，避免泄漏到 onProgress 回调
this.ws.onmessage = (event) => {
  const data = JSON.parse(event.data as string);
  if (data.type === "ping") return;  // 过滤服务端 ping
  onProgress(data);
};

// disconnect 时清理定时器
disconnect(): void {
  if (this.pingInterval) {
    clearInterval(this.pingInterval);
    this.pingInterval = null;
  }
  this.ws?.close();
  this.ws = null;
}
```

**Key numbers**: client ping 15s < server receive timeout → prevents server-side disconnect. Nginx `proxy_read_timeout 300s` covers worst-case download duration.

## Next.js Proxy Rewrite

In `next.config.ts`, the `/fastapi/:path*` path is rewritten to the FastAPI backend:

```typescript
async rewrites() {
  return [{ source: '/fastapi/:path*', destination: apiBaseUrl + '/:path*' }];
}
```

This allows direct browser-to-FastAPI calls from the Next.js domain, avoiding CORS issues.

## Error Handling

API calls throw on HTTP errors:

```typescript
try {
  const config = await fastApiClient.getConfig();
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('API request failed')) {
      // HTTP error from backend
    }
  }
}
```

For `verifyToken()`, errors are caught and return `false` instead of throwing.

## Best Practices

1. **Use `fastApiClient` for new code** — not `subtitleApiClient`
2. **Always handle loading + error states** in UI when making API calls
3. **Token auto-injection** — never manually add `Authorization` headers; `fastApiFetch` does this
4. **Clean up WebSocket connections** — call `ws.disconnect()` in `useEffect` cleanup
5. **Type all responses** — cast `fastApiFetch<T>()` with the correct `T` from `lib/types.ts`
6. **Use 30-second timeout** — the default `DEFAULT_TIMEOUT` handles hung requests
7. **Batch delete with `Promise.allSettled`** — never use `for...of await` for batch file operations:

```typescript
// ✅ Good: 单个失败不阻塞其余，UI 仅移除成功的
const results = await Promise.allSettled(
  toDelete.map(item => fastApiClient.deleteSubtitleFile(path))
);
const succeeded = toDelete.filter((_, i) => results[i].status === "fulfilled");
const failedCount = results.filter(r => r.status === "rejected").length;

if (succeeded.length > 0) {
  setItems(prev => prev.filter(i => !succeeded.some(d => match(d, i))));
}
if (failedCount > 0) {
  setError(`删除失败: ${failedCount}/${toDelete.length}`);
}

// ❌ Bad: 删到一半抛异常 → 前面的已删、后面的没动、UI 不更新
for (const item of toDelete) {
  await fastApiClient.deleteSubtitleFile(path);
}
setItems(prev => prev.filter(...));  // 永远不会执行
```

## Anti-Patterns

- Using raw `fetch()` directly in components — always go through `FastApiClient`
- Adding React Query / SWR — not a dependency; call client methods in `useEffect` or event handlers
- Using the `/api/subtitle` proxy route for new features — go directly to FastAPI