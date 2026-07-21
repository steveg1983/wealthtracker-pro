/**
 * Microsoft Money (.mny) reader — decrypts and extracts the raw tables into the
 * normalised `MnyExport` shape that `transform.ts` consumes.
 *
 * This is the pure-JS equivalent of the earlier Jackcess/Java extraction and
 * is verified to reproduce it exactly (same accounts, categories, transactions,
 * splits — see mnyReader.test.ts). The chain is:
 *
 *     .mny bytes → decryptMny → MDBReader → extractMnyExport → transform
 *
 * Money's internal model maps cleanly onto the app's: accounts (ACCT), a
 * 3-level category tree (CAT), payees (PAY), transactions (TRN) with splits
 * (TRN_SPLIT) and transfers (TRN_XFER). Amounts are read as-is and normalised
 * to decimal strings; the transform is the single place money maths happens.
 */
// Installs Buffer + process shims BEFORE mdb-reader's dependency subtree
// evaluates — must stay the first import in this file.
import './nodeGlobalsShim';
import { Buffer } from 'buffer';
import MDBReader from 'mdb-reader';
import { decryptMny } from './mnyDecrypt';
import type {
  MnyExport, MnyAccount, MnyCategory, MnyPayee, MnyTransaction, MnyRole,
} from './transform';

// A row from mdb-reader — column values are number | string | Date | boolean | null.
type Row = Record<string, unknown>;

const num = (v: unknown): number | null => (typeof v === 'number' ? v : v == null ? null : Number(v));
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const bool = (v: unknown): boolean => v === true || v === 1;

/** Money's amounts arrive as JS numbers; store them as exact decimal strings. */
const decStr = (v: unknown): string => {
  const n = num(v);
  return n == null ? '0' : n.toString();
};

/** Money nulls a date by writing a year ≥ 9999; treat those as "no date". */
const NULL_YEAR = 9999;
const isoDate = (v: unknown): string | null => {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v as string);
  if (Number.isNaN(d.getTime()) || d.getUTCFullYear() >= NULL_YEAR) return null;
  return d.toISOString().slice(0, 10);
};

// ACCT.at (Money's account super-type) → the moneyType strings transform maps.
const AT_TO_MONEYTYPE: Record<number, MnyAccount['moneyType']> = {
  0: 'bank', 1: 'credit', 2: 'cash', 3: 'asset', 4: 'liability', 5: 'investment',
};

// A category's income/expense kind is decided by which tree root it ultimately
// descends from (INCOME root = 130; everything else, incl. the EXPENSE root
// 131, is expense).
const INCOME_ROOT = 130;

/** Sum in integer pennies so the reconciliation flags never see float drift. */
const pennies = (v: unknown): number => Math.round((num(v) ?? 0) * 100);

export class MnyReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MnyReadError';
  }
}

/**
 * Decrypt + parse a .mny file into the normalised export. Throws
 * MnyReadError / MnyDecryptError with a user-facing message on any failure so
 * the import UI can surface it rather than showing a stack trace.
 */
export function readMnyExport(bytes: Uint8Array): MnyExport {
  const decrypted = decryptMny(bytes);

  let reader: MDBReader;
  try {
    // mdb-reader wants a Buffer; in the browser this is the `buffer` polyfill.
    reader = new MDBReader(Buffer.from(decrypted));
  } catch (err) {
    throw new MnyReadError(
      `Could not read the Microsoft Money database — the file may be corrupt. (${(err as Error).message})`
    );
  }

  const table = (name: string): Row[] => {
    try {
      return reader.getTable(name).getData() as Row[];
    } catch {
      throw new MnyReadError(`This Microsoft Money file is missing its ${name} table and cannot be imported.`);
    }
  };

  const acctRows = table('ACCT');
  const catRows = table('CAT');
  const payRows = table('PAY');
  const trnRows = table('TRN');
  const splitRows = table('TRN_SPLIT');
  const xferRows = table('TRN_XFER');
  const crncRows = table('CRNC');

  return {
    accounts: extractAccounts(acctRows, crncRows, trnRows, splitRows),
    categories: extractCategories(catRows),
    payees: extractPayees(payRows),
    transactions: extractTransactions(trnRows, splitRows, xferRows),
  };
}

function extractCategories(catRows: Row[]): MnyCategory[] {
  const byId = new Map<number, Row>();
  for (const c of catRows) byId.set(num(c.hcat)!, c);

  const kindOf = (c: Row): 'income' | 'expense' => {
    let cur: Row | undefined = c;
    for (let guard = 0; cur && (num(cur.nLevel) ?? 0) > 0 && cur.hcatParent != null && guard < 32; guard++) {
      cur = byId.get(num(cur.hcatParent)!);
    }
    return cur && num(cur.hcat) === INCOME_ROOT ? 'income' : 'expense';
  };
  // Money stores names as a back-slashed path; the leaf is the display name.
  const leaf = (c: Row): string => {
    const full = str(c.szAls) ?? str(c.szFull) ?? '';
    const parts = full.split('\\');
    return parts[parts.length - 1] || full;
  };

  return catRows.map((c): MnyCategory => {
    const level = num(c.nLevel) ?? 0;
    return {
      id: num(c.hcat)!,
      name: leaf(c),
      parentId: level === 0 ? null : (num(c.hcatParent) ?? null),
      level,
      fullPath: str(c.szFull) ?? '',
      hidden: bool(c.fHidden),
      kind: kindOf(c),
    };
  });
}

function extractPayees(payRows: Row[]): MnyPayee[] {
  return payRows.map((p): MnyPayee => ({
    id: num(p.hpay)!,
    name: str(p.szFull) ?? str(p.szAls) ?? `Payee ${num(p.hpay)}`,
    parentId: num(p.hpayParent) ?? null,
    hidden: bool(p.fHidden),
  }));
}

function extractAccounts(
  acctRows: Row[], crncRows: Row[], trnRows: Row[], splitRows: Row[]
): MnyAccount[] {
  const isoByCrnc = new Map<number, string | null>();
  for (const c of crncRows) isoByCrnc.set(num(c.hcrnc)!, str(c.szIsoCode));

  // The stored balance (XACCT.amtBalance) is a dead runtime cache — Money
  // recomputes it. Authoritative balance = opening + Σ(the account's own
  // transactions), excluding split children (their parent carries the total).
  const splitChildIds = new Set<number>();
  for (const s of splitRows) splitChildIds.add(num(s.htrn)!);
  const sumByAcct = new Map<number, number>();
  for (const t of trnRows) {
    const id = num(t.htrn)!;
    if (splitChildIds.has(id)) continue;
    const acct = num(t.hacct)!;
    sumByAcct.set(acct, (sumByAcct.get(acct) ?? 0) + pennies(t.amt));
  }

  return acctRows.map((a): MnyAccount => {
    const id = num(a.hacct)!;
    const open = pennies(a.amtOpen);
    const reconstructed = open + (sumByAcct.get(id) ?? 0);
    return {
      id,
      name: str(a.szFull) ?? str(a.szAls) ?? `Account ${id}`,
      moneyType: AT_TO_MONEYTYPE[num(a.at) ?? -1] ?? 'other',
      currencyCode: isoByCrnc.get(num(a.hcrnc)!) ?? null,
      openingBalance: (open / 100).toFixed(2),
      reconstructedBalance: (reconstructed / 100).toFixed(2),
      closed: bool(a.fClosed),
      openDate: isoDate(a.dtOpen),
      closeDate: isoDate(a.dtClose),
      comment: str(a.mComment),
    };
  });
}

function extractTransactions(trnRows: Row[], splitRows: Row[], xferRows: Row[]): MnyTransaction[] {
  const parentOfChild = new Map<number, number>();
  const childrenOfParent = new Map<number, number[]>();
  for (const s of splitRows) {
    const child = num(s.htrn)!;
    const parent = num(s.htrnParent)!;
    parentOfChild.set(child, parent);
    (childrenOfParent.get(parent) ?? childrenOfParent.set(parent, []).get(parent)!).push(child);
  }
  const transferPair = new Map<number, number>();
  for (const x of xferRows) {
    const from = num(x.htrnFrom)!;
    const link = num(x.htrnLink)!;
    transferPair.set(from, link);
    transferPair.set(link, from);
  }
  const trnById = new Map<number, Row>();
  for (const t of trnRows) trnById.set(num(t.htrn)!, t);

  const roleOf = (t: Row): MnyRole => {
    const id = num(t.htrn)!;
    if (parentOfChild.has(id)) return 'splitChild';
    if (childrenOfParent.has(id)) return 'splitParent';
    if (t.hacctLink != null || transferPair.has(id)) return 'transfer';
    return 'standalone';
  };

  return trnRows.map((t): MnyTransaction => {
    const id = num(t.htrn)!;
    const role = roleOf(t);
    const base: MnyTransaction = {
      id,
      accountId: num(t.hacct)!,
      date: isoDate(t.dt),
      amount: decStr(t.amt),
      categoryId: num(t.hcat) ?? null,
      payeeId: num(t.lHpay) ?? null, // payee FK is lHpay, NOT hpay
      memo: str(t.mMemo),
      ref: str(t.szId),
      clearedStatus: num(t.cs) ?? 0,
      linkAccountId: num(t.hacctLink) ?? null,
      role,
    };

    if (role === 'splitChild') {
      base.splitParentId = parentOfChild.get(id) ?? null;
      base.isTransferLine = t.hacctLink != null;
    }
    if (role === 'transfer' || role === 'splitChild') {
      base.transferPairTxnId = transferPair.get(id) ?? null;
    }
    if (role === 'splitParent') {
      const kids = (childrenOfParent.get(id) ?? []).map(h => trnById.get(h)).filter((r): r is Row => !!r);
      const parentPennies = pennies(t.amt);
      const childPennies = kids.reduce((s, k) => s + pennies(k.amt), 0);
      base.splitChildCount = kids.length;
      base.splitChildSum = (childPennies / 100).toFixed(2);
      base.splitUnassignedRemainder = ((parentPennies - childPennies) / 100).toFixed(2);
      base.splitReconciles = childPennies === parentPennies;
    }
    return base;
  });
}
