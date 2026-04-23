'use client';

import { useState, useCallback, useEffect } from 'react';
import type { HistoryItem, DownloadHistoryItem, Subtitle } from '@/lib/types';

const SEARCH_HISTORY_KEY = 'thunder-subtitle-search-history';
const DOWNLOAD_HISTORY_KEY = 'thunder-subtitle-download-history';
const MAX_HISTORY_ITEMS = 50;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getStoredArray<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function setStoredArray<T>(key: string, items: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Storage might be full, ignore
  }
}

export function useSearchHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Lazy initialization after mount
  useEffect(() => {
    setHistory(getStoredArray<HistoryItem>(SEARCH_HISTORY_KEY));
    setIsHydrated(true);
  }, []);

  const addSearch = useCallback((name: string) => {
    if (!isHydrated) return;
    const newItem: HistoryItem = {
      id: generateId(),
      name,
      timestamp: Date.now(),
    };

    setHistory((prev) => {
      // Remove duplicate names and limit size
      const filtered = prev.filter((item) => item.name !== name);
      const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      setStoredArray(SEARCH_HISTORY_KEY, updated);
      return updated;
    });
  }, [isHydrated]);

  const removeSearch = useCallback((id: string) => {
    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      setStoredArray(SEARCH_HISTORY_KEY, updated);
      return updated;
    });
  }, []);

  const clearSearchHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  }, []);

  return {
    history,
    isHydrated,
    addSearch,
    removeSearch,
    clearSearchHistory,
  };
}

export function useDownloadHistory() {
  const [history, setHistory] = useState<DownloadHistoryItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Lazy initialization after mount
  useEffect(() => {
    setHistory(getStoredArray<DownloadHistoryItem>(DOWNLOAD_HISTORY_KEY));
    setIsHydrated(true);
  }, []);

  const addDownload = useCallback((subtitle: Subtitle) => {
    if (!isHydrated) return;
    const newItem: DownloadHistoryItem = {
      id: generateId(),
      name: subtitle.name,
      timestamp: Date.now(),
      subtitle,
    };

    setHistory((prev) => {
      const updated = [newItem, ...prev].slice(0, MAX_HISTORY_ITEMS);
      setStoredArray(DOWNLOAD_HISTORY_KEY, updated);
      return updated;
    });
  }, [isHydrated]);

  const removeDownload = useCallback((id: string) => {
    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      setStoredArray(DOWNLOAD_HISTORY_KEY, updated);
      return updated;
    });
  }, []);

  const clearDownloadHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(DOWNLOAD_HISTORY_KEY);
  }, []);

  return {
    history,
    isHydrated,
    addDownload,
    removeDownload,
    clearDownloadHistory,
  };
}
