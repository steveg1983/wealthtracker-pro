import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { ResponsiveModal } from './ResponsiveModal';
import { MOBILE_VIEWPORT_QUERY } from '../hooks/useMediaQuery';

/**
 * The form factor was read ONCE, in the render body, from
 * `window.innerWidth < 768` with nothing subscribed to it. So the component
 * was correct at mount and never again: rotate a phone and the sheet stayed a
 * sheet, drag a desktop window across 768 and the dialog kept whichever shape
 * it was born with. These tests are about the second reading, not the first.
 */

interface FakeMediaControl {
  /** Move the viewport across the breakpoint and notify subscribers. */
  setViewport: (matches: boolean) => void;
  /** How many live subscriptions the component is holding. */
  listenerCount: () => number;
}

/** A matchMedia whose answer this test can change, and which tells its subscribers. */
function installMatchMedia(initialMatches: boolean): FakeMediaControl {
  let matches = initialMatches;
  const listeners = new Set<() => void>();

  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    // Only the phone query is driven here; anything else is simply not matched.
    get matches() {
      return query === MOBILE_VIEWPORT_QUERY ? matches : false;
    },
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
    dispatchEvent: vi.fn()
  }));

  return {
    setViewport: (next: boolean) => {
      matches = next;
      act(() => {
        listeners.forEach(listener => listener());
      });
    },
    listenerCount: () => listeners.size
  };
}

const originalMatchMedia = window.matchMedia;

describe('ResponsiveModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    document.body.style.overflow = '';
  });

  it('is a bottom sheet on a phone', () => {
    installMatchMedia(true);

    render(
      <ResponsiveModal isOpen onClose={vi.fn()} title="Add Transaction">
        <p>body</p>
      </ResponsiveModal>
    );

    expect(screen.getByRole('button', { name: 'Close bottom sheet' })).toBeInTheDocument();
  });

  it('is a centred dialog on a desktop', () => {
    installMatchMedia(false);

    render(
      <ResponsiveModal isOpen onClose={vi.fn()} title="Add Transaction">
        <p>body</p>
      </ResponsiveModal>
    );

    expect(screen.getByRole('button', { name: 'Close modal' })).toBeInTheDocument();
  });

  it('BECOMES a dialog when a phone is rotated past the breakpoint', () => {
    const { setViewport } = installMatchMedia(true);

    render(
      <ResponsiveModal isOpen onClose={vi.fn()} title="Add Transaction">
        <p>body</p>
      </ResponsiveModal>
    );

    expect(screen.getByRole('button', { name: 'Close bottom sheet' })).toBeInTheDocument();

    // The rotation. Nothing else re-renders — which is exactly why the old
    // snapshot never updated.
    setViewport(false);

    expect(screen.getByRole('button', { name: 'Close modal' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close bottom sheet' })).not.toBeInTheDocument();
  });

  it('BECOMES a sheet when a desktop window is dragged below the breakpoint', () => {
    const { setViewport } = installMatchMedia(false);

    render(
      <ResponsiveModal isOpen onClose={vi.fn()} title="Add Transaction">
        <p>body</p>
      </ResponsiveModal>
    );

    expect(screen.getByRole('button', { name: 'Close modal' })).toBeInTheDocument();

    setViewport(true);

    expect(screen.getByRole('button', { name: 'Close bottom sheet' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close modal' })).not.toBeInTheDocument();
  });

  it('mounts exactly ONE dialog at a time', () => {
    // Why this is a listener and not a CSS breakpoint: the two branches are
    // different components, each with its own focus trap and its own claim on
    // body scroll. Rendering both and hiding one would leave two modals over
    // one page, fighting.
    const { setViewport } = installMatchMedia(false);

    render(
      <ResponsiveModal isOpen onClose={vi.fn()} title="Add Transaction">
        <p>body</p>
      </ResponsiveModal>
    );

    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    setViewport(true);

    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('unsubscribes when it unmounts, leaving no listener behind', () => {
    // A viewport listener that outlives its component is the leak this whole
    // change could plausibly have introduced: one per modal open, forever.
    const { listenerCount } = installMatchMedia(false);

    const { unmount } = render(
      <ResponsiveModal isOpen onClose={vi.fn()} title="Add Transaction">
        <p>body</p>
      </ResponsiveModal>
    );

    expect(listenerCount()).toBe(1);

    unmount();

    expect(listenerCount()).toBe(0);
  });
});
