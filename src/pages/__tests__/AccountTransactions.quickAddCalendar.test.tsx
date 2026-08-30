import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { DataService } from '../../services/api/dataService';
import AccountTransactions from '../AccountTransactions';
import type { Account, Category, Transaction } from '../../types';

/**
 * THE QUICK ADD BAR'S CALENDAR, AND THE EDGE OF THE WINDOW.
 *
 * The owner, 30 August: "when doing a quick add, and I drop down the date, I
 * loose half the calendar, and then have to scroll down. I should not need to
 * do that. It should [flip] if the screen is at the bottom and show above the
 * date [field] to always make sure it is in total view."
 *
 * The bar is the foot of the register page by construction — it is the dock —
 * so its date field is ALWAYS the case where a calendar drawn below runs off
 * the window. The flip itself is the shared DatePicker's (see its own tests for
 * the arithmetic); what this pins is that the register's add bar is wired to
 * the field that does it, and that the field is close enough to the bottom of
 * a real window for the flip to fire. Both are things a refactor could quietly
 * take away — the bar swapping in a plain input, or the dock growing a wrapper
 * that puts the field back up the page.
 *
 * jsdom lays nothing out, so where the field sits is STATED, for that field
 * alone: everything else keeps jsdom's own answer, because the register's own
 * height arithmetic reads rects too and a blanket stub would be answering
 * questions this test has no business answering.
 *
 * Every name and figure below is invented: this repo is public.
 */

const ACCOUNT: Account = {
  id: 'acc-register', name: 'Synthetic Register', type: 'current', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 100, isActive: true,
};

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'grp-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'grp-food' },
];

const ROWS: Transaction[] = [
  {
    id: 'txn-0', date: new Date(Date.UTC(2026, 0, 4)), description: 'Marrow & Vine',
    amount: -14.2, type: 'expense', category: 'det-groceries', accountId: ACCOUNT.id, cleared: false,
  },
];

/** A window 800px tall, with the add bar's date field 740px down it. */
const VIEWPORT = 800;
const FIELD_TOP = 740;
const FIELD_HEIGHT = 32;

const realGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
const realInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');

/**
 * The one element the picker measures: its own root, recognised by the add
 * bar's date input hanging under it. If DatePicker's chrome ever changes shape
 * this stops matching — and the assertion below fails loudly rather than
 * passing on a rect that means nothing.
 */
const isQuickAddDateBox = (el: Element): boolean =>
  el.querySelector(':scope > div > input#quick-add-date') !== null;

const pinAddBarToFootOfWindow = (): void => {
  Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => VIEWPORT });
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement): DOMRect {
    if (!isQuickAddDateBox(this)) return realGetBoundingClientRect.call(this);
    return {
      x: 20, y: FIELD_TOP, top: FIELD_TOP, bottom: FIELD_TOP + FIELD_HEIGHT,
      left: 20, right: 170, width: 150, height: FIELD_HEIGHT, toJSON: () => ({}),
    };
  };
};

const renderRegister = (): void => {
  render(
    <MemoryRouter initialEntries={[`/accounts/${ACCOUNT.id}`]}>
      <PreferencesProvider>
        <ToastProvider>
          <NotificationProvider>
            <Routes>
              <Route path="/accounts/:accountId" element={<AccountTransactions />} />
            </Routes>
          </NotificationProvider>
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );
};

const addBar = (): HTMLElement => screen.getByRole('form', { name: 'Quick Add Transaction' });

beforeEach(() => {
  localStorage.clear();
  __setAppContextValue({
    accounts: [ACCOUNT],
    transactions: ROWS,
    categories: CATEGORIES,
    isLoading: false,
    getSubCategories: (parentId?: string) => CATEGORIES.filter(c => c.level === 'sub' && c.parentId === parentId),
    getDetailCategories: (parentId?: string) => CATEGORIES.filter(c => c.level === 'detail' && c.parentId === parentId),
  });
  vi.spyOn(DataService, 'listClosedAccounts').mockResolvedValue([]);
});

afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = realGetBoundingClientRect;
  if (realInnerHeight) Object.defineProperty(window, 'innerHeight', realInnerHeight);
  vi.mocked(DataService.listClosedAccounts).mockRestore();
  __resetAppContextValue();
});

describe('Quick Add — the date calendar at the foot of the page', () => {
  it('opens the calendar above the date field, not off the bottom of the window', async () => {
    renderRegister();
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });
    pinAddBarToFootOfWindow();

    const dateField = within(addBar()).getByLabelText('Date');
    fireEvent.click(dateField);

    const calendar = document.querySelector('[data-datepicker-panel]');
    expect(calendar).not.toBeNull();
    expect(calendar).toHaveAttribute('data-datepicker-placement', 'above');
  });
});
