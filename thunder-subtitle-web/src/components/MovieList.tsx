"use client";

import type { ReviewItem } from "@/lib/types";

interface MovieListProps {
  paginatedMovies: [string, ReviewItem[]][];
  handleSelectMovie: (filePath: string) => void;
  t: (key: string) => string;
}

function getMovieName(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1] || filePath;
}

export function MovieList({ paginatedMovies, handleSelectMovie, t }: MovieListProps) {
  return (
    <>
      {paginatedMovies.map(([filePath, movieItems], i) => (
        <button
          key={`${i}-${filePath}`}
          type="button"
          onClick={() => handleSelectMovie(filePath)}
          className="rounded-lg border border-outline-variant/30 bg-surface-container p-5 text-left transition-all hover:border-primary/50"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold">{getMovieName(filePath)}</p>
              <p className="mt-1 truncate text-[11px] text-on-surface-variant">{filePath}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold text-primary">
                {movieItems.length} {t("files")}
              </span>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3 text-[10px] text-on-surface-variant">
            <span className="text-green-400">✓ {movieItems.filter(i => i.review_status === "ok").length}</span>
            <span className="text-error">✗ {movieItems.filter(i => i.review_status === "fail").length}</span>
            <span>{t("untagged")}: {movieItems.filter(i => i.review_status === "not_reviewed").length}</span>
          </div>
        </button>
      ))}
    </>
  );
}
