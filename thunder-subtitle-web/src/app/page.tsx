import type { Metadata } from "next";
import { ThunderSubtitleApp } from "@/components/ThunderSubtitleApp";
import "./globals.css";

export const metadata: Metadata = {
  title: "Thunder Subtitle - 字幕搜索下载",
  description: "搜索和下载中文字幕",
};

export default function Home() {
  return (
    <html lang="zh-CN">
      <body className="min-h-full bg-zinc-50">
        <ThunderSubtitleApp />
      </body>
    </html>
  );
}
