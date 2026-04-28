/**
 * API client for Xunlei Subtitle API
 */

import axios from 'axios';
import type { ApiResponse, SearchResult, Subtitle } from './types.js';

const API_BASE_URL = 'https://api-shoulei-ssl.xunlei.com/oracle';
const DEFAULT_TIMEOUT = 30000;

/**
 * Parse human-readable duration string to milliseconds
 * Supports: 1h, 30m, 45s, 1h30m, 2h30m20s, etc.
 */
export function parseDuration(durationStr: string): number {
  const trimmed = durationStr.trim().toLowerCase();
  if (!trimmed) {
    throw new Error('Duration string cannot be empty');
  }

  let totalMs = 0;
  let hasMatch = false;

  // Match hours: Xh
  const hoursMatch = trimmed.match(/(\d+)h/);
  if (hoursMatch?.[1]) {
    totalMs += parseInt(hoursMatch[1], 10) * 3600000;
    hasMatch = true;
  }

  // Match minutes: Xm
  const minutesMatch = trimmed.match(/(\d+)m/);
  if (minutesMatch?.[1]) {
    totalMs += parseInt(minutesMatch[1], 10) * 60000;
    hasMatch = true;
  }

  // Match seconds: Xs
  const secondsMatch = trimmed.match(/(\d+)s/);
  if (secondsMatch?.[1]) {
    totalMs += parseInt(secondsMatch[1], 10) * 1000;
    hasMatch = true;
  }

  if (!hasMatch) {
    throw new Error(
      `Invalid duration format: "${durationStr}". Expected format like 1h30m, 90m, 45s`
    );
  }

  return totalMs;
}

export class SubtitleApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = API_BASE_URL, timeout: number = DEFAULT_TIMEOUT) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  /**
   * Search subtitles by name keyword
   */
  async searchSubtitles(name: string): Promise<SearchResult> {
    if (!name || name.trim().length === 0) {
      throw new Error('Search keyword cannot be empty');
    }

    try {
      const response = await axios.get<ApiResponse>(`${this.baseUrl}/subtitle`, {
        params: { name: name.trim() },
        timeout: this.timeout,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.data.code !== 0) {
        throw new Error(`API error: code ${response.data.code}, msg: ${response.data.msg ?? 'unknown'}`);
      }

      const subtitles = response.data.data ?? [];

      return {
        subtitles,
        total: subtitles.length,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Request timeout - please try again');
        }
        if (error.response) {
          throw new Error(`API request failed: ${error.response.status} ${error.response.statusText}`);
        }
        throw new Error(`Network error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Check if a single subtitle is Chinese
   */
  isChineseSubtitle(subtitle: Subtitle): boolean {
    const hasChineseLang = subtitle.languages.some((lang) =>
      /chinese|中文|简体|繁体|cn/i.test(lang)
    );
    const hasChineseName =
      /[\u4e00-\u9fa5]/.test(subtitle.name) ||
      /zh|cn|chinese|中文/i.test(subtitle.name);
    const isEmptyLang = subtitle.languages.length === 0 || subtitle.languages[0] === '';

    return hasChineseLang || (hasChineseName && isEmptyLang);
  }

  /**
   * Filter Chinese subtitles (by language field or name pattern)
   */
  filterChineseSubtitles(subtitles: Subtitle[]): Subtitle[] {
    return subtitles.filter((subtitle) => this.isChineseSubtitle(subtitle));
  }

  /**
   * Filter subtitles by max video duration
   * Keeps only subtitles where 0 < duration <= maxDurationMs
   * Sorted by duration descending (closest to target duration first)
   */
  filterByMaxDuration(subtitles: Subtitle[], maxDurationMs: number): Subtitle[] {
    return subtitles
      .filter((subtitle) => subtitle.duration > 0 && subtitle.duration <= maxDurationMs)
      .sort((a, b) => b.duration - a.duration);
  }

  /**
   * Get direct download URL for a subtitle
   */
  getDownloadUrl(subtitle: Subtitle): string {
    return subtitle.url;
  }
}

// Default export instance
export const subtitleApiClient = new SubtitleApiClient();
