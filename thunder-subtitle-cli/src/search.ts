/**
 * Search command - search and select subtitles interactively
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import { SubtitleApiClient } from './api.js';
import { displaySubtitleList, displayError, displaySuccess } from './ui.js';
import { downloadSubtitle, downloadBatch, getDefaultDownloadDir } from './download.js';
import type { Subtitle } from './types.js';

export interface SearchCommandOptions {
  name: string;
  chineseOnly: boolean;
  multiSelect: boolean;
  outputDir?: string;
}

const client = new SubtitleApiClient();

/**
 * Execute search command
 */
export async function searchCommand(options: SearchCommandOptions): Promise<void> {
  const { name, chineseOnly, multiSelect, outputDir } = options;
  const output = outputDir ?? getDefaultDownloadDir();

  console.log(chalk.bold(`\n  Searching for: "${name}"`));
  if (chineseOnly) {
    console.log(chalk.gray('  Filtering: Chinese subtitles only\n'));
  }

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

    console.log(chalk.green(`\n  Found ${result.total} subtitle(s)`));
    if (chineseOnly) {
      console.log(chalk.green(`  Filtered to ${subtitles.length} Chinese subtitle(s)`));
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

    if (selectedSubtitles.length === 1) {
      const result = await downloadSubtitle(firstSubtitle, output);
      if (result.success) {
        displaySuccess(`Downloaded: ${result.filename}`);
      }
    } else {
      const batchResult = await downloadBatch(selectedSubtitles, output);
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
