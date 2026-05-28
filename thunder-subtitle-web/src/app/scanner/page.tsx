"use client";

import { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from "react";
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
import type { HealthCheckItem, ScanResultItem } from "@/lib/types";
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
    case "reviewed_fail_new_subs": return t("dry_reviewed_fail_new_subs");
    default: return dryState;
  }
}

// ---- Module-level constants ----

const statusOrder: Record<string, number> = {
  error: 0,
  no_match: 1,
  skipped: 2,
  downloaded: 3,
};

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

  // Health check state
  const [healthResults, setHealthResults] = useState<HealthCheckItem[]>([]);
  const [isHealthRunning, setIsHealthRunning] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthExpanded, setHealthExpanded] = useState(false);

  // Path carousel state
  const pathScrollRef = useRef<HTMLDivElement>(null);
  const [pathScrollIdx, setPathScrollIdx] = useState(0);
  const [cardsPerView, setCardsPerView] = useState(1);

  // Responsive cards per view: 1 on mobile, 2 on desktop
  useLayoutEffect(() => {
    const checkWidth = () => {
      setCardsPerView(window.innerWidth >= 768 ? 2 : 1);
    };
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  // HTTP polling management refs
  const httpIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollFailCountRef = useRef(0);

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
      } catch (err) {
        console.error("Failed to check running tasks on mount", err);
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
    pollFailCountRef.current = 0;

    function startPolling() {
      httpIntervalRef.current = setInterval(async () => {
        try {
          const task = await fastApiClient.getTask(taskId);
          pollFailCountRef.current = 0;
          setActiveTask(task);
          setProgress(task.progress);
          if (task.status === "completed" || task.status === "failed" || task.status === "cancelled") {
            if (httpIntervalRef.current) {
              clearInterval(httpIntervalRef.current);
              httpIntervalRef.current = null;
            }
            // HTTP polling fallback: populate findings when WebSocket is unavailable (e.g. local dev)
            if (task.results && Array.isArray(task.results) && task.results.length > 0) {
              setFindings(task.results);
            }
          }
        } catch {
          pollFailCountRef.current++;
          if (pollFailCountRef.current >= 3) {
            if (httpIntervalRef.current) {
              clearInterval(httpIntervalRef.current);
              httpIntervalRef.current = null;
            }
            setError("Polling failed after 3 consecutive attempts");
          }
        }
      }, 3000);
    }

    function stopPolling() {
      if (httpIntervalRef.current) {
        clearInterval(httpIntervalRef.current);
        httpIntervalRef.current = null;
      }
    }

    // Start HTTP polling initially
    startPolling();

    // Also connect WebSocket for real-time updates
    const ws = new ProgressWebSocket();
    ws.connect(
      taskId,
      (data: unknown) => {
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
        const r = update.result;
        if (r && update.status !== "completed") {
          setFindings((prev) => {
            // Avoid duplicates by movie_name
            if (prev.some((f) => f.movie_name === r.movie_name)) {
              return prev;
            }
            return [r, ...prev];
          });
        }
        if (update.status === "completed" || update.status === "failed" || update.status === "cancelled") {
          // Final state — do a final poll to get all results
          fastApiClient.getTask(taskId).then((task) => {
            setActiveTask(task);
            setProgress(task.progress);
            // If task has stored results, use those (more complete than WebSocket stream)
            if (task.results && Array.isArray(task.results)) {
              setFindings(task.results);
            }
          }).catch(() => {
            console.error("Final task poll after WS completion failed");
          });
          ws.disconnect();
        }
      },
      {
        onOpen: () => stopPolling(),
        onClose: () => {
          // Fallback: restart HTTP polling when WebSocket disconnects
          if (!httpIntervalRef.current) {
            startPolling();
          }
        },
      }
    );

    return () => {
      stopPolling();
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
      } catch (innerErr) {
        console.error("Failed to check running tasks on scan start", innerErr);
      }
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

  const handleHealthCheck = useCallback(async () => {
    if (isHealthRunning) return;
    setIsHealthRunning(true);
    setHealthError(null);
    setHealthResults([]);
    setHealthExpanded(false);

    try {
      const enabledDirs = mediaDirs.filter((d) => !disabledPaths.has(d.path));
      if (enabledDirs.length === 0) {
        setHealthError(t("health_check_failed"));
        return;
      }
      const allResults: HealthCheckItem[] = [];
      for (const dir of enabledDirs) {
        try {
          const result = await fastApiClient.runHealthCheck(dir.path);
          allResults.push(...result.results);
        } catch {
          // 单目录失败不阻塞
        }
      }
      setHealthResults(allResults);
      setHealthExpanded(true);
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : t("health_check_failed"));
    } finally {
      setIsHealthRunning(false);
    }
  }, [isHealthRunning, mediaDirs, disabledPaths, t]);

  const isRunning = activeTask?.status === "running" || activeTask?.status === "pending";
  const totalFiles = mediaDirs.reduce((sum, d) => sum + d.movie_count, 0);

  // Sort findings: error first, then no_match, skipped, downloaded
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
      ? Math.max(0, pathScrollIdx - cardsPerView)
      : Math.min(mediaDirs.length - cardsPerView, pathScrollIdx + cardsPerView);
    el.scrollTo({ left: newIdx * cardWidth, behavior: "smooth" });
    setPathScrollIdx(newIdx);
  }, [mediaDirs.length, pathScrollIdx, cardsPerView]);

  const maxScrollIdx = Math.max(0, mediaDirs.length - cardsPerView);
  const remainingLeft = Math.ceil(pathScrollIdx / cardsPerView);
  const remainingRight = Math.ceil(Math.max(0, maxScrollIdx - pathScrollIdx) / cardsPerView);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 md:space-y-8">
      {/* Stats Cards */}
      <section className="space-y-4">
        {/* Path Carousel Row */}
        <div className="flex items-stretch gap-4">
          {mediaDirs.length > cardsPerView && (
            <div className="flex flex-col items-center justify-center gap-1">
              <button
                type="button"
                onClick={() => scrollPaths("left")}
                disabled={pathScrollIdx === 0}
                className="flex-shrink-0 rounded-lg border border-outline-variant/30 bg-surface-container p-2 transition-colors hover:bg-surface-container-high disabled:opacity-30"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <ChevronLeft size={20} />
              </button>
              <span
                className={`text-[9px] ${
                  remainingLeft === 0 ? "text-on-surface-variant/30" : "text-on-surface-variant"
                }`}
              >
                {t("scroll_remaining").replace("{x}", String(remainingLeft))}
              </span>
            </div>
          )}
          <div
            ref={pathScrollRef}
            className="flex flex-1 gap-4 overflow-hidden"
          >
            {mediaDirs.length > 0 ? (
              mediaDirs.map((dir, i) => (
                <div
                  key={`${i}-${dir.path}`}
                  className="ghost-border flex w-full flex-shrink-0 items-center justify-between rounded-xl bg-surface-container p-6 md:w-[calc(50%-0.5rem)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{dir.path.split("/").filter(Boolean).pop() || dir.path}</p>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60">
                      {t("library_path")}
                    </p>
                    <h2 className={`truncate text-sm font-medium text-on-surface-variant ${disabledPaths.has(dir.path) ? "text-on-surface-variant/40 line-through" : ""}`} title={dir.path}>{dir.path}</h2>
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
                      title={disabledPaths.has(dir.path) ? t("path_disabled") : t("path_enabled")}
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
          {mediaDirs.length > cardsPerView && (
            <div className="flex flex-col items-center justify-center gap-1">
              <button
                type="button"
                onClick={() => scrollPaths("right")}
                disabled={pathScrollIdx >= mediaDirs.length - cardsPerView}
                className="flex-shrink-0 rounded-lg border border-outline-variant/30 bg-surface-container p-2 transition-colors hover:bg-surface-container-high disabled:opacity-30"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <ChevronRight size={20} />
              </button>
              <span
                className={`text-[9px] ${
                  remainingRight === 0 ? "text-on-surface-variant/30" : "text-on-surface-variant"
                }`}
              >
                {t("scroll_remaining").replace("{x}", String(remainingRight))}
              </span>
            </div>
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
        <div className="flex flex-wrap items-center justify-between gap-3">
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
                className="flex items-center gap-2 rounded-lg border border-error/50 bg-error/10 px-3 py-2 text-xs font-bold text-error transition-all hover:bg-error/20 active:scale-95 md:px-4 md:py-3"
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
              className="flex items-center gap-2 rounded-lg bg-primary-container px-4 py-2 text-xs font-bold text-on-primary-container transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 md:px-6 md:py-3"
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
                className={`rounded-md px-2 py-1.5 text-[11px] font-bold transition-all md:px-3 md:text-xs ${
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

          {/* Filter keywords input (responsive) */}
          <div className="relative flex-1 min-w-0">
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

          {/* Health Check Button */}
          <button
            type="button"
            onClick={handleHealthCheck}
            disabled={isHealthRunning || isRunning}
            className="flex items-center gap-2 rounded-lg bg-tertiary/15 px-3 py-2 text-xs font-bold text-tertiary transition-all hover:bg-tertiary/25 active:scale-95 disabled:opacity-50"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            {isHealthRunning ? (
              <SyncIcon size={14} className="animate-spin" />
            ) : (
              <AlertTriangle size={14} />
            )}
            {isHealthRunning ? t("health_check_running") : t("health_check")}
          </button>
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

      {/* Health Check Results */}
      {healthResults.length > 0 && healthExpanded && (
        <section className="ghost-border overflow-hidden rounded-xl bg-surface-container">
          <div className="flex items-center justify-between bg-surface-container-high px-6 py-4">
            <h4 className="text-lg font-bold">{t("health_check_results")} ({healthResults.length})</h4>
            <button
              type="button"
              onClick={() => setHealthExpanded(false)}
              className="flex items-center gap-1 rounded-lg border border-outline-variant/30 px-3 py-1.5 text-xs font-bold text-on-surface-variant transition-colors hover:bg-surface-container-high"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {t("health_check_collapse")}
              <X size={14} />
            </button>
          </div>
          <div className="divide-y divide-outline-variant/20">
            {healthResults.map((item, idx) => {
              const levelColors: Record<string, string> = {
                error: "border-l-error bg-error/5",
                warning: "border-l-tertiary bg-tertiary/5",
                info: "border-l-primary bg-primary/5",
              };
              const levelIcons: Record<string, string> = {
                error: "text-error",
                warning: "text-tertiary",
                info: "text-primary",
              };
              const levelLabels: Record<string, string> = {
                error: t("health_check_error"),
                warning: t("health_check_warning"),
                info: t("health_check_info"),
              };
              const borderColor = levelColors[item.level] ?? "border-l-on-surface-variant bg-surface-container-low";
              const iconColor = levelIcons[item.level] ?? "text-on-surface-variant";
              const levelLabel = levelLabels[item.level] ?? item.level;
              return (
                <div
                  key={`health-${idx}`}
                  className={`flex items-start gap-3 border-l-4 px-6 py-4 ${borderColor}`}
                >
                  <div className={`mt-0.5 flex-shrink-0 ${iconColor}`}>
                    <AlertTriangle size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{item.movie_name}</span>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${iconColor.replace("text-", "bg-/15 text-").replace("bg-/15", "bg-surface-container-high")}`}
                        style={{ backgroundColor: item.level === "error" ? "rgba(255,82,82,0.15)" : item.level === "warning" ? "rgba(255,184,105,0.15)" : "rgba(123,207,255,0.15)" }}
                      >
                        {levelLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-on-surface-variant">{item.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Collapsed health check notice */}
      {healthResults.length > 0 && !healthExpanded && (
        <section className="ghost-border rounded-xl bg-surface-container p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-on-surface-variant">
              {t("health_check_results")}: {healthResults.length} items
            </span>
            <button
              type="button"
              onClick={() => setHealthExpanded(true)}
              className="flex items-center gap-1 rounded-lg border border-outline-variant/30 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-surface-container-high"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {t("health_check_expand")}
            </button>
          </div>
        </section>
      )}

      {/* Health check error */}
      {healthError && (
        <section className="rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error">
          {healthError}
        </section>
      )}

      {/* Recent Findings Table */}
      <section className="ghost-border overflow-hidden rounded-xl bg-surface-container">
        <div className="flex flex-col gap-2 bg-surface-container-high px-6 py-4 md:flex-row md:items-center md:justify-between">
          <h4 className="text-lg font-bold">{t("recent_findings")}</h4>
          {findings.length > 0 && (
            <div className="flex rounded-lg border border-outline-variant/30 bg-surface-container p-1">
              {statusFilterOptions.map((opt) => (
                <button
                  key={opt ?? "all"}
                  type="button"
                  onClick={() => { setStatusFilter(opt); setResultsPage(0); }}
                  className={`rounded-md px-2 py-1 text-[10px] font-bold transition-all md:px-3 md:text-xs ${
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

        <div className="hidden overflow-x-auto md:block">
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
        <div className="flex items-center justify-between bg-surface-container-low px-4 py-4 text-xs text-on-surface-variant md:px-6 md:text-sm">
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
              <span className="px-2 text-xs tabular-nums md:text-sm">{resultsPage + 1} / {totalPages}</span>
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

      {/* Mobile Card List (hidden md:block on desktop) */}
      <section className="ghost-border overflow-hidden rounded-xl bg-surface-container md:hidden">
        <div className="flex flex-col gap-2 bg-surface-container-high px-4 py-3">
          <h4 className="text-base font-bold">{t("recent_findings")}</h4>
        </div>
        <div className="space-y-3 p-4">
          {paginatedFindings.length === 0 ? (
            <div className="py-8 text-center text-sm text-on-surface-variant">
              {activeTask?.status === "running"
                ? t("scan_progress")
                : t("no_results_scan")}
            </div>
          ) : (
            paginatedFindings.map((finding, idx) => (
              <div
                key={`card-${idx}-${finding.movie_name}`}
                className="ghost-border rounded-xl bg-surface-container-low p-4"
              >
                {/* Top row: film icon + name + status badge */}
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Film size={16} className="flex-shrink-0 text-primary" />
                    <span className="truncate text-sm font-medium">{finding.movie_name}</span>
                  </div>
                  <StatusBadge status={finding.status} label={statusLabel(finding.status, t)} />
                </div>

                {/* Subtitle filename */}
                <div className="mb-1 text-xs text-on-surface-variant">
                  {finding.filename || "—"}
                </div>

                {/* Reason + dry_state + View button row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate text-xs text-on-surface-variant">
                      {finding.reason === "dry-run" ? t("scan_mode_dry_run") : (finding.reason || "—")}
                    </span>
                    {finding.dry_state && (
                      <DryStateBadge dryState={finding.dry_state} label={dryStateLabel(finding.dry_state, t)} />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailItem(finding)}
                    className="flex-shrink-0 text-xs text-primary hover:underline"
                    style={{ WebkitTapHighlightColor: "transparent" }}
                  >
                    {t("view")}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        {/* Mobile pagination */}
        <div className="flex items-center justify-between bg-surface-container-low px-4 py-3 text-xs text-on-surface-variant">
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
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-1 tabular-nums">{resultsPage + 1}/{totalPages}</span>
              <button
                type="button"
                onClick={() => setResultsPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={resultsPage >= totalPages - 1}
                className="ghost-border rounded p-1 transition-colors hover:bg-surface-container-high disabled:opacity-30"
                style={{ WebkitTapHighlightColor: "transparent" }}
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