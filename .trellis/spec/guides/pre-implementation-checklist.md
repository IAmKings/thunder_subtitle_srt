# Pre-Implementation Checklist

> **Purpose**: Ask the right questions **before** writing code to avoid common architectural mistakes.

---

## Why This Checklist?

Most code quality issues aren't caught during implementation—they're **designed in** from the start:

| Problem                                | Root Cause                                    | Cost                       |
| -------------------------------------- | --------------------------------------------- | -------------------------- |
| Types duplicated in `types.ts` and `schemas.py` | Didn't ask "is this type already defined?" | Debugging type mismatches  |
| Same logic repeated in multiple components | Didn't ask "does this pattern exist?"        | Creating abstraction later |
| Cross-layer type mismatches            | Didn't ask "who else consumes this?"          | Debugging + fixing         |
| Pydantic schema changed but TS not updated | Didn't ask "does this affect the frontend?" | API contract violation     |
| FastAPI endpoint duplicates existing   | Didn't ask "does a similar endpoint exist?"   | API surface bloat          |

**This checklist catches these issues before they become code.**

---

## The Checklist

### 1. Constants & Configuration

Before adding any constant or config value:

- [ ] **Cross-stack usage?** Will this value be used in both frontend and backend?
  - If yes -> Define in backend (`config.py` / `schemas.py`), mirror in frontend (`types.ts`)
  - Example: Task status values (`pending`, `running`, etc.) must be consistent across both

- [ ] **Multiple consumers?** Will this value be used in 2+ files?
  - If yes -> Put in a shared constants file for that codebase
  - Example: Don't define `DEFAULT_TIMEOUT = 30000` in each component

- [ ] **Magic number?** Is this a hardcoded value that could change?
  - If yes -> Extract to named constant with comment explaining why
  - Example: `WS_RECONNECT_DELAY: 3000  // ms, wait before reconnecting`

- [ ] **Environment-dependent?** Does this differ between dev/staging/production?
  - If yes -> Use environment variables
  - Example: `NEXT_PUBLIC_API_URL`, `JWT_SECRET`, `MEDIA_PATHS`

### 2. Logic & Patterns

Before implementing any logic:

- [ ] **Pattern exists?** Search for similar patterns in the codebase first

  ```bash
  # Example: Before implementing a new API client method
  rg "async.*get" thunder-subtitle-web/src/lib/api.ts
  rg "get_" thunder-subtitle-api/app/api/

  # Example: Before implementing a new hook
  rg "useAuth\|useHistory\|useTranslations" thunder-subtitle-web/src/
  ```

- [ ] **Will repeat?** Will this exact logic be needed in 2+ places?
  - If yes -> Create a shared hook/utility **first**, then use it
  - Example: `useAuth` hook instead of repeating auth logic in each page

- [ ] **Frontend or backend?** Where does this logic belong?
  - Pure UI transformation -> Frontend component
  - Data validation / business rules -> Backend (Pydantic schema + service)
  - Shared between components -> Frontend hook or utility

### 3. Types & Schemas

Before defining types:

- [ ] **Pydantic schema exists?** Is there already a Pydantic model for this data?
  - Check `schemas.py`: `rg "class.*Model" thunder-subtitle-api/app/models/schemas.py`
  - If yes -> Mirror it in `types.ts`, don't redefine from scratch

- [ ] **Existing TypeScript type?** Does a similar type already exist?
  - Search before creating: `rg "interface.*Name\|type.*Name" thunder-subtitle-web/src/lib/types.ts`

- [ ] **Cross-boundary type?** Is this type used in both frontend and backend?
  - If yes -> Define in `schemas.py` (backend, source of truth), mirror in `types.ts` (frontend)
  - Both must be updated in the same PR

- [ ] **Snake_case matching?** Do TypeScript field names match the API JSON response?
  - Example: `created_at` in Python → `created_at` in TypeScript (NOT `createdAt`)

- [ ] **Literal types?** Are enum-like values defined as union types on both sides?
  ```python
  # Python
  type: Literal["scan", "review", "dump"]
  ```
  ```typescript
  // TypeScript
  export type TaskType = "scan" | "review" | "dump";
  ```

### 4. UI Components

Before creating UI components:

- [ ] **Server or Client Component?** Does this component need:
  - Event handlers (onClick, onChange)? -> `'use client'`
  - React hooks (useState, useEffect)? -> `'use client'`
  - Browser APIs (window, document)? -> `'use client'`
  - None of the above? -> Keep as Server Component (default)

- [ ] **Similar component exists?** Search before creating
  - `rg "function.*Component\|export.*Component" thunder-subtitle-web/src/components/`

- [ ] **Uses dark theme tokens?** Are you using `@theme` design tokens, not raw colors?
  - Reference: `src/app/globals.css` for the design token system

- [ ] **Needs auth?** Does this page require authentication?
  - If yes -> Wrap with `withAuth()` HOC or check `useAuth()` state

### 5. API Endpoints (FastAPI Routers)

Before writing a FastAPI endpoint:

- [ ] **Existing endpoint?** Does a similar route already exist?
  - Check: `rg "router\.(get|post|put|delete)" thunder-subtitle-api/app/api/`
  - Can you extend an existing endpoint rather than creating a new one?

- [ ] **Correct HTTP method?**
  - GET for read operations (search, list, get)
  - POST for create operations (create task, login)
  - PUT for update operations (update config)
  - DELETE for removal operations

- [ ] **Authentication level?** Does this endpoint need authentication?
  - Public endpoints (search) -> No auth required
  - Protected endpoints (config, tasks) -> Add `Depends(get_current_user)`
  - Check other endpoints in the same router for consistency

- [ ] **Pydantic model defined?** Both request and response models should be in `schemas.py`

- [ ] **Service layer used?** Business logic should be in `*_service.py`, not in the router

### 6. Dependencies

Before adding a dependency:

- [ ] **Already installed?** Check the right `requirements.txt` or `package.json`
  ```bash
  rg "dependency-name" thunder-subtitle-api/requirements.txt
  rg "dependency-name" thunder-subtitle-web/package.json
  ```

- [ ] **Built-in alternative?** Can you use a native API or existing utility instead?
  - Example: `structuredClone()` instead of `lodash.cloneDeep` (frontend)
  - Example: `pathlib.Path` instead of `os.path` (backend)

- [ ] **Bundle impact?** (Frontend only) Will this significantly increase the client bundle?
  - If yes -> Consider dynamic import or server-only usage

---

## Quick Decision Tree

```
Adding a value/constant?
|-- Used in both frontend AND backend? -> Backend: schemas.py/config.py, Frontend: types.ts (mirror)
|-- Used in 2+ files within same codebase? -> shared constants file
+-- Single file only? -> Local constant is fine

Adding logic/behavior?
|-- Similar pattern exists? -> Extend or reuse existing
|-- Will be used in 2+ places? -> Create shared hook/utility first
+-- Single use only? -> Implement directly (but document pattern)

Adding a type?
|-- Pydantic model exists? -> Mirror in types.ts with matching field names
|-- Crosses API boundary? -> schemas.py (source of truth) + types.ts (mirror)
+-- Frontend-only? -> Define in types.ts or local

Adding a component?
|-- Needs interactivity? -> 'use client'
|-- Pure display? -> Server Component (default)
+-- Mix of both? -> Split into Server wrapper + Client interactive part

Adding an API endpoint?
|-- Similar route exists? -> Extend it
|-- Needs auth? -> Add Depends(get_current_user)
+-- New endpoint? -> Router + Service + Pydantic schema
```

---

## What to Verify Across Layers

When implementing a feature that spans Frontend → API → Service → CLI, verify:

| Layer            | Check                                                              |
| ---------------- | ------------------------------------------------------------------ |
| Next.js Component| Loading/error states handled? Auth checked? WebSocket connected?   |
| FastApiClient    | Method exists? Correct return type? Auth header attached?          |
| FastAPI Router   | Input validated? Auth required? Response model matches?             |
| Service Layer    | CLI function exists? Resources cleaned up? Errors caught?          |
| CLI Module       | Function signature matches service call? Returns expected format?  |
| Pydantic ↔ TS    | Field names match? Types compatible? Literal values consistent?     |

---

## Anti-Patterns to Avoid

### Redefining Backend Types

```typescript
// DON'T: Manually define types with different field names than backend
interface Task {
  taskId: string;      // backend sends "id"
  taskType: string;    // backend sends "type"
  createdAt: string;   // backend sends "created_at"
}

// DO: Mirror backend Pydantic schema exactly
interface TaskResponse {
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

### Using Raw `fetch` Instead of FastApiClient

```typescript
// DON'T: Raw fetch without auth
const response = await fetch("/api/config");
const config = await response.json();

// DO: Use FastApiClient which handles auth and typing
const config = await fastApiClient.getConfig();
```

### Business Logic in Router

```python
# DON'T: Business logic directly in router
@router.get("/config")
async def get_config():
    result = thunder_subtitle_config.load()  # direct CLI call
    return result

# DO: Use service layer
@router.get("/config")
async def get_config(service: ConfigService = Depends(get_config_service)):
    return service.get_config()
```

### Missing `client.close()` in Service

```python
# DON'T: Resource leak
async def search(self, name: str):
    client = ThunderSubtitleClient()
    result = client.search(name)
    return result  # client never closed!

# DO: Always close in finally block
async def search(self, name: str):
    client = ThunderSubtitleClient()
    try:
        result = client.search(name)
        return result
    finally:
        client.close()
```

---

## When to Use This Checklist

| Trigger                                    | Action                    |
| ------------------------------------------ | ------------------------- |
| About to add a constant                    | Run through Section 1     |
| About to implement logic                   | Run through Section 2     |
| About to define a type or schema           | Run through Section 3     |
| About to create a component                | Run through Section 4     |
| About to add an API endpoint               | Run through Section 5     |
| About to add a dependency                  | Run through Section 6     |
| Feels like you've seen similar code before | **STOP** and search first |

---

## Relationship to Other Guides

| Guide                                                         | Focus                     | Timing                      |
| ------------------------------------------------------------- | ------------------------- | --------------------------- |
| **Pre-Implementation Checklist** (this)                       | Questions before coding   | Before writing code         |
| [Cross-Layer Thinking Guide](./cross-layer-thinking-guide.md) | Data flow across layers   | Complex feature planning    |

**Ideal workflow:**

1. Read this checklist before coding
2. Use Cross-Layer guide for features spanning frontend ↔ backend ↔ CLI

---

## Lessons Learned

| Date | Issue                                               | Lesson                                                             |
| ---- | --------------------------------------------------- | ------------------------------------------------------------------ |
| -    | Pydantic schema changed but types.ts not updated    | Always update both files in the same PR                            |
| -    | Using raw `fetch` instead of FastApiClient          | Always use FastApiClient for authenticated endpoints               |
| -    | Business logic in router instead of service          | Keep routers thin; business logic belongs in service layer         |
| -    | snake_case fields converted to camelCase in TS      | TypeScript interfaces must match snake_case JSON keys from API     |
| -    | Missing `client.close()` causing resource leaks     | Always close CLI clients in finally blocks                         |

---

**Core Principle**: 5 minutes of checklist thinking saves 50 minutes of refactoring.