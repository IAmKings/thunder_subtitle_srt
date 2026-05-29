"use client";

import { createContext, useContext, useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import type { ReviewItem } from "@/lib/types";

const PINNED_KEY = "thunder-subtitle-pinned-items";

interface VerificationState {
  items: ReviewItem[];
  isLoading: boolean;
  error: string | null;
  selectedMovie: string | null;
  pinnedItems: string[];
}

interface VerificationActions {
  setItems: (items: ReviewItem[] | ((prev: ReviewItem[]) => ReviewItem[])) => void;
  setIsLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  setSelectedMovie: (path: string | null) => void;
  setPinnedItems: (keys: string[] | ((prev: string[]) => string[])) => void;
  isPinned: (item: ReviewItem) => boolean;
  togglePin: (item: ReviewItem) => void;
}

const VerificationStateContext = createContext<VerificationState | null>(null);
const VerificationActionsContext = createContext<VerificationActions | null>(null);

export function VerificationStateProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<string | null>(null);
  const [pinnedItems, setPinnedItems] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(PINNED_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
    } catch { return []; }
  });

  // Sync pinnedItems to localStorage on every change
  useEffect(() => {
    try {
      if (pinnedItems.length > 0) {
        localStorage.setItem(PINNED_KEY, JSON.stringify(pinnedItems));
      } else {
        localStorage.removeItem(PINNED_KEY);
      }
    } catch { /* ignore */ }
  }, [pinnedItems]);

  const state = useMemo<VerificationState>(
    () => ({ items, isLoading, error, selectedMovie, pinnedItems }),
    [items, isLoading, error, selectedMovie, pinnedItems]
  );

  const isPinned = useCallback((item: ReviewItem) => {
    const key = `${item.file_path}/${item.file_name}`;
    return pinnedItems.includes(key);
  }, [pinnedItems]);

  const togglePin = useCallback((item: ReviewItem) => {
    const key = `${item.file_path}/${item.file_name}`;
    setPinnedItems((prev) => {
      const set = new Set(prev);
      if (set.has(key)) set.delete(key); else set.add(key);
      return [...set];
    });
  }, [setPinnedItems]);

  const actions = useMemo<VerificationActions>(
    () => ({ setItems, setIsLoading, setError, setSelectedMovie, setPinnedItems, isPinned, togglePin }),
    // useState setters are stable refs
    [isPinned, togglePin]
  );

  return (
    <VerificationStateContext.Provider value={state}>
      <VerificationActionsContext.Provider value={actions}>
        {children}
      </VerificationActionsContext.Provider>
    </VerificationStateContext.Provider>
  );
}

export function useVerificationState() {
  const ctx = useContext(VerificationStateContext);
  if (!ctx) throw new Error("useVerificationState must be used within VerificationStateProvider");
  return ctx;
}

export function useVerificationActions() {
  const ctx = useContext(VerificationActionsContext);
  if (!ctx) throw new Error("useVerificationActions must be used within VerificationStateProvider");
  return ctx;
}
