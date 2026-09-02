import React, { useCallback, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../../contexts/AppContextSupabase';
import { preserveDemoParam } from '../../utils/navigation';
import { preferences } from '../../services/preferencesService';
import {
  APPEARS_AT_BACKLOG,
  DISMISSED_PREFERENCE,
  ENGAGED_PREFERENCE,
  useHistoryPath,
} from './useHistoryPath';
import {
  BUDGET_WIZARD_PATH,
  CATEGORISATION_FILE_PATH,
  CATEGORISATION_PAYEES_PATH,
  CATEGORISATION_TRANSFERS_PATH,
} from '../../utils/pageOpenLink';
import { CheckCircleIcon } from '../icons';
import { formatCount } from '../../utils/localeFormat';

/**
 * BRINGING IN YOUR HISTORY — the ORDER, which is the part nothing told anybody.
 *
 * ── WHY THIS EXISTS (owner, 1 Sep 2026) ─────────────────────────────────────
 * Every tool this card points at already works, and a year of statements
 * imports fine. What no surface said was the SEQUENCE, and the sequence is the
 * whole difference between an afternoon and a month. The proof case is a real
 * ledger of several thousand unfiled rows: tidying the payees BEFORE
 * categorising by payee made the categorise pass dramatically cheaper, because
 * one decision then covered every spelling of one shop instead of six.
 *
 * So: seven steps, in the order that costs least, each one line and each a link
 * straight into its tool. This is the in-app half of the landing page's "it
 * takes some effort" promise — it states the effort rather than hiding it.
 *
 * ── WHO SEES IT, AND WHEN IT STOPS ──────────────────────────────────────────
 * It appears at a To Review backlog of {@link APPEARS_AT_BACKLOG} or more, and
 * once it has appeared it STAYS until it is dismissed. The latch is the point:
 * this card's own advice shrinks the number that summoned it, so a card gated on
 * the live count would vanish at step three of seven — mid-journey, with the
 * payoff step never seen. A fresh-start user never trips the threshold and never
 * meets it.
 *
 * That whole rule — the latch, the dismissal, the boot — lives in
 * `useHistoryPath` rather than here, because the DASHBOARD needs the same answer
 * to know whether to mount the first-steps card: while this guide is up, that
 * one stands down (owner, 1 Sep 2026), and "is the guide up?" may have exactly
 * one answer. The card WRITES the latch, being the thing that appears; the hook
 * only reads.
 *
 * ── OBSERVED, OR JUDGED BY THE PERSON ───────────────────────────────────────
 * Four steps are facts the ledger can answer honestly (accounts exist, a
 * hundred rows arrived, nothing awaits review, a budget is running), and those
 * carry no control at all — a derived tick cannot lie, a stored one can, which
 * is the FirstSteps ruling and it holds here too.
 *
 * Three are NOT observable, and pretending otherwise would be worse than a
 * checkbox. "Have you matched your transfers?" would mean recomputing sweep
 * suggestions on the dashboard — expensive on a real ledger, and dishonest if
 * done cheaply — and "have you tidied your payees enough?" has no fact behind
 * it at all: only the person doing it knows what "as much as you're comfortable
 * with" came to. So the owner approved manual ticks for those three. They are
 * real checkboxes, reversible (a mis-tick must be undoable) and persisted.
 *
 * Nothing is GATED on anything. The order is advice, not a lock — the numbering
 * and the copy carry the recommendation, and a user who wants step five first
 * is not stopped.
 *
 * ── WHY SETTLED IS DECIDED BY THE LEDGER ALONE ──────────────────────────────
 * When the four observed facts are all true the card stands down to its
 * dismissal, whether or not the three manual boxes were ever ticked. A backlog
 * of zero with budgets running IS the outcome those three steps exist to
 * produce; a card that went on asking for ticks over a finished ledger would be
 * refusing to believe its own eyes. Observed truth outranks a stored tick, in
 * both directions.
 *
 * ── WHERE THE STATE LIVES ───────────────────────────────────────────────────
 * The latch, the dismissal and the ticks are all statements about the USER, not
 * about this browser, so all three go in the preferences document and travel
 * between the phone and the desktop. Per-device localStorage was deliberately
 * rejected for the balance reminder's acknowledgement for exactly this reason,
 * and a guide dismissed on a laptop that reappeared on a phone would be the
 * same bug. They are read through `subscribe` rather than once at mount, because
 * the account's document lands a few hundred milliseconds into boot — a
 * dismissal read too early is a dismissed card on screen for the session. The
 * subscription that keeps the ticks live is the hook's, called below.
 *
 * ── EVERY STEP IS A LINK INTO ITS TOOL, INCLUDING THE MODAL ONES ────────────
 * Three of the seven end in a dialog or a disclosure that used to have no
 * address, so those steps could only have said "go here and press that". They
 * carry `?open=` addresses now (utils/pageOpenLink) and land on the thing
 * itself. The link is the whole instruction; nothing on this card asks the
 * reader to remember a second step after arriving.
 *
 * ── COLOUR ──────────────────────────────────────────────────────────────────
 * None. This is guidance, not a warning: neutral chrome throughout, no amber
 * and no red anywhere on it, because colour marks what needs attention and a
 * backlog somebody is already working through does not. A zero renders nothing
 * — the counter becomes a plain sentence rather than "0 left to review".
 */

/** The ledger is big enough to be "history" rather than a first week. */
const IMPORTED_ENOUGH = 100;

// The third preferences entry, beside the latch and the dismissal the hook owns
// — a statement about the USER for the same reason they are, and registered in
// PORTABLE_PREFERENCE_KEYS with them.
const TICKS_PREFERENCE = 'historyPath.ticks.v1';

/** The three steps only the person doing them can judge. */
type ManualStepId = 'transfers' | 'payees' | 'payee-categories';

/** Every step, in the order that costs least. */
type StepId = 'accounts' | 'import' | ManualStepId | 'sweep' | 'budgets';

const MANUAL_STEP_IDS: readonly ManualStepId[] = ['transfers', 'payees', 'payee-categories'];

const isManualStepId = (value: string): value is ManualStepId =>
  MANUAL_STEP_IDS.some(id => id === value);

interface StepCopy {
  title: string;
  /** One sentence: what it buys, or what it costs to skip. */
  detail: string;
  /** The tool, addressed. */
  to: string;
  done: boolean;
}

/**
 * Who answered the step.
 *
 * A discriminated union rather than a flag beside a widened id, so the branch
 * that renders the checkbox HAS a `ManualStepId` in hand and the toggle needs
 * no cast to be handed one. A cast here would be a promise to the compiler that
 * the copy below and the tick ids never drift apart; this makes them unable to.
 */
type Step =
  | (StepCopy & { judgedBy: 'ledger'; id: StepId })
  | (StepCopy & { judgedBy: 'you'; id: ManualStepId });

/**
 * The ticks the user has set, as a set of ids.
 *
 * Unknown ids are dropped rather than kept: a tick for a step that no longer
 * exists is nothing, and filtering here means the toggle below can write the
 * set back whole without carrying somebody else's rubbish forward. A corrupt
 * value costs exactly these three ticks, which is the deal every preference
 * call site makes (they are hand-editable strings by design).
 */
function readTicks(): ReadonlySet<ManualStepId> {
  try {
    const raw = preferences.getItem(TICKS_PREFERENCE);
    if (!raw) return new Set<ManualStepId>();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<ManualStepId>();
    const ticked = new Set<ManualStepId>();
    for (const entry of parsed) {
      if (typeof entry === 'string' && isManualStepId(entry)) ticked.add(entry);
    }
    return ticked;
  } catch {
    return new Set<ManualStepId>();
  }
}

/**
 * The marker column, 44px square on every screen.
 *
 * A fixed box rather than an icon with margins: it is the thumb's target for
 * the manual steps (the touch floor this app holds itself to), and using the
 * same box for the observed steps is what keeps the seven markers on one line
 * down the card instead of two.
 */
const MARKER_BOX = 'w-11 h-11 shrink-0 flex items-start justify-center pt-2.5';

export default function HistoryPathCard(): React.JSX.Element | null {
  const { accounts, transactions, budgets } = useApp();
  const location = useLocation();

  // The shared answer — see the hook. This card is one of its two readers.
  const { visible, backlog, engaged, dismissed } = useHistoryPath();
  const ticks = readTicks();

  // The latch. Written once, the first time the pile is big enough to be worth
  // teaching a sequence for — after which the live count no longer decides
  // whether this card exists. Not written to a dismissed card: a user who said
  // "hide this" is not engaged, and a write nobody can see is still a write.
  useEffect(() => {
    if (engaged || dismissed || backlog < APPEARS_AT_BACKLOG) return;
    preferences.setItem(ENGAGED_PREFERENCE, 'true');
  }, [engaged, dismissed, backlog]);

  const toggleTick = useCallback((id: ManualStepId): void => {
    const next = new Set(readTicks());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    preferences.setItem(TICKS_PREFERENCE, JSON.stringify([...next]));
  }, []);

  const dismiss = useCallback((): void => {
    preferences.setItem(DISMISSED_PREFERENCE, 'true');
  }, []);

  const steps: Step[] = [
    {
      id: 'accounts',
      title: 'Add your accounts',
      detail: 'Every imported row has to land in an account, so these come first.',
      to: '/accounts?action=add',
      done: accounts.length > 0,
      judgedBy: 'ledger',
    },
    {
      id: 'import',
      title: 'Import your statements',
      detail:
        'Three, six or twelve months back — the further you go, the more your budgets have to work from.',
      to: '/enhanced-import',
      done: transactions.length >= IMPORTED_ENOUGH,
      judgedBy: 'ledger',
    },
    {
      id: 'transfers',
      title: 'Match transfers first',
      detail:
        'Money moved between your own accounts is neither income nor spending; this clears rows without a single decision.',
      // The sweep itself, not the page it lives on — see utils/pageOpenLink.
      to: CATEGORISATION_TRANSFERS_PATH,
      done: ticks.has('transfers'),
      judgedBy: 'you',
    },
    {
      id: 'payees',
      title: 'Tidy your payees',
      detail:
        'Merge the spellings of one shop now — as much as you are comfortable with — and the next step files them together.',
      to: '/settings/payees',
      done: ticks.has('payees'),
      judgedBy: 'you',
    },
    {
      id: 'payee-categories',
      title: 'Categorise by payee',
      detail: 'One decision files a whole merchant, and teaches future imports to file it for you.',
      to: CATEGORISATION_PAYEES_PATH,
      done: ticks.has('payee-categories'),
      judgedBy: 'you',
    },
    {
      id: 'sweep',
      title: 'Sweep what’s left',
      detail: 'Filter the remainder on Categorisation, tick it, and file it in one press.',
      // The list revealed, not just the page: it is a disclosure rather than a
      // dialog, and the same parameter answers for it.
      to: CATEGORISATION_FILE_PATH,
      done: backlog === 0,
      judgedBy: 'ledger',
    },
    {
      id: 'budgets',
      title: 'Set budgets from your real year',
      detail: 'A budget built from what you actually spent is what all of the above was for.',
      // The wizard, which reads the year the six steps above have just tidied.
      to: BUDGET_WIZARD_PATH,
      // Read the same way the budget card further down THIS page reads it
      // (`budgets.filter(b => b.isActive)`). Two cards on one screen disagreeing
      // about whether the user has a budget is the kind of gap that gets read as
      // a bug, correctly.
      done: budgets.some(budget => budget.isActive),
      judgedBy: 'ledger',
    },
  ];

  // See the header: the ledger's four facts decide this, never the ticks.
  const settled = steps.every(step => step.judgedBy !== 'ledger' || step.done);

  // Dismissed, still booting, or never engaged — all three are the hook's
  // question, asked once and answered for the dashboard as well as for here.
  if (!visible) return null;

  return (
    <section
      aria-labelledby="history-path-heading"
      data-testid="history-path"
      className="bg-white dark:bg-gray-800 rounded-2xl border border-line dark:border-gray-700 p-4 sm:p-5"
    >
      <h2
        id="history-path-heading"
        className="text-card font-semibold text-gray-900 dark:text-white"
      >
        Bringing in your history
      </h2>

      {settled ? (
        /* Nothing left to point at. The card does not congratulate itself for
           a second screen — it says the job is done and offers the way out. */
        <p className="mt-1 text-body text-gray-500 dark:text-gray-400">
          Your history is in, it is filed, and your budgets are built from it.
        </p>
      ) : (
        <>
          <p className="mt-1 text-dense text-gray-500 dark:text-gray-400">
            Bringing in years of history takes an afternoon in this order, and a great deal longer
            in any other.
          </p>

          {/* THE LIVE MEASURE, in the shared predicate's terms. At zero it is a
              plain sentence rather than "0 left to review": a zero count
              renders nothing, and the house voice does not throw confetti. */}
          <p
            className="mt-2 text-body font-medium text-gray-900 dark:text-white tabular-nums"
            data-testid="history-path-counter"
          >
            {backlog > 0
              ? `${formatCount(backlog)} left to review`
              : 'Nothing left to review — the hard part is done.'}
          </p>

          <ol className="mt-3 space-y-1">
            {steps.map((step, index) => (
              <li key={step.id} className="flex items-start gap-2">
                {step.judgedBy === 'you' ? (
                  /* The label IS the 44px target, so the thumb has the whole
                     square rather than the checkbox's own 16. It stays after a
                     tick, because a mis-tick has to be reversible. */
                  <label className={`${MARKER_BOX} cursor-pointer`}>
                    <input
                      type="checkbox"
                      checked={step.done}
                      onChange={() => toggleTick(step.id)}
                      aria-label={`Mark “${step.title}” as done`}
                    />
                  </label>
                ) : (
                  /* A settled step is settled, not celebrated: the tick is
                     quiet, because colour marks what needs attention and a done
                     step needs none. Same two greys as the first-steps card. */
                  <span className={MARKER_BOX}>
                    <CheckCircleIcon
                      size={18}
                      aria-hidden="true"
                      className={
                        step.done
                          ? 'text-gray-400 dark:text-gray-500'
                          : 'text-gray-200 dark:text-gray-600'
                      }
                    />
                  </span>
                )}

                <div className="min-w-0 pt-2.5">
                  <span className="text-dense text-gray-400 dark:text-gray-500 tabular-nums mr-1.5">
                    {index + 1}.
                  </span>
                  {step.done ? (
                    <span className="text-body text-gray-400 dark:text-gray-500 line-through decoration-1">
                      {step.title}
                    </span>
                  ) : (
                    <>
                      {/* The underline is the whole hover: this link declines a
                          resting colour on purpose — the step's ink is the
                          card's, and an underline IS the link. Same answer as
                          the first-steps card, under the same ruling. */}
                      <Link
                        to={preserveDemoParam(step.to, location.search)}
                        className="text-body font-medium text-gray-900 dark:text-white hover:underline rounded"
                      >
                        {step.title}
                      </Link>
                      <span className="block text-dense text-gray-500 dark:text-gray-400">
                        {step.detail}
                      </span>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}

      <div className="mt-3 pt-3 border-t border-line dark:border-gray-700">
        {/* Quiet, and permanent: the choice is stored in the account's
            preferences, so hiding it on the desktop hides it on the phone. No
            way back in v1 — the preference is what a later build would clear. */}
        <button
          type="button"
          onClick={dismiss}
          className="min-h-[44px] sm:min-h-0 text-dense text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline underline-offset-2 rounded"
        >
          {settled ? 'You’re set up — hide this' : 'Hide this guide'}
        </button>
      </div>
    </section>
  );
}
