"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Play,
  RefreshCw as SyncIcon,
  StopCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
  FileVideo,
  Film,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { fastApiClient, ProgressWebSocket } from "@/lib/api";
import { withAuth } from "@/lib/auth";
import type { TaskResponse, MediaDirectory, AppConfig } from "@/lib/types";

// ---- Types ----

interface ScanFinding {
  path: string;
  name: string;
  type: "movie" | "tv_show";
  status: "downloaded" | "skipped" | "no_match" | "error";
}

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

function ScannerPage() {
  const t = useTranslations();
  const [mediaDirs, setMediaDirs] = useState<MediaDirectory[]>([]);
  const [activeTask, setActiveTask] = useState<TaskResponse | null>(null);
  const [progress, setProgress] = useState(0);
  const [isLoadingDirs, setIsLoadingDirs] = useState(true);
  const [isStartingScan, setIsStartingScan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [findings] = useState<ScanFinding[]>([]);

  // Path editing state
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [mediaPathsInput, setMediaPathsInput] = useState("");
  const [isEditingPaths, setIsEditingPaths] = useState(false);
  const [isSavingPaths, setIsSavingPaths] = useState(false);
  const [savePathsError, setSavePathsError] = useState<string | null>(null);

  // Filter keywords
  const [filterKeywords, setFilterKeywords] = useState("");

  // Scan mode
  const [scanMode, setScanMode] = useState<"scan" | "dry_run" | "dump" | "dump_force">("scan");

  // Path carousel state
  const pathScrollRef = useRef<HTMLDivElement>(null);
  const [pathScrollIdx, setPathScrollIdx] = useState(0);
  const CARDS_PER_VIEW = 2;

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
      const update = data as { progress?: number; message?: string; status?: string };
      if (update.progress !== undefined) {
        setProgress(update.progress);
      }
      if (update.status === "completed" || update.status === "failed" || update.status === "cancelled") {
        // Final state — do a final poll
        fastApiClient.getTask(taskId).then((task) => {
          setActiveTask(task);
          setProgress(task.progress);
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

    try {
      // Pass ALL configured paths + optional keyword filters
      const allPaths = mediaDirs.map((d) => d.path);
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
  }, [isStartingScan, mediaDirs, filterKeywords, scanMode, t]);

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
              mediaDirs.map((dir) => (
                <div
                  key={dir.path}
                  className="ghost-border flex w-[calc(50%-0.5rem)] flex-shrink-0 items-center justify-between rounded-xl bg-surface-container p-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      {t("library_path")}
                    </p>
                    <h2 className="truncate text-lg font-bold" title={dir.path}>{dir.path}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingPaths(true)}
                    className="ml-3 flex-shrink-0 rounded-lg bg-surface-container-high px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-outline-variant"
                    title={t("edit_paths")}
                  >
                    {t("edit_paths")}
                  </button>
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
              {t("missing_subs")}
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-tertiary">—</span>
              <span className="text-sm text-on-surface-variant">—%</span>
            </div>
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
          <div className="relative hidden md:block">
            <Filter size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              value={filterKeywords}
              onChange={(e) => setFilterKeywords(e.target.value)}
              placeholder={t("filter_placeholder")}
              className="w-48 rounded-lg border border-outline-variant bg-surface-container-low py-2 pl-8 pr-3 text-xs text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none"
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
                      {activeTask.message}
                    </span>
                  </>
                ) : (
                  <span className="text-on-surface-variant">{t("starting")}</span>
                )}
              </span>
              <span className="font-bold">
                {Math.round(progress)}% {t("complete")}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
              <div
                className="h-full bg-primary-container transition-all duration-500"
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
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-1 text-sm text-on-surface-variant transition-colors hover:bg-surface-container-highest"
            style={{ WebkitTapHighlightColor: "transparent" }}
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
              {findings.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-center text-sm text-on-surface-variant" colSpan={5}>
                    {activeTask?.status === "running"
                      ? t("scan_progress")
                      : t("no_results_scan")}
                  </td>
                </tr>
              ) : (
                findings.map((finding) => (
                  <tr key={finding.path} className="transition-colors hover:bg-surface-container-high">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {finding.type === "movie" ? <Film size={16} className="text-primary" /> : <FileVideo size={16} className="text-secondary" />}
                        <span className="truncate font-medium">{finding.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        finding.type === "movie"
                          ? "bg-primary/15 text-primary"
                          : "bg-secondary/15 text-secondary"
                      }`}>
                        {finding.type === "movie" ? t("movie") : t("tv_show")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">—</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        finding.status === "downloaded"
                          ? "bg-green-500/15 text-green-400"
                          : finding.status === "skipped"
                          ? "bg-tertiary/15 text-tertiary"
                          : finding.status === "no_match"
                          ? "bg-error/15 text-error"
                          : "bg-on-surface-variant/15 text-on-surface-variant"
                      }`}>
                        {finding.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
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
          <span>{t("x_results").replace("{x}", String(findings.length))}</span>
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

export default withAuth(ScannerPage);