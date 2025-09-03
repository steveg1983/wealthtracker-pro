#!/usr/bin/env node
import { readdirSync, statSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');

function listFiles(dir, base = '') {
  const out = [];
  const entries = readdirSync(dir);
  for (const e of entries) {
    const p = join(dir, e);
    const rel = join(base, e).replaceAll('\\', '/');
    const s = statSync(p);
    if (s.isDirectory()) out.push(...listFiles(p, rel));
    else out.push(rel);
  }
  return out;
}

if (!existsSync(DIST)) {
  console.error('dist/ not found. Run `vite build` first.');
  process.exit(1);
}

const assetsDir = join(DIST, 'assets');
const files = existsSync(assetsDir) ? listFiles(assetsDir, 'assets') : [];

// Include common top-level files if present
['index.html', 'manifest.json', 'offline.html'].forEach((f) => {
  if (existsSync(join(DIST, f))) files.push(f);
});

const manifestPath = join(DIST, 'precache-manifest.json');
writeFileSync(manifestPath, JSON.stringify({ files }, null, 2));
console.log(`Wrote ${files.length} entries to ${manifestPath}`);

