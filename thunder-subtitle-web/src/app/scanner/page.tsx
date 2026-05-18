"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FolderOpen,
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
import type { TaskResponse, MediaDirectory } from "@/lib/types";

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

  // Load media directories
  useEffect(() => {
    async function loadDirs() {
      try {
        const dirs = await fastApiClient.listMediaDirectories();
        setMediaDirs(dirs);
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
        clearInterval(interval);
      }
    }, 2000);

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

  const handleScanNow = useCallback(async () => {
    if (isStartingScan) return;
    setIsStartingScan(true);
    setError(null);

    try {
      // Determine scan path from first media dir or empty
      const path = mediaDirs.length > 0 ? mediaDirs[0].path : "";
      const task = await fastApiClient.createTask("scan", path ? { path } : {});
      setActiveTask(task);
      setProgress(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failed_start_scan"));
    } finally {
      setIsStartingScan(false);
    }
  }, [isStartingScan, mediaDirs, t]);

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

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      {/* Stats Cards */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-4">
        {mediaDirs.length > 0 ? (
          mediaDirs.slice(0, 2).map((dir) => (
            <div key={dir.path} className="ghost-border col-span-1 flex items-center justify-between rounded-xl bg-surface-container p-6 md:col-span-2">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  {t("library_path")}
                </p>
                <h2 className="truncate text-xl font-bold" title={dir.path}>{dir.path}</h2>
              </div>
              <button
                type="button"
                className="rounded-lg bg-surface-container-high p-3 transition-colors hover:bg-outline-variant"
              >
                <FolderOpen size={24} />
              </button>
            </div>
          ))
        ) : (
          <div className="ghost-border col-span-2 flex items-center justify-between rounded-xl bg-surface-container p-6">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                {t("library_path")}
              </p>
              <h2 className="text-xl font-bold text-on-surface-variant">
                {isLoadingDirs ? t("loading") : t("no_directories")}
              </h2>
            </div>
            <FolderOpen size={24} className="text-on-surface-variant" />
          </div>
        )}
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
      </section>

      {/* Active Scan */}
      <section className="ghost-border space-y-6 rounded-xl bg-surface-container-low p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <SyncIcon size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold">{t("active_jellyfin_scan")}</h3>
              <p className="text-sm text-on-surface-variant">
                {activeTask ? activeTask.message : t("sync_desc")}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
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
              <Play size={16} fill="currentColor" />
              {isStartingScan ? t("starting") : isRunning ? t("scanning") : t("scan_now")}
            </button>
          </div>
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