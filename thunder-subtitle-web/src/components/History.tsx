'use client';

import type { HistoryItem, DownloadHistoryItem } from '@/lib/types';

interface SearchHistoryProps {
  history: HistoryItem[];
  onSearch: (name: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

interface DownloadHistoryProps {
  history: DownloadHistoryItem[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;

  // Use a fixed format to avoid locale differences between server/client
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function SearchHistory({ history, onSearch, onRemove, onClear }: SearchHistoryProps) {
  if (history.length === 0) return null;

  return (
    <div className="w-full max-w-2xl mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-zinc-700">搜索历史</h2>
        <button
          onClick={onClear}
          className="text-sm text-zinc-500 hover:text-zinc-700"
        >
          清除
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {history.map((item) => (
          <div
            key={item.id}
            className="group flex items-center gap-2 px-3 py-1.5 bg-zinc-100 rounded-full"
          >
            <button
              onClick={() => onSearch(item.name)}
              className="text-sm text-zinc-700 hover:text-blue-600"
            >
              {item.name}
            </button>
            <span className="text-xs text-zinc-400">{formatTime(item.timestamp)}</span>
            <button
              onClick={() => onRemove(item.id)}
              className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-600 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DownloadHistory({ history, onRemove, onClear }: DownloadHistoryProps) {
  if (history.length === 0) return null;

  return (
    <div className="w-full max-w-2xl mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-zinc-700">下载历史</h2>
        <button
          onClick={onClear}
          className="text-sm text-zinc-500 hover:text-zinc-700"
        >
          清除
        </button>
      </div>
      <div className="space-y-2">
        {history.slice(0, 10).map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between px-4 py-2 bg-zinc-50 rounded-lg"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zinc-900 truncate">{item.name}</p>
              <p className="text-xs text-zinc-500">{formatTime(item.timestamp)}</p>
            </div>
            <button
              onClick={() => onRemove(item.id)}
              className="ml-4 text-zinc-400 hover:text-zinc-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
