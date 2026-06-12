#!/usr/bin/env node

/**
 * Bundle size gate.
 *
 * Measures the GZIPPED size of the built JS (the bytes a browser actually
 * downloads) and fails the build if the largest single chunk or the JS total
 * exceeds its budget. This is a RATCHET: the budgets are set just above today's
 * measured size so the gate prevents regression/growth (audit 2026-06-12 #14:
 * "nothing prevents growth") without breaking the current build. Lower the
 * budgets as the bundle-optimization work (BLOCKER #2) lands — never raise them
 * without a deliberate decision.
 *
 * Budgets can be overridden via env for experiments:
 *   BUNDLE_MAX_CHUNK_GZIP_KB, BUNDLE_MAX_TOTAL_JS_GZIP_KB
 *
 * Pass --report for a per-file breakdown. Exits non-zero when a budget is
 * exceeded (or when dist/ is missing in CI, where a build is expected).
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');
const assetsDir = path.join(distDir, 'assets');
const isReport = process.argv.includes('--report');

// Ratchet budgets (KB, gzipped). Current measured: largest chunk ~293 KB,
// total JS ~1425 KB. Headroom is intentionally small.
const MAX_CHUNK_GZIP_KB = Number(process.env.BUNDLE_MAX_CHUNK_GZIP_KB ?? 320);
const MAX_TOTAL_JS_GZIP_KB = Number(process.env.BUNDLE_MAX_TOTAL_JS_GZIP_KB ?? 1500);

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** Gzipped size of a JS asset: prefer the emitted .gz, else gzip in-process. */
function gzipSize(filePath) {
  const gzPath = `${filePath}.gz`;
  if (fs.existsSync(gzPath)) {
    return fs.statSync(gzPath).size;
  }
  return zlib.gzipSync(fs.readFileSync(filePath), { level: 9 }).length;
}

if (!fs.existsSync(assetsDir)) {
  console.error('✗ dist/assets not found. Run `npm run build` before the bundle check.');
  process.exit(1);
}

const jsFiles = fs.readdirSync(assetsDir)
  .filter((f) => f.endsWith('.js'))
  .map((f) => ({ name: f, gzip: gzipSize(path.join(assetsDir, f)) }))
  .sort((a, b) => b.gzip - a.gzip);

if (jsFiles.length === 0) {
  console.error('✗ No JS chunks found in dist/assets.');
  process.exit(1);
}

const totalJsGzip = jsFiles.reduce((sum, f) => sum + f.gzip, 0);
const largest = jsFiles[0];

console.log('\n📦 Bundle Size Gate (gzipped)\n');
console.log(`Largest chunk: ${formatKb(largest.gzip)}  (${largest.name})  — budget ${MAX_CHUNK_GZIP_KB} KB`);
console.log(`JS total:      ${formatKb(totalJsGzip)}  — budget ${MAX_TOTAL_JS_GZIP_KB} KB\n`);

if (isReport) {
  console.log('JS chunks (gzipped):');
  jsFiles.forEach((f) => console.log(`  ${formatKb(f.gzip).padStart(10)}  ${f.name}`));
  console.log('');
}

const failures = [];
if (largest.gzip > MAX_CHUNK_GZIP_KB * 1024) {
  failures.push(`Largest chunk ${formatKb(largest.gzip)} exceeds budget ${MAX_CHUNK_GZIP_KB} KB (${largest.name})`);
}
if (totalJsGzip > MAX_TOTAL_JS_GZIP_KB * 1024) {
  failures.push(`JS total ${formatKb(totalJsGzip)} exceeds budget ${MAX_TOTAL_JS_GZIP_KB} KB`);
}

if (failures.length > 0) {
  console.error('✗ Bundle budget exceeded:');
  for (const f of failures) console.error(`  - ${f}`);
  console.error('\nReduce bundle size or, if the growth is justified, raise the budget deliberately.');
  process.exit(1);
}

console.log('✓ Bundle within budget.');
process.exit(0);
