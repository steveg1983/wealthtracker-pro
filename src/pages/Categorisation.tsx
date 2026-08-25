import React, { useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { computeIncomeExpense } from '../utils/incomeExpense';
import { expandSplitTransactions, type SplitExpandedTransaction } from '../utils/transactionSplits';
import { groupUncategorisedByAccount } from '../utils/uncategorisedByAccount';
import { groupSuggestedByCategory, groupSuggestedByAccount } from '../utils/categoryProvenance';
import { preferences } from '../services/preferencesService';
import { useAttentionLadder } from '../hooks/useAttentionLadder';
import { DEPTH_LEVEL_1 } from '../styles/depthShading';
import { useAccountNames } from '../hooks/useAccountNames';
import { useToast } from '../contexts/ToastContext';
import TransferSweepModal from '../components/TransferSweepModal';
import BulkCategorizeModal from '../components/BulkCategorizeModal';
import ReportDrillModal, { type ReportDrillTarget } from '../components/reports/ReportDrillModal';
import { ArrowRightLeftIcon, TagIcon, ListIcon, CheckCircleIcon, ChevronRightIcon } from '../components/icons';
import EmptyState from '../components/EmptyState';
import type { Transaction } from '../types';

/** Which of the two suggested views the reader last chose. */
const SUGGESTED_VIEW_KEY = 'categorisationSuggestedView';

/**
 * Categorisation — the counterpart to Reconciliation.
 *
 * Reconciliation answers "does this account agree with the bank?". This page
 * answers "is every transaction filed?", which is the other thing that has to
 * be true before a report can be trusted. A row with no category is not income
 * and not an expense, so it is excluded from every total in the app; until it
 * is filed it is money the reports cannot see.
 *
 * The three ways out already existed, but only inside the report gallery — you
 * had to already be looking at a report to find them, which is backwards for a
 * chore you do deliberately. They live here now, and the reports' review band
 * still offers the same actions in place.
 *
 * Deliberately reads ALL transactions, not a period: a chore is only finished
 * when nothing is left, and a date filter would hide the work rather than do
 * it.
 */
export default function Categorisation(): React.JSX.Element {
  const { transactions, transactionSplits, categories, confirmTransactionCategories } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const { showSuccess, showError } = useToast();
  // One rule, app-wide — see utils/attentionLadder.
  const ladder = useAttentionLadder();

  const [drill, setDrill] = useState<ReportDrillTarget | null>(null);
  const [showTransferSweep, setShowTransferSweep] = useState(false);
  const [showBulkCategorize, setShowBulkCategorize] = useState(false);
  /** Which group button is mid-confirm, so it alone can say so. */
  const [confirmingCategoryId, setConfirmingCategoryId] = useState<string | null>(null);

  // Split parents become one row per line, so a half-filed split still shows
  // the line that needs a category rather than hiding behind its parent.
  const rows = useMemo(
    () => expandSplitTransactions(transactions, transactionSplits),
    [transactions, transactionSplits]
  );

  const flows = useMemo(() => computeIncomeExpense(rows, [], categories), [rows, categories]);

  const uncategorised = flows.uncategorizedRows;
  const count = uncategorised.length;

  // Includes CLOSED accounts — old history is exactly where the
  // uncategorised backlog lives, and "Unknown account" was just a failure
  // to look closed accounts up.
  const accountName = useAccountNames();

  /** Where the unfiled rows actually are, worst first. */
  const byAccount = useMemo(
    () => groupUncategorisedByAccount(uncategorised, accountName),
    [uncategorised, accountName]
  );

  /**
   * Categories the app guessed and nobody has agreed with yet.
   *
   * Deliberately built from the RAW transactions, not the split-expanded rows:
   * nothing in the app ever guesses a split line (a split is always typed by
   * hand or stated by an imported file), so expanding here would only invent
   * work. A split parent's own category is blank, which is not a suggestion
   * either — see categoryProvenance.
   */
  const suggestedGroups = useMemo(() => groupSuggestedByCategory(transactions), [transactions]);
  const suggestedCount = useMemo(
    () => suggestedGroups.reduce((sum, group) => sum + group.rows.length, 0),
    [suggestedGroups]
  );

  /**
   * The same suggestions seen BY ACCOUNT (owner, 24 Aug), each account's own
   * category groups beneath it — the shape the unfiled list above already
   * uses, and the one that answers "what has this card been guessing at?".
   * The category view stays the default: a guess is judged against its
   * category first, and an account is how you narrow it.
   *
   * Persisted, because it is a way of working rather than a one-off look.
   */
  const [suggestedView, setSuggestedView] = useState<'category' | 'account'>(
    () => (preferences.getItem(SUGGESTED_VIEW_KEY) === 'account' ? 'account' : 'category')
  );
  const chooseSuggestedView = (view: 'category' | 'account'): void => {
    setSuggestedView(view);
    preferences.setItem(SUGGESTED_VIEW_KEY, view);
  };

  const suggestedByAccount = useMemo(
    () => groupSuggestedByAccount(transactions, accountName),
    [transactions, accountName]
  );

  const categoryLabel = (categoryId: string): string =>
    categories.find(c => c.id === categoryId)?.name ?? 'Unknown category';

  const confirmGroup = async (
    categoryId: string,
    groupRows: Transaction[],
    /** Which BUTTON is busy — the account view has one per account+category. */
    busyKey: string = categoryId
  ): Promise<void> => {
    setConfirmingCategoryId(busyKey);
    try {
      const confirmed = await confirmTransactionCategories(groupRows.map(row => row.id));
      showSuccess(
        `${confirmed.toLocaleString()} transaction${confirmed === 1 ? '' : 's'} confirmed as ${categoryLabel(categoryId)}.`,
        'Categories confirmed'
      );
    } catch (error) {
      showError(error);
    } finally {
      setConfirmingCategoryId(null);
    }
  };

  const openDrill = (title: string, drillRows: SplitExpandedTransaction[]): void => {
    setDrill({ title, bucket: 'uncategorized', rows: drillRows, total: null });
  };

  /**
   * The suggested list is NOT the uncategorised bucket: those rows already have
   * a category, so the drill's blanks-only inline filing has nothing to do
   * there. 'neutral' gives the plain list with each row opening its editor,
   * which is the right escape hatch when a group needs looking at properly.
   */
  const openSuggestedDrill = (categoryId: string, groupRows: Transaction[]): void => {
    setDrill({
      title: `Suggested as ${categoryLabel(categoryId)}`,
      bucket: 'neutral',
      rows: groupRows,
      total: null,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Categorisation</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          A transaction with no category is left out of every total in the app. This is where you file them.
        </p>
      </div>

      {count === 0 ? (
        // The hand-rolled centred copy this page carried since batch 7 is what
        // exposed the inconsistency — and it was the one that was right. Now
        // the shared component, which the owner centred app-wide on 15 August.
        <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700">
          <EmptyState
            icon={<CheckCircleIcon size={32} className="text-blue-600 dark:text-blue-400" />}
            title="Everything is filed"
            description={
              suggestedCount === 0
                ? 'Every transaction has a category, so every report is counting all of your money.'
                : 'Every transaction has a category, so every report is counting all of your money — but some of those categories are still the app’s suggestions, below.'
            }
          />
        </div>
      ) : (
        <>
          {/* What is outstanding, and what it is worth. Two columns on a phone,
              four on a desktop — the same shape as the reconciliation bar. */}
          {/* THE LADDER DECIDES THE COLOUR, NOT THE COUNT (Design's per-app
              ruling, 24 Aug). Categorise is the bottom rung: while a feed is
              dead, or rows are unreviewed, or an account disagrees with its
              bank, this panel's figures are not yet facts — so it keeps
              every one of them and gives up only the amber. Standing down
              is about which work is NEXT, never about what the reader is
              allowed to know. */}
          <div className={`bg-white dark:bg-gray-800 rounded-xl border-2 p-4 ${
            ladder.wearsAmber('categorise')
              ? 'border-amber-300 dark:border-amber-600'
              : 'border-line dark:border-gray-700'
          }`}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Needs a category</p>
                <p className={`text-lg font-bold tabular-nums ${
                  ladder.wearsAmber('categorise')
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-gray-900 dark:text-white'
                }`}>
                  {count.toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Money in</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                  {formatCurrency(flows.uncategorizedIn.toNumber())}
                </p>
              </div>
              <div className="text-center col-span-2 md:col-span-1">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Money out</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                  {formatCurrency(flows.uncategorizedOut.toNumber())}
                </p>
              </div>
            </div>
          </div>

          {/* The three ways through, cheapest first: a transfer sweep can clear
              thousands of rows without a decision, filing a payee clears every
              row for that merchant at once, and one-by-one is the fallback. */}
          <div className="grid gap-3 md:grid-cols-3">
            <ActionCard
              icon={<ArrowRightLeftIcon size={22} />}
              title="Match transfers"
              body="Find equal-and-opposite pairs across your accounts and link them in one go. Money moved between your own accounts is neither income nor spending."
              onClick={() => setShowTransferSweep(true)}
            />
            <ActionCard
              icon={<TagIcon size={22} />}
              title="Categorise by payee"
              body="File a whole merchant at once, and teach future imports to file it for you."
              onClick={() => setShowBulkCategorize(true)}
            />
            <ActionCard
              icon={<ListIcon size={22} />}
              title="Review one by one"
              body={`Work through all ${count.toLocaleString()} outstanding transactions individually.`}
              onClick={() => openDrill('Uncategorised transactions', uncategorised)}
            />
          </div>

          {/* Which accounts the work is actually in — the same "pick one and
              clear it" shape as the reconciliation account list. */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">By account</h2>
            <div className="flex flex-col gap-2">
              {byAccount.map(({ accountId, rows: accountRows }) => (
                <button
                  key={accountId}
                  type="button"
                  onClick={() => openDrill(`Uncategorised — ${accountName(accountId)}`, accountRows)}
                  className="w-full text-left bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary hover:shadow-md transition-all p-4 flex items-center gap-3"
                >
                  <span className="font-medium text-gray-900 dark:text-white truncate min-w-0 flex-1">
                    {accountName(accountId)}
                  </span>
                  {/* NEUTRAL — a count is not a signal (Design, 25 Aug §4,
                      and their own rule since the 13th: "a zero, a count and a
                      settled row need none"). Five soft ambers sat here on the
                      page representing the STOOD-DOWN categorise rung, which
                      is precisely the erosion the ladder exists to prevent.
                      Not rung-dependent: a per-account count has no business
                      wearing the attention colour at any rung, so this is
                      neutral outright rather than conditional. */}
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {accountRows.length.toLocaleString()}
                  </span>
                  <ChevronRightIcon size={18} className="text-gray-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Suggestions waiting to be agreed with ────────────────────────────
          A separate chore from the one above, and deliberately below it: an
          unfiled row is money the reports cannot see, while a suggested row is
          already counted and merely unverified. Shown even when nothing is
          uncategorised, because "is every category actually mine?" is a
          question in its own right.

          There is no "confirm everything" button, and that is on purpose.
          Confirming without looking would relabel every guess as a decision in
          one click and put us straight back where we started — unable to tell
          what has been checked. A category group is the smallest unit that can
          honestly be judged at a glance. */}
      {suggestedCount > 0 && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Suggested categories ({suggestedCount.toLocaleString()})
            </h2>
            {/* The same segmented idiom the period picker uses. */}
            <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5">
              {([['category', 'By category'], ['account', 'By account']] as const).map(([view, label]) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => chooseSuggestedView(view)}
                  aria-pressed={suggestedView === view}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    suggestedView === view
                      ? 'bg-[#1a2332] dark:bg-[#2d3a4d] text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            The app filled these in from what you have filed before. They already count in your
            reports — confirming just records that you have checked them.
          </p>
          <div className="flex flex-col gap-2">
            {suggestedView === 'category'
              ? suggestedGroups.map(({ categoryId, rows: groupRows }) => (
                  <SuggestedGroupRow
                    key={categoryId}
                    label={categoryLabel(categoryId)}
                    rows={groupRows}
                    busy={confirmingCategoryId !== null}
                    confirming={confirmingCategoryId === categoryId}
                    onOpen={() => openSuggestedDrill(categoryId, groupRows)}
                    onConfirm={() => void confirmGroup(categoryId, groupRows)}
                  />
                ))
              : suggestedByAccount.map(({ accountId, rows: accountRows, categories: accountCategories }) => (
                  <div key={accountId} className="flex flex-col gap-2">
                    {/* The account heads its own categories — the depth ladder's
                        top step, as everywhere a section heads its rows. */}
                    <div className={`flex items-baseline justify-between gap-3 rounded px-2 py-2 ${DEPTH_LEVEL_1}`}>
                      <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
                        {accountName(accountId)}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {accountRows.length.toLocaleString()} suggested
                      </span>
                    </div>
                    {accountCategories.map(({ categoryId, rows: groupRows }) => (
                      <SuggestedGroupRow
                        key={`${accountId}-${categoryId}`}
                        label={categoryLabel(categoryId)}
                        rows={groupRows}
                        indent
                        busy={confirmingCategoryId !== null}
                        confirming={confirmingCategoryId === `${accountId}-${categoryId}`}
                        onOpen={() => openSuggestedDrill(categoryId, groupRows)}
                        // Confirms THIS ACCOUNT's rows for that category, not
                        // every account's: the view is the scope.
                        onConfirm={() => void confirmGroup(categoryId, groupRows, `${accountId}-${categoryId}`)}
                      />
                    ))}
                  </div>
                ))}
          </div>
        </div>
      )}

      <ReportDrillModal target={drill} onClose={() => setDrill(null)} categories={categories} />
      <TransferSweepModal isOpen={showTransferSweep} onClose={() => setShowTransferSweep(false)} />
      <BulkCategorizeModal isOpen={showBulkCategorize} onClose={() => setShowBulkCategorize(false)} />
    </div>
  );
}

function ActionCard({
  icon,
  title,
  body,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary hover:shadow-md transition-all p-4 flex flex-col gap-2 min-h-[48px]"
    >
      <span className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold">
        <span className="text-primary dark:text-blue-400">{icon}</span>
        {title}
      </span>
      <span className="text-sm text-gray-500 dark:text-gray-400">{body}</span>
    </button>
  );
}

/**
 * One suggested group — a guessed category, its size, and the way to agree
 * with it.
 *
 * NEUTRAL, not amber (Design ruling, 24 Aug §1a). Seven amber buttons in a
 * column was the most amber the app had ever shown at once, and under
 * Ruling A amber is "this one, next" — singular. These are not next actions
 * in that sense either: the panel above them says the rows already count in
 * the reports and confirming only records that they were checked, which
 * makes this optional bookkeeping. A quiet outline is what optional
 * bookkeeping looks like.
 */
function SuggestedGroupRow({
  label,
  rows,
  indent = false,
  busy,
  confirming,
  onOpen,
  onConfirm,
}: {
  label: string;
  rows: readonly Transaction[];
  indent?: boolean;
  busy: boolean;
  confirming: boolean;
  onOpen: () => void;
  onConfirm: () => void;
}): React.JSX.Element {
  return (
    <div
      className={`w-full bg-white dark:bg-gray-800 rounded-xl border border-line dark:border-gray-700 p-4 flex items-center gap-3 ${
        indent ? 'ml-4' : ''
      }`}
    >
      <div className="p-2 bg-gray-100 dark:bg-gray-700/50 rounded-lg flex-shrink-0">
        <TagIcon size={20} className="text-gray-500 dark:text-gray-400" />
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="font-medium text-gray-900 dark:text-white truncate min-w-0 flex-1 text-left hover:underline"
        title="Look through these transactions before deciding"
      >
        {label}
        <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
          {rows.length.toLocaleString()} transaction{rows.length === 1 ? '' : 's'}
        </span>
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy}
        className="px-4 h-[42px] inline-flex items-center justify-center text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
      >
        {confirming ? 'Confirming…' : 'Confirm these'}
      </button>
    </div>
  );
}
