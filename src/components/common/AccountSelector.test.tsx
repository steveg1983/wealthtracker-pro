import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import AccountSelector from './AccountSelector';

/**
 * The account picker, pinned: the Accounts page's nested bands (type section →
 * institution sub-band → rows, "Other Accounts" last in both dimensions), the
 * type-to-filter the owner asked for, and the keyboard combobox contract it
 * shares with CategorySelector.
 */

interface TestAccount {
  id: string;
  name: string;
  type: string;
  institution?: string;
  sortCode?: string;
  balance?: number;
  parentAccountId?: string | null;
}

const PLACEHOLDER = 'Search or select account…';

const accounts: TestAccount[] = [
  { id: 'c1', name: 'Natwest Current Account', type: 'current', institution: 'Natwest' },
  { id: 'c2', name: 'Amex Everyday', type: 'current', institution: 'American Express' },
  { id: 'c3', name: 'Cash Wallet', type: 'current' },
  { id: 's1', name: 'Natwest Savings', type: 'savings', institution: 'Natwest' },
  { id: 's2', name: 'Alpha ISA', type: 'savings', institution: 'natwest' },
  { id: 'cc1', name: 'Barclaycard', type: 'credit', institution: 'Barclays' },
  { id: 'x1', name: 'Hoverboard Fund', type: 'hoverboard' },
];

afterEach(cleanup);

function renderPicker(props: Partial<React.ComponentProps<typeof AccountSelector<TestAccount>>> = {}) {
  const onAccountChange = vi.fn();
  const view = render(
    <AccountSelector
      accounts={accounts}
      selectedAccountId=""
      onAccountChange={onAccountChange}
      {...props}
    />
  );
  return { onAccountChange, ...view };
}

/** Open the picker by clicking its collapsed trigger. */
function open(placeholder = PLACEHOLDER): void {
  fireEvent.click(screen.getByText(placeholder));
}

const listbox = (): HTMLElement => screen.getByRole('listbox');

/** Every band heading in render order — type sections and institution sub-bands. */
const headings = (): string[] =>
  Array.from(listbox().querySelectorAll('[aria-hidden="true"]')).map(el => el.textContent ?? '');

/** Every selectable row's text, in render order. */
const optionTexts = (): string[] =>
  screen.getAllByRole('option').map(option => option.textContent ?? '');

describe('AccountSelector', () => {
  describe('nested bands', () => {
    it('bands by type in the Accounts page order, catch-all last', () => {
      renderPicker();
      open();

      // The TYPE sections are the listbox's own children; institution
      // sub-bands are groups too, but they hang inside one of these.
      const typeSections = Array.from(listbox().children)
        .filter(child => child.getAttribute('role') === 'group')
        .map(child => child.getAttribute('aria-label'));

      expect(typeSections).toEqual([
        'Current Accounts', 'Savings Accounts', 'Credit Cards', 'Other Accounts',
      ]);
    });

    it('nests institution sub-bands inside each type section, unfiled last', () => {
      renderPicker();
      open();

      expect(headings()).toEqual([
        'Current Accounts',
        'American Express',
        'Natwest',
        'Other Accounts',      // the unfiled sub-band inside Current Accounts
        'Savings Accounts',
        'Natwest',
        'Credit Cards',
        'Barclays',
        'Other Accounts',      // the catch-all TYPE section
      ]);
    });

    it('resolves one spelling for an institution typed two ways', () => {
      renderPicker();
      open();

      // 'Natwest' and 'natwest' are ONE sub-band, headed as first seen.
      const savings = screen.getByRole('group', { name: 'Savings Accounts' });
      expect(within(savings).getAllByRole('group').map(g => g.getAttribute('aria-label')))
        .toEqual(['Natwest']);
      expect(within(savings).getAllByRole('option').map(o => o.textContent))
        .toEqual(['Alpha ISA', 'Natwest Savings']);
    });

    it('drops the sub-heading when a section’s only sub-band is the unfiled catch-all', () => {
      renderPicker({
        accounts: [
          { id: 'a', name: 'Zebra Current', type: 'current' },
          { id: 'b', name: 'Alpha Current', type: 'current' },
        ],
      });
      open();

      // One band, and it says nothing the section above has not said.
      expect(headings()).toEqual(['Current Accounts']);
      expect(optionTexts()).toEqual(['Alpha Current', 'Zebra Current']);
    });

    it('sorts alphabetically inside a sub-band, case-insensitively', () => {
      renderPicker({
        accounts: [
          { id: 'a', name: 'zebra', type: 'current', institution: 'Bank' },
          { id: 'b', name: 'Alpha', type: 'current', institution: 'Bank' },
          { id: 'c', name: 'beta', type: 'current', institution: 'Bank' },
        ],
      });
      open();

      expect(optionTexts()).toEqual(['Alpha', 'beta', 'zebra']);
    });
  });

  describe('search', () => {
    it('filters by account name', () => {
      renderPicker();
      open();
      fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'barclayc' } });

      expect(optionTexts()).toEqual(['Barclaycard']);
    });

    it('filters by institution, so a bank name finds its accounts', () => {
      renderPicker();
      open();
      fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'natwest' } });

      // Alpha ISA is named nothing like "Natwest" — it is here because its
      // institution is, which is the whole point of searching the bank too.
      expect(optionTexts()).toEqual([
        'Natwest Current Account', 'Alpha ISA', 'Natwest Savings',
      ]);
    });

    it('keeps a band only while it still holds a hit', () => {
      renderPicker();
      open();
      fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'barclayc' } });

      expect(headings()).toEqual(['Credit Cards', 'Barclays']);
    });

    it('finds an account by sort code, with or without its dashes', () => {
      renderPicker({
        accounts: [
          { id: 'a', name: 'Premier', type: 'current', institution: 'HSBC', sortCode: '40-18-41' },
          { id: 'b', name: 'Other', type: 'current', institution: 'HSBC', sortCode: '20-00-00' },
        ],
      });
      open();
      fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: '401841' } });

      expect(optionTexts()).toEqual(['Premier']);
    });

    it('says so when nothing matches', () => {
      renderPicker();
      open();
      fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'zzzz' } });

      expect(screen.queryAllByRole('option')).toHaveLength(0);
      expect(screen.getByText('No accounts found')).toBeInTheDocument();
    });

    it('says so when there is nothing to choose from at all', () => {
      renderPicker({ accounts: [] });
      open();

      expect(screen.getByText('No accounts available')).toBeInTheDocument();
    });
  });

  describe('choosing', () => {
    it('reports the chosen account id and closes', () => {
      const { onAccountChange } = renderPicker();
      open();
      fireEvent.click(screen.getByText('Barclaycard'));

      expect(onAccountChange).toHaveBeenCalledWith('cc1');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('shows the selected account on the closed trigger', () => {
      renderPicker({ selectedAccountId: 'cc1' });

      expect(screen.getByRole('combobox')).toHaveTextContent('Barclaycard');
    });

    it('prints the caller’s own wording when it passes a formatter', () => {
      renderPicker({
        selectedAccountId: 'cc1',
        formatLabel: (acc) => `${acc.name} [${acc.type}]`,
      });

      expect(screen.getByRole('combobox')).toHaveTextContent('Barclaycard [credit]');
      open('Barclaycard [credit]');
      expect(optionTexts()).toContain('Natwest Current Account [current]');
    });

    it('leaves out excluded ids — a transfer cannot target its own account', () => {
      renderPicker({ excludeIds: ['cc1', 'c1'] });
      open();

      expect(optionTexts()).not.toContain('Barclaycard');
      expect(optionTexts()).not.toContain('Natwest Current Account');
      expect(optionTexts()).toContain('Natwest Savings');
    });
  });

  describe('the clear row', () => {
    it('is absent unless the caller offers one', () => {
      renderPicker();
      open();

      expect(screen.queryByText('Keep in current account')).not.toBeInTheDocument();
    });

    it('reports no account at all when chosen', () => {
      const { onAccountChange } = renderPicker({
        clearOption: 'Keep in current account',
        selectedAccountId: 'cc1',
      });
      open('Barclaycard');
      fireEvent.click(screen.getByText('Keep in current account'));

      expect(onAccountChange).toHaveBeenCalledWith('');
    });

    it('lets Delete clear the selection from the closed picker', () => {
      const { onAccountChange } = renderPicker({
        clearOption: 'Keep in current account',
        selectedAccountId: 'cc1',
      });
      fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Delete' });

      expect(onAccountChange).toHaveBeenCalledWith('');
    });

    it('does not clear where an account is required', () => {
      const { onAccountChange } = renderPicker({ selectedAccountId: 'cc1' });
      fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Delete' });

      expect(onAccountChange).not.toHaveBeenCalled();
    });
  });

  describe('the create row', () => {
    it('reports its own sentinel rather than an account id', () => {
      const { onAccountChange } = renderPicker({
        createOption: { label: 'Create New Account', value: '__create_new__' },
      });
      open();
      fireEvent.click(screen.getByText('Create New Account'));

      expect(onAccountChange).toHaveBeenCalledWith('__create_new__');
    });
  });

  describe('keyboard', () => {
    it('is focusable and opens with Enter, Space or an arrow', () => {
      renderPicker({ ariaLabel: 'Transfer destination account' });
      const trigger = screen.getByRole('combobox', { name: 'Transfer destination account' });

      expect(trigger).toHaveAttribute('tabindex', '0');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');

      fireEvent.keyDown(trigger, { key: 'ArrowDown' });

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    /** The same manners its sibling CategorySelector has: typing opens it. */
    it('opens on a typed character, already filtering by it', () => {
      renderPicker();
      const trigger = screen.getByRole('combobox', { name: 'Account' });

      fireEvent.keyDown(trigger, { key: 'b' });

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveValue('b');
      // The picker's own search rules apply from that first character —
      // substring, not just initial letter (Hover*b*oard Fund answers to "b").
      expect(optionTexts()).toEqual(['Barclaycard', 'Hoverboard Fund']);
    });

    it('opens on Space with an EMPTY search rather than a leading blank', () => {
      renderPicker();
      fireEvent.keyDown(screen.getByRole('combobox', { name: 'Account' }), { key: ' ' });

      expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveValue('');
      expect(optionTexts().length).toBe(accounts.length);
    });

    it('hands Enter to the surrounding form when asked to pass it through', () => {
      renderPicker({ closedEnter: 'pass-through' });
      const trigger = screen.getByRole('combobox', { name: 'Account' });

      expect(fireEvent.keyDown(trigger, { key: 'Enter' })).toBe(true);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');

      fireEvent.keyDown(trigger, { key: ' ' });
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('walks the flattened visible rows with the arrows and picks with Enter', () => {
      const { onAccountChange } = renderPicker();
      open();
      const input = screen.getByPlaceholderText(PLACEHOLDER);

      // Render order: Current > American Express > Amex Everyday, then Natwest…
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onAccountChange).toHaveBeenCalledWith('c1');
    });

    it('walks across a band boundary rather than stopping at it', () => {
      const { onAccountChange } = renderPicker();
      open();
      const input = screen.getByPlaceholderText(PLACEHOLDER);

      // Three rows in Current Accounts, so the fourth step lands in Savings.
      for (let i = 0; i < 4; i += 1) fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onAccountChange).toHaveBeenCalledWith('s2'); // Alpha ISA
    });

    it('walks back up', () => {
      const { onAccountChange } = renderPicker();
      open();
      const input = screen.getByPlaceholderText(PLACEHOLDER);

      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onAccountChange).toHaveBeenCalledWith('c2'); // Amex Everyday
    });

    it('takes the sole match on Enter without an explicit highlight', () => {
      const { onAccountChange } = renderPicker();
      open();
      const input = screen.getByPlaceholderText(PLACEHOLDER);
      fireEvent.change(input, { target: { value: 'barclayc' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onAccountChange).toHaveBeenCalledWith('cc1');
    });

    it('never takes the clear or create row as that sole match', () => {
      const { onAccountChange } = renderPicker({
        clearOption: "Skip (don't link)",
        createOption: { label: 'Create New Account', value: '__create_new__' },
      });
      open();
      const input = screen.getByPlaceholderText(PLACEHOLDER);
      fireEvent.change(input, { target: { value: 'zzzz' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onAccountChange).not.toHaveBeenCalled();
    });

    it('closes on Escape and hands focus back to the trigger', () => {
      renderPicker();
      open();
      fireEvent.keyDown(screen.getByPlaceholderText(PLACEHOLDER), { key: 'Escape' });

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(screen.getByRole('combobox')).toHaveFocus();
    });

    it('closes on Tab so focus moves on without the list hanging open', () => {
      renderPicker();
      open();
      fireEvent.keyDown(screen.getByPlaceholderText(PLACEHOLDER), { key: 'Tab' });

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('points aria-activedescendant at the highlighted row', () => {
      renderPicker();
      open();
      const input = screen.getByPlaceholderText(PLACEHOLDER);
      fireEvent.keyDown(input, { key: 'ArrowDown' });

      const active = input.getAttribute('aria-activedescendant');
      expect(active).toBeTruthy();
      expect(document.getElementById(active ?? '')).toHaveTextContent('Amex Everyday');
    });
  });

  describe('accessibility plumbing', () => {
    it('names the control and its listbox', () => {
      renderPicker({ ariaLabel: 'Move to account' });
      open();

      expect(screen.getByRole('combobox', { name: 'Move to account' })).toBeInTheDocument();
      expect(screen.getByRole('listbox', { name: 'Move to account' })).toBeInTheDocument();
    });

    it('carries the call site’s required/invalid/described-by state', () => {
      renderPicker({ required: true, ariaInvalid: true, ariaDescribedBy: 'account-error' });

      const trigger = screen.getByRole('combobox');
      expect(trigger).toHaveAttribute('aria-required', 'true');
      expect(trigger).toHaveAttribute('aria-invalid', 'true');
      expect(trigger).toHaveAttribute('aria-describedby', 'account-error');
    });

    it('marks the chosen row selected', () => {
      renderPicker({ selectedAccountId: 'cc1' });
      open('Barclaycard');

      expect(screen.getByRole('option', { name: 'Barclaycard' })).toHaveAttribute('aria-selected', 'true');
    });

    it('reports blur only when focus leaves the whole picker', () => {
      const onBlur = vi.fn();
      renderPicker({ onBlur });
      const trigger = screen.getByRole('combobox');

      // Trigger → the search box inside it is not "finished with the field".
      fireEvent.click(trigger);
      fireEvent.focusOut(screen.getByPlaceholderText(PLACEHOLDER), { relatedTarget: trigger });
      expect(onBlur).not.toHaveBeenCalled();

      fireEvent.focusOut(screen.getByPlaceholderText(PLACEHOLDER), { relatedTarget: document.body });
      expect(onBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe('portal mode', () => {
    it('renders the list on document.body, outside a clipping modal body', () => {
      const { container } = render(
        <div style={{ overflowY: 'auto' }}>
          <AccountSelector
            accounts={accounts}
            selectedAccountId=""
            onAccountChange={vi.fn()}
            usePortal
          />
        </div>
      );
      fireEvent.click(screen.getByText(PLACEHOLDER));

      const list = screen.getByRole('listbox');
      expect(container.contains(list)).toBe(false);
      expect(document.body.contains(list)).toBe(true);
      // Still the same banded list, wherever it is drawn.
      expect(screen.getByRole('group', { name: 'Credit Cards' })).toBeInTheDocument();
    });

    it('keeps the list in flow when the caller does not ask for a portal', () => {
      const { container } = renderPicker();
      open();

      expect(container.contains(screen.getByRole('listbox'))).toBe(true);
    });
  });
});

/**
 * ─ A LINKED CASH SLEEVE IS FILED WHERE ITS INVESTMENT LIVES ────────────────
 *
 * Reported from the transfer picker: "(Beards) - Wiseville Investments" and
 * "Coutts - Investment P…" are the cash sleeves of investment accounts, and
 * both were listed under CURRENT ACCOUNTS — while the Accounts page shows them
 * nested inside their investment parent.
 *
 * The owner's rule is the page's own behaviour written down: "linked, it sits
 * within the investment account it is linked to; unlink, and it moves up to
 * current accounts." This file's header already promised that this picker "and
 * that page can never disagree about where an account belongs" — so this is
 * that promise being kept, not a new idea.
 */
describe('a cash account linked to an investment', () => {
  const sleeve: TestAccount = {
    id: 'cash-linked',
    name: 'Wiseville Cash',
    type: 'current',
    institution: 'Beards',
    parentAccountId: 'inv1',
  };
  const investment: TestAccount = {
    id: 'inv1',
    name: 'Wiseville Investments',
    type: 'investment',
    institution: 'Beards',
  };
  const loose: TestAccount = {
    id: 'cash-loose',
    name: 'Wiseville Spare Cash',
    type: 'current',
    institution: 'Beards',
  };

  const pickerFor = (list: TestAccount[], onAccountChange = vi.fn()) => {
    render(
      <AccountSelector
        accounts={list}
        selectedAccountId=""
        onAccountChange={onAccountChange}
        placeholder={PLACEHOLDER}
        formatLabel={(account) => `${account.name} (${account.type})`}
      />
    );
    open();
    return onAccountChange;
  };

  it('files the sleeve under Investments, leaving no Current Accounts section', () => {
    /*
     * The sharp version of the rule: the ONLY `type: current` account here is
     * the sleeve, so if it is filed correctly there is no current-accounts
     * section left to draw. Asserting the absence is what makes this fail on
     * the old behaviour rather than merely on a reordering.
     */
    pickerFor([sleeve, investment]);

    expect(headings()).not.toContain('Current Accounts');
    expect(headings()).toContain('Investments');
    expect(screen.getByText('Wiseville Cash (current)')).toBeInTheDocument();
  });

  it('keeps its own name and type on the row, and reports its own id', () => {
    // Sectioning borrows the parent's type; the OPTION stays the real account,
    // or the picker would hand back an investment where cash was chosen.
    const onAccountChange = pickerFor([sleeve, investment]);
    fireEvent.click(screen.getByText('Wiseville Cash (current)'));

    expect(onAccountChange).toHaveBeenCalledWith('cash-linked');
  });

  it('leaves an UNLINKED cash account under Current Accounts', () => {
    // The rule keys on the LINK, not on the name or the institution — which
    // this sibling shares with the sleeve, and is why it is the useful control.
    pickerFor([sleeve, investment, loose]);

    expect(headings()).toContain('Current Accounts');
    expect(headings()).toContain('Investments');
    expect(screen.getByText('Wiseville Spare Cash (current)')).toBeInTheDocument();
  });
});
