/**
 * SyncConflictResolver Tests
 * Loading behaviour + the unmount guard that stops the async conflict load
 * from calling setState after teardown (the intermittent "window is not
 * defined" quality-gates failure). The exact CI crash mode — jsdom's window
 * being torn down between test files — can't be reproduced inside one test,
 * so the race test asserts the observable contract instead: a load that
 * resolves after unmount must complete without errors or warnings.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { SyncConflictResolver } from './SyncConflictResolver';

const mocks = vi.hoisted(() => ({
  getConflicts: vi.fn<() => Promise<unknown[]>>(async () => []),
  resolveConflict: vi.fn<(id: string, resolution: 'local' | 'server') => Promise<void>>(async () => {}),
}));

vi.mock('../services/offlineService', () => ({
  offlineService: {
    getConflicts: mocks.getConflicts,
    resolveConflict: mocks.resolveConflict,
  },
}));

const conflict = (id: string): Record<string, unknown> => ({
  id,
  entity: 'transaction',
  localData: { description: 'TESCO STORES', amount: -45.5 },
  serverData: null,
  timestamp: 1720000000000,
  resolved: false,
});

describe('SyncConflictResolver', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getConflicts.mockResolvedValue([]);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('renders nothing when there are no conflicts', async () => {
    const { container } = render(<SyncConflictResolver />);
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the conflict indicator once conflicts load', async () => {
    mocks.getConflicts.mockResolvedValue([conflict('c1')]);
    render(<SyncConflictResolver />);
    expect(
      await screen.findByRole('button', { name: /resolve sync conflicts/i })
    ).toBeInTheDocument();
  });

  it('drops unparseable and already-resolved conflicts', async () => {
    mocks.getConflicts.mockResolvedValue([
      conflict('c1'),
      { ...conflict('c2'), resolved: true },
      'not-a-conflict',
      null,
    ]);
    render(<SyncConflictResolver />);
    const indicator = await screen.findByRole('button', { name: /resolve sync conflicts/i });
    // Only c1 survives — a single conflict shows no count badge
    expect(indicator.textContent).not.toMatch(/\d/);
  });

  it('ignores a conflict load that resolves after unmount (teardown race)', async () => {
    let resolveLoad: (value: unknown[]) => void = () => {};
    mocks.getConflicts.mockReturnValue(
      new Promise<unknown[]>(resolve => {
        resolveLoad = resolve;
      })
    );

    const { unmount } = render(<SyncConflictResolver />);
    unmount();

    await act(async () => {
      resolveLoad([conflict('c1')]);
    });

    expect(errorSpy).not.toHaveBeenCalled();
  });
});
