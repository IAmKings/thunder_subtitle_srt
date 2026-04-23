'use client';

import type { Subtitle } from '@/lib/types';
import { SubtitleItem } from './SubtitleItem';

interface SubtitleListProps {
  subtitles: Subtitle[];
  selectedSubtitles: Subtitle[];
  onSelect: (subtitle: Subtitle) => void;
  onDownload: (subtitle: Subtitle) => void;
  onSelectAll: () => void;
  onDownloadSelected: () => void;
}

export function SubtitleList({
  subtitles,
  selectedSubtitles,
  onSelect,
  onDownload,
  onSelectAll,
  onDownloadSelected,
}: SubtitleListProps) {
  const allSelected = subtitles.length > 0 && selectedSubtitles.length === subtitles.length;

  const handleDownloadSelected = () => {
    // Download all selected subtitles
    selectedSubtitles.forEach((subtitle) => {
      const link = document.createElement('a');
      link.href = subtitle.url;
      link.download = `${subtitle.name}.${subtitle.ext}`;
      link.click();
    });
    onDownloadSelected();
  };

  return (
    <div className="w-full max-w-3xl mt-8 bg-white rounded-lg border border-zinc-200 shadow-sm">
      {subtitles.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-zinc-50">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onSelectAll}
                className="w-5 h-5 rounded border-zinc-400 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-zinc-600">
                全选 ({selectedSubtitles.length}/{subtitles.length})
              </span>
            </label>
          </div>
          {selectedSubtitles.length > 0 && (
            <button
              onClick={handleDownloadSelected}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
            >
              批量下载 ({selectedSubtitles.length})
            </button>
          )}
        </div>
      )}
      <div className="divide-y divide-zinc-100">
        {subtitles.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            未找到字幕，请尝试其他关键词
          </div>
        ) : (
          subtitles.map((subtitle) => (
            <SubtitleItem
              key={`${subtitle.gcid}-${subtitle.cid}`}
              subtitle={subtitle}
              isSelected={selectedSubtitles.some(
                (s) => s.gcid === subtitle.gcid && s.cid === subtitle.cid
              )}
              onSelect={onSelect}
              onDownload={onDownload}
            />
          ))
        )}
      </div>
    </div>
  );
}
