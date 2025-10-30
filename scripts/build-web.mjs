#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

// Simple build script - just run vite build
// This handles both monorepo and flat structures
// Vercel will set the correct working directory

console.log('Build helper: Running vite build...');

const result = spawnSync('npx', ['vite', 'build'], {
  stdio: 'inherit',
  shell: false,
});

process.exit(result.status ?? 1);
