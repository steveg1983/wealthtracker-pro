#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = process.cwd();
const manifestPath = path.join(rootDir, 'scripts', 'realtime-tests.json');
let tests;

try {
  tests = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (error) {
  console.error('[realtime-suite] Unable to load realtime-tests.json:', error.message);
  process.exit(1);
}

if (!Array.isArray(tests) || tests.length === 0) {
  console.warn('[realtime-suite] No realtime tests configured. Exiting.');
  process.exit(0);
}

const desiredHeapFlag = '--max-old-space-size=12288';
const env = { ...process.env };
if (!env.NODE_OPTIONS?.includes('--max-old-space-size')) {
  env.NODE_OPTIONS = env.NODE_OPTIONS ? `${env.NODE_OPTIONS} ${desiredHeapFlag}` : desiredHeapFlag;
}

const chunkSize = Number(process.env.REALTIME_CHUNK_SIZE ?? '5');
const totalChunks = Math.ceil(tests.length / chunkSize);
console.log('[realtime-suite] Running vitest with manifest entries:', tests.length);
console.log('[realtime-suite] NODE_OPTIONS=', env.NODE_OPTIONS);
console.log('[realtime-suite] Chunk size:', chunkSize);

let exitCode = 0;
for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
  const start = chunkIndex * chunkSize;
  const chunk = tests.slice(start, start + chunkSize);
  const args = ['vitest', 'run', ...chunk];
  console.log(`[realtime-suite] Chunk ${chunkIndex + 1}/${totalChunks}: ${chunk.length} files`);

  const result = spawnSync('npx', args, {
    stdio: 'inherit',
    shell: false,
    env
  });

  if (result.status !== 0) {
    exitCode = result.status ?? 1;
    break;
  }
}

process.exit(exitCode);
