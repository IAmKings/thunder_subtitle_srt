"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Settings as SettingsIcon,
  ExternalLink,
  Monitor as ScannerIcon,
  Loader2,
  Save,
  RotateCcw,
  Key,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { fastApiClient } from "@/lib/api";
import { withAuth } from "@/lib/auth";
import type { AppConfig } from "@/lib/types";

function SettingsPage() {
  const t = useTranslations();

  // Config state
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form fields
  const [savePath, setSavePath] = useState("");
  const [timeout, setTimeout] = useState(30);
  const [downloadTimeout, setDownloadTimeout] = useState(60);
  const [chunkSize, setChunkSize] = useState(8192);
  const [rateLimit, setRateLimit] = useState(3);
  const [retryCount, setRetryCount] = useState(3);
  const [retryDelay, setRetryDelay] = useState(2);
  const [preferredGroups, setPreferredGroups] = useState("");
  const [mediaPaths, setMediaPaths] = useState("");

  // Password section
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Automation toggles (stored locally for now, not in backend config)
  const [autoScan, setAutoScan] = useState(true);
  const [autoDownload, setAutoDownload] = useState(false);
  const [cleanupOrphans, setCleanupOrphans] = useState(true);
  const [notifySuccess, setNotifySuccess] = useState(true);

  // Load config on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const cfg = await fastApiClient.getConfig();
        setConfig(cfg);
        setSavePath(cfg.output_dir);
        setTimeout(cfg.timeout);
        setDownloadTimeout(cfg.download_timeout);
        setChunkSize(cfg.chunk_size);
        setRateLimit(cfg.rate_limit);
        setRetryCount(cfg.retry_count);
        setRetryDelay(cfg.retry_delay);
        setPreferredGroups(cfg.preferred_groups);
        setMediaPaths(cfg.media_paths);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load configuration");
      } finally {
        setIsLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSave = useCallback(async () => {
    if (!config) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await fastApiClient.updateConfig({
        output_dir: savePath,
        timeout,
        download_timeout: downloadTimeout,
        chunk_size: chunkSize,
        rate_limit: rateLimit,
        retry_count: retryCount,
        retry_delay: retryDelay,
        preferred_groups: preferredGroups,
        media_paths: mediaPaths,
      });
      setConfig(updated);
      setSuccess("Configuration saved successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  }, [config, savePath, timeout, downloadTimeout, chunkSize, rateLimit, retryCount, retryDelay, preferredGroups, mediaPaths]);

  const handleResetDefaults = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const cfg = await fastApiClient.reloadConfig();
      setConfig(cfg);
      setSavePath(cfg.output_dir);
      setTimeout(cfg.timeout);
      setDownloadTimeout(cfg.download_timeout);
      setChunkSize(cfg.chunk_size);
      setRateLimit(cfg.rate_limit);
      setRetryCount(cfg.retry_count);
      setRetryDelay(cfg.retry_delay);
      setPreferredGroups(cfg.preferred_groups);
      setMediaPaths(cfg.media_paths);
      setSuccess("Configuration reset to defaults");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset configuration");
    } finally {
      setIsSaving(false);
    }
  }, []);

  const handleChangePassword = useCallback(async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 4) {
      setPasswordError("Password must be at least 4 characters");
      return;
    }

    setIsChangingPassword(true);
    try {
      // For MVP: password change is not implemented in the backend
      // We'd need a dedicated endpoint. For now, show a message.
      setPasswordSuccess("Password change feature coming soon");
    } catch {
      setPasswordError("Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  }, [newPassword, confirmPassword]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="mb-8">
        <h2 className="text-3xl font-bold">{t("system_settings")}</h2>
        <p className="mt-1 text-on-surface-variant">{t("settings_desc")}</p>
      </header>

      {/* Error / Success messages */}
      {error && (
        <div className="rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-400">
          {success}
        </div>
      )}

      <div className="space-y-8">
        {/* General */}
        <section className="ghost-border rounded-xl bg-surface-container p-6">
          <div className="mb-6 flex items-center gap-2 border-b border-outline-variant/20 pb-2">
            <SettingsIcon className="text-primary" size={20} />
            <h3 className="text-lg font-bold">{t("general")}</h3>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                {t("save_path")}
              </label>
              <input
                type="text"
                value={savePath}
                onChange={(e) => setSavePath(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                {t("lang_priority")}
              </label>
              <input
                type="text"
                value={preferredGroups}
                onChange={(e) => setPreferredGroups(e.target.value)}
                placeholder="e.g. KitaujiSub,DMG"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Media Paths
              </label>
              <input
                type="text"
                value={mediaPaths}
                onChange={(e) => setMediaPaths(e.target.value)}
                placeholder="/media/movies,/media/tv"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                API Timeout (seconds)
              </label>
              <input
                type="number"
                value={timeout}
                onChange={(e) => setTimeout(Number(e.target.value))}
                min={5}
                max={300}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Advanced settings - collapsible */}
          <details className="mt-6">
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:text-primary">
              Advanced Settings
            </summary>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Download Timeout (seconds)
                </label>
                <input
                  type="number"
                  value={downloadTimeout}
                  onChange={(e) => setDownloadTimeout(Number(e.target.value))}
                  min={10}
                  max={600}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface focus:border-primary focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Chunk Size (bytes)
                </label>
                <input
                  type="number"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(Number(e.target.value))}
                  min={1024}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface focus:border-primary focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Rate Limit (seconds between queries)
                </label>
                <input
                  type="number"
                  value={rateLimit}
                  onChange={(e) => setRateLimit(Number(e.target.value))}
                  min={0}
                  max={60}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface focus:border-primary focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Retry Count
                </label>
                <input
                  type="number"
                  value={retryCount}
                  onChange={(e) => setRetryCount(Number(e.target.value))}
                  min={0}
                  max={10}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface focus:border-primary focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Retry Delay (seconds)
                </label>
                <input
                  type="number"
                  value={retryDelay}
                  onChange={(e) => setRetryDelay(Number(e.target.value))}
                  min={0}
                  max={30}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </details>
        </section>

        {/* Subtitle Sources */}
        <section className="ghost-border rounded-xl bg-surface-container p-6">
          <div className="mb-6 flex items-center gap-2 border-b border-outline-variant/20 pb-2">
            <ExternalLink className="text-secondary" size={20} />
            <h3 className="text-lg font-bold">{t("subtitle_sources")}</h3>
          </div>
          <div className="space-y-4">
            <div className="ghost-border flex items-center justify-between rounded-lg bg-surface-container-low p-4 transition-colors hover:bg-surface-container">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded bg-white/10">
                  <div className="h-6 w-6 rounded-sm bg-primary/40" />
                </div>
                <div>
                  <p className="text-sm font-bold">Xunlei Subtitle API</p>
                  <p className="text-[10px] font-bold uppercase text-on-surface-variant">
                    Active &bull; Default Source
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="rounded-lg border border-outline-variant px-4 py-2 text-xs font-bold transition-colors hover:bg-surface-container-high"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {t("configure")}
              </button>
            </div>
          </div>
        </section>

        {/* Automation */}
        <section className="ghost-border rounded-xl bg-surface-container p-6">
          <div className="mb-6 flex items-center gap-2 border-b border-outline-variant/20 pb-2">
            <ScannerIcon className="text-primary" size={20} />
            <h3 className="text-lg font-bold">{t("automation")}</h3>
          </div>
          <div className="grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-2">
            {[
              { id: "scan", label: t("auto_scan"), desc: t("auto_scan_desc"), active: autoScan, toggle: setAutoScan },
              { id: "download", label: t("auto_download"), desc: t("auto_download_desc"), active: autoDownload, toggle: setAutoDownload },
              { id: "cleanup", label: t("cleanup_orphans"), desc: t("cleanup_desc"), active: cleanupOrphans, toggle: setCleanupOrphans },
              { id: "notify", label: t("notify_success"), desc: t("notify_desc"), active: notifySuccess, toggle: setNotifySuccess },
            ].map((item) => (
              <div key={item.id} className="group flex items-center justify-between">
                <div className="pr-4">
                  <p className="text-sm font-bold transition-colors group-hover:text-primary">
                    {item.label}
                  </p>
                  <p className="text-[10px] leading-relaxed text-on-surface-variant">{item.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => item.toggle(!item.active)}
                  className={`relative h-6 w-12 flex-shrink-0 cursor-pointer rounded-full transition-all duration-300 ${
                    item.active ? "bg-primary-container" : "bg-surface-variant"
                  }`}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <div
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all duration-300 ${
                      item.active ? "right-1" : "left-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Password Section */}
        <section className="ghost-border rounded-xl bg-surface-container p-6">
          <div className="mb-6 flex items-center gap-2 border-b border-outline-variant/20 pb-2">
            <Key className="text-tertiary" size={20} />
            <h3 className="text-lg font-bold">Change Password</h3>
          </div>
          {passwordError && (
            <div className="mb-4 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-400">
              {passwordSuccess}
            </div>
          )}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleChangePassword}
              disabled={isChangingPassword || !currentPassword || !newPassword}
              className="rounded-lg border border-outline-variant px-6 py-2 text-sm font-bold transition-colors hover:bg-surface-container-high active:scale-95 disabled:opacity-50"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {isChangingPassword ? "Changing..." : "Change Password"}
            </button>
          </div>
        </section>

        {/* Action Footer */}
        <div className="flex items-center justify-end gap-4 pt-4">
          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg border border-outline px-8 py-3 text-sm font-bold transition-all hover:bg-surface-container-high active:scale-95 disabled:opacity-50"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <RotateCcw size={14} />
            {t("reset_defaults")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-primary-container px-8 py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(0,164,220,0.3)] transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {t("save_changes")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default withAuth(SettingsPage);