/**
 * GoalModal — what the form actually SAVES.
 *
 * The previous version of this file mocked useModalForm and had the mock call
 * onSubmit with a hard-coded payload, so every "form submission" test passed
 * without the form being involved: the fields could have been wired to nothing.
 * These drive the real hook and assert the object handed to addGoal/updateGoal,
 * which is the only thing that reaches the database.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { __setAppContextValue, __resetAppContextValue } from '../test/mocks/AppContextSupabase';
import GoalModal from './GoalModal';
import type { Account, Goal } from '../types';

const account = (overrides: Partial<Account> & Pick<Account, 'id' | 'name'>): Account => ({
  type: 'savings',
  balance: 1000,
  currency: 'GBP',
  lastUpdated: new Date('2026-08-01'),
  ...overrides
});

const accounts: Account[] = [
  account({ id: 'acc-current', name: 'Natwest Current', type: 'current' }),
  account({ id: 'acc-savings', name: 'Natwest Savings' }),
  account({ id: 'acc-closed', name: 'Old ISA', isActive: false })
];

const existingGoal = (overrides: Partial<Goal> = {}): Goal => ({
  id: 'goal-1',
  name: 'Emergency Fund',
  type: 'savings',
  targetAmount: 10000,
  currentAmount: 2500,
  targetDate: new Date('2026-12-31T00:00:00.000Z'),
  description: 'Six months of expenses',
  linkedAccountIds: [],
  isActive: true,
  status: 'active',
  progress: 2500,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides
});

const addGoal = vi.fn();
const updateGoal = vi.fn();
const onClose = vi.fn();

const renderModal = (goal?: Goal) =>
  render(<GoalModal isOpen onClose={onClose} goal={goal} />);

/** The form's required fields, filled in as a person would. */
const fillRequiredFields = (): void => {
  fireEvent.change(screen.getByLabelText('Goal Name'), { target: { value: 'House Deposit' } });
  fireEvent.change(screen.getByLabelText('Current Amount (£)'), { target: { value: '2500.50' } });
  fireEvent.change(screen.getByLabelText('Target Amount (£)'), { target: { value: '20000' } });
  // The shared dd/mm/yyyy picker: typed UK, held as ISO.
  fireEvent.change(screen.getByLabelText('Target Date'), { target: { value: '30/06/2027' } });
};

const submit = (label: RegExp): void => {
  fireEvent.click(screen.getByRole('button', { name: label }));
};

describe('GoalModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __setAppContextValue({ accounts, addGoal, updateGoal });
  });

  afterEach(() => {
    cleanup();
    __resetAppContextValue();
  });

  describe('creating a goal', () => {
    it('saves exactly what was typed in', async () => {
      renderModal();
      fillRequiredFields();
      fireEvent.change(screen.getByLabelText('Goal Type'), { target: { value: 'investment' } });
      fireEvent.change(screen.getByLabelText('Description (Optional)'), {
        target: { value: 'Deposit for a first home' }
      });

      submit(/create goal/i);

      await waitFor(() => expect(addGoal).toHaveBeenCalledTimes(1));
      expect(addGoal).toHaveBeenCalledWith(expect.objectContaining({
        name: 'House Deposit',
        type: 'investment',
        currentAmount: 2500.5,
        targetAmount: 20000,
        description: 'Deposit for a first home',
        linkedAccountIds: [],
        isActive: true,
        status: 'active'
      }));
    });

    it('saves the target date as a Date, not the raw input string', async () => {
      renderModal();
      fillRequiredFields();

      submit(/create goal/i);

      await waitFor(() => expect(addGoal).toHaveBeenCalledTimes(1));
      const saved: unknown = addGoal.mock.calls[0][0];
      const targetDate = (saved as { targetDate: unknown }).targetDate;
      expect(targetDate).toBeInstanceOf(Date);
      expect((targetDate as Date).toISOString().slice(0, 10)).toBe('2027-06-30');
    });

    it('records linked accounts, and only offers the open ones', async () => {
      renderModal();
      fillRequiredFields();

      expect(screen.getByText('Natwest Current (current)')).toBeInTheDocument();
      expect(screen.getByText('Natwest Savings (savings)')).toBeInTheDocument();
      // A closed account cannot hold money towards a goal, so it is not offered.
      expect(screen.queryByText('Old ISA (savings)')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('checkbox', { name: /Natwest Savings/ }));
      submit(/create goal/i);

      await waitFor(() => expect(addGoal).toHaveBeenCalledTimes(1));
      expect(addGoal).toHaveBeenCalledWith(expect.objectContaining({
        linkedAccountIds: ['acc-savings']
      }));
    });

    it('sends status "paused" when the goal is created inactive', async () => {
      renderModal();
      fillRequiredFields();
      fireEvent.click(screen.getByRole('checkbox', { name: 'Active Goal' }));

      submit(/create goal/i);

      await waitFor(() => expect(addGoal).toHaveBeenCalledTimes(1));
      expect(addGoal).toHaveBeenCalledWith(expect.objectContaining({
        isActive: false,
        status: 'paused'
      }));
    });
  });

  describe('editing a goal', () => {
    it('sends an empty description when the user clears it', async () => {
      renderModal(existingGoal());

      fireEvent.change(screen.getByLabelText('Description (Optional)'), { target: { value: '' } });
      submit(/update goal/i);

      await waitFor(() => expect(updateGoal).toHaveBeenCalledTimes(1));
      // '' clears the stored text; undefined would mean "leave it alone", and
      // the description the user just deleted would come straight back.
      expect(updateGoal).toHaveBeenCalledWith('goal-1', expect.objectContaining({
        description: ''
      }));
    });

    it('sends an empty array when the last linked account is unticked', async () => {
      renderModal(existingGoal({ linkedAccountIds: ['acc-savings'] }));

      const savings = screen.getByRole('checkbox', { name: /Natwest Savings/ });
      expect(savings).toBeChecked();
      fireEvent.click(savings);
      submit(/update goal/i);

      await waitFor(() => expect(updateGoal).toHaveBeenCalledTimes(1));
      expect(updateGoal).toHaveBeenCalledWith('goal-1', expect.objectContaining({
        linkedAccountIds: []
      }));
    });

    it('keeps a completed goal completed when it is saved while active', async () => {
      renderModal(existingGoal({ status: 'completed', completedAt: '2026-07-01T00:00:00.000Z' }));

      submit(/update goal/i);

      await waitFor(() => expect(updateGoal).toHaveBeenCalledTimes(1));
      // The "Active goal" tick pauses and resumes; it does not un-achieve.
      expect(updateGoal).toHaveBeenCalledWith('goal-1', expect.objectContaining({
        status: 'completed'
      }));
    });

    it('pauses the goal when "Active Goal" is unticked', async () => {
      renderModal(existingGoal());

      fireEvent.click(screen.getByRole('checkbox', { name: 'Active Goal' }));
      submit(/update goal/i);

      await waitFor(() => expect(updateGoal).toHaveBeenCalledTimes(1));
      expect(updateGoal).toHaveBeenCalledWith('goal-1', expect.objectContaining({
        isActive: false,
        status: 'paused'
      }));
    });
  });

  describe('linked accounts drive the current amount', () => {
    it('disables the manual Current Amount field and explains why', () => {
      renderModal(existingGoal({ linkedAccountIds: ['acc-savings'] }));

      expect(screen.getByLabelText('Current Amount (£)')).toBeDisabled();
      expect(screen.getByText(/Tracked from the linked accounts below/)).toBeInTheDocument();
    });

    it('leaves the field editable for a goal with no links', () => {
      renderModal(existingGoal());

      expect(screen.getByLabelText('Current Amount (£)')).toBeEnabled();
      expect(screen.queryByText(/Tracked from the linked accounts below/)).not.toBeInTheDocument();
    });

    it('refuses negative amounts', () => {
      renderModal(existingGoal());

      const current = screen.getByLabelText('Current Amount (£)');
      const target = screen.getByLabelText('Target Amount (£)');

      fireEvent.change(current, { target: { value: '-50' } });
      fireEvent.change(target, { target: { value: '-50' } });

      expect(current).toHaveValue('50');
      expect(target).toHaveValue('50');
    });

    it('groups thousands in the amounts once the field is left', () => {
      renderModal(existingGoal());

      const target = screen.getByLabelText('Target Amount (£)');
      fireEvent.change(target, { target: { value: '1000000' } });
      fireEvent.blur(target);

      expect(target).toHaveValue('1,000,000.00');
    });
  });

  describe('links to accounts that no longer exist', () => {
    it('shows them as unavailable rather than dropping them silently', () => {
      renderModal(existingGoal({ linkedAccountIds: ['acc-savings', 'acc-deleted', 'acc-closed'] }));

      // Two: the deleted account and the closed one.
      expect(screen.getAllByText(/Account unavailable/)).toHaveLength(2);
    });

    it('removes one when asked, and the removal reaches the save', async () => {
      renderModal(existingGoal({ linkedAccountIds: ['acc-savings', 'acc-deleted'] }));

      fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
      expect(screen.queryByText(/Account unavailable/)).not.toBeInTheDocument();

      submit(/update goal/i);

      await waitFor(() => expect(updateGoal).toHaveBeenCalledTimes(1));
      expect(updateGoal).toHaveBeenCalledWith('goal-1', expect.objectContaining({
        linkedAccountIds: ['acc-savings']
      }));
    });

    it('keeps the unavailable link until the user removes it', async () => {
      renderModal(existingGoal({ linkedAccountIds: ['acc-deleted'] }));

      submit(/update goal/i);

      await waitFor(() => expect(updateGoal).toHaveBeenCalledTimes(1));
      expect(updateGoal).toHaveBeenCalledWith('goal-1', expect.objectContaining({
        linkedAccountIds: ['acc-deleted']
      }));
    });
  });

  describe('modal shell', () => {
    it('names itself for the job it is doing', () => {
      const { rerender } = renderModal();
      expect(screen.getByRole('dialog')).toHaveAccessibleName('Create New Goal');

      rerender(<GoalModal isOpen onClose={onClose} goal={existingGoal()} />);
      expect(screen.getByRole('dialog')).toHaveAccessibleName('Edit Goal');
    });

    it('renders nothing when closed', () => {
      render(<GoalModal isOpen={false} onClose={onClose} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes without saving when cancelled', () => {
      renderModal();
      fillRequiredFields();

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(addGoal).not.toHaveBeenCalled();
    });
  });
});
