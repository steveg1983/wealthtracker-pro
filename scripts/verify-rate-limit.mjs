#!/usr/bin/env node
/**
 * Prove the rate limiter is live and SHARED on a deployed connector.
 *
 * Sends `limit + 3` POSTs to the connector with one invented bearer token
 * and reports where the 429 arrives. With the shared store configured the
 * 429 lands at exactly request `limit + 1`, whatever Vercel instance each
 * request hit; with the per-instance fallback the count is split across
 * instances and the 429 rarely arrives at all. So "429 at limit + 1" is the
 * proof that UPSTASH_REDIS_REST_URL / _TOKEN reached the deployment, and
 * "no 429" is the proof they did not.
 *
 * The invented token never verifies, so nothing is read and nothing is
 * written; the limiter counts it before anyone looks at it.
 *
 * Usage:
 *   node scripts/verify-rate-limit.mjs --url https://www.reckley.co.uk/api/mcp [--limit 120]
 */

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

const url = flag('url');
if (!url) {
  console.error('usage: verify-rate-limit.mjs --url <connector url> [--limit 120]');
  process.exit(2);
}
const limit = Number(flag('limit', '120'));
const total = limit + 3;
const token = `verify-rate-limit-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const body = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'verify-rate-limit', version: '1' } },
});

const statuses = [];
let firstLimited = null;
let retryAfter = null;
const started = Date.now();
for (let i = 1; i <= total; i += 1) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${token}`,
    },
    body,
  });
  statuses.push(response.status);
  if (response.status === 429 && firstLimited === null) {
    firstLimited = i;
    retryAfter = response.headers.get('retry-after');
  }
  if (response.status !== 401 && response.status !== 429) {
    console.error(`request ${i}: unexpected ${response.status} — is this the connector URL?`);
    process.exit(2);
  }
}
const seconds = ((Date.now() - started) / 1000).toFixed(1);
const counts = statuses.reduce((acc, status) => ({ ...acc, [status]: (acc[status] ?? 0) + 1 }), {});

console.log(`${total} requests in ${seconds}s: ${JSON.stringify(counts)}`);
if (firstLimited === limit + 1) {
  console.log(`PASS: 429 at request ${firstLimited} (Retry-After ${retryAfter ?? '?'}s) — the limit is ${limit} and the store is shared.`);
  process.exit(0);
}
if (firstLimited === null) {
  console.log(`FAIL: no 429 in ${total} requests — the limiter is per instance (store not configured, or the variables did not reach this deployment).`);
  process.exit(1);
}
console.log(`FAIL: 429 at request ${firstLimited}, expected ${limit + 1} — the limit in force is not ${limit}, or a bucket was already part-full.`);
process.exit(1);
