/**
 * Download functionality for subtitles
 */

import axios from 'axios';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import type { Subtitle } from './types.js';
import { displayDownloadProgress, displayDownloadComplete, displayError } from './ui.js';

export interface DownloadResult {
  success: boolean;
  filename: string;
  filepath: string;
  error?: string;
}

/**
 * Download a single subtitle file
 */
export async function downloadSubtitle(
  subtitle: Subtitle,
  outputDir: string
): Promise<DownloadResult> {
  const filename = subtitle.name;
  const filepath = path.join(outputDir, filename);

  // Ensure output directory exists
  try {
    fs.mkdirSync(outputDir, { recursive: true });
  } catch (err) {
    return {
      success: false,
      filename,
      filepath,
      error: `Failed to create output directory: ${(err as Error).message}`,
    };
  }

  // Check if file already exists
  if (fs.existsSync(filepath)) {
    console.log(chalk.yellow(`  ⚠ File already exists, skipping: ${filename}`));
    return { success: true, filename, filepath };
  }

  try {
    const response = await axios.get(subtitle.url, {
      responseType: 'stream',
      timeout: 60000,
    });

    const contentLength = response.headers['content-length'];
    const totalLength = typeof contentLength === 'string' ? parseInt(contentLength, 10) : 0;
    let downloaded = 0;

    const writer = fs.createWriteStream(filepath);

    response.data.on('data', (chunk: Buffer) => {
      downloaded += chunk.length;
      if (totalLength > 0) {
        displayDownloadProgress(filename, downloaded, totalLength);
      }
    });

    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    displayDownloadComplete(filename, filepath);

    return { success: true, filename, filepath };
  } catch (err) {
    // Clean up partial file on error
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    displayError(`Failed to download ${filename}: ${errorMessage}`);

    return {
      success: false,
      filename,
      filepath,
      error: errorMessage,
    };
  }
}

/**
 * Download multiple subtitles in batch
 */
export async function downloadBatch(
  subtitles: Subtitle[],
  outputDir: string,
  onProgress?: (completed: number, total: number) => void
): Promise<{ successful: number; failed: number; results: DownloadResult[] }> {
  console.log(chalk.bold(`\n  Downloading ${subtitles.length} subtitle(s) to: ${outputDir}\n`));

  const results: DownloadResult[] = [];
  let successful = 0;
  let failed = 0;

  for (let i = 0; i < subtitles.length; i++) {
    const subtitle = subtitles[i];
    if (!subtitle) {
      continue;
    }
    const result = await downloadSubtitle(subtitle, outputDir);
    results.push(result);

    if (result.success) {
      successful++;
    } else {
      failed++;
    }

    if (onProgress) {
      onProgress(i + 1, subtitles.length);
    }
  }

  return { successful, failed, results };
}

/**
 * Get default download directory
 */
export function getDefaultDownloadDir(): string {
  const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? '.';
  return path.join(homeDir, 'Downloads', 'thunder-subtitles');
}
