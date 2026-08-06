import { useMemo } from 'react';
import { groupAccountsBySection, type GroupableAccount } from '../../utils/accountGrouping';

/**
 * The banded <optgroup>/<option> block for a native <select> this component
 * does not own — which now means exactly one place: the bulk-edit filter's
 * `<select multiple>`, where several accounts are picked at once and a
 * single-choice combobox would be the wrong control entirely.
 *
 * Everywhere a single account is chosen, `AccountSelector` is the picker: a
 * searchable combobox with type sections and institution sub-bands. This is
 * the multi-select's share of the same grouping, so the two cannot drift.
 */

/** What an option needs: an id to carry as the value, plus what groups it. */
export interface SelectableAccountOption extends GroupableAccount {
  id: string;
}

interface GroupedAccountOptionsProps<T extends SelectableAccountOption> {
  accounts: readonly T[];
  /** Option text. Defaults to the account name; call sites that print a
      balance or a type pass their own so their wording is unchanged. */
  formatLabel?: (account: T) => string;
}

export default function GroupedAccountOptions<T extends SelectableAccountOption>({
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
