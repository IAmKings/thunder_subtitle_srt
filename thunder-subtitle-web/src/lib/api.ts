/**
 * API client for Xunlei Subtitle API
 * Uses Next.js API route as proxy to avoid CORS issues
 */

const API_BASE_URL = '/api';
const DEFAULT_TIMEOUT = 30000;

export interface SearchResult {
  subtitles: import('./types').Subtitle[];
  total: number;
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
      const response = await fetch(`${this.baseUrl}/subtitle?name=${encodeURIComponent(name.trim())}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as import('./types').ApiResponse;

      if (data.code !== 0) {
        throw new Error(`API error: code ${data.code}, msg: ${data.msg ?? 'unknown'}`);
      }

      const subtitles = data.data ?? [];

      return {
        subtitles,
        total: subtitles.length,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'TimeoutError') {
          throw new Error('Request timeout - please try again');
        }
        throw error;
      }
      throw new Error('Unknown error occurred');
    }
  }

  /**
   * Filter Chinese subtitles (by language field or name pattern)
   */
  filterChineseSubtitles(subtitles: import('./types').Subtitle[]): import('./types').Subtitle[] {
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
  getDownloadUrl(subtitle: import('./types').Subtitle): string {
    return subtitle.url;
  }
}

// Default export instance
export const subtitleApiClient = new SubtitleApiClient();
