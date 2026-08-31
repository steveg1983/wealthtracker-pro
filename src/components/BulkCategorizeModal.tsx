import React, { useMemo, useState } from 'react';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import CategorySelector from './CategorySelector';
import AccountSelector from './common/AccountSelector';
import { useAccountNames } from '../hooks/useAccountNames';
import { useNavigate, useLocation } from 'react-router-dom';
import IncomeExpenseBreakdownModal from './IncomeExpenseBreakdownModal';
import type { SplitExpandedTransaction } from '../utils/transactionSplits';
import { useApp } from '../contexts/AppContextSupabase';
import { useToast } from '../contexts/ToastContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { buildPayeeGroups, type PayeeGroup } from '../utils/payeeGroups';
import {
  planPayeeTransfers,
  PAYEE_TRANSFER_REFUSALS,
  type PayeeTransferBatch,
  type PayeeTransferQuestion,
  type PayeeTransferRefusalReason,
} from '../utils/payeeTransferPlan';
import { crossedCurrencies } from '../utils/crossCurrencyTransfer';
import { AlertTriangleIcon, ArrowDownIcon, ArrowRightLeftIcon, ArrowUpIcon, XIcon } from './icons';
import { getDateLocale } from '../utils/dateFormatter';

/**
 * Bulk categorise by payee: file a whole merchant in one decision.
 *
 * The review band is dominated by ordinary spending that never got a
 * category — the same merchants over and over. One decision per payee clears
 * dozens of rows, and because the app's payee memory keys on payee +
 * direction + account, the same decision also teaches future imports and
 * bank feeds.
 *
 * Groups where the payee has been filed before arrive pre-filled with the
 * category the user uses MOST for it (support count shown), so the common
 * case is: glance, confirm, apply.
 *
 * ─ A PAYEE CAN ALSO BE A TRANSFER ──────────────────────────────────────────
 * Owner, 31 Aug 2026: "in my list is American Express, that is the payments
 * from Danielle's current account to pay her American Express credit card, but
 * I can't bulk transfer, only categorise for income or expense." Those rows
 * have no category, because there is no category that is true of them: the
 * money did not leave the household, it moved between two of its accounts.
 *
 * So each payee row carries the register's own ⇄ toggle beside its picker, and
 * it does the register's own thing: the category list is replaced by the
 * account list, and the question changes from "what was this?" to "where did
 * it go?". The writes are the register's two as well — `linkTransferPair` and
 * `createTransferCounterpart` — so a pair made here is byte-for-byte a pair
 * made there.
 *
 * What is NOT bulk is the only decision that could invent money: whether the
 * other side is already sitting in that account. Every row that has a
 * plausible counterpart is put to the user one at a time — link it, or create
 * one anyway — because linking moves nothing and creating moves the target's
 * balance, and no sweep may pick between those on someone's behalf. See
 * utils/payeeTransferPlan, which decides which rows are which and why this is
 * allowed to be a bulk action at all.
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const CAP = 100;

type SortKey = 'payee' | 'rows' | 'total' | 'category';

/** Case-insensitive, so "Boots" and "BOOTS" sit together, not in two blocks. */
const compareText = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: 'base' });

/**
 * What one press actually did, counted as it happens.
 *
 * Kept as a running total rather than derived at the end because the
 * confirmations are answered one at a time and a run can be stopped halfway:
 * the summary has to be able to describe a press the user walked away from,
 * and "created 14, linked 2, left 1, and you stopped there" is the only honest
 * account of it.
 */
interface RunTally {
  /** Rows filed under a category, and the payees they came from. */
  categorised: number;
  categorisedPayees: number;
  /** Payees whose filing was refused outright. Counted per payee, as it happens. */
  categoriseFailedPayees: number;
  /** Rows converted with a brand-new other side written in the target account. */
  created: number;
  /** Rows joined to a row that was already over there. Balance-neutral. */
  linked: number;
  /** Rows the user chose to leave alone, or never reached. */
  skipped: number;
  /** Rows the write refused, counted once each however many retries. */
  failed: number;
  /** Rows that could never be converted, with the reason to say so. */
  refused: Array<{ reason: PayeeTransferRefusalReason; count: number }>;
}

/** A fresh nothing-yet tally. A factory, not a constant: it carries an array,
    and a shared one would be appended to by every press ever made. */
const emptyTally = (): RunTally => ({
  categorised: 0,
  categorisedPayees: 0,
  categoriseFailedPayees: 0,
  created: 0,
  linked: 0,
  skipped: 0,
  failed: 0,
  refused: [],
});

const shortDate = (date: Date | string): string =>
  new Date(date).toLocaleDateString(getDateLocale(), { day: '2-digit', month: 'short', year: 'numeric' });

/** "on the same day" reads better than "0 days apart", and it is what happened. */
const gapPhrase = (daysApart: number): string => {
  const days = Math.round(daysApart);
  return days === 0 ? 'on the same day' : `${days} day${days === 1 ? '' : 's'} apart`;
};

export default function BulkCategorizeModal({ isOpen, onClose }: Props): React.JSX.Element {
  const {
    transactions, categories, accounts,
    applyCategoryToUncategorized, linkTransferPair, createTransferCounterpart,
  } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  // Drill into ONE payee: its rows in the same inline-filing list the
  // one-by-one review uses — file a few by hand, save, come back, and bulk
  // the rest.
  const [drillGroup, setDrillGroup] = useState<PayeeGroup | null>(null);
  const [choices, setChoices] = useState<Record<string, string>>({});
  /**
   * The payee rows switched to "this is a transfer", and the account each one
   * names. A key being PRESENT is the mode; its value is the account, '' while
   * the question is still open — so one map answers both, and a row cannot be
   * in transfer mode with a category quietly still selected underneath.
   *
   * Toggling back off DELETES the key, which forgets the account, exactly as
   * the register's toggle does: an account chosen and then abandoned is not an
   * instruction, and a later flip back must not arrive pre-loaded with a
   * decision the user walked away from.
   */
  const [transferChoices, setTransferChoices] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState(0);
  /** Row-by-row progress through the outright creations, when there are any. */
  const [creating, setCreating] = useState<{ done: number; total: number } | null>(null);
  /** The one-by-one questions, and where the user has got to in them. */
  const [questions, setQuestions] = useState<PayeeTransferQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answering, setAnswering] = useState(false);
  /**
   * Rows whose write has already failed once. Held so a retry cannot count the
   * same row twice, and so skipping past a row that FAILED is reported as a
   * failure rather than as a choice the user made.
   */
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  /** Non-null from the moment a transfer press starts: the running account of it. */
  const [tally, setTally] = useState<RunTally | null>(null);
  // buildPayeeGroups already emits biggest-first (count desc, then total
  // desc), so Rows descending IS today's order — and Array#sort is stable, so
  // its total tie-break survives untouched until another column is clicked.
  const [sortKey, setSortKey] = useState<SortKey>('rows');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  // Closed accounts included — Money-era payees live in accounts long since
  // closed, and every one of them has a real name.
  const accountName = useAccountNames();

  const categoryName = useMemo(() => {
    const byId = new Map(categories.map(c => [c.id, c]));
    return (id: string): string => {
      const c = byId.get(id);
      if (!c) return '';
      const parent = c.parentId ? byId.get(c.parentId) : undefined;
      return parent && parent.level !== 'type' ? `${parent.name} : ${c.name}` : c.name;
    };
  }, [categories]);

  const groups = useMemo(
    () => (isOpen ? buildPayeeGroups(transactions, categories) : []),
    [isOpen, transactions, categories]
  );

  const keyOf = (g: PayeeGroup): string => `${g.payee}|${g.direction}`;

  /**
   * A suggestion is only pre-filled when the payee AGREES with itself.
   *
   * This screen applies a category to every row in a group at once, so a
   * pre-filled choice is one the user can accept without ever having examined
   * it. That is safe for a shop filed the same way 125 times out of 130, and
   * unsafe for a generic description — "ACCOUNT ADJUSTMENT", "UPDATE ON
   * PORTFOLIO VALUE" — filed a dozen different ways, where the most common
   * category is a plurality of a quarter and the rows behind it are portfolio
   * revaluations worth more than a year of real spending.
   *
   * Below the threshold the group still appears, still shows what the payee
   * has been filed as, and simply starts empty: it asks rather than assumes.
   */
  const SUGGESTION_MIN_AGREEMENT = 0.8;
  const suggestionIsTrustworthy = (g: PayeeGroup): boolean => {
    if (g.suggestedCategoryId === undefined) return false;
    const support = g.suggestionSupport ?? 0;
    const sample = g.suggestionSampleSize ?? support;
    if (sample <= 0) return false;
    return support / sample >= SUGGESTION_MIN_AGREEMENT;
  };

  /** Is this payee row asking "where did it go?" instead of "what was it?" */
  const isTransfer = (g: PayeeGroup): boolean => transferChoices[keyOf(g)] !== undefined;

  /** The account this payee's money moved to, or '' while it is undecided. */
  const transferTarget = (g: PayeeGroup): string => transferChoices[keyOf(g)] ?? '';

  // Pre-fill from the payee's own history; the user can change any of them.
  // A payee switched to transfer mode has no category choice at all — the
  // question it is answering is a different one.
  const effectiveChoice = (g: PayeeGroup): string =>
    isTransfer(g)
      ? ''
      : choices[keyOf(g)] ?? (suggestionIsTrustworthy(g) ? (g.suggestedCategoryId ?? '') : '');

  const setChoice = (g: PayeeGroup, categoryId: string): void => {
    setChoices(prev => ({ ...prev, [keyOf(g)]: categoryId }));
  };

  /**
   * Flip the picker between the category list and the account list.
   *
   * The category underneath survives the flip (it is held in `choices`, which
   * this never touches), so a mis-click costs nothing. The ACCOUNT does not —
   * see the note on `transferChoices`.
   */
  const toggleTransfer = (g: PayeeGroup): void => {
    const key = keyOf(g);
    setTransferChoices(prev => {
      if (prev[key] === undefined) return { ...prev, [key]: '' };
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const setTransferTarget = (g: PayeeGroup, accountId: string): void => {
    setTransferChoices(prev => ({ ...prev, [keyOf(g)]: accountId }));
  };

  /**
   * Where this payee's money could have gone: every open account the payee's
   * own rows are NOT already in.
   *
   * The exclusion is what makes "Current Account → Current Account" unofferable
   * rather than refused — the register's rule, applied to a group that may span
   * more than one account. `accounts` is the app's open-only list, which is
   * right here: a transfer INTO a closed account is not something to offer.
   */
  const transferTargetsFor = (g: PayeeGroup): typeof accounts =>
    accounts.filter(a => !g.accountIds.includes(a.id));

  /**
   * Why this payee cannot be transferred to the account it names — said on the
   * row, before the button is pressed, rather than discovered in a summary
   * afterwards.
   *
   * Only currency can be known this early, and it is the one that will actually
   * be met: creating the other side across a boundary needs the amount that
   * really arrived, which is a question per transaction and therefore the
   * register's job. Everything else payee groups already exclude.
   */
  const transferRefusal = (g: PayeeGroup): string | null => {
    const target = transferTarget(g);
    if (target === '') return null;
    const crossing = g.accountIds.some(id => crossedCurrencies(accounts, id, target) !== null);
    return crossing ? PAYEE_TRANSFER_REFUSALS['cross-currency'] : null;
  };

  /** Is this payee row a complete instruction, whichever question it answers? */
  const isReady = (g: PayeeGroup): boolean =>
    isTransfer(g)
      ? transferTarget(g) !== '' && transferRefusal(g) === null
      : effectiveChoice(g) !== '';

  /** What the row has been decided to be, or '' while it is undecided. */
  const chosenName = (g: PayeeGroup): string => {
    if (isTransfer(g)) {
      const target = transferTarget(g);
      // Prefixed, so the Category column sorts every transfer together rather
      // than scattering them among the categories by account name.
      return target === '' ? '' : `Transfer: ${accountName(target)}`;
    }
    const id = effectiveChoice(g);
    return id === '' ? '' : categoryName(id);
  };

  const compareGroups = (a: PayeeGroup, b: PayeeGroup): number => {
    switch (sortKey) {
      case 'payee':
        return sortDir * compareText(a.displayName, b.displayName);
      case 'rows':
        return sortDir * (a.count - b.count);
      // Group totals are magnitudes already, but Math.abs keeps the column
      // honest if a future group ever carries a signed total.
      case 'total':
        return sortDir * (Math.abs(a.total) - Math.abs(b.total));
      case 'category': {
        const an = chosenName(a);
        const bn = chosenName(b);
        // Undecided payees sink to the bottom in BOTH directions — hence not
        // multiplied by sortDir. This column is clicked to see what has
        // already been decided; a screenful of "Choose a category…" on top
        // would answer the opposite question.
        if (an === '' || bn === '') return an === bn ? 0 : an === '' ? 1 : -1;
        return sortDir * compareText(an, bn);
      }
    }
  };

  const handleSort = (key: SortKey): void => {
    if (key === sortKey) {
      setSortDir(d => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(key === 'rows' || key === 'total' ? -1 : 1);
    }
  };
  const arrow = (key: SortKey): string =>
    sortKey === key ? (sortDir === 1 ? ' ↑' : ' ↓') : '';

  // The cap is applied FIRST and the sort second, deliberately: the cap means
  // "the 100 biggest payees", and it goes on meaning that whichever column
  // the user sorts by afterwards. Sorting never pulls in a 101st payee.
  // (slice hands back a fresh array, so `groups` itself is never reordered.)
  const visible = groups.slice(0, CAP).sort(compareGroups);
  const ready = visible.filter(isReady);
  const readyCategories = ready.filter(g => !isTransfer(g));
  const readyTransfers = ready.filter(isTransfer);
  const rowsCovered = ready.reduce((sum, g) => sum + g.count, 0);
  const transferRowsCovered = readyTransfers.reduce((sum, g) => sum + g.count, 0);

  /** The rows behind a payee group, as transactions rather than ids. */
  const rowsOf = (g: PayeeGroup): PayeeTransferBatch['transactions'] => {
    const wanted = new Set(g.transactionIds);
    return transactions.filter(t => wanted.has(t.id));
  };

  /** One more of something, counted off the tally as React last saw it. */
  const bump = (change: (prev: RunTally) => Partial<RunTally>): void => {
    setTally(prev => {
      const base = prev ?? emptyTally();
      return { ...base, ...change(base) };
    });
  };

  const handleApply = async (): Promise<void> => {
    setApplying(true);
    setProgress(0);
    setCreating(null);
    setFailedIds(new Set());
    let done = 0;
    let rows = 0;
    let failed = 0;
    // Counted locally as well as in state, because the summary is assembled at
    // the end of this same function: React has not re-rendered yet, so `tally`
    // in this closure is still whatever it was when the press began.
    const run = emptyTally();
    try {
      for (const group of readyCategories) {
        const category = effectiveChoice(group);
        try {
          // Only fills blanks — an explicit category is never overwritten.
          const updated = await applyCategoryToUncategorized(group.transactionIds, category);
          rows += updated;
        } catch {
          failed++;
        }
        done++;
        setProgress(done);
      }
      run.categorised = rows;
      run.categorisedPayees = done - failed;
      run.categoriseFailedPayees = failed;

      // ─ The transfers, if any were asked for ────────────────────────────────
      if (readyTransfers.length === 0) {
        if (rows > 0) {
          showSuccess(
            `${rows.toLocaleString()} transaction${rows === 1 ? '' : 's'} categorised across ${(done - failed).toLocaleString()} payee${done - failed === 1 ? '' : 's'}.`,
            'Categories applied'
          );
        }
        if (failed > 0 && rows === 0) {
          showError(new Error('No transactions could be categorised. Please try again.'));
        }
        onClose();
        return;
      }

      /**
       * Every payee's rows decided against ONE snapshot of the ledger, before
       * a single write. Sharing the pass is what stops two payees pointing at
       * the same account being offered the same existing row twice, and taking
       * the snapshot first is what stops a counterpart this press CREATES
       * coming back round as a candidate for a later row of it.
       */
      const plan = planPayeeTransfers(
        readyTransfers.map(group => ({
          key: keyOf(group),
          displayName: group.displayName,
          transactions: rowsOf(group),
          targetAccountId: transferTarget(group),
        })),
        transactions,
        { accounts }
      );

      for (const reason of new Set(plan.refused.map(r => r.reason))) {
        run.refused.push({
          reason,
          count: plan.refused.filter(r => r.reason === reason).length,
        });
      }

      // The clerical part: rows with nothing plausible on the other side. Each
      // write is caught on its own, so one refusal cannot strand the rest.
      let createdSoFar = 0;
      setCreating({ done: 0, total: plan.createOutright.length });
      for (const [index, conversion] of plan.createOutright.entries()) {
        try {
          await createTransferCounterpart(conversion.transaction.id, conversion.targetAccountId);
          createdSoFar++;
        } catch (error) {
          // The FIRST failure is shown in full, because it names the reason.
          // The rest are counted into the summary instead: twenty identical
          // toasts would bury the very account of the press they belong to.
          if (run.failed === 0) showError(error);
          run.failed++;
        }
        setCreating({ done: index + 1, total: plan.createOutright.length });
      }
      run.created = createdSoFar;
      setCreating(null);

      setTally(run);
      setQuestions(plan.needsConfirmation);
      setQuestionIndex(0);
      // The questions (or, when there are none, the summary) take over from
      // here. The modal deliberately stays open: closing it now would leave a
      // press half-applied with nothing on screen to say what happened.
    } finally {
      setApplying(false);
    }
  };

  const currentQuestion: PayeeTransferQuestion | null =
    questionIndex < questions.length ? questions[questionIndex] : null;

  /** Move past the row on screen, counting it as the user's own choice. */
  const leaveThisOne = (question: PayeeTransferQuestion): void => {
    const wasFailure = failedIds.has(question.transaction.id);
    bump(t => (wasFailure ? { failed: t.failed + 1 } : { skipped: t.skipped + 1 }));
    setQuestionIndex(i => i + 1);
  };

  /**
   * Stop asking. Everything already applied stays applied — that is the whole
   * point of answering these one at a time — and every row not reached is
   * counted as left alone, so the summary adds up.
   */
  const stopAsking = (): void => {
    const remaining = questions.slice(questionIndex);
    const failures = remaining.filter(q => failedIds.has(q.transaction.id)).length;
    bump(t => ({
      skipped: t.skipped + remaining.length - failures,
      failed: t.failed + failures,
    }));
    setQuestionIndex(questions.length);
  };

  /**
   * Answer the row on screen: adopt the row already over there, or write a new
   * other side regardless and leave that row exactly as it is.
   *
   * A failure keeps the question UP rather than moving on — the register's own
   * behaviour on a failed transfer — because the user may want to retry, and
   * because the alternative is a row silently sliding past unfixed. The id is
   * remembered so a retry cannot count the row twice and so a later skip
   * reports it as a failure rather than as a decision.
   */
  const answer = async (question: PayeeTransferQuestion, action: 'link' | 'create'): Promise<void> => {
    setAnswering(true);
    try {
      if (action === 'link') {
        await linkTransferPair(question.transaction.id, question.candidate.transaction.id);
        bump(t => ({ linked: t.linked + 1 }));
      } else {
        await createTransferCounterpart(question.transaction.id, question.targetAccountId);
        bump(t => ({ created: t.created + 1 }));
      }
      setFailedIds(prev => {
        if (!prev.has(question.transaction.id)) return prev;
        const next = new Set(prev);
        next.delete(question.transaction.id);
        return next;
      });
      setQuestionIndex(i => i + 1);
    } catch (error) {
      showError(error);
      setFailedIds(prev => new Set(prev).add(question.transaction.id));
    } finally {
      setAnswering(false);
    }
  };

  /** The run is over: clear it away and close, as an applied press should. */
  const finishRun = (): void => {
    setTally(null);
    setQuestions([]);
    setQuestionIndex(0);
    setFailedIds(new Set());
    onClose();
  };

  // The nested step is modal in the true sense while it is up: the list behind
  // it is mid-press, and closing it would abandon a run halfway with no summary.
  const busy = applying || tally !== null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? () => {} : onClose}
      closeOnBackdrop={!busy}
      title="Categorise by payee"
      // 2xl: the category picker is the working column of this screen, and at
      // xl it was the cramped one — long "Parent > Child" names need the room.
      size="2xl"
    >
      <ModalBody>
        {groups.length === 0 ? (
          <p className="text-center py-10 text-gray-500 dark:text-gray-400">
            Nothing to categorise — every transaction with a payee already has a category.
          </p>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              One decision files a whole merchant. Payees you have filed before arrive
              pre-filled with the category you use most for them — and whatever you choose
              here is remembered, so future imports and bank feeds categorise themselves.
              Money that moved between your own accounts is not a category at all: press{' '}
              <ArrowRightLeftIcon size={12} className="inline align-[-1px]" aria-hidden="true" />{' '}
              beside a payee and name the account instead.
            </p>
            <div className="sm:overflow-x-auto">
              {/* Below sm the table reflows: each row becomes a grid with the
                  category picker on its own full-width line beneath the payee
                  — the four-column row forced sideways scrolling in portrait,
                  and the field being chosen was the part off-screen. */}
              <table className="block sm:table w-full">
                <thead className="hidden sm:table-header-group">
                  <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    {/* Headings sit CENTRED over their columns — the app-wide
                        convention. pr matches the body cells so each heading
                        centres on its column, not on the gap beside it. */}
                    {([
                      ['payee', 'Payee', 'pr-3', 'Sort by payee name'],
                      ['rows', 'Rows', 'pr-3', 'Sort by how many transactions'],
                      ['total', 'Total', 'pr-3', 'Sort by amount size'],
                      ['category', 'Category', 'w-80 lg:w-[26rem]', 'Sort by the category chosen — payees still undecided last'],
                    ] as const).map(([key, label, extra, hint]) => (
                      <th key={key} className={`text-center pb-2 font-medium ${extra}`}>
                        <button
                          type="button"
                          onClick={() => handleSort(key)}
                          className="hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                          title={hint}
                        >
                          {label}{arrow(key)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="block sm:table-row-group">
                  {visible.map(group => {
                    const key = keyOf(group);
                    const chosen = effectiveChoice(group);
                    const transferring = isTransfer(group);
                    const refusal = transferRefusal(group);
                    return (
                      <tr key={key} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-x-3 py-1 sm:py-0 sm:table-row border-b border-gray-50 dark:border-gray-700/50">
                        <td className="block sm:table-cell min-w-0 py-2 sm:pr-3">
                          <span className="flex items-center gap-1.5">
                            {group.direction === 'expense'
                              ? <ArrowDownIcon size={12} className="text-red-600 dark:text-red-400 flex-shrink-0" />
                              : <ArrowUpIcon size={12} className="text-green-600 dark:text-green-400 flex-shrink-0" />}
                            <button
                              type="button"
                              onClick={() => setDrillGroup(group)}
                              /* The resting ink here is deliberate and not
                                 blue, so only the hover was (ruling, 28 Aug
                                 2026). It cannot take `hover:text-secondary`:
                                 index.css puts that lift on the RESTING class,
                                 so on dark this name would hover from white to
                                 navy. The dotted rule underneath is already the
                                 affordance, so hovering firms it instead. */
                              className="text-sm text-gray-900 dark:text-white truncate max-w-[220px] lg:max-w-[340px] text-left underline decoration-dotted underline-offset-2 decoration-gray-300 dark:decoration-gray-600 hover:decoration-gray-500 dark:hover:decoration-gray-400"
                              title={`See the ${group.count.toLocaleString()} transactions behind this payee`}
                            >
                              {group.displayName}
                            </button>
                          </span>
                          <span className="block text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {new Date(group.earliest).toLocaleDateString(getDateLocale(), { month: 'short', year: 'numeric' })}
                            {' – '}
                            {new Date(group.latest).toLocaleDateString(getDateLocale(), { month: 'short', year: 'numeric' })}
                            {group.accountIds.length === 1
                              ? ` · ${accountName(group.accountIds[0])}`
                              : ` · ${group.accountIds.length} accounts`}
                            {/* "9" reads the same out of 10 filings as out of
                                36, so the sample size is shown beside it and
                                a payee that disagrees with itself says so. */}
                            {group.suggestedCategoryId && (
                              suggestionIsTrustworthy(group) ? (
                                <> · usually {categoryName(group.suggestedCategoryId)}{' '}
                                  ({group.suggestionSupport} of {group.suggestionSampleSize ?? group.suggestionSupport})</>
                              ) : (
                                <> · filed inconsistently — {categoryName(group.suggestedCategoryId)}{' '}
                                  only {group.suggestionSupport} of {group.suggestionSampleSize ?? group.suggestionSupport} times</>
                              )
                            )}
                          </span>
                          {/* A deliberate recent change stays one click away
                              instead of being buried under an older habit. */}
                          {!transferring && group.lastUsedCategoryId && chosen !== group.lastUsedCategoryId && (
                            <button
                              type="button"
                              onClick={() => setChoice(group, group.lastUsedCategoryId as string)}
                              disabled={applying}
                              /* "use last" files a category — it is an action,
                                 not navigation, so it is not a link however
                                 like one it reads (ruling, 28 Aug 2026). The
                                 hover underline is kept as the affordance. */
                              className="mt-1 text-xs text-gray-700 dark:text-gray-300 hover:underline disabled:opacity-50"
                            >
                              use last: {categoryName(group.lastUsedCategoryId)}
                            </button>
                          )}
                        </td>
                        <td className="block sm:table-cell py-2 sm:pr-3 text-sm text-right tabular-nums text-gray-700 dark:text-gray-300">
                          {group.count.toLocaleString()}
                        </td>
                        {/* group.total is a magnitude, so the colour comes from
                            group.direction — the same signal as the arrow, so the
                            two can never disagree. */}
                        <td className={`block sm:table-cell py-2 sm:pr-3 text-sm text-right tabular-nums whitespace-nowrap ${
                          group.direction === 'expense'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-green-600 dark:text-green-400'
                        }`}>
                          {formatCurrency(group.total)}
                        </td>
                        <td className="block sm:table-cell col-span-3 sm:col-auto pb-3 pt-0 sm:py-2">
                          <span className="flex items-center gap-1.5">
                            {transferring ? (
                              /* WHERE DID THE MONEY GO? — the register's own
                                 swap, in the register's own control: same box,
                                 same search, a different list. The direction
                                 comes from the payee's own sign, so money out
                                 asks "to" and money in asks "from" without the
                                 user having to translate. */
                              <AccountSelector
                                accounts={transferTargetsFor(group)}
                                selectedAccountId={transferTarget(group)}
                                onAccountChange={(accountId) => setTransferTarget(group, accountId)}
                                placeholder={group.direction === 'expense' ? 'Transfer to…' : 'Transfer from…'}
                                ariaLabel={`${group.direction === 'expense' ? 'Transfer to' : 'Transfer from'} account for ${group.displayName}`}
                                usePortal
                                className="w-full flex-1 min-w-0 px-3 py-2 h-[42px] rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-sm"
                              />
                            ) : (
                              <CategorySelector
                                selectedCategory={chosen}
                                onCategoryChange={(categoryId) => setChoice(group, categoryId)}
                                transactionType={group.direction}
                                includeAllTypes
                                showHelperText={false}
                                usePortal
                                placeholder="Choose a category…"
                                className="w-full flex-1 min-w-0"
                              />
                            )}
                            {/* THE TOGGLE, beside the field it changes — the
                                register's rule, and the register's icon. 42px
                                square: it matches the picker's own height, so
                                the two read as one control, and it is a touch
                                target a thumb can find on a phone.

                                aria-pressed rather than a checkbox: this is a
                                mode, not a value, and it has no label of its
                                own to tick. The ON colour is the app's one ON
                                colour (stock-blue ruling, 28 Aug 2026). */}
                            <button
                              type="button"
                              onClick={() => toggleTransfer(group)}
                              disabled={applying}
                              aria-pressed={transferring}
                              aria-label={`Transfer for ${group.displayName}`}
                              title={transferring
                                ? 'Back to categories — the category you had is still there'
                                : 'These are transfers: choose the account the money moved to instead of a category'}
                              className={`shrink-0 h-[42px] w-[42px] inline-flex items-center justify-center rounded-xl border transition-colors disabled:opacity-50 ${
                                transferring
                                  ? 'border-primary bg-primary/10 text-gray-900 dark:text-gray-100'
                                  : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-400 dark:hover:border-gray-500'
                              }`}
                            >
                              <ArrowRightLeftIcon size={16} />
                            </button>
                            {/* The way OUT of a pre-fill: back to "Choose a
                                category…", excluding this payee from the
                                apply so its rows can be filed line by line.
                                The slot is RESERVED even when empty, so
                                every picker in the column is one width —
                                rows with and without a clear button used to
                                render pickers of different sizes. */}
                            <span className="w-8 shrink-0 flex justify-center">
                              {(transferring ? transferTarget(group) !== '' : chosen !== '') && (
                                <button
                                  type="button"
                                  onClick={() => (transferring ? setTransferTarget(group, '') : setChoice(group, ''))}
                                  disabled={applying}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                                  title={transferring
                                    ? 'Clear — leave this payee out of this apply'
                                    : 'Clear — leave this payee to categorise line by line'}
                                  aria-label={transferring
                                    ? `Clear account for ${group.displayName}`
                                    : `Clear category for ${group.displayName}`}
                                >
                                  <XIcon size={14} />
                                </button>
                              )}
                            </span>
                          </span>
                          {/* Said on the row, before the button is pressed —
                              a payee that will not go anywhere should not look
                              ready and then be reported as skipped afterwards. */}
                          {refusal !== null && (
                            <span className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                              <AlertTriangleIcon size={12} className="mt-0.5 flex-shrink-0" />
                              <span>{refusal}</span>
                            </span>
                          )}
                          {transferring && refusal === null && transferTarget(group) !== '' && (
                            <span className="mt-1.5 block text-xs text-gray-500 dark:text-gray-400">
                              {group.count === 1
                                ? `This row becomes a transfer with ${accountName(transferTarget(group))}.`
                                : `${group.count.toLocaleString()} rows become transfers with ${accountName(transferTarget(group))}.`}
                              {' '}Anything already sitting over there is put to you one at a time
                              before a second copy is written.
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {groups.length > CAP && (
                    <tr className="block sm:table-row">
                      <td colSpan={4} className="block sm:table-cell py-3 text-center text-xs text-gray-400 dark:text-gray-500">
                        Showing the {CAP} biggest payees of {groups.length.toLocaleString()} —
                        apply these, then reopen for the next batch.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </ModalBody>
      <ModalFooter>
        {/* Stacked on phones: message, then two equal buttons. On one flex
            row the squeezed Cancel rendered its label off-centre. */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {applying
              ? creating !== null
                ? `Creating the other side — ${creating.done.toLocaleString()} of ${creating.total.toLocaleString()}…`
                : `Applying ${progress.toLocaleString()} of ${readyCategories.length.toLocaleString()} payees…`
              : (
                <>
                  {`${ready.length.toLocaleString()} payee${ready.length === 1 ? '' : 's'} ready — ${rowsCovered.toLocaleString()} transaction${rowsCovered === 1 ? '' : 's'}`}
                  {transferRowsCovered > 0 &&
                    `, ${transferRowsCovered.toLocaleString()} of them as transfers`}
                </>
              )}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleApply()}
              disabled={busy || ready.length === 0}
              className="justify-center px-4 py-2 text-sm font-medium rounded-lg bg-primary-action text-on-primary-action hover:bg-primary-action-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {/* The verb follows what is actually about to happen: a press
                  that converts transfers is not "categorising" them, and a
                  button that said so would misdescribe a write that moves
                  another account's balance. */}
              {applying
                ? 'Applying…'
                : transferRowsCovered > 0
                  ? `Apply to ${rowsCovered.toLocaleString()} transaction${rowsCovered === 1 ? '' : 's'}`
                  : `Categorise ${rowsCovered.toLocaleString()} transaction${rowsCovered === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </ModalFooter>
      {/* One payee, opened up: the same inline-filing list as the
          one-by-one review — pick categories row by row, Save in the
          header, saved rows leave — scoped to this payee. Clicking a row
          jumps to the transaction IN ITS ACCOUNT's register (selected and
          scrolled to), for the times only the surrounding history can say
          what something was. */}
      {drillGroup && (
        <IncomeExpenseBreakdownModal
          isOpen
          onClose={() => setDrillGroup(null)}
          title={`${drillGroup.displayName} — ${drillGroup.count.toLocaleString()} uncategorised`}
          bucket="uncategorized"
          rows={drillGroup.transactionIds
            .map(id => transactions.find(t => t.id === id))
            .filter((t): t is NonNullable<typeof t> => t !== undefined) as SplitExpandedTransaction[]}
          total={null}
          categories={categories}
          onEditTransaction={(txnId) => {
            const txn = transactions.find(t => t.id === txnId);
            if (!txn) return;
            const params = new URLSearchParams();
            params.set('txn', txnId);
            if (new URLSearchParams(location.search).get('demo') === 'true') {
              params.set('demo', 'true');
            }
            setDrillGroup(null);
            onClose();
            navigate(`/accounts/${txn.accountId}?${params.toString()}`);
          }}
          onApplyCategories={async (assignments) => {
            let updated = 0;
            for (const [categoryId, ids] of assignments) {
              updated += await applyCategoryToUncategorized(ids, categoryId);
            }
            showSuccess(
              `${updated.toLocaleString()} transaction${updated === 1 ? '' : 's'} categorised.`,
              'Categories applied'
            );
            return updated;
          }}
        />
      )}

      {/* ─ ONE QUESTION AT A TIME ────────────────────────────────────────────
          The owner's own instruction: "if the user clicks 'create the other
          side' and the system thinks there are some transactions already
          there, then one by one a warning comes up and the user has to confirm
          to leave it or to say, regardless, yes, still create the other side."

          A nested dialog rather than a strip, for the reason the register's
          strip is a strip: there is no run to protect here, nothing has focus
          in a list, and the evidence — two rows in two accounts — needs the
          room. It is the shape "Find duplicates" already uses for the same
          job, so a user who has met one has met both.

          Nothing here can be dismissed by accident: the backdrop is inert
          while a write is in flight, and every way out of the queue counts
          itself into the summary. */}
      {currentQuestion !== null && (
        <Modal
          isOpen
          onClose={() => (answering ? undefined : stopAsking())}
          closeOnBackdrop={!answering}
          title={`Is this already in ${accountName(currentQuestion.targetAccountId)}?`}
          size="lg"
        >
          <ModalBody>
            <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {currentQuestion.displayName} · {questionIndex + 1} of {questions.length}
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              <strong>{accountName(currentQuestion.targetAccountId)}</strong> already has a row for
              exactly the opposite amount, {gapPhrase(currentQuestion.candidate.daysApart)}. If that
              is the other side of this payment, <strong>link them</strong> — nothing new is written
              and no balance moves. If it is a different payment,{' '}
              <strong>create the other side anyway</strong>: a new row is added to{' '}
              {accountName(currentQuestion.targetAccountId)} for{' '}
              {formatCurrency(Math.abs(currentQuestion.transaction.amount))}, that account&rsquo;s
              balance moves by it, and the row already there is left exactly as it is.
              {currentQuestion.otherMatches > 0 && (
                <>
                  {' '}
                  {currentQuestion.otherMatches === 1
                    ? 'One other row over there matches as well'
                    : `${currentQuestion.otherMatches} other rows over there match as well`}
                  {' '}— this is the closest in date.
                </>
              )}
            </p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                ['This transaction', currentQuestion.transaction, accountName(currentQuestion.transaction.accountId)],
                [`Already in ${accountName(currentQuestion.targetAccountId)}`, currentQuestion.candidate.transaction, accountName(currentQuestion.targetAccountId)],
              ] as const).map(([label, row, where]) => (
                <div
                  key={row.id}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 min-w-0"
                >
                  <span className="block text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    {label}
                  </span>
                  {/* Sign as well as hue — the house amount idiom, and the only
                      way this reads for eyes that cannot tell the two colours
                      apart or for a screen reader saying it aloud. */}
                  <span className={`block text-lg font-bold tabular-nums ${
                    row.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                  }`}>
                    {row.amount < 0 ? '−' : '+'}{formatCurrency(Math.abs(row.amount))}
                  </span>
                  <span className="mt-1 block text-sm text-gray-900 dark:text-white break-words">
                    {row.description}
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    {shortDate(row.date)} · {where}
                  </span>
                  <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                    {row.category && categoryName(row.category)
                      ? `Filed as ${categoryName(row.category)}`
                      : 'Not categorised'}
                    {row.cleared === true && ' · reconciled'}
                  </span>
                </div>
              ))}
            </div>
          </ModalBody>
          <ModalFooter>
            {/* Stacked on phones, and the two answers kept apart from the two
                ways out: "link" and "create anyway" both write, and a thumb
                should not meet them in the same block as "leave this one". */}
            <div className="grid grid-cols-1 sm:flex sm:items-center gap-2 w-full">
              <button
                type="button"
                onClick={stopAsking}
                disabled={answering}
                className="px-4 py-2 text-sm font-medium rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Stop asking — keep what is done
              </button>
              <div className="grid grid-cols-1 sm:flex sm:items-center gap-2 sm:ml-auto">
                <button
                  type="button"
                  onClick={() => leaveThisOne(currentQuestion)}
                  disabled={answering}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Leave this one
                </button>
                <button
                  type="button"
                  onClick={() => void answer(currentQuestion, 'create')}
                  disabled={answering}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Create the other side anyway
                </button>
                <button
                  type="button"
                  onClick={() => void answer(currentQuestion, 'link')}
                  disabled={answering}
                  className="justify-center px-4 py-2 text-sm font-medium rounded-lg bg-primary-action text-on-primary-action hover:bg-primary-action-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {answering ? 'Working…' : 'Link these'}
                </button>
              </div>
            </div>
          </ModalFooter>
        </Modal>
      )}

      {/* What the press actually did — every row accounted for, including the
          ones nobody could apply. Said here rather than in a toast because a
          run that was stopped halfway is exactly the run whose account of
          itself must not scroll away. */}
      {currentQuestion === null && tally !== null && (
        <Modal
          isOpen
          onClose={finishRun}
          title="That is the lot"
          size="md"
        >
          <ModalBody>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              {tally.categorised > 0 && (
                <li>
                  <strong>{tally.categorised.toLocaleString()}</strong> transaction
                  {tally.categorised === 1 ? '' : 's'} categorised across{' '}
                  {tally.categorisedPayees.toLocaleString()} payee
                  {tally.categorisedPayees === 1 ? '' : 's'}.
                </li>
              )}
              {tally.created > 0 && (
                <li>
                  <strong>{tally.created.toLocaleString()}</strong> other side
                  {tally.created === 1 ? '' : 's'} created — those accounts&rsquo; balances have
                  moved by the amounts written.
                </li>
              )}
              {tally.linked > 0 && (
                <li>
                  <strong>{tally.linked.toLocaleString()}</strong> joined to a row that was already
                  there. Nothing new was written and no balance moved.
                </li>
              )}
              {tally.skipped > 0 && (
                <li>
                  <strong>{tally.skipped.toLocaleString()}</strong> left exactly as{' '}
                  {tally.skipped === 1 ? 'it was' : 'they were'} — still uncategorised, and still
                  here the next time you open this.
                </li>
              )}
              {tally.failed > 0 && (
                <li className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
                  <AlertTriangleIcon size={14} className="mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>{tally.failed.toLocaleString()}</strong> could not be applied. Those rows
                    are untouched — the message at the time said why, and they are still here to try
                    again.
                  </span>
                </li>
              )}
              {tally.categoriseFailedPayees > 0 && (
                <li className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
                  <AlertTriangleIcon size={14} className="mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>{tally.categoriseFailedPayees.toLocaleString()}</strong> payee
                    {tally.categoriseFailedPayees === 1 ? '' : 's'} could not be categorised. Those
                    rows are untouched and still here to try again.
                  </span>
                </li>
              )}
              {tally.refused.map(({ reason, count }) => (
                <li key={reason} className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
                  <AlertTriangleIcon size={14} className="mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>{count.toLocaleString()}</strong> left alone: {PAYEE_TRANSFER_REFUSALS[reason]}
                  </span>
                </li>
              ))}
              {tally.categorised === 0 && tally.created === 0 && tally.linked === 0 &&
                tally.skipped === 0 && tally.failed === 0 && tally.categoriseFailedPayees === 0 &&
                tally.refused.length === 0 && (
                <li>Nothing was changed.</li>
              )}
            </ul>
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              onClick={finishRun}
              className="ml-auto px-4 py-2 text-sm font-medium rounded-lg bg-primary-action text-on-primary-action hover:bg-primary-action-hover transition-colors"
            >
              Done
            </button>
          </ModalFooter>
        </Modal>
      )}
    </Modal>
  );
}
