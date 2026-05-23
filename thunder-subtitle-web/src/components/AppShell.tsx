"use client";

import { usePathname } from "next/navigation";
import { version } from "../../package.json";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      <div className="ml-64 flex min-h-screen flex-1 flex-col overflow-y-auto">
        <TopBar />
        <main className="flex-1 p-8">{children}</main>
        <footer className="border-t border-outline-variant/30 px-8 py-6 text-center">
          <p className="text-xs text-on-surface-variant">
            Thunder Subtitle v{version} &bull; &copy; 2024
          </p>
        </footer>
      </div>
    </>
  );
}