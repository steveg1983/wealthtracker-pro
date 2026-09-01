/**
 * THE DATE ON A PHONE CARD IS IN THE REGION THE READER CHOSE.
 *
 * From a real phone, 1 Sep 2026: Settings ▸ App ▸ Region & Date Format set to
 * English (UK), and the register still read "Jun 2, 2026". The setting had not
 * been overridden — it had never been asked. `useFormattedDate` took a `locale`
 * parameter defaulting to `'en-US'` and this card called it bare, so the one
 * date a phone shows most often was the one date in the app that ignored the
 * setting.
 *
 * These pin both halves of the fix: the UK order for the default, and that the
 * SETTING is what is being read rather than a constant that happens to agree
 * with it. The second is the one that would have caught the bug — a card
 * hard-coded to en-GB passes every "does it say 2 Jun" test ever written.
 *
 * Every name and figure below is invented: this repo is public.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SwipeableTransactionRow } from './SwipeableTransactionRow';
import { forgetCachedLocale, setUserLocale } from '../utils/dateFormatter';
import type { Transaction } from '../types';

const handlers = {
  formatCurrency: (n: number) => `£${Math.abs(n).toFixed(2)}`,
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onView: vi.fn(),
};

/** The very day the owner's register was showing back to front. */
const card = (): Transaction => ({
  id: 'txn-card',
  date: new Date(2026, 5, 2),
  description: 'Synthetic card row',
  amount: -18.25,
  type: 'expense',
  category: 'det-groceries',
  accountId: 'acc-a',
  cleared: false,
});

const dateLine = (): string => screen.getByText(/Groceries/).textContent ?? '';

describe('the phone card writes its date the way the region says', () => {
  beforeEach(() => {
    localStorage.clear();
    forgetCachedLocale();
  });

  it('puts the day first when nothing has been chosen — the app is UK-positioned', () => {
    render(<SwipeableTransactionRow {...handlers} transaction={card()} categoryName="Groceries" />);

    const line = dateLine();
    expect(line).toContain('2 Jun 2026');
    // Said as an order as well as a string, because "2 Jun" and "Jun 2" differ
    // by exactly the thing that was wrong.
    expect(line.indexOf('2 Jun')).toBeLessThan(line.indexOf('Groceries'));
  });

  it('follows an explicit English (UK) choice', () => {
    setUserLocale('en-GB');

    render(<SwipeableTransactionRow {...handlers} transaction={card()} categoryName="Groceries" />);

    expect(dateLine()).toContain('2 Jun 2026');
  });

  it('MOVES when the reader picks the United States — the setting is read, not assumed', () => {
    // Without this the card could be hard-coded to en-GB and every assertion
    // above would still pass. This is the one that proves it asks.
    setUserLocale('en-US');

    render(<SwipeableTransactionRow {...handlers} transaction={card()} categoryName="Groceries" />);

    expect(dateLine()).toContain('Jun 2, 2026');
  });

  it('notices a change of region without a reload, though a card is drawn thousands at a time', () => {
    // The formatter caches, because a register puts thousands of dates on one
    // page. A cache keyed without the locale would answer the first render's
    // question for the rest of the session.
    setUserLocale('en-GB');
    render(<SwipeableTransactionRow {...handlers} transaction={card()} categoryName="Groceries" />);
    expect(dateLine()).toContain('2 Jun 2026');

    cleanup();
    setUserLocale('en-US');
    render(<SwipeableTransactionRow {...handlers} transaction={card()} categoryName="Groceries" />);

    expect(dateLine()).toContain('Jun 2, 2026');
  });
});
