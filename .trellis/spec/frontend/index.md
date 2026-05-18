# Thunder Subtitle Web — Frontend Development Guidelines

> Guidelines for the Next.js 16 + React 19 + TypeScript + TailwindCSS 4 dark-themed web UI for Thunder Subtitle.

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19
- **Language**: TypeScript (strict mode)
- **Styling**: TailwindCSS 4 with custom design tokens (`@theme` block)
- **API**: FastApiClient (direct HTTP to FastAPI backend), SubtitleApiClient (legacy Next.js proxy)
- **Real-time**: ProgressWebSocket (native WebSocket)
- **Auth**: JWT via FastAPI `/api/auth/login`, stored in localStorage
- **i18n**: Custom key-value dictionary (`useTranslations` hook)
- **Icons**: lucide-react
- **Deployment**: Docker standalone (`output: "standalone"`)

---

## Documentation Files

| File | Description | Priority |
|------|-------------|----------|
| [directory-structure.md](./directory-structure.md) | Project structure and file conventions | **Must Read** |
| [components.md](./components.md) | Dark theme UI, AppShell, Sidebar, ThemeProvider | **Must Read** |
| [authentication.md](./authentication.md) | JWT auth with FastAPI, AuthProvider, withAuth HOC | **Must Read** |
| [api-integration.md](./api-integration.md) | FastApiClient, SubtitleApiClient, ProgressWebSocket | **Must Read** |
| [hooks.md](./hooks.md) | useAuth, useTranslations, useHistory | Reference |
| [state-management.md](./state-management.md) | React Context + localStorage patterns | Reference |
| [type-safety.md](./type-safety.md) | TypeScript types mirroring Pydantic schemas | Reference |
| [css-layout.md](./css-layout.md) | Dark theme design tokens, layout patterns | Reference |
| [quality.md](./quality.md) | Pre-commit checklist and code quality standards | Reference |

---

## Quick Navigation by Task

### Before Starting Development

| Task | Document |
|------|----------|
| Understand project structure | [directory-structure.md](./directory-structure.md) |
| Learn dark theme system | [css-layout.md](./css-layout.md) |
| Set up authentication | [authentication.md](./authentication.md) |

### During Development

| Task | Document |
|------|----------|
| Make API calls | [api-integration.md](./api-integration.md) |
| Create UI components | [components.md](./components.md) |
| Use custom hooks | [hooks.md](./hooks.md) |
| Manage state | [state-management.md](./state-management.md) |
| Ensure type safety | [type-safety.md](./type-safety.md) |
| Handle CSS & layout | [css-layout.md](./css-layout.md) |

### Before Committing

| Task | Document |
|------|----------|
| Run quality checklist | [quality.md](./quality.md) |
| Check type safety | [type-safety.md](./type-safety.md) |

---

## Core Rules Summary

| Rule | Reference |
|------|-----------|
| **Use FastApiClient for backend calls** | [api-integration.md](./api-integration.md) |
| **Use AuthProvider + useAuth for auth** | [authentication.md](./authentication.md) |
| **Use useTranslations for i18n** | [hooks.md](./hooks.md) |
| **Use design tokens, not raw colors** | [css-layout.md](./css-layout.md) |
| **Always check isLoading before rendering** | [authentication.md](./authentication.md) |
| **No `any` types or `@ts-expect-error` in new code** | [type-safety.md](./type-safety.md) |
| **Use `withAuth()` HOC for page-level guards** | [authentication.md](./authentication.md) |
| **Mirror backend Pydantic schemas in types.ts** | [type-safety.md](./type-safety.md) |

---

## Architecture Overview

```
+--------------------------------------------------------------+
|                   Next.js 16 Application                      |
|                                                               |
|  app/                          components/                    |
|  ├── login/page.tsx            ├── AppShell.tsx               |
|  ├── search/page.tsx           ├── Sidebar.tsx                |
|  ├── scanner/page.tsx          ├── TopBar.tsx                 |
|  ├── verification/page.tsx    ├── SearchBox.tsx              |
|  ├── settings/page.tsx         ├── SubtitleItem.tsx           |
|  └── layout.tsx (AuthProvider) ├── SubtitleList.tsx           |
|                                 ├── History.tsx                |
|  lib/                           ├── ThemeProvider.tsx          |
|  ├── api.ts (FastApiClient)    └── ThunderSubtitleApp.tsx     |
|  ├── auth.tsx (AuthProvider)                                   |
|  ├── i18n.ts (useTranslations)                                |
|  └── types.ts (TS ↔ Pydantic)   hooks/                       |
|                                   └── useHistory.ts            |
+---------------------------------------------------------------+
                                 |
           FastApiClient (HTTP + Auth header)  |  WebSocket
                                 |              |
+--------------------------------+-------------+
|              FastAPI Backend                   |
|  /api/auth/login  /api/subtitle/search        |
|  /api/config  /api/tasks  /api/review         |
|  /api/media  /ws/progress/{taskId}            |
+-----------------------------------------------+
```

---

## Getting Started

1. **Read the Must-Read documents** — Components, authentication, and API integration
2. **Understand the dark theme** — See [css-layout.md](./css-layout.md) for design tokens
3. **Set up API client** — Use `fastApiClient` from `@/lib/api`
4. **Build components** — Follow [components.md](./components.md) patterns
5. **Before committing** — Complete the [quality.md](./quality.md) checklist

---

**Language**: All documentation is written in **English**.