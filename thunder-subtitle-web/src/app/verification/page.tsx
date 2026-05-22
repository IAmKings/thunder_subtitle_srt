"use client";

import { useState, useEffect, useCallback, useMemo, startTransition } from "react";
import {
  CheckSquare as VerificationIcon,
  CheckCircle,
  Timer,
  Languages,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Trash2,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { fastApiClient } from "@/lib/api";
import { withAuth } from "@/lib/auth";
import { useVerificationState, useVerificationActions } from "@/lib/verification-state";
import type { ReviewItem, ReviewState } from "@/lib/types";

// ---- Helpers ----

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

function getMovieName(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1] || filePath;
}

function VerificationPage() {
  const t = useTranslations();
  const { items, isLoading, error, selectedMovie } = useVerificationState();
  const { setItems, setIsLoading, setError, setSelectedMovie } = useVerificationActions();
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [markingPath, setMarkingPath] = useState<string | null>(null);
  const [baseDir, setBaseDir] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLines, setPreviewLines] = useState(0);
  const [previewEncoding, setPreviewEncoding] = useState("");
  const PREVIEW_CHUNK = 200;
  const [previewPart, setPreviewPart] = useState(0); // 0=first, 1=20%, 2=40%, 3=60%, 4=last
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmRename, setConfirmRename] = useState(false);
  const [newName, setNewName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState("");

  // ---- Filter state ----
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [listPage, setListPage] = useState(0);
  // null = no sort, "desc" = largest first, "asc" = smallest first
  const [sortBySize, setSortBySize] = useState<null | "desc" | "asc">(null);
  const PER_PAGE = 10;

  // Load disabled paths from localStorage
  function getDisabledPaths(): Set<string> {
    try {
      const raw = localStorage.getItem("thunder-disabled-paths");
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

  // Load on mount (only once -- state persists across tabs)
  useEffect(() => {
    if (items.length === 0 && isLoading) {
      startTransition(() => {
        loadReviews();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Individual mark ----
  const handleMark = useCallback(
    async (status: "ok" | "fail") => {
      if (!selectedItem || !baseDir) return;
      setMarkingPath(`${selectedItem.file_path}/${selectedItem.file_name}`);
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
      } finally {
        setMarkingPath(null);
      }
    },
    [selectedItem, baseDir, setError, setItems, t]
  );

  // ---- Batch mark for current movie ----
  const [isBatchMarking, setIsBatchMarking] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const handleBatchMark = useCallback(
    async (status: "ok" | "fail") => {
      if (!selectedMovie || !baseDir) return;
      setIsBatchMarking(true);
      try {
        const movieItems = items.filter((i) => i.file_path === selectedMovie);
        for (const item of movieItems) {
          await fastApiClient.markReview(baseDir, item.file_path, status);
        }
        setItems((prev) =>
          prev.map((item) =>
            item.file_path === selectedMovie
              ? { ...item, review_status: status, review_date: new Date().toISOString().split("T")[0] }
              : item
          )
        );
        // Clear selected item after batch operation
        setSelectedItem(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("mark_error"));
      } finally {
        setIsBatchMarking(false);
      }
    },
    [selectedMovie, baseDir, items, setError, setItems, t]
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
      setItems((prev) => prev.filter((i) => i.file_path !== selectedMovie));
      setSelectedItem(null);
      setSelectedMovie(null);
      setConfirmDeleteAll(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setIsDeletingAll(false);
    }
  }, [selectedMovie, items, setItems, setError]);

  // ---- Unified reject: delete file, optionally mark fail, jump to next ----
  const [confirmReject, setConfirmReject] = useState(false);
  const [rejectReason, setRejectReason] = useState<"off_sync" | "wrong_lang" | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);

  const handleReject = useCallback(async () => {
    if (!selectedItem || !selectedMovie) return;
    setIsRejecting(true);
    const deletedFile = selectedItem.file_name;
    try {
      const subtitlePath = `${selectedItem.file_path}/${selectedItem.file_name}`;
      await fastApiClient.deleteSubtitleFile(subtitlePath);

      // Remove from items
      const remaining = items.filter(
        (i) => !(i.file_path === selectedMovie && i.file_name === deletedFile)
      );

      // Find next/prev in current movie after removal
      const movieItems = remaining.filter((i) => i.file_path === selectedMovie);
      const nextItem = movieItems.length > 0 ? movieItems[0] : null;

      if (movieItems.length === 0) {
        // Last subtitle: mark fail if rejected, go back to movie list
        if (rejectReason !== null && baseDir) {
          await fastApiClient.markReview(baseDir, selectedMovie, "fail");
        }
        setItems(remaining);
        setSelectedMovie(null);
      } else {
        setItems(remaining);
        setSelectedItem(nextItem);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setIsRejecting(false);
      setConfirmReject(false);
    }
  }, [selectedItem, selectedMovie, baseDir, rejectReason, items, setItems, setError]);

  // ---- Rename subtitle file ----
  const handleRename = useCallback(async () => {
    if (!selectedItem || !newName.trim()) return;
    setIsRenaming(true);
    setRenameError("");
    try {
      const subtitlePath = `${selectedItem.file_path}/${selectedItem.file_name}`;
      const result = await fastApiClient.renameSubtitleFile(subtitlePath, newName.trim());
      setItems((prev) => prev.map((i) =>
        i.file_path === selectedItem.file_path && i.file_name === selectedItem.file_name
          ? { ...i, file_name: newName.trim() }
          : i
      ));
      setSelectedItem((prev) => prev ? { ...prev, file_name: newName.trim() } : null);
      setConfirmRename(false);
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : "重命名失败");
    } finally {
      setIsRenaming(false);
    }
  }, [selectedItem, newName, setItems]);

  // ---- Preview loading ----
  useEffect(() => {
    if (!selectedItem) {
      setPreviewContent(null);
      setPreviewLines(0);
      setPreviewPart(0);
      setPreviewEncoding("");
      setPreviewLoading(false);
      return;
    }

    const subtitlePath = `${selectedItem.file_path}/${selectedItem.file_name}`;
    setPreviewLoading(true);

    const controller = new AbortController();

    fastApiClient.getSubtitlePreview(subtitlePath, controller.signal).then((data) => {
      setPreviewContent(data.content);
      setPreviewLines(data.total_lines);
      setPreviewEncoding(data.encoding);
      setPreviewLoading(false);
    }).catch(() => {
      setPreviewContent(null);
      setPreviewLines(0);
      setPreviewEncoding("");
      setPreviewLoading(false);
    });

    return () => {
      controller.abort();
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
    let list = items.filter((i) => i.file_path === selectedMovie);
    if (statusFilter) {
      list = list.filter((i) => i.review_status === statusFilter);
    }
    if (sortBySize === "desc") {
      list = [...list].sort((a, b) => b.size_bytes - a.size_bytes);
    } else if (sortBySize === "asc") {
      list = [...list].sort((a, b) => a.size_bytes - b.size_bytes);
    }
    return list;
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

  // ---- Back handler ----
  const handleBack = useCallback(() => {
    setSelectedMovie(null);
    setSelectedItem(null);
    setStatusFilter(null);
    setSortBySize(null);
    setSearchQuery("");
    setListPage(0);
  }, []);

  // ---- Select movie handler ----
  const handleSelectMovie = useCallback((filePath: string) => {
    setSelectedMovie(filePath);
    setSelectedItem(null);
    setStatusFilter(null);
    setSortBySize(null);
    setSearchQuery("");
    setListPage(0);
  }, []);

  return (
    <div className="grid grid-cols-12 gap-8 h-full">
      {/* Left Panel */}
      <section className="col-span-12 flex flex-col gap-4 lg:col-span-4">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            {selectedMovie ? (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <ArrowLeft size={20} />
              </button>
            ) : (
              <VerificationIcon className="text-primary" size={20} />
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
              title={t("refresh") ?? "刷新"}
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

        {/* Level 1: Search input (movies) */}
        {!selectedMovie && (
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setListPage(0); }}
              placeholder={t("search_placeholder") ?? "搜索电影..."}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-low py-2.5 pl-3 pr-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none"
            />
          </div>
        )}

        {/* Level 2: Status filter chips + size sort (subtitles) */}
        {selectedMovie && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { setSortBySize(sortBySize === null ? "desc" : sortBySize === "desc" ? "asc" : null); setListPage(0); }}
              className={`rounded-lg px-2 py-1 text-[10px] font-bold transition-all ${
                sortBySize !== null ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant hover:bg-outline-variant"
              }`}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {t("size")}{sortBySize === "desc" ? " ↓" : sortBySize === "asc" ? " ↑" : ""}
            </button>
            <div className="flex flex-wrap gap-1 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => { setStatusFilter(null); setListPage(0); }}
                className={`rounded-full px-2 py-0.5 transition-all ${statusFilter === null ? "bg-primary text-on-primary" : "bg-on-surface-variant/15 text-on-surface-variant"}`}
              >
                {t("all_status")} {visibleItems.length}
              </button>
              <button
                type="button"
                onClick={() => { setStatusFilter(statusFilter === "not_reviewed" ? null : "not_reviewed"); setListPage(0); }}
                className={`rounded-full px-2 py-0.5 transition-all ${statusFilter === "not_reviewed" ? "bg-primary text-on-primary" : "bg-on-surface-variant/15 text-on-surface-variant"}`}
              >
                {t("untagged")} {unreviewedCount}
              </button>
              <button
                type="button"
                onClick={() => { setStatusFilter(statusFilter === "ok" ? null : "ok"); setListPage(0); }}
                className={`rounded-full px-2 py-0.5 transition-all ${statusFilter === "ok" ? "bg-green-500 text-on-primary" : "bg-green-500/15 text-green-400"}`}
              >
                ✓ {okCount}
              </button>
              <button
                type="button"
                onClick={() => { setStatusFilter(statusFilter === "fail" ? null : "fail"); setListPage(0); }}
                className={`rounded-full px-2 py-0.5 transition-all ${statusFilter === "fail" ? "bg-error text-on-primary" : "bg-error/15 text-error"}`}
              >
                ✗ {failCount}
              </button>
            </div>
          </div>
        )}

        {/* Level 2: Batch action bar */}
        {selectedMovie && (
          <div className="flex items-center gap-2 border-b border-outline-variant/20 pb-2">
            <button
              type="button"
              onClick={() => handleBatchMark("ok")}
              disabled={isBatchMarking}
              className="flex items-center gap-1.5 rounded-lg bg-green-500/15 px-3 py-1.5 text-[10px] font-bold text-green-400 transition-all hover:bg-green-500/25 active:scale-95 disabled:opacity-50"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {isBatchMarking ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
              {t("all_pass")}
            </button>
            <button
              type="button"
              onClick={() => handleBatchMark("fail")}
              disabled={isBatchMarking}
              className="flex items-center gap-1.5 rounded-lg bg-error/15 px-3 py-1.5 text-[10px] font-bold text-error transition-all hover:bg-error/25 active:scale-95 disabled:opacity-50"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {isBatchMarking ? <Loader2 size={12} className="animate-spin" /> : <Timer size={12} />}
              {t("all_fail")}
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setConfirmDeleteAll(true)}
              disabled={isBatchMarking}
              className="flex items-center gap-1.5 rounded-lg bg-error/10 px-3 py-1.5 text-[10px] font-bold text-error transition-all hover:bg-error/20 active:scale-95 disabled:opacity-50"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <Trash2 size={12} /> 全部删除
            </button>
          </div>
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
          {selectedMovie
            /* Level 2: Subtitle items for selected movie */
            ? paginatedSubtitleItems.map((item, i) => (
                <button
                  key={`${i}-${item.file_path}-${item.file_name}`}
                  type="button"
                  onClick={() => setSelectedItem(item)}
                  className={`rounded-lg border p-4 text-left transition-all hover:border-primary/50 ${
                    selectedItem?.file_name === item.file_name && selectedItem?.file_path === item.file_path
                      ? "border-primary bg-primary/5 border-l-4 shadow-sm"
                      : "border-outline-variant/30 bg-surface-container"
                  }`}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{item.file_name}</p>
                      <p className="mt-1 truncate text-[10px] text-on-surface-variant">{item.file_path}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                        item.score >= 80 ? "bg-green-500/15 text-green-400"
                        : item.score >= 60 ? "bg-tertiary/15 text-tertiary"
                        : "bg-error/15 text-error"
                      }`}>
                        {item.score || "—"}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${getReviewStatusColor(item.review_status)}`}>
                        {item.review_status}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-on-surface-variant">
                    <div className="flex items-center gap-4">
                    {(
                      <>
                        <span>{t("match")}: {Math.round(item.chinese_ratio * 100)}%</span>
                        {item.encoding && <span>{item.encoding}</span>}
                      </>
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
                </button>
              ))
            /* Level 1: Movie group cards */
            : paginatedMovies.map(([filePath, movieItems], i) => (
                <button
                  key={`${i}-${filePath}`}
                  type="button"
                  onClick={() => handleSelectMovie(filePath)}
                  className="rounded-lg border border-outline-variant/30 bg-surface-container p-5 text-left transition-all hover:border-primary/50"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-bold">{getMovieName(filePath)}</p>
                      <p className="mt-1 truncate text-[11px] text-on-surface-variant">{filePath}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold text-primary">
                        {movieItems.length} {t("files")}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[10px] text-on-surface-variant">
                    <span className="text-green-400">✓ {movieItems.filter(i => i.review_status === "ok").length}</span>
                    <span className="text-error">✗ {movieItems.filter(i => i.review_status === "fail").length}</span>
                    <span>{t("untagged")}: {movieItems.filter(i => i.review_status === "not_reviewed").length}</span>
                  </div>
                </button>
              ))}
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
                onClick={() => setListPage((p) => Math.max(0, p - 1))}
                disabled={listPage === 0}
                className="ghost-border rounded p-1 transition-colors hover:bg-surface-container-high disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-2 tabular-nums">{currentPage} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setListPage((p) => Math.min(totalPages - 1, p + 1))}
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
                  onClick={() => {
                    setNewName(getMovieName(selectedItem.file_path) + ".zh.srt");
                    setRenameError("");
                    setConfirmRename(true);
                  }}
                  className="rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container-highest"
                  title="重命名"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <FileText size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => { setRejectReason(null); setConfirmReject(true); }}
                  className="rounded p-1 text-error transition-colors hover:bg-error/10"
                  title="删除字幕文件"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <Trash2 size={18} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Quality info when selected */}
        {selectedItem && (
          <div className="grid grid-cols-3 gap-4">
            <div className="ghost-border rounded-lg bg-surface-container p-4 text-center">
              <p className="text-[10px] font-bold uppercase text-on-surface-variant">{t("quality_score")}</p>
              <p className={`mt-1 text-2xl font-bold ${selectedItem.score >= 80 ? "text-green-400" : selectedItem.score >= 60 ? "text-tertiary" : "text-error"}`}>
                {selectedItem.score || "—"}
              </p>
            </div>
            <div className="ghost-border rounded-lg bg-surface-container p-4 text-center">
              <p className="text-[10px] font-bold uppercase text-on-surface-variant">{t("match")}</p>
              <p className="mt-1 text-2xl font-bold text-primary">
                {Math.round(selectedItem.chinese_ratio * 100)}%
              </p>
            </div>
            <div className="ghost-border rounded-lg bg-surface-container p-4 text-center">
              <p className="text-[10px] font-bold uppercase text-on-surface-variant">{t("format_encoding_short")}</p>
              <p className="mt-1 text-xs font-bold text-on-surface truncate" title={selectedItem.encoding || t("unknown_encoding")}>
                {selectedItem.encoding || t("unknown_encoding")}
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

          <div className="flex flex-1 flex-col p-6">
            {selectedItem && previewLoading && (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 size={24} className="animate-spin text-primary" />
              </div>
            )}

            {selectedItem && !previewLoading && previewContent !== null && (() => {
              const allLines = previewContent.split("\n");
              const total = allLines.length;
              let start = 0;
              if (previewPart === 1) start = Math.floor(total * 0.2);
              else if (previewPart === 2) start = Math.floor(total * 0.4);
              else if (previewPart === 3) start = Math.floor(total * 0.6);
              else if (previewPart === 4) start = Math.max(0, total - PREVIEW_CHUNK);
              const chunkLines = allLines.slice(start, start + PREVIEW_CHUNK);
              const currentCount = chunkLines.length;
              return (
              <div className="flex flex-1 flex-col">
                <div className="flex flex-wrap gap-1 pb-2">
                  {[0, 1, 2, 3, 4].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPreviewPart(p)}
                      className={`rounded px-2 py-0.5 text-[10px] font-bold transition-all ${
                        previewPart === p
                          ? "bg-primary text-on-primary"
                          : "bg-surface-container-high text-on-surface-variant hover:bg-outline-variant"
                      }`}
                    >
                      Part {p + 1}
                    </button>
                  ))}
                </div>
                <pre className="min-h-0 flex-1 overflow-y-auto rounded bg-black/20 p-3 font-mono text-xs text-on-surface leading-relaxed" style={{ maxHeight: "30vh" }}>
                  {chunkLines.join("\n") || " "}
                </pre>
                <p className="mt-2 text-right text-[10px] text-on-surface-variant">
                  {start + 1}-{start + currentCount} / {total}
                </p>
              </div>
              );
            })()}

            {selectedItem && !previewLoading && previewContent === null && (
              <div className="flex flex-1 items-center justify-center font-mono">
                <div className="space-y-2 text-sm">
                  <p className="text-on-surface-variant">
                    {t("format_encoding_short")} {selectedItem.encoding || "UTF-8"}
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
              </div>
            )}

            {!selectedItem && (
              <div className="flex flex-1 items-center justify-center font-mono">
                <p className="text-on-surface-variant">
                  {t("subtitle_preview_here")}
                </p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col items-center justify-between gap-4 border-t border-outline-variant/30 bg-surface-container-low p-6 sm:flex-row">
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

      {/* Unified Reject / Delete Confirmation */}
      {confirmReject && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setConfirmReject(false)}>
          <div className="mx-4 w-full max-w-sm rounded-xl bg-surface-container-high p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">
              {!rejectReason ? "确认删除" : rejectReason === "off_sync" ? "画音不同步" : "语言错误"}
            </h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              {!rejectReason
                ? `确定要删除 ${selectedItem.file_name} 吗？`
                : `确定标记 ${selectedItem.file_name} 为${rejectReason === "off_sync" ? "画音不同步" : "语言错误"}并删除吗？`}
            </p>
            <p className="mt-1 text-xs text-error">此操作不可撤销。</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmReject(false)}
                disabled={isRejecting}
                className="rounded-lg border border-outline px-4 py-2 text-xs font-bold transition-colors hover:bg-surface-container-high"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={isRejecting}
                className="rounded-lg bg-error px-4 py-2 text-xs font-bold text-on-primary transition-all hover:brightness-110 disabled:opacity-50"
              >
                {isRejecting ? t("loading") : !rejectReason ? "删除" : "确认"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Confirmation */}
      {confirmDeleteAll && selectedMovie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setConfirmDeleteAll(false)}>
          <div className="mx-4 w-full max-w-sm rounded-xl bg-surface-container-high p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">删除全部字幕</h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              确定要删除 <span className="font-bold text-on-surface">{getMovieName(selectedMovie)}</span> 的全部字幕文件吗？此操作不可撤销。
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteAll(false)}
                disabled={isDeletingAll}
                className="rounded-lg border border-outline px-4 py-2 text-xs font-bold transition-colors hover:bg-surface-container-high"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleDeleteAll}
                disabled={isDeletingAll}
                className="rounded-lg bg-error px-4 py-2 text-xs font-bold text-on-primary transition-all hover:brightness-110 disabled:opacity-50"
              >
                {isDeletingAll ? t("loading") : "全部删除"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Dialog */}
      {confirmRename && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setConfirmRename(false)}>
          <div className="mx-4 w-full max-w-sm rounded-xl bg-surface-container-high p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">重命名</h3>
            <p className="mt-1 text-xs text-on-surface-variant">
              当前: {selectedItem.file_name}
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
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmRename(false)}
                disabled={isRenaming}
                className="rounded-lg border border-outline px-4 py-2 text-xs font-bold transition-colors hover:bg-surface-container-high"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleRename}
                disabled={isRenaming || !newName.trim()}
                className="rounded-lg bg-primary-container px-4 py-2 text-xs font-bold text-on-primary-container transition-all hover:brightness-110 disabled:opacity-50"
              >
                {isRenaming ? t("loading") : "确认"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default withAuth(VerificationPage);
