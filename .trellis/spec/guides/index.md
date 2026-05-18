# Thinking Guides for Thunder Subtitle (FastAPI + Next.js)

> **Purpose**: Systematic thinking guides to catch issues before they become bugs.
>
> **Core Philosophy**: 30 minutes of thinking saves 3 hours of debugging.

---

## Why Thinking Guides?

**Most bugs and tech debt come from "didn't think of that"**, not from lack of skill:

- Didn't think about what happens at layer boundaries -> cross-layer bugs
- Didn't think about code patterns repeating -> duplicated code everywhere
- Didn't think about edge cases -> runtime errors
- Didn't think about future maintainers -> unreadable code

These guides help you **ask the right questions before coding**.

---

## Available Thinking Guides

| Guide                                                             | Purpose                                       | When to Use                                      |
| ----------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------ |
| [Cross-Layer Thinking](./cross-layer-thinking-guide.md)           | Think through data flow across layers         | Before implementing features that span 3+ layers |
| [Pre-Implementation Checklist](./pre-implementation-checklist.md) | Verify readiness before coding                | Before starting any feature implementation       |

---

## Quick Reference: When to Use Which Guide

### Cross-Layer Issues

Use [Cross-Layer Thinking Guide](./cross-layer-thinking-guide.md) when:

- [ ] Feature touches 3+ layers (Next.js Component, FastAPI Router, Service, CLI)
- [ ] Data format changes between layers (Pydantic → JSON → TypeScript)
- [ ] Multiple consumers need the same data
- [ ] You're not sure where to put some logic (frontend vs backend)
- [ ] Integrates with WebSocket, external APIs, or file system

### Before Writing Code

Use [Pre-Implementation Checklist](./pre-implementation-checklist.md) when:

- [ ] About to add a constant or config value
- [ ] About to implement new logic
- [ ] About to define a TypeScript interface or Pydantic model
- [ ] About to create a component or hook
- [ ] About to add a FastAPI router endpoint
- [ ] Feels like you've seen similar code before

---

## The Pre-Modification Rule (CRITICAL)

> **Before changing ANY value, ALWAYS search first!**

```bash
# Search TypeScript files
rg "value_to_change" --type ts

# Search Python files
rg "value_to_change" --type py

# Check how many files define this value
rg "CONFIG_NAME" -c
```

This single habit prevents most "forgot to update X" bugs.

---

## Project Architecture Layers

In the Thunder Subtitle project (FastAPI + Next.js), these are the layers:

```
Frontend (Next.js 16 Client Components - React, UI, hooks)
        ↕
  HTTP (fetch / FastApiClient) + WebSocket
        ↕
Backend (FastAPI Routers - validation, auth, business logic)
        ↕
Service Layer (Python services wrapping CLI modules)
        ↕
CLI Python Modules (thunder_subtitle - search, scan, review, config)
        ↕
File System (media paths, config JSON, subtitle files)
```

Each boundary is a potential source of bugs due to:

- **Serialization** - JSON serialization between Python (snake_case) and TypeScript (camelCase conventions)
- **Type mismatches** - Pydantic models define the contract; TypeScript must mirror them manually
- **Auth context** - JWT token stored in localStorage, sent via `Authorization: Bearer` header
- **WebSocket contracts** - Message format must be consistent between `ProgressWebSocket` and FastAPI WebSocket handler
- **Naming conventions** - Python snake_case vs TypeScript camelCase; API JSON uses snake_case

---

## Core Principles

1. **Search Before Write** - Always search for existing patterns before creating new ones
2. **Think Before Code** - 5 minutes of checklist saves 50 minutes of debugging
3. **Document Assumptions** - Make implicit assumptions explicit
4. **Verify All Layers** - Changes often need updates in both frontend and backend
5. **Learn From Bugs** - Add lessons to these guides after fixing non-trivial bugs

---

## Contributing

Found a new "didn't think of that" moment? Add it:

1. If it's a **general thinking pattern** -> Add to existing guide or create new one
2. If it caused a bug -> Add to "Lessons Learned" section in the relevant guide
3. If it's **project-specific** -> Create a separate project-specific guide

---

**Language**: All documentation should be written in **English**.