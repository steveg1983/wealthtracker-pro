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

const args = ['vitest', 'run', ...tests];
console.log('[realtime-suite] Running vitest with manifest entries:', tests.length);
const result = spawnSync('npx', args, {
  stdio: 'inherit',
  shell: false,
  env: process.env
});

process.exit(result.status ?? 1);
