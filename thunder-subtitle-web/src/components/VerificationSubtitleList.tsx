"use client";

import { useCallback, useState } from "react";
import { ChevronDown, ChevronRight, Star, AlertTriangle } from "lucide-react";
import type { ReviewItem } from "@/lib/types";
import { getReviewStatusColor } from "@/components/StatusBadge";

interface SubtitleListProps {
  paginatedItems: ReviewItem[];
  selectedItem: ReviewItem | null;
  onSelectItem: (item: ReviewItem) => void;
  isPinned: (item: ReviewItem) => boolean;
  t: (key: string) => string;
}

const AI_FLAG_LABELS: Record<string, string> = {
  machine_translation: "AI",
  repeated_long_lines: "重复",
  uniform_timing: "均匀",
  possibly_truncated: "截断",
};

export function VerificationSubtitleList({
  paginatedItems,
  selectedItem,
  onSelectItem,
  isPinned,
  t,
}: SubtitleListProps) {
  const [expandedDeductions, setExpandedDeductions] = useState<Set<string>>(new Set());

  const toggleDeductions = useCallback((item: ReviewItem) => {
    const key = `${item.file_path}::${item.file_name}`;
    setExpandedDeductions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const isDeductionsExpanded = (item: ReviewItem) =>
    expandedDeductions.has(`${item.file_path}::${item.file_name}`);

  return (
    <>
      {paginatedItems.map((item, i) => {
        const deductionKey = `${item.file_path}::${item.file_name}`;
        const isExpanded = expandedDeductions.has(deductionKey);
        const hasDeductions = item.deductions && item.deductions.length > 0;
        const hasAiFlags = item.ai_flags && item.ai_flags.length > 0;
        const showChecks = item.checks && item.checks.length > 0;

        return (
          <div key={`${i}-${item.file_path}-${item.file_name}`}>
            <button
              type="button"
              onClick={() => onSelectItem(item)}
              className={`w-full rounded-lg border p-3 text-left transition-all hover:border-primary/50 md:p-4 ${
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
                    {item.preferred && <Star size={12} className="flex-shrink-0 text-primary" fill="currentColor" />}
                    <span className="truncate">{item.file_name}</span>
                  </p>
                  <p className="mt-1 truncate text-[10px] text-on-surface-variant">{item.file_path}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1">
                    {/* AI 嫌疑标签 */}
                    {hasAiFlags && (
                      <span className="flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-500">
                        <AlertTriangle size={8} />
                        {item.ai_flags.length}
                      </span>
                    )}
                    {/* 评分 badge — 可点击展开扣分明细 */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDeductions(item);
                      }}
                      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-bold transition-colors hover:opacity-80 ${
                        item.score >= 80 ? "bg-green-500/15 text-green-400"
                        : item.score >= 50 ? "bg-tertiary/15 text-tertiary"
                        : "bg-error/15 text-error"
                      }`}
                    >
                      {item.score || "\u2014"}
                      {(hasDeductions || showChecks) && (
                        isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />
                      )}
                    </button>
                  </div>
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

              {/* AI 嫌疑标记行 */}
              {hasAiFlags && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {item.ai_flags.map((flag) => (
                    <span
                      key={flag}
                      className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-500/80"
                    >
                      {AI_FLAG_LABELS[flag] || flag}
                    </span>
                  ))}
                </div>
              )}
            </button>

            {/* 扣分明细展开区 */}
            {isExpanded && (hasDeductions || showChecks) && (
              <div className="mx-2 mb-2 overflow-hidden rounded-lg border border-outline-variant/20 bg-surface-container-high/50 text-[10px] transition-all">
                {hasDeductions && (
                  <div className="px-3 py-2">
                    <p className="mb-1 font-semibold text-error/80">扣分项</p>
                    <ul className="space-y-0.5">
                      {item.deductions.map((d, idx) => (
                        <li key={idx} className="text-error/60">{"\u2022"} {d}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {showChecks && (
                  <div className="border-t border-outline-variant/10 px-3 py-2">
                    <p className="mb-1 font-semibold text-green-500/80">通过项</p>
                    <ul className="space-y-0.5">
                      {item.checks.map((c, idx) => (
                        <li key={idx} className="text-green-500/60">{"\u2022"} {c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
