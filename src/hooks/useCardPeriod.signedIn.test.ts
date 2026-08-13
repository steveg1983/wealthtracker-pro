/**
 * A pin, through the REAL preferences service, signed in.
 *
 * Every other test of this hook hands it `localStorage` — deliberately, because
 * what they are about is the page-versus-card rule rather than where the answer
 * is filed. That left one configuration untested and it is the only one the
 * owner runs: the singleton `preferences` service, attached to a user, with a
 * transport behind it. He reported twice that pins "do not override the global
 * setting", on a build whose every other test was green.
 *
 * So this renders the hook against the real module, over a transport, and asks
 * the plainest possible question: after `pinTo`, is the card reading its own
 * window?
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePeriod } from './usePeriod';
import { cardPeriodKey, useCardPeriod } from './useCardPeriod';
import { PreferencesService, type PreferencesDocument } from '../services/preferencesService';

/**
 * A FRESH SERVICE, not the exported singleton.
 *
 * `useTransport` is deliberately one-way — "once a session has been told where
 * the settings live, it does not go back to guessing" — so pointing the
 * singleton at a fake here would leave every later test file in the same worker
 * attached to it. That is not hypothetical: it broke two dashboard integration
 * tests the first time this file ran beside them. Same class, same code path,
 * no shared state.
 */
let preferences: PreferencesService;

const PAGE_KEY = 'dashboardReports';
const CARD_KEY = cardPeriodKey(PAGE_KEY, 'income-expense-trend');

/** A store that answers like the real one: a row per user, read and written whole. */
function fakeTransport(initial: PreferencesDocument | null = null) {
  let row = initial;
  return {
    read: vi.fn(async () => row),
    write: vi.fn(async (_userId: string, document: PreferencesDocument) => { row = document; }),
    current: () => row,
  };
}

const renderPageAndCard = () => renderHook(() => {
  const page = usePeriod(PAGE_KEY, 'last-12-months', preferences);
  const card = useCardPeriod(CARD_KEY, page, preferences);
  return { page, card };
});

beforeEach(() => {
  localStorage.clear();
  preferences = new PreferencesService();
});

afterEach(() => {
  preferences.detach();
});


describe('pinning a card while signed in', () => {
  it('reads over its own window the moment it is pinned', async () => {
    const transport = fakeTransport();
    preferences.useTransport(transport);
    await preferences.attach('user-1');

    const { result } = renderPageAndCard();
    expect(result.current.card.picker.period).toBe('last-12-months');

    act(() => { result.current.card.pin.pinTo('all'); });

    expect(result.current.card.pin.source).toBe('own');
    expect(result.current.card.picker.period).toBe('all');
  });

  it('holds the pin while the PAGE is moved underneath it', async () => {
    // The owner's exact report: set the page to 12 months, pin the card to All
    // time, and the card goes on showing 12 months.
    const transport = fakeTransport();
    preferences.useTransport(transport);
    await preferences.attach('user-1');

    const { result } = renderPageAndCard();
    act(() => { result.current.card.pin.pinTo('all'); });
    act(() => { result.current.page.setPeriod('this-month'); });

    expect(result.current.page.period).toBe('this-month');
    expect(result.current.card.picker.period).toBe('all');
  });

  it('survives the account row arriving AFTER the pin was made', async () => {
    // The race the cloud has and localStorage does not: `attach` resolves while
    // the user is already clicking. A stored row that predates the pin must not
    // overwrite it — `attach` merges session values on top for exactly this.
    const transport = fakeTransport({
      version: 1,
      values: { [PAGE_KEY]: 'last-12-months', [`${PAGE_KEY}Explicit`]: 'true' },
    });
    preferences.useTransport(transport);

    const { result } = renderPageAndCard();
    act(() => { result.current.card.pin.pinTo('all'); });
    await act(async () => { await preferences.attach('user-1'); });

    expect(result.current.card.pin.source).toBe('own');
    expect(result.current.card.picker.period).toBe('all');
  });

  it('writes the pin to the account, so another device sees it', async () => {
    const transport = fakeTransport();
    preferences.useTransport(transport);
    await preferences.attach('user-1');

    const { result } = renderPageAndCard();
    act(() => { result.current.card.pin.pinTo('all'); });

    await waitFor(() => expect(transport.write).toHaveBeenCalled());
    const row = transport.current();
    expect(row?.values[`${CARD_KEY}Pinned`]).toBe('true');
    expect(row?.values[CARD_KEY]).toBe('all');
  });
});
