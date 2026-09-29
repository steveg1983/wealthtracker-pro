import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { lastSuccessfulTransactionSyncAt } from '../../../api/_lib/sync-window-anchor';

// A REAL client whose transport is a stub: PostgREST's query string is what
// gets asserted, so a filter dropped by accident fails here rather than
// silently widening the anchor to the wrong run.
const clientAnswering = (
  body: string,
  status = 200,
  seen: { url?: string } = {}
) =>
  createClient('http://localhost:54321', 'invented-anon-key', {
    global: {
      fetch: async (input) => {
        seen.url = String(input);
        return new Response(body, { status, headers: { 'content-type': 'application/json' } });
      },
    },
  });

describe('lastSuccessfulTransactionSyncAt', () => {
  it('asks sync_history for the newest SUCCESSFUL TRANSACTIONS run of this connection only', async () => {
    const seen: { url?: string } = {};
    const supabase = clientAnswering(JSON.stringify([{ created_at: '2026-09-16T21:20:17+00:00' }]), 200, seen);

    const at = await lastSuccessfulTransactionSyncAt(supabase, 'conn-1');

    expect(at).toBe('2026-09-16T21:20:17+00:00');
    const url = new URL(seen.url ?? '');
    expect(url.pathname).toBe('/rest/v1/sync_history');
    expect(url.searchParams.get('connection_id')).toBe('eq.conn-1');
    expect(url.searchParams.get('sync_type')).toBe('eq.transactions');
    expect(url.searchParams.get('status')).toBe('eq.success');
    expect(url.searchParams.get('order')).toBe('created_at.desc');
    expect(url.searchParams.get('limit')).toBe('1');
  });

  it('is null when the connection has never read transactions successfully', async () => {
    expect(await lastSuccessfulTransactionSyncAt(clientAnswering('[]'), 'conn-1')).toBeNull();
  });

  it('names a failed read by its status rather than guessing a window', async () => {
    await expect(
      lastSuccessfulTransactionSyncAt(clientAnswering('<!DOCTYPE html><html>gateway</html>', 522), 'conn-1')
    ).rejects.toThrow(/HTTP 522/);
  });
});
