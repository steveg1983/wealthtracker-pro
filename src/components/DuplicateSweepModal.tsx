import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { useApp } from '../contexts/AppContextSupabase';
import { useToast } from '../contexts/ToastContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { useAccountNames } from '../hooks/useAccountNames';
import {
  deleteBlockOf,
  deleteRefusalFor,
  findDuplicateCandidates,
  needsConfirmation,
  type DeleteBlock,
  type DuplicateCandidate,
} from '../utils/duplicateSweep';
import {
  dismissedKeys,
  duplicateDismissalKey,
  duplicateDismissalSubjectIds,
} from '../utils/suggestionDismissals';
import { buildTransactionRegisterPath } from '../utils/transactionDeepLink';
import DismissSuggestionPrompt from './sweeps/DismissSuggestionPrompt';
import DismissedSuggestionsSection from './sweeps/DismissedSuggestionsSection';
import GroupedAccountOptions from './common/GroupedAccountOptions';
import { AlertTriangleIcon, ArrowUpRightIcon } from './icons';
import type { SuggestionDismissal, Transaction } from '../types';

/**
 * Find duplicates — the same sweep shape as "Match transfers", for the other
 * commonest mess in real data: one payment recorded twice.
 *
 * It is a DELETE tool, so it is built the other way round from every other
 * sweep in the app: nothing is bulk-applied, nothing is pre-selected, and the
 * user has to say which of the two copies goes. The scan cannot know which one
 * is the real one — one may be reconciled, categorised or carry a note the
 * other does not — so it never guesses.
 *
 * The scan finds in two tiers (see utils/duplicateSweep), and this screen keeps
 * them apart on purpose. Pairs whose WORDING agrees as well as their money are
 * near-certain. Pairs found only because the money and the day agree are
 * evidence: a renamed payee looks exactly like that, and so do two separate
 * payments of the same size. Those carry an extra confirmation that the user
 * has to give pair by pair — and the button is gated by
 * `deleteRefusalFor`, not by this component's opinion, so the rule holds
 * wherever it is asked from.
 *
 * Three shapes of row are refused outright, with the reason said out loud
 * rather than the row being quietly hidden (see utils/duplicateSweep):
 * deleting one would leave something else in the ledger pointing at nothing.
 * The user still needs to know the two rows look identical — they can unpick
 * the transfer or the split themselves and come back.
 *
 * Every row here also has a way OUT to itself — the register, centred on the
 * row, where the neighbours and the running balance are. Two evidence cards
 * cannot settle every case ("is this the standing order or the manual one?"),
 * and the answer is usually in the rows around it. See `openInRegister`.
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const CAP = 300;

/**
 * How far apart two copies of the same payment are allowed to be, in days.
 *
 * "Within N" means the two dates are at most N days apart, inclusive — so
 * "within 1 day" is the same day or the day either side of it, which is the
 * tightest a feed-versus-import overlap ever is. It is the narrowest choice on
 * purpose rather than the default: a bank feed can post a card payment two or
 * three days after the import already carried it, and 3 stays the default so
 * that the sweep's reach does not silently shrink for everyone.
 *
 * The window is also the yardstick the date score is measured against (see
 * duplicateScan.dateScoreOf), so a NARROWER window is strictly stricter: at 3
 * days a pair one day apart still scores 83 on date, at 1 day the same pair
 * scores 50 and its wording has to carry more of the case.
 */
const WINDOW_CHOICES = [1, 3, 7, 14] as const;
type WindowDays = (typeof WINDOW_CHOICES)[number];

/** "1 day", not "1 days" — the singular is the whole reason this exists. */
const windowLabel = (days: WindowDays): string => `${days} day${days === 1 ? '' : 's'}`;

type SortKey = 'date' | 'account' | 'description' | 'amount';

/** Case-insensitive, so "TESCO" and "Tesco" sit together, not in two blocks. */
const compareText = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: 'base' });

const earlier = (candidate: DuplicateCandidate): Transaction =>
  new Date(candidate.a.date).getTime() <= new Date(candidate.b.date).getTime()
    ? candidate.a
    : candidate.b;

function compareCandidates(
  left: DuplicateCandidate,
  right: DuplicateCandidate,
  key: SortKey,
  accountName: (id: string) => string
): number {
  switch (key) {
    case 'account':
      return compareText(accountName(left.a.accountId), accountName(right.a.accountId));
    case 'description':
      return compareText(left.a.description, right.a.description);
    case 'amount':
      return Math.abs(left.a.amount) - Math.abs(right.a.amount);
    case 'date':
      return new Date(earlier(left).date).getTime() - new Date(earlier(right).date).getTime();
  }
}

const shortDate = (date: Date | string): string =>
  new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });

const longDate = (date: Date | string): string =>
  new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

const gapPhrase = (daysApart: number): string => {
  const days = Math.round(daysApart);
  return days === 0 ? 'on the same day' : `${days} day${days === 1 ? '' : 's'} apart`;
};

export default function DuplicateSweepModal({ isOpen, onClose }: Props): React.JSX.Element {
  const {
    accounts, transactions, categories, deleteTransaction,
    suggestionDismissals, suggestionDismissalsStatus, refreshSuggestionDismissals,
    dismissSuggestion, restoreSuggestion,
  } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const { showSuccess, showError } = useToast();
  const accountName = useAccountNames();
  const navigate = useNavigate();
  const location = useLocation();

  const [windowDays, setWindowDays] = useState<WindowDays>(3);
  const [accountFilter, setAccountFilter] = useState('');
  const [reviewing, setReviewing] = useState<DuplicateCandidate | null>(null);
  /** Which copy the user has chosen to delete, inside the review. */
  const [chosenId, setChosenId] = useState<string | null>(null);
  /** The answer to "these two are one payment" — for the weaker tier only. */
  const [confirmedSame, setConfirmedSame] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // A refusal that has not yet been answered "and never again?".
  const [dismissPrompt, setDismissPrompt] = useState<DuplicateCandidate | null>(null);
  const [savingDismissal, setSavingDismissal] = useState(false);
  const [restoringKey, setRestoringKey] = useState<string | null>(null);
  // "Not a duplicate" answered No to the follow-up: gone for this sitting only.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  useEffect(() => {
    if (isOpen) void refreshSuggestionDismissals();
  }, [isOpen, refreshSuggestionDismissals]);

  const candidates = useMemo(() => {
    if (!isOpen) return [] as DuplicateCandidate[];
    return findDuplicateCandidates(transactions, { windowDays });
  }, [isOpen, transactions, windowDays]);

  /**
   * Whether the dismissal filter has run. The list is held back until it has —
   * showing a suggestion for a second and then snatching it away is precisely
   * what the persistent dismissals exist to end.
   */
  const dismissalsChecked =
    suggestionDismissalsStatus === 'ready' || suggestionDismissalsStatus === 'error';
  const dismissedDuplicateKeys = useMemo(
    () => dismissedKeys(suggestionDismissals, 'duplicate'),
    [suggestionDismissals]
  );
  const duplicateDismissals = useMemo(
    () => suggestionDismissals.filter(d => d.kind === 'duplicate'),
    [suggestionDismissals]
  );
  const transactionsById = useMemo(
    () => new Map(transactions.map(t => [t.id, t])),
    [transactions]
  );
  const categoryName = (id: string): string | null =>
    categories.find(c => c.id === id)?.name ?? null;

  const live = !dismissalsChecked ? [] : candidates.filter(candidate => {
    const key = duplicateDismissalKey(candidate.a, candidate.b);
    return !dismissed.has(key) && !dismissedDuplicateKeys.has(key);
  });

  /** Account id → type, for the filter's banding. Closed accounts are not in
      the context list, so theirs is unknown and files under the catch-all —
      the honest answer, and their name already reads "… (closed)". */
  const accountTypeById = useMemo(
    () => new Map(accounts.map(account => [account.id, account.type])),
    [accounts]
  );

  /**
   * Every account the sweep found something in. The scan already covers the
   * whole history in one run; this is so a user who has cleaned one account can
   * see at a glance which of the others still have work in them, and take one
   * at a time without leaving the screen.
   *
   * Unsorted here on purpose: the dropdown bands these into the app's account
   * sections and alphabetises inside each one (GroupedAccountOptions), and a
   * second ordering applied first would be thrown away.
   */
  const accountsWithWork = (() => {
    const counts = new Map<string, number>();
    for (const candidate of live) {
      counts.set(candidate.a.accountId, (counts.get(candidate.a.accountId) ?? 0) + 1);
    }
    return [...counts.entries()].map(([id, count]) => ({
      id,
      name: accountName(id),
      type: accountTypeById.get(id) ?? '',
      count,
    }));
  })();
  // A filter whose account has since been emptied would hide everything with no
  // way back, so a stale choice falls back to showing all of them.
  const scopedAccount = accountsWithWork.some(a => a.id === accountFilter) ? accountFilter : '';
  const inScope = scopedAccount ? live.filter(c => c.a.accountId === scopedAccount) : live;

  // Sort BEFORE the cap: sorting the first 300 of an arbitrary order just
  // reshuffles the same 300, which is no use to someone working through a long
  // list looking for the oldest or the largest.
  const sorted = [...inScope].sort((a, b) => sortDir * compareCandidates(a, b, sortKey, accountName));
  const wordingAgrees = sorted.filter(c => !needsConfirmation(c));
  const needsYourEye = sorted.filter(c => needsConfirmation(c));

  const sortBy = (key: SortKey): void => {
    if (sortKey === key) {
      setSortDir(d => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(key === 'date' || key === 'amount' ? -1 : 1);
    }
  };
  const arrow = (key: SortKey): string => (sortKey === key ? (sortDir === 1 ? ' ↑' : ' ↓') : '');

  /**
   * Leave the sweep and land on the row itself, centred in its account's
   * register with the surrounding rows and the running balance around it —
   * the one thing an evidence card cannot show. Same mechanic as the
   * transaction editor's "See this transaction in …" (buildTransactionRegisterPath),
   * not a second one.
   *
   * The modal is closed FIRST so it is not left hanging over the register it
   * just opened; Data Management unmounts it on close, so this sitting's
   * account filter and window go with it and a return trip starts fresh at
   * "All accounts" within 3 days. Nothing about the sweep is stored between
   * sittings today, and a delete tool is not the place to invent that.
   */
  const openInRegister = useCallback((transaction: Transaction): void => {
    onClose();
    navigate(buildTransactionRegisterPath(transaction.accountId, transaction.id, location.search));
  }, [navigate, location.search, onClose]);

  const review = (candidate: DuplicateCandidate): void => {
    setReviewing(candidate);
    // Nothing is pre-selected, deliberately: the scan cannot tell which copy is
    // the real one, and a pre-ticked delete is how the wrong row goes.
    setChosenId(null);
    setConfirmedSame(false);
  };

  /** The row the user has picked, when it is genuinely deletable. */
  const chosen = reviewing && chosenId
    ? [reviewing.a, reviewing.b].find(t => t.id === chosenId) ?? null
    : null;

  /**
   * The single source of truth for whether this delete may happen. Asked here
   * to draw the button, and asked again before the delete actually runs.
   */
  const refusal = reviewing && chosen
    ? deleteRefusalFor(reviewing, chosen, confirmedSame)
    : null;

  /**
   * What deleting the chosen copy does to the account — said before it happens.
   * The balance MOVING is the point of the whole exercise: money counted twice
   * has to stop being counted twice.
   */
  const deleteConsequence = (transaction: Transaction): string => {
    const money = formatCurrency(Math.abs(transaction.amount));
    const where = accountName(transaction.accountId);
    const direction = transaction.amount < 0
      ? `${where}’s balance goes up by ${money}, because that ${money} was taken off twice.`
      : `${where}’s balance goes down by ${money}, because that ${money} was added twice.`;
    return `This row is deleted for good — it is not archived, and it cannot be brought back. ${direction} The other copy stays exactly as it is.`;
  };

  const BLOCK_REASONS: Record<DeleteBlock, (t: Transaction) => string> = {
    'linked-transfer': t =>
      `This row is one half of a linked transfer with ${accountName(t.transferAccountId ?? '')}. Deleting it would leave the row over there pointing at nothing — a transfer with one side, which misstates both accounts. Unlink the pair first, then come back.`,
    'split-line-counterpart': () =>
      'This row is the other side of one LINE inside a split transaction. Deleting it would leave that line pointing at nothing. Edit the split to unpick the transfer first, then come back.',
    'split-parent': () =>
      'This row is split into lines. Deleting it takes the whole breakdown with it — including any line that is one half of a transfer, whose other side would be stranded. Remove the split first if you really do mean to delete it.',
  };

  const handleDelete = async (): Promise<void> => {
    if (!reviewing || !chosen) return;
    // Asked again, not inherited from the disabled button: a disabled attribute
    // is a hint to a mouse, and this is the last point before a row is gone.
    if (deleteRefusalFor(reviewing, chosen, confirmedSame) !== null) return;
    setDeleting(true);
    try {
      const money = formatCurrency(Math.abs(chosen.amount));
      const where = accountName(chosen.accountId);
      await deleteTransaction(chosen.id);
      showSuccess(
        `The copy is gone and ${where} has been corrected by ${money}. The other copy is untouched.`,
        'Duplicate deleted'
      );
      setReviewing(null);
      setChosenId(null);
      setConfirmedSame(false);
    } catch (error) {
      // Verbatim: the database's own refusal names the precondition that
      // failed, and a silent failure on a delete is the worst outcome here.
      showError(error);
    } finally {
      setDeleting(false);
    }
  };

  const handleDismiss = async (): Promise<void> => {
    if (!dismissPrompt) return;
    setSavingDismissal(true);
    try {
      await dismissSuggestion(
        'duplicate',
        duplicateDismissalKey(dismissPrompt.a, dismissPrompt.b),
        duplicateDismissalSubjectIds(dismissPrompt.a, dismissPrompt.b)
      );
      showSuccess(
        'These two will not be offered again. Bring them back any time from “Dismissed suggestions” at the foot of this list.',
        'Left out in future'
      );
      setDismissPrompt(null);
    } catch (error) {
      showError(error);
    } finally {
      setSavingDismissal(false);
    }
  };

  const handleRestore = async (dismissal: SuggestionDismissal): Promise<void> => {
    setRestoringKey(dismissal.subjectKey);
    try {
      await restoreSuggestion(dismissal.kind, dismissal.subjectKey);
      showSuccess('It is back in the list below.', 'Restored');
    } catch (error) {
      showError(error);
    } finally {
      setRestoringKey(null);
    }
  };

  /**
   * One copy as an evidence card: the radio that chooses it for DELETION, and
   * a separate way in to LOOK at it. Those two are not allowed to be mistaken
   * for one another, so they are built differently on purpose:
   *
   *  - the radio and the whole body of the card are one `<label>`, so clicking
   *    the evidence selects the copy — a genuine either/or, with the native
   *    control's keyboard behaviour and grouping;
   *  - the way in sits OUTSIDE that label, below the rule, as a plain text
   *    button in the app's "leaving for context" idiom (arrow glyph, primary
   *    text, no card chrome). Outside the label is the load-bearing part: a
   *    click on it cannot fall through to the radio, so "let me look at this
   *    one" can never come out as "delete this one". It is its own tab stop.
   *
   * A real `input type="radio"`, not a styled div. An undeletable copy is
   * disabled, with the reason underneath — visible, because "why can't I
   * delete this one?" is the question that would otherwise send the user round
   * in circles — and its way in stays live, since going and unpicking the
   * transfer or the split is exactly what that user has to do next.
   */
  const renderCopy = (transaction: Transaction, label: string): React.JSX.Element => {
    const block = deleteBlockOf(transaction);
    const category = categoryName(transaction.category);
    const isChosen = chosenId === transaction.id;
    return (
      <div
        key={transaction.id}
        className={`rounded-xl border p-4 transition-all ${
          block
            ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40'
            : isChosen
              ? 'border-red-400 dark:border-red-500 bg-red-50/60 dark:bg-red-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-primary'
        }`}
      >
        <label className={`flex items-start gap-3 ${block ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
          <input
            type="radio"
            name="duplicate-copy"
            value={transaction.id}
            checked={isChosen}
            disabled={block !== null || deleting}
            onChange={() => setChosenId(transaction.id)}
            className="mt-1 rounded-full border-gray-300"
          />
          <span className="min-w-0">
            <span className="block text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {label}
            </span>
            <span className={`block text-lg font-bold tabular-nums ${transaction.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {formatCurrency(Math.abs(transaction.amount))}
            </span>
            <span className="mt-1 block text-sm text-gray-900 dark:text-white break-words">
              {transaction.description}
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              {longDate(transaction.date)}
            </span>
            <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
              {category ? `Filed as ${category}` : 'Not categorised'}
              {transaction.cleared === true && ' · reconciled'}
              {transaction.isImported === true && ' · imported'}
            </span>
            {transaction.notes && (
              <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400 break-words">
                {transaction.notes}
              </span>
            )}
            {block && (
              <span className="mt-2 flex items-start gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                <AlertTriangleIcon size={12} className="mt-0.5 flex-shrink-0" />
                <span>{BLOCK_REASONS[block](transaction)}</span>
              </span>
            )}
          </span>
        </label>
        {/* Named for the ACCESSIBLE name, because both copies are in the same
            account and two buttons reading the same words tell a screen-reader
            user nothing about which row they are about to open. */}
        <button
          type="button"
          onClick={() => openInRegister(transaction)}
          aria-label={`See the ${label.toLowerCase()} in ${accountName(transaction.accountId)}`}
          className="mt-3 inline-flex items-center gap-1.5 border-t border-gray-100 dark:border-gray-700 pt-3 w-full text-sm font-medium text-primary hover:text-secondary"
        >
          <ArrowUpRightIcon size={14} />
          See this row in the register
        </button>
      </div>
    );
  };

  /** The likeness evidence, said in the terms of the tier the pair is in. */
  const likeness = (candidate: DuplicateCandidate): string => {
    if (!needsConfirmation(candidate)) return `${Math.round(candidate.score)}% alike`;
    return candidate.descriptionOverlap === 0
      ? 'Not one word in common'
      : `${Math.round(candidate.descriptionOverlap * 100)}% of the words in common`;
  };

  const renderTable = (rows: DuplicateCandidate[], total: number): React.JSX.Element => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
            {([
              ['date', 'Date', 'Sort by date'],
              ['account', 'Account', 'Sort by account name'],
              ['description', 'Description', 'Sort by description'],
              ['amount', 'Amount', 'Sort by amount size'],
            ] as const).map(([key, label, hint]) => (
              <th key={key} className="text-center pb-2 font-medium">
                <button
                  type="button"
                  onClick={() => sortBy(key)}
                  className="hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                  title={hint}
                >
                  {label}{arrow(key)}
                </button>
              </th>
            ))}
            <th className="pb-2 w-28"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(candidate => {
            const first = earlier(candidate);
            const sameWording = candidate.a.description === candidate.b.description;
            return (
              <tr
                key={duplicateDismissalKey(candidate.a, candidate.b)}
                onClick={() => review(candidate)}
                className="border-b border-gray-50 dark:border-gray-700/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors align-top"
                title="Look at both copies of this"
              >
                <td className="py-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {shortDate(first.date)}
                  {candidate.daysApart > 0 && (
                    <span className="ml-1 text-xs text-gray-400">
                      +{Math.round(candidate.daysApart)}d
                    </span>
                  )}
                </td>
                <td className="py-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="block truncate max-w-[140px]">
                    {accountName(candidate.a.accountId)}
                  </span>
                </td>
                <td className="py-2 text-sm text-gray-600 dark:text-gray-400">
                  <span className="block truncate max-w-[260px] text-gray-900 dark:text-white">
                    {candidate.a.description}
                  </span>
                  {!sameWording && (
                    <span className="block truncate max-w-[260px] text-xs">
                      and “{candidate.b.description}”
                    </span>
                  )}
                  <span className="block text-xs mt-0.5">{likeness(candidate)}</span>
                </td>
                <td className="py-2 text-sm font-medium text-right tabular-nums text-gray-900 dark:text-white whitespace-nowrap">
                  {formatCurrency(Math.abs(candidate.a.amount))}
                </td>
                {/* The row itself opens the review — one meaning per click.
                    The second way out lives in this cell, which already stops
                    the row's own handler, so it cannot make a row click
                    ambiguous. It lands on the EARLIER copy: both are in one
                    account within the window, so the other is a few rows away
                    on the same screen, in date order with the running balance. */}
                <td className="py-2 text-right" onClick={e => e.stopPropagation()}>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => review(candidate)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      Review
                    </button>
                    <button
                      type="button"
                      onClick={() => openInRegister(first)}
                      aria-label={`See these two rows in ${accountName(candidate.a.accountId)}`}
                      className="inline-flex items-center gap-1 px-1 text-xs font-medium text-primary hover:text-secondary"
                    >
                      <ArrowUpRightIcon size={12} />
                      In the register
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {total > CAP && (
            <tr>
              <td colSpan={5} className="py-3 text-center text-xs text-gray-400 dark:text-gray-500">
                Showing the first {CAP.toLocaleString()} of {total.toLocaleString()} —
                settle these, then run this again for the rest.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const bothBlocked = reviewing !== null
    && deleteBlockOf(reviewing.a) !== null
    && deleteBlockOf(reviewing.b) !== null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Find duplicates" size="xl">
      <ModalBody>
        {suggestionDismissalsStatus === 'error' && (
          <p className="mb-3 text-sm rounded-lg px-3 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300">
            The list of suggestions you asked to leave out could not be read, so this list may
            include some of them. Nothing has changed — close this and try again in a moment.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 mb-3">
          <p className="text-sm text-gray-600 dark:text-gray-400 flex-1 min-w-[16rem]">
            Every account is swept at once. Rows in the <strong>same account</strong> for the same
            amount, to the penny, a few days apart — what a bank feed and an import of the same
            payment look like. Two matching rows in <em>different</em> accounts are not here: that
            is a transfer, and “Match transfers” is where it belongs.
          </p>
          <label className="text-sm text-gray-600 dark:text-gray-400">
            Within{' '}
            <select
              value={windowDays}
              onChange={e => setWindowDays(Number(e.target.value) as WindowDays)}
              className="ml-1 px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {WINDOW_CHOICES.map(days => (
                <option key={days} value={days}>{windowLabel(days)}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Only worth a control when there is more than one account to choose
            between — otherwise it is a menu with one thing on it. */}
        {accountsWithWork.length > 1 && (
          <label className="block mb-3 text-sm text-gray-600 dark:text-gray-400">
            Account{' '}
            <select
              value={scopedAccount}
              onChange={e => setAccountFilter(e.target.value)}
              className="ml-1 px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white max-w-full"
            >
              <option value="">All accounts</option>
              {/* Banded and alphabetised exactly as every other account
                  dropdown in the app: with sixty accounts a flat list is a
                  wall of names. The count each one still carries is the point
                  of the control — which accounts still have work in them. */}
              <GroupedAccountOptions
                accounts={accountsWithWork}
                formatLabel={account => `${account.name} (${account.count.toLocaleString()})`}
              />
            </select>
          </label>
        )}

        {!dismissalsChecked ? (
          <p className="text-center py-10 text-gray-500 dark:text-gray-400">
            Checking which of these you have already dealt with…
          </p>
        ) : live.length === 0 ? (
          <p className="text-center py-10 text-gray-500 dark:text-gray-400">
            Nothing looks like the same payment twice. Every row in every account is either
            unique, far enough apart to be a real repeat
            {duplicateDismissals.length > 0 ? ', or left out at your request below' : ''}.
          </p>
        ) : (
          <>
            {wordingAgrees.length > 0 && (
              // Named regions, because the two tables carry the same column
              // headings: without this a screen reader meets "Sort by date"
              // twice with nothing to say which list it sorts.
              <section className="mb-6" aria-labelledby="duplicates-wording-agrees">
                <h3
                  id="duplicates-wording-agrees"
                  className="text-sm font-semibold text-gray-900 dark:text-white"
                >
                  Same money, same wording
                </h3>
                <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                  Same account, the same amount to the penny, and the two rows read as the same
                  payee. Until one copy goes, that payment is counted twice in the balance.
                </p>
                {renderTable(wordingAgrees.slice(0, CAP), wordingAgrees.length)}
              </section>
            )}

            {needsYourEye.length > 0 && (
              <section aria-labelledby="duplicates-needs-your-eye">
                <h3
                  id="duplicates-needs-your-eye"
                  className="text-sm font-semibold text-gray-900 dark:text-white"
                >
                  Same money, different wording — your call
                </h3>
                <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                  Same account and the same amount to the penny, but the two rows are worded
                  differently. That is what a payee you renamed looks like — and it is also what
                  two separate payments of the same size look like. Nothing here can tell them
                  apart, so each pair has to be confirmed by you before either copy can be
                  deleted.
                </p>
                {renderTable(needsYourEye.slice(0, CAP), needsYourEye.length)}
              </section>
            )}
          </>
        )}

        <DismissedSuggestionsSection
          dismissals={duplicateDismissals}
          transactionsById={transactionsById}
          accountName={accountName}
          formatCurrency={formatCurrency}
          onRestore={dismissal => void handleRestore(dismissal)}
          restoringKey={restoringKey}
          className="mt-6 pt-5 border-t border-gray-200 dark:border-gray-700"
        />
      </ModalBody>
      <ModalFooter>
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {!dismissalsChecked
              ? 'Checking…'
              : live.length === 0
                ? 'Nothing to sort out here.'
                : 'Each one is decided on its own — nothing is deleted until you choose a copy.'}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </ModalFooter>

      {/* One candidate, both copies in full, and the consequence of deleting
          the chosen one spelled out before it happens. */}
      {reviewing && (
        <Modal
          isOpen
          onClose={() => (deleting ? undefined : setReviewing(null))}
          closeOnBackdrop={!deleting}
          title="The same payment twice?"
          size="lg"
        >
          <ModalBody>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              These two rows are in <strong>{accountName(reviewing.a.accountId)}</strong> for the
              same amount, {gapPhrase(reviewing.daysApart)}
              {needsConfirmation(reviewing) ? (
                <>
                  , but they are worded differently. That is what a payee you renamed looks like —
                  and also what two separate payments of the same size look like.{' '}
                  <strong>Nothing here can tell which</strong>, so say so yourself before choosing
                  a copy to delete.
                </>
              ) : (
                <>
                  , and read as the same payee. That is what an import landing on top of a bank
                  feed looks like — but it is also what a genuine repeat payment looks like, so{' '}
                  <strong>nothing here can tell which</strong>. Choose the copy to delete, or leave
                  them both alone.
                </>
              )}
            </p>

            <fieldset>
              <legend className="sr-only">Choose the copy to delete</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {renderCopy(reviewing.a, 'First copy')}
                {renderCopy(reviewing.b, 'Second copy')}
              </div>
            </fieldset>

            {/* The extra step the weaker tier costs. It is the user's own
                statement about this one pair, which is exactly what no bulk
                action could ever provide on their behalf. */}
            {needsConfirmation(reviewing) && !bothBlocked && (
              <label className="mt-4 flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmedSame}
                  disabled={deleting}
                  onChange={e => setConfirmedSame(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300"
                />
                <span>I have read both rows and they are one payment recorded twice.</span>
              </label>
            )}

            {bothBlocked ? (
              <div className="mt-4 flex items-start gap-2 rounded-lg px-3 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300">
                <AlertTriangleIcon size={16} className="mt-0.5 flex-shrink-0" />
                <p className="text-sm">
                  Neither of these can be deleted from here — each one is holding something else
                  together, as explained above. Unpick that first, then run this again.
                </p>
              </div>
            ) : refusal === 'not-confirmed' ? (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                Tick the box above to say these two really are one payment. Nothing is deleted
                until you do.
              </p>
            ) : chosen ? (
              <div className="mt-4 flex items-start gap-2 rounded-lg px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300">
                <AlertTriangleIcon size={16} className="mt-0.5 flex-shrink-0" />
                <p className="text-sm">{deleteConsequence(chosen)}</p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                Pick one and this will say exactly what deleting it does before anything happens.
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  const key = duplicateDismissalKey(reviewing.a, reviewing.b);
                  setDismissed(prev => new Set(prev).add(key));
                  setDismissPrompt(reviewing);
                  setReviewing(null);
                  setChosenId(null);
                  setConfirmedSame(false);
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Not a duplicate — leave both
              </button>
              <button
                type="button"
                disabled={deleting || chosen === null || refusal !== null}
                onClick={() => void handleDelete()}
                className="justify-center px-4 py-2 text-sm font-medium rounded-lg bg-red-700 text-white hover:bg-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting…' : 'Delete the copy I chose'}
              </button>
            </div>
          </ModalFooter>
        </Modal>
      )}

      {dismissPrompt && (
        <DismissSuggestionPrompt
          isOpen
          subject="these two rows"
          keepingMeans="they drop off the list for now"
          saving={savingDismissal}
          onKeep={() => setDismissPrompt(null)}
          onDismiss={() => void handleDismiss()}
        />
      )}
    </Modal>
  );
}
