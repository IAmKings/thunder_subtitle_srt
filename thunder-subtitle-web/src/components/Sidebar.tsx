"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search as SearchIcon,
  Monitor as ScannerIcon,
  CheckSquare as VerificationIcon,
  Settings as SettingsIcon,
  LogOut,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

const navItems = [
  { id: "search", path: "/search", icon: SearchIcon },
  { id: "scanner", path: "/scanner", icon: ScannerIcon },
  { id: "verification", path: "/verification", icon: VerificationIcon },
  { id: "settings", path: "/settings", icon: SettingsIcon },
] as const;

export function Sidebar() {
  const t = useTranslations();
  const pathname = usePathname();
  const { logout, user } = useAuth();

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-outline-variant/30 bg-surface-container-low px-4 py-6">
      <div className="mb-8 px-2">
        <h1 className="text-2xl font-bold text-primary">Thunder Subtitle</h1>
        <p className="text-sm text-on-surface-variant">{t("subtitle")}</p>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path || pathname.startsWith(item.path + "/");
          return (
            <Link
              key={item.id}
              href={item.path}
              className={`flex w-full items-center gap-4 rounded-lg p-3 transition-all duration-100 active:scale-95 ${
                isActive
                  ? "bg-surface-container-high font-bold text-primary border-r-2 border-primary"
                  : "text-on-surface-variant font-medium hover:bg-surface-container-high"
              }`}
            >
              <Icon className={isActive ? "text-primary" : ""} size={20} />
              <span className="text-sm">{t(item.id)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-outline-variant/30 pt-4">
        {user && (
          <div className="mb-3 px-3 text-xs text-on-surface-variant">
            {t("logged_in_as")}: <span className="font-bold text-on-surface">{user.username}</span>
          </div>
        )}
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-4 rounded-lg p-3 text-on-surface-variant font-medium transition-all duration-100 hover:bg-surface-container-high active:scale-95"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <LogOut size={20} />
          <span className="text-sm">{t("logout")}</span>
        </button>
      </div>
    </aside>
  );
}