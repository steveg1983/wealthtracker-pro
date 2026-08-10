import { describe, it, expect } from 'vitest';
import {
  buildReportDrillPath,
  hasReportArrival,
  readReportArrival,
  stripReportArrival,
} from './reportDrillLink';

/**
 * The link a dashboard chart drills through on.
 *
 * The complaint behind it: a card read over "This month", clicked, opened a
 * report showing all time — the figure the user had just clicked was nowhere on
 * the screen. So the period travels with the click, and these say exactly what
 * travels, what does not, and what happens to a link somebody has edited.
 */

const period = { period: 'this-month' as const, customStart: '', customEnd: '' };

describe('buildReportDrillPath', () => {
  it('carries the window the chart was read over', () => {
    expect(buildReportDrillPath('spending-by-category', { period, currentSearch: '' }))
      .toBe('/reports/spending-by-category?period=this-month');
  });

  it('carries the point that was clicked as well as the window', () => {
    expect(buildReportDrillPath('income-and-spending-over-time', {
      period,
      focus: '2026-08',
      currentSearch: '',
    })).toBe('/reports/income-and-spending-over-time?period=this-month&focus=2026-08');
  });

  it('carries custom bounds only for a custom window', () => {
    const custom = { period: 'custom' as const, customStart: '2026-01-01', customEnd: '2026-03-31' };
    expect(buildReportDrillPath('net-worth-over-time', { period: custom, currentSearch: '' }))
      .toBe('/reports/net-worth-over-time?period=custom&periodFrom=2026-01-01&periodTo=2026-03-31');

    // The same bounds under a named window are noise: nothing reads them, and a
    // link is something a person is meant to be able to look at.
    const named = { period: 'tax-year' as const, customStart: '2026-01-01', customEnd: '2026-03-31' };
    expect(buildReportDrillPath('net-worth-over-time', { period: named, currentSearch: '' }))
      .toBe('/reports/net-worth-over-time?period=tax-year');
  });

  it('sends no period for a report that has none of its own', () => {
    expect(buildReportDrillPath('account-distribution', { currentSearch: '' }))
      .toBe('/reports/account-distribution');
  });

  it('keeps a demo session inside itself', () => {
    expect(buildReportDrillPath('spending-by-category', { period, currentSearch: '?demo=true' }))
      .toBe('/reports/spending-by-category?period=this-month&demo=true');
    expect(buildReportDrillPath('account-distribution', { currentSearch: '?demo=true' }))
      .toBe('/reports/account-distribution?demo=true');
  });
});

describe('readReportArrival', () => {
  it('reads back what was sent', () => {
    expect(readReportArrival('?period=custom&periodFrom=2026-01-01&periodTo=2026-03-31&focus=abc'))
      .toEqual({ period: 'custom', customStart: '2026-01-01', customEnd: '2026-03-31', focus: 'abc' });
  });

  it('reads an ordinary arrival as asking for nothing', () => {
    const arrival = readReportArrival('?demo=true');
    expect(arrival.period).toBeNull();
    expect(arrival.focus).toBeNull();
    expect(hasReportArrival(arrival)).toBe(false);
  });

  it('ignores a period nobody can read rather than opening on nothing', () => {
    // A typo in a shared link, or a window a later build dropped.
    expect(readReportArrival('?period=since-tuesday').period).toBeNull();
  });
});

describe('stripReportArrival', () => {
  it('takes out what has been consumed and leaves the rest alone', () => {
    expect(stripReportArrival('?period=this-month&focus=2026-08&demo=true')).toBe('?demo=true');
  });

  it('leaves an empty search rather than a bare question mark', () => {
    expect(stripReportArrival('?period=this-month')).toBe('');
  });
});
