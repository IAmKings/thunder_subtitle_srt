# State Management

This document covers state management patterns in Thunder Subtitle Web, which uses React Context + localStorage (no React Query, SWR, or external state libraries).

## State Categories

| Category | Tool | When to Use |
|----------|------|-------------|
| Auth State | `AuthProvider` + `useAuth()` | Authentication state, user info, login/logout |
| Language State | `ThemeProvider` + `useLanguage()` | Current language (en/zh) |
| i18n Lookups | `useTranslations()` | Key → string translation |
| API Data | `FastApiClient` direct calls | Fetching from backend |
| Local Persistence | `localStorage` + custom hooks | Search history, download history, tokens |
| Transient UI State | `useState` | Form inputs, modals, dropdowns |

## Auth State (AuthProvider)

The `AuthProvider` in `lib/auth.tsx` manages auth state globally:

```typescript
// Wrapped in layout.tsx
<AuthProvider>
  <AppShell>{children}</AppShell>
</AuthProvider>
```

State stored:
- `user: AuthUser | null` — also persisted to `localStorage[USER_KEY]`
- `token: string | null` — also persisted to `localStorage[TOKEN_KEY]`
- `isAuthenticated: boolean` — derived as `!!user`
- `isLoading: boolean` — true during initial token verification

The provider also handles auto-redirects:
- Unauthenticated + not on `/login` → redirect to `/login`
- Authenticated + on `/login` → redirect to `/search`

## Language State (ThemeProvider)

The `ThemeProvider` in `components/ThemeProvider.tsx` manages the current language:

```typescript
interface LanguageContextValue {
  language: 'en' | 'zh';
  setLanguage: (lang: 'en' | 'zh') => void;
}
```

This is a simple `useState`-backed context with no persistence (language resets to `'en'` on reload). The `useLanguage()` hook is consumed by `useTranslations()` to resolve the correct dictionary.

## Translation State (useTranslations)

The `useTranslations()` hook in `lib/i18n.ts` provides a `t()` function:

```typescript
const t = useTranslations();
return <h1>{t('search')}</h1>; // "Search" or "搜索"
```

Translation data is a static `Record<Language, Record<string, string>>` dict. Adding keys requires updating both `translations.en` and `translations.zh`.

## API Data Fetching

The project does **not** use React Query or any caching layer. API calls are made directly via `FastApiClient`:

```typescript
// In a page component
useEffect(() => {
  async function fetchData() {
    try {
      const config = await fastApiClient.getConfig();
      setConfig(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }
  fetchData();
}, []);
```

Pattern: `useState` for data + error + loading, `useEffect` for fetching.

## Local Storage Patterns

### Auth Tokens

```typescript
// In lib/api.ts
const TOKEN_KEY = 'thunder-subtitle-token';
const USER_KEY = 'thunder-subtitle-user';

localStorage.setItem(TOKEN_KEY, token);       // On login
localStorage.setItem(USER_KEY, JSON.stringify(user));  // On login
localStorage.removeItem(TOKEN_KEY);            // On logout
localStorage.removeItem(USER_KEY);             // On logout
```

### History Hooks

`useSearchHistory()` and `useDownloadHistory()` in `hooks/useHistory.ts`:

```typescript
const SEARCH_HISTORY_KEY = 'thunder-subtitle-search-history';
const DOWNLOAD_HISTORY_KEY = 'thunder-subtitle-download-history';
```

These hooks use `useState(() => getStoredArray<T>(KEY))` for lazy initialization and synchronize every mutation to localStorage.

### SSR Safety

All localStorage access is guarded:

```typescript
if (typeof window === 'undefined') return; // SSR guard
```

## Real-time State (WebSocket)

`ProgressWebSocket` provides real-time task progress updates:

```typescript
const ws = new ProgressWebSocket();

useEffect(() => {
  ws.connect(taskId, (data) => {
    setProgress(data.progress);
    setStatus(data.status);
  });
  return () => ws.disconnect();
}, [taskId]);
```

The WebSocket client auto-closes previous connections on `connect()` and silently ignores malformed messages.

## useReducer for Complex Forms

When a component has 10+ related `useState` calls, use `useReducer` for better readability and maintainability:

```typescript
// Good: useReducer for config forms (Settings page pattern)
interface SettingsState {
  config: AppConfig | null;
  savePath: string;
  timeout: number;
  // ... 10+ fields
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  success: string | null;
}

type SettingsAction =
  | { type: "SET_CONFIG"; payload: AppConfig }
  | { type: "SET_FIELD"; field: string; value: string | number }
  | { type: "SET_SAVING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_SUCCESS"; payload: string | null };

function settingsReducer(state: SettingsState, action: SettingsAction): SettingsState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    // ...
  }
}
```

**When to use useReducer**:
- 10+ related `useState` in one component → `useReducer`
- Multiple state fields updated together (e.g., form reset, batch update)
- State transitions have complex logic (e.g., auto-reset listPage on filter change)

**When NOT to use useReducer**:
- Simple 2-3 `useState` calls (overkill)
- Unrelated state (e.g., auth + config + UI — keep separate)
- Global cross-component state (use Context instead)

## Context + localStorage Persistence Pattern

When state needs to survive page refreshes, persist it in localStorage alongside React Context:

```typescript
// verification-state.tsx pattern
const STORAGE_KEY = "thunder-subtitle-pinned-items";

export function VerificationStateProvider({ children }: { children: ReactNode }) {
  // Lazy initializer reads from localStorage
  const [pinnedItems, setPinnedItems] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch { return []; }
  });

  // Sync to localStorage on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pinnedItems));
  }, [pinnedItems]);

  // ...
}
```

**Key rules**:
- SSR guard: `typeof window === "undefined"` check in lazy initializer
- Try/catch around `JSON.parse` (corrupted data)
- Key prefix: `thunder-subtitle-`
- Write in `useEffect`, read in `useState` lazy initializer

## Best Practices

1. **Use `AuthProvider` for auth** — don't read localStorage directly in components
2. **Use `useTranslations()` for text** — never hardcode strings
3. **Call `FastApiClient` methods directly** — no caching layer needed
4. **Use `withAuth()` HOC** for page-level auth guards
5. **Prefix localStorage keys** with `thunder-subtitle-`
6. **Guard localStorage access** with `typeof window !== 'undefined'`
7. **useReducer for 10+ related useState** — keeps complex form logic centralized

## Anti-Patterns

- Adding React Query / SWR / Zustand / Redux (not dependencies)
- Storing auth state in cookies (we use localStorage)
- Persisting language preference in localStorage (current behavior resets to `'en'` on reload)
- Creating global state with `useReducer` + Context (keep cross-component state in Context, use `useReducer` only for local component state)
- 20+ independent `useState` calls in one component (use `useReducer` instead)