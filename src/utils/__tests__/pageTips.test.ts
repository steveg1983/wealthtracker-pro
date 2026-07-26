import { describe, it, expect, beforeEach } from 'vitest';
import { PAGE_TIP_KEY_PREFIX, pageTipStorageKey, resetDismissedPageTips } from '../pageTips';

describe('pageTips', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('builds the storage key for a tip id', () => {
    expect(pageTipStorageKey('dashboard-welcome-2')).toBe(`${PAGE_TIP_KEY_PREFIX}dashboard-welcome-2`);
  });

  it('clears every dismissed tip and reports how many', () => {
    localStorage.setItem(pageTipStorageKey('dashboard-welcome-2'), 'true');
    localStorage.setItem(pageTipStorageKey('settings-intro-2'), 'true');
    localStorage.setItem(pageTipStorageKey('reports-gallery-2'), 'true');

    expect(resetDismissedPageTips()).toBe(3);
    expect(localStorage.getItem(pageTipStorageKey('dashboard-welcome-2'))).toBeNull();
    expect(localStorage.getItem(pageTipStorageKey('settings-intro-2'))).toBeNull();
    expect(localStorage.getItem(pageTipStorageKey('reports-gallery-2'))).toBeNull();
  });

  // The reset runs over the whole of localStorage, which is shared with the
  // user's real preferences — it must touch nothing else.
  it('leaves unrelated keys alone', () => {
    localStorage.setItem(pageTipStorageKey('import-intro'), 'true');
    localStorage.setItem('reportsPeriod', 'this-month');
    localStorage.setItem('onboardingCompleted', 'true');
    localStorage.setItem('dashboardKeyAccounts', '["a"]');

    expect(resetDismissedPageTips()).toBe(1);
    expect(localStorage.getItem('reportsPeriod')).toBe('this-month');
    expect(localStorage.getItem('onboardingCompleted')).toBe('true');
    expect(localStorage.getItem('dashboardKeyAccounts')).toBe('["a"]');
  });

  it('reports zero when nothing was dismissed', () => {
    localStorage.setItem('onboardingCompleted', 'true');
    expect(resetDismissedPageTips()).toBe(0);
  });
});
