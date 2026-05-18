"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckSquare as VerificationIcon,
  Download,
  MoreVertical,
  CheckCircle,
  Timer,
  Languages,
  CheckCircle2,
  FileText,
  Loader2,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { fastApiClient } from "@/lib/api";
import { withAuth } from "@/lib/auth";
import type { ReviewItem, ReviewState } from "@/lib/types";

// ---- Status Helpers ----

function getQualityColor(quality: string) {
  switch (quality) {
    case "ok":
      return "bg-green-500/15 text-green-400";
    case "warn":
      return "bg-tertiary/15 text-tertiary";
    case "fail":
      return "bg-error/15 text-error";
    default:
      return "bg-on-surface-variant/15 text-on-surface-variant";
  }
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

function VerificationPage() {
  const t = useTranslations();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingPath, setMarkingPath] = useState<string | null>(null);
  const [baseDir, setBaseDir] = useState("");

  // Load review items
  useEffect(() => {
    async function loadReviews() {
      try {
        // First get media directories to determine base path
        const dirs = await fastApiClient.listMediaDirectories();
        if (dirs.length === 0) {
          setIsLoading(false);
          return;
        }
        const dir = dirs[0].path;
        setBaseDir(dir);
        const result = await fastApiClient.listReviews(dir);
        const reviewItems = (result.items as ReviewItem[]) || [];
        setItems(reviewItems);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("review_list_error"));
      } finally {
        setIsLoading(false);
      }
    }
    loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMark = useCallback(
    async (status: "ok" | "fail") => {
      if (!selectedItem || !baseDir) return;
      setMarkingPath(selectedItem.file_path);
      try {
        await fastApiClient.markReview(baseDir, selectedItem.file_path, status);
        // Update local state
        setItems((prev) =>
          prev.map((item) =>
            item.file_path === selectedItem.file_path
              ? { ...item, review_status: status, review_date: new Date().toISOString().split("T")[0] }
              : item
          )
        );
        setSelectedItem((prev) =>
          prev
            ? { ...prev, review_status: status, review_date: new Date().toISOString().split("T")[0] }
            : null
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : t("mark_error"));
      } finally {
        setMarkingPath(null);
      }
    },
    [selectedItem, baseDir, t]
  );

  const okCount = items.filter((i) => i.review_status === "ok").length;
  const failCount = items.filter((i) => i.review_status === "fail").length;
  const unreviewedCount = items.filter((i) => i.review_status === "not_reviewed").length;

  return (
    <div className="grid grid-cols-12 gap-8 h-full">
      {/* Left Panel: Pending list */}
      <section className="col-span-12 flex flex-col gap-4 lg:col-span-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <VerificationIcon className="text-primary" size={20} />
            {t("pending_verification")}
          </h2>
          <span className="rounded-full bg-primary/15 px-3 py-1 text-[10px] font-bold uppercase text-primary">
            {items.length} {t("files")}
          </span>
        </div>

        {/* Status counts */}
        <div className="flex gap-2 text-[10px] font-bold uppercase">
          <span className="rounded-full bg-on-surface-variant/15 px-2 py-0.5 text-on-surface-variant">
            {unreviewedCount} {t("untagged")}
          </span>
          {okCount > 0 && (
            <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-green-400">
              {okCount} ✓
            </span>
          )}
          {failCount > 0 && (
            <span className="rounded-full bg-error/15 px-2 py-0.5 text-error">
              {failCount} ✗
            </span>
          )}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 size={24} className="animate-spin text-primary" />
            <p className="text-sm text-on-surface-variant">{t("loading_reviews")}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">
            {error}
          </div>
        )}

        {/* Review list */}
        {!isLoading && items.length === 0 && (
          <div className="py-12 text-center text-sm text-on-surface-variant">
            {baseDir
              ? t("no_pending_subs")
              : t("no_media_dirs_settings")}
            <br />
            {baseDir && t("run_scan_first")}
          </div>
        )}

        <div className="flex max-h-[calc(100vh-250px)] flex-col gap-3 overflow-y-auto pr-2">
          {items.map((item) => (
            <button
              key={item.file_path}
              type="button"
              onClick={() => setSelectedItem(item)}
              className={`ghost-border rounded-lg p-4 text-left transition-all hover:border-primary/50 ${
                selectedItem?.file_path === item.file_path
                  ? "border-primary/50 bg-surface-container-high"
                  : "bg-surface-container"
              }`}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{item.file_name}</p>
                  <p className="mt-1 truncate text-[10px] text-on-surface-variant">{item.file_path}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${getQualityColor(item.quality)}`}>
                    {item.quality}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${getReviewStatusColor(item.review_status)}`}>
                    {item.review_status}
                  </span>
                </div>
              </div>
              {/* Quality details */}
              <div className="mt-2 flex items-center gap-4 text-[10px] text-on-surface-variant">
                {item.chinese_ratio > 0 && (
                  <span>{t("match")}: {Math.round(item.chinese_ratio * 100)}%</span>
                )}
                {item.encoding && <span>{item.encoding}</span>}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Right Panel: Preview + Actions */}
      <section className="col-span-12 flex flex-col gap-4 lg:col-span-8">
        <div className="ghost-border flex items-center justify-between rounded-xl bg-surface-container-high p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-outline-variant/20 bg-surface-container-highest">
              {selectedItem ? (
                <FileText className="text-primary" size={24} />
              ) : (
                <VerificationIcon className="text-on-surface-variant" size={24} />
              )}
            </div>
            <div>
              <p className="text-sm font-bold">
                {selectedItem ? selectedItem.file_name : t("no_file_selected")}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                {selectedItem
                   ? `${selectedItem.quality} • ${selectedItem.encoding || t("unknown_encoding")}`
                   : t("select_file_panel")}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container-highest"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <Download size={18} />
            </button>
            <button
              type="button"
              className="rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container-highest"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <MoreVertical size={18} />
            </button>
          </div>
        </div>

        {/* Quality info when selected */}
        {selectedItem && (
          <div className="grid grid-cols-3 gap-4">
            <div className="ghost-border rounded-lg bg-surface-container p-4 text-center">
              <p className="text-[10px] font-bold uppercase text-on-surface-variant">{t("match")}</p>
              <p className="mt-1 text-2xl font-bold text-primary">
                {Math.round(selectedItem.chinese_ratio * 100)}%
              </p>
            </div>
            <div className="ghost-border rounded-lg bg-surface-container p-4 text-center">
              <p className="text-[10px] font-bold uppercase text-on-surface-variant">{t("dur")}</p>
              <p className="mt-1 text-sm font-bold text-on-surface">
                {selectedItem.encoding || "—"}
              </p>
            </div>
            <div className="ghost-border rounded-lg bg-surface-container p-4 text-center">
              <p className="text-[10px] font-bold uppercase text-on-surface-variant">{t("status")}</p>
              <p className={`mt-1 text-sm font-bold ${
                selectedItem.review_status === "ok"
                  ? "text-green-400"
                  : selectedItem.review_status === "fail"
                  ? "text-error"
                  : "text-on-surface-variant"
              }`}>
                {selectedItem.review_status}
              </p>
            </div>
          </div>
        )}

        {/* Content preview area */}
        <div className="ghost-border flex min-h-[400px] flex-1 flex-col overflow-hidden rounded-xl bg-surface-container-lowest">
          {/* Progress bar */}
          <div className="relative h-1 w-full bg-surface-container-highest">
            {selectedItem && selectedItem.chinese_ratio > 0 && (
              <div
                className="absolute left-0 top-0 h-full bg-primary shadow-[0_0_8px_rgba(123,208,255,0.5)]"
                style={{ width: `${Math.round(selectedItem.chinese_ratio * 100)}%` }}
              />
            )}
          </div>

          <div className="flex flex-1 items-center justify-center p-6 font-mono">
            {selectedItem ? (
              <div className="space-y-2 text-sm">
                <p className="text-on-surface-variant">
                  {t("format_encoding_short").replace("{format}", selectedItem.file_name.split(".").pop()?.toUpperCase() || "SRT").replace("{encoding}", selectedItem.encoding || "UTF-8")}
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
            ) : (
              <p className="text-on-surface-variant">
                {t("subtitle_preview_here")}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col items-center justify-between gap-4 border-t border-outline-variant/30 bg-surface-container-low p-6 sm:flex-row">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleMark("ok")}
                disabled={!selectedItem || markingPath !== null}
                className="flex items-center gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-highest px-4 py-2 text-sm font-bold text-on-surface transition-all hover:border-primary active:scale-95 disabled:opacity-50"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {markingPath === selectedItem?.file_path ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                {t("correct")}
              </button>
              <button
                type="button"
                onClick={() => handleMark("fail")}
                disabled={!selectedItem || markingPath !== null}
                className="flex items-center gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-highest px-4 py-2 text-sm font-bold text-on-surface transition-all hover:border-tertiary active:scale-95 disabled:opacity-50"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <Timer size={16} /> {t("off_sync")}
              </button>
              <button
                type="button"
                onClick={() => handleMark("fail")}
                disabled={!selectedItem || markingPath !== null}
                className="flex items-center gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-highest px-4 py-2 text-sm font-bold text-on-surface transition-all hover:border-error active:scale-95 disabled:opacity-50"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <Languages size={16} /> {t("wrong_lang")}
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleMark("ok")}
              disabled={!selectedItem || markingPath !== null}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-container px-8 py-3 font-bold text-white shadow-[0_4px_12px_rgba(0,164,220,0.4)] transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 sm:w-auto"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <CheckCircle2 size={18} /> {t("confirm_verification")}
            </button>
          </div>
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="flex justify-center gap-8 py-2 text-[10px] font-bold uppercase text-on-surface-variant/40">
          <div className="flex items-center gap-1">
            <kbd className="rounded border border-outline-variant/50 bg-surface-container-high px-1.5 py-0.5">SPACE</kbd>
            <span>{t("play_pause")}</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="rounded border border-outline-variant/50 bg-surface-container-high px-1.5 py-0.5">V</kbd>
            <span>{t("mark_correct")}</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="rounded border border-outline-variant/50 bg-surface-container-high px-1.5 py-0.5">ENTER</kbd>
            <span>{t("confirm")}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default withAuth(VerificationPage);