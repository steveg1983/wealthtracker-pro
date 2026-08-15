/**
 * EnhancedConflictResolutionModal Tests
 *
 * This is the conflict chooser Layout actually mounts. It asks the user to
 * pick between two versions of their own money, so the one thing it must never
 * do is print a debit and a credit the same way — which it did, because the
 * formatter it used took Math.abs and never put the sign back.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { EnhancedConflictResolutionModal } from './EnhancedConflictResolutionModal';
import type { SyncConflict } from '../../types/syncConflict';

const conflict: SyncConflict = {
  id: 'conflict-1',
  entity: 'transaction',
  clientData: {
    amount: -45.5,
    description: 'TESCO STORES',
    date: '2024-01-15',
    category: 'groceries',
  },
  serverData: {
    amount: 45.5,
    description: 'TESCO STORES',
    date: '2024-01-15',
    category: 'groceries',
  },
  clientTimestamp: 1720000000000,
  serverTimestamp: 1720000100000,
};

const renderModal = (override: Partial<SyncConflict> = {}) =>
  render(
    <PreferencesProvider>
      <EnhancedConflictResolutionModal
        isOpen
        onClose={() => {}}
        conflict={{ ...conflict, ...override }}
        onResolve={() => {}}
      />
    </PreferencesProvider>
  );

const requireElement = (value: Element | null, what: string): HTMLElement => {
  if (!(value instanceof HTMLElement)) {
    throw new Error(`expected an element for ${what}`);
  }
  return value;
};

/** The two panels of the `amount` row: the client's figure, then the server's. */
const amountPanels = (): { client: HTMLElement; server: HTMLElement } => {
  const row = requireElement(screen.getByText('amount').closest('div.border'), 'the amount row');
  return {
    client: requireElement(within(row).getByText('Your Version').parentElement, 'the client panel'),
    server: requireElement(within(row).getByText('Server Version').parentElement, 'the server panel'),
  };
};

describe('EnhancedConflictResolutionModal', () => {
  it('keeps the minus sign on the client debit and none on the server credit', () => {
    renderModal();
    const { client, server } = amountPanels();

    expect(within(client).getByText('(£45.50)')).toBeInTheDocument();
    expect(within(server).getByText('£45.50')).toBeInTheDocument();
  });

  it('signs a numeric string amount the same way as a number', () => {
    renderModal({
      clientData: { ...conflict.clientData, amount: '-45.50' },
      serverData: { ...conflict.serverData, amount: '45.50' },
    });
    const { client, server } = amountPanels();

    expect(within(client).getByText('(£45.50)')).toBeInTheDocument();
    expect(within(server).getByText('£45.50')).toBeInTheDocument();
  });

  it('renders in the display currency the user chose, not a hard-coded pound', () => {
    localStorage.setItem('money_management_currency', 'USD');
    try {
      renderModal();
      const { client, server } = amountPanels();

      expect(within(client).getByText('($45.50)')).toBeInTheDocument();
      expect(within(server).getByText('$45.50')).toBeInTheDocument();
    } finally {
      localStorage.removeItem('money_management_currency');
    }
  });
});
