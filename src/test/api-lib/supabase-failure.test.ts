import { describe, it, expect } from 'vitest';
import { describeSupabaseFailure } from '../../../api/_lib/supabase-failure';

// 22 Sep 2026: two hours of Cloudflare 522 pages from Supabase's edge, and
// Sentry titled both cron issues with the opening of an HTML document.
const CLOUDFLARE_PAGE =
  '<!DOCTYPE html>\n<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->\n' +
  '<head><title>api.example.com | 522: Connection timed out</title></head><body>…</body></html>';

describe('describeSupabaseFailure', () => {
  it('names an HTML body for what it is, with the status in front', () => {
    const line = describeSupabaseFailure({ message: CLOUDFLARE_PAGE }, 522);
    expect(line).toBe(
      'HTTP 522 — the gateway answered with an HTML page instead of JSON (Supabase unreachable upstream; the next run retries)'
    );
    expect(line).not.toContain('<');
  });

  it('keeps a real PostgREST error in its own words, status and code in front', () => {
    expect(describeSupabaseFailure({ message: 'permission denied for table push_devices', code: '42501' }, 401))
      .toBe('HTTP 401 [42501]: permission denied for table push_devices');
  });

  it('prints no "HTTP undefined" when there was no response to read a status from', () => {
    expect(describeSupabaseFailure({ message: 'fetch failed' })).toBe('fetch failed');
    expect(describeSupabaseFailure({ message: 'fetch failed', code: 'ECONNRESET' })).toBe('fetch failed [ECONNRESET]');
    expect(describeSupabaseFailure({ message: CLOUDFLARE_PAGE }, 0)).toBe(
      'the gateway answered with an HTML page instead of JSON (Supabase unreachable upstream; the next run retries)'
    );
  });
});
