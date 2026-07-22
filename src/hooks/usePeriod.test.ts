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

  beforeEach(() => {
    localStorage.clear();
  });

  it('starts on the surface’s default, unchosen', () => {
    const { result } = renderHook(() => usePeriod(KEY, 'all'));

    expect(result.current.period).toBe('all');
    expect(result.current.isExplicit).toBe(false);
    // Nothing was chosen, so nothing is remembered.
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('applies another surface’s default while nothing has been chosen', () => {
    const { result } = renderHook(() => usePeriod(KEY));

    act(() => result.current.applyDefaultPeriod('last-12-months'));

    expect(result.current.period).toBe('last-12-months');
    expect(result.current.isExplicit).toBe(false);
  });

  it('never overrides a choice the user made', () => {
    const { result } = renderHook(() => usePeriod(KEY));

    act(() => result.current.setPeriod('tax-year'));
    expect(result.current.isExplicit).toBe(true);

    act(() => result.current.applyDefaultPeriod('all'));

    expect(result.current.period).toBe('tax-year');
    expect(result.current.isExplicit).toBe(true);
  });

  it('remembers the choice across a remount, defaults do not', () => {
    const first = renderHook(() => usePeriod(KEY, 'this-month'));
    act(() => first.result.current.applyDefaultPeriod('all'));
    first.unmount();

    // A default is a suggestion, so the next surface's own default wins.
    const second = renderHook(() => usePeriod(KEY, 'last-12-months'));
    expect(second.result.current.period).toBe('last-12-months');
    expect(second.result.current.isExplicit).toBe(false);

    act(() => second.result.current.setPeriod('tax-year'));
    second.unmount();

    const third = renderHook(() => usePeriod(KEY, 'all'));
    expect(third.result.current.period).toBe('tax-year');
    expect(third.result.current.isExplicit).toBe(true);
  });

  it('treats a period stored before the flag existed as the user’s choice', () => {
    // Older builds only ever wrote the key from the picker itself.
    localStorage.setItem(KEY, 'last-month');

    const { result } = renderHook(() => usePeriod(KEY, 'all'));

    expect(result.current.period).toBe('last-month');
    expect(result.current.isExplicit).toBe(true);
  });

  it('ignores a stored value that is not a period', () => {
    localStorage.setItem(KEY, 'last-fortnight');

    const { result } = renderHook(() => usePeriod(KEY, 'all'));

    expect(result.current.period).toBe('all');
    expect(result.current.isExplicit).toBe(false);
  });

  it('counts editing a custom range as choosing one', () => {
    const { result } = renderHook(() => usePeriod(KEY));

    act(() => result.current.setCustomStart('2026-01-10'));

    expect(result.current.isExplicit).toBe(true);

    act(() => result.current.applyDefaultPeriod('all'));
    expect(result.current.period).toBe('this-month');
  });
});
