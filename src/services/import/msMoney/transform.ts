import { toDecimal } from '../../../utils/decimal';
import type { Account, Category, Transaction, TransactionSplit } from '../../../types';

/**
 * Microsoft Money → WealthTracker transform.
 *
 * Input is the normalised JSON produced by the native .mny reader (Jackcess +
 * Jackcess-Encrypt): every account, transaction, category and payee, with
 * amounts as EXACT decimal strings. This module maps that faithfully onto the
 * app's own model — and it maps cleanly because Money's internal model IS the
 * app's model: transfers as linked pairs, splits as a parent whose children
 * carry the categories, closed-not-deleted accounts, a 3-level category tree,
 * payee-per-transaction.
 *
 * Money is parsed through Decimal (never float) and stored as the app's
 * numeric amount at the boundary, exactly as the rest of the app stores it.
 *
 * The output is the four collections the app persists locally
 * (accounts / categories / transactions / transaction splits), plus a summary
 * of what was imported and what was simplified — so a human can check it.
 */

// ── Input shapes (from the .mny export JSON) ────────────────────────────────

export interface MnyAccount {
  id: number;
  name: string;
  moneyType: 'bank' | 'credit' | 'cash' | 'asset' | 'liability' | 'investment' | string;
  currencyCode: string | null;
  openingBalance: string;
  reconstructedBalance: string;
  closed: boolean;
  openDate: string | null;
  closeDate: string | null;
  comment: string | null;
}

export interface MnyCategory {
  id: number;
  name: string;
  parentId: number | null;
  level: number; // 0 = INCOME/EXPENSE root, 1 = sub, 2 = detail
  fullPath: string;
  hidden: boolean;
  kind: 'income' | 'expense';
}

export interface MnyPayee {
  id: number;
  name: string;
  parentId: number | null;
  hidden: boolean;
}

export type MnyRole = 'standalone' | 'splitParent' | 'splitChild' | 'transfer';

export interface MnyTransaction {
  id: number;
  accountId: number;
  date: string | null;      // ISO yyyy-MM-dd (extractor already nulled the year-9999 sentinel)
  amount: string;           // signed decimal string, base currency
  categoryId: number | null;
  payeeId: number | null;
  memo: string | null;
  ref: string | null;
  clearedStatus: number;    // 0 unreconciled, 1 cleared, 2 reconciled
  linkAccountId: number | null;
  role: MnyRole;
  splitParentId?: number | null;
  transferPairTxnId?: number | null;
  // v2 enrichments (from the split-anomaly forensics):
  isTransferLine?: boolean;             // a split child that is itself a transfer
  splitChildCount?: number;             // on split parents
  splitChildSum?: string;               // on split parents
  splitUnassignedRemainder?: string;    // on split parents
  splitReconciles?: boolean;            // on split parents
}

export interface MnyExport {
  accounts: MnyAccount[];
  categories: MnyCategory[];
  payees: MnyPayee[];
  transactions: MnyTransaction[];
}

// ── Output ──────────────────────────────────────────────────────────────────

export interface MsMoneyImportResult {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  transactionSplits: TransactionSplit[];
  summary: MsMoneyImportSummary;
}

export interface MsMoneyImportSummary {
  accounts: { total: number; open: number; closed: number };
  categories: { subs: number; details: number; hidden: number };
  transactions: {
    imported: number;
    standalone: number;
    transfers: number;
    splitTransactions: number;
    splitLines: number;
  };
  simplifications: string[];
}

// Stable, traceable ids so a re-run is idempotent and rows are debuggable.
const acctId = (h: number): string => `mny-acct-${h}`;
const catId = (h: number): string => `mny-cat-${h}`;
const txnId = (h: number): string => `mny-txn-${h}`;
const splitId = (parentH: number, seq: number): string => `mny-split-${parentH}-${seq}`;
// The per-account "To/From <account>" transfer category, mirroring the app's
// native account-managed transfer categories.
const transferCatId = (h: number): string => `mny-tofrom-${h}`;

const TYPE_ID: Record<'income' | 'expense', string> = {
  income: 'type-income',
  expense: 'type-expense',
};

// The uncategorised remainder of a partial Money split gets its own detail
// category, so a partial split still visually sums to its total (Money itself
// left that portion uncategorised in some months).
const UNASSIGNED_CAT_ID = 'mny-unassigned';

/** Money's account super-type → the app's account type. */
const mapAccountType = (moneyType: string): Account['type'] => {
  switch (moneyType) {
    case 'bank': return 'current';
    case 'credit': return 'credit';
    case 'cash': return 'current';
    case 'asset': return 'asset';
    case 'liability': return 'liability';
    case 'investment': return 'investment';
    default: return 'other';
  }
};

const toNumber = (decimalString: string): number => toDecimal(decimalString).toNumber();

const isoToDate = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

// ── Accounts ─────────────────────────────────────────────────────────────────

function transformAccounts(mny: MnyAccount[], nowIso: string): Account[] {
  return mny.map((a): Account => {
    // The app computes running balance as openingBalance + Σtransactions — the
    // SAME invariant Money uses. Money's opening is authoritative; its stored
    // "current" balance is a dead cache (uninitialised memory) so we never use
    // it. The reconstructed balance rides along as the display `balance`; the
    // ledger recomputes it from the imported transactions and must agree.
    return {
      id: acctId(a.id),
      name: a.name,
      type: mapAccountType(a.moneyType),
      balance: toNumber(a.reconstructedBalance),
      openingBalance: toNumber(a.openingBalance),
      openingBalanceDate: a.openDate ? isoToDate(a.openDate) : undefined,
      currency: a.currencyCode || 'GBP',
      isActive: !a.closed,
      notes: a.comment || undefined,
      lastUpdated: new Date(nowIso),
      createdAt: a.openDate ? isoToDate(a.openDate) : new Date(nowIso),
      updatedAt: new Date(nowIso),
    };
  });
}

// ── Categories (Money's 3-level tree → the app's type/sub/detail) ───────────

function transformCategories(mny: MnyCategory[]): { categories: Category[]; hiddenCount: number } {
  const categories: Category[] = [
    { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
    { id: 'type-expense', name: 'Expense', type: 'expense', level: 'type', isSystem: true },
    { id: 'type-transfer', name: 'Transfer', type: 'both', level: 'type', isSystem: true },
    // Holds the uncategorised remainder of Money's partial splits.
    { id: UNASSIGNED_CAT_ID, name: 'Unassigned (MS Money import)', type: 'both', level: 'detail', parentId: 'type-expense' },
  ];
  let hiddenCount = 0;

  for (const c of mny) {
    if (c.level === 0) continue; // INCOME/EXPENSE roots → the app's system type ids
    if (c.hidden) hiddenCount++;
    categories.push({
      id: catId(c.id),
      name: c.name,
      type: c.kind,
      level: c.level === 1 ? 'sub' : 'detail',
      parentId: c.level === 1 ? TYPE_ID[c.kind] : catId(c.parentId as number),
      // Money "hidden" ≈ the app's inactive: kept for existing transactions,
      // hidden from the category pickers.
      isActive: !c.hidden,
    });
  }
  return { categories, hiddenCount };
}

// ── Transactions ─────────────────────────────────────────────────────────────

function transformTransactions(
  exp: MnyExport,
  // hacct → the "To/From <account>" category id, so each transfer leg is filed
  // under the OTHER account's transfer category (the app's native model).
  toFromByAccount: Map<number, string>
): {
  transactions: Transaction[];
  splits: TransactionSplit[];
  counts: MsMoneyImportSummary['transactions'];
  simplifications: string[];
} {
  const payeeName = new Map<number, string>(exp.payees.map(p => [p.id, p.name]));
  // Only categories the app actually emits (Money levels 1/2) are valid
  // targets; a line categorised at a Money ROOT (INCOME/EXPENSE) has no app
  // equivalent and becomes uncategorised.
  const emittedCatIds = new Set<number>(exp.categories.filter(c => c.level >= 1).map(c => c.id));

  // Split children grouped under their parent, and the set of all split-child
  // ids (a transfer whose partner is a split child needs special handling).
  const childrenByParent = new Map<number, MnyTransaction[]>();
  const splitChildIds = new Set<number>();
  for (const t of exp.transactions) {
    if (t.role === 'splitChild' && t.splitParentId != null) {
      splitChildIds.add(t.id);
      const list = childrenByParent.get(t.splitParentId);
      if (list) list.push(t);
      else childrenByParent.set(t.splitParentId, [t]);
    }
  }

  // A transfer whose partner is a split LINE links to that line, so the line
  // ids (and each child's parent) are fixed up front — same numbering the
  // emitting loop uses (children in encounter order, 1-based).
  const splitLineIdByChild = new Map<number, string>();
  const splitParentByChild = new Map<number, number>();
  for (const [parentId, kids] of childrenByParent) {
    kids.forEach((k, i) => {
      splitLineIdByChild.set(k.id, splitId(parentId, i + 1));
      splitParentByChild.set(k.id, parentId);
    });
  }

  const transactions: Transaction[] = [];
  const splits: TransactionSplit[] = [];
  const counts = { imported: 0, standalone: 0, transfers: 0, splitTransactions: 0, splitLines: 0 };
  let remainderLines = 0;    // "Unassigned" lines added to genuinely-partial splits
  let signFlipped = 0;       // liability-account splits with inverted child signs
  let splitLegTransfers = 0; // transfer legs whose partner is a line inside a split

  const resolveCategory = (categoryId: number | null): string =>
    categoryId != null && emittedCatIds.has(categoryId) ? catId(categoryId) : '';

  const describe = (t: MnyTransaction): string => {
    const payee = t.payeeId != null ? payeeName.get(t.payeeId) : undefined;
    return (payee && payee.trim()) || (t.memo && t.memo.trim()) || 'Imported transaction';
  };

  // The memo becomes notes only when a distinct payee already supplied the
  // description, so we never duplicate the same text into both fields.
  const notesOf = (t: MnyTransaction): string | undefined => {
    const payee = t.payeeId != null ? payeeName.get(t.payeeId) : undefined;
    return payee && t.memo ? t.memo : undefined;
  };

  const baseFields = (t: MnyTransaction) => ({
    date: isoToDate(t.date as string),
    description: describe(t),
    accountId: acctId(t.accountId),
    // Money cs: 2 = reconciled (the app's "cleared"); 0/1 are not.
    cleared: t.clearedStatus === 2,
    notes: notesOf(t),
    bankReference: t.ref || undefined,
  });

  // A split LINE's category: a transfer line → the destination account's
  // To/From category; otherwise its own mapped category.
  const lineCategory = (k: MnyTransaction): string =>
    k.isTransferLine && k.linkAccountId != null
      ? (toFromByAccount.get(k.linkAccountId) ?? '')
      : resolveCategory(k.categoryId);

  for (const t of exp.transactions) {
    if (t.role === 'splitChild') continue; // consumed by their parent below

    if (t.role === 'transfer') {
      const amount = toNumber(t.amount);
      const toFrom = t.linkAccountId != null ? toFromByAccount.get(t.linkAccountId) : undefined;
      // If this transfer's PARTNER is a split line (a transfer recorded inside
      // another account's split), the pair still links fully: this leg points
      // at the split PARENT, and linkedTransferSplitId pins the exact line
      // that is the opposite leg. The line points back (see the split branch).
      const partnerIsSplitLine =
        t.transferPairTxnId != null && splitChildIds.has(t.transferPairTxnId);
      if (partnerIsSplitLine) splitLegTransfers++;
      transactions.push({
        id: txnId(t.id),
        ...baseFields(t),
        amount,
        type: 'transfer',
        category: toFrom ?? '',
        transferAccountId: t.linkAccountId != null ? acctId(t.linkAccountId) : undefined,
        linkedTransferId: partnerIsSplitLine
          ? txnId(splitParentByChild.get(t.transferPairTxnId as number) as number)
          : t.transferPairTxnId != null ? txnId(t.transferPairTxnId) : undefined,
        linkedTransferSplitId: partnerIsSplitLine
          ? splitLineIdByChild.get(t.transferPairTxnId as number)
          : undefined,
      } as Transaction);
      counts.transfers++;
      counts.imported++;
      continue;
    }

    if (t.role === 'splitParent') {
      const kids = childrenByParent.get(t.id) ?? [];
      const parentAmount = toDecimal(t.amount);
      let childAmounts = kids.map(k => toDecimal(k.amount));
      let childSum = childAmounts.reduce((s, a) => s.plus(a), toDecimal(0));

      // Sign-flip artifact (Money liability accounts): children carry the
      // parent's magnitude with inverted sign. Negate them so they sum to the
      // parent — the category breakdown is right, only the sign convention
      // differed.
      if (!childSum.equals(parentAmount) && childSum.equals(parentAmount.negated()) && !parentAmount.isZero()) {
        childAmounts = childAmounts.map(a => a.negated());
        childSum = childSum.negated();
        signFlipped++;
      }

      const parentAppId = txnId(t.id);
      transactions.push({
        id: parentAppId,
        ...baseFields(t),
        amount: toNumber(t.amount),
        type: parentAmount.isNegative() ? 'expense' : 'income',
        category: '',
        isSplit: true,
      } as Transaction);

      let seq = 0;
      kids.forEach((k, i) => {
        // A transfer line links to its counterpart transaction — but only when
        // that counterpart is a real top-level row (never another split line).
        const isLinkedLeg =
          k.isTransferLine === true &&
          k.linkAccountId != null &&
          k.transferPairTxnId != null &&
          !splitChildIds.has(k.transferPairTxnId);
        splits.push({
          id: splitId(t.id, ++seq),
          transactionId: parentAppId,
          category: lineCategory(k),
          amount: childAmounts[i].toNumber(),
          memo: k.memo || undefined,
          sortOrder: seq,
          ...(isLinkedLeg
            ? {
                transferAccountId: acctId(k.linkAccountId as number),
                linkedTransferId: txnId(k.transferPairTxnId as number),
              }
            : {}),
        });
        counts.splitLines++;
      });

      // Genuine partial split (Money never recorded the rest): add an
      // "Unassigned" line for the remainder so the split still sums to the
      // parent total — nothing invented, just made explicit.
      const remainder = parentAmount.minus(childSum);
      if (!remainder.isZero()) {
        splits.push({
          id: splitId(t.id, ++seq),
          transactionId: parentAppId,
          category: UNASSIGNED_CAT_ID,
          amount: remainder.toNumber(),
          sortOrder: seq,
        });
        counts.splitLines++;
        remainderLines++;
      }

      counts.splitTransactions++;
      counts.imported++;
      continue;
    }

    // standalone
    const amount = toNumber(t.amount);
    transactions.push({
      id: txnId(t.id),
      ...baseFields(t),
      amount,
      type: amount < 0 ? 'expense' : 'income',
      category: resolveCategory(t.categoryId),
    } as Transaction);
    counts.standalone++;
    counts.imported++;
  }

  const simplifications: string[] = [];
  if (remainderLines > 0) {
    simplifications.push(
      `${remainderLines} split(s) that MS Money left partially uncategorised now carry an "Unassigned (MS Money import)" line for the remainder, so every split sums to its exact total.`
    );
  }
  if (signFlipped > 0) {
    simplifications.push(
      `${signFlipped} split(s) in liability accounts had their category-line signs corrected so the lines sum to the parent total.`
    );
  }
  if (splitLegTransfers > 0) {
    simplifications.push(
      `${splitLegTransfers} transfer(s) whose counterpart is a line inside a split are fully linked — the split line and the opposite transaction reference each other bidirectionally.`
    );
  }

  return { transactions, splits, counts, simplifications };
}

// ── Top level ─────────────────────────────────────────────────────────────────

/**
 * A "To/From <account>" transfer category for every account that appears as a
 * transfer counterpart — mirroring the app's account-managed transfer
 * categories, so imported transfers read "To/From <account>" and populate the
 * Transfer Categories section.
 */
function buildTransferCategories(
  mnyAccounts: MnyAccount[],
  transactions: MnyTransaction[]
): { categories: Category[]; byAccount: Map<number, string> } {
  const nameById = new Map<number, MnyAccount>(mnyAccounts.map(a => [a.id, a]));
  const targets = new Set<number>();
  for (const t of transactions) {
    // Targets come from both standalone transfers AND split lines that are
    // themselves transfers — each needs its counterpart's To/From category.
    if (t.linkAccountId != null && (t.role === 'transfer' || (t.role === 'splitChild' && t.isTransferLine))) {
      targets.add(t.linkAccountId);
    }
  }
  const categories: Category[] = [];
  const byAccount = new Map<number, string>();
  for (const hacct of targets) {
    const acct = nameById.get(hacct);
    if (!acct) continue;
    const id = transferCatId(hacct);
    byAccount.set(hacct, id);
    categories.push({
      id,
      name: `To/From ${acct.name}`,
      type: 'both',
      level: 'detail',
      parentId: 'type-transfer',
      isTransferCategory: true,
      accountId: acctId(hacct),
      isActive: !acct.closed,
    });
  }
  return { categories, byAccount };
}

export function transformMsMoneyExport(exp: MnyExport, nowIso: string): MsMoneyImportResult {
  const accounts = transformAccounts(exp.accounts, nowIso);
  const { categories, hiddenCount } = transformCategories(exp.categories);
  const transfer = buildTransferCategories(exp.accounts, exp.transactions);
  categories.push(...transfer.categories);
  const { transactions, splits, counts, simplifications } = transformTransactions(exp, transfer.byAccount);

  const summary: MsMoneyImportSummary = {
    accounts: {
      total: accounts.length,
      open: accounts.filter(a => a.isActive !== false).length,
      closed: accounts.filter(a => a.isActive === false).length,
    },
    categories: {
      subs: categories.filter(c => c.level === 'sub').length,
      details: categories.filter(c => c.level === 'detail').length,
      hidden: hiddenCount,
    },
    transactions: counts,
    simplifications,
  };

  return { accounts, categories, transactions, transactionSplits: splits, summary };
}
