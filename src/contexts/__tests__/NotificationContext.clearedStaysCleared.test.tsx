/**
 * CLEARED STAYS CLEARED.
 *
 * The owner's report: "I am sure I am clearing them all and then some old ones
 * are popping back up later on when new ones get added."
 *
 * He was right, and the cause was that suppression WAS the notification list.
 * `hasRecentDuplicate` asked whether a matching `dedupeKey` was currently on
 * the board — so clearing the board threw away the record of what had been
 * raised, the next generator run found nothing to dedupe against, and the
 * dismissed alerts came back.
 *
 * The generators are the thing that makes this reachable rather than
 * theoretical: budget alerts are RECOMPUTED from current data every time the
 * Budget page runs its effect. They do not remember having fired; the dedupe
 * ledger is the only thing that does.
 */
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { NotificationProvider, useNotifications } from '../NotificationContext';
import { PreferencesProvider } from '../PreferencesContext';

/** The provider reads preferences (the alert on/off switches) on mount. */
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PreferencesProvider>
    <NotificationProvider>{children}</NotificationProvider>
  </PreferencesProvider>
);

const alert = (key: string) => ({
  type: 'warning' as const,
  title: 'Budget Warning: Groceries',
  message: 'You have spent 85% of your monthly budget.',
  category: 'budget' as const,
  dedupeKey: key
});

describe('a cleared notification does not come back', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stays gone when the same alert is recomputed after Clear all', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => { result.current.addNotification(alert('budget-1-warning')); });
    expect(result.current.notifications).toHaveLength(1);

    act(() => { result.current.clearAll(); });
    expect(result.current.notifications).toHaveLength(0);

    // The Budget page recomputes and raises the identical alert, which is what
    // it does on every visit for as long as the budget is still over.
    act(() => { result.current.addNotification(alert('budget-1-warning')); });

    expect(result.current.notifications).toHaveLength(0);
  });

  it('stays gone when dismissed one at a time', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => { result.current.addNotification(alert('budget-2-warning')); });
    const id = result.current.notifications[0].id;

    act(() => { result.current.removeNotification(id); });
    act(() => { result.current.addNotification(alert('budget-2-warning')); });

    expect(result.current.notifications).toHaveLength(0);
  });

  it('still lets a DIFFERENT alert through afterwards', () => {
    // The failure mode of over-correcting: a ledger that suppressed everything
    // would be indistinguishable from a broken bell.
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => { result.current.addNotification(alert('budget-3-warning')); });
    act(() => { result.current.clearAll(); });
    act(() => { result.current.addNotification(alert('budget-4-warning')); });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].dedupeKey).toBe('budget-4-warning');
  });

  it('does not suppress unkeyed notifications, which are one-offs', () => {
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => {
      result.current.addNotification({
        type: 'success',
        title: 'Import finished',
        message: '42 transactions added.'
      });
    });
    act(() => { result.current.clearAll(); });
    act(() => {
      result.current.addNotification({
        type: 'success',
        title: 'Import finished',
        message: '7 transactions added.'
      });
    });

    // No dedupeKey means "this is an event, not a condition" — a second import
    // genuinely is a second thing to say.
    expect(result.current.notifications).toHaveLength(1);
  });

  it('survives a reload, since the ledger is persisted and the list may not be', () => {
    const first = renderHook(() => useNotifications(), { wrapper });
    act(() => { first.result.current.addNotification(alert('budget-5-warning')); });
    act(() => { first.result.current.clearAll(); });
    first.unmount();

    const second = renderHook(() => useNotifications(), { wrapper });
    act(() => { second.result.current.addNotification(alert('budget-5-warning')); });

    expect(second.result.current.notifications).toHaveLength(0);
  });

  it('lets it speak again once the window has passed', () => {
    // Suppression is a day, not forever: a budget still over tomorrow is a new
    // fact worth one more warning. Written by ageing the ledger entry rather
    // than by faking the clock, so it exercises the real comparison.
    const { result } = renderHook(() => useNotifications(), { wrapper });

    act(() => { result.current.addNotification(alert('budget-6-warning')); });
    act(() => { result.current.clearAll(); });

    const LEDGER = 'money_management_notification_dedupe';
    const ledger = JSON.parse(localStorage.getItem(LEDGER) ?? '{}') as Record<string, number>;
    ledger['budget-6-warning'] = Date.now() - (25 * 60 * 60 * 1000);
    localStorage.setItem(LEDGER, JSON.stringify(ledger));

    act(() => { result.current.addNotification(alert('budget-6-warning')); });

    expect(result.current.notifications).toHaveLength(1);
  });
});
