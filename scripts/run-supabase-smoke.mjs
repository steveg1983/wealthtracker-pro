#!/usr/bin/env node
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = process.cwd();
const searchRoots = ['src/test', 'src/tests'];
const supabaseTests = [];
const matcher = /supabase/i;

function loadEnvFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...rest] = trimmed.split('=');
      if (!key || rest.length === 0) continue;
      const rawValue = rest.join('=').trim();
      const value = rawValue.replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
    console.log(`[supabase-smoke] Loaded environment from ${filePath}`);
  } catch (error) {
    console.warn(`[supabase-smoke] Failed to load ${filePath}:`, error.message);
  }
}

function loadEnvFiles() {
  const candidates = ['.env.test.local', '.env.test', '.env.local'];
  for (const candidate of candidates) {
    const filePath = path.join(rootDir, candidate);
    if (existsSync(filePath)) {
      loadEnvFile(filePath);
    }
  }
}

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.isFile()) {
      if (
        matcher.test(entry.name) &&
        (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx'))
      ) {
        supabaseTests.push(path.relative(rootDir, fullPath));
      }
    }
  }
}

// Load env files before discovery so vitest can see them
loadEnvFiles();

for (const relRoot of searchRoots) {
  const absoluteRoot = path.join(rootDir, relRoot);
  try {
    if (statSync(absoluteRoot).isDirectory()) {
      walk(absoluteRoot);
    }
  } catch (error) {
    // ignore missing directories
  }
}

if (supabaseTests.length === 0) {
  console.log('[supabase-smoke] No supabase-specific test files detected under src/test or src/tests. Skipping run.');
  process.exit(0);
}

const requiredKeys = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_SERVICE_ROLE_KEY'
];

const missingKeys = requiredKeys.filter((key) => !process.env[key]);
if (missingKeys.length > 0) {
  console.error('[supabase-smoke] Missing required env vars:', missingKeys.join(', '));
  console.error('[supabase-smoke] Provide them in your shell or .env.test.local before running.');
  process.exit(1);
}

process.env.RUN_SUPABASE_REAL_TESTS = 'true';

const result = spawnSync(
  'npx',
  ['vitest', 'run', '--environment', 'node', ...supabaseTests],
  {
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, RUN_SUPABASE_REAL_TESTS: 'true' },
  }
);

process.exit(result.status ?? 1);
