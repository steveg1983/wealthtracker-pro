#!/usr/bin/env node
import { readdirSync, statSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const rootDir = process.cwd();
const searchRoots = ['src/test', 'src/tests'];
const supabaseTests = [];
const matcher = /supabase/i;
const logDir = path.join(rootDir, 'logs', 'supabase-smoke');
const timestamp = new Date();

// Whether absent credentials are fatal. GitHub Actions and effectively every
// other runner set CI=true; set it by hand to reproduce the CI behaviour
// locally. Anything other than an explicit 'false' counts as CI.
const isCI = Boolean(process.env.CI) && process.env.CI !== 'false';

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
  await writeLog({
    status: 'SKIPPED',
    note: 'No supabase-specific test files detected.',
    stdout: '',
    stderr: '',
    tests: []
  });
  process.exit(0);
}

const requiredKeys = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY'
];

const missingKeys = requiredKeys.filter((key) => !process.env[key]);
// Service-role key is server-only and must NOT use a VITE_ prefix (would be
// inlined into the browser bundle). Accept the legacy name during migration.
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
  missingKeys.push('SUPABASE_SERVICE_ROLE_KEY');
}
if (missingKeys.length > 0) {
  // In CI, absent credentials are a real failure and must stay loud. This job
  // once silently skipped for months because SUPABASE_SERVICE_ROLE_KEY was
  // unset, reporting success the whole time — see .github/workflows/supabase-smoke.yml.
  if (isCI) {
    console.error('[supabase-smoke] Missing required env vars:', missingKeys.join(', '));
    console.error('[supabase-smoke] Running in CI, where this is a hard failure — the live-infra');
    console.error('[supabase-smoke] safety net cannot silently degrade to green.');
    await writeLog({
      status: 'FAILED',
      note: `Missing env vars in CI: ${missingKeys.join(', ')}`,
      stdout: '',
      stderr: '',
      tests: []
    });
    process.exit(1);
  }

  // Locally, these credentials are optional. Hard-failing here blocked every
  // push from any checkout without .env.test.local — including every fresh git
  // worktree — which pushed people towards `--no-verify` or towards copying
  // live keys between directories. Both are worse than skipping a check that
  // the nightly workflow runs against real infrastructure anyway.
  //
  // Skipped, not silent: this prints on every push and is recorded as SKIPPED
  // in the log, so it can never masquerade as a passing run.
  console.warn('');
  console.warn('  ┌─────────────────────────────────────────────────────────────────┐');
  console.warn('  │  SUPABASE SMOKE SKIPPED — no credentials in this checkout        │');
  console.warn('  └─────────────────────────────────────────────────────────────────┘');
  console.warn(`  Missing: ${missingKeys.join(', ')}`);
  console.warn('  These tests run against live Supabase, so they need real values.');
  console.warn('');
  console.warn('  To run them here, create .env.test.local in this directory');
  console.warn('  (git-ignored) using the key names in .env.example.');
  console.warn('');
  console.warn('  Skipping locally. The nightly Supabase Smoke workflow still runs');
  console.warn('  this against real infrastructure with CI secrets, and fails loudly');
  console.warn('  if they are absent.');
  console.warn('');
  await writeLog({
    status: 'SKIPPED',
    note: `Missing env vars locally (not CI): ${missingKeys.join(', ')}`,
    stdout: '',
    stderr: '',
    tests: []
  });
  process.exit(0);
}

process.env.RUN_SUPABASE_REAL_TESTS = 'true';

const args = ['vitest', 'run', '--environment', 'node', ...supabaseTests];
console.log(`[supabase-smoke] Running ${supabaseTests.length} test files...`);
const { code, stdout, stderr } = await runVitest(args);

await writeLog({
  status: code === 0 ? 'PASSED' : 'FAILED',
  stdout,
  stderr,
  tests: supabaseTests
});

process.exit(code ?? 1);

async function runVitest(args) {
  return await new Promise((resolve, reject) => {
    const child = spawn('npx', args, {
      env: { ...process.env, RUN_SUPABASE_REAL_TESTS: 'true' },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on('error', (error) => reject(error));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function writeLog({ status, note = '', stdout = '', stderr = '', tests }) {
  try {
    mkdirSync(logDir, { recursive: true });
    const iso = timestamp.toISOString();
    const safe = iso.replace(/[:.]/g, '-');
    const logPath = path.join(logDir, `${safe}_supabase-smoke.log`);
    const latestPath = path.join(logDir, 'latest.log');
    const contents = [
      `Supabase Smoke Run`,
      `Timestamp: ${iso}`,
      `Status: ${status}`,
      note ? `Note: ${note}` : '',
      `Test files: ${tests.length}`,
      '',
      stdout ? `STDOUT:\n${stdout.trim()}\n` : '',
      stderr ? `STDERR:\n${stderr.trim()}\n` : ''
    ].filter(Boolean).join('\n');
    writeFileSync(logPath, contents, 'utf8');
    writeFileSync(latestPath, contents, 'utf8');
    console.log(`[supabase-smoke] log written to ${logPath}`);
  } catch (error) {
    console.warn('[supabase-smoke] Failed to write log:', error.message);
  }
}
