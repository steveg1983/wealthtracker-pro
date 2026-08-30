/**
 * WHAT "DISCONNECTED" IS ALLOWED TO MEAN, IN THE PANEL.
 *
 * The same silence the Open Banking page carried, in the other surface that
 * disconnects a bank. `bankConnectionService.disconnect` discarded the
 * endpoint's answer and returned a bare `true`, so a provider that refused to
 * drop the consent and one that accepted produced exactly the same thing on
 * screen: a row disappearing, and nothing said.
 *
 * The row still goes either way — a connection left standing is what recreates
 * the accounts on the next sync — so what is pinned here is the sentence, not
 * the deletion.
 *
 * Every institution name and id below is invented; the repo is public.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: async () => 'test-token' })
}));

const disconnect = vi.fn();
const refreshConnections = vi.fn(async () => []);
const getConnections = vi.fn();

vi.mock('../../services/bankConnectionService', () => ({
  bankConnectionService: {
    setAuthTokenProvider: vi.fn(),
    refreshConnections: () => refreshConnections(),
    getConnections: () => getConnections(),
    refreshConfigStatus: async () => {},
    getConfigStatus: () => ({ plaid: false, trueLayer: true }),
    isConfigStatusKnown: () => true,
    getInstitutions: async () => [],
    disconnect: (connectionId: string) => disconnect(connectionId)
  }
}));

import BankConnections from '../BankConnections';

const connection = {
  id: 'conn_invented_2',
  provider: 'truelayer' as const,
  institutionId: 'provider_invented',
  institutionName: 'Wistful Building Society',
  status: 'connected' as const,
  accounts: [],
  linkedAccountIds: [],
  accountsCount: 1
};

/** Press the unlink control and get past the confirm it raises. */
const pressDisconnect = async () => {
  const button = await screen.findByTitle('Disconnect');
  fireEvent.click(button);
};

let confirmSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  getConnections.mockReturnValue([connection]);
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  confirmSpy.mockRestore();
  cleanup();
});

describe('when the provider did not confirm the revocation', () => {
  it('tells the user the bank may still hold the authorisation', async () => {
    disconnect.mockResolvedValue({ removed: true, revokedAtProvider: false });

    render(<BankConnections />);
    await pressDisconnect();

    // Consequence, then remedy — and the remedy is somewhere this app cannot
    // reach, so it has to be named rather than offered as a button.
    expect(await screen.findByText(/Your bank may still hold this authorisation/i)).toBeTruthy();
    expect(screen.getByText(/your bank’s own app or online banking/i)).toBeTruthy();
  });
});

describe('when there is nothing to warn about', () => {
  it('stays quiet once the provider confirmed', async () => {
    disconnect.mockResolvedValue({ removed: true, revokedAtProvider: true });

    render(<BankConnections />);
    await pressDisconnect();

    await waitFor(() => expect(disconnect).toHaveBeenCalledWith('conn_invented_2'));
    expect(screen.queryByText(/may still hold this authorisation/i)).toBeNull();
  });

  it('stays quiet when the endpoint did not answer the question', async () => {
    // A deployment that sends no `revokedAtProvider` has told us nothing, and
    // "we were not told" must not be reported as "the bank refused".
    disconnect.mockResolvedValue({ removed: true });

    render(<BankConnections />);
    await pressDisconnect();

    await waitFor(() => expect(disconnect).toHaveBeenCalledWith('conn_invented_2'));
    expect(screen.queryByText(/may still hold this authorisation/i)).toBeNull();
  });
});
