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
  // Data shape depends on backend, likely: { taskId, progress, status, message }
});

// Disconnect when done
ws.disconnect();
```

The WebSocket URL is derived by replacing `http` with `ws` in `FASTAPI_BASE_URL`, then connecting to `/ws/progress/{taskId}`.

### Connection Behavior

- Calling `connect()` closes any existing connection before creating a new one
- Malformed messages are silently ignored
- `onclose` sets `ws = null` (reconnect logic is the caller's responsibility)

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

## Anti-Patterns

- Using raw `fetch()` directly in components — always go through `FastApiClient`
- Adding React Query / SWR — not a dependency; call client methods in `useEffect` or event handlers
- Using the `/api/subtitle` proxy route for new features — go directly to FastAPI