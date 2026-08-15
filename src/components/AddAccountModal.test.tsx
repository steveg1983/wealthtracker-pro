import { render, screen, fireEvent, waitFor, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AddAccountModal from './AddAccountModal';
import { PreferencesProvider } from '../contexts/PreferencesContext';
import { __resetAppContextValue, __setAppContextValue } from '../test/mocks/AppContextSupabase';
import type { Account } from '../types';

type NewAccountPayload = Omit<Account, 'id'> & { initialBalance?: number };
type AddAccountModalProps = React.ComponentProps<typeof AddAccountModal>;

// Optional parameter on purpose: the context's own mock types addAccount as a
// no-arg callback, and a required parameter would not fit it.
const addAccount = vi.fn((account?: NewAccountPayload) =>
  Promise.resolve({ ...account, id: 'new-account' })
);

const lastPayload = (): NewAccountPayload | undefined => addAccount.mock.calls[0]?.[0];

const renderModal = (props: Partial<AddAccountModalProps> = {}) =>
  render(
    <PreferencesProvider>
      <AddAccountModal isOpen onClose={vi.fn()} {...props} />
    </PreferencesProvider>
  );

/**
 * Fields are addressed by accessible role + name throughout, never by
 * placeholder. That is itself an assertion: a label that loses its `htmlFor`,
 * or a control that loses its `id`, has no accessible name and these queries
 * fail — whereas a placeholder query would keep passing while a screen reader
 * announced the field as unlabelled.
 *
 * The balance is a MoneyInput, which renders `type="text"` + `inputMode="decimal"`,
 * so it is a `textbox` rather than a `spinbutton`.
 */
const nameField = () => screen.getByRole('textbox', { name: /Account Name/ });
const balanceField = () => screen.getByRole('textbox', { name: /Current Balance/ });
const submitButton = () => screen.getByRole('button', { name: 'Add Account' });

/** Fill in the name and balance the form requires, then choose Credit Card. */
const startACard = () => {
  fireEvent.change(nameField(), { target: { value: 'Amex' } });
  fireEvent.change(balanceField(), { target: { value: '-250' } });
  fireEvent.click(screen.getByRole('button', { name: /Credit Card/ }));
};

beforeEach(() => {
  addAccount.mockClear();
  __setAppContextValue({ addAccount });
});

afterEach(() => {
  __resetAppContextValue();
});

describe('AddAccountModal — a card is created holding its last 4 digits only', () => {
  it('stores the LAST four of a pasted card number, not the first', async () => {
    renderModal();
    startACard();

    fireEvent.change(screen.getByRole('textbox', { name: /Card Number/ }), {
      target: { value: '4929 1234 5678 9012' }
    });
    fireEvent.click(submitButton());

    await waitFor(() => expect(addAccount).toHaveBeenCalledTimes(1));
    expect(lastPayload()?.accountNumber).toBe('9012');
  });

  it('keeps the whole number in the field so the right four can be taken', () => {
    renderModal();
    startACard();

    const field = screen.getByRole('textbox', { name: /Card Number/ });
    fireEvent.change(field, { target: { value: '4929123456789012' } });

    // Capping the input would have left '4929' — the wrong four.
    expect(field).toHaveValue('4929123456789012');
  });

  it('tells the user what will be stored rather than offering them a choice', () => {
    renderModal();
    startACard();

    fireEvent.change(screen.getByRole('textbox', { name: /Card Number/ }), {
      target: { value: '4929123456789012' }
    });

    expect(screen.getByRole('status')).toHaveTextContent(
      'Saving will store 9012 and discard the rest.'
    );
  });

  it('leaves a bank account number whole', async () => {
    renderModal();

    fireEvent.change(nameField(), { target: { value: 'HSBC Current' } });
    fireEvent.change(balanceField(), { target: { value: '1000' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Bank account number' }), {
      target: { value: '12345678' }
    });
    fireEvent.click(submitButton());

    await waitFor(() => expect(addAccount).toHaveBeenCalledTimes(1));
    expect(lastPayload()?.accountNumber).toBe('12345678');
  });

  it('stores nothing at all when the card number is left blank', async () => {
    renderModal();
    startACard();

    fireEvent.click(submitButton());

    await waitFor(() => expect(addAccount).toHaveBeenCalledTimes(1));
    expect(lastPayload()?.accountNumber).toBeUndefined();
  });
});

describe('AddAccountModal — every field is announced by its visible label', () => {
  /** Asserts the control's accessible name comes from a visible <label for=...>. */
  const expectVisibleLabel = (control: HTMLElement, text: RegExp): void => {
    expect(control.id).not.toBe('');
    const label = document.querySelector<HTMLLabelElement>(`label[for="${control.id}"]`);
    expect(label).not.toBeNull();
    expect(label?.textContent ?? '').toMatch(text);
  };

  it('exposes every field by role and accessible name', () => {
    renderModal();

    expect(nameField()).toBeInTheDocument();
    expect(balanceField()).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Currency/ })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Financial Institution/ })).toBeInTheDocument();
    // These two carry an explicit aria-label, which wins over the visible
    // label, so they are named by it rather than by the label text.
    expect(screen.getByRole('textbox', { name: 'Bank sort code' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Bank account number' })).toBeInTheDocument();
  });

  it('derives each accessible name from a visible label, not an aria-label', () => {
    renderModal();

    expectVisibleLabel(nameField(), /Account Name/);
    expectVisibleLabel(balanceField(), /Current Balance/);
    expectVisibleLabel(screen.getByRole('combobox', { name: /Currency/ }), /Currency/);
    expectVisibleLabel(screen.getByRole('textbox', { name: /Financial Institution/ }), /Financial Institution/);
  });

  /** Every currently-mounted control whose aria-label hides its visible label. */
  const labelInNameViolations = (): string[] => {
    const controls = Array.from(
      screen.getByRole('dialog').querySelectorAll<HTMLElement>('input, select, textarea')
    );
    return controls.flatMap((control) => {
      const ariaLabel = control.getAttribute('aria-label');
      if (ariaLabel === null || control.id === '') return [];
      const label = document.querySelector<HTMLLabelElement>(`label[for="${control.id}"]`);
      const visible = (label?.textContent ?? '').replace(/\(Optional\)/i, '').trim();
      if (visible === '') return [];
      return ariaLabel.toLowerCase().includes(visible.toLowerCase())
        ? []
        : [`visible "${visible}" is not contained in accessible name "${ariaLabel}"`];
    });
  };

  // WCAG 2.5.3: an aria-label replaces the visible label as the accessible
  // name, so speaking the visible label must still reach the field. Checked in
  // both states — the card fields are not mounted for a bank account, so a
  // single default render would miss them entirely.
  it('never overrides a visible label with an aria-label that omits it', () => {
    renderModal();
    expect(labelInNameViolations()).toEqual([]);
  });

  it('never overrides a visible label once the card fields are showing', () => {
    renderModal();
    startACard();
    expect(labelInNameViolations()).toEqual([]);
  });

  it('lets the card number field be reached by its visible label', () => {
    renderModal();
    startACard();

    // Was named "Last four digits of the card number", which does not contain
    // the visible "Card Number — last 4 digits only".
    expectVisibleLabel(screen.getByRole('textbox', { name: /Card Number/ }), /Card Number/);
  });

  it('leaves no form control relying on placeholder text for its name', () => {
    renderModal();

    const controls = Array.from(
      screen.getByRole('dialog').querySelectorAll<HTMLElement>('input, select, textarea')
    );
    expect(controls.length).toBeGreaterThan(0);

    const unnamed = controls.filter((control) => {
      const labelled = control.id !== '' && document.querySelector(`label[for="${control.id}"]`) !== null;
      return !labelled && !control.getAttribute('aria-label') && !control.getAttribute('aria-labelledby');
    });
    expect(unnamed.map((control) => control.outerHTML)).toEqual([]);
  });
});

describe('AddAccountModal — the account type buttons are a labelled group', () => {
  it('labels the group and reports the selected type', () => {
    renderModal();

    const group = screen.getByRole('group', { name: /Account Type/ });
    expect(within(group).getByRole('button', { name: /Current Account/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: /Savings Account/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('moves the pressed state when another type is chosen', () => {
    renderModal();

    const group = screen.getByRole('group', { name: /Account Type/ });
    fireEvent.click(within(group).getByRole('button', { name: /Savings Account/ }));

    expect(within(group).getByRole('button', { name: /Savings Account/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: /Current Account/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('swaps the bank fields for card fields on a credit card', () => {
    renderModal();
    startACard();

    expect(screen.queryByRole('textbox', { name: 'Bank sort code' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Card Number/ })).toBeInTheDocument();
  });
});

describe('AddAccountModal — submission', () => {
  it('submits values entered through role-based queries', async () => {
    const onAccountCreated = vi.fn();
    renderModal({ onAccountCreated });

    fireEvent.change(nameField(), { target: { value: 'Everyday Current' } });
    fireEvent.change(balanceField(), { target: { value: '250.75' } });
    fireEvent.change(screen.getByRole('combobox', { name: /Currency/ }), { target: { value: 'USD' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Financial Institution/ }), {
      target: { value: 'HSBC' }
    });

    fireEvent.click(submitButton());

    await waitFor(() => expect(addAccount).toHaveBeenCalledTimes(1));
    expect(lastPayload()).toMatchObject({
      name: 'Everyday Current',
      type: 'current',
      balance: 250.75,
      currency: 'USD',
      institution: 'HSBC'
    });
    await waitFor(() => expect(onAccountCreated).toHaveBeenCalledWith('new-account'));
  });

  it('strips sort code formatting before saving', async () => {
    renderModal();

    fireEvent.change(nameField(), { target: { value: 'Joint Savings' } });
    fireEvent.change(balanceField(), { target: { value: '10' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Bank sort code' }), {
      target: { value: '123456' }
    });

    expect(screen.getByRole('textbox', { name: 'Bank sort code' })).toHaveValue('12-34-56');

    fireEvent.click(submitButton());

    await waitFor(() => expect(addAccount).toHaveBeenCalledTimes(1));
    expect(lastPayload()?.sortCode).toBe('123456');
  });

  /*
   * This asserted the OPPOSITE until 15 August: the balance was `required`, so
   * native constraint validation blocked the submit and a blank box was
   * refused.
   *
   * Claude Design overturned it, and the reason is the kind a test cannot see:
   * an account opened today with nothing in it HAS a balance, and it is £0.00.
   * Marking the field required made a person type a zero to satisfy a
   * validator. Blank is not a missing answer here; it is the commonest one.
   */
  it('saves a blank balance as zero, because zero is a real answer', async () => {
    renderModal();

    fireEvent.change(nameField(), { target: { value: 'No Balance' } });
    fireEvent.click(submitButton());

    await waitFor(() => expect(addAccount).toHaveBeenCalled());
    expect(addAccount.mock.calls[0][0]).toMatchObject({ balance: 0 });
  });

  it('never lets letters into the balance in the first place', () => {
    /*
     * Written first as "still refuses something typed that is not a number",
     * asserting the submit was blocked — and it failed, because the account
     * saved. The money input FILTERS as you type, so "abc" never reaches
     * state: the field stays empty, empty now means zero, and zero saves.
     *
     * That is the better behaviour and the assertion was wrong about it. The
     * validator's `isNaN` arm is still right to exist — it guards the state,
     * not the keyboard — but the case cannot be reached through the UI, and a
     * test claiming otherwise would be describing a modal that does not exist.
     */
    renderModal();

    fireEvent.change(balanceField(), { target: { value: 'abc' } });

    expect((balanceField() as HTMLInputElement).value).not.toContain('a');
  });
});
