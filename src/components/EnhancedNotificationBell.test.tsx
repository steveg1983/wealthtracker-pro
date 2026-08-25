/**
 * What clicking a notification opens.
 *
 * The two the owner named both landed on a list: "X Balance Updated" opened the
 * accounts page, and "New Transaction" opened the whole transactions list with
 * nothing pointed at. The bell navigates to whatever the alert stored, so the
 * fix is in what gets stored (hooks/useActivityLogger) — and these pin the two
 * things that are the BELL's own job: honouring that payload whatever shape it
 * is in, and not dropping a demo session on the way.
 *
 * Every name and figure below is invented: this repo is public.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ActivityItem } from '../hooks/useActivityTracking';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: '',
  activities: [] as ActivityItem[],
  markAsRead: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useLocation: () => ({ pathname: '/dashboard', search: mocks.search, hash: '', state: null, key: 't' }),
  };
});

vi.mock('../hooks/useActivityTracking', () => ({
  useActivityTracking: () => ({
    activities: mocks.activities,
    counts: { total: mocks.activities.length, unread: 0, transactions: 0, accounts: 0, budgets: 0, goals: 0, system: 0 },
    markAsRead: mocks.markAsRead,
    markAllAsRead: vi.fn(),
    clearActivities: vi.fn(),
    getNewSinceLastCheck: () => [],
  }),
}));

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({ formatCurrency: (v: number) => `£${v.toFixed(2)}` }),
}));

const { default: EnhancedNotificationBell } = await import('./EnhancedNotificationBell');

const alert = (over: Partial<ActivityItem> & { id: string; title: string }): ActivityItem => ({
  type: 'transaction',
  description: 'Synthetic description',
  timestamp: new Date(),
  read: false,
  ...over,
});

const openBell = (): void => {
  render(<EnhancedNotificationBell />);
  fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
};

beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.search = '';
  mocks.activities = [];
});

describe('clicking a notification', () => {
  it('opens the transaction’s own row in its account’s register', () => {
    mocks.activities = [alert({
      id: 'a1',
      title: 'New Transaction',
      actionUrl: '/accounts/acc-1?txn=txn-9',
    })];
    openBell();

    fireEvent.click(screen.getByRole('button', { name: /New Transaction/ }));

    expect(mocks.navigate).toHaveBeenCalledWith('/accounts/acc-1?txn=txn-9');
  });

  it('opens THE account for a balance alert, not the list of accounts', () => {
    mocks.activities = [alert({
      id: 'a2',
      type: 'account',
      title: 'Synthetic Current Balance Updated',
      actionUrl: '/accounts/acc-1',
    })];
    openBell();

    fireEvent.click(screen.getByRole('button', { name: /Balance Updated/ }));

    expect(mocks.navigate).toHaveBeenCalledWith('/accounts/acc-1');
  });

  it('still works for an alert stored by an older build', () => {
    // Notifications outlive a deploy: a week of them is kept in localStorage.
    // One carrying the old list URL must keep doing exactly what it always did
    // rather than failing to open anything. The bell hands the stored address
    // to the router unaltered — and the router answers /transactions with a
    // redirect that keeps the query string (see
    // components/legacyTransactionsDestination), which is what makes a link
    // written months ago still land somewhere sensible.
    mocks.activities = [alert({ id: 'a3', title: 'New Transaction', actionUrl: '/transactions' })];
    openBell();

    fireEvent.click(screen.getByRole('button', { name: /New Transaction/ }));

    expect(mocks.navigate).toHaveBeenCalledWith('/transactions');
  });

  it('keeps a demo session inside itself', () => {
    mocks.search = '?demo=true';
    mocks.activities = [alert({ id: 'a4', title: 'New Transaction', actionUrl: '/accounts/acc-1?txn=txn-9' })];
    openBell();

    fireEvent.click(screen.getByRole('button', { name: /New Transaction/ }));

    expect(mocks.navigate).toHaveBeenCalledWith('/accounts/acc-1?txn=txn-9&demo=true');
  });
});


/**
 * THE PANEL MUST ESCAPE THE APP'S ISOLATED ROOT.
 *
 * `src/App` renders the whole application inside a <div> carrying
 * `isolation: isolate`, which makes the entire app ONE stacking context
 * sitting at level 0 among <body>'s children. Anything portalled to <body>
 * with a positive z-index — the PageTip at z-40 — then paints above every
 * piece of in-app chrome, and no z-index INSIDE the app can outrank it.
 *
 * Measured on 25 Aug against the running app: with the panel at z-9999 and
 * its header at z-9999, the tip still won at every overlapping pixel, and it
 * covered the "Clear all notifications" control the owner reported he could
 * not find. Portalling is the only fix, and it is the app's own idiom for
 * exactly this — see CrossCurrencyTransferDialog.
 *
 * jsdom does no layout, so this cannot measure the overlap. What it CAN pin
 * is the property the fix rests on: the panel is not a descendant of the
 * component's own subtree, so no ancestor of the bell can trap it.
 */
describe('the panel is portalled out of the app tree', () => {
  it('renders into document.body, not inside the bell’s own container', () => {
    mocks.activities = [alert({ id: 'p1', title: 'Some Alert' })];
    const { container } = render(<EnhancedNotificationBell />);
    fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));

    const heading = screen.getByRole('heading', { name: 'Notifications' });
    expect(container.contains(heading)).toBe(false);
    expect(document.body.contains(heading)).toBe(true);
  });

  it('keeps the clear-all control in the panel, so it travels with it', () => {
    // The control the owner could not reach. If it ever renders outside the
    // portalled panel it is back inside the isolated root and coverable again.
    mocks.activities = [alert({ id: 'p2', title: 'Some Alert' })];
    render(<EnhancedNotificationBell />);
    fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));

    const heading = screen.getByRole('heading', { name: 'Notifications' });
    const panel = heading.closest('div.fixed');
    expect(panel).not.toBeNull();
    const clearAll = screen.getByRole('button', { name: /Clear all notifications/ });
    expect(panel?.contains(clearAll)).toBe(true);
  });
});
