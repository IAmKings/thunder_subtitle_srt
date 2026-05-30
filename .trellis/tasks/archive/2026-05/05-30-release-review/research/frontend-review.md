# Frontend Code Review (Next.js 16 + React 19 + TypeScript)

Scanned 33 files across `thunder-subtitle-web/src/`.

## Finding Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2 |
| HIGH | 7 |
| MEDIUM | 14 |
| LOW | 18 |

---

## CRITICAL

### C1. Auth token in localStorage (XSS surface)
- `lib/auth.tsx:68`, `lib/api.ts:32` — JWT stored in `thunder-subtitle-token` localStorage key
- Fix: Use HttpOnly cookie or at minimum SameSite+Secure flags

### C2. dangerouslySetInnerHTML in layout.tsx
- `app/layout.tsx:34-64` — SW registration script via `dangerouslySetInnerHTML`
- Fix: Move to separate `.js` file or import via `src` attribute

---

## HIGH

- H1: Download link no error handling (`SubtitleList.tsx:27-32`, `SubtitleItem.tsx:16-19`)
- H2: Inconsistent error message language (English vs Chinese in `api.ts`)
- H3: `withAuth` HOC no redirect fallback (`auth.tsx:179-185`)
- H4: SearchPage input missing `<label>` (`search/page.tsx:132-139`)
- H5: Login page not i18n'd (`login/page.tsx`)
- H6: Legacy components hardcoded Chinese (`ThunderSubtitleApp.tsx`, `SearchBox.tsx`, etc.)
- H7: `t()` function uses `string` key type, no compile-time safety (`i18n.ts:472`)

## MEDIUM

- M1: `as Type` assertions without runtime validation (multiple files)
- M2: Duplicate history management systems (`search-state.tsx` vs `useHistory.ts`)
- M3: Pagination state shared between movie/subtitle views (`verification/page.tsx`)
- M4: XSS via subtitle URL in download link
- M5: SearchPage fallback swallows FastAPI errors
- M6: WebSocket malformed message silently ignored (`api.ts:394-396`)
- M7: Preview AbortError not distinguished from real errors (`verification/page.tsx:378-382`)
- M8: Redundant API call in error handler (`scanner/page.tsx:329-339`)
- M9: No CSRF protection
- M10: Default credentials exposed in login page
- M11: `handleReject` double-sort (`verification/page.tsx:314-321`)
- M12: MovieList image empty `alt=""` (`MovieList.tsx:27`)
- M13: SearchPage duration filter silent fail
- M14: Global `-webkit-tap-highlight-color` reset (`globals.css:67`)

## LOW (selected critical ones)

- L8: i18n key naming inconsistent across codebase
- L15: Logout doesn't revoke token server-side
- L10: Proxy rewrite shadows Next.js API route (`next.config.ts:21-27`)
- L11: `.env.local` NEXT_PUBLIC_API_URL never consumed

## Positive Observations

- Clean State/Actions Context separation pattern
- Proper WebSocket lifecycle management
- AbortController for preview fetches
- No `any` types found (uses `unknown`)
- `useSyncExternalStore` for language persistence
- `Promise.allSettled` for batch operations
- Comprehensive i18n (~235 keys per language)
