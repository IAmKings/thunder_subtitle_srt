"use client";

import { useState, useEffect, useCallback, useReducer } from "react";
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
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { AppConfig } from "@/lib/types";

// ---- Reducer ----

interface SettingsState {
  config: AppConfig | null;
  savePath: string;
  timeout: number;
  downloadTimeout: number;
  chunkSize: number;
  rateLimit: number;
  retryCount: number;
  retryDelay: number;
  preferredGroups: string;
  mediaPaths: string;
  posterSystems: string[];
  debugSubtitleEnabled: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  success: string | null;
}

type SettingsAction =
  | { type: "SET_CONFIG"; payload: AppConfig }
  | { type: "SET_FIELD"; field: "savePath" | "preferredGroups" | "mediaPaths"; value: string }
  | { type: "SET_FIELD"; field: "timeout" | "downloadTimeout" | "chunkSize" | "rateLimit" | "retryCount" | "retryDelay"; value: number }
  | { type: "SET_FIELD"; field: "posterSystems"; value: string[] }
  | { type: "SET_DEBUG_SUBTITLE"; payload: boolean }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_SAVING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_SUCCESS"; payload: string | null }
  | { type: "RESET_FORM"; payload: AppConfig };

function settingsReducer(state: SettingsState, action: SettingsAction): SettingsState {
  switch (action.type) {
    case "SET_CONFIG": {
      const cfg = action.payload;
      return {
        ...state,
        config: cfg,
        savePath: cfg.output_dir,
        timeout: cfg.timeout,
        downloadTimeout: cfg.download_timeout,
        chunkSize: cfg.chunk_size,
        rateLimit: cfg.rate_limit,
        retryCount: cfg.retry_count,
        retryDelay: cfg.retry_delay,
        preferredGroups: cfg.preferred_groups,
        mediaPaths: cfg.media_paths,
        posterSystems: cfg.poster_systems ?? ["kodi"],
        debugSubtitleEnabled: cfg.debug_subtitle_enabled,
      };
    }
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_DEBUG_SUBTITLE":
      return { ...state, debugSubtitleEnabled: action.payload };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_SAVING":
      return { ...state, isSaving: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_SUCCESS":
      return { ...state, success: action.payload };
    case "RESET_FORM": {
      const cfg = action.payload;
      return {
        ...state,
        config: cfg,
        savePath: cfg.output_dir,
        timeout: cfg.timeout,
        downloadTimeout: cfg.download_timeout,
        chunkSize: cfg.chunk_size,
        rateLimit: cfg.rate_limit,
        retryCount: cfg.retry_count,
        retryDelay: cfg.retry_delay,
        preferredGroups: cfg.preferred_groups,
        mediaPaths: cfg.media_paths,
        posterSystems: cfg.poster_systems ?? ["kodi"],
        debugSubtitleEnabled: cfg.debug_subtitle_enabled,
        isSaving: false,
        error: null,
        success: null,
      };
    }
    default:
      return state;
  }
}

// ---- Initial state ----

const initialState: SettingsState = {
  config: null,
  savePath: "",
  timeout: 30,
  downloadTimeout: 60,
  chunkSize: 8192,
  rateLimit: 3,
  retryCount: 3,
  retryDelay: 2,
  preferredGroups: "",
  mediaPaths: "",
  posterSystems: ["kodi"],
  debugSubtitleEnabled: false,
  isLoading: true,
  isSaving: false,
  error: null,
  success: null,
};

// ---- Component ----

function SettingsPage() {
  const t = useTranslations();
  const [state, dispatch] = useReducer(settingsReducer, initialState);
  const { config, savePath, timeout, downloadTimeout, chunkSize, rateLimit, retryCount, retryDelay, preferredGroups, mediaPaths, posterSystems, debugSubtitleEnabled, isLoading, isSaving, error, success } = state;

  const [showApiSchema, setShowApiSchema] = useState(false);

  // Password section (separate concern from main config)
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Poster system toggle
  const togglePosterSystem = useCallback((system: string) => {
    const current = posterSystems ?? ["kodi"];
    const has = current.includes(system);
    if (has) {
      // If removing last one, force keep it
      if (current.length <= 1) return;
      dispatch({ type: "SET_FIELD", field: "posterSystems", value: current.filter((s: string) => s !== system) });
    } else {
      dispatch({ type: "SET_FIELD", field: "posterSystems", value: [...current, system] });
    }
  }, [posterSystems]);

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
        dispatch({ type: "SET_CONFIG", payload: cfg });
      } catch (err) {
        dispatch({ type: "SET_ERROR", payload: err instanceof Error ? err.message : t("failed_load_config") });
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    }
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = useCallback(async () => {
    if (!config) return;
    dispatch({ type: "SET_SAVING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });
    dispatch({ type: "SET_SUCCESS", payload: null });

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
        poster_systems: posterSystems,
        debug_subtitle_enabled: debugSubtitleEnabled,
      });
      dispatch({ type: "SET_CONFIG", payload: updated });
      dispatch({ type: "SET_SUCCESS", payload: t("configuration_saved") });
    } catch (err) {
      dispatch({ type: "SET_ERROR", payload: err instanceof Error ? err.message : t("failed_save_config") });
    } finally {
      dispatch({ type: "SET_SAVING", payload: false });
    }
  }, [config, savePath, timeout, downloadTimeout, chunkSize, rateLimit, retryCount, retryDelay, preferredGroups, mediaPaths, posterSystems, debugSubtitleEnabled, t]);

  const handleResetDefaults = useCallback(async () => {
    dispatch({ type: "SET_SAVING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });
    dispatch({ type: "SET_SUCCESS", payload: null });

    try {
      const cfg = await fastApiClient.reloadConfig();
      dispatch({ type: "RESET_FORM", payload: cfg });
      dispatch({ type: "SET_SUCCESS", payload: t("configuration_reset") });
    } catch (err) {
      dispatch({ type: "SET_ERROR", payload: err instanceof Error ? err.message : t("failed_reset_config") });
    } finally {
      dispatch({ type: "SET_SAVING", payload: false });
    }
  }, [t]);

  const handleChangePassword = useCallback(async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError(t("password_mismatch"));
      return;
    }
    if (newPassword.length < 4) {
      setPasswordError(t("password_length"));
      return;
    }

    setIsChangingPassword(true);
    try {
      await fastApiClient.changePassword(currentPassword, newPassword);
      setPasswordSuccess(t("password_changed"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : t("failed_change_password"));
    } finally {
      setIsChangingPassword(false);
    }
  }, [currentPassword, newPassword, confirmPassword, t]);

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
        <h2 className="text-2xl font-bold md:text-3xl">{t("system_settings")}</h2>
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
        <section className="ghost-border rounded-xl bg-surface-container p-4 md:p-6">
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
                onChange={(e) => dispatch({ type: "SET_FIELD", field: "savePath", value: e.target.value })}
                placeholder={t("save_path_placeholder")}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none"
              />
              <p className="text-[10px] text-on-surface-variant/50">
                {t("save_path_hint")}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                {t("lang_priority")}
              </label>
              <input
                type="text"
                value={preferredGroups}
                onChange={(e) => dispatch({ type: "SET_FIELD", field: "preferredGroups", value: e.target.value })}
                placeholder="e.g. KitaujiSub,DMG"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                {t("media_paths")}
              </label>
              <input
                type="text"
                value={mediaPaths}
                onChange={(e) => dispatch({ type: "SET_FIELD", field: "mediaPaths", value: e.target.value })}
                placeholder="/media/movies,/media/tv"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                {t("api_timeout")}
              </label>
              <input
                type="number"
                value={timeout}
                onChange={(e) => dispatch({ type: "SET_FIELD", field: "timeout", value: Number(e.target.value) })}
                min={5}
                max={300}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Debug Subtitle Toggle */}
          <div className="mt-6 border-t border-outline-variant/20 pt-6">
            <div className="group flex items-center justify-between">
              <div className="pr-4">
                <p className="text-sm font-bold transition-colors group-hover:text-primary">
                  {t("debug_subtitle_enabled")}
                </p>
                <p className="text-[10px] leading-relaxed text-on-surface-variant">
                  {t("debug_subtitle_enabled_hint")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dispatch({ type: "SET_DEBUG_SUBTITLE", payload: !debugSubtitleEnabled })}
                className={`relative h-6 w-12 flex-shrink-0 cursor-pointer rounded-full transition-all duration-300 ${
                  debugSubtitleEnabled ? "bg-primary-container" : "bg-surface-variant"
                }`}
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <div
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all duration-300 ${
                    debugSubtitleEnabled ? "right-1" : "left-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Poster Systems */}
          <div className="mt-6 border-t border-outline-variant/20 pt-6">
            <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              {t("poster_systems_label")}
            </label>
            <p className="mb-3 text-[10px] text-on-surface-variant/50">
              {t("poster_systems_hint")}
            </p>
            <div className="flex flex-wrap gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={posterSystems.includes("kodi")}
                  onChange={() => togglePosterSystem("kodi")}
                  className="h-4 w-4 accent-primary"
                />
                {t("poster_system_kodi")}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={posterSystems.includes("emby")}
                  onChange={() => togglePosterSystem("emby")}
                  className="h-4 w-4 accent-primary"
                />
                {t("poster_system_emby")}
              </label>
            </div>
          </div>

          {/* Advanced settings - collapsible */}
          <details className="mt-6">
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:text-primary">
              {t("advanced_settings")}
            </summary>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  {t("download_timeout")}
                </label>
                <input
                  type="number"
                  value={downloadTimeout}
                  onChange={(e) => dispatch({ type: "SET_FIELD", field: "downloadTimeout", value: Number(e.target.value) })}
                  min={10}
                  max={600}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface focus:border-primary focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  {t("chunk_size")}
                </label>
                <input
                  type="number"
                  value={chunkSize}
                  onChange={(e) => dispatch({ type: "SET_FIELD", field: "chunkSize", value: Number(e.target.value) })}
                  min={1024}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface focus:border-primary focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  {t("rate_limit")}
                </label>
                <input
                  type="number"
                  value={rateLimit}
                  onChange={(e) => dispatch({ type: "SET_FIELD", field: "rateLimit", value: Number(e.target.value) })}
                  min={0}
                  max={60}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface focus:border-primary focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  {t("retry_count")}
                </label>
                <input
                  type="number"
                  value={retryCount}
                  onChange={(e) => dispatch({ type: "SET_FIELD", field: "retryCount", value: Number(e.target.value) })}
                  min={0}
                  max={10}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface focus:border-primary focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  {t("retry_delay")}
                </label>
                <input
                  type="number"
                  value={retryDelay}
                  onChange={(e) => dispatch({ type: "SET_FIELD", field: "retryDelay", value: Number(e.target.value) })}
                  min={0}
                  max={30}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </details>
        </section>

        {/* Subtitle Sources */}
        <section className="ghost-border rounded-xl bg-surface-container p-4 md:p-6">
          <div className="mb-6 flex items-center gap-2 border-b border-outline-variant/20 pb-2">
            <ExternalLink className="text-secondary" size={20} />
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold">{t("subtitle_sources")}</h3>
              <span className="rounded-full bg-tertiary/15 px-2 py-0.5 text-[9px] font-bold text-tertiary">仅展示</span>
            </div>
          </div>
          <div className="space-y-4">
            <div className="ghost-border flex items-center justify-between rounded-lg bg-surface-container-low p-4 transition-colors hover:bg-surface-container">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded bg-white/10">
                  <div className="h-6 w-6 rounded-sm bg-primary/40" />
                </div>
                <div>
                  <p className="text-sm font-bold">{t("xunlei_subtitle_api")}</p>
                  <p className="text-[10px] font-bold uppercase text-on-surface-variant">
                    {t("active_default_source")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowApiSchema(true)}
                className="rounded-lg border border-outline-variant px-4 py-2 text-xs font-bold transition-colors hover:bg-surface-container-high"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {t("configure")}
              </button>
            </div>
          </div>
        </section>

        {/* Automation */}
        <section className="ghost-border rounded-xl bg-surface-container p-4 md:p-6">
          <div className="mb-6 flex items-center gap-2 border-b border-outline-variant/20 pb-2">
            <ScannerIcon className="text-primary" size={20} />
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold">{t("automation")}</h3>
              <span className="rounded-full bg-tertiary/15 px-2 py-0.5 text-[9px] font-bold text-tertiary">未实现</span>
            </div>
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
        <section className="ghost-border rounded-xl bg-surface-container p-4 md:p-6">
          <div className="mb-6 flex items-center gap-2 border-b border-outline-variant/20 pb-2">
            <Key className="text-tertiary" size={20} />
            <h3 className="text-lg font-bold">{t("change_password")}</h3>
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
                {t("current_password")}
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
                {t("new_password")}
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
                {t("confirm_password")}
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
              {isChangingPassword ? t("changing") : t("change_password")}
            </button>
          </div>
        </section>

        {/* Action Footer */}
        <div className="flex items-center justify-stretch gap-4 pt-4 md:justify-end">
          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={isSaving}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-outline px-8 py-3 text-sm font-bold transition-all hover:bg-surface-container-high active:scale-95 disabled:opacity-50 md:w-auto"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <RotateCcw size={14} />
            {t("reset_defaults")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-container px-8 py-3 text-sm font-bold text-on-primary-container shadow-[0_0_20px_rgba(0,164,220,0.3)] transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 md:w-auto"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {t("save_changes")}
          </button>
        </div>
      </div>

      {/* API Schema Dialog */}
      <ConfirmDialog
        open={showApiSchema}
        onClose={() => setShowApiSchema(false)}
        title={t("xunlei_subtitle_api")}
        cancelLabel={t("cancel")}
      >
        <pre className="mt-2 max-h-96 overflow-y-auto rounded bg-black/30 p-4 font-mono text-xs leading-relaxed text-on-surface">
{`GET https://api-shoulei-ssl.xunlei.com/oracle/subtitle?name={keyword}

Response:
{
  "code": 0,
  "msg": "success",
  "data": [
    {
      "gcid": "abc123",           // 全局字幕ID
      "cid": "def456",            // 字幕ID
      "url": "https://...",       // 下载地址
      "ext": "srt",               // 文件扩展名
      "name": "字幕名称",          // 字幕名称
      "duration": 7500000,        // 时长(毫秒)
      "languages": ["Chinese"],   // 语言列表
      "source": 1,                // 来源
      "score": 85.5,              // 评分
      "fingerprintf_score": 90.0, // 指纹评分
      "extra_name": "附加信息",   // 额外名称
      "mt": 0                     // 机器翻译标记
    }
  ]
}`}
        </pre>
      </ConfirmDialog>
    </div>
  );
}

export default withAuth(SettingsPage);
