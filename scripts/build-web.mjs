#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const cwd = process.cwd();

console.log('Starting build from:', cwd);

// Try to find the app directory
let appDir = null;

// List of possible locations to check
const possiblePaths = [
  resolve(cwd, 'apps/web'),           // From monorepo root
  resolve(cwd, '../apps/web'),        // One level up
  resolve(cwd, '../../apps/web'),     // Two levels up
  cwd,                                 // Current directory might be apps/web
];

// Find the first path that contains both index.html and package.json
for (const path of possiblePaths) {
  console.log(`Checking: ${path}`);
  if (existsSync(resolve(path, 'index.html')) && existsSync(resolve(path, 'package.json'))) {
    // Extra check: make sure it has a src directory (characteristic of our app)
    if (existsSync(resolve(path, 'src'))) {
      appDir = path;
      console.log(`Found app directory at: ${path}`);
      break;
    }
  }
}

// If still not found, check if apps/web exists but maybe without some files
if (!appDir && existsSync(resolve(cwd, 'apps/web'))) {
  appDir = resolve(cwd, 'apps/web');
  console.log('Found apps/web directory, will try to build from there');
}

if (!appDir) {
  console.error('ERROR: Could not locate the app directory');
  console.error('Current directory:', cwd);
  console.error('Checked paths:', possiblePaths);
  try {
    console.error('Root contents:', readdirSync(cwd).slice(0, 20));
    if (existsSync(resolve(cwd, 'apps'))) {
      console.error('Apps directory contents:', readdirSync(resolve(cwd, 'apps')));
    }
  } catch (e) {
    console.error('Could not read directory contents:', e.message);
  }
  process.exit(1);
}

console.log('Build directory:', appDir);
console.log('Checking files in build directory:');
console.log('  index.html:', existsSync(resolve(appDir, 'index.html')));
console.log('  package.json:', existsSync(resolve(appDir, 'package.json')));
console.log('  vite.config.ts:', existsSync(resolve(appDir, 'vite.config.ts')));
console.log('  src directory:', existsSync(resolve(appDir, 'src')));

// Call vite build directly
const result = spawnSync('npx', ['vite', 'build'], {
  cwd: appDir,
  stdio: 'inherit',
  shell: false,
});

process.exit(result.status ?? 1);
