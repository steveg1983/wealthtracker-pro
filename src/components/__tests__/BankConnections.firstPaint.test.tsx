/**
 * WHAT THE BANK-CONNECTIONS PANEL SAYS BEFORE IT KNOWS ANYTHING.
 *
 * ─ THE REPORT ──────────────────────────────────────────────────────────────
 * "There seems to be 2 other pages that occupy the pop up before it settles on
 * the one I have attached but the app flicks through them that quick I cannot
 * get a screenshot."
 *
 * They were these, in order, on an account with three live bank connections:
 *
 *   1. "Bank connections not configured — add your provider credentials to the
 *      backend environment variables". `configStatus` starts as
 *      `{ plaid: false, trueLayer: false }` and the warning renders on
 *      `!plaid && !trueLayer`, so it showed until `refreshConfigStatus()`
 *      returned.
 *   2. "No banks connected — Connect Your First Bank". `connections` starts as
 *      `[]` and the list renders on `connections.length > 0`, so the empty
 *      state showed until `refreshConnections()` returned.
 *
 * Both are one mistake — an EMPTY INITIAL VALUE RENDERED AS A FINDING — and in
 * a finance app it is the expensive kind: for the half-second it lasted, the
 * panel was indistinguishable from having lost every bank link.
 *
 * These tests hold the fetches open deliberately. That is the whole point: the
 * bug lives entirely in the window before they resolve, which is why it was too
 * quick to photograph and why nothing that waited for the settled state could
 * ever have caught it.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: async () => 'test-token' })
}));

const refreshConnections = vi.fn();
const refreshConfigStatus = vi.fn();
const getConnections = vi.fn(() => []);
const getConfigStatus = vi.fn(() => ({ plaid: false, trueLayer: false }));

vi.mock('../../services/bankConnectionService', () => ({
  bankConnectionService: {
    setAuthTokenProvider: vi.fn(),
    refreshConnections: (...args: unknown[]) => refreshConnections(...args),
    getConnections: () => getConnections(),
    refreshConfigStatus: (...args: unknown[]) => refreshConfigStatus(...args),
    getConfigStatus: () => getConfigStatus(),
    getInstitutions: async () => [],
  }
}));

import BankConnections from '../BankConnections';

/** A promise that never settles — the panel is held in its unknown state. */
const pending = (): Promise<never> => new Promise<never>(() => {});

beforeEach(() => {
  vi.clearAllMocks();
  getConnections.mockReturnValue([]);
  getConfigStatus.mockReturnValue({ plaid: false, trueLayer: false });
});
afterEach(cleanup);

describe('before the first fetch has answered', () => {
  it('does not announce that bank connections are unconfigured', () => {
    refreshConfigStatus.mockImplementation(pending);
    refreshConnections.mockImplementation(pending);

    render(<BankConnections />);

    // The yellow panel is a FINDING about the backend. Until the check returns
    // there is no finding, only an unanswered question.
    expect(screen.queryByText(/not configured/i)).toBeNull();
  });

  it('does not announce that no banks are connected', () => {
    refreshConfigStatus.mockImplementation(pending);
    refreshConnections.mockImplementation(pending);

    render(<BankConnections />);

    // The sentence the owner saw flash on an account with three banks.
    expect(screen.queryByText(/No banks connected/i)).toBeNull();
    expect(screen.queryByText(/Connect Your First Bank/i)).toBeNull();
  });
});

describe('once the fetches answer', () => {
  it('says so when there really are no banks', async () => {
    // The empty state is not being removed — it is being made TRUE. A genuinely
    // empty account must still be told, or the fix would trade one silence for
    // another.
    refreshConnections.mockResolvedValue(undefined);
    refreshConfigStatus.mockResolvedValue(undefined);
    getConnections.mockReturnValue([]);

    render(<BankConnections />);

    await waitFor(() => {
      expect(screen.getByText(/No banks connected/i)).toBeInTheDocument();
    });
  });

  it('says so when the providers really are unconfigured', async () => {
    refreshConnections.mockResolvedValue(undefined);
    refreshConfigStatus.mockResolvedValue(undefined);
    getConfigStatus.mockReturnValue({ plaid: false, trueLayer: false });

    render(<BankConnections />);

    await waitFor(() => {
      expect(screen.getByText(/not configured/i)).toBeInTheDocument();
    });
  });

  it('stops waiting even when the fetch FAILS', async () => {
    /*
     * The `finally` in both loaders. A rejected refresh has told us as much as
     * it is going to, and a panel that waited forever for an answer that never
     * comes would be its own kind of lie — a permanent blank instead of a
     * momentary false one.
     */
    refreshConnections.mockRejectedValue(new Error('network'));
    refreshConfigStatus.mockRejectedValue(new Error('network'));
    getConnections.mockReturnValue([]);

    render(<BankConnections />);

    await waitFor(() => {
      expect(screen.getByText(/No banks connected/i)).toBeInTheDocument();
    });
  });
});
