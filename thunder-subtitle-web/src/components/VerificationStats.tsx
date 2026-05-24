"use client";

import type { ReviewItem } from "@/lib/types";

interface VerificationStatsProps {
  selectedItem: ReviewItem;
  t: (key: string) => string;
}

export function VerificationStats({ selectedItem, t }: VerificationStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="ghost-border rounded-lg bg-surface-container p-3 text-center md:p-4">
        <p className="text-[10px] font-bold uppercase text-on-surface-variant">{t("quality_score")}</p>
        <p className={`mt-1 text-2xl font-bold ${selectedItem.score >= 80 ? "text-green-400" : selectedItem.score >= 60 ? "text-tertiary" : "text-error"}`}>
          {selectedItem.score || "\u2014"}
        </p>
      </div>
      <div className="ghost-border rounded-lg bg-surface-container p-3 text-center md:p-4">
        <p className="text-[10px] font-bold uppercase text-on-surface-variant">{t("match")}</p>
        <p className="mt-1 text-2xl font-bold text-primary">
          {Math.round(selectedItem.chinese_ratio * 100)}%
        </p>
      </div>
      <div className="ghost-border rounded-lg bg-surface-container p-3 text-center md:p-4">
        <p className="text-[10px] font-bold uppercase text-on-surface-variant">{t("format_encoding_short")}</p>
        <p className="mt-1 text-xs font-bold text-on-surface truncate" title={selectedItem.encoding || t("unknown_encoding")}>
          {selectedItem.encoding || t("unknown_encoding")}
        </p>
      </div>
    </div>
  );
}
