/**
 * API client for Thunder Subtitle
 *
 * Supports both:
 * 1. Next.js API route proxy (legacy, for search)
 * 2. FastAPI backend (new, for all operations including auth, config, tasks, etc.)
 */

import type {
  Subtitle,
  ApiResponse,
  SearchResult,
  TaskResponse,
  AppConfig,
  ReviewItem,
  MovieEntry,
  HealthCheckItem,
  ScheduledTask,
  MediaDirectory,
} from "@/lib/types";

export type { Subtitle, ApiResponse, SearchResult, TaskResponse, AppConfig, ReviewItem, MovieEntry, HealthCheckItem, ScheduledTask, MediaDirectory };

const FASTAPI_BASE_URL = "";  // Relative path, proxied via Nginx
const NEXTJS_API_BASE_URL = "/api";
const DEFAULT_TIMEOUT = 90000;

// ---- Token Management ----

const TOKEN_KEY = "thunder-subtitle-token";

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

// ---- Types (API-specific, not in types.ts) ----

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// ---- Helper ----

async function fastApiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const existingHeaders =
    options.headers instanceof Headers
      ? Object.fromEntries(options.headers.entries())
      : options.headers instanceof Array
        ? Object.fromEntries(options.headers as [string, string][])
        : (options.headers as Record<string, string> | undefined) ?? {};
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...existingHeaders,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${FASTAPI_BASE_URL}${path}`, {
      ...options,
      headers,
      signal: options.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error("请求超时");
    }
    throw error;
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthToken();
      window.location.href = "/login";
      throw new Error("未授权，正在跳转登录页");
    }
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

// ---- Subtitle API Client (legacy, uses Next.js proxy) ----

export class SubtitleApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = NEXTJS_API_BASE_URL, timeout: number = DEFAULT_TIMEOUT) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  /**
   * Search subtitles by name keyword (via Next.js proxy for CORS)
   */
  async searchSubtitles(name: string): Promise<SearchResult> {
    if (!name || name.trim().length === 0) {
      throw new Error("搜索关键词不能为空");
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/subtitle?name=${encodeURIComponent(name.trim())}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(this.timeout),
        }
      );

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as ApiResponse;

      if (data.code !== 0) {
        throw new Error(`API 错误: code ${data.code}, msg: ${data.msg ?? "未知"}`);
      }

      const subtitles = data.data ?? [];

      return {
        subtitles,
        total: subtitles.length,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "TimeoutError") {
          throw new Error("请求超时，请重试");
        }
        throw error;
      }
      throw new Error("发生未知错误");
    }
  }

  /**
   * Filter Chinese subtitles (by language field or name pattern)
   */
  filterChineseSubtitles(subtitles: Subtitle[]): Subtitle[] {
    return subtitles.filter((subtitle) => {
      const hasChineseLang = subtitle.languages.some((lang) =>
        /chinese|中文|简体|繁体|cn/i.test(lang)
      );
      const hasChineseName = /[\u4e00-\u9fa5]/.test(subtitle.name);
      const isEmptyLang = subtitle.languages.length === 0 || subtitle.languages[0] === "";

      return hasChineseLang || (hasChineseName && isEmptyLang);
    });
  }

  /**
   * Get direct download URL for a subtitle
   */
  getDownloadUrl(subtitle: Subtitle): string {
    return subtitle.url;
  }
}

// ---- FastAPI Backend Client ----

export class FastApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = FASTAPI_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // ---- Auth ----

  async login(username: string, password: string): Promise<LoginResponse> {
    const result = await fastApiFetch<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setAuthToken(result.access_token);
    return result;
  }

  async verifyToken(token: string): Promise<boolean> {
    try {
      const result = await fastApiFetch<{ valid: boolean }>("/api/auth/verify", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      return result.valid;
    } catch {
      return false;
    }
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return fastApiFetch<{ success: boolean; message: string }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    });
  }

  // ---- Search (via FastAPI) ----

  async searchSubtitles(
    name: string,
    options?: { chineseOnly?: boolean; chineseFirst?: boolean; maxDuration?: string }
  ): Promise<SearchResult> {
    const params = new URLSearchParams({ name });
    if (options?.chineseOnly) params.set("chinese_only", "true");
    if (options?.chineseFirst) params.set("chinese_first", "true");
    if (options?.maxDuration) params.set("max_duration", options.maxDuration);

    return fastApiFetch<SearchResult>(`/api/subtitle/search?${params.toString()}`);
  }

  // ---- Config ----

  async getConfig(): Promise<AppConfig> {
    return fastApiFetch<AppConfig>("/api/config");
  }

  async updateConfig(config: Partial<AppConfig>): Promise<AppConfig> {
    return fastApiFetch<AppConfig>("/api/config", {
      method: "PUT",
      body: JSON.stringify(config),
    });
  }

  async reloadConfig(): Promise<AppConfig> {
    return fastApiFetch<AppConfig>("/api/config/reload", { method: "POST" });
  }

  // ---- Tasks ----

  async createTask(type: "scan" | "review" | "dump", params: Record<string, unknown> = {}): Promise<TaskResponse> {
    return fastApiFetch<TaskResponse>("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ type, params }),
    });
  }

  async listTasks(status?: string): Promise<{ tasks: TaskResponse[]; total: number }> {
    const params = status ? `?status_filter=${status}` : "";
    return fastApiFetch<{ tasks: TaskResponse[]; total: number }>(`/api/tasks${params}`);
  }

  async getTask(taskId: string): Promise<TaskResponse> {
    return fastApiFetch<TaskResponse>(`/api/tasks/${taskId}`);
  }

  async cancelTask(taskId: string): Promise<TaskResponse> {
    return fastApiFetch<TaskResponse>(`/api/tasks/${taskId}/cancel`, { method: "POST" });
  }

  // ---- Media ----

  async listMediaDirectories(): Promise<MediaDirectory[]> {
    return fastApiFetch<MediaDirectory[]>("/api/media/directories");
  }

  async getNfoInfo(path: string): Promise<{
    path: string;
    duration_seconds: number;
    has_chinese_subtitle: boolean;
    release_date: string;
  }> {
    return fastApiFetch<{
      path: string;
      duration_seconds: number;
      has_chinese_subtitle: boolean;
      release_date: string;
    }>(`/api/media/nfo?path=${encodeURIComponent(path)}`);
  }

  // ---- Reviews ----

  /** 轻量电影发现 — 只做文件系统操作，不做深审（用于验证页电影列表） */
  async listMovies(baseDir: string, nameFilter?: string): Promise<{ movies: MovieEntry[] }> {
    const params = new URLSearchParams({ base_dir: baseDir });
    if (nameFilter) params.set("name_filter", nameFilter);
    return fastApiFetch<{ movies: MovieEntry[] }>(`/api/review/movies?${params.toString()}`);
  }

  /** 按需深审单个字幕文件（编码+SRT+CJK），用于验证页字幕详情 */
  async reviewSubtitleFile(baseDir: string, filePath: string, fileName: string): Promise<ReviewItem> {
    const params = new URLSearchParams({ base_dir: baseDir, path: filePath, file_name: fileName });
    return fastApiFetch<ReviewItem>(`/api/review/subtitle/file?${params.toString()}`);
  }

  async listReviews(baseDir: string, nameFilter?: string): Promise<{
    items: ReviewItem[];
    total: number;
  }> {
    const params = new URLSearchParams({ base_dir: baseDir });
    if (nameFilter) params.set("name_filter", nameFilter);
    return fastApiFetch<{ items: ReviewItem[]; total: number }>(`/api/review/list?${params.toString()}`);
  }

  async markReview(baseDir: string, path: string, status: "ok" | "fail"): Promise<{
    success: boolean;
    message: string;
  }> {
    return fastApiFetch<{ success: boolean; message: string }>("/api/review/mark", {
      method: "POST",
      body: JSON.stringify({ base_dir: baseDir, path, status }),
    });
  }

  async getSubtitlePreview(path: string, signal?: AbortSignal): Promise<{ content: string; encoding: string; total_lines: number }> {
    return fastApiFetch<{ content: string; encoding: string; total_lines: number }>(
      `/api/review/preview?path=${encodeURIComponent(path)}`,
      { signal }
    );
  }

  async deleteSubtitleFile(path: string): Promise<{ success: boolean }> {
    return fastApiFetch<{ success: boolean }>(
      `/api/review/file?path=${encodeURIComponent(path)}`,
      { method: "DELETE" }
    );
  }

  async renameSubtitleFile(path: string, newName: string): Promise<{ success: boolean; new_path: string }> {
    return fastApiFetch<{ success: boolean; new_path: string }>(
      "/api/review/rename",
      { method: "POST", body: JSON.stringify({ path, new_name: newName }) }
    );
  }

  // ---- Health Check ----

  async runHealthCheck(baseDir: string): Promise<{ results: HealthCheckItem[]; total: number }> {
    return fastApiFetch<{ results: HealthCheckItem[]; total: number }>(
      `/api/health-check?base_dir=${encodeURIComponent(baseDir)}`
    );
  }

  // ---- Scheduled Tasks ----

  async listScheduledTasks(): Promise<ScheduledTask[]> {
    return fastApiFetch<ScheduledTask[]>("/api/tasks/scheduled");
  }

  async saveScheduledTask(path: string, body: { enabled: boolean; cron: string; mode: string }): Promise<ScheduledTask> {
    return fastApiFetch<ScheduledTask>(`/api/tasks/scheduled/${encodeURIComponent(path)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  async deleteScheduledTask(path: string): Promise<{ success: boolean }> {
    return fastApiFetch<{ success: boolean }>(`/api/tasks/scheduled/${encodeURIComponent(path)}`, {
      method: "DELETE",
    });
  }
}

// ---- WebSocket Client ----

export class ProgressWebSocket {
  private ws: WebSocket | null = null;
  private baseUrl: string;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(baseUrl: string = FASTAPI_BASE_URL) {
    this.baseUrl = baseUrl.replace(/^http/, "ws");
  }

  connect(
    taskId: string,
    onProgress: (data: unknown) => void,
    options?: { onOpen?: () => void; onClose?: () => void }
  ): void {
    if (this.ws) {
      this.disconnect();
    }

    this.ws = new WebSocket(`${this.baseUrl}/ws/progress/${taskId}`);

    this.ws.onopen = () => {
      options?.onOpen?.();
      // Send a ping every 15s to keep the WebSocket alive
      this.pingInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 15000);
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data.type === "ping") return; // ignore server pings
        onProgress(data);
      } catch {
        // Ignore malformed messages
      }
    };

    this.ws.onerror = () => {
      // Connection error - will be followed by onclose
    };

    this.ws.onclose = () => {
      this._clearPing();
      this.ws = null;
      options?.onClose?.();
    };
  }

  private _clearPing(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  disconnect(): void {
    this._clearPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// ---- Default exports ----

export const fastApiClient = new FastApiClient();
