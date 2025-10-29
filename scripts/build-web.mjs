#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const cwd = process.cwd();
const appDir = existsSync(resolve(cwd, 'apps/web/package.json'))
  ? resolve(cwd, 'apps/web')
  : cwd;

// Call vite build directly to avoid potential recursion
const result = spawnSync('npx', ['vite', 'build'], {
  cwd: appDir,
  stdio: 'inherit',
  shell: false,
});

process.exit(result.status ?? 1);
