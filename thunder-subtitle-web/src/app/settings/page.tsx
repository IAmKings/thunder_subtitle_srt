"use client";

import { useState } from "react";
import { Settings as SettingsIcon, RefreshCw as SyncIcon, ExternalLink, Monitor as ScannerIcon, ChevronDown } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

export default function SettingsPage() {
  const t = useTranslations();
  const [savePath, setSavePath] = useState("/mnt/media/subtitles");
  const [jellyfinUrl, setJellyfinUrl] = useState("");
  const [jellyfinKey, setJellyfinKey] = useState("");

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="mb-8">
        <h2 className="text-3xl font-bold">{t("system_settings")}</h2>
        <p className="mt-1 text-on-surface-variant">{t("settings_desc")}</p>
      </header>

      <div className="space-y-8">
        {/* General */}
        <section className="ghost-border rounded-xl bg-surface-container p-6">
          <div className="mb-6 flex items-center gap-2 border-b border-outline-variant/20 pb-2">
            <SettingsIcon className="text-primary" size={20} />
            <h3 className="text-lg font-bold">{t("general")}</h3>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                {t("save_path")}
              </label>
              <input
                type="text"
                value={savePath}
                onChange={(e) => setSavePath(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                {t("lang_priority")}
              </label>
              <div className="relative">
                <select className="w-full appearance-none rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface focus:border-primary focus:outline-none pr-10">
                  <option>Chinese Priority</option>
                  <option>English Only</option>
                  <option>All Languages</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                  <ChevronDown size={16} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Jellyfin Integration */}
        <section className="ghost-border rounded-xl bg-surface-container p-6">
          <div className="mb-6 flex items-center justify-between border-b border-outline-variant/20 pb-2">
            <div className="flex items-center gap-2">
              <SyncIcon className="text-tertiary" size={20} />
              <h3 className="text-lg font-bold">{t("jellyfin_integration")}</h3>
            </div>
            <span className="rounded-full bg-tertiary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-tertiary">
              {t("connected")}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                {t("server_url")}
              </label>
              <input
                type="text"
                value={jellyfinUrl}
                onChange={(e) => setJellyfinUrl(e.target.value)}
                placeholder="https://jellyfin.local:8096"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                {t("api_key")}
              </label>
              <input
                type="password"
                value={jellyfinKey}
                onChange={(e) => setJellyfinKey(e.target.value)}
                placeholder="Enter API key"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* Subtitle Sources */}
        <section className="ghost-border rounded-xl bg-surface-container p-6">
          <div className="mb-6 flex items-center gap-2 border-b border-outline-variant/20 pb-2">
            <ExternalLink className="text-secondary" size={20} />
            <h3 className="text-lg font-bold">{t("subtitle_sources")}</h3>
          </div>
          <div className="space-y-4">
            <div className="ghost-border flex items-center justify-between rounded-lg bg-surface-container-low p-4 transition-colors hover:bg-surface-container">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded bg-white/10">
                  <div className="h-6 w-6 rounded-sm bg-primary/40" />
                </div>
                <div>
                  <p className="text-sm font-bold">Xunlei Subtitle API</p>
                  <p className="text-[10px] font-bold uppercase text-on-surface-variant">
                    Active &bull; Default Source
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="rounded-lg border border-outline-variant px-4 py-2 text-xs font-bold transition-colors hover:bg-surface-container-high"
              >
                {t("configure")}
              </button>
            </div>
          </div>
        </section>

        {/* Automation */}
        <section className="ghost-border rounded-xl bg-surface-container p-6">
          <div className="mb-6 flex items-center gap-2 border-b border-outline-variant/20 pb-2">
            <ScannerIcon className="text-primary" size={20} />
            <h3 className="text-lg font-bold">{t("automation")}</h3>
          </div>
          <div className="grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-2">
            {[
              { id: "scan", label: t("auto_scan"), desc: t("auto_scan_desc"), active: true },
              { id: "download", label: t("auto_download"), desc: t("auto_download_desc"), active: false },
              { id: "cleanup", label: t("cleanup_orphans"), desc: t("cleanup_desc"), active: true },
              { id: "notify", label: t("notify_success"), desc: t("notify_desc"), active: true },
            ].map((item) => (
              <div key={item.id} className="group flex items-center justify-between">
                <div className="pr-4">
                  <p className="text-sm font-bold transition-colors group-hover:text-primary">
                    {item.label}
                  </p>
                  <p className="text-[10px] leading-relaxed text-on-surface-variant">{item.desc}</p>
                </div>
                <div
                  className={`relative h-6 w-12 flex-shrink-0 cursor-pointer rounded-full transition-all duration-300 ${
                    item.active ? "bg-primary-container" : "bg-surface-variant"
                  }`}
                >
                  <div
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all duration-300 ${
                      item.active ? "right-1" : "left-1"
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Action Footer */}
        <div className="flex items-center justify-end gap-4 pt-4">
          <button
            type="button"
            className="rounded-lg border border-outline px-8 py-3 text-sm font-bold transition-all hover:bg-surface-container-high active:scale-95"
          >
            {t("reset_defaults")}
          </button>
          <button
            type="button"
            className="rounded-lg bg-primary-container px-8 py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(0,164,220,0.3)] transition-all hover:brightness-110 active:scale-95"
          >
            {t("save_changes")}
          </button>
        </div>
      </div>
    </div>
  );
}