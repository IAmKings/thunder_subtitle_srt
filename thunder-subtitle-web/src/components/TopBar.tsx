"use client";

import { useCallback } from "react";
import { Languages, Bell, Wifi } from "lucide-react";
import { useLanguage } from "@/components/ThemeProvider";
import { useTranslations } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

export function TopBar() {
  const { language, setLanguage } = useLanguage();
  const t = useTranslations();
  const { user } = useAuth();

  const handleToggleLanguage = useCallback(() => {
    setLanguage(language === "en" ? "zh" : "en");
  }, [language, setLanguage]);

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-outline-variant/30 bg-surface px-4 md:px-8">
      <div className="flex items-center gap-4">
        <span className="text-2xl font-black text-on-surface">{t("title")}</span>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleToggleLanguage}
            className="flex items-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container px-3 py-1 text-xs font-bold text-on-surface-variant transition-all hover:border-primary active:scale-95"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <Languages size={14} />
            {language === "en" ? "EN" : "中文"}
          </button>
          <button
            type="button"
            title="即将推出"
            className="text-on-surface-variant transition-all duration-200 hover:text-primary"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <Bell size={20} />
          </button>
          <button
            type="button"
            title="即将推出"
            className="text-on-surface-variant transition-all duration-200 hover:text-primary"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <Wifi size={20} />
          </button>
        </div>
        <div className="h-8 w-8 overflow-hidden rounded-full border border-outline-variant bg-surface-container-high">
          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-on-surface-variant">
            {user?.username?.charAt(0).toUpperCase() ?? "A"}
          </div>
        </div>
      </div>
    </header>
  );
}