import { toDecimal, type DecimalInstance } from './decimal';
import { buildFxRecord, deriveRate, readFxRecord, type FxRecord, type FxRateSource } from './fx';
import type { Account, Transaction } from '../types';

/**
 * What a cross-currency transfer needs on top of an ordinary one, in the two
 * places the app can produce one.
 *
 * ── WHY THERE ARE EXACTLY TWO PATHS, AND ONLY ONE OF THEM ASKS ──────────────
 *
 * **Creating** a pair means the app is about to write a figure into an account
 * nobody has quoted yet. There is no honest way to invent it — the mid-market
 * rate is not what a bank gave, and the engine refuses to copy the number
 * across (`create_transfer_counterpart`'s guard, untouched and permanent). So
 * the person is asked, and what they confirm is what gets written. Provenance:
 * `'api'` if they accepted a live quote untouched, `'manual'` if they typed or
 * edited anything.
 *
 * **Linking** two rows that already exist asks nothing, and must not. Both
 * figures are already real — they came from two banks, or from the MS Money
 * importer — and their ratio is the rate that was actually achieved, spread and
 * fees included. A dialog here would invite the user to "correct" a fact.
 * Provenance: `'derived'`.
 *
 * The second is the truer number of the two, which is why it is never
 * overwritten by the first: see {@link fxForLinkedPair}.
 */

/** A currency pair, once both sides are known to differ. */
export interface CrossCurrency {
  from: string;
  to: string;
}

/**
 * The two accounts' currencies when they form a real boundary, `null` when they
 * do not.
 *
 * Mirrors `link_transfer_pair`'s `crossed_currencies` in the Rust core and the
 * `v_a_currency IS NOT NULL AND …` test in the RPC: a currency nobody can
 * establish is not evidence that a conversion happened, so an unknown one reads
 * as "same" and the strict rules apply. Getting this backwards in the UI would
 * open a dialog for a pair the engines will then refuse.
 */
export function crossedCurrencies(
  accounts: readonly Account[],
  sourceAccountId: string,
  destinationAccountId: string
): CrossCurrency | null {
  return crossedCurrencyPair(
    accounts.find(account => account.id === sourceAccountId)?.currency,
    accounts.find(account => account.id === destinationAccountId)?.currency
  );
}

/**
 * The same rule, given the two currencies rather than the two accounts.
 *
 * Extracted so the CANDIDATE matchers can apply it too (utils/crossCurrencyMatch):
 * they ask it once per row against an index, and looking two accounts up in an
 * array for every row of a long history is a different cost entirely. What
 * matters is that both spellings cannot drift — "unknown reads as same" is the
 * conservative half of this rule and the half that would be easy to get
 * backwards in a second copy, so there is no second copy.
 */
export function crossedCurrencyPair(
  from: string | undefined,
  to: string | undefined
): CrossCurrency | null {
  if (!from || !to || from === to) return null;
  return { from, to };
}

/**
 * The `metadata.fx` a freshly LINKED pair earns, or `null` if it earns none.
 *
 * `null` in three cases, and each one matters:
 *
 * 1. **The accounts share a currency.** Nothing was converted, so a rate of 1
 *    would be a fact about arithmetic rather than about money.
 * 2. **Either leg already carries an `fx` record.** The creation flow writes
 *    the CONFIRMED rate onto both legs before linking them, and that record
 *    says whether a person accepted a quote or typed one. Re-deriving it here
 *    would produce the same number — it is derived from the very amounts they
 *    confirmed — wearing the wrong provenance. A stored `'manual'` silently
 *    becoming `'derived'` is a small lie about who is answerable for the
 *    figure, and provenance exists precisely so that question has an answer.
 * 3. **The arithmetic will not go through** — a zero source. The engines
 *    refuse such a pair, so this is unreachable behind a successful link, and
 *    it returns `null` rather than throwing because a metadata stamp is not
 *    worth failing a link that already succeeded.
 */
export function fxForLinkedPair(
  accounts: readonly Account[],
  a: Transaction,
  b: Transaction,
  asOf: Date
): FxRecord | null {
  if (!crossedCurrencies(accounts, a.accountId, b.accountId)) return null;
  if (readFxRecord(a.metadata) || readFxRecord(b.metadata)) return null;

  const rate = deriveRate(a.amount, b.amount);
  if (!rate.ok) return null;
  return buildFxRecord(rate.value, 'derived', asOf);
}

/**
 * A leg's metadata with an `fx` record added, leaving everything else alone.
 *
 * `metadata` is an open jsonb blob other writers share, so this merges rather
 * than replaces. Written as a free function because both the creation flow and
 * the link seam need it and a second spelling of "spread the old keys" is how
 * one of them eventually forgets to.
 */
export function withFxRecord(
  metadata: Record<string, unknown> | undefined,
  fx: FxRecord
): Record<string, unknown> {
  return { ...(metadata ?? {}), fx };
}

/** What the dialog hands back once the person has confirmed a conversion. */
export interface ConfirmedConversion {
  /** The destination amount, ABSOLUTE and to the penny. */
  destinationAmount: DecimalInstance;
  /** The rate that produced it, destination units per one source unit. */
  rate: DecimalInstance;
  /** Whether they accepted the quote or authored it. */
  source: Extract<FxRateSource, 'api' | 'manual'>;
  /** When the rate was true. */
  asOf: Date;
}

/**
 * The destination leg's SIGNED amount, given the source leg's.
 *
 * The one piece of arithmetic in the creation flow, and it is about sign rather
 * than about money: the confirmed magnitude is used exactly as confirmed, and
 * only its direction is decided here. Opposite to the source, always — which is
 * the rule the engines now enforce across a currency boundary and the only rule
 * they enforce there.
 */
export function destinationLegAmount(
  sourceAmount: DecimalInstance | number | string,
  destinationMagnitude: DecimalInstance
): DecimalInstance {
  const magnitude = destinationMagnitude.abs();
  return toDecimal(sourceAmount).isNegative() ? magnitude : magnitude.negated();
}

/** The writes {@link recordConvertedCounterpart} needs, named rather than imported. */
export interface CrossCurrencyWriteOps {
  addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<Transaction>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
  linkTransferPair: (idA: string, idB: string) => Promise<unknown>;
  deleteTransaction: (id: string) => Promise<unknown>;
}

/**
 * Give an EXISTING row its converted other side, and join the two.
 *
 * The register's route, where one leg is already in the ledger and only the far
 * side has to be written. (The add form's route writes both, because at that
 * point neither exists — see `AddTransactionModal.confirmConversion`. The two
 * sequences differ because the situations differ; what they share, and what
 * would actually be dangerous to duplicate, is the RULES, and those are the
 * functions above.)
 *
 * `create_transfer_counterpart` is not used and cannot be: it mints the far
 * side by copying −amount and refuses across a currency boundary, correctly.
 * This composes the two verbs that are legal here instead — one ordinary insert
 * into the target account in the target's own currency, and `link_transfer_pair`,
 * which converts nothing.
 *
 * ── ORDER, AND WHY THE SOURCE IS STAMPED LAST ───────────────────────────────
 *
 * The far side carries `metadata.fx` from its INSERT, so it is never in the
 * ledger without the rate that made it. The source is stamped only after the
 * link SUCCEEDS: stamping it first would leave a row claiming a conversion that
 * no second row and no link back it up, if the join then failed.
 *
 * A failed stamp is logged by the caller rather than unwound. The link is what
 * the user asked for and it happened; undoing a correct join to preserve a
 * receipt would be the wrong trade.
 *
 * @throws whatever the insert or the link threw, after unwinding the insert
 */
export async function recordConvertedCounterpart(
  ops: CrossCurrencyWriteOps,
  source: Transaction,
  target: { accountId: string; category: string },
  conversion: ConfirmedConversion
): Promise<void> {
  const fx = buildFxRecord(conversion.rate, conversion.source, conversion.asOf);
  const amount = destinationLegAmount(source.amount, conversion.destinationAmount);

  const counterpart = await ops.addTransaction({
    description: source.description,
    // Decimal to the boundary: one `toNumber`, on a value already at the penny.
    amount: amount.toNumber(),
    type: 'transfer',
    category: target.category,
    accountId: target.accountId,
    transferAccountId: source.accountId,
    date: source.date,
    notes: source.notes,
    metadata: { fx },
  });

  try {
    await ops.linkTransferPair(source.id, counterpart.id);
  } catch (linkError) {
    // Two unlinked rows are not a transfer — they are one real movement shown
    // twice, which double-counts in every report.
    await ops.deleteTransaction(counterpart.id);
    throw linkError;
  }

  await ops.updateTransaction(source.id, {
    metadata: withFxRecord(source.metadata, fx),
  });
}
