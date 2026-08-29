import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { useApp } from '../contexts/AppContextSupabase';
import { useHistoricalAccounts } from '../hooks/useHistoricalAccounts';
import { useToast } from '../contexts/ToastContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { useReferenceRates } from '../hooks/useReferenceRates';
import { amountWithCurrencyCode } from '../utils/crossCurrencyLabel';
import { sweepTransferPairs, type SplitLegSuggestion, type TransferPairSuggestion } from '../utils/transferSweep';
import {
  findStrandedTransfers,
  findUnmatchedSplitLegs,
  resolveAdjustmentCategory,
  type StrandedFinding,
  type UnmatchedSplitLegFinding,
} from '../utils/strandedTransfers';
import { applyStrandedFinding } from '../utils/strandedTransferActions';
import {
  dismissedKeys,
  legDismissalKey,
  legDismissalSubjectIds,
  pairDismissalKey,
  pairDismissalSubjectIds,
  strandedDismissalKey,
  strandedDismissalSubjectIds,
} from '../utils/suggestionDismissals';
import DismissedSuggestionsSection from './sweeps/DismissedSuggestionsSection';
import { useAccountNames } from '../hooks/useAccountNames';
import { AlertTriangleIcon, ArrowRightIcon } from './icons';
import type { DismissalKind, SuggestionDismissal, Transaction } from '../types';
import { getDateLocale } from '../utils/dateFormatter';

/**
 * Bulk transfer matching: find every unlinked equal-and-opposite pair in the
 * history, let the user review and deselect, then link them all.
 *
 * Nothing links without an explicit tick. Ambiguous pairs (an equally-good
 * alternative existed) start UNSELECTED and are badged, because a wrong link
 * silently rewrites the meaning of two accounts.
 *
 * The same table also carries LINE matches: one line of a split paired with
 * the row that is its other side (£35,000 arrives, £30,000 of it settles a
 * loan — the parent and that row match nothing, the LINE and that row match
 * exactly). They tick, sort and apply alongside the whole-transaction pairs,
 * and are marked as what they are, because accepting one changes a line inside
 * a transaction rather than the transaction itself.
 *
 * Below the clean pairs sits the residue — rows that look like transfers but
 * whose other side is taken, filed or missing (utils/strandedTransfers). Those
 * are per-row, confirm-first corrections, each spelling out its consequence
 * before it happens. Last of all, and deliberately WITHOUT any action, sit the
 * split lines whose other side could not be found at all: see
 * findUnmatchedSplitLegs for why inventing one, or re-filing the line, would
 * both be worse than saying so plainly.
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const CAP = 300;
const STRANDED_CAP = 100;

type PairSortKey = 'date' | 'accounts' | 'description' | 'amount';
type StrandedSortKey = 'date' | 'account' | 'problem' | 'amount';

/** The kinds of refusal this sweep can record — its half of the dismissals. */
const SWEEP_KINDS: readonly DismissalKind[] = ['transfer-pair', 'transfer-leg', 'stranded'];

/**
 * A refusal, written the moment it is made. There is no "and never again?"
 * follow-up any more (owner, 29 Aug: refusing a suggestion IS the judgment,
 * and the no-commitment path is closing the dialog without answering) — safe
 * as one step because every refusal is its own restorable row in "Dismissed
 * suggestions" at the foot of this window.
 */
interface RefusalToWrite {
  kind: DismissalKind;
  subjectKey: string;
  subjectIds: string[];
}

/** Case-insensitive, so "BARCLAYS" and "Barclays" sit together, not in two blocks. */
const compareText = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: 'base' });

/** The one-line summary of a finding, in the list. */
function strandedSummary(finding: StrandedFinding, accountName: (id: string) => string): string {
  const days = (n: number): string => `${Math.round(n)} day${Math.round(n) === 1 ? '' : 's'}`;
  switch (finding.kind) {
    case 'duplicate':
      return 'An identical row in this account on the same day is already a linked transfer — this looks like the same movement recorded twice.';
    case 'claimed':
      return finding.wonOnDescription
        ? `Its opposite in ${accountName(finding.counterpart.accountId)} is linked to a row the same distance away — but this row reads like a transfer and that one does not.`
        : `Its opposite in ${accountName(finding.counterpart.accountId)} is linked to a row ${days(finding.partnerDaysApart)} away, while this one is ${finding.daysApart === 0 ? 'the same day' : `${days(finding.daysApart)} away`}.`;
    case 'categorised':
      return `Its opposite in ${accountName(finding.counterpart.accountId)} is filed under “${finding.counterpartCategoryName}” — the same money, or a coincidence?`;
    case 'one-sided':
      return 'Nothing anywhere is the other side of this movement.';
  }
}

const STRANDED_TITLES: Record<StrandedFinding['kind'], string> = {
  duplicate: 'Imported twice?',
  claimed: 'Its other side is taken',
  categorised: 'Its other side is filed elsewhere',
  'one-sided': 'This transfer has no other side',
};

const STRANDED_BADGES: Record<StrandedFinding['kind'], string> = {
  duplicate: 'duplicate',
  claimed: 'taken',
  categorised: 'filed',
  'one-sided': 'no other side',
};

/**
 * What will HAPPEN, said before it happens — the house rule for every warning
 * in this app: name the consequence, not the count.
 */
const STRANDED_CONSEQUENCES: Record<StrandedFinding['kind'], string> = {
  duplicate:
    'This row will be hidden from the register — never deleted, and still counted in the account balance, so no figure moves. Bring it back any time with “Show archived”.',
  claimed:
    'Its current partner will be unlinked and filed as Account Adjustment, so nothing is left stranded.',
  categorised:
    'Both rows become one transfer: the category on the other side is replaced, and both leave your income and expense totals.',
  'one-sided':
    'It will be filed as Account Adjustment — a change in what the account is worth, so it counts as neither income nor spending. It will not become a transfer: a transfer with only one side would misstate both accounts.',
};

const STRANDED_CONFIRM: Record<StrandedFinding['kind'], string> = {
  duplicate: 'Archive this copy',
  claimed: 'Re-pair, and file the odd one out',
  categorised: 'Same money — link them',
  'one-sided': 'File as Account Adjustment',
};

const STRANDED_REFUSE: Record<StrandedFinding['kind'], string> = {
  duplicate: 'Not a duplicate — leave it',
  claimed: 'Leave the existing pair alone',
  categorised: 'Not the same money — leave it',
  'one-sided': 'Leave it uncategorised',
};

const STRANDED_DONE: Record<StrandedFinding['kind'], string> = {
  duplicate: 'The duplicate copy is archived — hidden from the register, and still there if you need it.',
  claimed: 'Re-paired. The row it displaced is filed as Account Adjustment, so nothing is left stranded.',
  categorised: 'Linked. Both sides are now one transfer and leave your income and expense totals.',
  'one-sided': 'Filed as Account Adjustment — neither income nor spending.',
};

/**
 * One line of the match table: a whole-transaction pair, or one LINE of a
 * split matched to the row on its other side. They share the table because
 * they are the same offer — "these two are one movement of money" — and differ
 * only in what accepting one writes.
 */
type SweepRow =
  | { kind: 'pair'; key: string; pair: TransferPairSuggestion }
  | { kind: 'leg'; key: string; leg: SplitLegSuggestion };

/** Selection key for a line match; the pair form is `keyOf` inside the component. */
const keyOfLeg = (l: SplitLegSuggestion): string => `split:${l.split.id}|${l.candidate.id}`;

/**
 * The two accounts a line match moves money between, in "From → To" order. A
 * line has no direction of its own beyond its SIGN: a positive line is money
 * arriving in the parent's account, so the row over there is the out side.
 */
function legAccounts(leg: SplitLegSuggestion): { from: string; to: string } {
  return leg.split.amount > 0
    ? { from: leg.candidate.accountId, to: leg.parent.accountId }
    : { from: leg.parent.accountId, to: leg.candidate.accountId };
}

/** What each sortable column reads, whichever kind of row it is looking at. */
interface RowFacts {
  date: number;
  route: string;
  description: string;
  /** Size of the movement — for a line match, the LINE's, not the parent's. */
  magnitude: number;
}

function factsOf(row: SweepRow, accountName: (id: string) => string): RowFacts {
  if (row.kind === 'pair') {
    const { outgoing, incoming } = row.pair;
    return {
      date: new Date(outgoing.date).getTime(),
      route: `${accountName(outgoing.accountId)} → ${accountName(incoming.accountId)}`,
      description: outgoing.description,
      // Magnitude: the two legs are equal and opposite, so the sign carries no
      // information here — only the size of the movement does.
      magnitude: Math.abs(outgoing.amount),
    };
  }
  const { split, parent } = row.leg;
  // A line has no date or payee of its own: it takes the parent's.
  const { from, to } = legAccounts(row.leg);
  return {
    date: new Date(parent.date).getTime(),
    route: `${accountName(from)} → ${accountName(to)}`,
    description: parent.description,
    magnitude: Math.abs(split.amount),
  };
}

/** Ascending by the given column; the caller applies the direction. */
function compareRows(
  a: SweepRow,
  b: SweepRow,
  key: PairSortKey,
  accountName: (id: string) => string
): number {
  const left = factsOf(a, accountName);
  const right = factsOf(b, accountName);
  switch (key) {
    case 'accounts':
      return compareText(left.route, right.route);
    case 'description':
      return compareText(left.description, right.description);
    case 'amount':
      return left.magnitude - right.magnitude;
    case 'date':
      return left.date - right.date;
  }
}

/**
 * Why the sweep could not offer a match for a split line — said in full,
 * because no action is offered and the sentence is all the user gets.
 */
function unmatchedLegReason(
  finding: UnmatchedSplitLegFinding,
  accountName: (id: string) => string
): string {
  const there = accountName(finding.target);
  switch (finding.reason) {
    case 'nothing-matches':
      return `Nothing in ${there} within a few days is the other side of this line.`;
    case 'linked':
      return `The row that would match it in ${there} is already half of another transfer.`;
    case 'split':
      return `The row that would match it in ${there} is itself split, and a split cannot be one side of a transfer.`;
    case 'archived':
      return `The row that would match it in ${there} is archived — bring it back into the register, then run this again.`;
    case 'filed':
      return `The row that would match it in ${there} is filed under “${finding.blockerCategoryName}” — the same money, or a coincidence? Nothing here will guess.`;
    case 'taken':
      return `The row that would match it in ${there} is already being offered to another match above — settle that one, then run this again.`;
  }
}

/** Ascending by the given column; the caller applies the direction. */
function compareFindings(
  a: StrandedFinding,
  b: StrandedFinding,
  key: StrandedSortKey,
  accountName: (id: string) => string
): number {
  switch (key) {
    case 'account':
      return compareText(accountName(a.row.accountId), accountName(b.row.accountId));
    // By the badge the row actually shows — duplicate / taken / filed / no
    // other side — so the column sorts by what the user can read in it.
    case 'problem':
      return compareText(STRANDED_BADGES[a.kind], STRANDED_BADGES[b.kind]);
    case 'amount':
      return Math.abs(a.row.amount) - Math.abs(b.row.amount);
    case 'date':
      return new Date(a.row.date).getTime() - new Date(b.row.date).getTime();
  }
}

export default function TransferSweepModal({ isOpen, onClose }: Props): React.JSX.Element {
  const {
    transactions, categories, accounts: openAccounts, transactionSplits, linkTransferPair,
    linkSplitLineTransfer, repairClaimedTransfer, setTransactionArchived, updateTransaction,
    updateAccount, refreshAccountsAndTransactions, refreshCategories,
    suggestionDismissals, suggestionDismissalsStatus, refreshSuggestionDismissals,
    dismissSuggestion, restoreSuggestion,
  } = useApp();

  /**
   * Open AND closed accounts (owner, 20 Aug: "Would we be able to read the
   * transactions of closed accounts for this?" — yes): the ledger already
   * holds every closed account's rows, and this sweep has always matched
   * across them; what it could not do was NAME a closed account, so a real
   * pair's row read "Unknown account". The matching itself is unchanged.
   */
  const accounts = useHistoricalAccounts(openAccounts);
  const { formatCurrency } = useCurrencyDecimal();
  // Asked for only while the sweep is open, and used for nothing but ORDER —
  // see useReferenceRates. If it never arrives the same rows are offered, sorted
  // by date and wording alone.
  const rateLookup = useReferenceRates(isOpen);
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [inspecting, setInspecting] = useState<TransferPairSuggestion | null>(null);
  const [inspectingLeg, setInspectingLeg] = useState<SplitLegSuggestion | null>(null);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reviewing, setReviewing] = useState<StrandedFinding | null>(null);
  const [resolving, setResolving] = useState(false);
  // "Leave it" answered NO to the follow-up: a decision for this sitting only.
  // Refused findings, keyed — the bridge between the click and the persisted
  // refusal arriving back through suggestionDismissals.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [restoringKey, setRestoringKey] = useState<string | null>(null);
  // A leg in a CLOSED account can't open a register directly — this prompt
  // offers the Money-style way through: re-open the account, then jump to
  // the transaction. Same rule as the Accounts page (closed = no register),
  // just with the reopen offered where the user actually needs it.
  const [reopenPrompt, setReopenPrompt] = useState<{ accountId: string; txnId: string } | null>(null);
  const [reopening, setReopening] = useState(false);
  // The clean-pair table starts UNSORTED. The sweep emits its own pairing
  // order and no column reproduces it: the Date cell shows the OUTGOING leg,
  // while the sweep ordered by whichever leg it reached first, and a pair's
  // two legs can fall on different days. So "as the sweep found them" is a
  // state of its own — nothing moves until a heading is clicked.
  const [pairSortKey, setPairSortKey] = useState<PairSortKey | null>(null);
  const [pairSortDir, setPairSortDir] = useState<1 | -1>(1);
  // The stranded classifier already emits oldest-first, so Date ascending IS
  // today's order — and Array#sort is stable, so its id tie-break survives.
  const [strandedSortKey, setStrandedSortKey] = useState<StrandedSortKey>('date');
  const [strandedSortDir, setStrandedSortDir] = useState<1 | -1>(1);

  // Closed accounts included — old transfers routinely have one leg in an
  // account that has since been closed.
  const accountName = useAccountNames();

  // Refusals the user has already made stick. Re-read on every open rather than
  // held from boot: another device may have dismissed something since.
  useEffect(() => {
    if (isOpen) void refreshSuggestionDismissals();
  }, [isOpen, refreshSuggestionDismissals]);

  /**
   * Whether the dismissal filter has run. Lists are held back until it has —
   * showing a suggestion for a second and then snatching it away is precisely
   * the experience this feature exists to end. An 'error' counts as checked:
   * the sweep still has to open, and it says below that the filter did not run.
   */
  const dismissalsChecked =
    suggestionDismissalsStatus === 'ready' || suggestionDismissalsStatus === 'error';
  const dismissedPairKeys = useMemo(
    () => dismissedKeys(suggestionDismissals, 'transfer-pair'),
    [suggestionDismissals]
  );
  const dismissedLegKeys = useMemo(
    () => dismissedKeys(suggestionDismissals, 'transfer-leg'),
    [suggestionDismissals]
  );
  const dismissedStrandedKeys = useMemo(
    () => dismissedKeys(suggestionDismissals, 'stranded'),
    [suggestionDismissals]
  );
  const sweepDismissals = useMemo(
    () => suggestionDismissals.filter(d => SWEEP_KINDS.includes(d.kind)),
    [suggestionDismissals]
  );
  const transactionsById = useMemo(
    () => new Map(transactions.map(t => [t.id, t])),
    [transactions]
  );

  // One pass finds both: the whole-transaction pairs, and the split LINES
  // whose other side is sitting unmatched in the account they name.
  const { suggestions, legSuggestions } = useMemo(() => {
    if (!isOpen) {
      return {
        suggestions: [] as TransferPairSuggestion[],
        legSuggestions: [] as SplitLegSuggestion[],
      };
    }
    return sweepTransferPairs(transactions, {
      onlyUncategorised: true,
      categoryIds: new Set(categories.map(c => c.id)),
      splits: transactionSplits,
      // The accounts turn on the third pass: pairs that cross a CURRENCY
      // boundary, which no amount bucket could ever have found. The rate table
      // only orders them — a pair is never withheld because a mid-market quote
      // disagrees with what the bank actually did.
      accounts,
      ...(rateLookup ? { rateLookup } : {}),
    });
  }, [isOpen, transactions, categories, transactionSplits, accounts, rateLookup]);

  /**
   * The residue the clean sweep cannot pair. Composed with the suggestions
   * above rather than re-swept: a row the sweep already matched is not
   * stranded, and one pass over a long history is enough.
   */
  const findings = useMemo(() => {
    if (!isOpen) return [] as StrandedFinding[];
    return findStrandedTransfers(transactions, categories, {
      sweepSuggestions: suggestions,
      // So a twin that is merely in another currency is recognised as a twin,
      // instead of the row being called one-sided and offered the Account
      // Adjustment filing — which for a real transfer leg is a misfiling.
      accounts,
      ...(rateLookup ? { rateLookup } : {}),
    }).findings;
  }, [isOpen, transactions, categories, suggestions, accounts, rateLookup]);

  /** Split lines with no other side anywhere — reported, never acted on. */
  const legFindings = useMemo(() => {
    if (!isOpen) return [] as UnmatchedSplitLegFinding[];
    return findUnmatchedSplitLegs(transactions, transactionSplits, categories, {
      sweepSuggestions: suggestions,
      legSuggestions,
    }).findings;
  }, [isOpen, transactions, transactionSplits, categories, suggestions, legSuggestions]);

  // Resolved from the user's own categories — never created, never hardcoded.
  const adjustmentCategory = useMemo(() => resolveAdjustmentCategory(categories), [categories]);

  const keyOf = (s: TransferPairSuggestion): string => `${s.outgoing.id}|${s.incoming.id}`;
  const keyOfFinding = (f: StrandedFinding): string => `${f.kind}|${f.row.id}`;

  // Whole-transaction pairs first, then the line matches: the same order the
  // sweep found them in, and the order the table opens in — less anything the
  // user has told this sweep to stop offering. (The selection key above and the
  // dismissal key are deliberately different things: selection is per-render
  // and positional, a dismissal is canonical and stored, so that it still
  // matches when a later scan reaches the same two rows from the other end.)
  const rows: SweepRow[] = !dismissalsChecked ? [] : [
    ...suggestions
      .filter(pair => !dismissedPairKeys.has(pairDismissalKey(pair)))
      .map(pair => ({ kind: 'pair' as const, key: keyOf(pair), pair })),
    ...legSuggestions
      .filter(leg => !dismissedLegKeys.has(legDismissalKey(leg)))
      .map(leg => ({ kind: 'leg' as const, key: keyOfLeg(leg), leg })),
  ];
  const isAmbiguous = (row: SweepRow): boolean =>
    row.kind === 'pair' ? row.pair.ambiguous : row.leg.ambiguous;
  /** Line matches still on offer — never the raw sweep count, which ignores dismissals. */
  const legRowCount = rows.filter(row => row.kind === 'leg').length;

  // Default selection: every unambiguous match, of either kind.
  const effectiveSelected = selected ?? new Set(
    rows.filter(row => !isAmbiguous(row)).map(row => row.key)
  );

  const toggle = (key: string): void => {
    const next = new Set(effectiveSelected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const sortPairsBy = (key: PairSortKey): void => {
    if (pairSortKey === key) {
      setPairSortDir(d => (d === 1 ? -1 : 1));
    } else {
      setPairSortKey(key);
      setPairSortDir(key === 'date' || key === 'amount' ? -1 : 1);
    }
  };
  const pairArrow = (key: PairSortKey): string =>
    pairSortKey === key ? (pairSortDir === 1 ? ' ↑' : ' ↓') : '';

  const sortStrandedBy = (key: StrandedSortKey): void => {
    if (strandedSortKey === key) {
      setStrandedSortDir(d => (d === 1 ? -1 : 1));
    } else {
      setStrandedSortKey(key);
      setStrandedSortDir(key === 'date' || key === 'amount' ? -1 : 1);
    }
  };
  const strandedArrow = (key: StrandedSortKey): string =>
    strandedSortKey === key ? (strandedSortDir === 1 ? ' ↑' : ' ↓') : '';

  // The cap is applied FIRST and the sort second, so "the first 300 the sweep
  // found" goes on meaning exactly that whichever column is sorted by. Row
  // order is presentation only: selection is keyed by the ids each match is
  // made of, and both `effectiveSelected` and `chosen` read the unsorted list.
  const pairPage = rows.slice(0, CAP);
  const visible = pairSortKey === null
    ? pairPage
    : [...pairPage].sort((a, b) => pairSortDir * compareRows(a, b, pairSortKey, accountName));
  const chosen = rows.filter(row => effectiveSelected.has(row.key));

  // Two filters, two lifetimes: `dismissed` is this sitting's refusals (the
  // user answered No to the follow-up), the stored keys are the ones they asked
  // never to see again.
  const liveFindings = !dismissalsChecked ? [] : findings.filter(f =>
    !dismissed.has(keyOfFinding(f)) && !dismissedStrandedKeys.has(strandedDismissalKey(f))
  );
  const visibleFindings = liveFindings.slice(0, STRANDED_CAP).sort(
    (a, b) => strandedSortDir * compareFindings(a, b, strandedSortKey, accountName)
  );
  const visibleLegFindings = dismissalsChecked ? legFindings : [];
  /** The adjustment filing is the ONLY offer for these two kinds — without the category they cannot run. */
  const needsAdjustmentCategory = (f: StrandedFinding): boolean =>
    f.kind === 'claimed' || f.kind === 'one-sided';

  /**
   * Write the refusal the moment it is made — see RefusalToWrite. A failed
   * write is told with its consequence, because the item is already out of
   * this sitting's view either way: the screen looks decided whether the
   * decision saved or not, and a refusal the user believes was remembered,
   * and was not, is the bug this whole feature exists to fix.
   */
  const persistRefusal = async (refusal: RefusalToWrite): Promise<void> => {
    try {
      await dismissSuggestion(refusal.kind, refusal.subjectKey, refusal.subjectIds);
      showSuccess(
        'It will not be offered again. Bring it back any time from “Dismissed suggestions” at the foot of this list.',
        'Refused — remembered'
      );
    } catch (error) {
      showError(error);
      showError(
        new Error(
          'That refusal was NOT saved — it stays out of this sitting, but it will be offered again the next time you run this.'
        )
      );
    }
  };

  const handleRestore = async (dismissal: SuggestionDismissal): Promise<void> => {
    setRestoringKey(dismissal.subjectKey);
    try {
      await restoreSuggestion(dismissal.kind, dismissal.subjectKey);
      showSuccess(
        'It is back in the list — close this and run the sweep again to see it.',
        'Restored'
      );
    } catch (error) {
      showError(error);
    } finally {
      setRestoringKey(null);
    }
  };

  const handleStranded = async (finding: StrandedFinding): Promise<void> => {
    setResolving(true);
    try {
      await applyStrandedFinding(finding, adjustmentCategory?.id ?? null, {
        linkTransferPair,
        updateTransaction,
        setTransactionArchived,
        repairClaimedTransfer,
      });
      showSuccess(STRANDED_DONE[finding.kind], 'Stranded transfer sorted');
      setReviewing(null);
    } catch (error) {
      // Surfaced verbatim: the database's own refusal says exactly which
      // precondition failed, and a silent failure here would be the worst
      // outcome of all. Nothing is half-applied — the re-pair is one
      // transaction — so the message never has to describe a partial state.
      showError(error);
    } finally {
      setResolving(false);
    }
  };

  /**
   * Open a transaction in its own account register, with the row selected (the
   * same ?txn deep link the categorisation drills use). A row in a CLOSED
   * account has no register, so it routes through the re-open prompt first.
   */
  const openTransaction = (t: Transaction): void => {
    if (!accounts.some(a => a.id === t.accountId)) {
      setReopenPrompt({ accountId: t.accountId, txnId: t.id });
      return;
    }
    const params = new URLSearchParams();
    params.set('txn', t.id);
    if (new URLSearchParams(location.search).get('demo') === 'true') {
      params.set('demo', 'true');
    }
    setInspecting(null);
    setInspectingLeg(null);
    setReviewing(null);
    onClose();
    navigate(`/accounts/${t.accountId}?${params.toString()}`);
  };

  /**
   * One transaction as an evidence card — shared by the clean-pair check and
   * every stranded review, so the two read as the same thing.
   *
   * `flex flex-col items-start` is load-bearing: it overrides the global
   * `button { display: inline-flex }` rule, which otherwise lays the card's
   * lines out side by side.
   */
  const renderLeg = (
    label: string,
    t: Transaction,
    colour: string,
    note?: string
  ): React.JSX.Element => {
    const accountIsOpen = accounts.some(a => a.id === t.accountId);
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => openTransaction(t)}
        title={accountIsOpen
          ? 'Open this transaction in its account'
          : 'This account is closed — click to re-open it and view the transaction'}
        className="flex flex-col items-start text-left rounded-xl border border-gray-200 dark:border-gray-700 p-4 transition-all hover:border-primary hover:shadow-md cursor-pointer"
      >
        <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">{label}</p>
        <p className={`text-lg font-bold tabular-nums ${colour}`}>
          {formatCurrency(Math.abs(t.amount))}
        </p>
        <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
          {accountName(t.accountId)}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 break-words">{t.description}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {new Date(t.date).toLocaleDateString(getDateLocale(), { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
        {note && (
          <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">{note}</p>
        )}
      </button>
    );
  };

  /**
   * ONE LINE of a split as an evidence card. The line's own amount is what
   * matches, so that is what leads; the parent's total is shown beside it
   * because the two differing is the entire point of a mixed split, and a card
   * that hid it would look like an arithmetic error. Opens the parent — the
   * line has no register row of its own.
   */
  const renderSplitLineCard = (leg: SplitLegSuggestion): React.JSX.Element => {
    const { split, parent } = leg;
    const accountIsOpen = accounts.some(a => a.id === parent.accountId);
    return (
      <button
        key={split.id}
        type="button"
        onClick={() => openTransaction(parent)}
        title={accountIsOpen
          ? 'Open the transaction this line belongs to'
          : 'This account is closed — click to re-open it and view the transaction'}
        className="flex flex-col items-start text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 p-4 transition-all hover:border-primary hover:shadow-md cursor-pointer"
      >
        <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
          One line of a split
        </p>
        <p className={`text-lg font-bold tabular-nums ${split.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
          {formatCurrency(Math.abs(split.amount))}
        </p>
        <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
          {accountName(parent.accountId)}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 break-words">{parent.description}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {new Date(parent.date).toLocaleDateString(getDateLocale(), { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
        <p className="mt-2 text-xs font-medium text-gray-700 dark:text-gray-300">
          {formatCurrency(Math.abs(split.amount))} of the {formatCurrency(Math.abs(parent.amount))} in this split,
          {' '}moving to {accountName(leg.candidate.accountId)}
        </p>
      </button>
    );
  };

  const handleApply = async (): Promise<void> => {
    setApplying(true);
    setProgress(0);
    let linked = 0;
    let failed = 0;
    try {
      for (const row of chosen) {
        try {
          if (row.kind === 'pair') {
            await linkTransferPair(row.pair.outgoing.id, row.pair.incoming.id);
          } else {
            // A line match links the LINE, not the parent — a different write
            // entirely, and the reason the two kinds share a table but not a
            // call.
            await linkSplitLineTransfer(row.leg.split.id, row.leg.candidate.id);
          }
          linked++;
        } catch {
          failed++;
        }
        setProgress(linked + failed);
      }
      if (linked > 0) {
        showSuccess(
          `${linked.toLocaleString()} transfer pair${linked === 1 ? '' : 's'} linked${failed > 0 ? ` — ${failed} could not be linked` : ''}.`,
          'Transfers matched'
        );
      }
      if (linked === 0 && failed > 0) {
        showError(new Error('No matches could be linked. Please try again.'));
      }
      onClose();
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={applying ? () => {} : onClose}
      closeOnBackdrop={!applying}
      title="Match transfers"
      size="xl"
    >
      <ModalBody>
        {suggestionDismissalsStatus === 'error' && (
          <p className="mb-3 text-sm rounded-lg px-3 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300">
            The list of suggestions you asked to leave out could not be read, so this list may
            include some of them. Nothing has changed — close this and try again in a moment.
          </p>
        )}
        {!dismissalsChecked ? (
          <p className="text-center py-10 text-gray-500 dark:text-gray-400">
            Checking which of these you have already dealt with…
          </p>
        ) : rows.length === 0 && liveFindings.length === 0 && visibleLegFindings.length === 0 ? (
          <p className="text-center py-10 text-gray-500 dark:text-gray-400">
            No unlinked transfer pairs found. Every equal-and-opposite movement in your
            history is already linked
            {sweepDismissals.length > 0 && ', or left out at your request below'}.
          </p>
        ) : rows.length > 0 && (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Found <strong>{rows.length.toLocaleString()}</strong> likely transfer
              pair{rows.length === 1 ? '' : 's'} — uncategorised rows that are exactly
              equal and opposite, in different accounts, within a few days. Linking them
              makes both sides transfers, so they leave your income and expense totals.
              {legRowCount > 0 && (
                <>
                  {' '}<strong>{legRowCount.toLocaleString()}</strong> of
                  them {legRowCount === 1 ? 'matches a single line' : 'match single lines'} inside
                  a split, not a whole row — marked <em>split line</em> below, because linking one
                  changes that line and the row it matches, and nothing else in the transaction.
                </>
              )}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    <th className="pb-2 w-8"></th>
                    {([
                      ['date', 'Date', 'text-center', 'Sort by date'],
                      ['accounts', 'From → To', 'text-center', 'Sort by account names'],
                      ['description', 'Description', 'text-center', 'Sort by description'],
                      ['amount', 'Amount', 'text-center', 'Sort by amount size'],
                    ] as const).map(([key, label, align, hint]) => (
                      <th key={key} className={`${align} pb-2 font-medium`}>
                        <button
                          type="button"
                          onClick={() => sortPairsBy(key)}
                          className="hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                          title={hint}
                        >
                          {label}{pairArrow(key)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map(row => row.kind === 'pair' ? (
                    /* The WHOLE line drills into the both-sides popup — date,
                       accounts, description or amount, it makes no difference.
                       Only the checkbox cell stays out of it, so ticking a
                       pair never accidentally opens the inspection. */
                    <tr
                      key={row.key}
                      onClick={() => setInspecting(row.pair)}
                      className="border-b border-gray-50 dark:border-gray-700/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                      title="See both sides of this pair"
                    >
                      <td className="py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={effectiveSelected.has(row.key)}
                          onChange={() => toggle(row.key)}
                          disabled={applying}
                          aria-label={
                            row.pair.crossCurrency
                              // Both figures, because they differ and the
                              // checkbox is the whole confirmation — a label
                              // naming one of them would understate what is
                              // being agreed to.
                              ? `Link ${amountWithCurrencyCode(row.pair.outgoing.amount, row.pair.crossCurrency.from)} to ${amountWithCurrencyCode(row.pair.incoming.amount, row.pair.crossCurrency.to)} transfer`
                              : `Link ${formatCurrency(Math.abs(row.pair.outgoing.amount))} transfer`
                          }
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="py-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(row.pair.outgoing.date).toLocaleDateString(getDateLocale(), { day: '2-digit', month: 'short', year: '2-digit' })}
                        {row.pair.daysApart > 0 && (
                          <span className="ml-1 text-xs text-gray-400">+{Math.round(row.pair.daysApart)}d</span>
                        )}
                      </td>
                      <td className="py-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                          <span className="truncate max-w-[140px]">{accountName(row.pair.outgoing.accountId)}</span>
                          <ArrowRightIcon size={12} className="text-gray-400 flex-shrink-0" />
                          <span className="truncate max-w-[140px]">{accountName(row.pair.incoming.accountId)}</span>
                        </span>
                        {row.pair.crossCurrency && (
                          /* The boundary, said on the row itself. Without it
                             two figures that do not match read as a mistake
                             the sweep made rather than as a conversion. */
                          <span
                            className="ml-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 whitespace-nowrap"
                            title={`These accounts count in different currencies, so the two amounts differ by whatever rate this conversion got. Linking records that rate; it creates nothing and moves no balance.`}
                          >
                            {row.pair.crossCurrency.from} → {row.pair.crossCurrency.to}
                          </span>
                        )}
                        {row.pair.ambiguous && (
                          <span
                            className="ml-2 inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 underline decoration-dotted underline-offset-2"
                            title="Other rows matched this amount equally well — look at both sides before linking"
                          >
                            <AlertTriangleIcon size={12} />
                            check
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="block truncate max-w-[220px] underline decoration-dotted underline-offset-2 decoration-gray-300 dark:decoration-gray-600">
                          {row.pair.outgoing.description}
                        </span>
                      </td>
                      <td className="py-2 text-sm font-medium text-right tabular-nums text-gray-900 dark:text-white whitespace-nowrap">
                        {row.pair.crossCurrency ? (
                          /* BOTH sides, stacked. A converted pair has two
                             different magnitudes and showing one of them —
                             which is all a same-currency pair ever needs —
                             would hide the figure being written into the other
                             account. */
                          <span className="flex flex-col items-end leading-tight">
                            <span>{amountWithCurrencyCode(row.pair.outgoing.amount, row.pair.crossCurrency.from)}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {amountWithCurrencyCode(row.pair.incoming.amount, row.pair.crossCurrency.to)}
                            </span>
                          </span>
                        ) : (
                          formatCurrency(Math.abs(row.pair.outgoing.amount))
                        )}
                      </td>
                    </tr>
                  ) : (
                    /* A LINE match. Same columns, same ticking, same bulk
                       apply — with the left rule and the "split line" badge
                       saying that accepting it changes one line inside a
                       transaction, and with the line's own amount against the
                       parent's total, since those two differing is the whole
                       point of the thing. The rule is a neutral: it says which
                       KIND of row this is, which the badge beside it already
                       says in words, and a kind is not something to attend to
                       (stock-blue ruling, 28 Aug 2026). */
                    <tr
                      key={row.key}
                      onClick={() => setInspectingLeg(row.leg)}
                      className="border-b border-gray-50 dark:border-gray-700/50 border-l-2 border-l-gray-300 dark:border-l-gray-600 bg-gray-50 dark:bg-gray-700/30 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                      title="See this split line and its match"
                    >
                      <td className="py-2 pl-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={effectiveSelected.has(row.key)}
                          onChange={() => toggle(row.key)}
                          disabled={applying}
                          aria-label={`Link ${formatCurrency(Math.abs(row.leg.split.amount))} split line transfer`}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="py-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(row.leg.parent.date).toLocaleDateString(getDateLocale(), { day: '2-digit', month: 'short', year: '2-digit' })}
                        {row.leg.daysApart > 0 && (
                          <span className="ml-1 text-xs text-gray-400">+{Math.round(row.leg.daysApart)}d</span>
                        )}
                      </td>
                      <td className="py-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                          <span className="truncate max-w-[140px]">
                            {accountName(legAccounts(row.leg).from)}
                          </span>
                          <ArrowRightIcon size={12} className="text-gray-400 flex-shrink-0" />
                          <span className="truncate max-w-[140px]">
                            {accountName(legAccounts(row.leg).to)}
                          </span>
                        </span>
                        <span
                          className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-[#f1f3f7] text-[#475569] dark:bg-gray-700 dark:text-gray-200"
                          title="One line of a split transaction — not the whole row"
                        >
                          split line
                        </span>
                        {row.leg.ambiguous && (
                          <span
                            className="ml-2 inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 underline decoration-dotted underline-offset-2"
                            title="Other rows matched this line equally well — look at both sides before linking"
                          >
                            <AlertTriangleIcon size={12} />
                            check
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="block truncate max-w-[220px] underline decoration-dotted underline-offset-2 decoration-gray-300 dark:decoration-gray-600">
                          {row.leg.parent.description}
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          {formatCurrency(Math.abs(row.leg.split.amount))} of the{' '}
                          {formatCurrency(Math.abs(row.leg.parent.amount))} in this split
                        </span>
                      </td>
                      <td className="py-2 text-sm font-medium text-right tabular-nums text-gray-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(Math.abs(row.leg.split.amount))}
                      </td>
                    </tr>
                  ))}
                  {rows.length > CAP && (
                    <tr>
                      <td colSpan={5} className="py-3 text-center text-xs text-gray-400 dark:text-gray-500">
                        Showing the first {CAP.toLocaleString()} of {rows.length.toLocaleString()} pairs —
                        link these, then run the sweep again for the rest.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* The residue: rows that look like transfers but whose other side is
            taken, filed or missing. Nothing here is bulk-applied — each one is
            a decision with a consequence, so each is reviewed on its own. The
            section simply does not exist when there is nothing to show. */}
        {liveFindings.length > 0 && (
          <section className={rows.length > 0 ? 'mt-6 pt-5 border-t border-gray-200 dark:border-gray-700' : ''}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Stranded transfers
              <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                {liveFindings.length.toLocaleString()}
              </span>
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-3">
              Rows that look like transfers, but whose other side is taken, filed, or missing.
              Review them one at a time — each fix says what it will do before it does it.
            </p>
            {!adjustmentCategory && liveFindings.some(needsAdjustmentCategory) && (
              <p className="mb-3 text-sm rounded-lg px-3 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300">
                Some of these can only be fixed by filing a row as <strong>Account Adjustment</strong>,
                and you have no such category. Add one under Revaluation in Categories, then come
                back — nothing here will invent it for you.
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    {([
                      ['date', 'Date', 'text-center', 'Sort by date'],
                      ['account', 'Account', 'text-center', 'Sort by account name'],
                      ['problem', 'What is wrong', 'text-center', 'Sort by what is wrong'],
                      ['amount', 'Amount', 'text-center', 'Sort by amount size'],
                    ] as const).map(([key, label, align, hint]) => (
                      <th key={key} className={`${align} pb-2 font-medium`}>
                        <button
                          type="button"
                          onClick={() => sortStrandedBy(key)}
                          className="hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                          title={hint}
                        >
                          {label}{strandedArrow(key)}
                        </button>
                      </th>
                    ))}
                    <th className="pb-2 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleFindings.map(f => (
                    /* The whole line opens the review — the button is there to
                       say so, not to be the only way in. */
                    <tr
                      key={keyOfFinding(f)}
                      onClick={() => setReviewing(f)}
                      className="border-b border-gray-50 dark:border-gray-700/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors align-top"
                      title="Look at the evidence for this row"
                    >
                      <td className="py-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(f.row.date).toLocaleDateString(getDateLocale(), { day: '2-digit', month: 'short', year: '2-digit' })}
                      </td>
                      <td className="py-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="block truncate max-w-[140px]">{accountName(f.row.accountId)}</span>
                      </td>
                      <td className="py-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="block truncate max-w-[260px] text-gray-900 dark:text-white">
                          {f.row.description}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                          <AlertTriangleIcon size={12} />
                          {STRANDED_BADGES[f.kind]}
                        </span>
                        <span className="block text-xs mt-0.5 max-w-[420px]">
                          {strandedSummary(f, accountName)}
                        </span>
                      </td>
                      <td className="py-2 text-sm font-medium text-right tabular-nums text-gray-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(Math.abs(f.row.amount))}
                      </td>
                      <td className="py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setReviewing(f)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                  {liveFindings.length > STRANDED_CAP && (
                    <tr>
                      <td colSpan={5} className="py-3 text-center text-xs text-gray-400 dark:text-gray-500">
                        Showing the first {STRANDED_CAP.toLocaleString()} of {liveFindings.length.toLocaleString()} —
                        sort these out, then run the sweep again for the rest.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Split lines whose other side could not be found. NOTHING here is
            offered as a fix, deliberately: creating the missing row could
            double a movement that already exists somewhere, and re-filing the
            line would rewrite what the user said the money was for — from a
            list that cannot even show them the rest of the split. So the
            finding says what is wrong, and the row opens the transaction. */}
        {visibleLegFindings.length > 0 && (
          <section className={rows.length > 0 || liveFindings.length > 0 ? 'mt-6 pt-5 border-t border-gray-200 dark:border-gray-700' : ''}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Split lines with no other side
              <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                {visibleLegFindings.length.toLocaleString()}
              </span>
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-3">
              One line inside each of these transactions says money moved to another account, but
              nothing over there matches it. <strong>Nothing here is changed for you</strong> — the
              missing row may exist under a different date or amount, and inventing one would count
              the same money twice. Open the transaction and decide.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    <th className="text-center pb-2 font-medium">Date</th>
                    <th className="text-center pb-2 font-medium">Account</th>
                    <th className="text-center pb-2 font-medium">What is wrong</th>
                    <th className="text-center pb-2 font-medium">Line</th>
                    <th className="pb-2 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLegFindings.slice(0, STRANDED_CAP).map(f => (
                    <tr
                      key={f.split.id}
                      className="border-b border-gray-50 dark:border-gray-700/50 align-top"
                    >
                      <td className="py-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(f.parent.date).toLocaleDateString(getDateLocale(), { day: '2-digit', month: 'short', year: '2-digit' })}
                      </td>
                      <td className="py-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="block truncate max-w-[140px]">{accountName(f.parent.accountId)}</span>
                      </td>
                      <td className="py-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="block truncate max-w-[260px] text-gray-900 dark:text-white">
                          {f.parent.description}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                          <AlertTriangleIcon size={12} />
                          split line, no other side
                        </span>
                        <span className="block text-xs mt-0.5 max-w-[420px]">
                          {unmatchedLegReason(f, accountName)}
                        </span>
                      </td>
                      <td className="py-2 text-sm font-medium text-right tabular-nums text-gray-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(Math.abs(f.split.amount))}
                        <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">
                          of {formatCurrency(Math.abs(f.parent.amount))}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => openTransaction(f.parent)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                  {visibleLegFindings.length > STRANDED_CAP && (
                    <tr>
                      <td colSpan={5} className="py-3 text-center text-xs text-gray-400 dark:text-gray-500">
                        Showing the first {STRANDED_CAP.toLocaleString()} of {visibleLegFindings.length.toLocaleString()}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* The way back out of every "never again" answered above. */}
        <DismissedSuggestionsSection
          dismissals={sweepDismissals}
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
          {/* The footer belongs to the BULK action. With nothing to link in
              bulk it would otherwise read "0 of 0 selected" beside a dead
              button, while the real work sits in the stranded list above. */}
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {applying
              ? `Linking ${progress.toLocaleString()} of ${chosen.length.toLocaleString()}…`
              : !dismissalsChecked
                ? 'Checking…'
                : rows.length === 0
                  ? 'Each row here is sorted out on its own, above.'
                  : `${chosen.length.toLocaleString()} of ${Math.min(rows.length, CAP).toLocaleString()} selected`}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={applying}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {rows.length === 0 ? 'Close' : 'Cancel'}
            </button>
            {rows.length > 0 && (
              <button
                type="button"
                onClick={() => void handleApply()}
                disabled={applying || chosen.length === 0}
                className="justify-center px-4 py-2 text-sm font-medium rounded-lg bg-primary-action text-on-primary-action hover:bg-primary-action-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {applying ? 'Linking…' : `Link ${chosen.length.toLocaleString()} pair${chosen.length === 1 ? '' : 's'}`}
              </button>
            )}
          </div>
        </div>
      </ModalFooter>
      {/* The check, made checkable: both legs side by side, in full, with
          the reason for the flag — and a verdict either way, one tap. */}
      {inspecting && (
        <Modal
          isOpen
          onClose={() => setInspecting(null)}
          title="Check this pair"
          size="lg"
        >
          <ModalBody>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {inspecting.ambiguous
                ? 'Flagged because other rows matched this amount equally well — make sure these two really are the same movement of money.'
                : 'Both sides of this suggested pair, in full — make sure these two really are the same movement of money.'}
              {inspecting.daysApart > 0 && (
                <> The two sides are <strong>{Math.round(inspecting.daysApart)} day{Math.round(inspecting.daysApart) === 1 ? '' : 's'} apart</strong>.</>
              )}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { label: 'Money out', t: inspecting.outgoing, colour: 'text-red-600 dark:text-red-400' },
                { label: 'Money in', t: inspecting.incoming, colour: 'text-green-600 dark:text-green-400' },
              ] as const).map(({ label, t, colour }) => renderLeg(label, t, colour))}
            </div>
          </ModalBody>
          <ModalFooter>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => {
                  const next = new Set(effectiveSelected);
                  next.delete(keyOf(inspecting));
                  setSelected(next);
                  setInspecting(null);
                  void persistRefusal({
                    kind: 'transfer-pair',
                    subjectKey: pairDismissalKey(inspecting),
                    subjectIds: pairDismissalSubjectIds(inspecting),
                  });
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Not a pair — leave it
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = new Set(effectiveSelected);
                  next.add(keyOf(inspecting));
                  setSelected(next);
                  setInspecting(null);
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-primary-action text-on-primary-action hover:bg-primary-action-hover transition-colors"
              >
                Yes — select this pair
              </button>
            </div>
          </ModalFooter>
        </Modal>
      )}

      {/* The same check for a LINE match, with the one thing that makes it
          different said plainly: what matches is the line, not the transaction
          it sits in, and only that line changes. */}
      {inspectingLeg && (
        <Modal
          isOpen
          onClose={() => setInspectingLeg(null)}
          title="Check this split line"
          size="lg"
        >
          <ModalBody>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {inspectingLeg.ambiguous
                ? 'Flagged because other rows matched this line equally well — make sure these two really are the same movement of money.'
                : 'One line of this split says money moved to another account, and the row beside it is exactly its opposite.'}
              {' '}Linking them makes <strong>that line</strong> and that row two halves of one
              transfer. The rest of the split is untouched, and the transaction&rsquo;s own total
              does not move.
              {inspectingLeg.daysApart > 0 && (
                <> The two sides are <strong>{Math.round(inspectingLeg.daysApart)} day{Math.round(inspectingLeg.daysApart) === 1 ? '' : 's'} apart</strong>.</>
              )}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {renderSplitLineCard(inspectingLeg)}
              {renderLeg(
                'Its other side',
                inspectingLeg.candidate,
                inspectingLeg.candidate.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => {
                  const next = new Set(effectiveSelected);
                  next.delete(keyOfLeg(inspectingLeg));
                  setSelected(next);
                  setInspectingLeg(null);
                  void persistRefusal({
                    kind: 'transfer-leg',
                    subjectKey: legDismissalKey(inspectingLeg),
                    subjectIds: legDismissalSubjectIds(inspectingLeg),
                  });
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Not a match — leave it
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = new Set(effectiveSelected);
                  next.add(keyOfLeg(inspectingLeg));
                  setSelected(next);
                  setInspectingLeg(null);
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-primary-action text-on-primary-action hover:bg-primary-action-hover transition-colors"
              >
                Yes — select this line
              </button>
            </div>
          </ModalFooter>
        </Modal>
      )}

      {/* One stranded row, all of its evidence, and the consequence of the fix
          spelled out before it happens — the same stacked check as the clean
          pairs, with a verdict either way. */}
      {reviewing && (
        <Modal
          isOpen
          onClose={() => (resolving ? undefined : setReviewing(null))}
          closeOnBackdrop={!resolving}
          title={STRANDED_TITLES[reviewing.kind]}
          size="lg"
        >
          <ModalBody>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {reviewing.kind === 'duplicate' && (
                <>
                  This row and the one beside it are the same amount, in the same account, on the
                  same day — and the other one is already a linked transfer. That is what a bank
                  feed and a Money import of the same movement look like.
                </>
              )}
              {reviewing.kind === 'claimed' && (
                <>
                  The other side of this movement is already linked to a different row —
                  {reviewing.wonOnDescription
                    ? ' the same number of days away as this one, but this row reads like a transfer and that one does not.'
                    : ` ${Math.round(reviewing.partnerDaysApart)} day${Math.round(reviewing.partnerDaysApart) === 1 ? '' : 's'} away, while this row is ${reviewing.daysApart === 0 ? 'the same day' : `${Math.round(reviewing.daysApart)} day${Math.round(reviewing.daysApart) === 1 ? '' : 's'} away`}.`}
                  {' '}Check all three before deciding.
                </>
              )}
              {reviewing.kind === 'categorised' && (
                <>
                  The exact opposite of this row exists in another account, but somebody filed it
                  under <strong>{reviewing.counterpartCategoryName}</strong>. That is either a
                  mis-filed transfer leg or two unrelated payments that happen to match —
                  <strong> nothing here can tell which</strong>, so look at both before you answer.
                </>
              )}
              {reviewing.kind === 'one-sided' && (
                <>
                  Nothing anywhere in your history is the other side of this movement, and a
                  transfer with one side would misstate both accounts. It can be filed as an
                  adjustment instead — a change in what the account is worth.
                </>
              )}
            </p>

            <div className={`grid grid-cols-1 gap-3 ${reviewing.kind === 'claimed' ? 'sm:grid-cols-3' : reviewing.kind === 'one-sided' ? 'sm:grid-cols-1' : 'sm:grid-cols-2'}`}>
              {renderLeg(
                'This row',
                reviewing.row,
                reviewing.row.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
              )}
              {reviewing.kind === 'duplicate' && renderLeg(
                'Already a transfer',
                reviewing.duplicateOf,
                reviewing.duplicateOf.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400',
                'Same account, same day, same amount'
              )}
              {reviewing.kind === 'claimed' && renderLeg(
                'Its other side',
                reviewing.counterpart,
                reviewing.counterpart.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400',
                reviewing.daysApart === 0
                  ? 'Same day as this row'
                  : `${Math.round(reviewing.daysApart)} day${Math.round(reviewing.daysApart) === 1 ? '' : 's'} from this row`
              )}
              {reviewing.kind === 'claimed' && renderLeg(
                'Linked to it today',
                reviewing.currentPartner,
                reviewing.currentPartner.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400',
                reviewing.partnerDaysApart === 0
                  ? 'Same day — this would displace it'
                  : `${Math.round(reviewing.partnerDaysApart)} day${Math.round(reviewing.partnerDaysApart) === 1 ? '' : 's'} from its partner`
              )}
              {reviewing.kind === 'categorised' && renderLeg(
                'Its other side',
                reviewing.counterpart,
                reviewing.counterpart.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400',
                `Filed as ${reviewing.counterpartCategoryName}`
              )}
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-lg px-3 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300">
              <AlertTriangleIcon size={16} className="mt-0.5 flex-shrink-0" />
              <p className="text-sm">{STRANDED_CONSEQUENCES[reviewing.kind]}</p>
            </div>

            {needsAdjustmentCategory(reviewing) && !adjustmentCategory && (
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                You have no <strong>Account Adjustment</strong> category, so this fix cannot run.
                Add one under Revaluation in Categories and come back — it is never created for
                you behind your back.
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                disabled={resolving}
                onClick={() => {
                  setDismissed(prev => new Set(prev).add(keyOfFinding(reviewing)));
                  setReviewing(null);
                  void persistRefusal({
                    kind: 'stranded',
                    subjectKey: strandedDismissalKey(reviewing),
                    subjectIds: strandedDismissalSubjectIds(reviewing),
                  });
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {STRANDED_REFUSE[reviewing.kind]}
              </button>
              <button
                type="button"
                disabled={resolving || (needsAdjustmentCategory(reviewing) && !adjustmentCategory)}
                onClick={() => void handleStranded(reviewing)}
                className="justify-center px-4 py-2 text-sm font-medium rounded-lg bg-primary-action text-on-primary-action hover:bg-primary-action-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resolving ? 'Working…' : STRANDED_CONFIRM[reviewing.kind]}
              </button>
            </div>
          </ModalFooter>
        </Modal>
      )}

      {/* The closed-account way through: closed accounts have no register
          (the Accounts-page rule), so viewing an old leg means re-opening
          the account first — offered here, where the need arises. Closing
          it again afterwards is one click on the Accounts page. */}
      {reopenPrompt && (
        <Modal isOpen onClose={() => (reopening ? undefined : setReopenPrompt(null))} title="Account is closed" size="md">
          <ModalBody>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong className="text-gray-900 dark:text-white">{accountName(reopenPrompt.accountId)}</strong>{' '}
              is closed, and closed accounts don&rsquo;t have an open register. To view this
              transaction the account must be re-opened first. Nothing else changes — every
              transaction is preserved either way, and you can close it again from the
              Accounts page whenever you&rsquo;re done.
            </p>
          </ModalBody>
          <ModalFooter>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setReopenPrompt(null)}
                disabled={reopening}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reopening}
                onClick={() => {
                  void (async () => {
                    setReopening(true);
                    try {
                      await updateAccount(reopenPrompt.accountId, { isActive: true });
                      // Same refresh recipe as the Accounts page's reopen:
                      // closed accounts are filtered out at load, and the DB
                      // trigger re-activated the transfer category.
                      await refreshAccountsAndTransactions();
                      await refreshCategories();
                      const params = new URLSearchParams();
                      params.set('txn', reopenPrompt.txnId);
                      if (new URLSearchParams(location.search).get('demo') === 'true') {
                        params.set('demo', 'true');
                      }
                      const target = reopenPrompt.accountId;
                      setReopenPrompt(null);
                      setInspecting(null);
                      setInspectingLeg(null);
                      onClose();
                      navigate(`/accounts/${target}?${params.toString()}`);
                    } catch (error) {
                      showError(error);
                    } finally {
                      setReopening(false);
                    }
                  })();
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-primary-action text-on-primary-action hover:bg-primary-action-hover transition-colors disabled:opacity-50"
              >
                {reopening ? 'Re-opening…' : 'Re-open and view'}
              </button>
            </div>
          </ModalFooter>
        </Modal>
      )}
    </Modal>
  );
}
