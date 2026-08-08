/**
 * Archive manager — set how far back each account keeps transactions in the
 * live register. Soft archive: nothing is deleted, balances are untouched, and
 * reports still see everything. Investment accounts are excluded in v1.
 *
 * The list is banded the way the Accounts page bands its own (type sections,
 * institutions inside them) because it is the same ~25 accounts and a flat
 * list of them buried everything else on the page.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContextSupabase';
import { useToast } from '../contexts/ToastContext';
import { ArchiveIcon, CalendarIcon, CheckCircleIcon, ChevronRightIcon } from './icons';
import DatePicker from './common/DatePicker';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import {
  compareAccountsByName,
  groupAccountsForDisplay,
  type AccountDisplayGroup,
} from '../utils/accountGrouping';
import { preserveDemoParam } from '../utils/navigation';
import {
  ARCHIVE_PRESETS, ARCHIVE_OVERRIDES_STORAGE_KEY, EMPTY_ARCHIVE_IMPACT, archiveImpactByAccount,
  countWithNoun, describeArchiveConsequence, isOverrideActive, parseAccountArchiveOverrides,
  resolveAccountCutoff, resolveCutoff, serializeAccountArchiveOverrides,
  type AccountArchiveOverrides, type ArchivePreset,
} from '../utils/archive';
import { formatDate } from '../utils/dateFormatter';
import type { Account } from '../types';

/** Which bands the user has folded away, remembered like the Accounts page's. */
const COLLAPSED_STORAGE_KEY = 'archiveManager.collapsedGroups.v1';

const readCollapsedGroups = (): Set<string> => {
  try {
    const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : null;
    return Array.isArray(parsed)
      ? new Set(parsed.filter((key): key is string => typeof key === 'string'))
      : new Set<string>();
  } catch {
    // A corrupt value must never wedge the page — start with nothing folded.
    return new Set<string>();
  }
};

const readOverrides = (): AccountArchiveOverrides => {
  try {
    return parseAccountArchiveOverrides(localStorage.getItem(ARCHIVE_OVERRIDES_STORAGE_KEY));
  } catch {
    return {};
  }
};

export default function ArchiveManager() {
  const { accounts, transactions, archiveTransactionsBefore, unarchiveAccount } = useApp();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [preset, setPreset] = useState<ArchivePreset>('12m');
  const [customDate, setCustomDate] = useState('');
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(readCollapsedGroups);
  const [overrides, setOverrides] = useState<AccountArchiveOverrides>(readOverrides);
  /** The account whose own cutoff is being edited, if any. */
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [draftDate, setDraftDate] = useState('');
  const [draftAcknowledged, setDraftAcknowledged] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(ARCHIVE_OVERRIDES_STORAGE_KEY, serializeAccountArchiveOverrides(overrides));
    } catch {
      // Storage may be unavailable (private mode); the override still works
      // for this visit, it just will not be remembered.
    }
  }, [overrides]);

  // Archivable accounts: open, non-investment (investments excluded in v1),
  // alphabetical — the bands preserve input order, so sorting once here sorts
  // every band and sub-band. The app's one comparator, so this list orders
  // names exactly as every dropdown does.
  const eligibleAccounts = useMemo(
    () => accounts
      .filter(a => a.isActive !== false && a.type !== 'investment')
      .sort(compareAccountsByName),
    [accounts]
  );

  const globalCutoff = useMemo(() => resolveCutoff(preset, customDate), [preset, customDate]);

  /** Each account's own cutoff — its override where one is acknowledged, the global choice otherwise. */
  const cutoffByAccount = useMemo(() => {
    const map = new Map<string, Date | null>();
    eligibleAccounts.forEach(account => {
      map.set(account.id, resolveAccountCutoff(globalCutoff, overrides[account.id]).cutoff);
    });
    return map;
  }, [eligibleAccounts, globalCutoff, overrides]);

  const impactByAccount = useMemo(
    () => archiveImpactByAccount(transactions, cutoffByAccount),
    [transactions, cutoffByAccount]
  );

  const groups = useMemo(
    () => groupAccountsForDisplay(eligibleAccounts, { byType: true, byInstitution: true }),
    [eligibleAccounts]
  );

  const toggleGroupCollapsed = useCallback((key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // Unwritable storage costs the memory of the fold, not the fold itself.
      }
      return next;
    });
  }, []);

  const handleArchive = useCallback(async (accountId: string) => {
    const cutoff = cutoffByAccount.get(accountId) ?? null;
    if (!cutoff) { showWarning('Choose a date range first.'); return; }
    setBusyAccountId(accountId);
    try {
      const count = await archiveTransactionsBefore(accountId, cutoff);
      if (count > 0) showSuccess(`Archived ${countWithNoun(count)}.`);
      else showInfo('No reconciled transactions to archive in that range.');
    } catch (error) {
      showError(error);
    } finally {
      setBusyAccountId(null);
    }
  }, [cutoffByAccount, archiveTransactionsBefore, showSuccess, showInfo, showWarning, showError]);

  const handleUnarchive = useCallback(async (accountId: string) => {
    setBusyAccountId(accountId);
    try {
      const count = await unarchiveAccount(accountId);
      showSuccess(`Restored ${countWithNoun(count)}.`);
    } catch (error) {
      showError(error);
    } finally {
      setBusyAccountId(null);
    }
  }, [unarchiveAccount, showSuccess, showError]);

  /** Drop an account's own cutoff — it follows the global setting again. */
  const clearOverride = useCallback((accountId: string) => {
    setOverrides(prev => {
      if (!(accountId in prev)) return prev;
      const next = { ...prev };
      delete next[accountId];
      return next;
    });
  }, []);

  const openOverrideEditor = useCallback((account: Account) => {
    const existing = overrides[account.id];
    setEditingAccount(account);
    setDraftDate(existing?.date ?? '');
    setDraftAcknowledged(existing?.acknowledged ?? false);
  }, [overrides]);

  const closeOverrideEditor = useCallback(() => setEditingAccount(null), []);

  const saveOverride = useCallback(() => {
    if (!editingAccount || draftDate === '' || !draftAcknowledged) return;
    setOverrides(prev => ({ ...prev, [editingAccount.id]: { date: draftDate, acknowledged: true } }));
    setEditingAccount(null);
  }, [editingAccount, draftDate, draftAcknowledged]);

  /**
   * The register, with the hidden rows shown, so you can see how far back this
   * account's history actually goes before picking a date. Browser Back
   * returns here.
   */
  const openAccountHistory = useCallback((accountId: string) => {
    navigate(preserveDemoParam(`/accounts/${accountId}?showArchived=1`, location.search));
  }, [navigate, location.search]);

  // The impact of the date being typed in the editor, which is not yet any
  // account's cutoff — measured the same way the rows are, so the modal and
  // the row can never quote different numbers for the same date.
  const draftImpact = useMemo(() => {
    if (!editingAccount) return EMPTY_ARCHIVE_IMPACT;
    const cutoff = draftDate === '' ? null : resolveCutoff('custom', draftDate);
    return archiveImpactByAccount(transactions, new Map([[editingAccount.id, cutoff]])).get(editingAccount.id)
      ?? EMPTY_ARCHIVE_IMPACT;
  }, [editingAccount, draftDate, transactions]);

  const renderAccountRow = (account: Account): ReactNode => {
    const override = overrides[account.id];
    const overridden = isOverrideActive(override);
    const cutoff = cutoffByAccount.get(account.id) ?? null;
    const impact = impactByAccount.get(account.id) ?? EMPTY_ARCHIVE_IMPACT;
    const busy = busyAccountId === account.id;

    return (
      // The whole row is clickable for the mouse, but the account NAME is the
      // real control: a row-sized role="button" would swallow the buttons
      // inside it, which is both invalid and unusable from the keyboard.
      <div
        key={account.id}
        onClick={() => openAccountHistory(account.id)}
        className={`w-full text-left rounded-xl border p-3 flex items-start gap-3 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
          overridden
            ? 'border-amber-300 dark:border-amber-700/70 bg-amber-50/40 dark:bg-amber-900/10'
            : 'border-gray-200 dark:border-gray-700'
        }`}
      >
        <span className="shrink-0 grid place-items-center h-9 w-9 rounded-lg bg-gray-100 dark:bg-gray-700 text-[#1a2332] dark:text-blue-400">
          <ArchiveIcon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            <button
              type="button"
              onClick={event => { event.stopPropagation(); openAccountHistory(account.id); }}
              title={`Open ${account.name} with archived transactions shown`}
              className="text-left hover:underline focus:outline-none focus:ring-2 focus:ring-[#1a2332] dark:focus:ring-blue-500 rounded"
            >
              {account.name}
            </button>
            {overridden && (
              <span className="ml-2 align-middle inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                <CalendarIcon size={11} /> Own cutoff {formatDate(override.date)}
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {account.archiveThroughDate
              ? <>Archived through {formatDate(account.archiveThroughDate)} · {impact.alreadyHidden.toLocaleString()} hidden</>
              : 'Showing all history'}
          </p>
          <p className={`text-xs mt-0.5 ${overridden ? 'text-amber-700 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
            {overridden && 'Ignores the global setting above. '}
            {describeArchiveConsequence(impact, cutoff)}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
          <button
            onClick={event => { event.stopPropagation(); openOverrideEditor(account); }}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 inline-flex items-center gap-1"
          >
            <CalendarIcon size={14} /> {overridden ? 'Change date' : 'Own date'}
          </button>
          {overridden && (
            <button
              onClick={event => { event.stopPropagation(); clearOverride(account.id); }}
              className="px-3 py-1.5 text-sm rounded-lg border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
            >
              Use global
            </button>
          )}
          {impact.alreadyHidden > 0 && (
            <button
              onClick={event => { event.stopPropagation(); void handleUnarchive(account.id); }}
              disabled={busy}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 inline-flex items-center gap-1"
            >
              <CheckCircleIcon size={14} /> Restore all
            </button>
          )}
          <button
            onClick={event => { event.stopPropagation(); void handleArchive(account.id); }}
            disabled={busy || !cutoff || impact.willHide === 0}
            title={!cutoff ? 'Pick a date range above' : describeArchiveConsequence(impact, cutoff)}
            className="px-3 py-1.5 text-sm rounded-lg bg-[#1a2332] dark:bg-blue-600 text-white hover:bg-[#2d3a4d] dark:hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
          >
            {busy ? 'Working…' : impact.willHide > 0 ? `Archive ${impact.willHide.toLocaleString()}` : 'Archive'}
          </button>
        </div>
      </div>
    );
  };

  /**
   * A band heading that folds its rows away, and says what the band holds
   * while folded: how many accounts, and how many of them are already hiding
   * history — the reason you would open this section at all.
   */
  const renderGroup = (group: AccountDisplayGroup<Account>): ReactNode => {
    const key = `${group.kind}:${group.label}`;
    const isExpanded = !collapsedGroups.has(key);
    const regionId = `archive-group-${group.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
    const archivingCount = group.accounts.filter(a => (impactByAccount.get(a.id)?.alreadyHidden ?? 0) > 0).length;

    return (
      <div key={key} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <button
          type="button"
          onClick={() => toggleGroupCollapsed(key)}
          aria-expanded={isExpanded}
          aria-controls={regionId}
          className="w-full bg-gray-50 dark:bg-gray-700/50 px-3 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
        >
          <ChevronRightIcon
            size={16}
            className={`shrink-0 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
          />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{group.title}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({countWithNoun(group.accounts.length, 'account')}
            {archivingCount > 0 && ` · ${archivingCount.toLocaleString()} archiving`})
          </span>
        </button>

        {isExpanded && (
          <div id={regionId} className="p-2 space-y-2">
            {group.subGroups
              ? group.subGroups.map(sub => (
                  <div key={sub.label} role="group" aria-label={`${sub.title}, ${countWithNoun(sub.accounts.length, 'account')}`} className="space-y-2">
                    <p className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {sub.title}
                      <span className="ml-2 font-normal normal-case tracking-normal text-gray-400 dark:text-gray-500">
                        ({countWithNoun(sub.accounts.length, 'account')})
                      </span>
                    </p>
                    {sub.accounts.map(renderAccountRow)}
                  </div>
                ))
              : group.accounts.map(renderAccountRow)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Cutoff selector (the Section heading already explains what archiving is) */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
        <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">Archive transactions older than</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5">
            {ARCHIVE_PRESETS.map(p => (
              <button
                key={p.value}
                onClick={() => setPreset(p.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  preset === p.value
                    ? 'bg-[#1a2332] dark:bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            /* dd/mm/yyyy everywhere — a native date input renders in the
               browser's locale, not the app's. */
            <div className="w-40">
              <DatePicker
                size="sm"
                value={customDate}
                onChange={setCustomDate}
                className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                aria-label="Custom archive cutoff date"
              />
            </div>
          )}
        </div>
        {globalCutoff && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Reconciled transactions dated on or before <span className="font-medium">{formatDate(globalCutoff)}</span> will be archived.
            Unreconciled ones stay visible.
          </p>
        )}
        {preset === 'all' && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">“Keep all” archives nothing — use the Restore action to bring an account fully back.</p>
        )}
      </div>

      {/* Per-account list, banded like the Accounts page */}
      <div className="space-y-3">
        {eligibleAccounts.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">No archivable accounts.</p>
        )}
        {groups.mode === 'grouped' ? groups.groups.map(renderGroup) : groups.accounts.map(renderAccountRow)}
      </div>

      {editingAccount && (
        <Modal
          isOpen
          onClose={closeOverrideEditor}
          title={`Archive cutoff for ${editingAccount.name}`}
          size="md"
        >
          <ModalBody className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Hide everything in this account dated on or before one date of your choosing. The global
              setting is currently{' '}
              <span className="font-medium text-gray-900 dark:text-white">
                {globalCutoff ? `on or before ${formatDate(globalCutoff)}` : 'keep all'}
              </span>.
            </p>
            <div>
              <label htmlFor="account-archive-cutoff" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cutoff date for this account
              </label>
              <DatePicker
                id="account-archive-cutoff"
                value={draftDate}
                onChange={setDraftDate}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                aria-label={`Archive cutoff date for ${editingAccount.name}`}
              />
            </div>
            <p className="text-sm rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 text-gray-700 dark:text-gray-300">
              {describeArchiveConsequence(draftImpact, draftDate === '' ? null : resolveCutoff('custom', draftDate))}
            </p>
            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={draftAcknowledged}
                onChange={event => setDraftAcknowledged(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-gray-600"
              />
              <span>
                I understand this date replaces the global setting for {editingAccount.name}. Every other
                account keeps following the global choice.
              </span>
            </label>
          </ModalBody>
          <ModalFooter className="flex flex-wrap justify-end gap-2">
            {isOverrideActive(overrides[editingAccount.id]) && (
              <button
                onClick={() => { clearOverride(editingAccount.id); closeOverrideEditor(); }}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 mr-auto"
              >
                Use the global setting
              </button>
            )}
            <button
              onClick={closeOverrideEditor}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={saveOverride}
              disabled={draftDate === '' || !draftAcknowledged}
              title={draftDate === '' ? 'Choose a date first' : !draftAcknowledged ? 'Tick the acknowledgement first' : undefined}
              className="px-4 py-2 text-sm rounded-lg bg-[#1a2332] dark:bg-blue-600 text-white hover:bg-[#2d3a4d] dark:hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Use this date
            </button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
