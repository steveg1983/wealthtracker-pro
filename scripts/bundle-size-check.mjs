#!/usr/bin/env node

/**
 * Bundle size check script
 * Reports bundle sizes from the dist/ directory after a build.
 * Exits with 0 (informational only).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');
const assetsDir = path.join(distDir, 'assets');
const isReport = process.argv.includes('--report');

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function getFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => fs.statSync(path.join(dir, f)).isFile())
    .map(f => ({
      name: f,
      size: fs.statSync(path.join(dir, f)).size,
    }))
    .sort((a, b) => b.size - a.size);
}

if (!fs.existsSync(distDir)) {
  console.log('dist/ directory not found. Run npm run build first.');
  process.exit(0);
}

const assets = getFiles(assetsDir);
const jsFiles = assets.filter(f => f.name.endsWith('.js') && !f.name.endsWith('.js.gz') && !f.name.endsWith('.js.br'));
const cssFiles = assets.filter(f => f.name.endsWith('.css') && !f.name.endsWith('.css.gz') && !f.name.endsWith('.css.br'));

const totalJS = jsFiles.reduce((sum, f) => sum + f.size, 0);
const totalCSS = cssFiles.reduce((sum, f) => sum + f.size, 0);

console.log('\n📦 Bundle Size Report\n');
console.log(`JS total:  ${formatBytes(totalJS)}`);
console.log(`CSS total: ${formatBytes(totalCSS)}`);
console.log(`Combined:  ${formatBytes(totalJS + totalCSS)}\n`);

if (isReport) {
  console.log('JS files:');
  jsFiles.forEach(f => console.log(`  ${formatBytes(f.size).padStart(10)}  ${f.name}`));
  console.log('\nCSS files:');
  cssFiles.forEach(f => console.log(`  ${formatBytes(f.size).padStart(10)}  ${f.name}`));
}

process.exit(0);
