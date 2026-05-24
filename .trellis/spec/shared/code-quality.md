# Code Quality Guidelines

> Mandatory code quality rules for the Thunder Subtitle project (FastAPI backend + Next.js frontend).

---

## Dual-Stack Conventions

This project has two codebases with different conventions:

| Aspect             | Python (Backend)                    | TypeScript (Frontend)               |
| ------------------ | ------------------------------------ | ------------------------------------ |
| Language           | Python 3.10+                        | TypeScript (strict mode)             |
| Framework          | FastAPI                              | Next.js 16                           |
| Naming             | snake_case                           | camelCase                            |
| Type system        | Pydantic models                      | TypeScript interfaces                |
| Linter             | ruff                                 | eslint                               |
| Formatter          | ruff format (Black-compatible)       | (project convention)                 |
| Type check         | mypy (if configured)                 | tsc --noEmit                         |
| API schema source  | Pydantic models (source of truth)    | Must mirror Python schemas           |

---

## TypeScript Rules

### No `any` Type

```typescript
// BAD
function process(data: any) { ... }

// GOOD - Use proper types
function process(data: ProcessInput) { ... }

// GOOD - Use unknown for truly unknown data
function parseJSON(input: string): unknown {
  return JSON.parse(input);
}
```

### No Non-Null Assertions

```typescript
// BAD
const name = user!.name;
const first = items[0]!;

// GOOD - Use optional chaining with fallback
const name = user?.name ?? "Unknown";
const first = items[0];
if (!first) {
  return { success: false, reason: "No items found" };
}
```

### No `@ts-expect-error` / `@ts-ignore`

```typescript
// FORBIDDEN
// @ts-expect-error - field exists at runtime
const value = user.customField;

// REQUIRED - Fix the type issue at the source
doSomething(validArg);
```

### No `console.log` in Production Code

```typescript
// BAD
console.log("User created:", userId);

// OK - Development-time warnings only
console.warn("Deprecated API used");
console.error("Operation failed:", error);
```

Remove all `console.log` before committing. Use browser dev tools for debugging.

---

## Python Rules

### Type Annotations

All function signatures must have type annotations:

```python
# BAD
def search(name, limit=10):
    ...

# GOOD
def search(name: str, limit: int = 10) -> list[Subtitle]:
    ...
```

### Pydantic Models for All API Bodies

```python
# BAD - raw dict
async def login(body: dict):
    ...

# GOOD - Pydantic model
class LoginRequest(BaseModel):
    username: str
    password: str

async def login(body: LoginRequest):
    ...
```

### Error Handling

Never swallow exceptions:

```python
# BAD - Silent failure
try:
    await operation()
except Exception:
    pass

# GOOD - Log and handle
try:
    await operation()
except Exception as e:
    logger.error("operation_failed", extra={"error": str(e)})
    raise HTTPException(status_code=500, detail="Operation failed")
```

---

## Import Ordering

### TypeScript

```typescript
// 1. React / Next.js
import { useState } from "react";
import { useRouter } from "next/navigation";

// 2. External packages
import { Search } from "lucide-react";

// 3. Internal modules (@/ alias)
import { fastApiClient } from "@/lib/api";
import type { TaskResponse } from "@/lib/types";

// 4. Relative imports
import { formatDate } from "./utils";
```

### Python

```python
# 1. Standard library
import asyncio
from pathlib import Path

# 2. Third-party packages
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

# 3. Local modules
from app.services.subtitle_service import SubtitleService
from app.models.schemas import SearchResult
```

Always use `import type` for type-only imports in TypeScript.

---

## Naming Conventions

### Python (Backend)

| Type           | Convention          | Example                        |
| -------------- | ------------------- | ------------------------------ |
| Variable       | snake_case          | `task_id`, `is_completed`      |
| Constant       | SCREAMING_SNAKE_CASE| `MAX_RETRY_COUNT`             |
| Function       | snake_case          | `search_subtitles()`           |
| Class          | PascalCase          | `FastApiClient`, `AppConfig`   |
| Pydantic model  | PascalCase          | `LoginRequest`, `TaskResponse` |
| File           | snake_case          | `subtitle_service.py`          |
| Router prefix  | kebab-case          | `/api/subtitle/search`         |

### TypeScript (Frontend)

| Type            | Convention                  | Example                     |
| --------------- | --------------------------- | --------------------------- |
| Variable       | camelCase                   | `taskId`, `isCompleted`     |
| Constant       | SCREAMING_SNAKE_CASE       | `DEFAULT_TIMEOUT`           |
| Function       | camelCase                   | `searchSubtitles()`          |
| Component      | PascalCase                  | `SearchBox`, `AppShell`      |
| Type/Interface | PascalCase                  | `TaskResponse`, `AppConfig`  |
| File           | PascalCase (components)     | `SearchBox.tsx`              |
| File           | camelCase (utilities)       | `api.ts`, `types.ts`        |

### Boolean Variables (Both Stacks)

Use `is`, `has`, `should`, `can` prefixes:

```typescript
// GOOD
const isLoading = true;
const hasPermission = user.role === "admin";
```

```python
# GOOD
is_completed = True
has_subtitle = nfo.has_chinese_subtitle
```

---

## snake_case / camelCase Boundary

API responses from FastAPI use **snake_case** (Python default). The frontend TypeScript defines types in **camelCase** but API responses arrive in snake_case.

**Convention**: Keep TypeScript types in camelCase. The `FastApiClient` methods accept camelCase params and convert to snake_case for API calls where needed. Backend Pydantic models use `snake_case` field names.

When mirroring a Pydantic model to TypeScript:

```python
# Python (Pydantic - source of truth)
class TaskResponse(BaseModel):
    task_id: str
    created_at: datetime
    is_completed: bool
```

```typescript
// TypeScript (mirror - keep snake_case to match API JSON)
interface TaskResponse {
  id: string;           // backend uses "id" not "task_id" in response
  created_at: string;    // matches snake_case from API JSON
  status: TaskStatus;
}
```

**Important**: The API responses use snake_case JSON keys. TypeScript interfaces must match these exactly — do NOT convert to camelCase in the interface definition unless there is an explicit transformation layer.

---

## Git 提交规则（MANDATORY — 违反即回退）

| 规则 | 说明 |
| --- | --- |
| **禁止直接提交** | AI 禁止在未经用户明确验收确认的情况下执行 `git commit`。必须先展示 commit 方案（变更文件清单 + 提交信息），等待用户回复 `ok`/`行`/`确认` 后方可提交 |
| **中文提交信息** | 所有 `git commit` 的提交信息必须使用中文 |
| **Conventional Commits** | 格式：`<type>: <中文描述>`，type 可选 `feat`/`fix`/`docs`/`chore`/`refactor`/`style` |
| **禁止 amend** | 禁止 `git commit --amend`，始终创建新提交 |
| **禁止 force push** | 禁止 `git push --force` 到 main/master |

### 提交确认流程

1. AI 执行 `git status --porcelain` + `git log --oneline -5`
2. AI 分析变更文件，按逻辑分组
3. AI 向用户展示分组方案和中文提交信息
4. 用户明确回复 `ok`/`行`/`确认` 后，AI 方可执行 `git add` + `git commit`
5. 用户回复 `不行`/`我自己来`/`manual` 时，AI 立即停止

**违反后果**：未经批准的提交应立即 `git revert` 回退。

---

## Lint and Type Check Before Commit

```bash
# Backend (from thunder-subtitle-api/)
ruff check . && ruff format --check .

# Frontend (from thunder-subtitle-web/)
next lint && tsc --noEmit
```

---

## Testing Guidelines

### Backend (Python)

```python
# tests/ directory, pytest
def test_search_subtitles():
    result = search_subtitles("test movie")
    assert len(result) > 0
```

### Frontend (TypeScript)

```typescript
// Co-located tests or __tests__/ directory
describe("FastApiClient", () => {
  it("should login successfully", async () => {
    const result = await fastApiClient.login("user", "pass");
    expect(result.access_token).toBeDefined();
  });
});
```

---

## Summary

| Rule                           | Reason              |
| ------------------------------ | ------------------- |
| No `any` type (TypeScript)     | Type safety         |
| No `!` assertions (TypeScript) | Runtime safety      |
| No `@ts-expect-error`          | Masks real issues   |
| No `console.log`               | Remove before commit|
| Pydantic for all API bodies    | Validation + docs   |
| Mirror types from backend      | No type drift       |
| Never swallow errors           | Debuggability       |
| Remove dead code               | Maintainability     |
| snake_case / camelCase aware   | Cross-boundary sync |