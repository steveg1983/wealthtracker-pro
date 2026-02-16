#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const logDir = path.join(rootDir, 'logs', 'banking-api-smoke');
const timestamp = new Date();

const results = [];
let failures = 0;

const printUsage = () => {
  console.log(`
Banking API smoke runner

Usage:
  npm run banking:smoke

Required env:
  BANKING_API_BEARER_TOKEN               Clerk bearer token for a regular banking user

Optional env:
  BANKING_API_BASE_URL                   API base URL (default: http://localhost:3000)
  BANKING_ADMIN_BEARER_TOKEN             Clerk bearer token for banking ops admin
  BANKING_SMOKE_CONNECTION_ID            Connection ID used for sync checks
  BANKING_SMOKE_RUN_SYNC                 true/false; defaults to true when connection ID is set
  BANKING_SMOKE_RUN_ADMIN                true/false; defaults to true when admin token is set
  BANKING_SMOKE_ENABLE_MUTATIONS         true/false; enables ops-alert-test POST
  BANKING_SMOKE_SYNC_START_DATE          Optional startDate passed to sync-transactions
  BANKING_SMOKE_SYNC_END_DATE            Optional endDate passed to sync-transactions

Examples:
  BANKING_API_BASE_URL="http://localhost:3000" \\
  BANKING_API_BEARER_TOKEN="<user-token>" \\
  BANKING_SMOKE_CONNECTION_ID="conn_123" \\
  BANKING_SMOKE_RUN_SYNC=true \\
  npm run banking:smoke

  BANKING_API_BASE_URL="https://your-preview.vercel.app" \\
  BANKING_API_BEARER_TOKEN="<user-token>" \\
  BANKING_ADMIN_BEARER_TOKEN="<admin-token>" \\
  BANKING_SMOKE_RUN_ADMIN=true \\
  BANKING_SMOKE_ENABLE_MUTATIONS=true \\
  npm run banking:smoke
`.trim());
};

const parseBooleanEnv = (key, fallback) => {
  const raw = process.env[key];
  if (!raw) {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
};

const truncate = (value, max = 260) => {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}...`;
};

const normalizeBaseUrl = (value) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'http://localhost:3000';
  }
  return trimmed.replace(/\/+$/, '');
};

const looksLikePlaceholder = (value) => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return (
    normalized.includes('<') ||
    normalized.includes('>') ||
    normalized.includes('your-api-host') ||
    normalized.includes('your-preview.vercel.app') ||
    normalized.includes('regular-user-clerk-token') ||
    normalized.includes('admin-clerk-token') ||
    normalized.includes('optional-connection-id') ||
    normalized === 'changeme'
  );
};

const validateBaseUrl = (value, sourceName) => {
  if (looksLikePlaceholder(value)) {
    throw new Error(
      `${sourceName} contains a placeholder value (${value}). Set a real host like https://api.yourdomain.com`
    );
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error(`${sourceName} is not a valid URL (${value}). Expected format: https://api.yourdomain.com`);
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error(`${sourceName} must start with http:// or https:// (${value})`);
  }
};

const validateToken = (value, name) => {
  if (looksLikePlaceholder(value)) {
    throw new Error(`${name} contains a placeholder value. Use a real Clerk bearer token.`);
  }
};

const loadEnvFile = (filePath) => {
  const contents = readFileSync(filePath, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const [key, ...rest] = trimmed.split('=');
    if (!key || rest.length === 0) {
      continue;
    }
    if (process.env[key]) {
      continue;
    }
    const rawValue = rest.join('=').trim();
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
};

const loadEnvFiles = () => {
  for (const candidate of ['.env.test.local', '.env.test', '.env.local']) {
    const filePath = path.join(rootDir, candidate);
    if (!existsSync(filePath)) {
      continue;
    }
    try {
      loadEnvFile(filePath);
      console.log(`[banking-api-smoke] Loaded environment from ${candidate}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[banking-api-smoke] Failed to load ${candidate}: ${message}`);
    }
  }
};

const writeLog = () => {
  try {
    mkdirSync(logDir, { recursive: true });
    const iso = timestamp.toISOString();
    const safe = iso.replace(/[:.]/g, '-');
    const logPath = path.join(logDir, `${safe}_banking-api-smoke.log`);
    const latestPath = path.join(logDir, 'latest.log');
    const total = results.length;
    const passed = results.filter((row) => row.status === 'PASSED').length;
    const failed = results.filter((row) => row.status === 'FAILED').length;
    const skipped = results.filter((row) => row.status === 'SKIPPED').length;

    const lines = [
      'Banking API Smoke Run',
      `Timestamp: ${iso}`,
      `Total: ${total}`,
      `Passed: ${passed}`,
      `Failed: ${failed}`,
      `Skipped: ${skipped}`,
      '',
      ...results.map((row) => [
        `[${row.status}] ${row.name}`,
        `duration_ms=${row.durationMs}`,
        row.detail ? `detail=${row.detail}` : ''
      ].filter(Boolean).join(' | '))
    ];

    const output = `${lines.join('\n')}\n`;
    writeFileSync(logPath, output, 'utf8');
    writeFileSync(latestPath, output, 'utf8');
    console.log(`[banking-api-smoke] log written to ${logPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[banking-api-smoke] Failed to write log: ${message}`);
  }
};

const runCheck = async (name, fn) => {
  const startedAt = Date.now();
  try {
    const detail = await fn();
    const durationMs = Date.now() - startedAt;
    results.push({
      name,
      status: 'PASSED',
      detail: detail ?? '',
      durationMs
    });
    console.log(`[PASS] ${name} (${durationMs}ms)`);
  } catch (error) {
    failures += 1;
    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    results.push({
      name,
      status: 'FAILED',
      detail: truncate(message),
      durationMs
    });
    console.error(`[FAIL] ${name} (${durationMs}ms)`);
    console.error(`       ${truncate(message)}`);
  }
};

const skipCheck = (name, reason) => {
  results.push({
    name,
    status: 'SKIPPED',
    detail: reason,
    durationMs: 0
  });
  console.log(`[SKIP] ${name}: ${reason}`);
};

const request = async ({
  baseUrl,
  pathName,
  method = 'GET',
  token,
  body,
  expectedStatuses = [200],
  expectJson = true
}) => {
  const response = await fetch(`${baseUrl}${pathName}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const rawBody = await response.text();
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(
      `${method} ${pathName} expected [${expectedStatuses.join(', ')}], got ${response.status}. body=${truncate(rawBody)}`
    );
  }

  if (!expectJson) {
    return {
      status: response.status,
      contentType: response.headers.get('content-type') ?? '',
      rawBody
    };
  }

  let payload = null;
  try {
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    throw new Error(`${method} ${pathName} returned invalid JSON: ${truncate(rawBody)}`);
  }

  return {
    status: response.status,
    contentType: response.headers.get('content-type') ?? '',
    rawBody,
    payload
  };
};

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printUsage();
  process.exit(0);
}

loadEnvFiles();

if (typeof fetch !== 'function') {
  console.error('[banking-api-smoke] fetch is not available in this Node runtime (Node 18+ required)');
  writeLog();
  process.exit(1);
}

const baseUrl = normalizeBaseUrl(
  process.env.BANKING_API_BASE_URL ??
  process.env.VITE_BANKING_API_BASE_URL ??
  'http://localhost:3000'
);
const userToken = (process.env.BANKING_API_BEARER_TOKEN ?? '').trim();
const adminToken = (process.env.BANKING_ADMIN_BEARER_TOKEN ?? '').trim();
const rawConnectionId = (process.env.BANKING_SMOKE_CONNECTION_ID ?? '').trim();
const requestedConnectionId = looksLikePlaceholder(rawConnectionId) ? '' : rawConnectionId;
const runSync = parseBooleanEnv('BANKING_SMOKE_RUN_SYNC', requestedConnectionId.length > 0);
const runAdmin = parseBooleanEnv('BANKING_SMOKE_RUN_ADMIN', adminToken.length > 0);
const enableMutations = parseBooleanEnv('BANKING_SMOKE_ENABLE_MUTATIONS', false);
const syncStartDate = (process.env.BANKING_SMOKE_SYNC_START_DATE ?? '').trim();
const syncEndDate = (process.env.BANKING_SMOKE_SYNC_END_DATE ?? '').trim();

try {
  validateBaseUrl(
    baseUrl,
    process.env.BANKING_API_BASE_URL ? 'BANKING_API_BASE_URL' : 'VITE_BANKING_API_BASE_URL'
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[banking-api-smoke] ${message}`);
  writeLog();
  process.exit(1);
}

if (!userToken) {
  console.error('[banking-api-smoke] Missing BANKING_API_BEARER_TOKEN');
  writeLog();
  process.exit(1);
}
try {
  validateToken(userToken, 'BANKING_API_BEARER_TOKEN');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[banking-api-smoke] ${message}`);
  writeLog();
  process.exit(1);
}

if (runAdmin && !adminToken) {
  console.error('[banking-api-smoke] BANKING_SMOKE_RUN_ADMIN=true requires BANKING_ADMIN_BEARER_TOKEN');
  writeLog();
  process.exit(1);
}

if (runAdmin) {
  try {
    validateToken(adminToken, 'BANKING_ADMIN_BEARER_TOKEN');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[banking-api-smoke] ${message}`);
    writeLog();
    process.exit(1);
  }
}

console.log(`[banking-api-smoke] Base URL: ${baseUrl}`);
console.log(`[banking-api-smoke] Sync checks: ${runSync ? 'enabled' : 'disabled'}`);
console.log(`[banking-api-smoke] Admin checks: ${runAdmin ? 'enabled' : 'disabled'}`);
console.log(`[banking-api-smoke] Mutating checks: ${enableMutations ? 'enabled' : 'disabled'}`);

let discoveredConnectionId = requestedConnectionId;

await runCheck('GET /api/banking/health', async () => {
  const response = await request({
    baseUrl,
    pathName: '/api/banking/health',
    method: 'GET',
    token: userToken
  });

  const payload = response.payload ?? {};
  if (payload.status !== 'ok') {
    throw new Error(`Expected payload.status=\"ok\", received ${JSON.stringify(payload)}`);
  }
  return 'health endpoint authenticated and reachable';
});

await runCheck('GET /api/banking/connections', async () => {
  const response = await request({
    baseUrl,
    pathName: '/api/banking/connections',
    method: 'GET',
    token: userToken
  });

  if (!Array.isArray(response.payload)) {
    throw new Error(`Expected array response, received ${typeof response.payload}`);
  }

  if (!discoveredConnectionId && response.payload.length > 0) {
    const firstId = response.payload[0]?.id;
    if (typeof firstId === 'string' && firstId.trim()) {
      discoveredConnectionId = firstId;
    }
  }

  return `connections=${response.payload.length}`;
});

if (runSync) {
  if (!discoveredConnectionId) {
    skipCheck(
      'POST /api/banking/sync-accounts',
      'No connectionId available (set BANKING_SMOKE_CONNECTION_ID or create a connection first)'
    );
    skipCheck(
      'POST /api/banking/sync-transactions',
      'No connectionId available (set BANKING_SMOKE_CONNECTION_ID or create a connection first)'
    );
  } else {
    await runCheck('POST /api/banking/sync-accounts', async () => {
      const response = await request({
        baseUrl,
        pathName: '/api/banking/sync-accounts',
        method: 'POST',
        token: userToken,
        body: { connectionId: discoveredConnectionId }
      });
      const payload = response.payload ?? {};
      if (payload.success !== true || typeof payload.accountsSynced !== 'number') {
        throw new Error(`Unexpected sync-accounts payload: ${truncate(JSON.stringify(payload))}`);
      }
      return `accountsSynced=${payload.accountsSynced}`;
    });

    await runCheck('POST /api/banking/sync-transactions', async () => {
      const body = {
        connectionId: discoveredConnectionId,
        ...(syncStartDate ? { startDate: syncStartDate } : {}),
        ...(syncEndDate ? { endDate: syncEndDate } : {})
      };
      const response = await request({
        baseUrl,
        pathName: '/api/banking/sync-transactions',
        method: 'POST',
        token: userToken,
        body
      });
      const payload = response.payload ?? {};
      if (payload.success !== true || typeof payload.transactionsImported !== 'number') {
        throw new Error(`Unexpected sync-transactions payload: ${truncate(JSON.stringify(payload))}`);
      }
      return `transactionsImported=${payload.transactionsImported}, duplicatesSkipped=${payload.duplicatesSkipped ?? 0}`;
    });
  }
} else {
  skipCheck('POST /api/banking/sync-accounts', 'Sync checks disabled (BANKING_SMOKE_RUN_SYNC=false)');
  skipCheck('POST /api/banking/sync-transactions', 'Sync checks disabled (BANKING_SMOKE_RUN_SYNC=false)');
}

if (runAdmin) {
  await runCheck('GET /api/banking/ops-alert-stats', async () => {
    const response = await request({
      baseUrl,
      pathName: '/api/banking/ops-alert-stats?limit=5',
      method: 'GET',
      token: adminToken
    });
    const payload = response.payload ?? {};
    if (payload.success !== true || !Array.isArray(payload.rows)) {
      throw new Error(`Unexpected ops-alert-stats payload: ${truncate(JSON.stringify(payload))}`);
    }
    return `rows=${payload.rows.length}`;
  });

  await runCheck('GET /api/banking/dead-letter-admin', async () => {
    const response = await request({
      baseUrl,
      pathName: '/api/banking/dead-letter-admin?limit=5',
      method: 'GET',
      token: adminToken
    });
    const payload = response.payload ?? {};
    if (payload.success !== true || !Array.isArray(payload.rows)) {
      throw new Error(`Unexpected dead-letter-admin payload: ${truncate(JSON.stringify(payload))}`);
    }
    return `rows=${payload.rows.length}`;
  });

  await runCheck('POST /api/banking/dead-letter-admin (validation path)', async () => {
    const response = await request({
      baseUrl,
      pathName: '/api/banking/dead-letter-admin',
      method: 'POST',
      token: adminToken,
      body: { reason: 'banking api smoke validation request' },
      expectedStatuses: [400]
    });
    const payload = response.payload ?? {};
    if (payload.code !== 'invalid_request') {
      throw new Error(`Expected invalid_request code, got ${truncate(JSON.stringify(payload))}`);
    }
    return 'validation path returned invalid_request as expected';
  });

  await runCheck('GET /api/banking/dead-letter-admin-audit', async () => {
    const response = await request({
      baseUrl,
      pathName: '/api/banking/dead-letter-admin-audit?limit=5',
      method: 'GET',
      token: adminToken
    });
    const payload = response.payload ?? {};
    if (payload.success !== true || !Array.isArray(payload.rows)) {
      throw new Error(`Unexpected audit payload: ${truncate(JSON.stringify(payload))}`);
    }
    return `rows=${payload.rows.length}`;
  });

  await runCheck('GET /api/banking/dead-letter-admin-audit-export', async () => {
    const response = await request({
      baseUrl,
      pathName: '/api/banking/dead-letter-admin-audit-export?limit=5',
      method: 'GET',
      token: adminToken,
      expectJson: false
    });

    if (!response.contentType.includes('text/csv')) {
      throw new Error(`Expected text/csv content-type, received ${response.contentType || 'unknown'}`);
    }
    if (!response.rawBody.includes('id,admin_user_id,admin_clerk_id')) {
      throw new Error('CSV header missing expected columns');
    }
    return `csv-bytes=${response.rawBody.length}`;
  });

  if (enableMutations) {
    await runCheck('POST /api/banking/ops-alert-test', async () => {
      const response = await request({
        baseUrl,
        pathName: '/api/banking/ops-alert-test',
        method: 'POST',
        token: adminToken,
        body: {
          message: `banking-api-smoke ${timestamp.toISOString()}`
        }
      });
      const payload = response.payload ?? {};
      if (payload.success !== true) {
        throw new Error(`Unexpected ops-alert-test payload: ${truncate(JSON.stringify(payload))}`);
      }
      return `eventType=${payload.eventType ?? 'unknown'}`;
    });
  } else {
    skipCheck(
      'POST /api/banking/ops-alert-test',
      'Mutating admin check disabled (set BANKING_SMOKE_ENABLE_MUTATIONS=true to enable)'
    );
  }
} else {
  skipCheck('GET /api/banking/ops-alert-stats', 'Admin checks disabled (BANKING_SMOKE_RUN_ADMIN=false)');
  skipCheck('GET /api/banking/dead-letter-admin', 'Admin checks disabled (BANKING_SMOKE_RUN_ADMIN=false)');
  skipCheck('POST /api/banking/dead-letter-admin (validation path)', 'Admin checks disabled (BANKING_SMOKE_RUN_ADMIN=false)');
  skipCheck('GET /api/banking/dead-letter-admin-audit', 'Admin checks disabled (BANKING_SMOKE_RUN_ADMIN=false)');
  skipCheck('GET /api/banking/dead-letter-admin-audit-export', 'Admin checks disabled (BANKING_SMOKE_RUN_ADMIN=false)');
  skipCheck('POST /api/banking/ops-alert-test', 'Admin checks disabled (BANKING_SMOKE_RUN_ADMIN=false)');
}

writeLog();

if (failures > 0) {
  console.error(`[banking-api-smoke] Completed with ${failures} failure(s).`);
  process.exit(1);
}

console.log('[banking-api-smoke] All checks passed.');
