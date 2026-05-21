"use client";

import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { fastApiClient, SubtitleApiClient } from "@/lib/api";
import type { Subtitle } from "@/lib/types";

// ---- Types ----

export type FilterMode = "all" | "chinese_only" | "chinese_first";
export type SortMode = "relevance" | "newest" | "score";

export interface HistoryItem {
  id: string;
  name: string;
  timestamp: number;
}

const HISTORY_KEY = "thunder-subtitle-search-history";
const MAX_HISTORY = 10;

// ---- Helpers ----

function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? (JSON.parse(stored) as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: HistoryItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch {
    // ignore
  }
}

function addToHistory(name: string): void {
  const history = loadHistory();
  const filtered = history.filter(
    (h) => h.name.toLowerCase() !== name.toLowerCase()
  );
  const newItem: HistoryItem = {
    id: Date.now().toString(),
    name,
    timestamp: Date.now(),
  };
  saveHistory([newItem, ...filtered]);
}

function removeFromHistory(id: string): void {
  saveHistory(loadHistory().filter((h) => h.id !== id));
}

// ---- Context ----

interface SearchState {
  query: string;
  allSubtitles: Subtitle[];
  isLoading: boolean;
  hasSearched: boolean;
  error: string | null;
  filterMode: FilterMode;
  sortMode: SortMode;
  maxDuration: string;
  history: HistoryItem[];
  currentPage: number;
}

interface SearchActions {
  setQuery: (q: string) => void;
  setFilterMode: (mode: FilterMode) => void;
  setSortMode: (mode: SortMode) => void;
  setMaxDuration: (d: string) => void;
  setCurrentPage: (p: number) => void;
  handleSearch: (searchQuery?: string) => Promise<void>;
  handleHistoryClick: (name: string) => void;
  handleClearHistory: () => void;
  handleRemoveHistoryItem: (id: string) => void;
}

const SearchStateContext = createContext<SearchState | null>(null);
const SearchActionsContext = createContext<SearchActions | null>(null);

export function SearchStateProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const [allSubtitles, setAllSubtitles] = useState<Subtitle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [maxDuration, setMaxDuration] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  // 挂载后同步 localStorage 历史记录
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const handleSearch = useCallback(
    async (searchQuery?: string) => {
      const trimmed = (searchQuery ?? query).trim();
      if (!trimmed) return;

      setQuery(trimmed);
      setIsLoading(true);
      setError(null);
      setHasSearched(true);
      setAllSubtitles([]);
      setCurrentPage(1);

      try {
        const result = await fastApiClient.searchSubtitles(trimmed, {
          chineseOnly: false,
        });
        setAllSubtitles(result.subtitles);
        addToHistory(trimmed);
        setHistory(loadHistory());
      } catch {
        try {
          const legacyClient = new SubtitleApiClient();
          const result = await legacyClient.searchSubtitles(trimmed);
          setAllSubtitles(result.subtitles);
          addToHistory(trimmed);
          setHistory(loadHistory());
        } catch (legacyErr) {
          setError(
            legacyErr instanceof Error
              ? legacyErr.message
              : "Search failed. Please try again."
          );
          setAllSubtitles([]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [query]
  );

  const handleHistoryClick = useCallback(
    (name: string) => {
      setQuery(name);
      handleSearch(name);
    },
    [handleSearch]
  );

  const handleClearHistory = useCallback(() => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  }, []);

  const handleRemoveHistoryItem = useCallback((id: string) => {
    removeFromHistory(id);
    setHistory(loadHistory());
  }, []);

  const state = useMemo<SearchState>(
    () => ({
      query,
      allSubtitles,
      isLoading,
      hasSearched,
      error,
      filterMode,
      sortMode,
      maxDuration,
      history,
      currentPage,
    }),
    [query, allSubtitles, isLoading, hasSearched, error, filterMode, sortMode, maxDuration, history, currentPage]
  );

  const actions = useMemo<SearchActions>(
    () => ({
      setQuery,
      setFilterMode,
      setSortMode,
      setMaxDuration,
      setCurrentPage,
      handleSearch,
      handleHistoryClick,
      handleClearHistory,
      handleRemoveHistoryItem,
    }),
    [handleSearch, handleHistoryClick, handleClearHistory, handleRemoveHistoryItem]
  );

  return (
    <SearchStateContext.Provider value={state}>
      <SearchActionsContext.Provider value={actions}>
        {children}
      </SearchActionsContext.Provider>
    </SearchStateContext.Provider>
  );
}

export function useSearchState() {
  const ctx = useContext(SearchStateContext);
  if (!ctx) throw new Error("useSearchState must be used within SearchStateProvider");
  return ctx;
}

export function useSearchActions() {
  const ctx = useContext(SearchActionsContext);
  if (!ctx) throw new Error("useSearchActions must be used within SearchStateProvider");
  return ctx;
}
