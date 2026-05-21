"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

type Language = "en" | "zh";

// 从 localStorage 读取缓存语言，仅客户端调用
function readCachedLanguage(): Language {
  try {
    const cached = localStorage.getItem("language");
    if (cached === "en" || cached === "zh") return cached;
  } catch {
    // localStorage 不可用时忽略
  }
  return "zh";
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
  // 初始值固定为 "zh"，匹配 SSR 服务端输出，避免 hydration 不一致
  const [language, setLanguageState] = useState<Language>("zh");

  // 客户端挂载后同步 localStorage 缓存值
  useEffect(() => {
    const cached = readCachedLanguage();
    if (cached !== "zh") {
      setLanguageState(cached);
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("language", lang);
    } catch {
      // localStorage 不可用时忽略
    }
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