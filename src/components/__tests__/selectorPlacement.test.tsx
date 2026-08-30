import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import AccountSelector from '../common/AccountSelector';
import CategorySelector from '../CategorySelector';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import type { Category } from '../../types';

/**
 * WHICH WAY THE SELECTOR LISTS OPEN — the two siblings of the DatePicker bug
 * #515 fixed. Both had flip arithmetic that ran only in portal mode, leaving
 * the in-flow list hard-coded to one direction: AccountSelector always DOWN
 * (top-full — off the bottom of the window from the Quick Add bar),
 * CategorySelector always UP (bottom-full — the mirror image, clipped at the
 * top of the window from anywhere high on a page). One measured decision now
 * serves both renderings of both components, and these tests read it back
 * through the data-*-placement attributes, since jsdom computes no styles.
 *
 * The geometry idiom is DatePicker.test.tsx's: pin the trigger down (or up) a
 * window of known height, and restore every stubbed descriptor afterwards.
 * Every account and category invented — this repo is public.
 */

const geometry: Array<[object, string, PropertyDescriptor | undefined]> = [];

/** Put the trigger `top` pixels down a window `viewport` pixels tall. */
const pinTrigger = (top: number, viewport: number): void => {
  geometry.push([window, 'innerHeight', Object.getOwnPropertyDescriptor(window, 'innerHeight')]);
  Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => viewport });
  geometry.push([
    HTMLElement.prototype,
    'getBoundingClientRect',
    Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'getBoundingClientRect'),
  ]);
  const height = 40;
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: (): DOMRect => ({
      x: 20, y: top, top, bottom: top + height, left: 20, right: 320,
      width: 300, height, toJSON: () => ({}),
    }),
  });
};

afterEach(() => {
  cleanup();
  __resetAppContextValue();
  while (geometry.length > 0) {
    const entry = geometry.pop();
    if (!entry) break;
    const [target, property, descriptor] = entry;
    if (descriptor) Object.defineProperty(target, property, descriptor);
    else Reflect.deleteProperty(target, property);
  }
});

describe('AccountSelector placement', () => {
  const ACCOUNTS = [
    { id: 'acc-a', name: 'Synthetic Current', type: 'current' },
    { id: 'acc-b', name: 'Synthetic Savings', type: 'savings' },
  ];

  const renderAndOpen = (): HTMLElement => {
    render(
      <AccountSelector
        accounts={ACCOUNTS}
        selectedAccountId=""
        onAccountChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Search or select account…'));
    return screen.getByRole('listbox');
  };

  it('opens above the trigger when the window ends just under it', () => {
    // 40px left below a list that wants up to 384px — the Quick Add bar's case.
    pinTrigger(720, 800);
    const list = renderAndOpen();
    expect(list).toHaveAttribute('data-accountselector-placement', 'above');
    expect(list.className).toContain('bottom-full');
    expect(list.className).not.toContain('top-full');
  });

  it('opens below the trigger when there is room below', () => {
    pinTrigger(100, 800);
    const list = renderAndOpen();
    expect(list).toHaveAttribute('data-accountselector-placement', 'below');
    expect(list.className).toContain('top-full');
    expect(list.className).not.toContain('bottom-full');
  });
});

describe('CategorySelector placement', () => {
  const CATEGORIES: Category[] = [
    { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type' },
    { id: 'sub-house', name: 'Household', type: 'expense', level: 'sub', parentId: 'type-expense' },
    { id: 'det-clean', name: 'Cleaning Costs', type: 'expense', level: 'detail', parentId: 'sub-house' },
  ];

  const renderAndOpen = (): HTMLElement => {
    __setAppContextValue({
      categories: CATEGORIES,
      addCategory: vi.fn(),
      getSubCategories: (typeId: string) =>
        CATEGORIES.filter(c => c.level === 'sub' && c.parentId === typeId),
      getDetailCategories: (subId: string) =>
        CATEGORIES.filter(c => c.level === 'detail' && c.parentId === subId),
    });
    render(
      <CategorySelector
        selectedCategory=""
        onCategoryChange={vi.fn()}
        transactionType="expense"
      />
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Category' }));
    return screen.getByRole('listbox');
  };

  it('opens below the trigger when the window BEGINS just above it — the old hard-up clipped here', () => {
    pinTrigger(20, 800);
    const list = renderAndOpen();
    expect(list).toHaveAttribute('data-categoryselector-placement', 'below');
    expect(list.className).toContain('top-full');
    expect(list.className).not.toContain('bottom-full');
  });

  it('still opens above from the foot of the window — its habitual seat, now measured', () => {
    pinTrigger(720, 800);
    const list = renderAndOpen();
    expect(list).toHaveAttribute('data-categoryselector-placement', 'above');
    expect(list.className).toContain('bottom-full');
  });
});
