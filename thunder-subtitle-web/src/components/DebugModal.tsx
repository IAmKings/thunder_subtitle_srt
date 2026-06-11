"use client";

import { useState, useCallback } from "react";
import { Bug, ChevronDown, ChevronRight, Copy, Check, X } from "lucide-react";
import type { DebugReviewResult, DeductionDetail } from "@/lib/types";

interface DebugModalProps {
  open: boolean;
  result: DebugReviewResult | null;
  error: string | null;
  isLoading: boolean;
  onClose: () => void;
  t: (key: string) => string;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatMs(ms: number): string {
  if (ms <= 0) return "--:--:--";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-outline-variant/20 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 bg-surface-container-high px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:bg-surface-container-highest transition-colors"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>{title}</span>
          {count !== undefined && (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] tabular-nums text-primary">
              {count}
            </span>
          )}
        </div>
      </button>
      {open && <div className="px-4 py-3">{children}</div>}
    </div>
  );
}

function buildReportText(result: DebugReviewResult, t: (key: string) => string): string {
  const lines: string[] = [];
  lines.push(`=== ${t("debug_title")}: ${result.file_name} ===`);
  lines.push("");

  // File info
  lines.push(`--- ${t("debug_section_file_info")} ---`);
  lines.push(`${t("debug_file_path")}: ${result.file_path}`);
  lines.push(`${t("debug_file_size")}: ${formatBytes(result.size_bytes)}`);
  lines.push(`${t("debug_encoding")}: ${result.encoding}`);
  lines.push(`${t("debug_score")}: ${result.score}`);
  lines.push(`${t("debug_status")}: ${result.status}`);
  lines.push(`${t("debug_cn_ratio")}: ${(result.cn_ratio * 100).toFixed(1)}%`);
  lines.push(`${t("debug_entry_count")}: ${result.entry_count}`);
  lines.push(`${t("debug_last_index")}: ${result.last_index}`);
  if (result.last_end_ms > 0) {
    lines.push(`${t("debug_last_end_time")}: ${formatMs(result.last_end_ms)}`);
  }
  if (result.deductions.length > 0) {
    lines.push(`${t("debug_deduction_items")}:`);
    for (const d of result.deductions) {
      lines.push(`  - ${d}`);
    }
  }
  lines.push("");

  // SRT Parse
  lines.push(`--- ${t("debug_section_srt_parse")} ---`);
  lines.push(`${t("debug_match_count")}: ${result.srt_parse.match_count}`);
  lines.push(`${t("debug_total_lines")}: ${result.srt_parse.total_lines}`);
  lines.push(`${t("debug_unmatched_offset")}: ${result.srt_parse.unmatched_tail_offset}`);
  lines.push("");

  // Deductions
  lines.push(`--- ${t("debug_section_deductions")} (${result.debug_deductions.length}) ---`);
  for (const d of result.debug_deductions) {
    lines.push(`  #${d.entry_index} ${d.line_range} [${d.issue_type}]`);
    if (d.detail) lines.push(`    ${d.detail}`);
    lines.push(`    "${d.content_snippet}"`);
  }
  if (result.debug_deductions.length === 0) {
    lines.push(`  ${t("debug_empty")}`);
  }
  lines.push("");

  // AI Flags
  lines.push(`--- ${t("debug_section_ai_flags")} ---`);
  if (result.ai_flags.length > 0) {
    for (const flag of result.ai_flags) {
      lines.push(`  - ${flag}`);
    }
  } else {
    lines.push(`  ${t("debug_empty")}`);
  }
  lines.push("");

  // Duration Match
  lines.push(`--- ${t("debug_section_duration_match")} ---`);
  if (result.last_content_scan.length > 0) {
    for (const log of result.last_content_scan) {
      lines.push(`  ${log}`);
    }
  } else {
    lines.push(`  ${t("debug_empty")}`);
  }
  lines.push("");

  return lines.join("\n");
}

export function DebugModal({ open, result, error, isLoading, onClose, t }: DebugModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    const text = buildReportText(result, t);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [result, t]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-10 pb-10"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-2xl rounded-xl bg-surface-container-high shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/20 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-error/15">
              <Bug className="text-error" size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold">
                {result ? result.file_name : t("debug_subtitle")}
              </h3>
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                {t("debug_title")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {result && (
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-lg border border-outline-variant/50 px-3 py-1.5 text-[10px] font-bold transition-colors hover:bg-surface-container-highest active:scale-95"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                {copied ? t("debug_copied") : t("debug_copy")}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-highest transition-colors"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto p-6 space-y-3">
          {isLoading && (
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-on-surface-variant">{t("debug_loading")}</p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error">
              {error}
            </div>
          )}

          {result && !isLoading && (
            <>
              {/* Section 1: File Info */}
              <CollapsibleSection title={t("debug_section_file_info")} defaultOpen={true}>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <div className="text-on-surface-variant">{t("debug_file_path")}</div>
                  <div className="text-on-surface break-all">{result.file_path}</div>
                  <div className="text-on-surface-variant">{t("debug_file_size")}</div>
                  <div className="text-on-surface">{formatBytes(result.size_bytes)}</div>
                  <div className="text-on-surface-variant">{t("debug_encoding")}</div>
                  <div className="text-on-surface">{result.encoding}</div>
                  <div className="text-on-surface-variant">{t("debug_score")}</div>
                  <div className={`font-bold ${result.score >= 80 ? "text-green-400" : result.score >= 50 ? "text-yellow-400" : "text-error"}`}>
                    {result.score}
                  </div>
                  <div className="text-on-surface-variant">{t("debug_status")}</div>
                  <div className="text-on-surface">{result.status}</div>
                  <div className="text-on-surface-variant">{t("debug_cn_ratio")}</div>
                  <div className="text-on-surface">{(result.cn_ratio * 100).toFixed(1)}%</div>
                  <div className="text-on-surface-variant">{t("debug_entry_count")}</div>
                  <div className="text-on-surface">{result.entry_count}</div>
                  <div className="text-on-surface-variant">{t("debug_last_index")}</div>
                  <div className={`text-on-surface ${result.last_index !== result.entry_count ? "text-amber-400" : ""}`}>
                    {result.last_index}
                  </div>
                  {result.last_end_ms > 0 && (
                    <>
                      <div className="text-on-surface-variant">{t("debug_last_end_time")}</div>
                      <div className="text-on-surface">{formatMs(result.last_end_ms)}</div>
                    </>
                  )}
                  {result.deductions.length > 0 && (
                    <>
                      <div className="text-on-surface-variant col-span-2 mt-2 font-bold">{t("debug_deduction_items")}</div>
                      {result.deductions.map((d, i) => (
                        <div key={i} className="col-span-2 text-error/80 pl-2">{"\u2022"} {d}</div>
                      ))}
                    </>
                  )}
                </div>
              </CollapsibleSection>

              {/* Section 2: SRT Parse */}
              <CollapsibleSection title={t("debug_section_srt_parse")} defaultOpen={true}>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <div className="text-on-surface-variant">{t("debug_match_count")}</div>
                  <div className="text-on-surface">{result.srt_parse.match_count}</div>
                  <div className="text-on-surface-variant">{t("debug_total_lines")}</div>
                  <div className="text-on-surface">{result.srt_parse.total_lines}</div>
                  <div className="text-on-surface-variant">{t("debug_unmatched_offset")}</div>
                  <div className="text-on-surface">{result.srt_parse.unmatched_tail_offset}</div>
                </div>
              </CollapsibleSection>

              {/* Section 3: Deductions */}
              <CollapsibleSection
                title={t("debug_section_deductions")}
                count={result.debug_deductions.length}
                defaultOpen={true}
              >
                {result.debug_deductions.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">{t("debug_empty")}</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {result.debug_deductions.map((d: DeductionDetail, i: number) => (
                      <div key={i} className="rounded border border-outline-variant/10 bg-surface-container-low p-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-error/15 px-1 py-0.5 font-bold text-error/80">
                            #{d.entry_index}
                          </span>
                          <span className="rounded bg-surface-container-high px-1 py-0.5 text-on-surface-variant">
                            {d.line_range}
                          </span>
                          <span className="rounded bg-amber-500/10 px-1 py-0.5 text-amber-500">
                            {d.issue_type}
                          </span>
                        </div>
                        {d.detail && (
                          <p className="mt-1 text-on-surface-variant">{d.detail}</p>
                        )}
                        <p className="mt-0.5 text-on-surface-variant/60 truncate">
                          &quot;{d.content_snippet}&quot;
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleSection>

              {/* Section 4: AI Flags */}
              <CollapsibleSection
                title={t("debug_section_ai_flags")}
                count={result.ai_flags.length}
                defaultOpen={true}
              >
                {result.ai_flags.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">{t("debug_empty")}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {result.ai_flags.map((flag, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-500"
                      >
                        {flag}
                      </span>
                    ))}
                  </div>
                )}
              </CollapsibleSection>

              {/* Section 5: Duration Match */}
              <CollapsibleSection title={t("debug_section_duration_match")} defaultOpen={true}>
                {result.last_content_scan.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">{t("debug_empty")}</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {result.last_content_scan.map((log, i) => (
                      <p key={i} className="font-mono text-[10px] leading-relaxed text-on-surface-variant">
                        {log}
                      </p>
                    ))}
                  </div>
                )}
              </CollapsibleSection>

              {/* Entry Diagnosis (compact, inline with file info style) */}
              <CollapsibleSection title={t("debug_file_diagnosis")} defaultOpen={false}>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <div className="text-on-surface-variant">{t("debug_file_size")}</div>
                  <div className="text-on-surface">{result.entry_diagnosis.size_kb.toFixed(1)} KB</div>
                  <div className="text-on-surface-variant">{t("debug_valid_lines")}</div>
                  <div className="text-on-surface">{result.entry_diagnosis.valid_lines}</div>
                  <div className="text-on-surface-variant">{t("debug_srt_match_count")}</div>
                  <div className="text-on-surface">{result.entry_diagnosis.srt_match_count}</div>
                  <div className="text-on-surface-variant">{t("debug_unmatched_tail")}</div>
                  <div className="text-on-surface">{result.entry_diagnosis.unmatched_tail_bytes}</div>
                </div>
              </CollapsibleSection>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
