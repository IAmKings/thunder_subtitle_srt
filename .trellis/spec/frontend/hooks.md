# Hook Development Patterns

This document covers the custom hooks used in Thunder Subtitle Web.

## Available Hooks

| Hook | Source | Purpose |
|------|--------|---------|
| `useAuth()` | `lib/auth.tsx` | Auth state, login, logout |
| `useTranslations()` | `lib/i18n.ts` | i18n translation function |
| `useLanguage()` | `components/ThemeProvider.tsx` | Get/set language (en/zh) |
| `useSearchHistory()` | `hooks/useHistory.ts` | Search history CRUD (localStorage) |
| `useDownloadHistory()` | `hooks/useHistory.ts` | Download history CRUD (localStorage) |

## useAuth

The primary authentication hook, provided by `AuthProvider`:

```typescript
const { user, token, isAuthenticated, isLoading, login, logout } = useAuth();
```

See [authentication.md](./authentication.md) for full details.

## useTranslations

Returns a `t()` function for looking up translations:

```typescript
import { useTranslations } from '@/lib/i18n';

function MyComponent() {
  const t = useTranslations();
  return <h1>{t('search')}</h1>; // "Search" (en) or "搜索" (zh)
}
```

The hook depends on `useLanguage()` from `ThemeProvider`. Language changes re-render all components that use `t()`.

Adding new keys: add entries to both `translations.en` and `translations.zh` in `lib/i18n.ts`.

## useLanguage

Returns the current language and a setter:

```typescript
import { useLanguage } from '@/components/ThemeProvider';

const { language, setLanguage } = useLanguage();
// language: 'en' | 'zh'
// setLanguage: (lang: 'en' | 'zh') => void
```

## useSearchHistory / useDownloadHistory

Local-storage-backed history hooks:

```typescript
const { history, addSearch, removeSearch, clearSearchHistory } = useSearchHistory();
const { history, addDownload, removeDownload, clearDownloadHistory } = useDownloadHistory();
```

### Implementation Details

- Keys: `thunder-subtitle-search-history` and `thunder-subtitle-download-history`
- Max items: 50 per history type
- Lazy initialization: reads from localStorage on first render via `useState(() => ...)`
- Deduplication: `addSearch()` removes older entries with the same name
- SSR-safe: guards `typeof window !== 'undefined'` for all localStorage access

### Pattern

```typescript
export function useSearchHistory() {
  const [history, setHistory] = useState<HistoryItem[]>(() => getStoredArray<HistoryItem>(KEY));

  const addSearch = useCallback((name: string) => {
    setHistory((prev) => {
      const filtered = prev.filter((item) => item.name !== name);
      const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      setStoredArray(KEY, updated); // persist to localStorage
      return updated;
    });
  }, []);

  return { history, isHydrated, addSearch, removeSearch, clearSearchHistory };
}
```

## Creating New Hooks

Follow these conventions:

1. Place hooks in `src/hooks/` for domain hooks, or co-locate with their provider (e.g., `useAuth` in `auth.tsx`)
2. Use `'use client'` directive if the hook uses React state or browser APIs
3. Always type the return value explicitly
4. Guard localStorage access with `typeof window !== 'undefined'`
5. Use `useCallback` for functions returned from hooks to prevent unnecessary re-renders

## Anti-Patterns

- Using React Query or SWR for server state (we use `FastApiClient` directly)
- Creating hooks that wrap `FastApiClient` in complex state machines — call the client methods directly in event handlers or `useEffect`
- Using URL state libraries like `nuqs` (not a dependency — use `useState` and `useRouter` instead)