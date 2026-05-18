# Cross-Layer Thinking Guide

> **Purpose**: Pre-implementation checklist for features that span multiple layers.
>
> **Core Principle**: 30 minutes of thinking saves 3 hours of debugging.

---

## When to Use This Guide

Use this guide when your feature:

- Touches 3+ layers (Next.js Component, FastAPI Router, Service, CLI)
- Involves data transformation between layers (Pydantic → JSON → TypeScript)
- Has real-time components (WebSocket progress)
- Receives data from external sources (APIs, file system)

---

## Project Layer Architecture

```
Frontend (Next.js 16 Client Components)
       ↕ HTTP (fetch / FastApiClient) + WebSocket
Backend (FastAPI Routers)
       ↕ Service Layer
CLI Python Modules (thunder_subtitle)
       ↕
File System (media paths, config JSON, subtitle files)
```

---

## Pre-Implementation Checklist

Before writing code, answer these questions:

### 1. Layer Identification

**Which layers does this feature touch?**

- [ ] Next.js Page/Component (UI, interactivity, hooks)
- [ ] FastAPI Router (validation, auth, business logic)
- [ ] Service Layer (wraps CLI modules)
- [ ] CLI Module (thunder_subtitle package)
- [ ] WebSocket (progress reporting)
- [ ] File System (media files, config, subtitles)
- [ ] External API (subtitle search API)

### 2. Data Flow Direction

**How does data flow?**

```
Read Flow:  CLI Module → Service → FastAPI Router → JSON Response → FastApiClient → React State → UI
Write Flow: UI → React Event → FastApiClient → FastAPI Router → Service → CLI Module → File System
WebSocket:  CLI Module → Service → WebSocket Manager → ProgressWebSocket → React State → UI
```

- [ ] Read-only (data flows from backend to UI)
- [ ] Write-only (data flows from UI to backend)
- [ ] Bidirectional (both directions)
- [ ] Real-time (WebSocket progress updates)

### 3. Data Format at Each Layer

**What format is the data at each boundary?**

| Layer            | Format                  | Example                                              |
| ---------------- | ----------------------- | ---------------------------------------------------- |
| CLI Module       | Python objects / dicts  | `dict` with snake_case keys                          |
| Service          | Python objects          | Pydantic models, Python primitives                   |
| FastAPI Router   | Pydantic-validated      | `TaskResponse`, `AppConfig`, `SearchResult`          |
| JSON Response    | Serialized JSON         | `{"id": "...", "created_at": "2024-01-01T..."}`     |
| FastApiClient    | TypeScript objects      | `TaskResponse` interface (snake_case keys)           |
| React State      | Component state         | `useState<TaskResponse \| null>`                     |
| UI               | Rendered output          | HTML, Tailwind-styled elements                       |

### 3.1 Snake_case / camelCase Boundary (CRITICAL!)

**Design Principle**: The API uses snake_case JSON keys (Python default). TypeScript interfaces must match these keys exactly — do NOT convert to camelCase in the interface definitions.

| Layer           | Convention      | Example                       |
| --------------- | --------------- | ----------------------------- |
| Python code     | snake_case      | `created_at`, `has_subtitle`  |
| JSON response   | snake_case      | `"created_at"`, `"has_subtitle"` |
| TypeScript type | snake_case     | `created_at`, `has_subtitle`  |

**Common trap**:

```typescript
// BAD - Don't convert API keys to camelCase
interface TaskResponse {
  createdAt: string;  // API sends "created_at"
  hasSubtitle: boolean;  // API sends "has_chinese_subtitle"
}

// GOOD - Match the API JSON keys exactly
interface TaskResponse {
  created_at: string;
  has_chinese_subtitle: boolean;
}
```

### 4. Data Transformation Points

**Where does format change? Who is responsible?**

| From                  | To                  | Transformer          | Location                     |
| --------------------- | ------------------- | -------------------- | ---------------------------- |
| CLI module dict       | Pydantic model      | Service layer        | `*_service.py`               |
| Pydantic model        | JSON response       | FastAPI serialization| Router handler                |
| JSON response         | TypeScript object   | `fastApiFetch<T>()`  | `api.ts`                     |
| Python datetime       | ISO string          | Pydantic serializer  | Automatic (`datetime` → str)  |
| User input (form)     | Validated data      | Pydantic schema      | FastAPI request body          |
| Snake_case JSON       | TypeScript typing   | Manual mirroring     | `types.ts`                   |

### 5. Boundary Questions (Critical!)

For each layer boundary, ask:

**Frontend / FastAPI Boundary:**

- What format does the FastAPI response return? (Check Pydantic schema)
- Does `FastApiClient` handle the response correctly? (Check method return type)
- What happens if the response format changes? (Update both `schemas.py` and `types.ts`)
- Are WebSocket message formats documented and consistent?

**FastAPI / Service Boundary:**

- Does the service return the type the router expects?
- Are CLI module exceptions properly caught and converted to HTTP errors?
- Is async/sync handled correctly? (Service calls CLI sync functions from async routers)

**Service / CLI Boundary:**

- Does the CLI module function exist and match the expected signature?
- Are file paths properly validated before passing to CLI functions?
- Are resources (like HTTP clients) properly closed? (`client.close()` in finally block)

**WebSocket / Frontend Boundary:**

- Does the WebSocket message format match what `ProgressWebSocket.onProgress` expects?
- Are reconnection and error handling robust?
- Is the `taskId` passed correctly when connecting?

### 6. Authentication Context

**Where is auth available?**

| Layer           | Auth Method                            | Notes                                   |
| --------------- | -------------------------------------- | --------------------------------------- |
| FastAPI Router  | `Depends(get_current_user)`            | JWT token extraction from header       |
| Auth Router     | `/api/auth/login`                      | Returns JWT token                       |
| Frontend        | `AuthProvider` + `useAuth`             | Stores token in localStorage            |
| FastApiClient   | `Authorization: Bearer <token>`        | Auto-attached by `fastApiFetch`         |
| WebSocket       | No auth (connect by taskId)            | Consider adding auth in future          |

**Common auth pitfall**:

```typescript
// BAD - API call without auth token
const response = await fetch("/api/config");

// GOOD - Use FastApiClient which auto-attaches token
const config = await fastApiClient.getConfig();
```

```python
# BAD - No auth check on protected endpoint
@router.get("/config")
async def get_config():
    ...

# GOOD - Require auth
@router.get("/config")
async def get_config(user: str = Depends(get_current_user)):
    ...
```

### 7. Edge Cases

- [ ] What if the data is empty/null?
- [ ] What if the FastAPI request fails (network error, 500)?
- [ ] What if the WebSocket disconnects mid-progress?
- [ ] What if the CLI module raises an unexpected exception?
- [ ] What if the user navigates away during a running task?
- [ ] What if the JWT token expires mid-operation?
- [ ] What if the same action fires twice (double-click)?

---

## Common Patterns

### Pattern A: Read Data (Config/Status)

**Layers**: Next.js Component → FastApiClient → FastAPI Router → Service → CLI Module

**Data Flow**:

```
1. Component: Calls fastApiClient.getConfig()
2. FastApiClient: GET /api/config with auth header
3. Router: Validates auth, calls service
4. Service: Calls CLI module function
5. CLI: Returns config data
6. Response: JSON back through FastApiClient
7. Component: Re-renders with data
```

**Common Issues**:

- **Auth required**: Remember to check `isLoading` state from `useAuth` before rendering
- **Error states**: Handle network failures and invalid tokens
- **Stale data**: Consider when to re-fetch vs. cache

### Pattern B: Submit Action (Search/Scan/Review)

**Layers**: UI Event → FastApiClient → FastAPI Router → Service → CLI → Results

**Data Flow**:

```
1. User: Clicks button or submits form
2. FastApiClient: POST /api/tasks with auth header
3. Router: Validates auth, creates task
4. Service: Wraps CLI call in background task
5. WebSocket: Sends progress updates
6. Component: Updates UI based on progress
```

**Common Issues**:

- **Loading state**: Disable button while request is in flight
- **Error handling**: Show user-friendly error messages
- **Double-submit**: Prevent by disabling button or using debouncing
- **Task polling**: Client must poll `/api/tasks/{id}` or use WebSocket for progress

### Pattern C: Real-time Progress (WebSocket)

**Layers**: CLI → Service → WebSocket Manager → ProgressWebSocket → React State → UI

**Data Flow**:

```
1. CLI Module: Reports progress
2. Service: Sends progress to ConnectionManager
3. WebSocket: Broadcasts to connected clients
4. ProgressWebSocket:.onProgress callback updates state
5. Component: Re-renders with progress data
```

**Common Issues**:

- **Connection drops**: Must handle reconnection
- **Task not found**: Server may not have taskId yet
- **Message format mismatch**: Both sides must agree on JSON schema
- **Cleanup**: Disconnect WebSocket when component unmounts

---

## Lessons from Common Bugs

| Bug                                  | Root Cause                                              | Prevention                                              |
| ------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------- |
| Type mismatch between frontend/backend | Pydantic schema changed but `types.ts` not updated   | Update both `schemas.py` and `types.ts` in same PR     |
| snake_case / camelCase confusion     | Converting API keys to camelCase in TS interfaces       | Keep TS interfaces matching snake_case API keys        |
| Auth token not sent                   | Using raw `fetch` instead of `FastApiClient`           | Always use `FastApiClient` for authenticated endpoints  |
| WebSocket message format mismatch     | Backend sends different format than frontend expects    | Define and document WebSocket message schema           |
| CLI client resource leak             | Missing `client.close()` in finally block                | Always close HTTP clients in finally                    |
| Async/sync mismatch                   | Calling sync CLI function from async router without await | Use `asyncio.to_thread()` for sync CLI calls           |
| Token expiry not handled             | JWT expires but frontend doesn't redirect to login     | Add 401 response interceptor → redirect to login       |

---

## Checklist Template

Copy this for your feature:

```markdown
## Feature: [Name]

### Layers Involved

- [ ] Next.js Component
- [ ] FastAPI Router
- [ ] Service Layer
- [ ] CLI Module
- [ ] WebSocket
- [ ] File System

### Data Flow

[Describe the flow]

### Format at Each Layer

| Layer | Format |
| ----- | ------ |
| ...   | ...    |

### Transformation Points

| From | To  | Who |
| ---- | --- | --- |
| ...  | ... | ... |

### Auth Strategy

- FastAPI Router: [public / Depends(get_current_user)]
- Frontend: [withAuth HOC / useAuth hook]

### Edge Cases Considered

- [ ] Empty/null data
- [ ] Network failure / API error
- [ ] Token expiry
- [ ] WebSocket disconnect
- [ ] Double-submit prevention
```

---

## Cross-Layer Review Mindset

### The Comparison Trap

**Wrong thinking**: "This line wasn't changed, so it must be correct."

```
Comparison thinking (surface level):
  Before: created_at: str -> After: created_at: str -> "No change, must be fine"

Global thinking (design level):
  Design intent: API sends ISO timestamp strings -> Current: TS expects Date object -> "This is a bug"
```

**Key insight**: Review validates "system state is correct", not just "change is correct".

### Data Outlet Checklist

Every review must cover ALL data outlets:

```
Data Outlets:
|-- FastAPI JSON Response (router -> client)
|-- WebSocket Message (manager -> ProgressWebSocket)
|-- React Component Props (parent -> child)
|-- localStorage (auth token)
|-- File System writes (config, subtitles)
```

Ask: **"Is the format correct at EACH outlet?"**

### Review Three Questions

Before finishing any cross-layer review:

1. **Outlet Question**: Have I checked ALL data outlets, not just the "core" one?
2. **Design Question**: Does existing code match design principles? (Not "is the change correct?")
3. **Checklist Question**: Could my checklist itself be wrong?

---

## When Things Go Wrong

If you encounter a cross-layer bug:

1. **Identify the boundary** - Where exactly does it fail? Frontend? Router? Service? CLI?
2. **Log at boundaries** - Add console.log / logger.info before and after each transformation
3. **Check assumptions** - What format did you expect vs what you got?
4. **Test in isolation** - Can you reproduce with a simple test case?
5. **Document the fix** - Add to "Lessons from Common Bugs" table
6. **Update types.ts** - If the Pydantic schema was wrong, update both sides

---

**Language**: All documentation should be written in **English**.