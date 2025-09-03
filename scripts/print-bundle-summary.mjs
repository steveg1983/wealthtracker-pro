#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';

const reportPath = 'bundle-size-report.json';

if (!existsSync(reportPath)) {
  console.error('bundle-size-report.json not found. Run `npm run bundle:report` after a build.');
  process.exit(1);
}

try {
  const json = JSON.parse(readFileSync(reportPath, 'utf8'));
  const { total, initial, assets = [] } = json;
  console.log('Bundle Size Summary');
  console.log('-------------------');
  if (total) console.log(`Total JS (uncompressed): ${Math.round(total.js / 1024)} KB`);
  if (initial) console.log(`Initial JS (gz): ${Math.round(initial.jsGzip)} KB, CSS (gz): ${Math.round(initial.cssGzip)} KB`);
  if (assets.length) {
    const top = assets
      .filter(a => a.type === 'script' || a.name.endsWith('.js'))
      .sort((a, b) => b.sizeGzip - a.sizeGzip)
      .slice(0, 10);
    console.log('\nTop JS Chunks (gzipped):');
    top.forEach(a => console.log(`- ${a.name} ${Math.round(a.sizeGzip)} KB`));
  }
} catch (e) {
  console.error('Failed to read bundle-size-report.json:', e?.message || e);
  process.exit(1);
}

