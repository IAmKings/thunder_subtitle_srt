"use client";

import { useCallback, useRef, useState } from "react";
import { Bug, ChevronDown, ChevronRight, Star, AlertTriangle } from "lucide-react";
import type { ReviewItem } from "@/lib/types";
import { getReviewStatusColor } from "@/components/StatusBadge";

interface SubtitleListProps {
  paginatedItems: ReviewItem[];
  selectedItem: ReviewItem | null;
  onSelectItem: (item: ReviewItem) => void;
  isPinned: (item: ReviewItem) => boolean;
  t: (key: string) => string;
  debugEnabled?: boolean;
  onDebugClick?: (item: ReviewItem) => void;
}

const AI_FLAG_LABELS: Record<string, string> = {
  machine_translation: "AI",
  repeated_long_lines: "重复",
  uniform_timing: "均匀",
  possibly_truncated: "截断",
  large_gaps: "缺失",
};

export function VerificationSubtitleList({
  paginatedItems,
  selectedItem,
  onSelectItem,
  isPinned,
  t,
  debugEnabled = false,
  onDebugClick,
}: SubtitleListProps) {
  const [expandedDeductions, setExpandedDeductions] = useState<Set<string>>(new Set());
  const debugLastClickRef = useRef<number>(0);

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

  const handleDebugClick = useCallback((item: ReviewItem) => {
    if (!onDebugClick) return;
    const now = Date.now();
    if (now - debugLastClickRef.current < 500) return; // 防抖 500ms
    debugLastClickRef.current = now;
    onDebugClick(item);
  }, [onDebugClick]);

  return (
    <>
      {paginatedItems.map((item, i) => {
        const deductionKey = `${item.file_path}::${item.file_name}`;
        const isExpanded = expandedDeductions.has(deductionKey);
        const hasDeductions = item.deductions && item.deductions.length > 0;
        const hasAiFlags = item.ai_flags && item.ai_flags.length > 0;
        const showChecks = item.checks && item.checks.length > 0;
        const isSelected = selectedItem?.file_name === item.file_name && selectedItem?.file_path === item.file_path;
        // 同名字幕高亮：file_name 以电影名开头（排除 dump 数字命名）
        const movieName = item.file_path.split("/").pop() || "";
        const isSameName = movieName.length > 0
          && (item.file_name.startsWith(movieName + ".") || item.file_name.startsWith(movieName + "-"));

        let borderClass = "border-outline-variant/30 bg-surface-container";
        if (isSelected) {
          borderClass = "border-primary bg-primary/5 border-l-4 shadow-sm";
        } else if (isSameName) {
          borderClass = "border-l-emerald-400 bg-emerald-400/5";
        }

        return (
          <div key={`${i}-${item.file_path}-${item.file_name}`}>
            <button
              type="button"
              onClick={() => onSelectItem(item)}
              className={`w-full rounded-lg border p-3 text-left transition-all hover:border-primary/50 md:p-4 ${borderClass}`}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-xs md:text-sm font-bold">
                    {isPinned(item) && <Star size={12} className="flex-shrink-0 text-amber-400" fill="currentColor" />}
                    {item.preferred && <Star size={12} className="flex-shrink-0 text-primary" fill="currentColor" />}
                    {isSameName && !isSelected && (
                      <span className="flex-shrink-0 rounded bg-emerald-400/20 px-1 text-[8px] font-bold text-emerald-400">同名</span>
                    )}
                    <span className={`truncate ${isSameName && !isSelected ? "text-emerald-300" : ""}`}>
                      {item.file_name}
                    </span>
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
                    {/* Debug 按钮 — 条件渲染，仅在 debugEnabled 时显示 */}
                    {debugEnabled && onDebugClick && (
                      <div
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); handleDebugClick(item); } }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDebugClick(item);
                        }}
                        className="inline-flex items-center rounded-full bg-error/10 px-1.5 py-0.5 text-[9px] font-bold text-error transition-colors hover:bg-error/20 cursor-pointer"
                        title={t("debug")}
                      >
                        <Bug size={10} />
                      </div>
                    )}
                    {/* 评分 badge — 可点击展开扣分明细（div非button避免嵌套） */}
                    <div
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); toggleDeductions(item); } }}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDeductions(item);
                      }}
                      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-bold transition-colors hover:opacity-80 cursor-pointer ${
                        item.score >= 80 ? "bg-green-500/15 text-green-400"
                        : item.score >= 50 ? "bg-tertiary/15 text-tertiary"
                        : "bg-error/15 text-error"
                      }`}
                    >
                      {item.score || "\u2014"}
                      {(hasDeductions || showChecks) && (
                        isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />
                      )}
                    </div>
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
                  {item.last_index > 0 && (
                    <span className={item.last_index !== item.entry_count ? "text-amber-400" : ""}>
                      {item.last_index}/{item.entry_count}
                    </span>
                  )}
                  {item.last_index === 0 && <span className="text-on-surface-variant/40">-/-</span>}
                  {item.last_end_ms > 0 && (
                    <span className="tabular-nums">
                      {String(Math.floor(item.last_end_ms / 3600000)).padStart(2, "0")}:
                      {String(Math.floor((item.last_end_ms % 3600000) / 60000)).padStart(2, "0")}:
                      {String(Math.floor((item.last_end_ms % 60000) / 1000)).padStart(2, "0")}
                    </span>
                  )}
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
