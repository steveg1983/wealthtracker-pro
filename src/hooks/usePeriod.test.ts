import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { resolvePeriod, usePeriod } from './usePeriod';

describe('resolvePeriod', () => {
  it('this-month starts on the 1st, unbounded end', () => {
    const { from, to } = resolvePeriod('this-month', '', '', new Date(2026, 6, 21));
    expect(from).toEqual(new Date(2026, 6, 1));
    expect(to).toBeNull();
  });

  it('last-month spans the full previous calendar month', () => {
    const { from, to } = resolvePeriod('last-month', '', '', new Date(2026, 6, 21));
    expect(from).toEqual(new Date(2026, 5, 1));
    expect(to?.getMonth()).toBe(5);
    expect(to?.getDate()).toBe(30); // June has 30 days
    expect(to?.getHours()).toBe(23);
  });

  it('UK tax year starts 6 April — after the boundary', () => {
    const { from } = resolvePeriod('tax-year', '', '', new Date(2026, 6, 21));
    expect(from).toEqual(new Date(2026, 3, 6));
  });

  it('UK tax year starts 6 April — before the boundary it is LAST year', () => {
    const { from } = resolvePeriod('tax-year', '', '', new Date(2026, 3, 5));
    expect(from).toEqual(new Date(2025, 3, 6));
    // and exactly ON the boundary it is this year
    const onDay = resolvePeriod('tax-year', '', '', new Date(2026, 3, 6));
    expect(onDay.from).toEqual(new Date(2026, 3, 6));
  });

  it('all time is unbounded both ends', () => {
    const { from, to } = resolvePeriod('all', '', '');
    expect(from).toBeNull();
    expect(to).toBeNull();
  });

  it('custom bounds are inclusive of the entire end day', () => {
    const { from, to } = resolvePeriod('custom', '2026-01-10', '2026-02-20');
    expect(from).toEqual(new Date('2026-01-10'));
    expect(to?.getDate()).toBe(20);
    expect(to?.getHours()).toBe(23);
    expect(to?.getMinutes()).toBe(59);
  });
});

/**
 * The rule these guard: a surface may suggest the window it is worth reading
 * over, but the moment the user picks one themselves that choice wins — here,
 * on the next report, and after a reload.
 */
describe('usePeriod defaults vs the user’s own choice', () => {
  const KEY = 'testPeriod';

  /**
   * A period lives in the PREFERENCES document in the running app, so that the
   * dashboard opens on the window the user chose whichever machine they are at.
   * These tests hand the hook plain localStorage instead — the adapter exists
   * exactly so they can — because what is under test is the default-versus-
   * choice rule, not where the answer is filed. Injecting it also keeps each
   * case starting from a genuinely empty store, which a module-level service
   * shared with every other suite cannot promise.
   */
  const store = localStorage;

  beforeEach(() => {
    localStorage.clear();
  });

  it('starts on the surface’s default, unchosen', () => {
    const { result } = renderHook(() => usePeriod(KEY, 'all', store));

    expect(result.current.period).toBe('all');
    expect(result.current.isExplicit).toBe(false);
    // Nothing was chosen, so nothing is remembered.
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('applies another surface’s default while nothing has been chosen', () => {
    const { result } = renderHook(() => usePeriod(KEY, 'this-month', store));

    act(() => result.current.applyDefaultPeriod('last-12-months'));

    expect(result.current.period).toBe('last-12-months');
    expect(result.current.isExplicit).toBe(false);
  });

  it('never overrides a choice the user made', () => {
    const { result } = renderHook(() => usePeriod(KEY, 'this-month', store));

    act(() => result.current.setPeriod('tax-year'));
    expect(result.current.isExplicit).toBe(true);

    act(() => result.current.applyDefaultPeriod('all'));

    expect(result.current.period).toBe('tax-year');
    expect(result.current.isExplicit).toBe(true);
  });

  it('remembers the choice across a remount, defaults do not', () => {
    const first = renderHook(() => usePeriod(KEY, 'this-month', store));
    act(() => first.result.current.applyDefaultPeriod('all'));
    first.unmount();

    // A default is a suggestion, so the next surface's own default wins.
    const second = renderHook(() => usePeriod(KEY, 'last-12-months', store));
    expect(second.result.current.period).toBe('last-12-months');
    expect(second.result.current.isExplicit).toBe(false);

    act(() => second.result.current.setPeriod('tax-year'));
    second.unmount();

    const third = renderHook(() => usePeriod(KEY, 'all', store));
    expect(third.result.current.period).toBe('tax-year');
    expect(third.result.current.isExplicit).toBe(true);
  });

  it('lets a report’s window override a period stored before the flag existed', () => {
    // An older build wrote this key from the picker — but for one tabbed
    // reports page, not as a standing instruction for reports that did not
    // exist yet. Honouring it as a choice meant a returning user could never
    // see a report's preferred window, which is the whole point of the
    // feature. So it seeds nothing and the caller's default wins.
    localStorage.setItem(KEY, 'last-month');

    const { result } = renderHook(() => usePeriod(KEY, 'all', store));

    expect(result.current.period).toBe('all');
    expect(result.current.isExplicit).toBe(false);
  });

  it('honours the very next choice the user makes after that reset', () => {
    localStorage.setItem(KEY, 'last-month');

    const first = renderHook(() => usePeriod(KEY, 'all', store));
    act(() => first.result.current.setPeriod('tax-year'));

    const second = renderHook(() => usePeriod(KEY, 'all', store));
    expect(second.result.current.period).toBe('tax-year');
    expect(second.result.current.isExplicit).toBe(true);

    act(() => second.result.current.applyDefaultPeriod('all'));
    expect(second.result.current.period).toBe('tax-year');
  });

  it('ignores a stored value that is not a period', () => {
    localStorage.setItem(KEY, 'last-fortnight');

    const { result } = renderHook(() => usePeriod(KEY, 'all', store));

    expect(result.current.period).toBe('all');
    expect(result.current.isExplicit).toBe(false);
  });

  it('counts editing a custom range as choosing one', () => {
    const { result } = renderHook(() => usePeriod(KEY, 'this-month', store));

    act(() => result.current.setCustomStart('2026-01-10'));

    expect(result.current.isExplicit).toBe(true);

    act(() => result.current.applyDefaultPeriod('all'));
    expect(result.current.period).toBe('this-month');
  });
});

/**
 * The window a DRILL-DOWN brings with it: the one the chart it was clicked on
 * was read over.
 *
 * It has to beat the destination's own preferred window (the user chose it a
 * click ago, on the card they came from) and it must not be written down (they
 * were looking at something, not changing their mind about which window this
 * page opens on). Those two together are the whole feature.
 */
describe('usePeriod and a window that arrived with a drill-down', () => {
  const KEY = 'arrivalPeriod';
  const store = localStorage;

  beforeEach(() => {
    localStorage.clear();
  });

  it('shows the window that arrived', () => {
    const { result } = renderHook(() => usePeriod(KEY, 'all', store));

    act(() => result.current.applyArrivalPeriod('this-month'));

    expect(result.current.period).toBe('this-month');
  });

  it('writes nothing down: the stored choice is exactly as the user left it', () => {
    const first = renderHook(() => usePeriod(KEY, 'this-month', store));
    act(() => first.result.current.setPeriod('all'));

    const visit = renderHook(() => usePeriod(KEY, 'this-month', store));
    act(() => visit.result.current.applyArrivalPeriod('last-month'));
    expect(visit.result.current.period).toBe('last-month');

    // The next ordinary visit opens on the window the user chose, not the one
    // a link borrowed.
    const later = renderHook(() => usePeriod(KEY, 'this-month', store));
    expect(later.result.current.period).toBe('all');
    expect(store.getItem(KEY)).toBe('all');
  });

  it('outranks the destination’s preferred window, whichever runs first', () => {
    const { result } = renderHook(() => usePeriod(KEY, 'all', store));

    // The hub applies the report's preference from one effect and the arrival
    // from another; both close over the same render's state, so the rule cannot
    // depend on which React happens to run first.
    act(() => {
      result.current.applyArrivalPeriod('this-month');
      result.current.applyDefaultPeriod('all');
    });
    expect(result.current.period).toBe('this-month');

    const other = renderHook(() => usePeriod(KEY, 'all', store));
    act(() => {
      other.result.current.applyDefaultPeriod('all');
      other.result.current.applyArrivalPeriod('this-month');
    });
    expect(other.result.current.period).toBe('this-month');
  });

  it('takes custom bounds only when a custom window arrived', () => {
    const { result } = renderHook(() => usePeriod(KEY, 'all', store));

    act(() => result.current.applyArrivalPeriod('custom', '2026-01-10', '2026-02-20'));

    expect(result.current.period).toBe('custom');
    expect(result.current.customStart).toBe('2026-01-10');
    expect(result.current.range.from).toEqual(new Date('2026-01-10'));
    // Still nothing written down.
    expect(store.getItem(`${KEY}CustomStart`)).toBeNull();
  });

  it('hands control straight back: the next pick IS a choice, and is kept', () => {
    const { result } = renderHook(() => usePeriod(KEY, 'all', store));

    act(() => result.current.applyArrivalPeriod('this-month'));
    act(() => result.current.setPeriod('tax-year'));

    expect(store.getItem(KEY)).toBe('tax-year');
    expect(result.current.isExplicit).toBe(true);
  });
});
