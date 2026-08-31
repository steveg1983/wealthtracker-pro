import { describe, it, expect } from 'vitest';
import {
  holdingTraceRows,
  tradeDateCompanions,
  tradeRowDescriptions,
  openingPositionRowsFor,
} from './tradeDateCompanions';

/**
 * WHICH REGISTER ROWS BELONG TO A TRADE — the decision behind "move this
 * trade's date" and behind what a deleted holding takes with it. The
 * descriptions here are built by the same formatters the writers use, so a
 * drift in either place fails these tests instead of orphaning rows.
 *
 * Every figure and symbol invented: this repo is public.
 */

const T = (id: string, accountId: string, date: string, description: string) => ({
  id, accountId, date, description,
});

describe('the descriptions a trade writes', () => {
  it('a buy owns its transfer legs and its opening-position row', () => {
    expect(
      tradeRowDescriptions({ date: '2023-01-01', kind: 'buy', quantity: '8587.805', symbol: 'SYNTHFUND' })
    ).toEqual([
      // formatDecimal pads to fixed four places, ungrouped — the writer's
      // exact output, which is the whole point of sharing its formatter.
      'Buy 8587.8050 SYNTHFUND',
      'Opening position — 8587.805 SYNTHFUND',
    ]);
  });

  it('a sale owns its proceeds and its realised line, gain or loss', () => {
    expect(
      tradeRowDescriptions({ date: '2024-05-01', kind: 'sell', quantity: '10', symbol: 'SYNTH' })
    ).toEqual(['Sell 10.0000 SYNTH', 'Realised gain — SYNTH', 'Realised loss — SYNTH']);
  });

  it('a write-off and a symbol-less security own nothing', () => {
    expect(tradeRowDescriptions({ date: '2024-05-01', kind: 'write_off', quantity: '10', symbol: 'SYNTH' })).toEqual([]);
    expect(tradeRowDescriptions({ date: '2024-05-01', kind: 'buy', quantity: '10', symbol: null })).toEqual([]);
  });
});

describe('what moves with the trade', () => {
  const BUY = { date: '2023-01-01', kind: 'buy' as const, quantity: '8587.805', symbol: 'SYNTHFUND' };

  it('finds both transfer legs — the counterpart copies the description', () => {
    const rows = [
      T('t1', 'acc-cash', '2023-01-01', 'Buy 8587.8050 SYNTHFUND'),
      T('t2', 'acc-invest', '2023-01-01', 'Buy 8587.8050 SYNTHFUND'),
      T('t3', 'acc-cash', '2023-01-01', 'OCTOPUS ENERGY'),
    ];
    expect(tradeDateCompanions(BUY, rows)).toEqual(['t1', 't2']);
  });

  it('finds the unfunded opening-position row', () => {
    const rows = [T('t1', 'acc-invest', '2023-01-01', 'Opening position — 8587.805 SYNTHFUND')];
    expect(tradeDateCompanions(BUY, rows)).toEqual(['t1']);
  });

  it('refuses a row on another day — a hand-redated row is the owner’s, not this trade’s', () => {
    // The motivating case: the owner had already moved the row by hand, so
    // the move must not drag it back.
    const rows = [T('t1', 'acc-invest', '2026-08-30', 'Opening position — 8587.805 SYNTHFUND')];
    expect(tradeDateCompanions(BUY, rows)).toEqual([]);
  });

  it('refuses another symbol’s identical-quantity trade on the same day', () => {
    const rows = [T('t1', 'acc-invest', '2023-01-01', 'Opening position — 8587.805 OTHERFUND')];
    expect(tradeDateCompanions(BUY, rows)).toEqual([]);
  });
});

describe('what a deleted holding takes with it', () => {
  it('every opening-position row for the symbol, whatever its date or quantity', () => {
    const rows = [
      T('t1', 'acc-invest', '2023-01-01', 'Opening position — 8587.805 SYNTHFUND'),
      // Redated by hand, quantity edited since — still this position's cost.
      T('t2', 'acc-invest', '2020-06-15', 'Opening position — 9000 SYNTHFUND'),
      T('t3', 'acc-invest', '2023-01-01', 'Opening position — 100 OTHERFUND'),
      // A funded buy's transfer is real money and stays.
      T('t4', 'acc-invest', '2023-01-01', 'Buy 8587.8050 SYNTHFUND'),
      // Same symbol, different account: another portfolio's position.
      T('t5', 'acc-other', '2023-01-01', 'Opening position — 50 SYNTHFUND'),
    ];
    expect(openingPositionRowsFor('acc-invest', 'SYNTHFUND', rows)).toEqual(['t1', 't2']);
  });
});

describe('the offer a deleted holding can make', () => {
  const BUY = { date: '2023-01-01', kind: 'buy' as const, quantity: '100', symbol: 'SYNTHCO' };
  const SELL = { date: '2023-06-01', kind: 'sell' as const, quantity: '40', symbol: 'SYNTHCO' };

  it('offers the holding-account legs of its buys and sells, once per pair', () => {
    const rows = [
      // The buy's two legs — the far leg must NOT be offered: the server's
      // pair-delete removes both from one id.
      T('buy-cash', 'acc-cash', '2023-01-01', 'Buy 100.0000 SYNTHCO'),
      T('buy-inv', 'acc-invest', '2023-01-01', 'Buy 100.0000 SYNTHCO'),
      // The sale's proceeds pair and its income line.
      T('sell-inv', 'acc-invest', '2023-06-01', 'Sell 40.0000 SYNTHCO'),
      T('sell-cash', 'acc-cash', '2023-06-01', 'Sell 40.0000 SYNTHCO'),
      T('gain', 'acc-invest', '2023-06-01', 'Realised gain — SYNTHCO'),
      // Bystander on the same day.
      T('rent', 'acc-cash', '2023-01-01', 'RENT'),
    ];
    expect(holdingTraceRows([BUY, SELL], 'acc-invest', rows)).toEqual([
      'buy-inv',
      'sell-inv',
      'gain',
    ]);
  });

  it('never offers an opening-position row — the delete takes those regardless', () => {
    const rows = [
      T('open', 'acc-invest', '2023-01-01', 'Opening position — 100 SYNTHCO'),
      T('buy-inv', 'acc-invest', '2023-01-01', 'Buy 100.0000 SYNTHCO'),
    ];
    expect(holdingTraceRows([BUY], 'acc-invest', rows)).toEqual(['buy-inv']);
  });

  it('refuses a redated row — the owner took it over, and the offer must not guess', () => {
    const rows = [T('buy-inv', 'acc-invest', '2023-02-14', 'Buy 100.0000 SYNTHCO')];
    expect(holdingTraceRows([BUY], 'acc-invest', rows)).toEqual([]);
  });
});
