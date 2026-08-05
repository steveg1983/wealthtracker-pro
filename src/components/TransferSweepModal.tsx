import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Modal, ModalBody, ModalFooter } from './common/Modal';
import { useApp } from '../contexts/AppContextSupabase';
import { useToast } from '../contexts/ToastContext';
import { useCurrencyDecimal } from '../hooks/useCurrencyDecimal';
import { sweepTransferPairs, type TransferPairSuggestion } from '../utils/transferSweep';
import {
  findStrandedTransfers,
  resolveAdjustmentCategory,
  type StrandedFinding,
} from '../utils/strandedTransfers';
import { applyStrandedFinding } from '../utils/strandedTransferActions';
import { useAccountNames } from '../hooks/useAccountNames';
import { AlertTriangleIcon, ArrowRightIcon } from './icons';
import type { Transaction } from '../types';

/**
 * Bulk transfer matching: find every unlinked equal-and-opposite pair in the
 * history, let the user review and deselect, then link them all.
 *
 * Nothing links without an explicit tick. Ambiguous pairs (an equally-good
 * alternative existed) start UNSELECTED and are badged, because a wrong link
 * silently rewrites the meaning of two accounts.
 *
 * Below the clean pairs sits the residue — rows that look like transfers but
 * whose other side is taken, filed or missing (utils/strandedTransfers). Those
 * are per-row, confirm-first corrections, each spelling out its consequence
 * before it happens.
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const CAP = 300;
const STRANDED_CAP = 100;

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

export default function TransferSweepModal({ isOpen, onClose }: Props): React.JSX.Element {
  const {
    transactions, categories, accounts, linkTransferPair,
    repairClaimedTransfer, setTransactionArchived, updateTransaction,
    updateAccount, refreshAccountsAndTransactions, refreshCategories,
  } = useApp();
  const { formatCurrency } = useCurrencyDecimal();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [inspecting, setInspecting] = useState<TransferPairSuggestion | null>(null);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reviewing, setReviewing] = useState<StrandedFinding | null>(null);
  const [resolving, setResolving] = useState(false);
  // "Leave it" is a decision for this sitting, not a stored one: the finding
  // drops out of the list now, and comes back next time if the data still
  // looks that way. Nothing is written for a refusal.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  // A leg in a CLOSED account can't open a register directly — this prompt
  // offers the Money-style way through: re-open the account, then jump to
  // the transaction. Same rule as the Accounts page (closed = no register),
  // just with the reopen offered where the user actually needs it.
  const [reopenPrompt, setReopenPrompt] = useState<{ accountId: string; txnId: string } | null>(null);
  const [reopening, setReopening] = useState(false);

  // Closed accounts included — old transfers routinely have one leg in an
  // account that has since been closed.
  const accountName = useAccountNames();

  const { suggestions } = useMemo(() => {
    if (!isOpen) return { suggestions: [] as TransferPairSuggestion[] };
    return sweepTransferPairs(transactions, {
      onlyUncategorised: true,
      categoryIds: new Set(categories.map(c => c.id)),
    });
  }, [isOpen, transactions, categories]);

  /**
   * The residue the clean sweep cannot pair. Composed with the suggestions
   * above rather than re-swept: a row the sweep already matched is not
   * stranded, and one pass over a long history is enough.
   */
  const findings = useMemo(() => {
    if (!isOpen) return [] as StrandedFinding[];
    return findStrandedTransfers(transactions, categories, { sweepSuggestions: suggestions }).findings;
  }, [isOpen, transactions, categories, suggestions]);

  // Resolved from the user's own categories — never created, never hardcoded.
  const adjustmentCategory = useMemo(() => resolveAdjustmentCategory(categories), [categories]);

  const keyOf = (s: TransferPairSuggestion): string => `${s.outgoing.id}|${s.incoming.id}`;
  const keyOfFinding = (f: StrandedFinding): string => `${f.kind}|${f.row.id}`;

  // Default selection: every unambiguous pair.
  const effectiveSelected = selected ?? new Set(
    suggestions.filter(s => !s.ambiguous).map(keyOf)
  );

  const toggle = (key: string): void => {
    const next = new Set(effectiveSelected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const visible = suggestions.slice(0, CAP);
  const chosen = suggestions.filter(s => effectiveSelected.has(keyOf(s)));

  const liveFindings = findings.filter(f => !dismissed.has(keyOfFinding(f)));
  const visibleFindings = liveFindings.slice(0, STRANDED_CAP);
  /** The adjustment filing is the ONLY offer for these two kinds — without the category they cannot run. */
  const needsAdjustmentCategory = (f: StrandedFinding): boolean =>
    f.kind === 'claimed' || f.kind === 'one-sided';

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
   * One transaction as an evidence card — shared by the clean-pair check and
   * every stranded review, so the two read as the same thing.
   *
   * The card jumps into its own account register with the transaction selected
   * (the same ?txn deep link the categorisation drills use); a leg in a CLOSED
   * account has no register, so it routes through the re-open prompt first.
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
        onClick={() => {
          if (!accountIsOpen) {
            setReopenPrompt({ accountId: t.accountId, txnId: t.id });
            return;
          }
          const params = new URLSearchParams();
          params.set('txn', t.id);
          if (new URLSearchParams(location.search).get('demo') === 'true') {
            params.set('demo', 'true');
          }
          setInspecting(null);
          setReviewing(null);
          onClose();
          navigate(`/accounts/${t.accountId}?${params.toString()}`);
        }}
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
          {new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
        {note && (
          <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">{note}</p>
        )}
      </button>
    );
  };

  const handleApply = async (): Promise<void> => {
    setApplying(true);
    setProgress(0);
    let linked = 0;
    let failed = 0;
    try {
      for (const pair of chosen) {
        try {
          await linkTransferPair(pair.outgoing.id, pair.incoming.id);
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
        showError(new Error('No pairs could be linked. Please try again.'));
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
        {suggestions.length === 0 && liveFindings.length === 0 ? (
          <p className="text-center py-10 text-gray-500 dark:text-gray-400">
            No unlinked transfer pairs found. Every equal-and-opposite movement in your
            history is already linked.
          </p>
        ) : suggestions.length > 0 && (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Found <strong>{suggestions.length.toLocaleString()}</strong> likely transfer
              pair{suggestions.length === 1 ? '' : 's'} — uncategorised rows that are exactly
              equal and opposite, in different accounts, within a few days. Linking them
              makes both sides transfers, so they leave your income and expense totals.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    <th className="pb-2 w-8"></th>
                    <th className="text-left pb-2 font-medium">Date</th>
                    <th className="text-left pb-2 font-medium">From → To</th>
                    <th className="text-left pb-2 font-medium">Description</th>
                    <th className="text-right pb-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(s => {
                    const key = keyOf(s);
                    return (
                      /* The WHOLE line drills into the both-sides popup — date,
                         accounts, description or amount, it makes no difference.
                         Only the checkbox cell stays out of it, so ticking a
                         pair never accidentally opens the inspection. */
                      <tr
                        key={key}
                        onClick={() => setInspecting(s)}
                        className="border-b border-gray-50 dark:border-gray-700/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                        title="See both sides of this pair"
                      >
                        <td className="py-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={effectiveSelected.has(key)}
                            onChange={() => toggle(key)}
                            disabled={applying}
                            aria-label={`Link ${formatCurrency(Math.abs(s.outgoing.amount))} transfer`}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="py-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {new Date(s.outgoing.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                          {s.daysApart > 0 && (
                            <span className="ml-1 text-xs text-gray-400">+{Math.round(s.daysApart)}d</span>
                          )}
                        </td>
                        <td className="py-2 text-sm text-gray-700 dark:text-gray-300">
                          <span className="inline-flex items-center gap-1 whitespace-nowrap">
                            <span className="truncate max-w-[140px]">{accountName(s.outgoing.accountId)}</span>
                            <ArrowRightIcon size={12} className="text-gray-400 flex-shrink-0" />
                            <span className="truncate max-w-[140px]">{accountName(s.incoming.accountId)}</span>
                          </span>
                          {s.ambiguous && (
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
                            {s.outgoing.description}
                          </span>
                        </td>
                        <td className="py-2 text-sm font-medium text-right tabular-nums text-gray-900 dark:text-white whitespace-nowrap">
                          {formatCurrency(Math.abs(s.outgoing.amount))}
                        </td>
                      </tr>
                    );
                  })}
                  {suggestions.length > CAP && (
                    <tr>
                      <td colSpan={5} className="py-3 text-center text-xs text-gray-400 dark:text-gray-500">
                        Showing the first {CAP.toLocaleString()} of {suggestions.length.toLocaleString()} pairs —
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
          <section className={suggestions.length > 0 ? 'mt-6 pt-5 border-t border-gray-200 dark:border-gray-700' : ''}>
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
                    <th className="text-left pb-2 font-medium">Date</th>
                    <th className="text-left pb-2 font-medium">Account</th>
                    <th className="text-left pb-2 font-medium">What is wrong</th>
                    <th className="text-right pb-2 font-medium">Amount</th>
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
                        {new Date(f.row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
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
      </ModalBody>
      <ModalFooter>
        <div className="flex items-center gap-3">
          {/* The footer belongs to the BULK action. With nothing to link in
              bulk it would otherwise read "0 of 0 selected" beside a dead
              button, while the real work sits in the stranded list above. */}
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {applying
              ? `Linking ${progress.toLocaleString()} of ${chosen.length.toLocaleString()}…`
              : suggestions.length === 0
                ? 'Each stranded row is fixed on its own, above.'
                : `${chosen.length.toLocaleString()} of ${Math.min(suggestions.length, CAP).toLocaleString()} selected`}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={applying}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {suggestions.length === 0 ? 'Close' : 'Cancel'}
            </button>
            {suggestions.length > 0 && (
              <button
                type="button"
                onClick={() => void handleApply()}
                disabled={applying || chosen.length === 0}
                className="justify-center px-4 py-2 text-sm font-medium rounded-lg bg-[#1a2332] dark:bg-blue-600 text-white hover:bg-[#2d3a4d] dark:hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[#1a2332] dark:bg-blue-600 text-white hover:bg-[#2d3a4d] dark:hover:bg-blue-700 transition-colors"
              >
                Yes — select this pair
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
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {STRANDED_REFUSE[reviewing.kind]}
              </button>
              <button
                type="button"
                disabled={resolving || (needsAdjustmentCategory(reviewing) && !adjustmentCategory)}
                onClick={() => void handleStranded(reviewing)}
                className="justify-center px-4 py-2 text-sm font-medium rounded-lg bg-[#1a2332] dark:bg-blue-600 text-white hover:bg-[#2d3a4d] dark:hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                      onClose();
                      navigate(`/accounts/${target}?${params.toString()}`);
                    } catch (error) {
                      showError(error);
                    } finally {
                      setReopening(false);
                    }
                  })();
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[#1a2332] dark:bg-blue-600 text-white hover:bg-[#2d3a4d] dark:hover:bg-blue-700 transition-colors disabled:opacity-50"
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
