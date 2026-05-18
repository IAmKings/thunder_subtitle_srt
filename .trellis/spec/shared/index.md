# Shared Development Guidelines

> These guidelines apply to the Thunder Subtitle project: FastAPI Python backend + Next.js 16 frontend.

---

## Architecture Overview

```
Frontend (Next.js 16, React 19, TypeScript)
       ↕ HTTP (fetch / FastApiClient) + WebSocket (ProgressWebSocket)
Backend (FastAPI, Python, Pydantic, JWT auth)
       ↕ Service Layer
CLI Python Modules (thunder_subtitle)
       ↕
File System (media paths, config JSON, subtitle files)
```

**Deployment**: Single Docker image (node:20-alpine + python3), supervisord manages both Next.js and FastAPI processes.

---

## Documentation Files

| File                                   | Description                          | When to Read            |
| -------------------------------------- | ------------------------------------ | ----------------------- |
| [code-quality.md](./code-quality.md)   | Code quality mandatory rules         | Always                  |
| [typescript.md](./typescript.md)       | TypeScript best practices            | Type-related decisions  |
| [dependencies.md](./dependencies.md)  | Dependency versions and constraints  | Adding/updating deps    |

---

## Quick Navigation

| Task                        | File                                   |
| --------------------------- | -------------------------------------- |
| Code quality rules          | [code-quality.md](./code-quality.md)   |
| Type annotations            | [typescript.md](./typescript.md)       |
| Dependency management       | [dependencies.md](./dependencies.md)  |

---

## Core Rules (MANDATORY)

| Rule                                      | File                                   |
| ----------------------------------------- | -------------------------------------- |
| No `any` type (TypeScript)                 | [code-quality.md](./code-quality.md)   |
| No `console.log` in production code        | [code-quality.md](./code-quality.md)   |
| Mirror Pydantic schemas in `types.ts`      | [typescript.md](./typescript.md)       |
| Keep TS types in sync with backend schemas | [typescript.md](./typescript.md)      |
| snake_case (Python) / camelCase (TS) aware | [typescript.md](./typescript.md)      |

---

## Before Every Commit

- [ ] Backend: `ruff check .` + `ruff format --check .` — 0 errors
- [ ] Frontend: `next lint` — 0 errors
- [ ] Frontend: `tsc --noEmit` — 0 type errors
- [ ] No `any` types in new TypeScript code
- [ ] No `console.log` statements (remove before commit)
- [ ] Pydantic ↔ TypeScript type consistency checked (when schema changes)
- [ ] Tests pass (if applicable)

---

## Code Review Checklist

- [ ] TypeScript types are explicit, not `any`
- [ ] TypeScript types match backend Pydantic schemas
- [ ] API calls use `FastApiClient` (not raw `fetch` unless proxied)
- [ ] No duplicate type definitions (mirror from backend, don't reinvent)
- [ ] Naming follows conventions (Python: snake_case, TS: camelCase)
- [ ] Unused imports and dead code removed
- [ ] No swallowed errors (silent `catch` blocks)

---

**Language**: All documentation must be written in **English**.