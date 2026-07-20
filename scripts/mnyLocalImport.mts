/**
 * DEV-ONLY local proving harness for the MS Money import.
 *
 * Reads the normalised .mny export JSON from the SCRATCHPAD (never the repo),
 * runs the real transform, and writes a local seed to the gitignored
 * `mny-local-seed.json` at the project root. The dev-only loader in the app
 * (?mnyimport=local) injects that seed into local storage so the whole file
 * can be browsed in a purely local WealthTracker — no cloud, no live data.
 *
 * Usage:  npx tsx scripts/mnyLocalImport.mts <exportDir>
 * The seed contains real financial data and is gitignored — delete it after
 * review.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { transformMsMoneyExport, type MnyExport } from '../src/services/import/msMoney/transform.ts';

const exportDir = process.argv[2];
if (!exportDir) {
  console.error('usage: tsx scripts/mnyLocalImport.mts <exportDir>');
  process.exit(1);
}

const read = <T>(name: string): T =>
  JSON.parse(readFileSync(join(exportDir, name), 'utf8')) as T;

const exp: MnyExport = {
  accounts: read('accounts.json'),
  categories: read('categories.json'),
  payees: read('payees.json'),
  // Prefer the forensics-enriched v2 (isTransferLine + split reconciliation
  // fields) when present.
  transactions: (() => {
    try { return read('transactions_v2.json'); } catch { return read('transactions.json'); }
  })(),
};

const result = transformMsMoneyExport(exp, new Date().toISOString());

const seed = {
  generatedAt: new Date().toISOString(),
  accounts: result.accounts,
  categories: result.categories,
  transactions: result.transactions,
  transactionSplits: result.transactionSplits,
  summary: result.summary,
};

// OUTSIDE public/ on purpose: public/ is copied into dist by every build,
// and this file holds real financial data. A dev-only Vite middleware
// (vite.config.ts) serves it at /mny-local-seed.json on the dev server.
const outDir = join(process.cwd(), '.mny-local');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'mny-local-seed.json');
writeFileSync(outPath, JSON.stringify(seed));

const s = result.summary;
console.log('MS Money → WealthTracker local seed written:', outPath);
console.log(`  accounts:     ${s.accounts.total} (${s.accounts.open} open, ${s.accounts.closed} closed)`);
console.log(`  categories:   ${s.categories.subs} sub + ${s.categories.details} detail (${s.categories.hidden} hidden→inactive)`);
console.log(`  transactions: ${s.transactions.imported} imported`);
console.log(`     standalone ${s.transactions.standalone} | transfers ${s.transactions.transfers} | split ${s.transactions.splitTransactions} (${s.transactions.splitLines} lines)`);
console.log('  simplifications:');
for (const line of s.simplifications) console.log(`     - ${line}`);
