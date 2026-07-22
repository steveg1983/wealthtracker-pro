import React from 'react';
import { FilterIcon } from '../icons';
import type { Account } from '../../types';
import type { ReportAccountFilter as Filter } from '../../hooks/useReportAccountFilter';

/**
 * The reports' account filter — one control, one look, on every report that
 * can be narrowed to a single account.
 */
export default function ReportAccountFilter({
  accounts,
  filter,
}: {
  accounts: Account[];
  filter: Filter;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <FilterIcon className="text-gray-500" size={18} />
      <select
        aria-label="Account filter"
        value={filter.accountId}
        onChange={e => filter.setAccountId(e.target.value)}
        className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300/50 dark:border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white"
      >
        <option value="all">All accounts</option>
        {accounts.map(account => (
          <option key={account.id} value={account.id}>{account.name}</option>
        ))}
      </select>
    </div>
  );
}
