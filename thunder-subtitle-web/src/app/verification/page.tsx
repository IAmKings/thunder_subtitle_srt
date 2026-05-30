"use client";

import { useState, useEffect, useCallback, useMemo, useReducer, useRef, startTransition } from "react";
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
import type { ReviewItem, MovieEntry } from "@/lib/types";
import { getMovieName } from "@/lib/utils";

// ---- Helpers ----

function getDisabledPaths(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem("thunder-subtitle-disabled-paths");
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
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
  movieListPage: number;
  subtitleListPage: number;
}

type FilterAction =
  | { type: "SET_SEARCH_QUERY"; payload: string }
  | { type: "SET_STATUS_FILTER"; payload: string | null }
  | { type: "SET_SORT_BY_SIZE"; payload: null | "desc" | "asc" }
  | { type: "SET_MOVIE_LIST_PAGE"; payload: number }
  | { type: "SET_SUBTITLE_LIST_PAGE"; payload: number }
  | { type: "RESET_FILTERS" };

const initialFilterState: FilterState = {
  searchQuery: "",
  statusFilter: null,
  sortBySize: null,
  movieListPage: 0,
  subtitleListPage: 0,
};

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case "SET_SEARCH_QUERY":
      return { ...state, searchQuery: action.payload, movieListPage: 0 };
    case "SET_STATUS_FILTER":
      return { ...state, statusFilter: action.payload, subtitleListPage: 0 };
    case "SET_SORT_BY_SIZE":
      return { ...state, sortBySize: action.payload, subtitleListPage: 0 };
    case "SET_MOVIE_LIST_PAGE":
      return { ...state, movieListPage: action.payload };
    case "SET_SUBTITLE_LIST_PAGE":
      return { ...state, subtitleListPage: action.payload };
    case "RESET_FILTERS":
      return { ...initialFilterState };
    default:
      return state;
  }
}

function VerificationPage() {
  const t = useTranslations();
  const { items, isLoading, error, selectedMovie, pinnedItems: pinnedKeys } = useVerificationState();
  const { setItems, setIsLoading, setError, setSelectedMovie, setPinnedItems, isPinned, togglePin } = useVerificationActions();
  const [movies, setMovies] = useState<MovieEntry[]>([]);
  const rehydratingRef = useRef(false);  // 防止 rehydration effect 与 handleSelectMovie 并发
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
  const [{ searchQuery, statusFilter, sortBySize, movieListPage, subtitleListPage }, dispatchFilter] = useReducer(filterReducer, initialFilterState);
  const PER_PAGE = 10;

  // ---- Dialog state ----
  const [confirmReject, setConfirmReject] = useState(false);
  const [rejectReason, setRejectReason] = useState<"off_sync" | "wrong_lang" | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [confirmMarkAllFail, setConfirmMarkAllFail] = useState(false);
  const [isMarkingAllFail, setIsMarkingAllFail] = useState(false);
  const [confirmKeepOnly, setConfirmKeepOnly] = useState(false);
  const [isKeepingOnly, setIsKeepingOnly] = useState(false);

  const loadReviews = useCallback(async (enabledDirsParam?: Array<{ path: string; name: string; movie_count: number }>) => {
    try {
      let enabledDirs = enabledDirsParam;
      if (!enabledDirs) {
        const dirs = await fastApiClient.listMediaDirectories();
        const disabled = getDisabledPaths();
        enabledDirs = dirs.filter((d) => !disabled.has(d.path));
      }
      if (enabledDirs.length === 0) {
        setMovies([]);
        setItems([]);
        setIsLoading(false);
        return;
      }
      setBaseDir(enabledDirs[0].path);

      // 轻量电影发现 — 每个目录独立容错，单个失败不阻塞其他目录
      const allMovies: MovieEntry[] = [];
      for (const dir of enabledDirs) {
        try {
          const result = await fastApiClient.listMovies(dir.path);
          allMovies.push(...result.movies);
        } catch (err) {
          console.warn(`Skipping directory due to error: ${dir.path}`, err);
        }
      }
      setMovies(allMovies);
      if (selectedMovie) {
        // 切 tab 回来后 selectedMovie 非空，保留 items 由 rehydration effect 刷新
        // 不清空 items，避免与 rehydration 竞态导致短暂空白
      } else {
        setItems([]); // 电影列表不预加载深审数据
      }
      setError(null); // 成功时清除残留错误
    } catch (err) {
      setError(err instanceof Error ? err.message : t("review_list_error"));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [setMovies, setItems, setIsLoading, setError, t]);

  useEffect(() => {
    fastApiClient.listMediaDirectories().then((dirs) => {
      const disabled = getDisabledPaths();
      const enabledDirs = dirs.filter((d) => !disabled.has(d.path));
      if (enabledDirs.length > 0) {
        setBaseDir(enabledDirs[0].path);
      }
      if (movies.length === 0) {
        startTransition(() => { loadReviews(enabledDirs); });
      } else {
        setIsLoading(false);
      }
    }).catch(() => {
      setIsLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切 tab 回来后自动恢复选中电影的字幕数据
  // 用 ref 防并发，避免 isLoading 放入依赖数组导致 effect 自毁
  useEffect(() => {
    if (!selectedMovie || movies.length === 0 || items.length > 0 || rehydratingRef.current) return;
    const movie = movies.find((m) => m.path === selectedMovie);
    if (!movie || movie.sub_files.length === 0) {
      setSelectedMovie(null);
      return;
    }
    rehydratingRef.current = true;
    setIsLoading(true);
    let cancelled = false;
    Promise.all(
      movie.sub_files.map((fname) =>
        fastApiClient.reviewSubtitleFile(baseDir, selectedMovie, fname).catch(() => null)
      )
    ).then((results) => {
      if (cancelled) return;
      const validItems = results.filter((r): r is ReviewItem => r !== null);
      setItems(validItems);
    }).catch((err) => {
      if (cancelled) return;
      console.warn("Failed to reload subtitle details:", err);
    }).finally(() => {
      if (!cancelled) {
        rehydratingRef.current = false;
        setIsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [selectedMovie, movies, items.length, baseDir, setSelectedMovie, setItems, setIsLoading]);

  // ---- Individual mark ----
  const handleMark = useCallback(
    async (status: "ok" | "fail") => {
      if (!selectedItem || !baseDir) return;
      const movieToRemove = selectedMovie;
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
        // 仅 API 成功后清除当前电影，避免失败时误清 UI 状态
        setSelectedMovie(null);
        setSelectedItem(null);
        setItems((prev) => prev.filter((i) => i.file_path !== movieToRemove));
        setMovies((prev) => prev.filter((m) => m.path !== movieToRemove));
      } catch (err) {
        setError(err instanceof Error ? err.message : t("mark_error"));
      }
    },
    [selectedItem, selectedMovie, baseDir, setError, setItems, setSelectedMovie, setMovies, t]
  );

  // ---- Delete all subtitles for current movie ----
  const handleDeleteAll = useCallback(async () => {
    if (!selectedMovie) return;
    setIsDeletingAll(true);
    try {
      const movieItems = items.filter((i) => i.file_path === selectedMovie);
      const results = await Promise.allSettled(
        movieItems.map((item) => fastApiClient.deleteSubtitleFile(`${item.file_path}/${item.file_name}`))
      );
      const failedCount = results.filter((r) => r.status === "rejected").length;
      // 即使部分删除失败也继续标记为 fail
      if (baseDir) {
        await fastApiClient.markReview(baseDir, selectedMovie, "fail");
      }
      setItems((prev) => prev.filter((i) => i.file_path !== selectedMovie));
      setMovies((prev) => prev.filter((m) => m.path !== selectedMovie));
      setSelectedItem(null);
      setSelectedMovie(null);
      setConfirmDeleteAll(false);
      if (failedCount > 0) {
        setError(`${t("delete_failed")}: ${failedCount}/${movieItems.length}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("delete_failed"));
    } finally {
      setIsDeletingAll(false);
    }
  }, [selectedMovie, items, setItems, setMovies, setError, baseDir, t, setSelectedMovie]);

  // ---- Mark all as fail without deleting files ----
  const handleMarkAllFail = useCallback(async () => {
    if (!selectedMovie || !baseDir) return;
    setIsMarkingAllFail(true);
    try {
      await fastApiClient.markReview(baseDir, selectedMovie, "fail");
      setItems((prev) => prev.filter((i) => i.file_path !== selectedMovie));
      setMovies((prev) => prev.filter((m) => m.path !== selectedMovie));
      setSelectedItem(null);
      setSelectedMovie(null);
      setConfirmMarkAllFail(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("mark_error"));
    } finally {
      setIsMarkingAllFail(false);
    }
  }, [selectedMovie, baseDir, setItems, setMovies, setError, t, setSelectedMovie]);

  // ---- Keep only pinned subtitles ----
  const handleKeepOnly = useCallback(async () => {
    if (!selectedMovie || pinnedKeys.length === 0) return;
    setIsKeepingOnly(true);
    const toDelete = items.filter(
      (i) => i.file_path === selectedMovie && !pinnedKeys.includes(`${i.file_path}/${i.file_name}`)
    );
    try {
      // Promise.allSettled：单个删除失败不阻塞其余，避免部分删除后状态不一致
      const results = await Promise.allSettled(
        toDelete.map((item) => fastApiClient.deleteSubtitleFile(`${item.file_path}/${item.file_name}`))
      );
      const succeeded = toDelete.filter((_, idx) => results[idx].status === "fulfilled");
      const failedCount = results.filter((r) => r.status === "rejected").length;
      // 仅移除成功删除的项
      if (succeeded.length > 0) {
        setItems((prev) =>
          prev.filter((i) => !succeeded.some((d) => d.file_path === i.file_path && d.file_name === i.file_name))
        );
      }
      setSelectedItem(null);
      setConfirmKeepOnly(false);
      if (failedCount > 0) {
        setError(`${t("delete_failed")}: ${failedCount}/${toDelete.length}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("delete_failed"));
    } finally {
      setIsKeepingOnly(false);
    }
  }, [selectedMovie, pinnedKeys, items, setItems, setError, t]);

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
      // Deduplicate: compute fullSorted once, then derive sorted from it
      const fullSorted = getFilteredAndSortedMovieItems(items, selectedMovie, statusFilter, sortBySize);
      const delIdx = fullSorted.findIndex((i) => i.file_name === deletedFile);
      const sorted = fullSorted.filter((i) => i.file_name !== deletedFile);
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
        dispatchFilter({ type: "SET_SUBTITLE_LIST_PAGE", payload: 0 });
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
      if (controller.signal.aborted) return;
      setPreviewContent(data.content);
      setPreviewEncoding(data.encoding);
      setPreviewLoading(false);
    }).catch((err: unknown) => {
      if (err instanceof DOMException && err.name === "AbortError") return;
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

  // ---- Movie grouping (from lightweight movies state, not items) ----
  const filteredMovies = useMemo(() => {
    if (!searchQuery.trim()) return movies;
    const q = searchQuery.trim().toLowerCase();
    return movies.filter((m) => m.name.toLowerCase().includes(q));
  }, [movies, searchQuery]);

  // ---- Subtitle-level filtering (for selected movie) ----
  const movieSubtitleItems = useMemo(() => {
    if (!selectedMovie) return [];
    return getFilteredAndSortedMovieItems(items, selectedMovie, statusFilter, sortBySize);
  }, [items, selectedMovie, statusFilter, sortBySize]);

  // ---- Pagination ----
  const totalMoviePages = Math.max(1, Math.ceil(filteredMovies.length / PER_PAGE));
  const paginatedMovies = filteredMovies.slice(movieListPage * PER_PAGE, (movieListPage + 1) * PER_PAGE);

  const totalSubtitlePages = Math.max(1, Math.ceil(movieSubtitleItems.length / PER_PAGE));
  const paginatedSubtitleItems = movieSubtitleItems.slice(subtitleListPage * PER_PAGE, (subtitleListPage + 1) * PER_PAGE);

  const currentPage = selectedMovie ? subtitleListPage + 1 : movieListPage + 1;
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
    setItems([]); // 返回电影列表时清除字幕深审数据
    // Only reset subtitle-level filters (status/sort/page), keep movie search query
    dispatchFilter({ type: "SET_STATUS_FILTER", payload: null });
    dispatchFilter({ type: "SET_SORT_BY_SIZE", payload: null });
    dispatchFilter({ type: "SET_SUBTITLE_LIST_PAGE", payload: 0 });
  }, [setSelectedMovie, setItems, dispatchFilter]);

  const handleBackToSubtitles = useCallback(() => {
    setSelectedItem(null);
    setPreviewContent(null);
    setPreviewPart(0);
  }, [setSelectedItem]);

  const handleSelectMovie = useCallback(async (filePath: string) => {
    setSelectedMovie(filePath);
    setSelectedItem(null);
    // 第一时间同步清空 pinnedItems，避免跨电影残留
    setPinnedItems([]);
    setItems([]);
    // Reset subtitle-level filters only, keep movie search query
    dispatchFilter({ type: "SET_STATUS_FILTER", payload: null });
    dispatchFilter({ type: "SET_SORT_BY_SIZE", payload: null });
    dispatchFilter({ type: "SET_SUBTITLE_LIST_PAGE", payload: 0 });

    // 按需深审当前电影的所有字幕文件
    const movie = movies.find((m) => m.path === filePath);
    if (!movie || movie.sub_files.length === 0) return;

    setIsLoading(true);
    try {
      const results = await Promise.all(
        movie.sub_files.map((fname) =>
          fastApiClient.reviewSubtitleFile(baseDir, filePath, fname).catch(() => null)
        )
      );
      const validItems = results.filter((r): r is ReviewItem => r !== null);
      setItems(validItems);
    } catch (err) {
      console.warn("Failed to load subtitle details:", err);
    } finally {
      setIsLoading(false);
    }
  }, [movies, baseDir, setSelectedMovie, setPinnedItems, setItems, setIsLoading, dispatchFilter]);

  return (
    <div className="grid grid-cols-12 gap-8 h-full">
      {/* Left Panel — hide on mobile when preview is open */}
      <section className={`col-span-12 flex flex-col gap-4 lg:col-span-4 ${selectedItem ? 'hidden lg:flex' : ''}`}>
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
            setListPage={(v) => dispatchFilter({ type: "SET_SUBTITLE_LIST_PAGE", payload: v })}
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
            setConfirmMarkAllFail={setConfirmMarkAllFail}
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
              {(selectedMovie ? subtitleListPage : movieListPage) * PER_PAGE + 1}-
              {Math.min(
                ((selectedMovie ? subtitleListPage : movieListPage) + 1) * PER_PAGE,
                selectedMovie ? movieSubtitleItems.length : filteredMovies.length
              )}
              {" / "}
              {selectedMovie ? movieSubtitleItems.length : filteredMovies.length}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const pageAction = selectedMovie
                    ? { type: "SET_SUBTITLE_LIST_PAGE" as const, payload: Math.max(0, subtitleListPage - 1) }
                    : { type: "SET_MOVIE_LIST_PAGE" as const, payload: Math.max(0, movieListPage - 1) };
                  dispatchFilter(pageAction);
                }}
                disabled={selectedMovie ? subtitleListPage === 0 : movieListPage === 0}
                className="ghost-border rounded p-1 transition-colors hover:bg-surface-container-high disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-2 tabular-nums">{currentPage} / {totalPages}</span>
              <button
                type="button"
                onClick={() => {
                  const pageAction = selectedMovie
                    ? { type: "SET_SUBTITLE_LIST_PAGE" as const, payload: Math.min(totalPages - 1, subtitleListPage + 1) }
                    : { type: "SET_MOVIE_LIST_PAGE" as const, payload: Math.min(totalPages - 1, movieListPage + 1) };
                  dispatchFilter(pageAction);
                }}
                disabled={selectedMovie ? subtitleListPage >= totalPages - 1 : movieListPage >= totalPages - 1}
                className="ghost-border rounded p-1 transition-colors hover:bg-surface-container-high disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
        {(selectedMovie ? subtitleListPage : movieListPage) >= totalPages - 1 && (selectedMovie ? movieSubtitleItems.length : filteredMovies.length) > 0 && (
          <p className="text-center text-[10px] text-on-surface-variant/50">
            — {(selectedMovie ? movieSubtitleItems.length : filteredMovies.length)} {t("files")} —
          </p>
        )}
      </section>

      {/* Right Panel: Preview + Actions — hide on mobile when nothing selected */}
      <section className={`col-span-12 flex flex-col gap-4 lg:col-span-8 ${!selectedItem ? 'hidden lg:flex' : ''}`}>
        <div className="ghost-border flex items-center justify-between rounded-xl bg-surface-container-high p-3 md:p-4">
          <div className="flex items-center gap-4">
            {/* Mobile back button (lg:hidden) */}
            <button
              type="button"
              onClick={handleBackToSubtitles}
              className="lg:hidden rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-highest transition-colors"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <ArrowLeft size={20} />
            </button>
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

      {/* Mark All Fail Confirmation */}
      <ConfirmDialog
        open={confirmMarkAllFail && !!selectedMovie}
        onClose={() => setConfirmMarkAllFail(false)}
        title={t("mark_all_fail")}
        confirmLabel={t("mark_all_fail")}
        cancelLabel={t("cancel")}
        loadingLabel={t("loading")}
        variant="default"
        isLoading={isMarkingAllFail}
        onConfirm={handleMarkAllFail}
      >
        {selectedMovie && (
          <p className="mt-2 text-sm text-on-surface-variant">
            {t("mark_all_fail_confirm")}
          </p>
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
