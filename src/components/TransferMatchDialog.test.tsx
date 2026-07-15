import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TransferMatchDialog from './TransferMatchDialog';
import type { Transaction } from '../types';
import type { TransferCandidate } from '../utils/transferMatch';

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (n: number) => `£${Math.abs(Number(n)).toFixed(2)}`,
  }),
}));

const source: Transaction = {
  id: 'src',
  date: new Date('2026-06-10'),
  description: 'TRANSFER TO 5755',
  amount: -500,
  type: 'expense',
  accountId: 'acc-a',
  category: '',
  cleared: false,
} as Transaction;

const candidate = (id: string, over: Partial<Transaction> = {}, daysApart = 0): TransferCandidate => ({
  transaction: {
    ...source,
    id,
    accountId: 'acc-b',
    amount: 500,
    description: 'FASTER PAYMENT RECEIVED',
    ...over,
  } as Transaction,
  daysApart,
  descriptionScore: 10,
});

const baseProps = {
  isOpen: true,
  source,
  sourceAccountName: 'Current Account',
  targetAccountName: 'Savings',
  busy: false,
  onLink: vi.fn(),
  onCreate: vi.fn(),
  onCancel: vi.fn(),
};

describe('TransferMatchDialog', () => {
  it('describes the movement direction from the amount sign', () => {
    render(<TransferMatchDialog {...baseProps} candidates={[candidate('c1')]} />);
    expect(screen.getByText('£500.00 from Current Account to Savings')).toBeInTheDocument();
  });

  it('offers to link when a match exists, preselecting the best one', () => {
    const onLink = vi.fn();
    render(<TransferMatchDialog {...baseProps} onLink={onLink} candidates={[candidate('c1')]} />);
    expect(screen.getByText(/Found the matching transaction in Savings/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Link as transfer' }));
    expect(onLink).toHaveBeenCalledWith('c1');
  });

  it('lets the user pick between several matches', () => {
    const onLink = vi.fn();
    render(
      <TransferMatchDialog
        {...baseProps}
        onLink={onLink}
        candidates={[candidate('c1'), candidate('c2', { description: 'CHEQUE IN' }, 2)]}
      />
    );
    expect(screen.getByText(/Found 2 possible matches/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /CHEQUE IN/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Link as transfer' }));
    expect(onLink).toHaveBeenCalledWith('c2');
  });

  it('still allows creating a new counterpart when matches exist', () => {
    const onCreate = vi.fn();
    render(<TransferMatchDialog {...baseProps} onCreate={onCreate} candidates={[candidate('c1')]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create new instead' }));
    expect(onCreate).toHaveBeenCalled();
  });

  it('offers creation with a balance warning when nothing matches', () => {
    const onCreate = vi.fn();
    render(<TransferMatchDialog {...baseProps} onCreate={onCreate} candidates={[]} />);
    expect(screen.getByText(/No matching transaction was found in Savings/)).toBeInTheDocument();
    expect(screen.getByText(/adjusts Savings.s balance/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Create the other side' }));
    expect(onCreate).toHaveBeenCalled();
  });

  it('cancels without side effects', () => {
    const onCancel = vi.fn();
    const onLink = vi.fn();
    render(<TransferMatchDialog {...baseProps} onCancel={onCancel} onLink={onLink} candidates={[candidate('c1')]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onLink).not.toHaveBeenCalled();
  });

  it('disables actions while busy', () => {
    render(<TransferMatchDialog {...baseProps} busy candidates={[candidate('c1')]} />);
    expect(screen.getByRole('button', { name: 'Linking…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
