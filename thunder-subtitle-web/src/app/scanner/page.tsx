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
  Clock,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { fastApiClient, ProgressWebSocket } from "@/lib/api";
import { withAuth } from "@/lib/auth";
import { useScannerState, useScannerActions } from "@/lib/scanner-state";
import type { HealthCheckItem, ScanResultItem, ScheduledTask } from "@/lib/types";
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

const statusOrder: Readonly<Record<string, number>> = {
  error: 0,
  no_match: 1,
  skipped: 2,
  downloaded: 3,
} as const;

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

  // Scheduled task state
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [scheduleDialogDir, setScheduleDialogDir] = useState<string | null>(null);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleCron, setScheduleCron] = useState("0 2 * * *");
  const [scheduleMode, setScheduleMode] = useState("scan");
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null);

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
  const isDryRun = scanMode === "dry_run";
  const statusFilterOptions: readonly (string | null)[] = isDryRun
    ? [null, "need_download", "need_review", "reviewed_ok", "reviewed_fail", "reviewed_fail_new_subs", "skipped"]
    : [null, "downloaded", "skipped", "no_match", "error"];
  const [detailItem, setDetailItem] = useState<ScanResultItem | null>(null);
  const [scanTotal, setScanTotal] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState("");  // "正在下载字幕 3/18"

  // Load media directories + config + scheduled tasks
  useEffect(() => {
    async function loadDirs() {
      try {
        const [dirs, cfg, scheduled] = await Promise.all([
          fastApiClient.listMediaDirectories(),
          fastApiClient.getConfig(),
          fastApiClient.listScheduledTasks().catch(() => [] as ScheduledTask[]),
        ]);
        setMediaDirs(dirs);
        setConfig(cfg);
        setMediaPathsInput(cfg.media_paths);
        setScheduledTasks(scheduled);
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
          current_movie?: string;
          current_step?: string;
          download_progress?: string;
        };
        if (update.total !== undefined && update.total > 0) {
          setScanTotal(update.total);
        }
        if (update.progress !== undefined) {
          setProgress(update.progress);
        }
        // 下载进度：更新文本提示，不碰进度条
        if (update.current_step === "downloading" && update.download_progress) {
          setDownloadStatus(`${update.current_movie || ""} ${update.download_progress}`);
        } else if (update.current_step && update.current_step !== "downloading") {
          setDownloadStatus("");
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
          setDownloadStatus("");  // 清除下载进度提示
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
      setScanTotal(0);
      setDownloadStatus("");
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

  // ---- Scheduled task helpers ----

  const getScheduledTaskForDir = useCallback((dirPath: string): ScheduledTask | undefined => {
    return scheduledTasks.find((st) => st.directory_path === dirPath);
  }, [scheduledTasks]);

  const openScheduleDialog = useCallback((dirPath: string) => {
    const existing = scheduledTasks.find((st) => st.directory_path === dirPath);
    setScheduleEnabled(existing?.enabled ?? true);  // 新建时默认启用
    setScheduleCron(existing?.cron ?? "0 2 * * *");
    setScheduleMode(existing?.mode ?? "scan");
    setScheduleDialogDir(dirPath);
    setScheduleError(null);
    setScheduleSuccess(null);
  }, [scheduledTasks]);

  const handleSaveSchedule = useCallback(async () => {
    if (!scheduleDialogDir) return;
    setIsSavingSchedule(true);
    setScheduleError(null);
    setScheduleSuccess(null);
    try {
      const result = await fastApiClient.saveScheduledTask(scheduleDialogDir, {
        enabled: scheduleEnabled,
        cron: scheduleCron,
        mode: scheduleMode,
      });
      setScheduledTasks((prev) => {
        const filtered = prev.filter((st) => st.directory_path !== scheduleDialogDir);
        return [...filtered, result];
      });
      setScheduleSuccess(t("schedule_saved"));
      setTimeout(() => {
        setScheduleSuccess(null);
        setScheduleDialogDir(null);
      }, 1500);
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : t("schedule_save_failed"));
    } finally {
      setIsSavingSchedule(false);
    }
  }, [scheduleDialogDir, scheduleEnabled, scheduleCron, scheduleMode, t]);

  const handleDeleteSchedule = useCallback(async () => {
    if (!scheduleDialogDir) return;
    setIsSavingSchedule(true);
    setScheduleError(null);
    try {
      await fastApiClient.deleteScheduledTask(scheduleDialogDir);
      setScheduledTasks((prev) => prev.filter((st) => st.directory_path !== scheduleDialogDir));
      setScheduleDialogDir(null);
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : t("schedule_delete_failed"));
    } finally {
      setIsSavingSchedule(false);
    }
  }, [scheduleDialogDir, t]);

  const formatNextRun = useCallback((cron: string): string => {
    // Simple approximation: show based on cron presets
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return t("cron_placeholder");
    if (cron === "0 * * * *") return t("cron_hourly");
    if (cron === "0 3 * * *") return t("cron_daily");
    if (cron === "0 3 * * 1") return t("cron_weekly");
    // Generic preview
    const now = new Date();
    const hour = parseInt(parts[1], 10);
    if (!isNaN(hour) && parts[0] === "0") {
      const next = new Date(now);
      next.setHours(hour, 0, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next.toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    }
    return cron;
  }, [t]);

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
      list = list.filter((f) => (isDryRun ? f.dry_state === statusFilter : f.status === statusFilter));
    }
    return list;
  }, [findings, statusFilter, isDryRun]);

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
              mediaDirs.map((dir, i) => {
                const sched = getScheduledTaskForDir(dir.path);
                return (
                <div
                  key={`${i}-${dir.path}`}
                  className="ghost-border flex w-full flex-shrink-0 flex-col justify-between rounded-xl bg-surface-container p-6 md:w-[calc(50%-0.5rem)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate">{dir.path.split("/").filter(Boolean).pop() || dir.path}</p>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60">
                        {t("library_path")}
                      </p>
                      <h2 className={`truncate text-sm font-medium text-on-surface-variant ${disabledPaths.has(dir.path) ? "text-on-surface-variant/40 line-through" : ""}`} title={dir.path}>{dir.path}</h2>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1">
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
                      <button
                        type="button"
                        onClick={() => openScheduleDialog(dir.path)}
                        className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
                        title={t("schedule_settings")}
                        style={{ WebkitTapHighlightColor: "transparent" }}
                      >
                        <Clock size={14} className="inline" /> {t("scheduled")}
                      </button>
                    </div>
                  </div>
                  {/* Stats row */}
                  <div className="mt-3 flex items-center gap-4 text-xs text-on-surface-variant">
                    <span>{dir.movie_count} {t("items")}</span>
                    {dir.pending_review_count > 0 && (
                      <span className="flex items-center gap-1 rounded bg-error/10 px-2 py-0.5 text-error font-bold">
                        {t("pending_review")}: {dir.pending_review_count}
                      </span>
                    )}
                  </div>
                  {/* Scheduled task status */}
                  {sched && (
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-on-surface-variant/80">
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${sched.enabled ? "bg-green-400" : "bg-on-surface-variant/30"}`} />
                      <span>{sched.enabled ? t("schedule_enabled") : t("schedule_disabled")}</span>
                      {sched.enabled && (
                        <>
                          <span className="text-on-surface-variant/40">|</span>
                          <span>{sched.cron}</span>
                          <span className="text-on-surface-variant/40">|</span>
                          <span>{t(sched.mode === "scan" ? "scan_mode_scan" : sched.mode === "dry_run" ? "scan_mode_dry_run" : sched.mode === "dump" ? "scan_mode_dump" : "scan_mode_force")}</span>
                        </>
                      )}
                      {sched.last_run && (
                        <>
                          <span className="text-on-surface-variant/40">|</span>
                          <span>{t("last_run")}: {new Date(sched.last_run).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                );
              })
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
                onClick={() => { setScanMode(mode); setStatusFilter(null); setResultsPage(0); }}
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
            {downloadStatus && (
              <p className="mt-1 text-xs text-on-surface-variant animate-pulse">
                {downloadStatus}
              </p>
            )}
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
      {healthResults.length > 0 && healthExpanded && (() => {
        // 按电影分组 + 统计
        const grouped = new Map<string, typeof healthResults>();
        for (const r of healthResults) {
          const key = r.path || r.movie_name;
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key)!.push(r);
        }
        const problemMovies = [...grouped.values()].filter(g => g.some(r => r.level !== "ok")).length;
        const errorCount = healthResults.filter(r => r.level === "error").length;
        const warningCount = healthResults.filter(r => r.level === "warning").length;
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
        return (
        <section className="ghost-border overflow-hidden rounded-xl bg-surface-container">
          <div className="flex items-center justify-between bg-surface-container-high px-6 py-4">
            <div className="flex items-center gap-3">
              <h4 className="text-lg font-bold">{t("health_check_results")}</h4>
              <span className="text-xs text-on-surface-variant">
                {problemMovies} {t("movies_with_issues")}
                {errorCount > 0 && <span className="ml-2 text-error">{errorCount} {t("health_check_error")}</span>}
                {warningCount > 0 && <span className="ml-2 text-tertiary">{warningCount} {t("health_check_warning")}</span>}
              </span>
            </div>
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
            {[...grouped.entries()].map(([movieKey, items]) => {
              const maxLevel = items.some(r => r.level === "error") ? "error"
                : items.some(r => r.level === "warning") ? "warning" : "info";
              const borderColor = levelColors[maxLevel] ?? "border-l-on-surface-variant bg-surface-container-low";
              const iconColor = levelIcons[maxLevel] ?? "text-on-surface-variant";
              const movieName = items[0].movie_name || movieKey.split("/").pop() || movieKey;
              return (
                <div
                  key={`health-movie-${movieKey}`}
                  className={`border-l-4 ${borderColor}`}
                >
                  <div className="flex items-center gap-2 px-6 py-3">
                    <div className={`flex-shrink-0 ${iconColor}`}>
                      <AlertTriangle size={14} />
                    </div>
                    <span className="truncate text-sm font-medium">{movieName}</span>
                    <span className="text-xs text-on-surface-variant">{items.length} {t("issues")}</span>
                  </div>
                  {items.map((item, i) => (
                    <div key={`health-${movieKey}-${i}`} className="flex items-start gap-3 border-t border-outline-variant/10 px-10 py-2">
                      <span className={`mt-0.5 inline-block rounded-full px-1.5 py-0 text-[9px] font-bold`}
                        style={{
                          backgroundColor: item.level === "error" ? "rgba(255,82,82,0.15)" : item.level === "warning" ? "rgba(255,184,105,0.15)" : "rgba(123,207,255,0.15)",
                          color: item.level === "error" ? "rgb(255,82,82)" : item.level === "warning" ? "rgb(255,184,105)" : "rgb(123,207,255)",
                        }}
                      >
                        {levelLabels[item.level] ?? item.level}
                      </span>
                      <p className="text-xs text-on-surface-variant">{item.message}</p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
        );
      })()}

      {/* Collapsed health check notice */}
      {healthResults.length > 0 && !healthExpanded && (() => {
        const problemMovies = new Set(
          healthResults.filter(r => r.level !== "ok").map(r => r.path || r.movie_name)
        ).size;
        const errorCount = healthResults.filter(r => r.level === "error").length;
        const warningCount = healthResults.filter(r => r.level === "warning").length;
        return (
        <section className="ghost-border rounded-xl bg-surface-container p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm text-on-surface-variant">
              <span>{t("health_check_results")}</span>
              <span className="font-medium">{problemMovies} {t("movies_with_issues")}</span>
              {errorCount > 0 && <span className="text-error">{errorCount} {t("health_check_error")}</span>}
              {warningCount > 0 && <span className="text-tertiary">{warningCount} {t("health_check_warning")}</span>}
            </div>
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
        );
      })()}

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
                  {opt === null ? t("all_status") : isDryRun ? t(`dry_state_${opt}`) : (
                    opt === "downloaded" ? t("status_downloaded") : opt === "skipped" ? t("status_skipped") : opt === "no_match" ? t("status_no_match") : t("status_error")
                  )}
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

      {/* Schedule Config Dialog */}
      {scheduleDialogDir && (() => {
        const dirName = scheduleDialogDir.split("/").filter(Boolean).pop() || scheduleDialogDir;
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setScheduleDialogDir(null)}>
          <div className="mx-4 w-full max-w-md rounded-xl bg-surface-container-high p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{t("schedule_settings")}: {dirName}</h3>
              <button
                type="button"
                onClick={() => setScheduleDialogDir(null)}
                className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container"
              >
                <X size={18} />
              </button>
            </div>

            {/* Enable toggle */}
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-medium">{t("scheduled")}</span>
              <button
                type="button"
                onClick={() => setScheduleEnabled(!scheduleEnabled)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  scheduleEnabled ? "bg-primary" : "bg-surface-container-highest"
                }`}
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  scheduleEnabled ? "translate-x-5" : ""
                }`} />
              </button>
            </div>

            {scheduleEnabled && (
              <>
                {/* Cron expression */}
                <div className="mb-4">
                  <label className="mb-1 block text-xs font-bold text-on-surface-variant">{t("cron_label")}</label>
                  <input
                    type="text"
                    value={scheduleCron}
                    onChange={(e) => setScheduleCron(e.target.value)}
                    placeholder={t("cron_placeholder")}
                    className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface focus:border-primary focus:outline-none"
                  />
                  {/* Cron presets */}
                  <div className="mt-2 flex gap-2">
                    {[
                      { label: t("cron_hourly"), value: "0 * * * *" },
                      { label: t("cron_daily"), value: "0 3 * * *" },
                      { label: t("cron_weekly"), value: "0 3 * * 1" },
                    ].map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setScheduleCron(preset.value)}
                        className={`rounded px-2 py-1 text-[10px] font-bold transition-colors ${
                          scheduleCron === preset.value
                            ? "bg-primary text-on-primary"
                            : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                        }`}
                        style={{ WebkitTapHighlightColor: "transparent" }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  {/* Next run preview */}
                  <p className="mt-2 text-[10px] text-on-surface-variant/70">
                    {t("next_run")}: {formatNextRun(scheduleCron)}
                  </p>
                </div>

                {/* Mode select */}
                <div className="mb-4">
                  <label className="mb-1 block text-xs font-bold text-on-surface-variant">{t("schedule_mode")}</label>
                  <select
                    value={scheduleMode}
                    onChange={(e) => setScheduleMode(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-outline-variant bg-surface-container-low p-3 pr-8 text-sm text-on-surface focus:border-primary focus:outline-none"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%23999' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 0.75rem center" }}
                  >
                    <option value="scan">{t("scan_mode_scan")}</option>
                    <option value="dry_run">{t("scan_mode_dry_run")}</option>
                    <option value="dump">{t("scan_mode_dump")}</option>
                    <option value="dump_force">{t("scan_mode_force")}</option>
                  </select>
                </div>
              </>
            )}

            {/* Success / Error messages */}
            {scheduleSuccess && (
              <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-400">
                {scheduleSuccess}
              </div>
            )}
            {scheduleError && (
              <div className="mb-4 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">
                {scheduleError}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-3">
              {scheduleDialogDir && getScheduledTaskForDir(scheduleDialogDir) ? (
                <button
                  type="button"
                  onClick={handleDeleteSchedule}
                  disabled={isSavingSchedule}
                  className="rounded-lg border border-error/30 px-3 py-2 text-xs font-bold text-error transition-colors hover:bg-error/10 disabled:opacity-50"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  {t("schedule_delete")}
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleDialogDir(null)}
                  disabled={isSavingSchedule}
                  className="rounded-lg border border-outline px-3 py-2 text-xs font-bold transition-colors hover:bg-surface-container-high disabled:opacity-50"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleSaveSchedule}
                  disabled={isSavingSchedule}
                  className="rounded-lg bg-primary-container px-4 py-2 text-xs font-bold text-on-primary-container transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  {isSavingSchedule ? t("loading") : t("schedule_save")}
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

export default withAuth(ScannerPage);