#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const cwd = process.cwd();

console.log('Starting build from:', cwd);

// Check multiple possible locations for the app
let appDir = cwd;

// Check if we're already in the right directory (has vite.config.ts and index.html)
if (existsSync(resolve(cwd, 'vite.config.ts')) && existsSync(resolve(cwd, 'index.html'))) {
  appDir = cwd;
  console.log('Already in app directory');
}
// Check if apps/web exists from current directory
else if (existsSync(resolve(cwd, 'apps/web/vite.config.ts'))) {
  appDir = resolve(cwd, 'apps/web');
  console.log('Found apps/web from root');
}
// Check if we're in a subdirectory and need to go up to find apps/web
else if (existsSync(resolve(cwd, '../apps/web/vite.config.ts'))) {
  appDir = resolve(cwd, '../apps/web');
  console.log('Found apps/web one level up');
}
// Check if we're two levels deep (e.g., in scripts folder)
else if (existsSync(resolve(cwd, '../../apps/web/vite.config.ts'))) {
  appDir = resolve(cwd, '../../apps/web');
  console.log('Found apps/web two levels up');
}
// Last resort: check if package.json exists and we might be in the app already
else if (existsSync(resolve(cwd, 'package.json')) && existsSync(resolve(cwd, 'index.html'))) {
  appDir = cwd;
  console.log('Found package.json and index.html, assuming app directory');
}
else {
  console.error('Could not locate the app directory');
  console.error('Current directory:', cwd);
  try {
    console.error('Directory contents:', readdirSync(cwd).slice(0, 10));
  } catch (e) {
    console.error('Could not read directory contents');
  }
  process.exit(1);
}

console.log('Build directory:', appDir);
console.log('index.html exists:', existsSync(resolve(appDir, 'index.html')));
console.log('vite.config.ts exists:', existsSync(resolve(appDir, 'vite.config.ts')));

// Call vite build directly
const result = spawnSync('npx', ['vite', 'build'], {
  cwd: appDir,
  stdio: 'inherit',
  shell: false,
});

process.exit(result.status ?? 1);
