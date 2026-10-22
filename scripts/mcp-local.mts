/**
 * The Reckley connector on localhost, for ONE ledger, with no OAuth in front.
 *
 * What it is for: exploring a ledger through the connector's own tools (the
 * demo account, when writing or checking docs/mcp-evaluation.xml) and running
 * Anthropic's evaluation harness against the server, which speaks Streamable
 * HTTP to a URL and cannot complete Clerk's sign-in. Everything behind the
 * URL is the production code — the same port, the same server factory — so
 * what the harness measures is what Claude gets.
 *
 * What it is NOT: a way in. It binds to 127.0.0.1 only, it needs the
 * service-role key from a local env file, and it names the ledger by the
 * email on the users row — a developer at this keyboard already holds all of
 * that. It is never deployed.
 *
 * Usage:
 *   npx tsx scripts/mcp-local.mts --email demo@example.com [--env .env.local] [--port 8787] [--write]
 *
 * Without --write the token is read-only (the Read-Only listing's server);
 * with it the write tools are registered too, and a client that calls them
 * WRITES TO THAT LEDGER.
 */

import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createSupabasePort } from '../api/_lib/mcp/port.js';
import { createReckleyServer, READ_SCOPE, WRITE_SCOPE } from '../api/_lib/mcp/server.js';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const has = (name: string): boolean => args.includes(`--${name}`);
const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const email = flag('email') ?? fail('--email is required (the email on the users row)');
const envPath = flag('env') ?? '.env.local';
if (!existsSync(envPath)) fail(`env file not found: ${envPath}`);
const port = Number(flag('port') ?? '8787');
const scopes = has('write') ? [READ_SCOPE, WRITE_SCOPE] : [READ_SCOPE];

const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(line => line.includes('=') && !line.trim().startsWith('#'))
    .map(line => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim().replace(/^"|"$/g, '')])
);
const url = env.VITE_SUPABASE_URL ?? fail('VITE_SUPABASE_URL missing from the env file');
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? fail('SUPABASE_SERVICE_ROLE_KEY missing from the env file');

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: user, error } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
if (error) fail(`users read: ${error.message}`);
if (!user) fail(`no users row has the email ${email}`);
const userId = (user as { id: string }).id;

const ledgerPort = createSupabasePort(supabase, userId, { clientId: 'mcp-local' });
const handler = toNodeHandler(createMcpHandler(() => createReckleyServer({ port: ledgerPort, scopes })));

const server = createServer((req, res) => {
  if (req.url !== '/mcp') {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('POST /mcp');
    return;
  }
  void handler(req, res);
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Reckley connector for ${email} (${scopes.join(' ')}) at http://127.0.0.1:${port}/mcp`);
  console.log(has('write') ? 'WRITE tools are registered: calls change this ledger.' : 'Read-only.');
});
