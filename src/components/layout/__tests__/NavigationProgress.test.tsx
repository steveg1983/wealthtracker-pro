/**
 * The navigation progress bar leaves no timer behind when it goes.
 *
 * The failure this guards: unmounting during the 300ms fill left the inner
 * 200ms timer untracked, and it fired `setIsNavigating(false)` into a DOM
 * that no longer existed — an unhandled "window is not defined" from React's
 * scheduler that failed a docs-only CI run on 22 Oct 2026. A pending-timer
 * count of zero after unmount is the whole claim.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NavigationProgress } from '../SimplePageTransition';

describe('NavigationProgress', () => {
  beforeEach(() => {
    // The suite's setup leaves Date mocked; fake timers refuse to start over it.
    vi.useRealTimers();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fills, lingers, and then goes, when left alone', () => {
    const { container } = render(<MemoryRouter><NavigationProgress /></MemoryRouter>);
    expect(container.querySelector('.fixed')).not.toBeNull();
    act(() => { vi.advanceTimersByTime(300); });
    expect(container.querySelector('.fixed')).not.toBeNull();
    act(() => { vi.advanceTimersByTime(200); });
    expect(container.querySelector('.fixed')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves no timer pending when unmounted mid-fill — the inner one included', () => {
    const { unmount } = render(<MemoryRouter><NavigationProgress /></MemoryRouter>);
    // Past the 300ms fill, so the inner 200ms timer has been set.
    act(() => { vi.advanceTimersByTime(300); });
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    // And nothing fires into the gone component.
    expect(() => vi.runAllTimers()).not.toThrow();
  });
});
