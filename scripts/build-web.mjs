#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

// Simple build script - just run vite build
// This handles both monorepo and flat structures
// Vercel will set the correct working directory

// Server-env preflight: fails the build on Vercel when core server secrets
// are missing or a VITE_-prefixed secret would be inlined into the bundle.
// Report-only outside Vercel (CI/local have no server secrets by design).
const preflight = spawnSync('node', ['scripts/verify-server-env.mjs'], {
  stdio: 'inherit',
  shell: false,
});
if ((preflight.status ?? 1) !== 0) {
  process.exit(preflight.status ?? 1);
}

console.log('Build helper: Running vite build...');

const result = spawnSync('npx', ['vite', 'build'], {
  stdio: 'inherit',
  shell: false,
});

process.exit(result.status ?? 1);
