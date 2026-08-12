import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDelayedFlag, LOADING_REVEAL_DELAY_MS } from '../useDelayedFlag';

/**
 * "Under 200ms: show nothing" (DESIGN_PASS §4), as a rule rather than a habit.
 *
 * The failure this prevents is a fast load that LOOKS slow: a skeleton drawn
 * for 80ms and thrown away is a flash of grey where the figures were about to
 * be, and the eye reads a flash as a fault.
 */
describe('useDelayedFlag', () => {
  beforeEach(() => {
    // The shared setup file has already mocked the clock with setSystemTime
    // (src/test/browserShims.ts); faking timers over the top of that throws,
    // so this hands the real clock back first.
    vi.useRealTimers();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('is false for the whole of the delay, however busy the render', () => {
    const { result } = renderHook(() => useDelayedFlag(true));

    expect(result.current).toBe(false);
    act(() => { vi.advanceTimersByTime(LOADING_REVEAL_DELAY_MS - 1); });
    expect(result.current).toBe(false);
  });

  it('turns true once the wait has actually gone on that long', () => {
    const { result } = renderHook(() => useDelayedFlag(true));

    act(() => { vi.advanceTimersByTime(LOADING_REVEAL_DELAY_MS); });
    expect(result.current).toBe(true);
  });

  it('shows NOTHING at all for a load that finishes inside the delay', () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active), {
      initialProps: { active: true }
    });

    act(() => { vi.advanceTimersByTime(120); });
    rerender({ active: false });

    // The timer that was running must not fire behind the answer's back.
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current).toBe(false);
  });

  it('falls back to false the moment the wait ends, without waiting again', () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active), {
      initialProps: { active: true }
    });

    act(() => { vi.advanceTimersByTime(LOADING_REVEAL_DELAY_MS); });
    expect(result.current).toBe(true);

    rerender({ active: false });
    expect(result.current).toBe(false);
  });

  it('starts the wait again for a second load rather than staying on', () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active), {
      initialProps: { active: true }
    });

    act(() => { vi.advanceTimersByTime(LOADING_REVEAL_DELAY_MS); });
    rerender({ active: false });
    rerender({ active: true });

    expect(result.current).toBe(false);
    act(() => { vi.advanceTimersByTime(LOADING_REVEAL_DELAY_MS); });
    expect(result.current).toBe(true);
  });
});
