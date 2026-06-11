"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  Search as SearchIcon,
  Download,
  Filter,
  X,
  Clock,
  Star,
  Globe,
  Zap,
  CheckCircle,
} from "lucide-react";
import type { Subtitle } from "@/lib/types";
import { useTranslations } from "@/lib/i18n";
import { useSearchState, useSearchActions, type FilterMode, type SortMode, type HistoryItem } from "@/lib/search-state";

// ---- Helpers ----

function formatDuration(ms: number, unknownLabel = "Unknown"): string {
  if (ms <= 0) return unknownLabel;
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function isChineseLang(lang: string): boolean {
  return /chinese|中文|简体|繁体|cn|zh/i.test(lang);
}

/** Pure function: filter subtitles that are Chinese (by language or name pattern). */
function filterChineseSubtitles(subs: Subtitle[]): Subtitle[] {
  return subs.filter((subtitle) => {
    const hasChineseLang = subtitle.languages.some((lang) =>
      /chinese|中文|简体|繁体|cn/i.test(lang)
    );
    const hasChineseName = /[\u4e00-\u9fa5]/.test(subtitle.name);
    const isEmptyLang = subtitle.languages.length === 0 || subtitle.languages[0] === "";
    return hasChineseLang || (hasChineseName && isEmptyLang);
  });
}

function filterSubtitles(
  subs: Subtitle[],
  mode: FilterMode,
  duration: string
): Subtitle[] {
  let filtered = [...subs];

  if (mode === "chinese_only") {
    filtered = filterChineseSubtitles(filtered);
  } else if (mode === "chinese_first") {
    const chinese = filterChineseSubtitles(filtered);
    const chineseGcids = new Set(chinese.map((s) => s.gcid));
    const others = filtered.filter((s) => !chineseGcids.has(s.gcid));
    filtered = [...chinese, ...others];
  }

  if (duration.trim()) {
    const match = duration.trim().match(/^(\d+)(h|m|s)?$/i);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = (match[2] ?? "m").toLowerCase();
      let maxMs = value * 60000;
      if (unit === "h") maxMs = value * 3600000;
      else if (unit === "s") maxMs = value * 1000;

      filtered = filtered.filter(
        (s) => s.duration <= 0 || s.duration <= maxMs
      );
    }
  }

  return filtered;
}

// ---- Component ----

export default function SearchPage() {
  const t = useTranslations();
  const {
    query, allSubtitles, isLoading, hasSearched, error,
    filterMode, sortMode, maxDuration, history, currentPage,
  } = useSearchState();
  const {
    setQuery, setFilterMode, setSortMode, setMaxDuration,
    setCurrentPage, handleSearch, handleHistoryClick,
    handleClearHistory, handleRemoveHistoryItem,
  } = useSearchActions();

  const ITEMS_PER_PAGE = 12;

  const subtitles = useMemo(() => {
    let filtered = filterSubtitles(allSubtitles, filterMode, maxDuration);

    if (sortMode === "newest") {
      filtered = [...filtered].sort((a, b) => b.score - a.score || (b.duration || 0) - (a.duration || 0));
    } else if (sortMode === "score") {
      filtered = [...filtered].sort((a, b) => b.score - a.score);
    }

    return filtered;
  }, [allSubtitles, filterMode, maxDuration, sortMode]);

  const handleDownload = useCallback(
    (sub: Subtitle) => {
      const downloadUrl = `/api/subtitle/download?url=${encodeURIComponent(sub.url)}`;
      window.open(downloadUrl, "_blank");
    },
    []
  );

  const paginatedSubtitles = subtitles.slice(0, currentPage * ITEMS_PER_PAGE);
  const hasMore = subtitles.length > currentPage * ITEMS_PER_PAGE;

  return (
    <div className="mx-auto max-w-7xl space-y-6 md:space-y-8">
      {/* Search Hero */}
      <section className="flex flex-col items-center py-4 text-center md:py-8">
        <div className="w-full max-w-3xl space-y-4">
          <h2 className="text-2xl font-bold md:text-3xl">{t("find_perfect")}</h2>
          <p className="text-base text-on-surface-variant">{t("search_desc")}</p>
          <div className="group relative mt-6">
            <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-outline">
              <SearchIcon size={24} />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={t("search_placeholder")}
              aria-label={t("search_placeholder")}
              className="h-16 w-full rounded-xl border border-outline-variant/50 bg-surface-container-high pl-12 pr-4 text-lg text-on-surface shadow-xl backdrop-blur-md transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="absolute inset-y-2 right-2 flex items-center">
              <button
                type="button"
                onClick={() => handleSearch()}
                disabled={isLoading}
                className="h-12 rounded-lg bg-primary-container px-5 text-sm font-bold text-on-primary-container transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 md:px-8"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {isLoading ? t("scanning") : t("search_btn")}
              </button>
            </div>
          </div>

          {/* Filter Chips */}
          {hasSearched && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
              <div className="flex rounded-lg border border-outline-variant/30 bg-surface-container p-1">
                {(
                  [
                    { mode: "all" as FilterMode, label: t("filter_mode_all") },
                    { mode: "chinese_only" as FilterMode, label: t("filter_mode_chinese_only") },
                    { mode: "chinese_first" as FilterMode, label: t("filter_mode_chinese_first") },
                  ] as const
                ).map(({ mode, label }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setFilterMode(mode)}
                    className={`rounded-md px-3 py-1.5 text-[11px] font-bold transition-all md:px-4 md:text-xs ${
                      filterMode === mode
                        ? "bg-primary text-on-primary"
                        : "text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                    style={{ WebkitTapHighlightColor: "transparent" }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Duration Filter */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={maxDuration}
                  onChange={(e) => setMaxDuration(e.target.value)}
                  placeholder="Max duration (e.g. 2h, 90m)"
                  aria-label="最大时长筛选"
                  className="w-36 rounded-lg border border-outline-variant/30 bg-surface-container px-2 py-1.5 text-[11px] text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary md:w-44 md:px-3 md:text-xs"
                />
                {maxDuration && (
                  <button
                    type="button"
                    onClick={() => setMaxDuration("")}
                    className="rounded-full p-1 text-on-surface-variant transition-colors hover:bg-surface-container-high"
                    style={{ WebkitTapHighlightColor: "transparent" }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="mx-auto max-w-3xl rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error">
          {error}
        </div>
      )}

      {/* Main Content: History + Results */}
      {hasSearched && !isLoading ? (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 space-y-6">
            {subtitles.length === 0 ? (
              <div className="py-16 text-center text-on-surface-variant">
                {error
                  ? t("search_failed")
                  : t("no_results_try_again")}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold md:text-2xl">
                    {t("top_results")}{" "}
                    <span className="ml-2 text-xs font-normal text-on-surface-variant opacity-50 md:text-sm">
                      ({subtitles.length} {t("items")})
                    </span>
                  </h3>
                  <div className="flex gap-2">
                    <div className="flex rounded-lg border border-outline-variant/30 bg-surface-container p-1">
                      {(
                        [
                          { mode: "relevance" as SortMode, label: t("sort_relevance") },
                          { mode: "newest" as SortMode, label: t("sort_newest") },
                          { mode: "score" as SortMode, label: t("sort_score") },
                        ] as const
                      ).map(({ mode, label }) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setSortMode(mode)}
                          aria-pressed={sortMode === mode}
                          className={`rounded-md px-2 py-1 text-[11px] font-bold transition-all md:px-3 md:text-xs ${
                            sortMode === mode
                              ? "bg-primary text-on-primary"
                              : "text-on-surface-variant hover:bg-surface-container-high"
                          }`}
                          style={{ WebkitTapHighlightColor: "transparent" }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="flex items-center gap-1 rounded-full border border-outline-variant/30 bg-surface-container px-3 py-1.5 text-[11px] font-bold text-on-surface-variant transition-colors hover:bg-surface-container-highest md:px-4 md:text-xs"
                      style={{ WebkitTapHighlightColor: "transparent" }}
                    >
                      <Filter size={14} /> {t("filter")}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {paginatedSubtitles.map((sub) => {
                    const hasChinese = sub.languages.some(isChineseLang);
                    return (
                      <div
                        key={`${sub.gcid}-${sub.cid}`}
                        className="ghost-border group flex flex-col overflow-hidden rounded-xl bg-surface-container-low shadow-md transition-all hover:border-primary/50"
                      >
                        <div className="flex flex-grow flex-col justify-between p-4">
                          <div className="space-y-2">
                            {hasChinese && (
                              <div className="flex items-center gap-1">
                                <Star size={10} className="fill-secondary text-secondary" />
                                <span className="text-[10px] font-bold uppercase text-secondary">Chinese</span>
                              </div>
                            )}
                            <h4 className="truncate text-base font-bold transition-colors group-hover:text-primary">
                              {sub.name}
                            </h4>
                            <p className="text-xs text-on-surface-variant">
                              {sub.ext.toUpperCase()} &bull;{" "}
                              {sub.duration > 0 ? formatDuration(sub.duration) : t("unknown_duration")}
                              {sub.score > 0 && (
                                <> &bull; {t("score_label")}: {sub.score.toFixed(1)}</>
                              )}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {sub.languages
                                .filter((l) => l)
                                .map((lang) => (
                                  <span
                                    key={lang}
                                    className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                      isChineseLang(lang)
                                        ? "border-secondary/20 bg-secondary/15 text-secondary"
                                        : "border-primary/20 bg-primary/10 text-primary"
                                    }`}
                                  >
                                    {lang}
                                  </span>
                                ))}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDownload(sub)}
                            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-surface-variant py-2 text-xs font-bold transition-all hover:bg-primary-container hover:text-on-primary-container active:scale-[0.98]"
                            style={{ WebkitTapHighlightColor: "transparent" }}
                          >
                            <Download size={14} /> {t("download")}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {hasMore && (
                  <div className="flex justify-center pt-6">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      className="rounded-lg border border-outline-variant/50 bg-surface-container px-6 py-2 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-high md:px-8 md:py-3 md:text-sm"
                      style={{ WebkitTapHighlightColor: "transparent" }}
                    >
                      {t("load_more")}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : !hasSearched ? (
        <HistoryPanel
          history={history}
          onHistoryClick={handleHistoryClick}
          onRemoveItem={handleRemoveHistoryItem}
          onClearHistory={handleClearHistory}
        />
      ) : null}

      {isLoading && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-on-surface-variant">{t("scanning")}...</p>
        </div>
      )}

      {!hasSearched && (
        <section className="grid grid-cols-1 gap-6 border-t border-outline-variant/30 pt-8 md:grid-cols-3 md:pt-12">
          {[
            { icon: Globe, title: t("lang_52"), desc: t("lang_desc") },
            { icon: Zap, title: t("instant_sync"), desc: t("sync_feature_desc") },
            { icon: CheckCircle, title: t("verified_only"), desc: t("verified_desc") },
          ].map((feat) => (
            <div
              key={feat.title}
              className="ghost-border flex flex-col gap-2 rounded-xl bg-surface-container p-6"
            >
              <feat.icon className="text-primary" size={24} />
              <h5 className="text-lg font-bold">{feat.title}</h5>
              <p className="text-sm leading-relaxed text-on-surface-variant">
                {feat.desc}
              </p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

// ---- History Panel Sub-Component ----

function HistoryPanel({
  history,
  onHistoryClick,
  onRemoveItem,
  onClearHistory,
}: {
  history: HistoryItem[];
  onHistoryClick: (name: string) => void;
  onRemoveItem: (id: string) => void;
  onClearHistory: () => void;
}) {
  const t = useTranslations();
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  // 避免 SSR hydration mismatch：localStorage 仅在客户端可用
  if (!isHydrated || history.length === 0) return null;

  return (
    <section className="mx-auto max-w-2xl">
      <div className="ghost-border rounded-xl bg-surface-container p-4 md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{t("recent_searches")}</h3>
          <button
            type="button"
            onClick={onClearHistory}
            className="text-xs font-bold text-primary hover:underline"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            {t("clear")}
          </button>
        </div>
        <ul className="space-y-1">
          {history.map((item) => (
            <li key={item.id} className="group flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-surface-container-high">
              <Clock size={14} className="text-on-surface-variant group-hover:text-primary" />
              <button
                type="button"
                onClick={() => onHistoryClick(item.name)}
                className="flex-1 truncate text-left text-sm text-on-surface-variant transition-colors group-hover:text-on-surface"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {item.name}
              </button>
              <button
                type="button"
                onClick={() => onRemoveItem(item.id)}
                className="hidden text-on-surface-variant hover:text-error group-hover:block"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
