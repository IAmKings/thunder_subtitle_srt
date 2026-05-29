"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  FastApiClient,
  clearAuthToken,
  type LoginResponse,
} from "@/lib/api";

// ---- Types ----

interface AuthUser {
  username: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

// ---- Constants ----

const TOKEN_KEY = "thunder-subtitle-token";
const USER_KEY = "thunder-subtitle-user";

// ---- Context ----

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  logout: () => {},
});

// ---- Provider ----

const client = new FastApiClient();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Load saved auth state on mount
  useEffect(() => {
    async function verify() {
      if (typeof window === "undefined") {
        return;
      }

      const savedToken = localStorage.getItem(TOKEN_KEY);
      const savedUser = localStorage.getItem(USER_KEY);

      if (savedToken && savedUser) {
        try {
          const isValid = await client.verifyToken(savedToken);
          if (isValid) {
            const parsed = JSON.parse(savedUser) as AuthUser;
            setToken(savedToken);
            setUser(parsed);
          } else {
            // Token expired or invalid
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            clearAuthToken();
          }
        } catch {
          // Network error or invalid token
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          clearAuthToken();
        }
      }

      setIsLoading(false);
    }

    verify();
  }, []);

  // Redirect based on auth state
  useEffect(() => {
    if (isLoading) return;

    const isLoginPage = pathname === "/login";

    if (!user && !isLoginPage) {
      router.push("/login");
    } else if (user && isLoginPage) {
      router.push("/search");
    }
  }, [user, isLoading, pathname, router]);

  const login = useCallback(
    async (username: string, password: string) => {
      const response: LoginResponse = await client.login(username, password);

      const authUser: AuthUser = { username };
      setToken(response.access_token);
      setUser(authUser);
      localStorage.setItem(TOKEN_KEY, response.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(authUser));

      router.push("/search");
    },
    [router]
  );

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    clearAuthToken();
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---- Hook ----

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// ---- Auth Guard for Pages ----

export function withAuth<T extends object>(
  Component: React.ComponentType<T>
): React.ComponentType<T> {
  return function AuthGuardComponent(props: T) {
    const { isAuthenticated, isLoading } = useAuth();
    const [showFallback, setShowFallback] = useState(false);

    useEffect(() => {
      if (!isAuthenticated && !isLoading) {
        const timer = setTimeout(() => setShowFallback(true), 3000);
        return () => clearTimeout(timer);
      }
      setShowFallback(false);
    }, [isAuthenticated, isLoading]);

    if (isLoading) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-surface">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-on-surface-variant">Loading...</p>
          </div>
        </div>
      );
    }

    if (!isAuthenticated) {
      if (showFallback) {
        return (
          <div className="flex h-screen flex-col items-center justify-center gap-4 bg-surface">
            <p className="text-sm text-on-surface-variant">登录已过期，请重新登录</p>
            <a
              href="/login"
              className="rounded-lg bg-primary-container px-6 py-2 text-sm font-bold text-on-primary-container transition-all hover:brightness-110"
            >
              前往登录
            </a>
          </div>
        );
      }
      return (
        <div className="flex h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ); // Will be redirected by AuthProvider
    }

    return <Component {...props} />;
  };
}