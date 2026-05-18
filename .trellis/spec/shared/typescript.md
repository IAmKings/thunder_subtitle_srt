# TypeScript Best Practices

> TypeScript guidelines for the Thunder Subtitle Next.js 16 frontend.

---

## Type Mirroring from Pydantic Schemas

There is no automatic type sharing between the Python backend and TypeScript frontend. TypeScript types in `types.ts` must **manually mirror** the Pydantic schemas defined in `thunder-subtitle-api/app/models/schemas.py`.

### Source of Truth

**Backend Pydantic models are the source of truth.** When a schema changes in `schemas.py`, the corresponding TypeScript interface must be updated in `types.ts`.

```python
# Python (source of truth) — thunder-subtitle-api/app/models/schemas.py
class TaskResponse(BaseModel):
    id: str
    type: Literal["scan", "review", "dump"]
    status: Literal["pending", "running", "completed", "failed", "cancelled"]
    progress: float
    message: str
    params: dict
    created_at: datetime
    updated_at: datetime
```

```typescript
// TypeScript (mirror) — thunder-subtitle-web/src/lib/types.ts
export type TaskType = "scan" | "review" | "dump";
export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface TaskResponse {
  id: string;
  type: TaskType;
  status: TaskStatus;
  progress: number;
  message: string;
  params: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
```

### Mirroring Rules

1. **Field names** must match the JSON keys from the API response (snake_case)
2. **Literal unions** in Pydantic become TypeScript union types (`"a" | "b"`)
3. **Optional fields** in Pydantic (`field: str | None = None`) become `field?: string | null` in TypeScript
4. **`datetime` fields** become `string` in TypeScript (ISO 8601 format from JSON serialization)
5. **`dict` fields** become `Record<string, unknown>` in TypeScript

### Where to Define Types

- **Shared domain types** (mirroring backend schemas): `src/lib/types.ts`
- **Component-specific types**: Co-located with the component or in a local `types.ts`
- **API client-specific types** (e.g., `LoginResponse`): In `src/lib/api.ts` since they're tightly coupled to the API client

---

## Type Imports

Always use `import type` for type-only imports:

```typescript
// GOOD
import type { Subtitle, SearchResult } from "@/lib/types";
import { fastApiClient } from "@/lib/api";

// BAD
import { Subtitle, fastApiClient } from "@/lib/types";
```

---

## Discriminated Unions

Use discriminated unions for types that can be one of several shapes:

```typescript
// Union type from backend Literal
export type TaskType = "scan" | "review" | "dump";

// Narrowing with discriminated union
interface TaskBase {
  id: string;
  type: TaskType;
  status: TaskStatus;
}

// Can be narrowed: if (task.type === "scan") { ... }
```

---

## Generic Patterns

### Generic Result Type

```typescript
// Match the backend pattern: { success: bool, message: str }
interface ApiResult {
  success: boolean;
  message: string;
}

interface ApiResultWithData<T> extends ApiResult {
  data: T;
}
```

### Generic Paginated Response

```typescript
interface PaginatedResponse<T> {
  items: T[];
  total: number;
}
```

---

## Forbidden Patterns

### No `any`

```typescript
// BAD
function process(data: any) { ... }

// GOOD
function process(data: ProcessInput) { ... }
```

### No Non-Null Assertion

```typescript
// BAD
const name = user!.name;

// GOOD
if (user) {
  const name = user.name;
}
```

### No Type Assertions Without Validation

```typescript
// BAD - Blind assertion
const task = data as TaskResponse;

// GOOD - Check the shape
function isTaskResponse(data: unknown): data is TaskResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    "type" in data
  );
}
```

---

## API Client Type Patterns

The `FastApiClient` class handles type conversion:

```typescript
// FastApiClient methods are typed with the response interface
async getConfig(): Promise<AppConfig> { ... }
async listTasks(status?: string): Promise<{ tasks: TaskResponse[]; total: number }> { ... }
```

**Never add raw `fetch` calls** — always add methods to `FastApiClient` so types are centralized.

---

## Explicit Return Types for Exports

Always annotate explicit return types on exported functions:

```typescript
// BAD
export function formatTaskStatus(status: TaskStatus) {
  return statusLabelMap[status];
}

// GOOD
export function formatTaskStatus(status: TaskStatus): string {
  return statusLabelMap[status];
}
```

---

## TypeScript Configuration

Ensure strict mode is enabled in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true
  }
}
```

---

## Synchronization Checklist

When updating backend Pydantic schemas, follow this checklist:

- [ ] Update the corresponding TypeScript interface in `types.ts`
- [ ] Check all fields match (names, types, optionality)
- [ ] Update literal union types if `Literal` values changed
- [ ] Update `FastApiClient` methods if response shape changed
- [ ] Check component code that uses the type

---

## Summary

| Practice                              | Reason                        |
| ------------------------------------- | ----------------------------- |
| Mirror Pydantic schemas manually      | No automatic type sharing     |
| Keep field names as snake_case        | Match API JSON keys           |
| `import type` for type-only imports   | Clear separation, tree-shake  |
| Explicit return types on exports      | Documentation, catch errors   |
| No `any`                              | Type safety                   |
| No `!` assertions                     | Runtime safety                |
| No `@ts-expect-error`                 | Masks real issues             |
| Add methods to FastApiClient          | Centralize API type handling  |