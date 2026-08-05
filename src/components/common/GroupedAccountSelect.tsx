import { useMemo, type SelectHTMLAttributes } from 'react';
import { groupAccountsBySection, type GroupableAccount } from '../../utils/accountGrouping';

/**
 * The one account dropdown. Every place that asks "which account?" bands its
 * options into the Accounts page's own sections (Current, Savings, Credit
 * Cards…), alphabetical inside each, empty sections omitted — because a flat
 * list of seventy accounts in insertion order is not a picker, it is a search.
 *
 * The sections come from `accountGrouping`, so a dropdown and the Accounts
 * page can never disagree about where an account belongs.
 */

/** What an option needs: an id to carry as the value, plus what groups it. */
export interface SelectableAccount extends GroupableAccount {
  id: string;
}

/**
 * Everything a caller can still hand the underlying <select>. Grouping owns
 * the children; value/onChange are narrowed to the account id; `multiple` is
 * excluded because this component is single-select — a multi-select list can
 * still reuse the grouping via <GroupedAccountOptions>.
 */
type PassThroughSelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'value' | 'defaultValue' | 'onChange' | 'children' | 'multiple'
>;

interface GroupedAccountOptionsProps<T extends SelectableAccount> {
  accounts: readonly T[];
  /** Option text. Defaults to the account name; call sites that print a
      balance or a type pass their own so their wording is unchanged. */
  formatLabel?: (account: T) => string;
}

/** The grouped <optgroup>/<option> block, for a select this component can't own. */
export function GroupedAccountOptions<T extends SelectableAccount>({
  accounts,
  formatLabel
}: GroupedAccountOptionsProps<T>): React.JSX.Element {
  const sections = useMemo(() => groupAccountsBySection(accounts), [accounts]);
  return (
    <>
      {sections.map(section => (
        <optgroup key={section.label} label={section.title}>
          {section.accounts.map(account => (
            <option key={account.id} value={account.id}>
              {formatLabel ? formatLabel(account) : account.name}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

export interface GroupedAccountSelectProps<T extends SelectableAccount>
  extends PassThroughSelectProps {
  /** Already filtered by the caller — this component only orders and bands. */
  accounts: readonly T[];
  /** The selected account id, or '' for the placeholder. */
  value: string;
  onChange: (accountId: string) => void;
  /** Leading empty-value option ("Select account"). Omitted when unset. */
  placeholder?: string;
  formatLabel?: (account: T) => string;
}

export default function GroupedAccountSelect<T extends SelectableAccount>({
  accounts,
  value,
  onChange,
  placeholder,
  formatLabel,
  ...selectProps
}: GroupedAccountSelectProps<T>): React.JSX.Element {
  return (
    <select
      {...selectProps}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      <GroupedAccountOptions accounts={accounts} formatLabel={formatLabel} />
    </select>
  );
}
