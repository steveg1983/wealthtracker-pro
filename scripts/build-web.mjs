#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const cwd = process.cwd();

// Check if we're already in apps/web (by looking for vite.config.ts)
// or if we need to navigate to it from the monorepo root
let appDir = cwd;
if (existsSync(resolve(cwd, 'vite.config.ts')) && existsSync(resolve(cwd, 'index.html'))) {
  // We're already in the right directory (apps/web)
  appDir = cwd;
  console.log('Already in app directory:', appDir);
} else if (existsSync(resolve(cwd, 'apps/web/vite.config.ts'))) {
  // We're in the monorepo root, need to go to apps/web
  appDir = resolve(cwd, 'apps/web');
  console.log('Moving to app directory:', appDir);
} else {
  console.error('Could not locate vite.config.ts. Current directory:', cwd);
  console.error('Directory contents:', require('fs').readdirSync(cwd));
  process.exit(1);
}

console.log('Build directory:', appDir);
console.log('Checking for index.html:', existsSync(resolve(appDir, 'index.html')));
console.log('Checking for vite.config.ts:', existsSync(resolve(appDir, 'vite.config.ts')));

// Call vite build directly to avoid potential recursion
const result = spawnSync('npx', ['vite', 'build'], {
  cwd: appDir,
  stdio: 'inherit',
  shell: false,
});

process.exit(result.status ?? 1);
