/**
 * A dashboard card's period pin: the page clock stays the law, and a card may
 * declare itself out of it.
 *
 * The claims these hold down, in the order they matter:
 *
 *  1. a user with NO pins is byte-identical to the build before pins existed —
 *     nothing read, nothing written, and the card is handed the page's own
 *     picker rather than a copy that has to be kept in step;
 *  2. a pinned card holds when the page clock moves, and says so;
 *  3. releasing it rejoins the page immediately and forgets the pin ever
 *     happened, keys and all;
 *  4. a pin survives a remount, because it is a statement about how the owner
 *     reads his figures rather than about this visit.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePeriod } from './usePeriod';
import { cardPeriodKey, useCardPeriod } from './useCardPeriod';
import { cardPeriodPreferenceKeys, periodPinKey } from '../services/preferencesService';

const PAGE_KEY = 'dashboardReports';
const CARD_KEY = cardPeriodKey(PAGE_KEY, 'net-worth');

/**
 * Plain localStorage rather than the preferences document, exactly as
 * usePeriod's own suite does and for the same reason: what is under test is the
 * page-versus-card rule, not where the answer is filed. The adapter exists so a
 * test can hold the store still.
 */
const store = localStorage;

/** The real composition: one page clock, one card hanging off it. */
const renderPageAndCard = () => renderHook(() => {
  const page = usePeriod(PAGE_KEY, 'last-12-months', store);
  const card = useCardPeriod(CARD_KEY, page, store);
  return { page, card };
});

beforeEach(() => {
  localStorage.clear();
});

describe('a card that has not been pinned', () => {
  it('is handed the page’s picker itself, not a copy of it', () => {
    const { result } = renderPageAndCard();

    // Identity, deliberately: "follows the page" is not a rule anything has to
    // keep true — it is the same object.
    expect(result.current.card.picker).toBe(result.current.page);
    expect(result.current.card.pin.isPinned).toBe(false);
  });

  it('reads and writes nothing of its own', () => {
    renderPageAndCard();

    for (const key of cardPeriodPreferenceKeys(CARD_KEY)) {
      expect(localStorage.getItem(key)).toBeNull();
    }
  });

  it('follows the page clock wherever it goes', () => {
    const { result } = renderPageAndCard();

    act(() => result.current.page.setPeriod('all'));

    expect(result.current.card.picker.period).toBe('all');
    expect(result.current.card.picker.range.from).toBeNull();
    expect(result.current.card.pin.isPinned).toBe(false);
  });

  /**
   * THE REGRESSION PIN for everybody who already has a stored dashboard. The
   * merge that made one clock out of three kept the original key; this keeps
   * that promise a second time. There is no migration because there is no old
   * shape — the absence of a pin flag IS "follows the page", which is what
   * every stored dashboard has always meant.
   */
  it('loads a dashboard stored before pins existed, unchanged', () => {
    localStorage.setItem(PAGE_KEY, 'all');
    localStorage.setItem(`${PAGE_KEY}Explicit`, 'true');

    const { result } = renderPageAndCard();

    expect(result.current.page.period).toBe('all');
    expect(result.current.card.picker).toBe(result.current.page);
    expect(result.current.card.pin.isPinned).toBe(false);
    // And it did not quietly write itself a pin on the way past.
    expect(localStorage.getItem(periodPinKey(CARD_KEY))).toBeNull();
  });
});

describe('a card pinned to a window of its own', () => {
  it('diverges from the page the moment it is pinned', () => {
    const { result } = renderPageAndCard();

    act(() => result.current.card.pin.pinTo('all'));

    expect(result.current.card.pin.isPinned).toBe(true);
    expect(result.current.card.picker.period).toBe('all');
    // The page is untouched: pinning a card is not a statement about the page.
    expect(result.current.page.period).toBe('last-12-months');
  });

  it('HOLDS when the page clock moves', () => {
    const { result } = renderPageAndCard();
    act(() => result.current.card.pin.pinTo('all'));

    act(() => result.current.page.setPeriod('this-month'));

    expect(result.current.page.period).toBe('this-month');
    expect(result.current.card.picker.period).toBe('all');
    expect(result.current.card.pin.isPinned).toBe(true);
  });

  it('acknowledges the page moving, once, and only while pinned', () => {
    const { result } = renderPageAndCard();

    // Nothing to acknowledge before there is a pin.
    act(() => result.current.page.setPeriod('this-month'));
    expect(result.current.card.pin.justHeld).toBe(false);

    act(() => result.current.card.pin.pinTo('all'));
    // Pinning is not the page moving.
    expect(result.current.card.pin.justHeld).toBe(false);

    act(() => result.current.page.setPeriod('tax-year'));
    expect(result.current.card.pin.justHeld).toBe(true);

    // The marker clears it when the blink has played out.
    act(() => result.current.card.pin.onHeldShown());
    expect(result.current.card.pin.justHeld).toBe(false);
  });

  it('remembers the pin, and the window, across a remount', () => {
    const first = renderPageAndCard();
    act(() => first.result.current.card.pin.pinTo('all'));
    first.unmount();

    const second = renderPageAndCard();

    expect(second.result.current.card.pin.isPinned).toBe(true);
    expect(second.result.current.card.picker.period).toBe('all');
    // …and the page opened on its own default, untouched by the card.
    expect(second.result.current.page.period).toBe('last-12-months');
  });

  it('files itself under the page’s key, beside the page’s own choice', () => {
    const { result } = renderPageAndCard();

    act(() => result.current.card.pin.pinTo('tax-year'));

    expect(localStorage.getItem('dashboardReports.pin.net-worth')).toBe('tax-year');
    expect(localStorage.getItem('dashboardReports.pin.net-worthPinned')).toBe('true');
  });
});

describe('releasing a card back to the page', () => {
  it('rejoins the page clock immediately', () => {
    const { result } = renderPageAndCard();
    act(() => result.current.card.pin.pinTo('all'));
    act(() => result.current.page.setPeriod('this-month'));

    act(() => result.current.card.pin.follow());

    expect(result.current.card.pin.isPinned).toBe(false);
    expect(result.current.card.picker).toBe(result.current.page);
    expect(result.current.card.picker.period).toBe('this-month');
  });

  it('forgets it was ever pinned, keys and all', () => {
    const { result } = renderPageAndCard();
    act(() => result.current.card.pin.pinTo('all'));

    act(() => result.current.card.pin.follow());

    for (const key of cardPeriodPreferenceKeys(CARD_KEY)) {
      expect(localStorage.getItem(key)).toBeNull();
    }
  });

  it('stays released across a remount', () => {
    const first = renderPageAndCard();
    act(() => first.result.current.card.pin.pinTo('all'));
    act(() => first.result.current.card.pin.follow());
    first.unmount();

    const second = renderPageAndCard();

    expect(second.result.current.card.pin.isPinned).toBe(false);
    expect(second.result.current.card.picker).toBe(second.result.current.page);
  });
});

describe('two cards on one page', () => {
  it('pin independently — one holds, the other follows', () => {
    const { result } = renderHook(() => {
      const page = usePeriod(PAGE_KEY, 'last-12-months', store);
      return {
        page,
        netWorth: useCardPeriod(cardPeriodKey(PAGE_KEY, 'net-worth'), page, store),
        flows: useCardPeriod(cardPeriodKey(PAGE_KEY, 'income-expense-trend'), page, store),
      };
    });

    act(() => result.current.netWorth.pin.pinTo('all'));
    act(() => result.current.page.setPeriod('this-month'));

    // The stock keeps forever; the flow follows the page, as it always did.
    expect(result.current.netWorth.picker.period).toBe('all');
    expect(result.current.flows.picker.period).toBe('this-month');
    expect(result.current.flows.pin.isPinned).toBe(false);
  });
});
