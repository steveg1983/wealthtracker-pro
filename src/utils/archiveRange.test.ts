import { describe, it, expect } from 'vitest';
import { computeArchiveWindow } from './archiveRange';

const now = new Date('2026-07-09T12:00:00.000Z');

describe('computeArchiveWindow', () => {
  it('is unbounded for "all"', () => {
    expect(computeArchiveWindow('all', '', '', now)).toEqual({ from: null, to: null });
  });

  it('looks back N months from now for presets', () => {
    expect(computeArchiveWindow('1m', '', '', now).from?.toISOString()).toBe('2026-06-09T12:00:00.000Z');
    expect(computeArchiveWindow('3m', '', '', now).from?.toISOString()).toBe('2026-04-09T12:00:00.000Z');
    expect(computeArchiveWindow('12m', '', '', now).from?.toISOString()).toBe('2025-07-09T12:00:00.000Z');
    expect(computeArchiveWindow('6m', '', '', now).to).toBeNull();
  });

  it('uses the given ISO dates for "custom"', () => {
    const w = computeArchiveWindow('custom', '2008-01-01', '2010-12-31', now);
    expect(w.from?.toISOString().slice(0, 10)).toBe('2008-01-01');
    expect(w.to?.toISOString().slice(0, 10)).toBe('2010-12-31');
  });

  it('treats an empty custom bound as open-ended', () => {
    expect(computeArchiveWindow('custom', '', '', now)).toEqual({ from: null, to: null });
    expect(computeArchiveWindow('custom', '2020-01-01', '', now).to).toBeNull();
  });
});
