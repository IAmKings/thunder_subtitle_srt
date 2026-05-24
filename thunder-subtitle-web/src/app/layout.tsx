import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SearchStateProvider } from "@/lib/search-state";
import { ScannerStateProvider } from "@/lib/scanner-state";
import { VerificationStateProvider } from "@/lib/verification-state";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Thunder Subtitle - 字幕管理器",
  description: "搜索、下载、扫描和审查字幕",
  manifest: "/manifest.json",
  other: {
    "theme-color": "#0f1417",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "Thunder Subtitle",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="flex h-screen overflow-hidden bg-surface text-on-surface">
        <Script
          id="service-worker-registration"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ("serviceWorker" in navigator) {
                window.addEventListener("load", function () {
                  navigator.serviceWorker.register("/sw.js").then(
                    function () { /* SW registered */ },
                    function (err) { console.warn("SW registration failed:", err); }
                  );
                });
              }
            `,
          }}
        />
        <ThemeProvider>
          <AuthProvider>
            <SearchStateProvider>
              <ScannerStateProvider>
                <VerificationStateProvider>
                  <AppShell>{children}</AppShell>
                </VerificationStateProvider>
              </ScannerStateProvider>
            </SearchStateProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}