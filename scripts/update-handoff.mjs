#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const repoRoot = resolve(__dirname, '..');
const handoffPath = resolve(repoRoot, 'handoff.md');
const projectEnterprisePath = resolve(repoRoot, 'PROJECT_ENTERPRISE.md');

function runContextSnapshot() {
  try {
    const out = execSync('npm run -s context:snapshot', {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8'
    });
    return out;
  } catch (e) {
    // Even on non-zero exit we want whatever output exists
    return (e.stdout?.toString?.() || '') + (e.stderr?.toString?.() || '');
  }
}

function formatErrors(output, max = 15) {
  // Split lines, keep non-empty, keep TypeScript error lines or any src/...:line entries
  const lines = output.split(/\r?\n/)
    .filter(l => l.trim().length > 0)
    .filter(l => /src\/.+\.(ts|tsx)\(\d+,\d+\)|error TS\d+/.test(l));

  const unique = [];
  const seen = new Set();
  for (const l of lines) {
    const key = l.replace(/\s+/g, ' ');
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(l);
    }
    if (unique.length >= max) break;
  }

  if (unique.length === 0) return ['- No relevant errors captured.'];
  return unique.map(l => `- ${l}`);
}

function replaceBetweenMarkers(filePath, start, end, lines) {
  const md = readFileSync(filePath, 'utf8');
  const startIdx = md.indexOf(start);
  const endIdx = md.indexOf(end);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(`Could not find markers in ${filePath}`);
  }

  const before = md.slice(0, startIdx + start.length);
  const after = md.slice(endIdx);
  const middle = '\n' + lines.join('\n') + '\n  ';

  const updated = before + middle + after;
  writeFileSync(filePath, updated, 'utf8');
}

const snapshot = runContextSnapshot();
const errors = formatErrors(snapshot, 15);
const timestamp = new Date().toISOString();
const summary = [`- Snapshot: ${timestamp} — ${errors.length} line(s)`];
const payload = [...summary, ...errors];

// Update handoff.md
replaceBetweenMarkers(
  handoffPath,
  '<!-- ERROR_SNAPSHOT_START -->',
  '<!-- ERROR_SNAPSHOT_END -->',
  payload
);

// Update PROJECT_ENTERPRISE.md
try {
  replaceBetweenMarkers(
    projectEnterprisePath,
    '<!-- CONTEXT_ERROR_SNAPSHOT_START -->',
    '<!-- CONTEXT_ERROR_SNAPSHOT_END -->',
    payload
  );
  console.log(`Updated error snapshots in handoff.md and PROJECT_ENTERPRISE.md at ${timestamp} with ${errors.length} line(s).`);
} catch (e) {
  console.warn(`Could not update PROJECT_ENTERPRISE.md context snapshot: ${e.message}`);
}
