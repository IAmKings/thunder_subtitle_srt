/**
 * TUI components for interactive subtitle selection
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import type { Subtitle } from './types.js';

export interface SelectionResult {
  selected: Subtitle[];
  canceled: boolean;
}

/**
 * Display subtitle list in a formatted table
 */
export function displaySubtitleList(subtitles: Subtitle[]): void {
  console.log(chalk.bold('\n  Found subtitles:\n'));

  subtitles.forEach((subtitle, index) => {
    const isChinese = /[\u4e00-\u9fa5]/.test(subtitle.name);
    const chineseTag = isChinese ? chalk.green('[CN]') : chalk.gray('[--]');
    const duration = formatDuration(subtitle.duration);

    console.log(
      `  ${chalk.yellow(String(index + 1).padStart(2, ' '))}. ${chineseTag} ${subtitle.name}`
    );
    console.log(`      ${chalk.gray('Duration:')} ${duration} | ${chalk.gray('Format:')} ${subtitle.ext.toUpperCase()}`);
    console.log();
  });
}

/**
 * Single selection prompt
 */
export async function selectSubtitle(subtitles: Subtitle[]): Promise<Subtitle | null> {
  if (subtitles.length === 0) {
    console.log(chalk.yellow('  No subtitles available for selection.\n'));
    return null;
  }

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
      pageSize: 10,
    },
  ]);

  return subtitles[index] ?? null;
}

/**
 * Multiple selection prompt
 */
export async function selectMultipleSubtitles(subtitles: Subtitle[]): Promise<Subtitle[]> {
  if (subtitles.length === 0) {
    console.log(chalk.yellow('  No subtitles available for selection.\n'));
    return [];
  }

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
      pageSize: 10,
    },
  ]);

  return indices.map((i) => subtitles[i]).filter((s): s is Subtitle => s !== undefined);
}

/**
 * Confirm action prompt
 */
export async function confirmAction(message: string): Promise<boolean> {
  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    {
      type: 'confirm',
      name: 'confirmed',
      message,
      default: true,
    },
  ]);

  return confirmed;
}

/**
 * Format duration from milliseconds to readable string
 */
function formatDuration(ms: number): string {
  if (ms === 0) {
    return 'Unknown';
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

/**
 * Display download progress
 */
export function displayDownloadProgress(filename: string, downloaded: number, total: number): void {
  const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0;
  const bar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5));

  process.stdout.write(`\r  ${chalk.cyan(filename)}: [${bar}] ${percent}%`);
  if (downloaded >= total) {
    process.stdout.write('\n');
  }
}

/**
 * Display download complete message
 */
export function displayDownloadComplete(filename: string, filepath: string): void {
  console.log(chalk.green(`\n  ✓ Downloaded: ${filename}`));
  console.log(chalk.gray(`    Saved to: ${filepath}\n`));
}

/**
 * Display error message
 */
export function displayError(message: string): void {
  console.error(chalk.red(`\n  ✗ Error: ${message}\n`));
}

/**
 * Display success message
 */
export function displaySuccess(message: string): void {
  console.log(chalk.green(`\n  ✓ ${message}\n`));
}
