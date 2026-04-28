#!/usr/bin/env node

/**
 * Thunder Subtitle CLI - Entry Point
 *
 * CLI tool for searching and downloading Chinese subtitles via Xunlei API
 */

import chalk from 'chalk';
import { Command } from 'commander';
import { searchCommand } from './search.js';

const program = new Command();

program
  .name('thunder-subtitle')
  .description('CLI tool for searching and downloading Chinese subtitles via Xunlei API')
  .version('0.1.0');

program
  .command('search')
  .description('Search for subtitles by name')
  .argument('<name>', 'Search keyword for subtitles')
  .option('-c, --chinese-only', 'Filter to Chinese subtitles only', false)
  .option('-m, --multi-select', 'Enable multi-select for batch download', false)
  .option('-d, --max-duration <duration>', 'Filter by max video duration (e.g., 1h30m, 90m, 45s)')
  .option('-o, --output <dir>', 'Output directory for downloads')
  .action(async (name: string, options: { chineseOnly?: boolean; multiSelect?: boolean; output?: string; maxDuration?: string }) => {
    try {
      await searchCommand({
        name,
        chineseOnly: options.chineseOnly ?? false,
        multiSelect: options.multiSelect ?? false,
        outputDir: options.output,
        maxDuration: options.maxDuration,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(chalk.red(`\n  Fatal error: ${message}\n`));
      process.exit(1);
    }
  });

program
  .command('download')
  .description('Download subtitle by URL')
  .argument('<url>', 'Subtitle download URL')
  .argument('[filename]', 'Output filename')
  .option('-o, --output <dir>', 'Output directory for downloads')
  .action(async (url: string, filename?: string, options?: { output?: string }) => {
    console.log(chalk.yellow('  Download command not yet implemented. Use "search" command instead.\n'));
  });

// Default command - search mode
program.action(() => {
  program.help();
});

program.parse();
