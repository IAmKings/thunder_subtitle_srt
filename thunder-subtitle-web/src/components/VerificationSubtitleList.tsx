"use client";

import { Star } from "lucide-react";
import type { ReviewItem, ReviewState } from "@/lib/types";

interface SubtitleListProps {
  paginatedItems: ReviewItem[];
  selectedItem: ReviewItem | null;
  onSelectItem: (item: ReviewItem) => void;
  isPinned: (item: ReviewItem) => boolean;
  t: (key: string) => string;
}

function getReviewStatusColor(status: ReviewState) {
  switch (status) {
    case "ok":
      return "bg-green-500/15 text-green-400";
    case "fail":
      return "bg-error/15 text-error";
    case "not_reviewed":
    default:
      return "bg-on-surface-variant/15 text-on-surface-variant";
  }
}

export function VerificationSubtitleList({
  paginatedItems,
  selectedItem,
  onSelectItem,
  isPinned,
  t,
}: SubtitleListProps) {
  return (
    <>
      {paginatedItems.map((item, i) => (
        <button
          key={`${i}-${item.file_path}-${item.file_name}`}
          type="button"
          onClick={() => onSelectItem(item)}
          className={`rounded-lg border p-3 text-left transition-all hover:border-primary/50 md:p-4 ${
            selectedItem?.file_name === item.file_name && selectedItem?.file_path === item.file_path
              ? "border-primary bg-primary/5 border-l-4 shadow-sm"
              : "border-outline-variant/30 bg-surface-container"
          }`}
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-xs md:text-sm font-bold">
                {isPinned(item) && <Star size={12} className="flex-shrink-0 text-amber-400" fill="currentColor" />}
                <span className="truncate">{item.file_name}</span>
              </p>
              <p className="mt-1 truncate text-[10px] text-on-surface-variant">{item.file_path}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                item.score >= 80 ? "bg-green-500/15 text-green-400"
                : item.score >= 60 ? "bg-tertiary/15 text-tertiary"
                : "bg-error/15 text-error"
              }`}>
                {item.score || "\u2014"}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${getReviewStatusColor(item.review_status)}`}>
                {item.review_status}
              </span>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-on-surface-variant">
            <div className="flex items-center gap-4">
              <span>{t("match")}: {Math.round(item.chinese_ratio * 100)}%</span>
              {item.encoding && <span>{item.encoding}</span>}
            </div>
            <span className="tabular-nums text-on-surface-variant/60">
              {item.size_bytes >= 1048576
                ? `${(item.size_bytes / 1048576).toFixed(1)} MB`
                : item.size_bytes >= 1024
                ? `${(item.size_bytes / 1024).toFixed(0)} KB`
                : item.size_bytes > 0
                ? `${item.size_bytes} B`
                : ""}
            </span>
          </div>
        </button>
      ))}
    </>
  );
}
