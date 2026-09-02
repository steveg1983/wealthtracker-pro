/**
 * Quantity events out of a Microsoft Money file — buys, sells, write-offs.
 *
 * SEPARATE FROM THE FULL MIGRATION, like mnyPrices.ts and for the same
 * reason: the ledger was migrated in July; what history is missing is WHO
 * HELD WHAT WHEN. Money keeps that in TRN rows that carry a security handle,
 * with quantity and unit price in the TRN_INV side table (measured 27 Aug
 * 2026: 140 security rows in 51,768 TRN; act=1 buy ×52, act=2 sell ×39,
 * act=13 write-off ×1 — those three change quantity and all 92 carry or are
 * a TRN_INV row; qty × price ± fees reconciled to the register amount on all
 * 91 buy/sell rows with zero drift).
 *
 * WHAT IS DELIBERATELY NOT AN EVENT: act=3 dividends (47) and act=8 return
 * of capital (1) move cash and leave quantity alone — per the owner's ruling
 * (26 Aug), anything that does not change the quantity of the holding is
 * cash, and those rows already live in this app's ledger from the July
 * migration. They are skipped AND counted so the confirm step can say so.
 *
 * FIGURES ARE REGISTER FIGURES. Quantity, price, fees and amount are what
 * Money's register shows, in the account's own currency — `amount` is
 * normalised to a positive magnitude (what was paid or received); direction
 * is the kind's job. Rows where qty × price ± fees drifts from the register
 * amount by more than a penny are still imported (the register amount is
 * authoritative) but counted, never silently absorbed.
 *
 * IDEMPOTENCY comes from Money's own per-row GUID (TRN.sguid — measured: a
 * distinct plain string on every one of the 140 rows), carried as sourceRef
 * and unique per user in the store, so re-running an import is a no-op.
 *
 * ACCOUNTS ARE REPORTED BY NAME. Matching a Money account name to an app
 * account id needs the app's account list, which the reader does not have —
 * the import card owns that step and its unmatched-account count.
 */

// Installs Buffer + process shims BEFORE mdb-reader's dependency subtree
// evaluates — must stay the first import, and Buffer is then used as a
// GLOBAL, exactly as mnyReader.ts documents. (Node masks both mistakes;
// Safari does not — the price reader's first draft proved it on the owner.)
import './nodeGlobalsShim';
import MDBReader from 'mdb-reader';
import { decryptMny } from './mnyDecrypt';
import { normaliseMoneySymbol } from './mnyPrices';
import { toDecimal } from '../../../utils/decimal';
import { compareText } from '../../../utils/localeFormat';

type Row = Record<string, unknown>;

const num = (v: unknown): number | null => (typeof v === 'number' ? v : v == null ? null : Number(v));
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

export type MnyEventKind = 'buy' | 'sell' | 'write_off';

export interface MnyEventRow {
  /** Money's account name, verbatim — the card matches it to an app account. */
  accountName: string;
  /** Normalised ticker, or null — 11 of the owner's securities carry none. */
  symbol: string | null;
  securityName: string;
  /** YYYY-MM-DD. */
  date: string;
  kind: MnyEventKind;
  /** Decimal string, always positive. */
  quantity: string;
  /** Per unit, decimal string; a write-off has none. */
  price: string | null;
  /** Commission and charges, decimal string, when Money recorded any. */
  fees: string | null;
  /** Positive magnitude — paid (buy) or received (sell); '0' for a write-off. */
  amount: string;
  /** The ACCOUNT's currency — these are register figures. */
  currency: string;
  /** Money's per-row GUID; the store's idempotency key. */
  sourceRef: string;
}

export interface MnyEventHistory {
  events: MnyEventRow[];
  /** Distinct securities across the usable events. */
  securities: number;
  /** Distinct Money account names across the usable events, sorted. */
  accountNames: string[];
  from: string | null;
  to: string | null;
  skipped: {
    /** Dividends and returns of capital — cash rows already in the ledger. */
    cashSide: number;
    /** A buy/sell with no TRN_INV row or no readable positive quantity. */
    missingQuantity: number;
    /** No readable date, account, security or row GUID. */
    unreadable: number;
  };
  /** Buy/sell rows where qty × price ± fees drifts >1p from the amount. */
  figuresDisagree: number;
}

/** Money's investment activity codes, measured against the owner's file. */
const ACT_BUY = 1;
const ACT_SELL = 2;
const ACT_WRITE_OFF = 13;

/**
 * The pure half: rows in, events out. Separated from the file IO so it can
 * be tested with invented rows — an .mdb binary cannot reasonably be
 * synthesised in a spec.
 */
export function eventsFromMoneyTables(
  secRows: readonly Row[],
  acctRows: readonly Row[],
  trnRows: readonly Row[],
  invRows: readonly Row[],
  isoByCrnc: ReadonlyMap<number, string | null>
): MnyEventHistory {
  const skipped = { cashSide: 0, missingQuantity: 0, unreadable: 0 };
  let figuresDisagree = 0;

  interface Sec { symbol: string | null; name: string }
  const secByHandle = new Map<number, Sec>();
  for (const s of secRows) {
    const handle = num(s.hsec);
    if (handle === null) continue;
    const rawSymbol = str(s.szSymbol);
    const symbol = rawSymbol ? normaliseMoneySymbol(rawSymbol) : null;
    secByHandle.set(handle, {
      symbol: symbol === '' ? null : symbol,
      name: str(s.szFull) ?? symbol ?? ''
    });
  }

  interface Acct { name: string; currency: string }
  const acctByHandle = new Map<number, Acct>();
  for (const a of acctRows) {
    const handle = num(a.hacct);
    const name = str(a.szFull);
    if (handle === null || name === null) continue;
    acctByHandle.set(handle, {
      name,
      currency: isoByCrnc.get(num(a.hcrnc) ?? -1) ?? 'GBP'
    });
  }

  const invByTrn = new Map<number, Row>();
  for (const r of invRows) {
    const handle = num(r.htrn);
    if (handle !== null) invByTrn.set(handle, r);
  }

  const events: MnyEventRow[] = [];
  const securityKeys = new Set<string>();
  const accountNames = new Set<string>();
  for (const r of trnRows) {
    if (num(r.hsec) === null) continue;
    const act = num(r.act);
    if (act !== ACT_BUY && act !== ACT_SELL && act !== ACT_WRITE_OFF) {
      skipped.cashSide += 1;
      continue;
    }

    const sec = secByHandle.get(num(r.hsec) ?? -1);
    const acct = acctByHandle.get(num(r.hacct) ?? -1);
    const sourceRef = str(r.sguid);
    // Date objects only — String(date) is weekday text, the measured trap.
    const dt = r.dt instanceof Date && !Number.isNaN(r.dt.getTime()) ? r.dt : null;
    if (!sec || sec.name === '' || !acct || sourceRef === null || dt === null) {
      skipped.unreadable += 1;
      continue;
    }

    const inv = invByTrn.get(num(r.htrn) ?? -1);
    const quantity = inv ? num(inv.qty) : null;
    if (quantity === null || !Number.isFinite(quantity) || quantity <= 0) {
      skipped.missingQuantity += 1;
      continue;
    }

    const price = inv ? num(inv.dPrice) : null;
    const fees = inv ? num(inv.amtCmn) : null;
    const registerAmount = num(r.amt) ?? 0;
    const amount = act === ACT_WRITE_OFF ? 0 : Math.abs(registerAmount);

    if (act !== ACT_WRITE_OFF && price !== null && Number.isFinite(price)) {
      const expected =
        act === ACT_BUY ? quantity * price + (fees ?? 0) : quantity * price - (fees ?? 0);
      if (Math.abs(expected - amount) > 0.011) figuresDisagree += 1;
    }

    const kind: MnyEventKind = act === ACT_BUY ? 'buy' : act === ACT_SELL ? 'sell' : 'write_off';
    securityKeys.add(sec.symbol ?? `name:${sec.name}`);
    accountNames.add(acct.name);
    events.push({
      accountName: acct.name,
      symbol: sec.symbol,
      securityName: sec.name,
      date: dt.toISOString().slice(0, 10),
      kind,
      quantity: String(quantity),
      price: kind === 'write_off' || price === null || !Number.isFinite(price) ? null : String(price),
      fees: fees === null || !Number.isFinite(fees) || fees === 0 ? null : String(fees),
      amount: String(amount),
      currency: acct.currency,
      sourceRef
    });
  }

  events.sort(
    (a, b) =>
      compareText(a.date, b.date) ||
      compareText(a.securityName, b.securityName) ||
      compareText(a.sourceRef, b.sourceRef)
  );
  return {
    events,
    securities: securityKeys.size,
    accountNames: [...accountNames].sort((a, b) => compareText(a, b)),
    from: events[0]?.date ?? null,
    to: events[events.length - 1]?.date ?? null,
    skipped,
    figuresDisagree
  };
}

/** A position the events do not close — quantity left after the full fold. */
export interface OpenPosition {
  accountName: string;
  symbol: string | null;
  securityName: string;
  /** Decimal string; positive means units still held at the end. */
  quantity: string;
}

/**
 * Fold every (account, security)'s events — buys in, sells and write-offs
 * out — and report the positions that do NOT reach zero.
 *
 * Measured against the owner's file: all 32 genuinely-closed positions fold
 * to exactly zero, and the only survivors are three round-number,
 * zero-commission buys that look like test entries. Whether those import is
 * the OWNER's call, so the confirm step lists what this returns with a
 * choice, instead of this code guessing which history is real.
 */
export function foldOpenPositions(events: readonly MnyEventRow[]): OpenPosition[] {
  const keyed = new Map<string, { position: OpenPosition; quantity: ReturnType<typeof toDecimal> }>();
  for (const event of events) {
    const key = `${event.accountName}|${event.symbol ?? `name:${event.securityName}`}`;
    const entry =
      keyed.get(key) ??
      keyed
        .set(key, {
          position: {
            accountName: event.accountName,
            symbol: event.symbol,
            securityName: event.securityName,
            quantity: '0'
          },
          quantity: toDecimal('0')
        })
        .get(key)!;
    const delta = toDecimal(event.quantity);
    entry.quantity = event.kind === 'buy' ? entry.quantity.plus(delta) : entry.quantity.minus(delta);
  }
  const open: OpenPosition[] = [];
  for (const { position, quantity } of keyed.values()) {
    if (!quantity.isZero()) open.push({ ...position, quantity: quantity.toString() });
  }
  open.sort(
    (a, b) =>
      compareText(a.accountName, b.accountName) || compareText(a.securityName, b.securityName)
  );
  return open;
}

/** The IO half: decrypt, open, read the five tables (tolerantly), delegate. */
export function readMnyEventHistory(bytes: Uint8Array): MnyEventHistory {
  const reader = new MDBReader(Buffer.from(decryptMny(bytes)));
  const tableOrEmpty = (name: string): Row[] => {
    try {
      return reader.getTable(name).getData() as Row[];
    } catch {
      // A file without TRN_INV is one whose owner never traded a security —
      // an empty history, not an error.
      return [];
    }
  };

  const isoByCrnc = new Map<number, string | null>();
  for (const c of tableOrEmpty('CRNC')) {
    const handle = num(c.hcrnc);
    if (handle !== null) isoByCrnc.set(handle, str(c.szIsoCode));
  }
  return eventsFromMoneyTables(
    tableOrEmpty('SEC'),
    tableOrEmpty('ACCT'),
    tableOrEmpty('TRN'),
    tableOrEmpty('TRN_INV'),
    isoByCrnc
  );
}
