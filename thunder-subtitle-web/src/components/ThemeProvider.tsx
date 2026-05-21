"use client";

import { createContext, useContext, useCallback, useSyncExternalStore, type ReactNode } from "react";

type Language = "en" | "zh";

// localStorage 缓存 key
const STORAGE_KEY = "language";

// 内存快照，避免直接读写 localStorage 触发渲染
let snapshot: Language = "zh";

const listeners = new Set<() => void>();

function getSnapshot(): Language {
  return snapshot;
}

function getServerSnapshot(): Language {
  return "zh";
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifyListeners() {
  listeners.forEach((cb) => cb());
}

// 同步 localStorage → 内存快照（仅客户端调用）
function syncFromStorage(): Language {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached === "en" || cached === "zh") {
      snapshot = cached;
      return cached;
    }
  } catch {
    // localStorage 不可用时忽略
  }
  snapshot = "zh";
  return "zh";
}

// 写入 localStorage + 内存快照
function persistLanguage(lang: Language) {
  snapshot = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // localStorage 不可用时忽略
  }
  notifyListeners();
}

// 模块加载时在客户端同步一次
if (typeof window !== "undefined") {
  syncFromStorage();
}

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "zh",
  setLanguage: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  // useSyncExternalStore 处理 SSR 与客户端 hydration 一致性问题：
  // 服务端始终返回 "zh"，客户端 hydration 时自动切换到缓存值
  const language = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setLanguage = useCallback((lang: Language) => {
    persistLanguage(lang);
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}