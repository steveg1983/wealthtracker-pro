#!/usr/bin/env node
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

const targets = {
  charts: [
    'recharts',
    'react-chartjs-2',
    'chart.js',
    'react-plotly.js',
    'plotly.js',
  ],
  icons: [
    '@tabler/icons-react',
    'lucide-react',
    '@heroicons/react',
  ],
};

function* walk(dir) { // generator function
  const entries = readdirSync(dir);
  for (const e of entries) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) {
      yield* walk(p);
    } else if (p.endsWith('.ts') || p.endsWith('.tsx')) {
      yield p;
    }
  }
}

const counts = {};
for (const group of Object.keys(targets)) {
  counts[group] = Object.fromEntries(targets[group].map((name) => [name, 0]));
}

for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8');
  for (const group of Object.keys(targets)) {
    for (const name of targets[group]) {
      const re = new RegExp(
        `(from\\s+['\"]${name}['\"]|require\\(['\"]${name}['\"]\\))`,
        'g'
      );
      const matches = text.match(re);
      if (matches) counts[group][name] += matches.length;
    }
  }
}

console.log('Dependency usage summary (imports found in src):');
for (const group of Object.keys(counts)) {
  console.log(`\n[${group}]`);
  const entries = Object.entries(counts[group]).sort((a, b) => b[1] - a[1]);
  for (const [name, count] of entries) {
    console.log(`- ${name}: ${count}`);
  }
}
