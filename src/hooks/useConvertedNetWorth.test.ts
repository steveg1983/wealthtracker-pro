import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useConvertedNetWorth } from './useConvertedNetWorth';

/**
 * The net-worth card's three figures, summed across currencies.
 *
 * Every balance here is invented — the repo is public.
 */
describe('useConvertedNetWorth', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ base: 'GBP', rates: { GBP: 1, USD: 1.25, EUR: 1.2 } }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('a single-currency ledger pays nothing', () => {
    const entries = [
      { balance: 1000, currency: 'GBP' },
      { balance: 250, currency: 'GBP' },
      { balance: -400, currency: 'GBP' },
    ];

    it('answers on the FIRST render, with no request and no loading state', () => {
      const { result } = renderHook(() => useConvertedNetWorth(entries, 'GBP'));

      // No await anywhere: the figures are arithmetic and are available now.
      expect(result.current.isReady).toBe(true);
      expect(result.current.assets.toString()).toBe('1250');
      expect(result.current.liabilities.toString()).toBe('400');
      expect(result.current.netWorth.toString()).toBe('850');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('reports no provenance, so the card says nothing about rates', () => {
      const { result } = renderHook(() => useConvertedNetWorth(entries, 'GBP'));

      expect(result.current.provenance).toBeNull();
      expect(result.current.unconverted).toEqual([]);
    });

    it('treats a zero balance as neither an asset nor a liability', () => {
      const { result } = renderHook(() =>
        useConvertedNetWorth([{ balance: 0, currency: 'GBP' }, { balance: 100, currency: 'GBP' }], 'GBP')
      );

      expect(result.current.assets.toString()).toBe('100');
      expect(result.current.liabilities.toString()).toBe('0');
    });
  });

  describe('a mixed-currency ledger is converted', () => {
    it('converts each balance before summing', async () => {
      const { result } = renderHook(() =>
        useConvertedNetWorth(
          [
            { balance: 1000, currency: 'GBP' },
            // 250 USD at 1.25 per GBP is 200 GBP.
            { balance: 250, currency: 'USD' },
          ],
          'GBP'
        )
      );

      await waitFor(() => expect(result.current.isReady).toBe(true));

      expect(result.current.assets.toString()).toBe('1200');
      expect(result.current.netWorth.toString()).toBe('1200');
    });

    it('does NOT show the raw cross-currency sum while converting', () => {
      // The figure that would appear if the totals were rendered before the
      // conversion landed is 1250 — a dollar counted as a pound. It must never
      // reach the screen, not even briefly.
      const { result } = renderHook(() =>
        useConvertedNetWorth(
          [{ balance: 1000, currency: 'GBP' }, { balance: 250, currency: 'USD' }],
          'GBP'
        )
      );

      expect(result.current.isReady).toBe(false);
      expect(result.current.netWorth.toString()).not.toBe('1250');
      expect(result.current.netWorth.toString()).toBe('0');
    });

    it('converts liabilities as well as assets', async () => {
      const { result } = renderHook(() =>
        useConvertedNetWorth(
          [
            { balance: 1000, currency: 'GBP' },
            // -500 USD is -400 GBP.
            { balance: -500, currency: 'USD' },
          ],
          'GBP'
        )
      );

      await waitFor(() => expect(result.current.isReady).toBe(true));

      expect(result.current.assets.toString()).toBe('1000');
      expect(result.current.liabilities.toString()).toBe('400');
      expect(result.current.netWorth.toString()).toBe('600');
    });

    it('reports the provenance of the rates it used', async () => {
      const { result } = renderHook(() =>
        useConvertedNetWorth(
          [{ balance: 1000, currency: 'GBP' }, { balance: 250, currency: 'USD' }],
          'GBP'
        )
      );

      await waitFor(() => expect(result.current.isReady).toBe(true));

      // The suite's stub answers both providers, and the ECB overlay wins —
      // the one-provider rule (Design, 24 Aug §1).
      expect(result.current.provenance?.source).toBe('ecb');
    });

    it('reports the fallback when the provider cannot be reached', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockReset().mockRejectedValue(new Error('offline'));

      // A COLD module graph. The rates cache is module state and an earlier
      // test in this file already cached a live quote for the hour — without
      // this the hook would answer from that cache and never attempt the fetch
      // this test is about.
      vi.resetModules();
      const { useConvertedNetWorth: coldHook } = await import('./useConvertedNetWorth');

      const { result } = renderHook(() =>
        coldHook(
          [{ balance: 1000, currency: 'GBP' }, { balance: 250, currency: 'USD' }],
          'GBP'
        )
      );

      await waitFor(() => expect(result.current.isReady).toBe(true));

      // An offline desktop still gets its totals — they just say what they are.
      expect(result.current.provenance?.source).toBe('fallback');
      expect(result.current.netWorth.isZero()).toBe(false);
      consoleErrorSpy.mockRestore();
    });

    it('names a currency it had no rate for', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useConvertedNetWorth(
          [{ balance: 1000, currency: 'GBP' }, { balance: 250, currency: 'ZZZ' }],
          'GBP'
        )
      );

      await waitFor(() => expect(result.current.isReady).toBe(true));

      expect(result.current.unconverted).toEqual(['ZZZ']);
      consoleWarnSpy.mockRestore();
    });
  });
});
