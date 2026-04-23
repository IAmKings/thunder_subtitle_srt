'use client';

import { useState, useCallback } from 'react';
import type { Subtitle } from '@/lib/types';
import { subtitleApiClient } from '@/lib/api';
import { SearchBox } from '@/components/SearchBox';
import { SubtitleList } from '@/components/SubtitleList';
import { SearchHistory, DownloadHistory } from '@/components/History';
import { useSearchHistory, useDownloadHistory } from '@/hooks/useHistory';

export function ThunderSubtitleApp() {
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [selectedSubtitles, setSelectedSubtitles] = useState<Subtitle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const {
    history: searchHistory,
    isHydrated: isSearchHydrated,
    addSearch,
    removeSearch,
    clearSearchHistory,
  } = useSearchHistory();

  const {
    history: downloadHistory,
    isHydrated: isDownloadHydrated,
    addDownload,
    removeDownload,
    clearDownloadHistory,
  } = useDownloadHistory();

  const handleSearch = useCallback(async (name: string) => {
    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setSubtitles([]);
    setSelectedSubtitles([]);

    try {
      const result = await subtitleApiClient.searchSubtitles(name);
      const chineseSubtitles = subtitleApiClient.filterChineseSubtitles(result.subtitles);
      setSubtitles(chineseSubtitles.length > 0 ? chineseSubtitles : result.subtitles);
      addSearch(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败，请稍后重试');
      setSubtitles([]);
    } finally {
      setIsLoading(false);
    }
  }, [addSearch]);

  const handleSelect = useCallback((subtitle: Subtitle) => {
    setSelectedSubtitles((prev) => {
      const isSelected = prev.some(
        (s) => s.gcid === subtitle.gcid && s.cid === subtitle.cid
      );
      if (isSelected) {
        return prev.filter((s) => !(s.gcid === subtitle.gcid && s.cid === subtitle.cid));
      } else {
        return [...prev, subtitle];
      }
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedSubtitles((prev) => {
      if (prev.length === subtitles.length) {
        return [];
      } else {
        return [...subtitles];
      }
    });
  }, [subtitles]);

  const handleDownload = useCallback((subtitle: Subtitle) => {
    addDownload(subtitle);
  }, [addDownload]);

  const handleDownloadSelected = useCallback(() => {
    // Already added to history via handleDownload calls
  }, []);

  return (
    <div className="min-h-screen flex flex-col" suppressHydrationWarning>
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 px-4 py-4">
        <div className="w-full max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-zinc-900">Thunder Subtitle</h1>
          <p className="text-sm text-zinc-500 mt-1">搜索并下载中文字幕</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-8">
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
          {/* Search Box */}
          <SearchBox onSearch={handleSearch} isLoading={isLoading} />

          {/* Error Message */}
          {error && (
            <div className="w-full max-w-2xl mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Search History */}
          <SearchHistory
            history={searchHistory}
            onSearch={handleSearch}
            onRemove={removeSearch}
            onClear={clearSearchHistory}
          />

          {/* Results */}
          {hasSearched && !isLoading && (
            <SubtitleList
              subtitles={subtitles}
              selectedSubtitles={selectedSubtitles}
              onSelect={handleSelect}
              onDownload={handleDownload}
              onSelectAll={handleSelectAll}
              onDownloadSelected={handleDownloadSelected}
            />
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="w-full max-w-2xl mt-8 p-8 text-center text-zinc-500">
              <div className="inline-flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                搜索中...
              </div>
            </div>
          )}

          {/* Download History */}
          <DownloadHistory
            history={downloadHistory}
            onRemove={removeDownload}
            onClear={clearDownloadHistory}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-zinc-200 px-4 py-4">
        <div className="w-full max-w-4xl mx-auto text-center text-sm text-zinc-500">
          Thunder Subtitle - 字幕搜索下载工具
        </div>
      </footer>
    </div>
  );
}
