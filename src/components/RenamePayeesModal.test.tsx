/**
 * Renaming payees from the keyboard.
 *
 * The register's grammar is: type the thing, press Enter. This dialog broke it
 * — the name box did nothing on Enter and the only way to commit was to reach
 * for the mouse. It is a real <form> now, so Enter presses the submit button
 * natively, and every condition that greys the button out stops Enter too.
 *
 * Every payee and figure here is invented.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RenamePayeesModal from './RenamePayeesModal';
import type { PayeeSummary } from '../utils/payeeCleanup';
import type { Transaction } from '../types';

const renameTransactionDescriptions = vi.fn();
const showSuccess = vi.fn();
const showError = vi.fn();

/** Two references for one shop, five rows between them. */
const REGISTER: Transaction[] = [
  { id: 't1', description: 'CORNER SHOP*A1', date: new Date('2026-03-01'), amount: -4.5, category: 'cat-1', accountId: 'acc-1', type: 'expense' },
  { id: 't2', description: 'CORNER SHOP*A1', date: new Date('2026-03-02'), amount: -6.25, category: 'cat-1', accountId: 'acc-1', type: 'expense' },
  { id: 't3', description: 'CORNER SHOP*B2', date: new Date('2026-03-03'), amount: -1.8, category: 'cat-1', accountId: 'acc-1', type: 'expense' },
  { id: 't4', description: 'SOMETHING ELSE', date: new Date('2026-03-04'), amount: -9, category: 'cat-1', accountId: 'acc-1', type: 'expense' },
];

vi.mock('../contexts/AppContextSupabase', () => ({
  useApp: () => ({
    transactions: REGISTER,
    renameTransactionDescriptions,
  }),
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess, showError }),
}));

const payee = (description: string, count: number): PayeeSummary => ({
  description,
  count,
  total: 10,
  earliest: new Date('2026-03-01'),
  latest: new Date('2026-03-03'),
  merchantKey: 'CORNER SHOP',
});

const SELECTED = [payee('CORNER SHOP*A1', 2), payee('CORNER SHOP*B2', 1)];

const renderModal = (onRenamed = vi.fn()) =>
  render(
    <RenamePayeesModal isOpen onClose={vi.fn()} selected={SELECTED} onRenamed={onRenamed} />
  );

const nameBox = (): HTMLElement => screen.getByLabelText('New payee name');

beforeEach(() => {
  vi.clearAllMocks();
  renameTransactionDescriptions.mockResolvedValue(3);
});

describe('RenamePayeesModal — Enter commits the rename', () => {
  it('renames on Enter, exactly once, with the trimmed name', async () => {
    const user = userEvent.setup();
    renderModal();

    // The cursor is in the box the instant the dialog opens, so typing can
    // start immediately. These tests used to sleep 60ms first: the dialog took
    // focus on a timer that fired mid-word and sent the rest of the keystrokes,
    // Enter included, to the panel instead of the box.
    expect(nameBox()).toHaveFocus();

    // Surrounding spaces on purpose: what is written is the trimmed name.
    await user.type(nameBox(), '  Corner Shop  {Enter}');

    await waitFor(() => {
      expect(renameTransactionDescriptions).toHaveBeenCalledTimes(1);
    });
    expect(renameTransactionDescriptions).toHaveBeenCalledWith(
      ['t1', 't2', 't3'],
      'Corner Shop',
      expect.any(Function)
    );
  });

  it('does nothing on Enter when the box is empty', async () => {
    const user = userEvent.setup();
    renderModal();

    nameBox().focus();
    await user.keyboard('{Enter}');

    expect(renameTransactionDescriptions).not.toHaveBeenCalled();
  });

  it('does nothing on Enter when the box holds only spaces', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(nameBox(), '   {Enter}');

    expect(renameTransactionDescriptions).not.toHaveBeenCalled();
  });

  /**
   * The guard belongs in the submit handler, not only on the button: a
   * disabled button is unreachable by mouse, but a form can still be submitted
   * around it.
   */
  it('does nothing when the form is submitted with an empty box', () => {
    renderModal();

    fireEvent.submit(nameBox().closest('form') as HTMLFormElement);

    expect(renameTransactionDescriptions).not.toHaveBeenCalled();
  });

  /**
   * A disabled button cannot be clicked twice, but Enter does not ask the
   * button's permission — so the in-flight guard has to be in the submit
   * handler as well.
   */
  it('does not start a second rename while one is running', async () => {
    const user = userEvent.setup();
    let release: (() => void) | null = null;
    renameTransactionDescriptions.mockImplementationOnce(
      () => new Promise<number>(resolve => { release = () => resolve(3); })
    );
    renderModal();

    await user.type(nameBox(), 'Corner Shop{Enter}');
    await waitFor(() => {
      expect(screen.getByText('Renaming…')).toBeInTheDocument();
    });

    // Straight at the form, because that is the only way in while the button
    // is disabled — and the guard has to hold there too.
    fireEvent.submit(nameBox().closest('form') as HTMLFormElement);

    expect(renameTransactionDescriptions).toHaveBeenCalledTimes(1);
    release?.();
    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalled();
    });
  });

  it('still renames from the button, and reports what changed', async () => {
    const user = userEvent.setup();
    const onRenamed = vi.fn();
    renderModal(onRenamed);

    await user.type(nameBox(), 'Corner Shop');
    await user.click(screen.getByRole('button', { name: 'Rename 3 transactions' }));

    await waitFor(() => {
      expect(onRenamed).toHaveBeenCalledWith('Corner Shop', 3);
    });
    expect(renameTransactionDescriptions).toHaveBeenCalledTimes(1);
  });

  it('commits through a real submit button, so the browser does the work', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(nameBox(), 'Corner Shop');

    const button = screen.getByRole('button', { name: 'Rename 3 transactions' });
    expect(button).toHaveAttribute('type', 'submit');
    expect(button.closest('form')).toBe(nameBox().closest('form'));
  });
});
