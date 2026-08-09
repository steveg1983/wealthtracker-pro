import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { DataService } from '../../services/api/dataService';
import {
  DATE_COLUMN_WIDTH_PX,
  DATE_FIELD_SHELL_INSET_PX,
  DATE_INPUT_INSET_PX,
  TABLE_CELL_INSET_PX,
} from '../../utils/registerDateColumn';
import AccountTransactions, {
  DOCK_RESERVE_PX,
  QUICK_ADD_FIELDS_RESERVE_PX,
  QUICK_ADD_HEADING_HEIGHT_PX,
} from '../AccountTransactions';
import type { Account, Category, Transaction } from '../../types';

/**
 * Four things the owner asked for after using the register in a browser, and
 * what can honestly be checked about them without a browser.
 *
 *   THE DATE COLUMN cut the last digit off the year. The width sum lives in
 *   registerDateColumn and is checked there; what is checked HERE is that the
 *   class names that sum describes are still the ones on the page — because the
 *   sum is only as true as its terms, and its terms are Tailwind utilities in
 *   three different files.
 *
 *   THE ACTION STRIP grew arrow keys, so "save just this one" is Enter, →,
 *   Enter without reaching for the mouse. That is behaviour, and it is tested as
 *   behaviour: press the key, see where the cursor went.
 *
 *   THE QUICK ADD BAR grew a heading. A heading takes vertical room, and the
 *   register measures its own height by SUBTRACTING a declared reserve for the
 *   dock — so a heading added without the reserve growing puts the last row of
 *   the register behind the bar. Checked as: the heading is what the reserve
 *   says it is, and the reserve has taken it on.
 *
 * WHAT JSDOM CANNOT DO: it has no layout and no fonts, so it cannot tell you a
 * date fits, a colour is uniform, or a search box has grown into the gap beside
 * it. Those are the owner's eye. Everything encodable is encoded.
 *
 * Every name, date and figure below is invented: this repo is public.
 */

const ACCOUNT: Account = {
  id: 'acc-polish', name: 'Thornbury Current', type: 'current', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 250, isActive: true,
};

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'grp-home', name: 'Home', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-repairs', name: 'Repairs', type: 'expense', level: 'detail', parentId: 'grp-home' },
];

const ROWS: Transaction[] = [
  {
    id: 'txn-a', date: new Date(Date.UTC(2026, 3, 4)), description: 'Marlborough Tiles',
    amount: -18.4, type: 'expense', category: 'det-repairs', accountId: ACCOUNT.id, cleared: false,
  },
  {
    id: 'txn-b', date: new Date(Date.UTC(2026, 3, 9)), description: 'Wexford Hardware',
    amount: -7.25, type: 'expense', category: 'det-repairs', accountId: ACCOUNT.id, cleared: false,
    // Only a guess, so the strip offers Confirm as well — the four-button strip.
    categoryConfirmed: false,
  },
  {
    id: 'txn-c', date: new Date(Date.UTC(2026, 3, 15)), description: 'Ardleigh Timber',
    amount: -44, type: 'expense', category: 'det-repairs', accountId: ACCOUNT.id, cleared: false,
  },
];

const updateTransaction = vi.fn(async () => {});

const renderRegister = (): void => {
  render(
    <MemoryRouter initialEntries={[`/accounts/${ACCOUNT.id}`]}>
      <PreferencesProvider>
        <ToastProvider>
          <NotificationProvider>
            <Routes>
              <Route path="/accounts" element={<div>Accounts page</div>} />
              <Route path="/accounts/:accountId" element={<AccountTransactions />} />
            </Routes>
          </NotificationProvider>
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );
};

const grid = (): HTMLElement =>
  screen.getByRole('grid', { name: 'Thornbury Current transactions' });

const strip = (): HTMLElement => {
  const el = document.querySelector('[data-quick-edit="actions"]');
  if (!(el instanceof HTMLElement)) throw new Error('no row is being edited');
  return el;
};

const openRegister = async (): Promise<void> => {
  renderRegister();
  await screen.findByRole('heading', { level: 1, name: 'Thornbury Current' });
};

const clickRow = (description: string): void => {
  fireEvent.click(within(grid()).getByText(description));
};

/** The buttons on the strip, left to right, as the arrows walk them. */
const stripButtons = (): HTMLButtonElement[] =>
  Array.from(strip().querySelectorAll('button'));

beforeEach(() => {
  localStorage.clear();
  updateTransaction.mockClear();
  __setAppContextValue({
    accounts: [ACCOUNT],
    transactions: ROWS,
    categories: CATEGORIES,
    isLoading: false,
    updateTransaction,
    getSubCategories: (parentId?: string) => CATEGORIES.filter(c => c.level === 'sub' && c.parentId === parentId),
    getDetailCategories: (parentId?: string) => CATEGORIES.filter(c => c.level === 'detail' && c.parentId === parentId),
  });
  vi.spyOn(DataService, 'getClosedAccounts').mockResolvedValue([]);
});

afterEach(() => {
  vi.mocked(DataService.getClosedAccounts).mockRestore();
  __resetAppContextValue();
});

describe('Account register — the Date column is wide enough for a date', () => {
  it('starts at the width the arithmetic asks for', async () => {
    await openRegister();

    const header = within(grid()).getByRole('columnheader', { name: /^Date/ });
    expect(header).toHaveStyle({ width: `${DATE_COLUMN_WIDTH_PX}px` });
    // Every cell in the column is sized from the same number, so the read-only
    // date and the field it becomes get the same room.
    const dateCell = within(grid()).getAllByRole('gridcell')[0];
    expect(dateCell).toHaveStyle({ width: `${DATE_COLUMN_WIDTH_PX}px` });
  });

  it('still spends its width the way the sum says it does', async () => {
    await openRegister();

    // TABLE_CELL_INSET_PX = px-3 either side of every cell.
    const dateCell = within(grid()).getAllByRole('gridcell')[0];
    expect(dateCell.className).toContain('px-3');
    expect(TABLE_CELL_INSET_PX).toBe(12 * 2);

    clickRow('Marlborough Tiles');

    // DATE_FIELD_SHELL_INSET_PX = the px-1 the field's shell keeps, INSTEAD of
    // the cell padding it cancels with -mx-3. Both halves matter: drop the
    // -mx-3 and the field loses 24px it is counting on.
    const shell = document.querySelector('[data-quick-edit="date"]');
    if (!(shell instanceof HTMLElement)) throw new Error('the date cell is not an editor');
    expect(shell.className).toContain('-mx-3');
    expect(shell.className).toContain('px-1');
    expect(shell.className).not.toContain('px-1.5');
    expect(DATE_FIELD_SHELL_INSET_PX).toBe(4 * 2);

    // DATE_INPUT_INSET_PX = the input's own px-1.5 plus its 1px border. The
    // calendar glyph stays off: switching it on would reserve 32px more and
    // clip the year again.
    const input = screen.getByLabelText('Transaction date');
    expect(input.className).toContain('px-1.5');
    expect(input.className).toContain('border');
    expect(DATE_INPUT_INSET_PX).toBe(6 * 2 + 1 * 2);
    expect(within(shell).queryByTestId('calendar-icon')).not.toBeInTheDocument();
  });
});

describe('Account register — the arrows walk along the action strip', () => {
  it('steps from Save & Next to Save and back, so ending a run needs no mouse', async () => {
    await openRegister();

    clickRow('Marlborough Tiles');
    const saveAndNext = within(strip()).getByRole('button', { name: 'Save & Next' });
    const save = within(strip()).getByRole('button', { name: 'Save' });
    saveAndNext.focus();
    expect(document.activeElement).toBe(saveAndNext);

    // The whole ask: type → Enter → → → Enter saves just this one.
    fireEvent.keyDown(saveAndNext, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(save);

    fireEvent.keyDown(save, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(saveAndNext);
  });

  it('walks the whole strip — Confirm, Save & Next, Save, × — and wraps', async () => {
    await openRegister();

    // A row whose category is only a guess carries Confirm too.
    clickRow('Wexford Hardware');
    const buttons = stripButtons();
    expect(buttons.map(b => b.textContent)).toEqual(['Confirm', 'Save & Next', 'Save', '']);

    buttons[0].focus();
    for (let i = 1; i < buttons.length; i += 1) {
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'ArrowRight' });
      expect(document.activeElement).toBe(buttons[i]);
    }
    // Round the end rather than stopping dead at the ×.
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  });

  it('jumps to the ends on Home and End', async () => {
    await openRegister();

    clickRow('Marlborough Tiles');
    const buttons = stripButtons();
    buttons[1].focus();

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Home' });
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'End' });
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  });

  it('leaves the arrows alone inside a field — that is the text cursor', async () => {
    await openRegister();

    clickRow('Marlborough Tiles');
    const description = screen.getByLabelText('Transaction description');
    description.focus();

    fireEvent.keyDown(description, { key: 'ArrowRight' });
    // Still in the box being typed in. Nothing was stolen, and nothing moved.
    expect(document.activeElement).toBe(description);
  });

  it('leaves the arrows alone on the row itself — that is the highlight moving', async () => {
    await openRegister();

    clickRow('Marlborough Tiles');
    const before = grid().getAttribute('aria-activedescendant');
    fireEvent.keyDown(grid(), { key: 'ArrowDown' });

    // The register's own navigation still owns this key: the highlight moved,
    // and the strip did not take the cursor off the list to do it.
    expect(grid().getAttribute('aria-activedescendant')).not.toBe(before);
  });
});

/**
 * The highlighted row is ONE colour, all the way across, and the strip beneath
 * it is the same one.
 *
 * jsdom does not apply the stylesheet, so this reads the rule itself. Crude,
 * and worth it: the bug it guards against was a 135deg "glass" gradient which,
 * on a row a thousand pixels wide and forty-four tall, is a horizontal fade —
 * blue at the right-hand end, white by the Date column. Nothing in a DOM test
 * would ever have noticed.
 */
describe('Account register — the highlighted row is one colour', () => {
  const css = readFileSync(path.resolve(__dirname, '../../index.css'), 'utf8');
  const ruleFor = (selector: string): string => {
    const start = css.indexOf(`${selector} {`);
    expect(start, `no ${selector} rule`).toBeGreaterThan(-1);
    return css.slice(start, css.indexOf('}', start));
  };

  it('fills the row flat, with no gradient to fade across it', () => {
    for (const selector of ['.selected-transaction-row', '.dark .selected-transaction-row']) {
      const rule = ruleFor(selector);
      expect(rule).not.toContain('gradient');
      // …and nothing frosted behind it either: a backdrop-filter over a flat
      // table background buys nothing and costs a compositor layer on every
      // keypress that moves the highlight.
      expect(rule).not.toContain('backdrop-filter');
    }
  });

  it('fills it with the SAME colour the strip beneath it carries', () => {
    // blue-50/80 and blue-900/30 — the two values QuickEditActionStrip sets on
    // itself with `bg-blue-50/80 dark:bg-blue-900/30`. Row and strip are one
    // card with a join across the middle; two shades would draw a line there.
    expect(ruleFor('.selected-transaction-row')).toContain('rgba(239, 246, 255, 0.8)');
    expect(ruleFor('.dark .selected-transaction-row')).toContain('rgba(30, 58, 138, 0.3)');

    const strip = readFileSync(
      path.resolve(__dirname, '../../components/QuickEditRow.tsx'),
      'utf8'
    );
    expect(strip).toContain('bg-blue-50/80 dark:bg-blue-900/30');
  });
});

describe('Account register — the Quick Add bar says what it is', () => {
  it('carries a heading, and the heading is also its name to a screen reader', async () => {
    await openRegister();

    const heading = screen.getByRole('heading', { level: 2, name: 'Quick Add Transaction' });
    expect(heading).toBeInTheDocument();
    // One string, both audiences. aria-labelledby rather than a separate
    // aria-label, so the words on screen and the words read out cannot drift.
    const bar = screen.getByRole('form', { name: 'Quick Add Transaction' });
    expect(bar.contains(heading)).toBe(true);
    // It introduces the fields; it does not replace their labels.
    expect(within(bar).getByLabelText('Date')).toBeInTheDocument();
    expect(within(bar).getByLabelText('Description')).toBeInTheDocument();
  });

  it('and the register reserves the room the heading takes', async () => {
    await openRegister();

    // The table's height is the viewport minus what is above it minus this
    // reserve. jsdom cannot measure the bar, so the reserve is DECLARED — and
    // these are the two utilities the declared number is made of. Change the
    // heading's size or its margin and this fails, which is the point: it fails
    // instead of the last row of the register disappearing behind the bar.
    const heading = screen.getByRole('heading', { level: 2, name: 'Quick Add Transaction' });
    expect(heading.className).toContain('text-sm');
    expect(heading.className).toContain('mb-2');
    expect(QUICK_ADD_HEADING_HEIGHT_PX).toBe(20 + 8);
    expect(DOCK_RESERVE_PX).toBe(QUICK_ADD_FIELDS_RESERVE_PX + QUICK_ADD_HEADING_HEIGHT_PX);
  });
});
