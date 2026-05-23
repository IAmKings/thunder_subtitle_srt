# Pre-commit Checklist

Complete this checklist before committing frontend code changes.

## Type Safety

- [ ] No `@ts-expect-error` or `@ts-ignore` comments added
- [ ] No `any` types in new code
- [ ] API response types match backend Pydantic schemas
- [ ] `fastApiFetch<T>()` calls specify the correct return type
- [ ] Component props have explicit TypeScript interfaces

## Component Development

- [ ] Interactive components use `'use client'` directive
- [ ] Authenticated pages wrapped with `withAuth()` HOC
- [ ] UI text uses `useTranslations()` (no hardcoded strings)
- [ ] Design tokens used for colors (no hardcoded hex values)
- [ ] Icons imported from `lucide-react`

## API Integration

- [ ] New API calls go through `FastApiClient` (not raw `fetch`)
- [ ] Loading and error states are handled in UI
- [ ] WebSocket connections cleaned up in `useEffect` return
- [ ] Auth token auto-injected via `fastApiFetch` (not manually added)

## Authentication

- [ ] `isLoading` checked before rendering protected content
- [ ] `withAuth()` used for page-level auth guards
- [ ] Token stored in `localStorage` with correct key (`thunder-subtitle-token`)

## State Management

- [ ] No React Query or SWR — use `FastApiClient` directly
- [ ] LocalStorage keys prefixed with `thunder-subtitle-`
- [ ] `typeof window !== 'undefined'` guards for SSR safety
- [ ] `setState(null)` values saved to local variable before use in callbacks (closure risk)

## Component Size

- [ ] Page components ≤ ~800 lines; extract sub-components if exceeded
- [ ] Single handler functions ≤ ~50 lines; extract utility functions if exceeded
- [ ] No duplicate color-mapping logic — use `StatusBadge`/`DryStateBadge` or utility functions
- [ ] No ad-hoc modal dialogs — use `ConfirmDialog` component

## CSS & Layout

- [ ] Design tokens used instead of hardcoded colors
- [ ] `border-outline-variant/30` for subtle dividers
- [ ] `WebkitTapHighlightColor: 'transparent'` on interactive elements
- [ ] Touch targets are minimum 44x44px where applicable

## Internationalization

- [ ] New UI strings added to both `translations.en` and `translations.zh`
- [ ] `useTranslations()` used for all user-facing text
- [ ] Translation keys follow the existing naming pattern

## Code Quality

- [ ] No `console.log` statements left in code
- [ ] Unused imports removed
- [ ] Components follow single responsibility principle

---

## Quick Commands

```bash
# Type check
npx tsc --noEmit

# Lint
pnpm lint

# Build
pnpm build

# Dev server
pnpm dev
```

## Common Issues to Watch

### Types
```typescript
// Bad
const data: any = await response.json();

// Good
const data: SearchResult = await response.json();
```

### Auth
```typescript
// Bad: Manual redirect in every page
if (!isAuthenticated) router.push('/login');

// Good: Use withAuth HOC
export default withAuth(MyPage);
```

### Styling
```typescript
// Bad: Hardcoded color
<div className="text-blue-400">

// Good: Design token
<div className="text-primary">
```

### API Calls
```typescript
// Bad: Raw fetch
const res = await fetch('/api/something');

// Good: FastApiClient
const data = await fastApiClient.searchSubtitles(name);
```

### React setState Closure Bug
```typescript
// Bad: setState(null) then use the state variable in callback
setSelectedMovie(null);
setItems((prev) => prev.filter((i) => i.file_path !== selectedMovie));
// selectedMovie is already null! Filter removes nothing!

// Good: Save to local variable first
const movieToRemove = selectedMovie;
setSelectedMovie(null);
setItems((prev) => prev.filter((i) => i.file_path !== movieToRemove));
```

**Rule**: Before calling `setState(null)` on a value you'll use in the same handler, save it to a local variable first. React's batching means the state update may not be visible in closures.

### Duplicate Color Mapping
```typescript
// Bad: Inline color mapping duplicated across 3+ locations
<span className={finding.status === "downloaded" ? "bg-green-500/15 text-green-400" : ...}>

// Good: Use shared utility or component
import { StatusBadge } from '@/components/StatusBadge';
<StatusBadge status={finding.status} label={t("status_downloaded")} />
```