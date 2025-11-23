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
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_SERVICE_ROLE_KEY'
];

const missingKeys = requiredKeys.filter((key) => !process.env[key]);
if (missingKeys.length > 0) {
  console.error('[supabase-smoke] Missing required env vars:', missingKeys.join(', '));
  console.error('[supabase-smoke] Provide them in your shell or .env.test.local before running.');
  await writeLog({
    status: 'FAILED',
    note: `Missing env vars: ${missingKeys.join(', ')}`,
    stdout: '',
    stderr: '',
    tests: []
  });
  process.exit(1);
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
