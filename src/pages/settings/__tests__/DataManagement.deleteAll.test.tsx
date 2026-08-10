import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../../contexts/ToastContext';
import { __setAppContextValue, __resetAppContextValue } from '../../../test/mocks/AppContextSupabase';
import type { WipeProgress } from '../../../services/port';

/**
 * "Delete All Data" as the user meets it.
 *
 * The live failure: on 51,000 transactions the one-statement delete hit
 * `canceling statement due to statement timeout`, and the dialog showed nothing
 * but that sentence — after the transfer links had been nulled and the splits
 * deleted. The user was left with a half-wiped login, an error about a
 * statement, and no idea that running it again would finish the job.
 *
 * So these cover the three things the dialog has to do: SAY what it is doing
 * while it does it, REFUSE to be clicked mid-run, and on failure say the one
 * thing that helps — run it again.
 *
 * Every assertion below was written against the page while it still chose
 * between two engines with a Postgres client of its own, and run green against
 * it. Only the mock changed afterwards — from the engine to the one door the
 * page now knocks on — which is what makes this suite evidence that the routing
 * changed nothing the user can see.
 */

/** The wipe itself is covered in wipeCloudData.test; here it is a script. */
const wipeScript: {
  steps: WipeProgress[];
  failWith: string | null;
  calls: number;
  /** Set to keep the wipe genuinely in flight while assertions run. */
  hold: Promise<void> | null;
} = { steps: [], failWith: null, calls: 0, hold: null };

vi.mock('../../../services/port', () => ({
  dataPort: {
    wipeAllFinancialData: async (options: { onProgress?: (p: WipeProgress) => void } = {}) => {
      wipeScript.calls += 1;
      for (const step of wipeScript.steps) {
        options.onProgress?.(step);
        // Let React paint between steps, the way a real round trip does.
        await Promise.resolve();
      }
      if (wipeScript.hold !== null) await wipeScript.hold;
      if (wipeScript.failWith !== null) throw new Error(wipeScript.failWith);
    },
  },
}));

const { default: DataManagementSettings } = await import('../DataManagement');

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/settings/data']}>
      {/* The page's Archive section reports through the app's toasts, exactly
          as it does inside the real provider stack. */}
      <ToastProvider>
        <DataManagementSettings />
      </ToastProvider>
    </MemoryRouter>
  );

/** Open the dialog and type the phrase, leaving the button armed. */
const armTheButton = () => {
  fireEvent.click(screen.getByRole('button', { name: /Clear All Data/ }));
  fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'DELETE' } });
};

describe('Delete All Data — while it runs', () => {
  beforeEach(() => {
    wipeScript.steps = [];
    wipeScript.failWith = null;
    wipeScript.calls = 0;
    wipeScript.hold = null;
    // Signed in with a working cloud. The page no longer picks an engine — the
    // seam does — but this is still what decides the copy on the cards above.
    __setAppContextValue({
      capabilities: {
        edition: 'cloud',
        session: 'ready',
        realtime: true,
        maxConcurrentWrites: 8,
        backupTarget: 'login',
      },
    });
  });

  afterEach(() => {
    __resetAppContextValue();
  });

  it('names the table it is on and counts the rows, rather than saying "Deleting…" for four minutes', async () => {
    wipeScript.steps = [
      { table: 'transactions', deleted: 2_000, total: 51_000, step: 2, stepCount: 7 },
    ];
    // Held open so the assertion lands mid-run.
    wipeScript.failWith = 'stopped for the test';

    renderPage();
    armTheButton();
    fireEvent.click(screen.getByRole('button', { name: 'Delete All Data' }));

    const running = await screen.findByRole('status');
    expect(running).toHaveTextContent('Transactions');
    expect(running).toHaveTextContent('Step 2 of 7 — 2,000 of 51,000 rows');
  });

  it('says "rows removed" rather than inventing a denominator it does not have', async () => {
    wipeScript.steps = [
      { table: 'transactions', deleted: 400, total: undefined, step: 2, stepCount: 7 },
    ];
    wipeScript.failWith = 'stopped for the test';

    renderPage();
    armTheButton();
    fireEvent.click(screen.getByRole('button', { name: 'Delete All Data' }));

    expect(await screen.findByRole('status')).toHaveTextContent('400 rows removed');
  });

  it('will not take a second click while it is running', async () => {
    wipeScript.steps = [{ table: 'accounts', deleted: 0, total: 3, step: 6, stepCount: 7 }];
    // Held open, so the assertions land while the wipe is genuinely in flight.
    let release: () => void = () => {};
    wipeScript.hold = new Promise<void>((resolve) => { release = resolve; });

    renderPage();
    armTheButton();
    fireEvent.click(screen.getByRole('button', { name: 'Delete All Data' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Accounts');
    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByPlaceholderText('DELETE')).toBeDisabled();

    release();
    await wipeScript.hold;
  });
});

describe('Delete All Data — when it stops part-way', () => {
  beforeEach(() => {
    wipeScript.steps = [];
    wipeScript.failWith = null;
    wipeScript.calls = 0;
    wipeScript.hold = null;
    // Signed in with a working cloud. The page no longer picks an engine — the
    // seam does — but this is still what decides the copy on the cards above.
    __setAppContextValue({
      capabilities: {
        edition: 'cloud',
        session: 'ready',
        realtime: true,
        maxConcurrentWrites: 8,
        backupTarget: 'login',
      },
    });
  });

  afterEach(() => {
    __resetAppContextValue();
  });

  it('keeps the database\'s own sentence AND says to run it again', async () => {
    wipeScript.steps = [{ table: 'transactions', deleted: 2_000, total: 51_000, step: 2, stepCount: 7 }];
    wipeScript.failWith = 'canceling statement due to statement timeout';

    renderPage();
    armTheButton();
    fireEvent.click(screen.getByRole('button', { name: 'Delete All Data' }));

    // The message the user actually saw, unparaphrased.
    expect(await screen.findByText('canceling statement due to statement timeout')).toBeInTheDocument();
    // …and the recovery, which is the half that was missing.
    expect(screen.getByText(/run it again to finish/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run it again' })).toBeEnabled();
  });

  it('re-runs from the same dialog, without retyping the phrase', async () => {
    wipeScript.steps = [{ table: 'transactions', deleted: 2_000, total: 51_000, step: 2, stepCount: 7 }];
    wipeScript.failWith = 'canceling statement due to statement timeout';

    renderPage();
    armTheButton();
    fireEvent.click(screen.getByRole('button', { name: 'Delete All Data' }));
    await screen.findByRole('button', { name: 'Run it again' });

    wipeScript.failWith = null;
    fireEvent.click(screen.getByRole('button', { name: 'Run it again' }));

    await waitFor(() => expect(wipeScript.calls).toBe(2));
  });

  it('does not claim a half-wipe when nothing had started', async () => {
    // A failure before the first progress report is not a partial state, and
    // telling someone their data is half-deleted when it is not is its own
    // kind of harm.
    wipeScript.steps = [];
    wipeScript.failWith = 'permission denied for table transactions';

    renderPage();
    armTheButton();
    fireEvent.click(screen.getByRole('button', { name: 'Delete All Data' }));

    expect(await screen.findByText('permission denied for table transactions')).toBeInTheDocument();
    expect(screen.queryByText(/run it again to finish/i)).not.toBeInTheDocument();
  });
});
