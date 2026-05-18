"use client";

import { CheckSquare as VerificationIcon, Download, MoreVertical, CheckCircle, Timer, Languages, CheckCircle2 } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

export default function VerificationPage() {
  const t = useTranslations();

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
            0 {t("files")}
          </span>
        </div>

        <div className="flex max-h-[calc(100vh-250px)] flex-col gap-3 overflow-y-auto pr-2">
          <div className="py-12 text-center text-sm text-on-surface-variant">
            No subtitles pending verification.
            <br />
            Run a scan first to populate this list.
          </div>
        </div>
      </section>

      {/* Right Panel: Preview + Actions */}
      <section className="col-span-12 flex flex-col gap-4 lg:col-span-8">
        <div className="ghost-border flex items-center justify-between rounded-xl bg-surface-container-high p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-outline-variant/20 bg-surface-container-highest">
              <VerificationIcon className="text-on-surface-variant" size={24} />
            </div>
            <div>
              <p className="text-sm font-bold">No file selected</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                Select a file from the left panel
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container-highest"
            >
              <Download size={18} />
            </button>
            <button
              type="button"
              className="rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container-highest"
            >
              <MoreVertical size={18} />
            </button>
          </div>
        </div>

        <div className="ghost-border flex min-h-[500px] flex-1 flex-col overflow-hidden rounded-xl bg-surface-container-lowest">
          <div className="relative h-1 w-full bg-surface-container-highest">
            <div className="absolute left-0 top-0 h-full w-0 bg-primary shadow-[0_0_8px_rgba(123,208,255,0.5)]" />
          </div>

          <div className="flex flex-1 items-center justify-center p-6 font-mono">
            <p className="text-on-surface-variant">
              Subtitle content preview will appear here
            </p>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-outline-variant/30 bg-surface-container-low p-6 sm:flex-row">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-highest px-4 py-2 text-sm font-bold text-on-surface transition-all hover:border-primary active:scale-95"
              >
                <CheckCircle size={16} /> {t("correct")}
              </button>
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-highest px-4 py-2 text-sm font-bold text-on-surface transition-all hover:border-tertiary active:scale-95"
              >
                <Timer size={16} /> {t("off_sync")}
              </button>
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-highest px-4 py-2 text-sm font-bold text-on-surface transition-all hover:border-error active:scale-95"
              >
                <Languages size={16} /> {t("wrong_lang")}
              </button>
            </div>
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-container px-8 py-3 font-bold text-white shadow-[0_4px_12px_rgba(0,164,220,0.4)] transition-all hover:brightness-110 active:scale-95 sm:w-auto"
            >
              <CheckCircle2 size={18} /> {t("confirm_verification")}
            </button>
          </div>
        </div>

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