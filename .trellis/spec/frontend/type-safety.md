# Type Safety Guidelines

This document covers TypeScript type patterns used in Thunder Subtitle Web.

## Core Principle

**Frontend types mirror backend Pydantic schemas.** All types that correspond to API request/response shapes are defined in `lib/types.ts` and must stay in sync with the FastAPI backend.

## Type Definitions

All shared types live in `src/lib/types.ts`:

```typescript
// Domain types
interface Subtitle { gcid, cid, url, ext, name, duration, languages, source, score, fingerprintf_score, extra_name, mt, is_chinese? }
interface ApiResponse { code, data, msg? }
interface SearchResult { subtitles, total }

// History types (localStorage)
interface HistoryItem { id, name, timestamp }
interface DownloadHistoryItem extends HistoryItem { subtitle }

// Task types
type TaskType = "scan" | "review" | "dump"
type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled"
interface TaskResponse { id, type, status, progress, message, params, created_at, updated_at }

// Config types
interface AppConfig { output_dir, timeout, download_timeout, chunk_size, rate_limit, retry_count, retry_delay, preferred_groups, media_paths }

// Review types
type ReviewState = "ok" | "fail" | "not_reviewed"
interface ReviewItem { file_path, file_name, quality, chinese_ratio, encoding, review_status, review_date }

// Media types
interface MediaDirectory { path, name, movie_count }
interface NfoInfo { path, duration_seconds, has_chinese_subtitle, release_date }
```

## API-Specific Types

Types that are only used by the API client live in `lib/api.ts`:

```typescript
interface LoginResponse { access_token, token_type, expires_in }
```

These are exported alongside the client classes but not in `types.ts` since they're API-internal.

## Naming Conventions

| Backend (Python) | Frontend (TypeScript) | Notes |
|-------------------|----------------------|-------|
| `snake_case` fields | `snake_case` fields | Keep same naming for 1:1 mapping |
| `Optional[str]` | `string \| undefined` | Use optional `?` for nullable fields |
| `list[str]` | `string[]` | Arrays map directly |
| `dict[str, Any]` | `Record<string, unknown>` | Use `unknown` not `any` |
| `bool` | `boolean` | Direct mapping |

## Forbidden Patterns

### No `any` Types

```typescript
// Bad
const data: any = await response.json();

// Good
const data: SearchResult = await response.json();
```

### No `@ts-expect-error`

```typescript
// Bad
// @ts-expect-error — backend returns this field
const value = response.someField;

// Good — update the type definition to include the field
```

### No Type Assertions Without Validation

```typescript
// Bad
const user = data as AuthUser;

// Good — validate with type guard or trust the API type
const user: AuthUser = { username: data.username };
```

## Adding New Types

When the backend adds a new endpoint or changes a schema:

1. Update `lib/types.ts` with the new or changed type
2. Update `FastApiClient` methods in `lib/api.ts` with the correct generic type
3. Export the type if components need it: `export type { Subtitle } from '@/lib/types'`

Example — adding a new type:

```typescript
// lib/types.ts
export interface ScanResult {
  task_id: string;
  total_files: number;
  missing_subtitles: number;
}

// lib/api.ts
async startScan(path: string): Promise<ScanResult> {
  return fastApiFetch<ScanResult>('/api/scan', {
    method: 'POST',
    body: JSON.stringify({ path }),
  });
}
```

## Local Storage Types

History items use `HistoryItem` and `DownloadHistoryItem`:

```typescript
interface HistoryItem { id: string; name: string; timestamp: number }
interface DownloadHistoryItem extends HistoryItem { subtitle: Subtitle }
```

These are client-only types (not from the backend) but follow the same `snake_case` convention for consistency.

## Best Practices

1. **Keep types.ts in sync with backend schemas** — check when backend changes
2. **Use `unknown` over `any`** for truly unknown types
3. **Mark optional fields with `?`** — only if the backend marks them `Optional`
4. **Export types from `api.ts`** only when they're API-internal (like `LoginResponse`)
5. **Component props** — always define an explicit interface
6. **Generic `fastApiFetch<T>`** — always provide the concrete type argument