import { describe, it, expect } from 'vitest';
import { resolvePeriod } from './usePeriod';

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
