#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const cwd = process.cwd();
console.log('Build helper invoked from:', cwd);

const candidatePaths = [
  resolve(cwd, 'apps/web'),
  resolve(cwd, '../apps/web'),
  resolve(cwd, '../../apps/web'),
  cwd,
];

const findAppDir = () => {
  for (const path of candidatePaths) {
    const pkg = existsSync(resolve(path, 'package.json'));
    const src = existsSync(resolve(path, 'src'));
    console.log(`Checking ${path}\n  - package.json: ${pkg}\n  - src dir: ${src}`);
    if (pkg && src) {
      return path;
    }
  }
  return null;
};

let appDir = findAppDir();

// If script executed inside app already (no src at cwd but apps/web exists), prefer apps/web
const appsWeb = resolve(cwd, 'apps/web');
if (appDir === cwd && existsSync(appsWeb)) {
  console.log('Preferring apps/web subdirectory');
  appDir = appsWeb;
}

if (!appDir) {
  console.error('ERROR: Unable to locate apps/web directory');
  console.error('Contents of current directory:', readdirSync(cwd));
  process.exit(1);
}

console.log('Using app directory:', appDir);

// Call the workspace's build script instead of raw vite
const result = spawnSync('npm', ['run', 'build'], {
  cwd: appDir,
  stdio: 'inherit',
  shell: false,
});

process.exit(result.status ?? 1);
