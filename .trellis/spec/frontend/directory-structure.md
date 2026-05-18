# Directory Structure

This document describes the file organization of the `thunder-subtitle-web` frontend application.

## Overview

```
thunder-subtitle-web/
├── next.config.ts              # Next.js config: standalone output, FastAPI proxy rewrite
├── package.json                 # Dependencies: next 16, react 19, lucide-react, tailwindcss 4
├── src/
│   ├── app/
│   │   ├── api/subtitle/route.ts   # Next.js API route proxy (legacy search)
│   │   ├── login/page.tsx          # Login page
│   │   ├── scanner/page.tsx        # Scanner page — media library scan
│   │   ├── search/page.tsx         # Search page — subtitle search & download
│   │   ├── settings/page.tsx       # Settings page — app configuration
│   │   ├── verification/page.tsx   # Verification page — subtitle quality review
│   │   ├── globals.css             # Dark theme design tokens + base styles
│   │   ├── layout.tsx              # Root layout: AuthProvider + AppShell
│   │   └── page.tsx               # Redirects to /search
│   ├── components/
│   │   ├── AppShell.tsx            # Main app shell (sidebar + topbar + content)
│   │   ├── History.tsx             # Search/download history component
│   │   ├── SearchBox.tsx           # Search input with submit handler
│   │   ├── Sidebar.tsx             # Navigation sidebar with auth info
│   │   ├── SubtitleItem.tsx        # Individual subtitle card
│   │   ├── SubtitleList.tsx        # Subtitle list with select/download
│   │   ├── ThunderSubtitleApp.tsx  # Legacy combined app (unused in new pages)
│   │   ├── ThemeProvider.tsx       # Theme + language context provider
│   │   └── TopBar.tsx             # Top navigation bar with language toggle
│   ├── hooks/
│   │   └── useHistory.ts           # Local storage history hooks (search + download)
│   └── lib/
│       ├── api.ts                  # FastApiClient + SubtitleApiClient + ProgressWebSocket
│       ├── auth.tsx                # AuthProvider, useAuth, withAuth
│       ├── i18n.ts                 # Internationalization (en/zh translations)
│       └── types.ts                # TypeScript types mirroring backend Pydantic schemas
```

## Key Conventions

### File Naming

| Type | Convention | Example |
|------|-----------|---------|
| Pages | kebab-case directory | `search/page.tsx` |
| Components | PascalCase | `SearchBox.tsx` |
| Hooks | camelCase with `use` prefix | `useHistory.ts` |
| Utilities | camelCase | `api.ts` |
| Types | camelCase | `types.ts` |

### Import Aliases

The project uses `@/` mapped to `src/`:

```typescript
import { useAuth } from "@/lib/auth";
import { SearchBox } from "@/components/SearchBox";
import type { Subtitle } from "@/lib/types";
```

### Page Structure

Each page loads its own data and uses `withAuth()` HOC for auth protection:

```typescript
// app/search/page.tsx
import { withAuth } from "@/lib/auth";

function SearchPage() {
  // Page logic
}

export default withAuth(SearchPage);
```

### No Module Boundary

The project is a single-repo frontend without feature modules. All components are in `components/` and all hooks in `hooks/`. For a project of this scale, flat organization is preferred over nested feature folders.

## Anti-Patterns to Avoid

- Creating `modules/` or `features/` directories (not used in this project)
- Using barrel exports (`index.ts`) for components (import directly)
- Adding UI component libraries (Radix, shadcn) — the project uses raw Tailwind + custom design tokens
- Introducing state management libraries (Redux, Zustand) — use React Context + localStorage