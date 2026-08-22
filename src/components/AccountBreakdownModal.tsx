import React, { useMemo, useState } from 'react';
import { Modal, ModalBody } from './common/Modal';
import { ALL_ACCOUNT_SECTIONS, sectionTypeForAccount } from '../utils/accountSections';

/**
 * The drill-in behind the Accounts page's Net Worth / Assets / Liabilities
 * cards: which accounts, at what balances, those figures are made of.
 *
 * The rows arrive from the page ALREADY computed with the same balance
 * function the cards use, so the modal's totals cannot disagree with the
 * card that opened it. Assets are the accounts standing positive,
 * liabilities the ones standing negative — same split as the cards.
 */

export type AccountBreakdownView = 'net' | 'assets' | 'liabilities';

export interface AccountBreakdownRow {
  id: string;
  name: string;
  institution?: string;
  /** The account's type, for the Group view's sections. */
  accountType: string;
  /** Signed balance, from the page's own computeAccountBalance. */
  balance: number;
  /** Formatted in the account's own currency by the page's formatter. */
  formatted: string;
}

interface Props {
  view: AccountBreakdownView | null;
  onClose: () => void;
  rows: AccountBreakdownRow[];
  /** Formats a base-currency total, matching the summary cards. */
  formatTotal: (value: number) => string;
  onOpenAccount: (accountId: string) => void;
}

type SortKey = 'name' | 'balance';

const TITLES: Record<AccountBreakdownView, string> = {
  net: 'Net Worth',
  assets: 'Assets',
  liabilities: 'Liabilities',
};

export default function AccountBreakdownModal({
  view,
  onClose,
  rows,
  formatTotal,
  onOpenAccount,
}: Props): React.JSX.Element {
  // Balance sorts by MAGNITUDE so "high first" means the biggest debt first
  // on the liabilities view, not the least negative number.
  const [sortKey, setSortKey] = useState<SortKey>('balance');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  // Group by account type — the same sections as the main Accounts screen.
  const [grouped, setGrouped] = useState(false);

  const handleSort = (key: SortKey): void => {
    if (key === sortKey) {
      setSortDir(d => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(key === 'balance' ? -1 : 1);
    }
  };

  const sortRows = useMemo(() => {
    return (list: AccountBreakdownRow[]): AccountBreakdownRow[] =>
      [...list].sort((a, b) =>
        sortKey === 'name'
          ? sortDir * a.name.localeCompare(b.name)
          : sortDir * (Math.abs(a.balance) - Math.abs(b.balance))
      );
  }, [sortKey, sortDir]);

  const assets = useMemo(() => rows.filter(r => r.balance > 0), [rows]);
  const liabilities = useMemo(() => rows.filter(r => r.balance < 0), [rows]);

  const sections = useMemo(() => {
    const included = view === 'assets' ? assets : view === 'liabilities' ? liabilities : rows;

    if (grouped) {
      // The SAME sections, titles and order as the main Accounts screen —
      // shared definition, so the two can never disagree. The active sort
      // still applies within each group.
      return ALL_ACCOUNT_SECTIONS
        .map(section => ({
          name: section.title as string | null,
          rows: sortRows(included.filter(r => sectionTypeForAccount(r.accountType) === section.type)),
        }))
        .filter(section => section.rows.length > 0);
    }

    if (view === 'assets') return [{ name: null as string | null, rows: sortRows(assets) }];
    if (view === 'liabilities') return [{ name: null as string | null, rows: sortRows(liabilities) }];
    return [
      { name: 'Assets' as string | null, rows: sortRows(assets) },
      { name: 'Liabilities' as string | null, rows: sortRows(liabilities) },
    ];
  }, [view, grouped, rows, assets, liabilities, sortRows]);

  const total = useMemo(() => {
    const included = view === 'assets' ? assets : view === 'liabilities' ? liabilities : rows;
    return included.reduce((sum, r) => sum + r.balance, 0);
  }, [view, assets, liabilities, rows]);

  const arrow = (key: SortKey): string => (sortKey === key ? (sortDir === 1 ? ' ↑' : ' ↓') : '');

  return (
    <Modal
      isOpen={view !== null}
      onClose={onClose}
      title={view ? TITLES[view] : ''}
      size="lg"
      headerActions={
        <button
          type="button"
          onClick={() => setGrouped(g => !g)}
          aria-pressed={grouped}
          className={`px-4 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
            grouped
              ? 'bg-[#1a2332] dark:bg-[#2d3a4d] border-[#1a2332] dark:border-[#2d3a4d] text-white'
              : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title="Group accounts by type, the way the Accounts screen does"
        >
          Group
        </button>
      }
    >
      <ModalBody>
        <table className="w-full">
          <thead>
            <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
              <th className="pb-2 font-medium text-center">
                <button
                  type="button"
                  onClick={() => handleSort('name')}
                  className="hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                  title="Sort by account name"
                >
                  Account{arrow('name')}
                </button>
              </th>
              <th className="pb-2 font-medium text-center">
                <button
                  type="button"
                  onClick={() => handleSort('balance')}
                  className="hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                  title="Sort by balance size"
                >
                  Balance{arrow('balance')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section, i) => (
              <React.Fragment key={section.name ?? `flat-${i}`}>
                {section.name !== null && (
                  <tr className="bg-gray-100 dark:bg-gray-700/70 border-y border-gray-300 dark:border-gray-500">
                    <td className="py-2 pr-3 text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">
                      {section.name}
                      <span className="ml-2 font-normal normal-case text-gray-400 dark:text-gray-500">
                        ({section.rows.length})
                      </span>
                    </td>
                    <td className={`py-1.5 text-xs font-semibold text-right tabular-nums ${
                      section.rows.reduce((s, r) => s + r.balance, 0) < 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-green-600 dark:text-green-400'
                    }`}>
                      {formatTotal(section.rows.reduce((s, r) => s + r.balance, 0))}
                    </td>
                  </tr>
                )}
                {!grouped && section.rows.length === 0 && (
                  <tr>
                    <td colSpan={2} className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">
                      Nothing here — every account stands {view === 'liabilities' ? 'positive' : 'negative'}.
                    </td>
                  </tr>
                )}
                {section.rows.map(row => (
                  <tr
                    key={row.id}
                    onClick={() => onOpenAccount(row.id)}
                    className="border-b border-gray-50 dark:border-gray-700/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                    title="Open this account"
                  >
                    <td className="py-2 pr-3">
                      <span className="block text-sm text-gray-900 dark:text-white truncate">{row.name}</span>
                      {row.institution && (
                        <span className="block text-xs text-gray-400 dark:text-gray-500">{row.institution}</span>
                      )}
                    </td>
                    <td className={`py-2 text-sm font-medium text-right whitespace-nowrap tabular-nums ${
                      row.balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                    }`}>
                      {row.formatted}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 dark:border-gray-600">
              <td className="pt-3 text-sm font-semibold text-gray-900 dark:text-white">
                {view === 'net' ? 'Net worth' : 'Total'}
              </td>
              <td className={`pt-3 text-sm font-bold text-right tabular-nums ${
                total < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
              }`}>
                {formatTotal(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </ModalBody>
    </Modal>
  );
}
