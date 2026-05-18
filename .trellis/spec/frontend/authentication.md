# Authentication — JWT with FastAPI Backend

This document covers authentication patterns using JWT tokens issued by the FastAPI backend.

## Architecture

```
┌──────────┐     POST /api/auth/login      ┌──────────┐
│  Login    │ ──────────────────────────────► │  FastAPI  │
│  Page     │ ◄────────────────────────────── │  Backend  │
└──────────┘     { access_token, expires_in } └──────────┘
       │                                            ▲
       │ token stored in localStorage               │
       │ (thunder-subtitle-token)                   │
       ▼                                            │
┌──────────┐     GET /api/* with Authorization     │
│  Auth     │ ──────────────────────────────────────►│
│  Provider │     Bearer <token>                     │
└──────────┘
```

## AuthProvider

The `AuthProvider` wraps the entire app in `layout.tsx`:

```typescript
// lib/auth.tsx
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: verify saved token
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);
    if (savedToken && savedUser) {
      const isValid = await client.verifyToken(savedToken);
      // If valid → setToken + setUser, else clear
    }
    setIsLoading(false);
  }, []);

  // Auto-redirect: unauthenticated → /login, authenticated on /login → /search
  useEffect(() => {
    if (!user && !isLoginPage) router.push('/login');
    else if (user && isLoginPage) router.push('/search');
  }, [user, isLoading, pathname, router]);
}
```

## Context Value

The `useAuth()` hook exposes:

```typescript
interface AuthContextValue {
  user: AuthUser | null;        // { username: string }
  token: string | null;         // JWT string
  isAuthenticated: boolean;     // derived from !!user
  isLoading: boolean;           // true during token verification
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}
```

## Token Storage

Tokens are stored in localStorage with these keys:

```typescript
const TOKEN_KEY = 'thunder-subtitle-token';
const USER_KEY = 'thunder-subtitle-user';
```

On login, both the JWT token and user JSON are saved. On logout, both are cleared.

The `api.ts` module has a companion `clearAuthToken()` function that clears the token key used by `FastApiClient`.

## Login Flow

```typescript
const login = async (username: string, password: string) => {
  const response: LoginResponse = await client.login(username, password);
  const authUser: AuthUser = { username };
  setToken(response.access_token);
  setUser(authUser);
  localStorage.setItem(TOKEN_KEY, response.access_token);
  localStorage.setItem(USER_KEY, JSON.stringify(authUser));
  router.push('/search');
};
```

The `FastApiClient.login()` method calls `POST /api/auth/login` with `{ username, password }` and returns `{ access_token, token_type, expires_in }`.

## Page-Level Auth Guard

Use the `withAuth()` HOC for page components:

```typescript
import { withAuth } from '@/lib/auth';

function SearchPage() {
  // Only rendered when authenticated
  return <div>...</div>;
}

export default withAuth(SearchPage);
```

The HOC returns null (redirect handled by `AuthProvider`) when `isLoading` or `!isAuthenticated`:

```typescript
export function withAuth<T extends object>(Component: React.ComponentType<T>) {
  return function AuthGuardComponent(props: T) {
    const { isAuthenticated, isLoading } = useAuth();
    if (isLoading) return <LoadingSpinner />;
    if (!isAuthenticated) return null; // Redirects to /login via AuthProvider
    return <Component {...props} />;
  };
}
```

## Auth Header Injection

`FastApiClient` auto-injects the `Authorization: Bearer <token>` header on every request:

```typescript
// lib/api.ts — fastApiFetch helper
async function fastApiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken(); // reads from localStorage
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...existingHeaders,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  // ...
}
```

## Best Practices

1. **Always check `isLoading`** before rendering protected content
2. **Use `withAuth()`** for page-level guards, not manual `useEffect` redirects
3. **Use `useAuth()`** for accessing user info and logout in components
4. **Call `clearAuthToken()`** from `api.ts` when manually clearing state
5. **Never store passwords in localStorage** — only the JWT and username
6. **Handle token expiry** — `verifyToken()` is called on mount; invalid tokens are auto-cleared

## Anti-Patterns

- Using `better-auth`, NextAuth, or cookie-based session libraries (we use JWT + localStorage)
- Checking authentication in every page component manually (use `AuthProvider` + `withAuth()`)
- Storing sensitive data beyond username + token in localStorage