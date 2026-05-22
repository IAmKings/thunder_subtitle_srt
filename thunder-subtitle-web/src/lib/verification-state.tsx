"use client";

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import type { ReviewItem } from "@/lib/types";

interface VerificationState {
  items: ReviewItem[];
  isLoading: boolean;
  error: string | null;
  selectedMovie: string | null;
}

interface VerificationActions {
  setItems: (items: ReviewItem[] | ((prev: ReviewItem[]) => ReviewItem[])) => void;
  setIsLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  setSelectedMovie: (path: string | null) => void;
}

const VerificationStateContext = createContext<VerificationState | null>(null);
const VerificationActionsContext = createContext<VerificationActions | null>(null);

export function VerificationStateProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<string | null>(null);

  const state = useMemo<VerificationState>(
    () => ({ items, isLoading, error, selectedMovie }),
    [items, isLoading, error, selectedMovie]
  );

  const actions = useMemo<VerificationActions>(
    () => ({ setItems, setIsLoading, setError, setSelectedMovie }),
    []
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
