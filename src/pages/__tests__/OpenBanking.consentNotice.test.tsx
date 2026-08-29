/**
 * WHAT "DISCONNECTED" IS ALLOWED TO MEAN.
 *
 * Removing our `bank_connections` row and revoking the consent behind it at
 * the bank are two different acts, and this page used to report only the
 * first while implying both. `bankConnectionService.disconnect` threw the
 * endpoint's answer away and returned a bare `true`, so a TrueLayer that
 * REFUSED the revocation arrived here indistinguishable from one that had
 * accepted: the row vanished from the list, nothing was said, and the user
 * walked away believing they had withdrawn access their bank was still
 * holding open.
 *
 * The row going either way is correct and stays — a connection left standing
 * is what recreates the accounts on the next sync. The dishonesty was the
 * silence, so these specs are about the sentence, not the deletion.
 *
 * Every institution name and connection id below is invented; the repo is
 * public.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ONE object, returned every render. A fresh one each time changes the
// identity of `getToken`, which is `loadConnections`'s only dependency, which
// is the mount effect's — so the page would refetch its connections on every
// render and put the disconnected row straight back. That is a fixture
// artefact, not the page's behaviour: Clerk's own hook is stable.
const clerkAuth = { getToken: async () => 'test-token', isLoaded: true };
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => clerkAuth
}));

const disconnect = vi.fn();
const refreshConnections = vi.fn();

vi.mock('../../services/bankConnectionService', () => ({
  bankConnectionService: {
    setAuthTokenProvider: vi.fn(),
    refreshConnections: () => refreshConnections(),
    disconnect: (connectionId: string) => disconnect(connectionId)
  }
}));

import OpenBanking from '../OpenBanking';

const connection = {
  id: 'conn_invented_1',
  provider: 'truelayer' as const,
  institutionId: 'provider_invented',
  institutionName: 'Wistful Building Society',
  status: 'connected' as const,
  accounts: [],
  linkedAccountIds: [],
  accountsCount: 1
};

const renderPage = () => render(
  <MemoryRouter>
    <OpenBanking />
  </MemoryRouter>
);

/** Press Disconnect and get past the confirm the destructive control raises. */
const pressDisconnect = async () => {
  const button = await screen.findByRole('button', { name: 'Disconnect' });
  fireEvent.click(button);
};

let confirmSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  refreshConnections.mockResolvedValue([connection]);
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  confirmSpy.mockRestore();
  cleanup();
});

describe('when the bank did not confirm the revocation', () => {
  it('says the authorisation may still stand, and where to remove it', async () => {
    disconnect.mockResolvedValue({ removed: true, revokedAtProvider: false });

    renderPage();
    await pressDisconnect();

    // CONSEQUENCE first — what is true of their money and their bank right
    // now — and only then the remedy, which is somewhere this app cannot
    // reach and so has to be named precisely.
    const notice = await screen.findByText(/Your bank may still hold this authorisation/i);
    expect(notice).toBeTruthy();
    expect(screen.getByText(/didn’t\s+confirm that it had dropped WealthTracker’s access/i)).toBeTruthy();
    expect(screen.getByText(/your bank’s own app or online banking/i)).toBeTruthy();
  });

  it('still removes the row, because a connection left standing resurrects the accounts', async () => {
    disconnect.mockResolvedValue({ removed: true, revokedAtProvider: false });

    renderPage();
    await pressDisconnect();

    // The warning is not a failure report. The disconnect happened.
    await waitFor(() => {
      expect(screen.queryByText('Wistful Building Society')).toBeNull();
    });
  });
});

describe('when there is nothing to warn about', () => {
  it('says nothing at all once the provider confirmed', async () => {
    disconnect.mockResolvedValue({ removed: true, revokedAtProvider: true });

    renderPage();
    await pressDisconnect();

    await waitFor(() => {
      expect(screen.queryByText('Wistful Building Society')).toBeNull();
    });
    // A settled outcome needs no colour and no sentence.
    expect(screen.queryByText(/may still hold this authorisation/i)).toBeNull();
  });

  it('says nothing when the endpoint did not answer the question', async () => {
    // An older deployment sends no `revokedAtProvider`. "We were not told" is
    // not "the bank refused", and dressing the first up as the second would
    // put a false alarm about a live bank authorisation in front of everyone.
    disconnect.mockResolvedValue({ removed: true });

    renderPage();
    await pressDisconnect();

    await waitFor(() => {
      expect(screen.queryByText('Wistful Building Society')).toBeNull();
    });
    expect(screen.queryByText(/may still hold this authorisation/i)).toBeNull();
  });
});
