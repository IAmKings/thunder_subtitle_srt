/**
 * Shared utility functions for Thunder Subtitle Web
 */

/**
 * Extract the movie/subtitle file name from a file path.
 */
export function getMovieName(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1] || filePath;
}
