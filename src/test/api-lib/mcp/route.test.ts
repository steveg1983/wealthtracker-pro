/**
 * THE MCP ROUTE OVER REAL HTTP — the OAuth handshake in front of the server.
 *
 * A Node http server runs the route exactly as Vercel would, and the specs
 * speak to it with fetch and with a real MCP client. The verifier is a fake
 * that answers for three tokens; the port is fakePort.ts.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, request, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpRoute } from '../../../../api/_lib/mcp/route';
import type { OAuthVerifier, VerifiedCaller } from '../../../../api/_lib/mcp/auth';
import { READ_SCOPE, WRITE_SCOPE } from '../../../../api/_lib/mcp/server';
import { fakePort } from './fakePort';

const caller = (token: string, scopes: string[], userId = 'ledger-user-1'): VerifiedCaller => ({
  authInfo: { token, clientId: 'client-claude', scopes, extra: { userId, clerkUserId: 'user_clerk_1' } },
  userId,
  clerkUserId: 'user_clerk_1',
});

const TOKENS: Record<string, ReturnType<typeof caller> | 'unknown-user'> = {
  'full-token': caller('full-token', [READ_SCOPE, WRITE_SCOPE]),
  'read-token': caller('read-token', [READ_SCOPE]),
  'profile-only': caller('profile-only', ['profile']),
  'no-ledger': 'unknown-user',
};

const verify: OAuthVerifier = async (req) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return TOKENS[token] ?? 'anonymous';
};

const portsBuiltFor: string[] = [];

/**
 * A fetch over node:http. The suite's setup replaces the global fetch with
 * a stub for every browser spec, so a spec that wants a real socket brings
 * its own. The stateless MCP handler answers each call with a complete
 * body, so buffering it into a Response loses nothing.
 */
const httpFetch = (input: string | URL | Request, init?: RequestInit): Promise<Response> =>
  new Promise((resolve, reject) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const req = request(
      url,
      { method: init?.method ?? 'GET', headers: Object.fromEntries(headers.entries()) },
      res => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const responseHeaders = new Headers();
          for (const [name, value] of Object.entries(res.headers)) {
            if (typeof value === 'string') responseHeaders.set(name, value);
            else if (Array.isArray(value)) responseHeaders.set(name, value.join(', '));
          }
          const status = res.statusCode ?? 0;
          const body = status === 204 || status === 304 ? null : Buffer.concat(chunks);
          resolve(new Response(body, { status, headers: responseHeaders }));
        });
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    if (typeof init?.body === 'string') req.write(init.body);
    req.end();
  });

let server: Server;
let base: string;

beforeAll(async () => {
  const route = createMcpRoute<IncomingMessage & { body?: unknown }, ServerResponse>({
    listing: 'full',
    verify,
    portFor: (who) => {
      portsBuiltFor.push(who.userId);
      return fakePort();
    },
    now: () => new Date(2026, 9, 15),
  });
  server = createServer((req, res) => {
    void route(req, res);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
});

const initialize = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'spec', version: '1' } },
});

const post = (token?: string, path = '/api/mcp', proto: Record<string, string> = { 'X-Forwarded-Proto': 'http' }): Promise<Response> =>
  httpFetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...proto,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: initialize,
  });

describe('the handshake', () => {
  it('answers no token with 401 and the discovery pointer, built from the request’s own host', async () => {
    const response = await post();
    expect(response.status).toBe(401);
    const challenge = response.headers.get('www-authenticate') ?? '';
    expect(challenge).toContain(`resource_metadata="http://127.0.0.1:${(server.address() as AddressInfo).port}/api/mcp-oauth-protected-resource?listing=full"`);
    expect(challenge).toContain('scope="reckley:read reckley:write"');
    expect(await response.json()).toMatchObject({ error: 'unauthorized' });
  });

  it('names the pointer https when the platform says nothing about the scheme', async () => {
    const response = await post(undefined, '/api/mcp', {});
    expect(response.headers.get('www-authenticate')).toContain('resource_metadata="https://127.0.0.1:');
  });

  it('answers a person with no ledger with 403, in words', async () => {
    const response = await post('no-ledger');
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: 'no_ledger' });
  });

  it('answers a token without the read scope with 403 insufficient_scope and the scopes wanted', async () => {
    const response = await post('profile-only');
    expect(response.status).toBe(403);
    const challenge = response.headers.get('www-authenticate') ?? '';
    expect(challenge).toContain('error="insufficient_scope"');
    expect(challenge).toContain('scope="reckley:read reckley:write"');
  });

  it('lets a browser client ask first', async () => {
    const response = await httpFetch(`${base}/api/mcp`, { method: 'OPTIONS' });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-expose-headers')).toContain('WWW-Authenticate');
  });
});

describe('a verified caller', () => {
  const connect = async (token: string): Promise<Client> => {
    const transport = new StreamableHTTPClientTransport(new URL(`${base}/api/mcp`), {
      fetch: (url, init) => {
        const headers = new Headers(init?.headers);
        headers.set('Authorization', `Bearer ${token}`);
        return httpFetch(url, { ...init, headers });
      },
    });
    const client = new Client({ name: 'spec-harness', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
    await client.connect(transport);
    return client;
  };

  it('reaches the tools, over a port built for their own ledger and nobody else’s', async () => {
    portsBuiltFor.length = 0;
    const client = await connect('full-token');
    try {
      const { tools } = await client.listTools();
      expect(tools.map(tool => tool.name)).toContain('reckley_list_accounts');

      const result = await client.callTool({ name: 'reckley_list_accounts', arguments: { response_format: 'json' } });
      expect((result.structuredContent as { count: number }).count).toBe(2);
    } finally {
      await client.close();
    }
    expect(new Set(portsBuiltFor)).toEqual(new Set(['ledger-user-1']));
  });

  it('works for a read-only token too', async () => {
    const client = await connect('read-token');
    try {
      const { tools } = await client.listTools();
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.every(tool => tool.annotations?.readOnlyHint === true)).toBe(true);
    } finally {
      await client.close();
    }
  });
});

describe('the rate limit sits in front of the verifier', () => {
  it('answers a flood with 429 before any token is looked at, and never throttles a preflight', async () => {
    let verified = 0;
    let calls = 0;
    const route = createMcpRoute<IncomingMessage & { body?: unknown }, ServerResponse>({
      listing: 'full',
      verify: async req => {
        verified += 1;
        return verify(req);
      },
      portFor: () => fakePort(),
      rateLimit: async (_req, res) => {
        calls += 1;
        if (calls <= 2) return false;
        res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' });
        res.end(JSON.stringify({ error: 'rate_limited' }));
        return true;
      },
    });
    const limited = createServer((req, res) => {
      void route(req, res);
    });
    await new Promise<void>(resolve => limited.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${(limited.address() as AddressInfo).port}`;
    try {
      const flood = async (): Promise<number> =>
        (await httpFetch(`${origin}/api/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: initialize })).status;
      expect(await flood()).toBe(401);
      expect(await flood()).toBe(401);
      expect(await flood()).toBe(429);
      expect(await flood()).toBe(429);
      // Two were verified and refused; the rest never reached the verifier.
      expect(verified).toBe(2);
      // A preflight is answered before the limiter, whatever the count.
      const preflight = await httpFetch(`${origin}/api/mcp`, { method: 'OPTIONS' });
      expect(preflight.status).toBe(204);
      expect(calls).toBe(4);
    } finally {
      await new Promise<void>((resolve, reject) => limited.close(error => (error ? reject(error) : resolve())));
    }
  });
});

