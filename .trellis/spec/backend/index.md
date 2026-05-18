# Backend Development Guidelines Index

> **Tech Stack**: Python 3.10+ / FastAPI / Pydantic / python-jose (JWT) / httpx / WebSocket

## Related Guidelines

| Guideline                 | Location     | When to Read                 |
| ------------------------- | ------------ | ---------------------------- |
| **Shared Code Standards** | `../shared/` | Always - applies to all code |

---

## Documentation Files

| File                                                       | Description                                       | When to Read                       |
| ---------------------------------------------------------- | ------------------------------------------------- | ---------------------------------- |
| [directory-structure.md](./directory-structure.md)         | Project layout, module organization               | Starting a new feature             |
| [fastapi-architecture.md](./fastapi-architecture.md)       | FastAPI patterns, routers, services, auth, WS     | Creating/modifying API endpoints   |
| [error-handling.md](./error-handling.md)                  | HTTP exceptions, validation, error response spec  | Error-related decisions            |
| [quality.md](./quality.md)                                | Pre-commit checklist for backend code              | Before committing                  |

> **Obsolete files removed**: The previous specs described a Next.js/oRPC/Drizzle/PostgreSQL stack that does not match this project. They have been replaced with the files above.

---

## Quick Navigation

### Project Structure

| Task                          | File                                               |
| ----------------------------- | -------------------------------------------------- |
| Directory layout              | [directory-structure.md](./directory-structure.md) |
| Module organization           | [directory-structure.md](./directory-structure.md) |

### FastAPI Conventions

| Task                        | File                                             |
| --------------------------- | ------------------------------------------------ |
| Router & dependency pattern | [fastapi-architecture.md](./fastapi-architecture.md) |
| Service layer (CLI wrapper) | [fastapi-architecture.md](./fastapi-architecture.md) |
| Pydantic schemas            | [fastapi-architecture.md](./fastapi-architecture.md) |
| JWT authentication          | [fastapi-architecture.md](./fastapi-architecture.md) |
| WebSocket progress           | [fastapi-architecture.md](./fastapi-architecture.md) |
| Dual-import fallback        | [fastapi-architecture.md](./fastapi-architecture.md) |

### Error Handling

| Task                    | File                             |
| ----------------------- | -------------------------------- |
| HTTP error responses    | [error-handling.md](./error-handling.md) |
| Validation error format | [error-handling.md](./error-handling.md) |

---

## Core Rules Summary

| Rule                                                                 | Reference                                              |
| -------------------------------------------------------------------- | ------------------------------------------------------ |
| **Use `Depends()` for service injection**                           | [fastapi-architecture.md](./fastapi-architecture.md)   |
| **Dual-import fallback for CLI modules**                            | [fastapi-architecture.md](./fastapi-architecture.md)   |
| **Pydantic models for all request/response bodies**                 | [fastapi-architecture.md](./fastapi-architecture.md)   |
| **JWT auth on protected endpoints** — verify via `extract_token_from_request` | [fastapi-architecture.md](./fastapi-architecture.md)   |
| **Router prefix per domain** — registered in `main.py`              | [fastapi-architecture.md](./fastapi-architecture.md)   |
| **Schemas in `app/models/schemas.py`** — single file, grouped by domain | [fastapi-architecture.md](./fastapi-architecture.md)   |
| **Use standard HTTP status codes** — 400/401/404/500/502/504        | [error-handling.md](./error-handling.md)               |
| **Close CLI client resources** — call `client.close()` in finally block | [fastapi-architecture.md](./fastapi-architecture.md)   |
| **Async lock for WebSocket** — use `asyncio.Lock` in `ConnectionManager` | [fastapi-architecture.md](./fastapi-architecture.md)   |
| **Settings via `pydantic-settings`** — single `Settings` class     | [fastapi-architecture.md](./fastapi-architecture.md)   |

---

## Reference Files

| Feature              | Typical Location                                          |
| -------------------- | ---------------------------------------------------------- |
| FastAPI app & lifespan | `thunder-subtitle-api/app/main.py`                       |
| App settings         | `thunder-subtitle-api/app/config.py`                      |
| Auth router          | `thunder-subtitle-api/app/auth/router.py`                 |
| API routes           | `thunder-subtitle-api/app/api/*.py`                       |
| Service layer        | `thunder-subtitle-api/app/services/*_service.py`          |
| Pydantic schemas     | `thunder-subtitle-api/app/models/schemas.py`              |
| WebSocket manager    | `thunder-subtitle-api/app/ws/manager.py`                  |

---

**Language**: All documentation must be written in **English**.