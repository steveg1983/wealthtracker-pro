/**
 * SyncConflictResolver Tests
 * Loading behaviour + the unmount guard that stops the async conflict load
 * from calling setState after teardown (the intermittent "window is not
 * defined" quality-gates failure). The exact CI crash mode — jsdom's window
 * being torn down between test files — can't be reproduced inside one test,
 * so the race test asserts the observable contract instead: a load that
 * resolves after unmount must complete without errors or warnings.
 *
 * Plus the sign contract: this screen asks the user to choose between two
 * versions of their own money, so a debit and a credit of the same size must
 * not render identically.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreferencesProvider } from '../contexts/PreferencesContext';
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

const conflict = (
  id: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
  id,
  entity: 'transaction',
  localData: { description: 'TESCO STORES', amount: -45.5 },
  serverData: null,
  timestamp: 1720000000000,
  resolved: false,
  ...overrides,
});

const renderResolver = () =>
  render(
    <PreferencesProvider>
      <SyncConflictResolver />
    </PreferencesProvider>
  );

/** The column a "Local Version"/"Server Version" heading belongs to. */
const panelFor = (heading: HTMLElement): HTMLElement => {
  const panel = heading.closest('div.space-y-4');
  if (!(panel instanceof HTMLElement)) {
    throw new Error(`no panel wraps the "${heading.textContent}" heading`);
  }
  return panel;
};

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

  it('keeps the minus sign on a debit, so a debit and a credit are told apart', async () => {
    const user = userEvent.setup();
    mocks.getConflicts.mockResolvedValue([
      conflict('c1', {
        localData: { description: 'TESCO STORES', amount: -45.5 },
        serverData: { description: 'TESCO STORES', amount: 45.5 },
      }),
    ]);

    renderResolver();
    await user.click(await screen.findByRole('button', { name: /resolve sync conflicts/i }));
    await user.click(await screen.findByRole('button', { name: /transaction conflict/i }));

    // Local version is money leaving the account; the server copy has it as
    // money arriving. Stripping the sign made both read "£45.50" and there was
    // no way to tell which version to keep.
    expect(await screen.findByText('-£45.50')).toBeInTheDocument();
    expect(screen.getByText('£45.50')).toBeInTheDocument();
  });

  it('renders each version under its own heading with the right sign', async () => {
    const user = userEvent.setup();
    mocks.getConflicts.mockResolvedValue([
      conflict('c1', {
        localData: { description: 'TESCO STORES', amount: -45.5 },
        serverData: { description: 'TESCO STORES', amount: 45.5 },
      }),
    ]);

    renderResolver();
    await user.click(await screen.findByRole('button', { name: /resolve sync conflicts/i }));
    await user.click(await screen.findByRole('button', { name: /transaction conflict/i }));

    const local = panelFor(await screen.findByText('Local Version'));
    const server = panelFor(await screen.findByText('Server Version'));
    expect(within(local).getByText('-£45.50')).toBeInTheDocument();
    expect(within(server).getByText('£45.50')).toBeInTheDocument();
  });

  it('shows zero without a phantom minus sign', async () => {
    const user = userEvent.setup();
    mocks.getConflicts.mockResolvedValue([
      conflict('c1', {
        localData: { description: 'ROUNDED OUT', amount: -0 },
        serverData: { description: 'ROUNDED OUT', amount: 0 },
      }),
    ]);

    renderResolver();
    await user.click(await screen.findByRole('button', { name: /resolve sync conflicts/i }));
    await user.click(await screen.findByRole('button', { name: /transaction conflict/i }));

    expect(await screen.findAllByText('£0.00')).toHaveLength(2);
    expect(screen.queryByText('-£0.00')).not.toBeInTheDocument();
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
