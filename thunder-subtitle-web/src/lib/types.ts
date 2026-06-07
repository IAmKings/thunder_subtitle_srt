/**
 * Type definitions for Thunder Subtitle WebApp
 *
 * These types mirror the FastAPI backend schemas.
 * For types that come from the API, prefer importing from api.ts.
 */

export interface Subtitle {
  gcid: string;
  cid: string;
  url: string;
  ext: string;
  name: string;
  duration: number;
  languages: string[];
  source: number;
  score: number;
  fingerprintf_score: number;
  extra_name: string;
  mt: number;
  is_chinese?: boolean;
}

export interface ApiResponse {
  code: number;
  data: Subtitle[];
  msg?: string;
}

export interface SearchResult {
  subtitles: Subtitle[];
  total: number;
}

export interface HistoryItem {
  id: string;
  name: string;
  timestamp: number;
}

export interface DownloadHistoryItem extends HistoryItem {
  subtitle: Subtitle;
}

// ---- Task types ----

export type TaskType = "scan" | "review" | "dump";
export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface TaskResponse {
  id: string;
  type: TaskType;
  status: TaskStatus;
  progress: number;
  message: string;
  params: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  results?: ScanResultItem[];
}

// ---- Config types ----

export interface AppConfig {
  output_dir: string;
  timeout: number;
  download_timeout: number;
  chunk_size: number;
  rate_limit: number;
  retry_count: number;
  retry_delay: number;
  preferred_groups: string;
  media_paths: string;
  poster_systems: string[];
}

// ---- Review types ----

export type ReviewState = "ok" | "fail" | "not_reviewed";

export interface ReviewItem {
  file_path: string;
  file_name: string;
  quality: string;
  score: number;
  size_bytes: number;
  chinese_ratio: number;
  encoding: string;
  review_status: ReviewState;
  review_date: string;
  preferred: boolean;
  ai_flags: string[];
  last_end_ms: number;
  deductions: string[];
  checks: string[];
  entry_count: number;
  last_index: number;
}

// ---- Review MovieEntry (lightweight for movie list) ----

export interface MovieEntry {
  path: string;
  name: string;
  sub_files: string[];
  review_status: ReviewState;
  review_date: string;
  duration_seconds: number;
}

// ---- Media types ----

export interface MediaDirectory {
  path: string;
  name: string;
  movie_count: number;
  pending_review_count: number;
}

export interface ScheduledTask {
  directory_path: string;
  enabled: boolean;
  cron: string;
  mode: string;
  last_run: string;
  last_status: string;
  last_duration_seconds: number;
}

export interface NfoInfo {
  path: string;
  duration_seconds: number;
  has_chinese_subtitle: boolean;
  release_date: string;
}

// ---- Scan Result types ----

export interface ScanResultItem {
  movie_name: string;
  status: "downloaded" | "skipped" | "no_match" | "error";
  reason: string;
  filename: string;
  dry_state: "need_download" | "need_review" | "reviewed_ok" | "reviewed_fail" | "reviewed_fail_new_subs" | "skipped";
}

// ---- Health Check types ----

export interface HealthCheckItem {
  level: "ok" | "warning" | "info" | "error";
  path: string;
  movie_name: string;
  message: string;
}

export interface HealthCheckResponse {
  results: HealthCheckItem[];
  total: number;
}
