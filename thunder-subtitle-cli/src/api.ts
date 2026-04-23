/**
 * API client for Xunlei Subtitle API
 */

import axios from 'axios';
import type { ApiResponse, SearchResult, Subtitle } from './types.js';

const API_BASE_URL = 'https://api-shoulei-ssl.xunlei.com/oracle';
const DEFAULT_TIMEOUT = 30000;

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
   * Filter Chinese subtitles (by language field or name pattern)
   */
  filterChineseSubtitles(subtitles: Subtitle[]): Subtitle[] {
    return subtitles.filter((subtitle) => {
      // Check if languages array contains Chinese indicators
      const hasChineseLang = subtitle.languages.some((lang) =>
        /chinese|中文|简体|繁体|cn/i.test(lang)
      );
      // Also check name for Chinese patterns
      const hasChineseName = /[\u4e00-\u9fa5]/.test(subtitle.name);
      // If languages array is empty but name has Chinese, include it
      const isEmptyLang = subtitle.languages.length === 0 || subtitle.languages[0] === '';

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

// Default export instance
export const subtitleApiClient = new SubtitleApiClient();
