import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

/**
 * The notification feed persists to localStorage. Before 2026-07-26 it used
 * ONE unscoped key, so signing in as a different user on the same device
 * showed the previous user's alerts — real account names and balance
 * movements. These tests pin the isolation: the store is keyed per user, a
 * user never reads another's entries, and the old unscoped entries are
 * deleted on sight.
 */
const mockUser = vi.hoisted(() => ({ current: { id: 'user_steve' } as { id: string } | null }));
vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ user: mockUser.current }),
}));

import { useActivityTracking } from '../useActivityTracking';

const sampleActivity = {
  type: 'account' as const,
  title: 'HSBC PREMIER - Current Balance Updated',
  description: 'Balance changed',
  amount: 369.92,
};

describe('useActivityTracking user isolation', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUser.current = { id: 'user_steve' };
  });

  it('persists under a key that names the user', () => {
    const { result } = renderHook(() => useActivityTracking());

    act(() => {
      result.current.addActivity(sampleActivity);
    });

    expect(localStorage.getItem('recentActivities:user_steve')).toContain('HSBC PREMIER');
    expect(localStorage.getItem('recentActivities')).toBeNull();
  });

  it("never shows one user's alerts to another", () => {
    const first = renderHook(() => useActivityTracking());
    act(() => {
      first.result.current.addActivity(sampleActivity);
    });
    expect(first.result.current.activities).toHaveLength(1);
    first.unmount();

    mockUser.current = { id: 'user_danielle' };
    const second = renderHook(() => useActivityTracking());

    expect(second.result.current.activities).toHaveLength(0);
    expect(second.result.current.counts.unread).toBe(0);
  });

  it('deletes the old unscoped entries wherever it finds them', () => {
    // Simulate a device that still carries the pre-fix key — whose data this
    // is cannot be proven, so it must not survive.
    localStorage.setItem('recentActivities', JSON.stringify([{ ...sampleActivity, id: 'x', timestamp: new Date().toISOString(), read: false }]));
    localStorage.setItem('lastActivityCheck', new Date().toISOString());

    const { result } = renderHook(() => useActivityTracking());

    expect(localStorage.getItem('recentActivities')).toBeNull();
    expect(localStorage.getItem('lastActivityCheck')).toBeNull();
    expect(result.current.activities).toHaveLength(0);
  });

  it('keeps the feed in memory only when nobody is signed in', () => {
    mockUser.current = null;
    const { result } = renderHook(() => useActivityTracking());

    act(() => {
      result.current.addActivity(sampleActivity);
    });

    expect(result.current.activities).toHaveLength(1);
    expect(Object.keys(localStorage).filter(k => k.startsWith('recentActivities'))).toHaveLength(0);
  });
});
