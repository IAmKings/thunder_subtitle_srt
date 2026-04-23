import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Thunder Subtitle - 字幕搜索下载",
  description: "搜索和下载中文字幕",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
