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