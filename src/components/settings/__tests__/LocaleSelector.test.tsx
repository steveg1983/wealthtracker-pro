import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LocaleSelector from '../LocaleSelector';
import { preferences } from '../../../services/preferencesService';

/**
 * The region choice has to REACH THE STORE before the page is thrown away.
 *
 * `setUserLocale` schedules its write on a debounce; reloading in the same
 * tick killed the timer, so the choice only ever reached the browser mirror.
 * On the desktop edition that was fatal rather than merely unlucky — the
 * ledger file is attached before the first render, and a loaded store stops
 * consulting the mirror by design — so the stored value was unreadable and the
 * dropdown fell back to the machine's OS locale on every launch.
 *
 * These pin the ORDER, which is the whole of the fix: flush, then reload.
 */
describe('LocaleSelector — the choice is written before the reload', () => {
  let reload: ReturnType<typeof vi.fn>;
  let originalLocation: Location;

  beforeEach(() => {
    originalLocation = window.location;
    reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload }
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    vi.restoreAllMocks();
  });

  it('flushes the preference store, and only then reloads', async () => {
    const order: string[] = [];
    // The write must take REAL time, or the ordering cannot diverge and this
    // spec passes whether or not the fix is present. (It did, first try.)
    const flush = vi.spyOn(preferences, 'flush').mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      order.push('flush');
    });
    reload.mockImplementation(() => {
      order.push('reload');
    });

    render(<LocaleSelector />);
    await userEvent.selectOptions(screen.getByLabelText('Select Your Region'), 'en-AU');

    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(flush).toHaveBeenCalled();
    // Without the await, `reload` runs first and the write never lands.
    expect(order).toEqual(['flush', 'reload']);
  });

  it('stores the chosen locale', async () => {
    vi.spyOn(preferences, 'flush').mockResolvedValue(undefined);
    const setItem = vi.spyOn(preferences, 'setItem');

    render(<LocaleSelector />);
    await userEvent.selectOptions(screen.getByLabelText('Select Your Region'), 'en-GB');

    expect(setItem).toHaveBeenCalledWith('preferredLocale', 'en-GB');
  });
});
