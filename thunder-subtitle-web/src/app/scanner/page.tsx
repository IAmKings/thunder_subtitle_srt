"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Play,
  RefreshCw as SyncIcon,
  StopCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
  Film,
  CheckCircle,
  X,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { fastApiClient, ProgressWebSocket } from "@/lib/api";
import { withAuth } from "@/lib/auth";
import { useScannerState, useScannerActions } from "@/lib/scanner-state";
import type { ScanResultItem } from "@/lib/types";
import { StatusBadge, DryStateBadge, getStatusColor, getDryStateColor } from "@/components/StatusBadge";

// ---- Helpers ----

function getStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle size={16} className="text-green-400" />;
    case "running":
      return <SyncIcon size={16} className="animate-spin text-primary" />;
    case "failed":
      return <XCircle size={16} className="text-error" />;
    case "cancelled":
      return <AlertTriangle size={16} className="text-tertiary" />;
    default:
      return <AlertTriangle size={16} className="text-on-surface-variant" />;
  }
}

function statusLabel(status: string, t: (key: string) => string): string {
  switch (status) {
    case "downloaded": return t("status_downloaded");
    case "skipped": return t("status_skipped");
    case "no_match": return t("status_no_match");
    default: return t("status_error");
  }
}

function dryStateLabel(dryState: string, t: (key: string) => string): string {
  switch (dryState) {
    case "need_download": return t("dry_need_download");
    case "need_review": return t("dry_need_review");
    case "reviewed_ok": return t("dry_reviewed_ok");
    case "reviewed_fail": return t("dry_reviewed_fail");
    default: return dryState;
  }
}

function ScannerPage() {
  const t = useTranslations();

  // Persistent state (Context — survives tab switches)
  const {
    mediaDirs, config, activeTask, progress, findings,
    scanMode, filterKeywords, isLoadingDirs, isStartingScan,
  } = useScannerState();
  const {
    setMediaDirs, setConfig, setActiveTask, setProgress, setFindings,
    setScanMode, setFilterKeywords, setIsLoadingDirs, setIsStartingScan,
    disabledPaths, togglePathDisabled,
  } = useScannerActions();

  // Local state (page-only)
  const [error, setError] = useState<string | null>(null);
  const [mediaPathsInput, setMediaPathsInput] = useState("");
  const [isEditingPaths, setIsEditingPaths] = useState(false);
  const [isSavingPaths, setIsSavingPaths] = useState(false);
  const [savePathsError, setSavePathsError] = useState<string | null>(null);

  // Path carousel state
  const pathScrollRef = useRef<HTMLDivElement>(null);
  const [pathScrollIdx, setPathScrollIdx] = useState(0);
  const CARDS_PER_VIEW = 2;

  // Results table pagination
  const RESULTS_PER_PAGE = 10;
  const [resultsPage, setResultsPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const statusFilterOptions = [null, "downloaded", "skipped", "no_match", "error"] as const;
  const [detailItem, setDetailItem] = useState<ScanResultItem | null>(null);
  const [scanTotal, setScanTotal] = useState(0);

  // Load media directories + config
  useEffect(() => {
    async function loadDirs() {
      try {
        const [dirs, cfg] = await Promise.all([
          fastApiClient.listMediaDirectories(),
          fastApiClient.getConfig(),
        ]);
        setMediaDirs(dirs);
        setConfig(cfg);
        setMediaPathsInput(cfg.media_paths);
      } catch {
        setError(t("failed_load_dirs"));
      } finally {
        setIsLoadingDirs(false);
      }
    }
    loadDirs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check for running tasks on mount
  useEffect(() => {
    async function checkRunning() {
      try {
        const result = await fastApiClient.listTasks("running");
        if (result.tasks.length > 0) {
          setActiveTask(result.tasks[0]);
          setProgress(result.tasks[0].progress);
        }
        // Also check pending
        const pending = await fastApiClient.listTasks("pending");
        if (pending.tasks.length > 0 && !result.tasks.length) {
          setActiveTask(pending.tasks[0]);
        }
      } catch {
        // Ignore — may not be authenticated yet
      }
    }
    checkRunning();
  }, []);

  // Poll task progress when active
  useEffect(() => {
    if (!activeTask || activeTask.status === "completed" || activeTask.status === "failed" || activeTask.status === "cancelled") {
      return;
    }

    const taskId = activeTask.id;

    const interval = setInterval(async () => {
      try {
        const task = await fastApiClient.getTask(taskId);
        setActiveTask(task);
        setProgress(task.progress);
        if (task.status === "completed" || task.status === "failed" || task.status === "cancelled") {
          clearInterval(interval);
        }
      } catch {
        // Polling timeout — keep retrying, don't clear interval
      }
    }, 3000);

    // Also connect WebSocket for real-time updates
    const ws = new ProgressWebSocket();
    ws.connect(taskId, (data: unknown) => {
      const update = data as {
        progress?: number;
        message?: string;
        status?: string;
        result?: ScanResultItem;
        total?: number;
      };
      if (update.total !== undefined && update.total > 0) {
        setScanTotal(update.total);
      }
      if (update.progress !== undefined) {
        setProgress(update.progress);
      }
      // Append per-movie result for progressive display
      if (update.result && update.status !== "completed") {
        setFindings((prev) => {
          // Avoid duplicates by movie_name
          if (prev.some((f) => f.movie_name === update.result!.movie_name)) {
            return prev;
          }
          return [update.result!, ...prev];
        });
      }
      if (update.status === "completed" || update.status === "failed" || update.status === "cancelled") {
        // Final state — do a final poll to get all results
        fastApiClient.getTask(taskId).then((task) => {
          setActiveTask(task);
          setProgress(task.progress);
          // If task has stored results, use those (more complete than WebSocket stream)
          if (task.results && Array.isArray(task.results)) {
            const results = task.results as ScanResultItem[];
            setFindings(results);
          }
        }).catch(() => {});
        ws.disconnect();
      }
    });

    return () => {
      clearInterval(interval);
      ws.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTask?.id, activeTask?.status]);

  const handleSavePaths = useCallback(async () => {
    setIsSavingPaths(true);
    setSavePathsError(null);
    try {
      const updated = await fastApiClient.updateConfig({ media_paths: mediaPathsInput });
      setConfig(updated);
      setIsEditingPaths(false);
      // Refresh directories list to reflect updated paths
      const dirs = await fastApiClient.listMediaDirectories();
      setMediaDirs(dirs);
    } catch (err) {
      setSavePathsError(err instanceof Error ? err.message : t("failed_save_paths"));
    } finally {
      setIsSavingPaths(false);
    }
  }, [mediaPathsInput, t]);

  const handleCancelEditPaths = useCallback(() => {
    setMediaPathsInput(config?.media_paths ?? "");
    setIsEditingPaths(false);
    setSavePathsError(null);
  }, [config]);

  const handleScanNow = useCallback(async () => {
    if (isStartingScan) return;
    setIsStartingScan(true);
    setError(null);
    setFindings([]);
    setResultsPage(0);
    setScanTotal(0);

    try {
      // Pass ALL configured paths + optional keyword filters
      const allPaths = mediaDirs
        .filter((d) => !disabledPaths.has(d.path))
        .map((d) => d.path);
      const filters = filterKeywords.trim();
      const params: Record<string, unknown> = { mode: scanMode };
      if (allPaths.length > 0) {
        params.paths = allPaths;
      }
      if (filters) {
        // Split by space or comma for multi-keyword support
        params.filters = filters.split(/[ ,]+/).filter(Boolean);
      }
      const task = await fastApiClient.createTask("scan", params);
      setActiveTask(task);
      setProgress(0);
    } catch (err) {
      // Check if a running/pending task already exists (e.g. from before refresh)
      try {
        const running = await fastApiClient.listTasks("running");
        if (running.tasks.length > 0) {
          setActiveTask(running.tasks[0]);
          setProgress(running.tasks[0].progress);
          return;
        }
      } catch { /* ignore */ }
      setError(err instanceof Error ? err.message : t("failed_start_scan"));
    } finally {
      setIsStartingScan(false);
    }
  }, [isStartingScan, mediaDirs, filterKeywords, scanMode, disabledPaths, t]);

  const handleCancelTask = useCallback(async () => {
    if (!activeTask) return;
    try {
      const task = await fastApiClient.cancelTask(activeTask.id);
      setActiveTask(task);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failed_cancel_task"));
    }
  }, [activeTask, t]);

  const isRunning = activeTask?.status === "running" || activeTask?.status === "pending";
  const totalFiles = mediaDirs.reduce((sum, d) => sum + d.movie_count, 0);

  // Sort findings: error first, then no_match, skipped, downloaded
  const statusOrder: Record<string, number> = {
    error: 0,
    no_match: 1,
    skipped: 2,
    downloaded: 3,
  };
  const sortedFindings = useMemo(() => {
    let list = [...findings].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
    if (statusFilter) {
      list = list.filter((f) => f.status === statusFilter);
    }
    return list;
  }, [findings, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(sortedFindings.length / RESULTS_PER_PAGE));
  const paginatedFindings = useMemo(
    () => sortedFindings.slice(resultsPage * RESULTS_PER_PAGE, (resultsPage + 1) * RESULTS_PER_PAGE),
    [sortedFindings, resultsPage]
  );

  // Summary counts from scan results
  const scanSummary = useMemo(() => {
    const counts = { downloaded: 0, skipped: 0, no_match: 0, error: 0 };
    for (const f of findings) {
      if (f.status in counts) {
        counts[f.status as keyof typeof counts]++;
      }
    }
    return counts;
  }, [findings]);

  const scrollPaths = useCallback((dir: "left" | "right") => {
    const el = pathScrollRef.current;
    if (!el) return;
    const cardWidth = el.scrollWidth / mediaDirs.length;
    const newIdx = dir === "left"
      ? Math.max(0, pathScrollIdx - CARDS_PER_VIEW)
      : Math.min(mediaDirs.length - CARDS_PER_VIEW, pathScrollIdx + CARDS_PER_VIEW);
    el.scrollTo({ left: newIdx * cardWidth, behavior: "smooth" });
    setPathScrollIdx(newIdx);
  }, [mediaDirs.length, pathScrollIdx]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      {/* Stats Cards */}
      <section className="space-y-4">
        {/* Path Carousel Row */}
        <div className="flex items-stretch gap-4">
          {mediaDirs.length > CARDS_PER_VIEW && (
            <button
              type="button"
              onClick={() => scrollPaths("left")}
              disabled={pathScrollIdx === 0}
              className="flex-shrink-0 rounded-lg border border-outline-variant/30 bg-surface-container p-2 transition-colors hover:bg-surface-container-high disabled:opacity-30"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <div
            ref={pathScrollRef}
            className="flex flex-1 gap-4 overflow-hidden"
          >
            {mediaDirs.length > 0 ? (
              mediaDirs.map((dir, i) => (
                <div
                  key={`${i}-${dir.path}`}
                  className="ghost-border flex w-[calc(50%-0.5rem)] flex-shrink-0 items-center justify-between rounded-xl bg-surface-container p-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      {t("library_path")}
                    </p>
                    <h2 className={`truncate text-lg font-bold ${disabledPaths.has(dir.path) ? "text-on-surface-variant/40 line-through" : ""}`} title={dir.path}>{dir.path}</h2>
                  </div>
                  <div className="ml-2 flex flex-shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => togglePathDisabled(dir.path)}
                      disabled={isRunning}
                      className={`rounded-lg px-2 py-2 text-xs font-bold transition-all ${
                        disabledPaths.has(dir.path)
                          ? "bg-surface-container-high text-on-surface-variant/50"
                          : "bg-green-500/15 text-green-400"
                      } disabled:cursor-not-allowed`}
                      title={disabledPaths.has(dir.path) ? "启用" : "禁用"}
                      style={{ WebkitTapHighlightColor: "transparent" }}
                    >
                      {disabledPaths.has(dir.path) ? "OFF" : "ON"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingPaths(true)}
                      className="rounded-lg bg-surface-container-high px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-outline-variant"
                      title={t("edit_paths")}
                    >
                      {t("edit_paths")}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="ghost-border flex flex-1 items-center justify-between rounded-xl bg-surface-container p-6">
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    {t("library_path")}
                  </p>
                  <h2 className="text-lg font-bold text-on-surface-variant">
                    {isLoadingDirs ? t("loading") : t("no_directories")}
                  </h2>
                </div>
                {!isLoadingDirs && (
                  <button
                    type="button"
                    onClick={() => setIsEditingPaths(true)}
                    className="ml-3 flex-shrink-0 rounded-lg bg-surface-container-high px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-outline-variant"
                    style={{ WebkitTapHighlightColor: "transparent" }}
                  >
                    {t("edit_paths")}
                  </button>
                )}
              </div>
            )}
          </div>
          {mediaDirs.length > CARDS_PER_VIEW && (
            <button
              type="button"
              onClick={() => scrollPaths("right")}
              disabled={pathScrollIdx >= mediaDirs.length - CARDS_PER_VIEW}
              className="flex-shrink-0 rounded-lg border border-outline-variant/30 bg-surface-container p-2 transition-colors hover:bg-surface-container-high disabled:opacity-30"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <ChevronRight size={20} />
            </button>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="ghost-border rounded-xl bg-surface-container p-6">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              {t("total_files")}
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">{totalFiles}</span>
              <span className="text-sm text-on-surface-variant">{t("items")}</span>
            </div>
          </div>
          <div className="ghost-border rounded-xl bg-surface-container p-6">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              {t("scan_results")}
            </p>
            {findings.length > 0 ? (
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="flex items-center gap-1 text-sm">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-green-400">{t("status_downloaded")}</span>
                  <span className="font-bold text-on-surface">{scanSummary.downloaded}</span>
                </span>
                <span className="flex items-center gap-1 text-sm">
                  <span className="h-2 w-2 rounded-full bg-tertiary" />
                  <span className="text-tertiary">{t("status_skipped")}</span>
                  <span className="font-bold text-on-surface">{scanSummary.skipped}</span>
                </span>
                <span className="flex items-center gap-1 text-sm">
                  <span className="h-2 w-2 rounded-full bg-on-surface-variant" />
                  <span className="text-on-surface-variant">{t("status_no_match")}</span>
                  <span className="font-bold text-on-surface">{scanSummary.no_match}</span>
                </span>
                <span className="flex items-center gap-1 text-sm">
                  <span className="h-2 w-2 rounded-full bg-error" />
                  <span className="text-error">{t("status_error")}</span>
                  <span className="font-bold text-on-surface">{scanSummary.error}</span>
                </span>
              </div>
            ) : (
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-on-surface-variant/50">—</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Path Editor */}
      {isEditingPaths && (
        <section className="ghost-border space-y-4 rounded-xl bg-surface-container p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">{t("media_paths")}</h3>
          </div>
          <p className="text-xs text-on-surface-variant">
            {t("edit_paths")} — {t("save_paths")}
          </p>
          <input
            type="text"
            value={mediaPathsInput}
            onChange={(e) => setMediaPathsInput(e.target.value)}
            placeholder="/media/movies,/media/tv"
            className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface focus:border-primary focus:outline-none"
          />
          {savePathsError && (
            <div className="rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">
              {savePathsError}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCancelEditPaths}
              disabled={isSavingPaths}
              className="rounded-lg border border-outline px-4 py-2 text-xs font-bold transition-colors hover:bg-surface-container-high disabled:opacity-50"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {t("cancel_edit")}
            </button>
            <button
              type="button"
              onClick={handleSavePaths}
              disabled={isSavingPaths}
              className="flex items-center gap-2 rounded-lg bg-primary-container px-4 py-2 text-xs font-bold text-on-primary-container transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {isSavingPaths ? t("loading") : t("save_paths")}
            </button>
          </div>
        </section>
      )}

      {/* Active Scan */}
      <section className="ghost-border space-y-6 rounded-xl bg-surface-container-low p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <SyncIcon size={24} className={isRunning ? "animate-spin" : ""} />
            </div>
            <div>
              <h3 className="text-lg font-bold">{t("active_jellyfin_scan")}</h3>
              <p className="text-sm text-on-surface-variant">
                {activeTask ? activeTask.message : t("sync_desc")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isRunning && (
              <button
                type="button"
                onClick={handleCancelTask}
                className="flex items-center gap-2 rounded-lg border border-error/50 bg-error/10 px-4 py-3 text-xs font-bold text-error transition-all hover:bg-error/20 active:scale-95"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <StopCircle size={16} />
                {t("cancel")}
              </button>
            )}
            <button
              type="button"
              onClick={handleScanNow}
              disabled={isStartingScan || isRunning}
              className="flex items-center gap-2 rounded-lg bg-primary-container px-6 py-3 text-xs font-bold text-on-primary-container transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {isRunning || isStartingScan ? (
                <SyncIcon size={16} className="animate-spin" />
              ) : (
                <Play size={16} fill="currentColor" />
              )}
              {isStartingScan ? t("starting") : isRunning ? t("scanning") : t("scan_now")}
            </button>
          </div>
        </div>

        {/* Scan mode segmented control + Filter row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Scan Mode Segmented Control */}
          <div className="flex rounded-lg border border-outline-variant/30 bg-surface-container p-1">
            {([
              { mode: "scan" as const, label: t("scan_mode_scan") },
              { mode: "dry_run" as const, label: t("scan_mode_dry_run") },
              { mode: "dump" as const, label: t("scan_mode_dump") },
              { mode: "dump_force" as const, label: t("scan_mode_force") },
            ]).map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setScanMode(mode)}
                disabled={isRunning}
                className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                  scanMode === mode
                    ? "bg-primary text-on-primary"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                } disabled:cursor-not-allowed disabled:opacity-40`}
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Filter keywords input (desktop) */}
          <div className="relative hidden flex-1 min-w-0 md:block">
            <Filter size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              value={filterKeywords}
              onChange={(e) => setFilterKeywords(e.target.value)}
              placeholder={t("filter_placeholder")}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-low py-2 pl-8 pr-3 text-xs text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none"
              disabled={isRunning}
            />
          </div>
        </div>

        {/* Mobile filter input */}
        <div className="relative md:hidden">
          <Filter size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            value={filterKeywords}
            onChange={(e) => setFilterKeywords(e.target.value)}
            placeholder={t("filter_placeholder")}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-low py-2 pl-8 pr-3 text-xs text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none"
            disabled={isRunning}
          />
        </div>

        {/* Progress Bar */}
        {(activeTask || isStartingScan) && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>
                {activeTask ? (
                  <>
                    {getStatusIcon(activeTask.status)}{" "}
                    <span className={activeTask.status === "running" ? "font-medium text-primary" : ""}>
                      {isRunning ? findings.length > 0 ? t("scanning") : t("starting") : activeTask.message}
                    </span>
                  </>
                ) : (
                  <span className="text-on-surface-variant">{t("starting")}</span>
                )}
              </span>
              <span className="font-bold tabular-nums">
                {isRunning && scanTotal > 0
                  ? `${findings.length} / ${scanTotal} ${t("items")}`
                  : `${findings.length} ${t("items")}`}
                {isRunning && <span className="ml-2 font-normal text-on-surface-variant">— {t("scanning")}</span>}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
              <div
                className={`h-full bg-primary-container transition-all duration-500 ${isRunning ? "animate-pulse" : ""}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">
            {error}
          </div>
        )}
      </section>

      {/* Recent Findings Table */}
      <section className="ghost-border overflow-hidden rounded-xl bg-surface-container">
        <div className="flex items-center justify-between bg-surface-container-high px-6 py-4">
          <h4 className="text-lg font-bold">{t("recent_findings")}</h4>
          {findings.length > 0 && (
            <div className="flex rounded-lg border border-outline-variant/30 bg-surface-container p-1">
              {statusFilterOptions.map((opt) => (
                <button
                  key={opt ?? "all"}
                  type="button"
                  onClick={() => { setStatusFilter(opt); setResultsPage(0); }}
                  className={`rounded-md px-3 py-1 text-xs font-bold transition-all ${
                    statusFilter === opt
                      ? "bg-primary text-on-primary"
                      : "text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  {opt === null ? t("all_status") : opt === "downloaded" ? t("status_downloaded") : opt === "skipped" ? t("status_skipped") : opt === "no_match" ? t("status_no_match") : t("status_error")}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-outline-variant/30 bg-surface-container-high/50 text-xs font-bold uppercase text-on-surface-variant">
              <tr>
                <th className="px-6 py-4">{t("media_file")}</th>
                <th className="px-6 py-4">{t("type")}</th>
                <th className="px-6 py-4">{t("subtitle_file")}</th>
                <th className="px-6 py-4">{t("reason")}</th>
                <th className="px-6 py-4 text-right">{t("action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {paginatedFindings.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-center text-sm text-on-surface-variant" colSpan={5}>
                    {activeTask?.status === "running"
                      ? t("scan_progress")
                      : t("no_results_scan")}
                  </td>
                </tr>
              ) : (
                paginatedFindings.map((finding, idx) => (
                  <tr key={`result-${idx}-${finding.movie_name}`} className="transition-colors hover:bg-surface-container-high">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Film size={16} className="text-primary" />
                        <span className="truncate font-medium">{finding.movie_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={finding.status} label={statusLabel(finding.status, t)} />
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant max-w-[200px] truncate" title={finding.filename}>
                      {finding.filename || "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant max-w-[240px] truncate" title={finding.reason}>
                      {finding.reason === "dry-run" ? t("scan_mode_dry_run") : (finding.reason || "—")}
                      {finding.dry_state && (
                        <DryStateBadge dryState={finding.dry_state} label={dryStateLabel(finding.dry_state, t)} />
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setDetailItem(finding)}
                        className="text-xs text-primary hover:underline"
                        style={{ WebkitTapHighlightColor: "transparent" }}
                      >
                        {t("view")}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between bg-surface-container-low px-6 py-4 text-sm text-on-surface-variant">
          <span>
            {sortedFindings.length > 0
              ? `${resultsPage * RESULTS_PER_PAGE + 1}-${Math.min((resultsPage + 1) * RESULTS_PER_PAGE, sortedFindings.length)} / ${sortedFindings.length}`
              : t("x_results").replace("{x}", "0")}
          </span>
          {sortedFindings.length > RESULTS_PER_PAGE && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setResultsPage((p) => Math.max(0, p - 1))}
                disabled={resultsPage === 0}
                className="ghost-border rounded p-1 transition-colors hover:bg-surface-container-high disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-2 tabular-nums">{resultsPage + 1} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setResultsPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={resultsPage >= totalPages - 1}
                className="ghost-border rounded p-1 transition-colors hover:bg-surface-container-high disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Detail Dialog */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDetailItem(null)}>
          <div className="mx-4 w-full max-w-lg rounded-xl bg-surface-container-high p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{t("view")}: {detailItem.movie_name}</h3>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-bold text-on-surface-variant">{t("type")}: </span>
                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${getStatusColor(detailItem.status)}`}>
                  {statusLabel(detailItem.status, t)}
                </span>
              </div>
              {detailItem.filename && (
                <div>
                  <span className="font-bold text-on-surface-variant">{t("subtitle_file")}: </span>
                  <span className="select-all text-on-surface">{detailItem.filename}</span>
                </div>
              )}
              {detailItem.dry_state && (
                <div>
                  <span className="font-bold text-on-surface-variant">{t("dry_state")}: </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${getDryStateColor(detailItem.dry_state)}`}>
                    {dryStateLabel(detailItem.dry_state, t)}
                  </span>
                </div>
              )}
              <div>
                <span className="font-bold text-on-surface-variant">{t("reason")}: </span>
                <p className="mt-1 select-all whitespace-pre-wrap break-all rounded-lg bg-surface-container p-3 text-on-surface">
                  {detailItem.reason === "dry-run" ? t("scan_mode_dry_run") : (detailItem.reason || "—")}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="rounded-lg bg-primary-container px-4 py-2 text-xs font-bold text-on-primary-container hover:brightness-110"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default withAuth(ScannerPage);