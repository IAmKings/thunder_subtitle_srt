'use client';

import type { Subtitle } from '@/lib/types';

interface SubtitleItemProps {
  subtitle: Subtitle;
  isSelected: boolean;
  onSelect: (subtitle: Subtitle) => void;
  onDownload: (subtitle: Subtitle) => void;
}

export function SubtitleItem({ subtitle, isSelected, onSelect, onDownload }: SubtitleItemProps) {
  const handleDownload = () => {
    onDownload(subtitle);
    // Trigger browser download
    const link = document.createElement('a');
    link.href = subtitle.url;
    link.download = `${subtitle.name}.${subtitle.ext}`;
    link.click();
  };

  return (
    <div className="flex items-center gap-4 p-4 border-b border-zinc-200 hover:bg-zinc-50 transition-colors">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onSelect(subtitle)}
        className="w-5 h-5 rounded border-zinc-400 text-blue-600 focus:ring-blue-500 cursor-pointer"
      />
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-zinc-900 truncate">{subtitle.name}</h3>
        <div className="flex items-center gap-3 mt-1 text-sm text-zinc-500">
          <span className="uppercase">{subtitle.ext}</span>
          {subtitle.languages.length > 0 && (
            <span>{subtitle.languages.join(', ')}</span>
          )}
          {subtitle.duration > 0 && (
            <span>{Math.round(subtitle.duration / 60)}分钟</span>
          )}
        </div>
      </div>
      <button
        onClick={handleDownload}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
      >
        下载
      </button>
    </div>
  );
}
