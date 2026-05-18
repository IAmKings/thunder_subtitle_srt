"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login, isLoading: authLoading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(username, password);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Login failed. Please try again.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const isFormLoading = isSubmitting || authLoading;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo & Title */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary">Thunder Subtitle</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Sign in to manage your subtitles
          </p>
        </div>

        {/* Login Card */}
        <form
          onSubmit={handleSubmit}
          className="ghost-border rounded-xl bg-surface-container p-8 shadow-lg"
        >
          <div className="space-y-6">
            {/* Username */}
            <div className="space-y-2">
              <label
                htmlFor="username"
                className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                required
                disabled={isFormLoading}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                disabled={isFormLoading}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isFormLoading || !username.trim() || !password.trim()}
              className="w-full rounded-lg bg-primary-container px-4 py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(0,164,220,0.3)] transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {isFormLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </div>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-on-surface-variant/50">
          Default credentials: admin / changeme
        </p>
      </div>
    </div>
  );
}