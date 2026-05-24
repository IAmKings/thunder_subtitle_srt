"use client";

import { useState, useEffect, useCallback, useMemo, useReducer, startTransition } from "react";
import {
  CheckSquare as VerificationIcon,
  CheckCircle2,
  Timer,
  Languages,
  FileText,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Trash2,
  Star,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { fastApiClient } from "@/lib/api";
import { withAuth } from "@/lib/auth";
import { useVerificationState, useVerificationActions } from "@/lib/verification-state";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SubtitlePreview } from "@/components/SubtitlePreview";
import { MovieList } from "@/components/MovieList";
import { VerificationSubtitleList } from "@/components/VerificationSubtitleList";
import { VerificationFilterBar, BatchActionBar } from "@/components/VerificationFilterBar";
import { VerificationStats } from "@/components/VerificationStats";
import type { ReviewItem } from "@/lib/types";

// ---- Helpers ----

function getMovieName(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1] || filePath;
}

/** Filter items for a movie path, optionally by status, then optionally sort by size. */
function getFilteredAndSortedMovieItems(
  items: ReviewItem[],
  moviePath: string,
  statusFilter: string | null,
  sortBySize: null | "desc" | "asc"
): ReviewItem[] {
  let list = items.filter((i) => i.file_path === moviePath);
  if (statusFilter) {
    list = list.filter((i) => i.review_status === statusFilter);
  }
  if (sortBySize === "desc") {
    list = [...list].sort((a, b) => b.size_bytes - a.size_bytes);
  } else if (sortBySize === "asc") {
    list = [...list].sort((a, b) => a.size_bytes - b.size_bytes);
  }
  return list;
}

// ---- Filter Reducer ----

interface FilterState {
  searchQuery: string;
  statusFilter: string | null;
  sortBySize: null | "desc" | "asc";
  listPage: number;
}

type FilterAction =
  | { type: "SET_SEARCH_QUERY"; payload: string }
  | { type: "SET_STATUS_FILTER"; payload: string | null }
  | { type: "SET_SORT_BY_SIZE"; payload: null | "desc" | "asc" }
  | { type: "SET_LIST_PAGE"; payload: number }
  | { type: "RESET_FILTERS" };

const initialFilterState: FilterState = {
  searchQuery: "",
  statusFilter: null,
  sortBySize: null,
  listPage: 0,
};

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case "SET_SEARCH_QUERY":
      return { ...state, searchQuery: action.payload, listPage: 0 };
    case "SET_STATUS_FILTER":
      return { ...state, statusFilter: action.payload, listPage: 0 };
    case "SET_SORT_BY_SIZE":
      return { ...state, sortBySize: action.payload, listPage: 0 };
    case "SET_LIST_PAGE":
      return { ...state, listPage: action.payload };
    case "RESET_FILTERS":
      return { ...initialFilterState };
    default:
      return state;
  }
}

function VerificationPage() {
  const t = useTranslations();
  const { items, isLoading, error, selectedMovie, pinnedItems: pinnedKeys } = useVerificationState();
  const { setItems, setIsLoading, setError, setSelectedMovie, setPinnedItems } = useVerificationActions();
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [baseDir, setBaseDir] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewEncoding, setPreviewEncoding] = useState("");
  const PREVIEW_CHUNK = 200;
  const [previewPart, setPreviewPart] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmRename, setConfirmRename] = useState(false);
  const [newName, setNewName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState("");

  // ---- Filter state (useReducer) ----
  const [{ searchQuery, statusFilter, sortBySize, listPage }, dispatchFilter] = useReducer(filterReducer, initialFilterState);
  const PER_PAGE = 10;

  // ---- Dialog state ----
  const [confirmReject, setConfirmReject] = useState(false);
  const [rejectReason, setRejectReason] = useState<"off_sync" | "wrong_lang" | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [confirmKeepOnly, setConfirmKeepOnly] = useState(false);
  const [isKeepingOnly, setIsKeepingOnly] = useState(false);
  function getDisabledPaths(): Set<string> {
    try {
      const raw = localStorage.getItem("thunder-subtitle-disabled-paths");
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch { return new Set(); }
  }

  const loadReviews = useCallback(async () => {
    try {
      const dirs = await fastApiClient.listMediaDirectories();
      const disabled = getDisabledPaths();
      const enabledDirs = dirs.filter((d) => !disabled.has(d.path));
      if (enabledDirs.length === 0) {
        setItems([]);
        setIsLoading(false);
        return;
      }
      const allItems: ReviewItem[] = [];
      for (const dir of enabledDirs) {
        const result = await fastApiClient.listReviews(dir.path);
        const reviewItems = (result.items as ReviewItem[]) || [];
        allItems.push(...reviewItems);
      }
      setBaseDir(enabledDirs[0].path);
      setItems(allItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("review_list_error"));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [setItems, setIsLoading, setError, t]);

  useEffect(() => {
    fastApiClient.listMediaDirectories().then((dirs) => {
      const disabled = getDisabledPaths();
      const enabledDirs = dirs.filter((d) => !disabled.has(d.path));
      if (enabledDirs.length > 0) {
        setBaseDir(enabledDirs[0].path);
      }
      if (items.length === 0 && isLoading) {
        startTransition(() => { loadReviews(); });
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Individual mark ----
  const handleMark = useCallback(
    async (status: "ok" | "fail") => {
      if (!selectedItem || !baseDir) return;
      const movieToRemove = selectedMovie; // FIX: save before clearing
      try {
        await fastApiClient.markReview(baseDir, selectedItem.file_path, status);
        setItems((prev) =>
          prev.map((item) =>
            item.file_path === selectedItem.file_path && item.file_name === selectedItem.file_name
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
      }
      setSelectedMovie(null);
      setSelectedItem(null);
      setItems((prev) => prev.filter((i) => i.file_path !== movieToRemove));
    },
    [selectedItem, selectedMovie, baseDir, setError, setItems, setSelectedMovie, t]
  );

  // ---- Delete all subtitles for current movie ----
  const handleDeleteAll = useCallback(async () => {
    if (!selectedMovie) return;
    setIsDeletingAll(true);
    try {
      const movieItems = items.filter((i) => i.file_path === selectedMovie);
      for (const item of movieItems) {
        const subtitlePath = `${item.file_path}/${item.file_name}`;
        await fastApiClient.deleteSubtitleFile(subtitlePath);
      }
      if (baseDir) {
        await fastApiClient.markReview(baseDir, selectedMovie, "fail");
      }
      setItems((prev) => prev.filter((i) => i.file_path !== selectedMovie));
      setSelectedItem(null);
      setSelectedMovie(null);
      setConfirmDeleteAll(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("delete_failed"));
    } finally {
      setIsDeletingAll(false);
    }
  }, [selectedMovie, items, setItems, setError, baseDir, t, setSelectedMovie]);

  // ---- Keep only pinned subtitles ----
  const handleKeepOnly = useCallback(async () => {
    if (!selectedMovie || pinnedKeys.length === 0) return;
    setIsKeepingOnly(true);
    const toDelete = items.filter(
      (i) => i.file_path === selectedMovie && !pinnedKeys.includes(`${i.file_path}/${i.file_name}`)
    );
    try {
      for (const item of toDelete) {
        await fastApiClient.deleteSubtitleFile(`${item.file_path}/${item.file_name}`);
      }
      setItems((prev) =>
        prev.filter((i) => !toDelete.some((d) => d.file_path === i.file_path && d.file_name === i.file_name))
      );
      setSelectedItem(null);
      setConfirmKeepOnly(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("delete_failed"));
    } finally {
      setIsKeepingOnly(false);
    }
  }, [selectedMovie, pinnedKeys, items, setItems, setError, t]);

  // ---- Pin toggle ----
  const togglePin = useCallback((item: ReviewItem) => {
    const key = `${item.file_path}/${item.file_name}`;
    setPinnedItems((prev) => {
      const set = new Set(prev);
      if (set.has(key)) set.delete(key); else set.add(key);
      return [...set];
    });
  }, [setPinnedItems]);

  const isPinned = useCallback((item: ReviewItem) => {
    return pinnedKeys.includes(`${item.file_path}/${item.file_name}`);
  }, [pinnedKeys]);

  // ---- Reject: delete file, optionally mark fail, jump to next ----
  const handleReject = useCallback(async () => {
    if (!selectedItem || !selectedMovie) return;
    setIsRejecting(true);
    const deletedFile = selectedItem.file_name;
    try {
      const subtitlePath = `${selectedItem.file_path}/${selectedItem.file_name}`;
      await fastApiClient.deleteSubtitleFile(subtitlePath);

      const remaining = items.filter(
        (i) => !(i.file_path === selectedMovie && i.file_name === deletedFile)
      );

      // Find next item at deleted position (respect sort + filter)
      const sorted = getFilteredAndSortedMovieItems(remaining, selectedMovie, statusFilter, sortBySize);
      const fullSorted = getFilteredAndSortedMovieItems(
        items.filter((i) => i.file_path === selectedMovie),
        selectedMovie,
        statusFilter,
        sortBySize
      );
      const delIdx = fullSorted.findIndex((i) => i.file_name === deletedFile);
      const nextItem = sorted[Math.min(delIdx, sorted.length - 1)] || null;

      if (sorted.length === 0) {
        if (baseDir) {
          await fastApiClient.markReview(baseDir, selectedMovie, "fail");
        }
        setItems(remaining);
        setSelectedItem(null);
        setSelectedMovie(null);
      } else {
        setItems(remaining);
        setSelectedItem(nextItem);
        dispatchFilter({ type: "SET_LIST_PAGE", payload: 0 });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("delete_failed"));
    } finally {
      setIsRejecting(false);
      setConfirmReject(false);
    }
  }, [selectedItem, selectedMovie, baseDir, items, sortBySize, statusFilter, setItems, setError, t, setSelectedMovie, dispatchFilter]);

  // ---- Rename subtitle file ----
  const handleRename = useCallback(async () => {
    if (!selectedItem || !newName.trim()) return;
    setIsRenaming(true);
    setRenameError("");
    try {
      const subtitlePath = `${selectedItem.file_path}/${selectedItem.file_name}`;
      await fastApiClient.renameSubtitleFile(subtitlePath, newName.trim());
      setItems((prev) => prev.map((i) =>
        i.file_path === selectedItem.file_path && i.file_name === selectedItem.file_name
          ? { ...i, file_name: newName.trim() }
          : i
      ));
      setSelectedItem((prev) => prev ? { ...prev, file_name: newName.trim() } : null);
      setConfirmRename(false);
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : t("rename_failed"));
    } finally {
      setIsRenaming(false);
    }
  }, [selectedItem, newName, setItems, t]);

  // ---- Preview loading ----
  useEffect(() => {
    if (!selectedItem) return;

    const subtitlePath = `${selectedItem.file_path}/${selectedItem.file_name}`;
    setPreviewLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    const controller = new AbortController();

    fastApiClient.getSubtitlePreview(subtitlePath, controller.signal).then((data) => {
      setPreviewContent(data.content);
      setPreviewEncoding(data.encoding);
      setPreviewLoading(false);
    }).catch(() => {
      setPreviewContent(null);
      setPreviewEncoding("");
      setPreviewLoading(false);
    });

    return () => {
      controller.abort();
      setPreviewContent(null);
      setPreviewPart(0);
      setPreviewEncoding("");
      setPreviewLoading(false);
    };
  }, [selectedItem]);

  // ---- Movie grouping ----
  const movieGroups = useMemo(() => {
    const groups = new Map<string, ReviewItem[]>();
    for (const item of items) {
      const existing = groups.get(item.file_path);
      if (existing) {
        existing.push(item);
      } else {
        groups.set(item.file_path, [item]);
      }
    }
    return Array.from(groups.entries());
  }, [items]);

  const filteredMovies = useMemo(() => {
    if (!searchQuery.trim()) return movieGroups;
    const q = searchQuery.trim().toLowerCase();
    return movieGroups.filter(([filePath]) =>
      getMovieName(filePath).toLowerCase().includes(q)
    );
  }, [movieGroups, searchQuery]);

  // ---- Subtitle-level filtering (for selected movie) ----
  const movieSubtitleItems = useMemo(() => {
    if (!selectedMovie) return [];
    return getFilteredAndSortedMovieItems(items, selectedMovie, statusFilter, sortBySize);
  }, [items, selectedMovie, statusFilter, sortBySize]);

  // ---- Pagination ----
  const totalMoviePages = Math.max(1, Math.ceil(filteredMovies.length / PER_PAGE));
  const paginatedMovies = filteredMovies.slice(listPage * PER_PAGE, (listPage + 1) * PER_PAGE);

  const totalSubtitlePages = Math.max(1, Math.ceil(movieSubtitleItems.length / PER_PAGE));
  const paginatedSubtitleItems = movieSubtitleItems.slice(listPage * PER_PAGE, (listPage + 1) * PER_PAGE);

  const currentPage = listPage + 1;
  const totalPages = selectedMovie ? totalSubtitlePages : totalMoviePages;

  // ---- Counts (scoped to current view) ----
  const visibleItems = selectedMovie
    ? items.filter((i) => i.file_path === selectedMovie)
    : items;

  const okCount = visibleItems.filter((i) => i.review_status === "ok").length;
  const failCount = visibleItems.filter((i) => i.review_status === "fail").length;
  const unreviewedCount = visibleItems.filter((i) => i.review_status === "not_reviewed").length;

  const movieName = selectedMovie ? getMovieName(selectedMovie) : "";

  // ---- Handlers ----
  const handleBack = useCallback(() => {
    setSelectedMovie(null);
    setSelectedItem(null);
    // Only reset subtitle-level filters (status/sort/page), keep movie search query
    dispatchFilter({ type: "SET_STATUS_FILTER", payload: null });
    dispatchFilter({ type: "SET_SORT_BY_SIZE", payload: null });
    dispatchFilter({ type: "SET_LIST_PAGE", payload: 0 });
  }, [setSelectedMovie, dispatchFilter]);

  const handleSelectMovie = useCallback((filePath: string) => {
    setSelectedMovie(filePath);
    setSelectedItem(null);
    setPinnedItems([]);
    // Reset subtitle-level filters only, keep movie search query
    dispatchFilter({ type: "SET_STATUS_FILTER", payload: null });
    dispatchFilter({ type: "SET_SORT_BY_SIZE", payload: null });
    dispatchFilter({ type: "SET_LIST_PAGE", payload: 0 });
  }, [setSelectedMovie, setPinnedItems, dispatchFilter]);

  return (
    <div className="grid grid-cols-12 gap-8 h-full">
      {/* Left Panel */}
      <section className="col-span-12 flex flex-col gap-4 lg:col-span-4">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg md:text-xl font-bold">
            {selectedMovie ? (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <ArrowLeft size={18} />
              </button>
            ) : (
              <VerificationIcon className="text-primary" size={18} />
            )}
            <span>
              {selectedMovie
                ? `${t("reviewing")} - ${movieName}`
                : t("pending_verification")}
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setIsRefreshing(true); loadReviews(); }}
              disabled={isRefreshing}
              className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50"
              title={t("refresh")}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            </button>
            <span className="rounded-full bg-primary/15 px-3 py-1 text-[10px] font-bold uppercase text-primary">
              {selectedMovie
                ? `${movieSubtitleItems.length} ${t("files")}`
                : `${filteredMovies.length} ${t("items")}`}
            </span>
          </div>
        </div>

        {/* Search input (movies) */}
        {!selectedMovie && (
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => dispatchFilter({ type: "SET_SEARCH_QUERY", payload: e.target.value })}
              placeholder={t("search_placeholder")}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-low py-2.5 pl-3 pr-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none"
            />
          </div>
        )}

        {/* Status filter chips + size sort (subtitles) */}
        {selectedMovie && (
          <VerificationFilterBar
            sortBySize={sortBySize}
            setSortBySize={(v) => dispatchFilter({ type: "SET_SORT_BY_SIZE", payload: v })}
            statusFilter={statusFilter}
            setStatusFilter={(v) => dispatchFilter({ type: "SET_STATUS_FILTER", payload: v })}
            setListPage={(v) => {
              if (typeof v === "function") {
                dispatchFilter({ type: "SET_LIST_PAGE", payload: v(listPage) });
              } else {
                dispatchFilter({ type: "SET_LIST_PAGE", payload: v });
              }
            }}
            okCount={okCount}
            failCount={failCount}
            unreviewedCount={unreviewedCount}
            visibleItemsCount={visibleItems.length}
            t={t}
          />
        )}

        {/* Batch action bar */}
        {selectedMovie && (
          <BatchActionBar
            pinnedCount={pinnedKeys.length}
            setConfirmKeepOnly={setConfirmKeepOnly}
            isKeepingOnly={isKeepingOnly}
            setConfirmDeleteAll={setConfirmDeleteAll}
            t={t}
          />
        )}

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

        {/* Empty state */}
        {!isLoading && (
          selectedMovie
            ? movieSubtitleItems.length === 0 && (
                <div className="py-12 text-center text-sm text-on-surface-variant">
                  {statusFilter ? t("no_results_scan") : t("no_pending_subs")}
                </div>
              )
            : filteredMovies.length === 0 && (
                <div className="py-12 text-center text-sm text-on-surface-variant">
                  {baseDir
                    ? searchQuery ? t("no_results_scan") : t("no_pending_subs")
                    : t("no_media_dirs_settings")}
                  <br />
                  {baseDir && !searchQuery && t("run_scan_first")}
                </div>
              )
        )}

        {/* List */}
        <div className="flex max-h-[calc(100vh-380px)] flex-col gap-3 overflow-y-auto pr-2">
          {selectedMovie ? (
            <VerificationSubtitleList
              paginatedItems={paginatedSubtitleItems}
              selectedItem={selectedItem}
              onSelectItem={setSelectedItem}
              isPinned={isPinned}
              t={t}
            />
          ) : (
            <MovieList
              paginatedMovies={paginatedMovies}
              handleSelectMovie={handleSelectMovie}
              t={t}
            />
          )}
        </div>

        {/* Pagination */}
        {(selectedMovie ? movieSubtitleItems.length : filteredMovies.length) > PER_PAGE && (
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>
              {listPage * PER_PAGE + 1}-
              {Math.min(
                (listPage + 1) * PER_PAGE,
                selectedMovie ? movieSubtitleItems.length : filteredMovies.length
              )}
              {" / "}
              {selectedMovie ? movieSubtitleItems.length : filteredMovies.length}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => dispatchFilter({ type: "SET_LIST_PAGE", payload: Math.max(0, listPage - 1) })}
                disabled={listPage === 0}
                className="ghost-border rounded p-1 transition-colors hover:bg-surface-container-high disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-2 tabular-nums">{currentPage} / {totalPages}</span>
              <button
                type="button"
                onClick={() => dispatchFilter({ type: "SET_LIST_PAGE", payload: Math.min(totalPages - 1, listPage + 1) })}
                disabled={listPage >= totalPages - 1}
                className="ghost-border rounded p-1 transition-colors hover:bg-surface-container-high disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
        {listPage >= totalPages - 1 && (selectedMovie ? movieSubtitleItems.length : filteredMovies.length) > 0 && (
          <p className="text-center text-[10px] text-on-surface-variant/50">
            — {(selectedMovie ? movieSubtitleItems.length : filteredMovies.length)} {t("files")} —
          </p>
        )}
      </section>

      {/* Right Panel: Preview + Actions */}
      <section className="col-span-12 flex flex-col gap-4 lg:col-span-8">
        <div className="ghost-border flex items-center justify-between rounded-xl bg-surface-container-high p-3 md:p-4">
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
                   ? `${t("quality_score")} ${selectedItem.score}分`
                   : t("select_file_panel")}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {selectedItem && (
              <>
                <button
                  type="button"
                  onClick={() => selectedItem && togglePin(selectedItem)}
                  className={`rounded p-1 transition-colors ${
                    selectedItem && isPinned(selectedItem)
                      ? "text-amber-400 bg-amber-400/10"
                      : "text-on-surface-variant hover:bg-surface-container-highest"
                  }`}
                  title={selectedItem && isPinned(selectedItem) ? t("unpin") : t("pin")}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <Star size={18} fill={selectedItem && isPinned(selectedItem) ? "currentColor" : "none"} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewName(getMovieName(selectedItem.file_path) + ".zh.srt");
                    setRenameError("");
                    setConfirmRename(true);
                  }}
                  className="rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container-highest"
                  title={t("rename")}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <FileText size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => { setRejectReason(null); setConfirmReject(true); }}
                  className="rounded p-1 text-error transition-colors hover:bg-error/10"
                  title={t("delete_subtitle_file")}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <Trash2 size={18} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Quality info when selected */}
        {selectedItem && <VerificationStats selectedItem={selectedItem} t={t} />}

        {/* Content preview area */}
        <div className="ghost-border flex min-h-[200px] md:min-h-[400px] flex-1 flex-col overflow-hidden rounded-xl bg-surface-container-lowest">
          {/* Chinese ratio progress bar */}
          <div className="relative h-1 w-full bg-surface-container-highest">
            {selectedItem && selectedItem.chinese_ratio > 0 && (
              <div
                className="absolute left-0 top-0 h-full bg-primary shadow-[0_0_8px_rgba(123,208,255,0.5)]"
                style={{ width: `${Math.round(selectedItem.chinese_ratio * 100)}%` }}
              />
            )}
          </div>

          <div className="flex flex-1 flex-col p-3 md:p-6">
            <SubtitlePreview
              selectedItem={selectedItem}
              previewContent={previewContent}
              previewEncoding={previewEncoding}
              previewLoading={previewLoading}
              previewPart={previewPart}
              setPreviewPart={setPreviewPart}
              PREVIEW_CHUNK={PREVIEW_CHUNK}
              t={t}
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-col items-center justify-between gap-4 border-t border-outline-variant/30 bg-surface-container-low p-6 md:flex-row">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setRejectReason("off_sync"); setConfirmReject(true); }}
                disabled={!selectedItem || isRejecting}
                className="flex items-center gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-highest px-4 py-2 text-sm font-bold text-on-surface transition-all hover:border-tertiary active:scale-95 disabled:opacity-50"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <Timer size={16} /> {t("off_sync")}
              </button>
              <button
                type="button"
                onClick={() => { setRejectReason("wrong_lang"); setConfirmReject(true); }}
                disabled={!selectedItem || isRejecting}
                className="flex items-center gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-highest px-4 py-2 text-sm font-bold text-on-surface transition-all hover:border-error active:scale-95 disabled:opacity-50"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <Languages size={16} /> {t("wrong_lang")}
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleMark("ok")}
              disabled={!selectedItem || isRejecting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-container px-8 py-3 font-bold text-white shadow-[0_4px_12px_rgba(0,164,220,0.4)] transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 md:w-auto"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <CheckCircle2 size={18} /> {t("confirm_verification")}
            </button>
          </div>
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="hidden justify-center gap-8 py-2 text-[10px] font-bold uppercase text-on-surface-variant/40 md:flex">
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

      {/* Reject Confirmation Dialog */}
      <ConfirmDialog
        open={confirmReject && !!selectedItem}
        onClose={() => setConfirmReject(false)}
        title={
          rejectReason === "off_sync"
            ? t("off_sync")
            : rejectReason === "wrong_lang"
            ? t("wrong_lang")
            : t("confirm_delete")
        }
        confirmLabel={rejectReason ? t("confirm") : t("delete")}
        cancelLabel={t("cancel")}
        loadingLabel={t("loading")}
        variant="danger"
        isLoading={isRejecting}
        onConfirm={handleReject}
      >
        {selectedItem && (
          <>
            <p className="mt-2 text-sm text-on-surface-variant">
              {rejectReason
                ? `${selectedItem.file_name} — ${t(rejectReason)}`
                : `${t("delete")} ${selectedItem.file_name}?`}
            </p>
            <p className="mt-1 text-xs text-error">{t("irreversible")}</p>
          </>
        )}
      </ConfirmDialog>

      {/* Delete All Confirmation */}
      <ConfirmDialog
        open={confirmDeleteAll && !!selectedMovie}
        onClose={() => setConfirmDeleteAll(false)}
        title={t("delete_all_subs")}
        confirmLabel={t("delete_all")}
        cancelLabel={t("cancel")}
        loadingLabel={t("loading")}
        variant="danger"
        isLoading={isDeletingAll}
        onConfirm={handleDeleteAll}
      >
        {selectedMovie && (
          <>
            <p className="mt-2 text-sm text-on-surface-variant">
              {t("delete")} &quot;{movieName}&quot; {t("delete_all")}?
            </p>
            <p className="mt-1 text-xs text-error">{t("irreversible")}</p>
          </>
        )}
      </ConfirmDialog>

      {/* Keep Only Confirmation */}
      <ConfirmDialog
        open={confirmKeepOnly && !!selectedMovie}
        onClose={() => setConfirmKeepOnly(false)}
        title={t("delete_unselected")}
        confirmLabel={t("confirm_delete")}
        cancelLabel={t("cancel")}
        loadingLabel={t("loading")}
        variant="danger"
        isLoading={isKeepingOnly}
        onConfirm={handleKeepOnly}
      >
        {selectedMovie && (
          <>
            <p className="mt-2 text-sm text-on-surface-variant">
              {t("delete_unselected")}: {items.filter(i => i.file_path === selectedMovie && !pinnedKeys.includes(`${i.file_path}/${i.file_name}`)).length}
              , {t("keep")}: {pinnedKeys.length}
            </p>
            <p className="mt-1 text-xs text-error">{t("irreversible")}</p>
          </>
        )}
      </ConfirmDialog>

      {/* Rename Dialog */}
      <ConfirmDialog
        open={confirmRename && !!selectedItem}
        onClose={() => setConfirmRename(false)}
        title={t("rename")}
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        loadingLabel={t("loading")}
        variant="default"
        isLoading={isRenaming}
        onConfirm={handleRename}
      >
        {selectedItem && (
          <>
            <p className="text-xs text-on-surface-variant">
              {t("current")} {selectedItem.file_name}
            </p>
            <input
              type="text"
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setRenameError(""); }}
              className="mt-3 w-full rounded-lg border border-outline-variant bg-surface-container-low p-2 text-sm text-on-surface focus:border-primary focus:outline-none"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
            />
            {renameError && (
              <p className="mt-2 text-xs text-error">{renameError}</p>
            )}
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}

export default withAuth(VerificationPage);
