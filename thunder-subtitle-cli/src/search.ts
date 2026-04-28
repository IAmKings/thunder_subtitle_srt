/**
 * Search command - search and select subtitles interactively
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import { SubtitleApiClient, parseDuration } from './api.js';
import { displaySubtitleList, displayError, displaySuccess } from './ui.js';
import { downloadSubtitle, downloadBatch, getDefaultDownloadDir } from './download.js';
import type { Subtitle } from './types.js';

export interface SearchCommandOptions {
  name: string;
  chineseOnly: boolean;
  multiSelect: boolean;
  outputDir?: string;
  maxDuration?: string;
  chineseFirst?: boolean;
}

const client = new SubtitleApiClient();

/**
 * Execute search command
 */
export async function searchCommand(options: SearchCommandOptions): Promise<void> {
  const { name, chineseOnly, multiSelect, outputDir, maxDuration, chineseFirst } = options;
  const output = outputDir ?? getDefaultDownloadDir();

  // Parse max duration if provided
  let maxDurationMs: number | undefined;
  if (maxDuration) {
    try {
      maxDurationMs = parseDuration(maxDuration);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid duration format';
      displayError(message);
      return;
    }
  }

  console.log(chalk.bold(`\n  Searching for: "${name}"`));
  if (chineseOnly) {
    console.log(chalk.gray('  Filtering: Chinese subtitles only'));
  }
  if (maxDuration && maxDurationMs) {
    console.log(chalk.gray(`  Filtering: Max video duration ${maxDuration}`));
  }
  if (chineseFirst && !chineseOnly) {
    console.log(chalk.gray('  Priority: Chinese subtitles first'));
  }
  console.log();

  try {
    // Search subtitles
    const result = await client.searchSubtitles(name);

    if (result.subtitles.length === 0) {
      displayError('No subtitles found for the given search term.');
      return;
    }

    // Apply Chinese filter if requested
    let subtitles = result.subtitles;
    if (chineseOnly) {
      subtitles = client.filterChineseSubtitles(subtitles);

      if (subtitles.length === 0) {
        displayError('No Chinese subtitles found for the given search term.');
        return;
      }
    }

    // Apply max duration filter if requested
    if (maxDurationMs !== undefined) {
      subtitles = client.filterByMaxDuration(subtitles, maxDurationMs);

      if (subtitles.length === 0) {
        displayError(
          `No subtitles found with video duration within ${maxDuration} (${maxDurationMs}ms).`
        );
        return;
      }
    }

    console.log(chalk.green(`\n  Found ${result.total} subtitle(s)`));
    let filterInfo = '';
    if (chineseOnly) {
      filterInfo += `Chinese-only: ${subtitles.length}`;
    }
    if (maxDurationMs !== undefined) {
      if (filterInfo) filterInfo += ', ';
      filterInfo += `Max duration ${maxDuration}: ${subtitles.length}`;
    }
    if (chineseFirst && !chineseOnly) {
      if (filterInfo) filterInfo += ', ';
      filterInfo += 'Chinese-first';
    }
    if (filterInfo) {
      console.log(chalk.green(`  Filtered (${filterInfo})`));
    }

    // 中文字幕优先排序：中文排前面，非中文排后面
    if (chineseFirst && !chineseOnly) {
      subtitles = [...subtitles].sort((a, b) => {
        const aIsChinese = client.isChineseSubtitle(a);
        const bIsChinese = client.isChineseSubtitle(b);
        if (aIsChinese && !bIsChinese) return -1;
        if (!aIsChinese && bIsChinese) return 1;
        return 0;
      });
    }

    // Display subtitle list
    displaySubtitleList(subtitles);

    // Interactive selection
    const selectedSubtitles = await selectSubtitles(subtitles, multiSelect);

    if (selectedSubtitles.length === 0) {
      console.log(chalk.gray('  No subtitles selected, exiting.\n'));
      return;
    }

    // Confirm download
    const confirm = await inquirer.prompt<{ confirmed: boolean }>([
      {
        type: 'confirm',
        name: 'confirmed',
        message: `Download ${selectedSubtitles.length} selected subtitle(s) to ${output}?`,
        default: true,
      },
    ]);

    if (!confirm.confirmed) {
      console.log(chalk.gray('  Download canceled.\n'));
      return;
    }

    // Download selected subtitles
    const firstSubtitle = selectedSubtitles[0];
    if (!firstSubtitle) {
      displayError('No subtitle selected for download.');
      return;
    }

    // 构建下载文件名：{搜索名}{.zh}.{ext}
    const buildFilename = (subtitle: Subtitle): string => {
      const isChinese = client.isChineseSubtitle(subtitle);
      const suffix = isChinese ? '.zh' : '';
      return `${name}${suffix}.${subtitle.ext}`;
    };

    if (selectedSubtitles.length === 1) {
      const filename = buildFilename(firstSubtitle);
      const result = await downloadSubtitle(firstSubtitle, output, filename);
      if (result.success) {
        displaySuccess(`Downloaded: ${result.filename}`);
      }
    } else {
      const filenames = selectedSubtitles.map((s) => buildFilename(s));
      const batchResult = await downloadBatch(selectedSubtitles, output, filenames);
      displaySuccess(
        `Batch download complete: ${batchResult.successful} successful, ${batchResult.failed} failed`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    displayError(message);
    throw err;
  }
}

/**
 * Interactive subtitle selection
 */
async function selectSubtitles(subtitles: Subtitle[], multiSelect: boolean): Promise<Subtitle[]> {
  if (multiSelect) {
    const choices = subtitles.map((subtitle, index) => ({
      name: `${index + 1}. ${subtitle.name} (${subtitle.ext.toUpperCase()})`,
      value: index,
      checked: false,
    }));

    const { indices } = await inquirer.prompt<{ indices: number[] }>([
      {
        type: 'checkbox',
        name: 'indices',
        message: 'Select subtitles to download (press Enter to confirm):',
        choices,
        pageSize: 15,
      },
    ]);

    return indices.map((i) => subtitles[i]).filter((s): s is Subtitle => s !== undefined);
  } else {
    const choices = subtitles.map((subtitle, index) => ({
      name: `${index + 1}. ${subtitle.name} (${subtitle.ext.toUpperCase()})`,
      value: index,
    }));

    const { index } = await inquirer.prompt<{ index: number }>([
      {
        type: 'list',
        name: 'index',
        message: 'Select a subtitle to download:',
        choices,
        pageSize: 15,
      },
    ]);

    return [subtitles[index]].filter((s): s is Subtitle => s !== undefined);
  }
}
