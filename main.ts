// Hand-in for the best card game bounty.
//
// The repository holds the game as static files (game/) and the screenshots
// its maker took (screenshots/). This script stages both folders into the
// grader's output directory and then asks the kit's library to describe the
// entry: a dossier.json built from exactly what was staged, so the scorer
// can compare it byte for byte with the dossier it rebuilds itself.
//
// Run by the grader with MAKEFUN_BOT_DIR pointing at this repository and
// MAKEFUN_OUTPUT_DIR pointing at the (empty) output directory. Locally the
// same two variables stand in for /output, e.g.:
//   MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

// Where the repository lives and where the hand-in goes. The grader sets
// both; the fallbacks let the script run by hand from the repo root.
const repoRoot = resolve(process.env.MAKEFUN_BOT_DIR ?? '.');
const handInDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

// The dossier's limits, as the bounty's gate states them: the text is cut
// at 160 KiB, at most four screenshots of 256 KiB each, and game/ holds at
// most 993 entries totalling 48 MiB.
const dossierLimits = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
};

// The two folders the entry hands in, staged in this order.
const stagedFolders = ['game', 'screenshots'];

/** How many files sit under a directory, counting nested ones. */
function countFilesUnder(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    total += entry.isDirectory() ? countFilesUnder(path) : 1;
  }
  return total;
}

/** Stage one folder of the repository into the hand-in directory. */
function stageFolder(name: string): number {
  const from = join(repoRoot, name);
  const to = join(handInDir, name);
  if (!statSync(from, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`cannot hand in ${name}/: no such folder in ${repoRoot}`);
  }
  cpSync(from, to, { recursive: true });
  return countFilesUnder(to);
}

mkdirSync(handInDir, { recursive: true });

const stagedCounts = stagedFolders.map((name) => `${name}/ (${stageFolder(name)} files)`);
const dossier = buildDossier(handInDir, dossierLimits);
writeFileSync(join(handInDir, 'dossier.json'), dossier);

console.log(`handed in ${stagedCounts.join(' and ')}; dossier.json is ${dossier.length} bytes`);
