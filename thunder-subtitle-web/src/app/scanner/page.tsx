"use client";

import { FolderOpen, Play, RefreshCw as SyncIcon, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

export default function ScannerPage() {
  const t = useTranslations();
  const scanProgress = 68;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      {/* Stats Cards */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="ghost-border col-span-2 flex items-center justify-between rounded-xl bg-surface-container p-6">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              {t("library_path")}
            </p>
            <h2 className="text-xl font-bold">/media/movies</h2>
          </div>
          <button
            type="button"
            className="rounded-lg bg-surface-container-high p-3 transition-colors hover:bg-outline-variant"
          >
            <FolderOpen size={24} />
          </button>
        </div>
        <div className="ghost-border rounded-xl bg-surface-container p-6">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            {t("total_files")}
          </p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold">0</span>
            <span className="text-sm text-on-surface-variant">{t("items")}</span>
          </div>
        </div>
        <div className="ghost-border rounded-xl bg-surface-container p-6">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            {t("missing_subs")}
          </p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-tertiary">0</span>
            <span className="text-sm text-on-surface-variant">0%</span>
          </div>
        </div>
      </section>

      {/* Active Scan */}
      <section className="ghost-border space-y-6 rounded-xl bg-surface-container-low p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <SyncIcon size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold">{t("active_jellyfin_scan")}</h3>
              <p className="text-sm text-on-surface-variant">{t("sync_desc")}</p>
            </div>
          </div>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg bg-primary-container px-6 py-3 text-xs font-bold text-on-primary-container transition-all hover:brightness-110 active:scale-95"
          >
            <Play size={16} fill="currentColor" />
            {t("scan_now")}
          </button>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span>
              {t("scanning")}: <span className="font-medium text-primary">Waiting to start...</span>
            </span>
            <span className="font-bold">{scanProgress}% {t("complete")}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
            <div
              className="h-full bg-primary-container transition-all duration-500"
              style={{ width: "0%" }}
            />
          </div>
        </div>
      </section>

      {/* Recent Findings Table */}
      <section className="ghost-border overflow-hidden rounded-xl bg-surface-container">
        <div className="flex items-center justify-between bg-surface-container-high px-6 py-4">
          <h4 className="text-lg font-bold">{t("recent_findings")}</h4>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-1 text-sm text-on-surface-variant transition-colors hover:bg-surface-container-highest"
          >
            <Filter size={16} />
            <span>{t("all_status")}</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-outline-variant/30 bg-surface-container-high/50 text-xs font-bold uppercase text-on-surface-variant">
              <tr>
                <th className="px-6 py-4">{t("media_file")}</th>
                <th className="px-6 py-4">{t("type")}</th>
                <th className="px-6 py-4">{t("resolution")}</th>
                <th className="px-6 py-4">{t("status")}</th>
                <th className="px-6 py-4 text-right">{t("action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              <tr>
                <td className="px-6 py-8 text-center text-sm text-on-surface-variant" colSpan={5}>
                  No scan results yet. Click &ldquo;Scan Now&rdquo; to start scanning your media library.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between bg-surface-container-low px-6 py-4 text-sm text-on-surface-variant">
          <span>0 results</span>
          <div className="flex gap-2">
            <button type="button" className="ghost-border rounded p-1 transition-colors hover:bg-surface-container-high">
              <ChevronLeft size={16} />
            </button>
            <button type="button" className="ghost-border rounded p-1 transition-colors hover:bg-surface-container-high">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}