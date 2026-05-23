"use client";

import { Loader2 } from "lucide-react";
import type { ReviewItem } from "@/lib/types";

interface SubtitlePreviewProps {
  selectedItem: ReviewItem | null;
  previewContent: string | null;
  previewEncoding: string;
  previewLoading: boolean;
  previewPart: number;
  setPreviewPart: (part: number) => void;
  PREVIEW_CHUNK: number;
  t: (key: string) => string;
}

export function SubtitlePreview({
  selectedItem,
  previewContent,
  previewEncoding,
  previewLoading,
  previewPart,
  setPreviewPart,
  PREVIEW_CHUNK,
  t,
}: SubtitlePreviewProps) {
  // Not selected — placeholder
  if (!selectedItem) {
    return (
      <div className="flex flex-1 items-center justify-center font-mono">
        <p className="text-on-surface-variant">
          {t("subtitle_preview_here")}
        </p>
      </div>
    );
  }

  // Loading
  if (previewLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  // Loaded content — render preview with Part navigation
  if (previewContent !== null) {
    const allLines = previewContent.split("\n");
    const total = allLines.length;
    let start = 0;
    if (previewPart === 1) start = Math.floor(total * 0.2);
    else if (previewPart === 2) start = Math.floor(total * 0.4);
    else if (previewPart === 3) start = Math.floor(total * 0.6);
    else if (previewPart === 4) start = Math.max(0, total - PREVIEW_CHUNK);
    const chunkLines = allLines.slice(start, start + PREVIEW_CHUNK);
    const currentCount = chunkLines.length;

    return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-wrap gap-1 pb-2">
          {[0, 1, 2, 3, 4].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPreviewPart(p)}
              className={`rounded px-2 py-0.5 text-[10px] font-bold transition-all ${
                previewPart === p
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-outline-variant"
              }`}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              Part {p + 1}
            </button>
          ))}
        </div>
        <pre
          className="min-h-0 flex-1 overflow-y-auto rounded bg-black/20 p-3 font-mono text-xs text-on-surface leading-relaxed"
          style={{ maxHeight: "30vh" }}
        >
          {chunkLines.join("\n") || " "}
        </pre>
        <p className="mt-2 text-right text-[10px] text-on-surface-variant">
          {start + 1}-{start + currentCount} / {total}
        </p>
      </div>
    );
  }

  // Content not available — show metadata fallback
  return (
    <div className="flex flex-1 items-center justify-center font-mono">
      <div className="space-y-2 text-sm">
        <p className="text-on-surface-variant">
          {t("format_encoding_short")} {previewEncoding || "UTF-8"}
        </p>
        {selectedItem.chinese_ratio > 0 && (
          <p className="text-primary">
            {t("chinese_content_ratio")} {Math.round(selectedItem.chinese_ratio * 100)}%
          </p>
        )}
        <p className="text-on-surface-variant">
          {t("quality_score")} {selectedItem.quality}
        </p>
      </div>
    </div>
  );
}
