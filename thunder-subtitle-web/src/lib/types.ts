/**
 * Type definitions for Thunder Subtitle WebApp
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
