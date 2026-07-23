/**
 * Extract a Microsoft Money .mny file into the normalised export JSON that
 * `scripts/mnyLocalImport.mts` consumes.
 *
 * WHY THIS EXISTS
 * ---------------
 * `readMnyExport` was only ever reachable from the browser import modal, so
 * regenerating the seed meant clicking through a wizard. That is fine once and
 * useless as a check you want to repeat: the seed is the input to the
 * idempotency harness and to every comparison against production, so producing
 * it has to be deterministic and re-runnable.
 *
 * SAFETY
 * ------
 * The .mny is opened READ-ONLY and never written back. Output goes to an
 * explicit directory which MUST NOT be inside the repository — this repo is
 * public and the export contains real financial data. Default is the
 * gitignored `.mny-local/export/`.
 *
 * Usage:
 *   npx tsx scripts/mnyExtract.mts <path-to.mny> [--out <dir>]
 *
 * Then:
 *   npx tsx scripts/mnyLocalImport.mts .mny-local/export
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { readMnyExport } from '../src/services/import/msMoney/mnyReader.ts';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const die = (msg: string): never => {
  console.error(`ABORT: ${msg}`);
  process.exit(1);
};

const mnyPath = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--out');
if (!mnyPath) die('usage: tsx scripts/mnyExtract.mts <path-to.mny> [--out <dir>]');

const outDir = resolve(flag('out') ?? join(process.cwd(), '.mny-local', 'export'));

// The repo is PUBLIC. Refuse to write extracted financial data anywhere git
// might pick it up. `.mny-local/` is gitignored; anything else under the repo
// root is not worth the risk of assuming.
const repoRoot = resolve(process.cwd());
const rel = relative(repoRoot, outDir);
const insideRepo = rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
if (insideRepo && !rel.startsWith('.mny-local')) {
  die(`refusing to write extracted financial data inside the repo at ${outDir} — use .mny-local/ or a path outside the repository`);
}

let bytes: Uint8Array;
try {
  const stat = statSync(mnyPath);
  if (!stat.isFile()) die(`${mnyPath} is not a file`);
  bytes = new Uint8Array(readFileSync(mnyPath));
} catch (err) {
  die(`could not read ${mnyPath}: ${(err as Error).message}`);
}

console.log(`Reading ${mnyPath} (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB, read-only)…`);

const exp = readMnyExport(bytes);

mkdirSync(outDir, { recursive: true });
const write = (name: string, value: unknown): void => {
  writeFileSync(join(outDir, name), JSON.stringify(value, null, 1));
};
write('accounts.json', exp.accounts);
write('categories.json', exp.categories);
write('payees.json', exp.payees);
write('transactions.json', exp.transactions);

// Counts only — never row contents. This output is read in a public chat.
console.log(`\nWrote ${outDir}`);
console.log(`  accounts     ${exp.accounts.length}`);
console.log(`  categories   ${exp.categories.length}`);
console.log(`  payees       ${exp.payees.length}`);
console.log(`  transactions ${exp.transactions.length}`);
console.log(`\nNext: npx tsx scripts/mnyLocalImport.mts ${relative(process.cwd(), outDir) || outDir}`);
