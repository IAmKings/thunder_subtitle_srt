"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Search as SearchIcon,
  Monitor as ScannerIcon,
  CheckSquare as VerificationIcon,
  Settings as SettingsIcon,
} from "lucide-react";
import { version } from "../../package.json";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { useTranslations } from "@/lib/i18n";

const mobileNavItems = [
  { id: "nav_search", path: "/search", icon: SearchIcon },
  { id: "nav_scanner", path: "/scanner", icon: ScannerIcon },
  { id: "nav_verification", path: "/verification", icon: VerificationIcon },
  { id: "nav_settings", path: "/settings", icon: SettingsIcon },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      <div className="ml-0 flex min-h-screen flex-1 flex-col overflow-y-auto pb-16 md:ml-64 md:pb-0">
        <TopBar />
        <main className="flex-1 p-4 md:p-8">{children}</main>
        <footer className="hidden border-t border-outline-variant/30 px-8 py-6 text-center md:block">
          <p className="text-xs text-on-surface-variant">
            Thunder Subtitle v{version} &bull; &copy; 2024
          </p>
        </footer>
      </div>

      {/* Mobile Bottom TabBar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-outline-variant/30 bg-surface-container-low px-2 py-2 md:hidden"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.path || pathname.startsWith(item.path + "/");
          return (
            <Link
              key={item.id}
              href={item.path}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 transition-all active:scale-95 ${
                isActive ? "text-primary" : "text-on-surface-variant"
              }`}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <Icon size={22} />
              <span className="text-[10px] font-medium">{t(item.id)}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}