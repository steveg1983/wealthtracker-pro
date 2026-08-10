import { describe, it, expect } from 'vitest';
import {
  currentPageProvenance,
  readProvenance,
  readResumeCrumbs,
  returnState,
  withProvenance,
} from './navigationProvenance';

/**
 * Provenance is read off history state, which outlives a deploy: whatever a
 * previous build wrote can arrive here, and so can a user with the developer
 * tools open. Every one of these is about the same rule — an unreadable
 * provenance is NO provenance, which leaves the page showing its own back-link
 * rather than one that goes somewhere wrong.
 */

describe('currentPageProvenance', () => {
  it('remembers the query string too, so a demo session comes back a demo session', () => {
    expect(currentPageProvenance({ pathname: '/dashboard', search: '?demo=true' }, 'Back to Dashboard'))
      .toEqual({ path: '/dashboard?demo=true', label: 'Back to Dashboard' });
  });

  it('carries the origin’s own crumbs when it has any', () => {
    const from = currentPageProvenance({ pathname: '/settings/data', search: '' }, 'Back', { pairKey: 'x' });
    expect(from.resume).toEqual({ pairKey: 'x' });
    expect(returnState(from)).toEqual({ resume: { pairKey: 'x' } });
  });

  it('leaves a clean history entry when there is nothing to restore', () => {
    expect(returnState({ path: '/dashboard', label: 'Back to Dashboard' })).toBeUndefined();
  });
});

describe('readProvenance', () => {
  it('reads back what withProvenance wrote', () => {
    const from = { path: '/dashboard', label: 'Back to Dashboard' };
    expect(readProvenance(withProvenance(from))).toEqual(from);
  });

  it('reads a direct arrival — a bookmark, a typed URL — as no provenance', () => {
    expect(readProvenance(null)).toBeNull();
    expect(readProvenance(undefined)).toBeNull();
    expect(readProvenance({})).toBeNull();
  });

  it('refuses a half-written provenance rather than drawing half a link', () => {
    expect(readProvenance({ from: { path: '/dashboard' } })).toBeNull();
    expect(readProvenance({ from: { label: 'Back to Dashboard' } })).toBeNull();
    expect(readProvenance({ from: { path: '', label: 'Back' } })).toBeNull();
    expect(readProvenance({ from: { path: 42, label: 'Back' } })).toBeNull();
    expect(readProvenance({ from: 'the dashboard' })).toBeNull();
  });
});

describe('readResumeCrumbs', () => {
  it('hands back exactly what the origin put there', () => {
    expect(readResumeCrumbs({ resume: { tool: 'find-duplicates' } })).toEqual({ tool: 'find-duplicates' });
  });

  it('is undefined on an ordinary arrival', () => {
    expect(readResumeCrumbs(null)).toBeUndefined();
    expect(readResumeCrumbs({ from: { path: '/x', label: 'y' } })).toBeUndefined();
  });
});
