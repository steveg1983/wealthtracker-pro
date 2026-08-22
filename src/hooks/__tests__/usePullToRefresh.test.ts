import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePullToRefresh } from '../usePullToRefresh';

/**
 * THE PULL MUST NOT FIRE THROUGH AN OPEN DIALOG (owner, 21 Aug).
 *
 * The gesture's "am I at the top of the page?" guard reads `window.scrollY` —
 * and the shared Modal pins the body (`position: fixed`, top -scrollY) while a
 * dialog is open, which holds scrollY at 0 for the whole of it. So every touch
 * inside the transaction editor was a pull candidate: scrolling UP at its
 * bottom first had its scroll eaten by the hook's preventDefault ("the page
 * freezes") and the release then reloaded the app out from under the editor
 * ("refreshes the page and kicks me back to the register"). Reproduced in an
 * installed app on a simulator — the WebContent process never died; this hook
 * was the whole of the 'crash'.
 *
 * The events below are plain Events carrying a `touches` array, which is all
 * the hook reads. `reload` is injected so a firing pull is observable without
 * jsdom navigation.
 */

const touchEvent = (
  type: 'touchstart' | 'touchmove' | 'touchend',
  clientY?: number
): Event => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', {
    value: clientY === undefined ? [] : [{ clientY }],
  });
  return event;
};

/** A full pull gesture: down 400px from the top of the screen, then release. */
const pullDown = (): void => {
  act(() => {
    window.dispatchEvent(touchEvent('touchstart', 100));
  });
  act(() => {
    window.dispatchEvent(touchEvent('touchmove', 500));
  });
  act(() => {
    window.dispatchEvent(touchEvent('touchend'));
  });
};

describe('usePullToRefresh — an open dialog owns the screen', () => {
  let matchMediaSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // The hook only arms in an installed app.
    matchMediaSpy = vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query === '(display-mode: standalone)',
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          onchange: null,
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList
    );
  });

  afterEach(() => {
    matchMediaSpy.mockRestore();
    document.body.style.position = '';
  });

  it('a pull on an ordinary page reloads — the gesture the installed app exists for', () => {
    const reload = vi.fn();
    renderHook(() => usePullToRefresh(reload));

    pullDown();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('the same pull with the body scroll-locked does nothing — that is a dialog, not a page top', () => {
    const reload = vi.fn();
    document.body.style.position = 'fixed';
    renderHook(() => usePullToRefresh(reload));

    pullDown();

    expect(reload).not.toHaveBeenCalled();
  });

  it('a scroll-locked drag keeps its default — the dialog scrolls instead of freezing', () => {
    const reload = vi.fn();
    document.body.style.position = 'fixed';
    renderHook(() => usePullToRefresh(reload));

    act(() => {
      window.dispatchEvent(touchEvent('touchstart', 100));
    });
    const move = touchEvent('touchmove', 500);
    act(() => {
      window.dispatchEvent(move);
    });

    // The old behaviour: preventDefault on this event, which ATE the modal
    // body's own scroll — the reported "freeze" before the reload.
    expect(move.defaultPrevented).toBe(false);
  });
});
