"use client";

import type { MovieEntry } from "@/lib/types";

interface MovieListProps {
  paginatedMovies: MovieEntry[];
  handleSelectMovie: (filePath: string) => void;
  t: (key: string) => string;
}

export function MovieList({ paginatedMovies, handleSelectMovie, t }: MovieListProps) {
  return (
    <>
      {paginatedMovies.map((movie, i) => (
        <button
          key={`${i}-${movie.path}`}
          type="button"
          onClick={() => handleSelectMovie(movie.path)}
          className="rounded-lg border border-outline-variant/30 bg-surface-container p-3 text-left transition-all hover:border-primary/50 md:p-5"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <div className="flex items-start gap-3">
            <img
              src={`/api/media/image?path=${encodeURIComponent(movie.path + "/folder.jpg")}&width=96`}
              loading="lazy"
              className="h-16 w-11 flex-shrink-0 rounded object-cover bg-surface-container-highest"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              alt={movie.name}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold">{movie.name}</p>
              <p className="mt-1 truncate text-[11px] text-on-surface-variant">{movie.path}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold text-primary">
                {movie.sub_files.length} {t("files")}
              </span>
              {movie.duration_seconds > 0 && (
                <span className="text-[10px] tabular-nums text-on-surface-variant/60">
                  {String(Math.floor(movie.duration_seconds / 3600)).padStart(2, "0")}:
                  {String(Math.floor((movie.duration_seconds % 3600) / 60)).padStart(2, "0")}:
                  {String(Math.floor(movie.duration_seconds % 60)).padStart(2, "0")}
                </span>
              )}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3 text-[10px] text-on-surface-variant">
            <span className="text-green-400">✓ {movie.review_status === "ok" ? "1" : "0"}</span>
            <span className="text-error">✗ {movie.review_status === "fail" ? "1" : "0"}</span>
            <span>{t("untagged")}: {movie.review_status === "not_reviewed" ? movie.sub_files.length : "0"}</span>
          </div>
        </button>
      ))}
    </>
  );
}
