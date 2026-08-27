/**
 * Price history out of a Microsoft Money file — the SP table, standalone.
 *
 * SEPARATE FROM THE FULL MIGRATION, deliberately. The owner's ledger was
 * migrated in July; what his history is missing is the eight years of prices
 * Money kept in SP (measured 27 Aug 2026: 249 rows of security/date/price
 * against 140 security-carrying transactions — Money stored PRICES and
 * derived value, never revaluation rows). Re-running the full, destructive
 * migration to obtain them would be absurd, so this reads ONLY the tables
 * prices need — CRNC, SEC, SP — and touches nothing else. A person migrating
 * fresh can run it after the main import; a person long since migrated can
 * run it alone.
 *
 * TOLERANT WHERE THE FULL READER IS STRICT. `readMnyExport` throws when a
 * table is missing, correctly — a Money file without accounts is not a Money
 * file. A file without SP is merely one whose owner never priced anything,
 * and the honest answer is an empty result, not a refusal.
 *
 * EVERYTHING SKIPPED IS COUNTED. A security with no ticker symbol cannot be
 * matched to a holding by name alone; a pence-flagged security's price scale
 * is unmeasured (none exist in the probed file, and converting on an
 * assumption would be invented data); a row with no readable date or a
 * negative price is noise. Each is skipped AND counted, so the confirm step
 * can say "249 prices, 3 securities skipped" instead of silently narrowing —
 * the no-silent-caps rule.
 */

import { decryptMny } from './mnyDecrypt';
import { Buffer } from 'buffer';
import MDBReader from 'mdb-reader';

type Row = Record<string, unknown>;

const num = (v: unknown): number | null => (typeof v === 'number' ? v : v == null ? null : Number(v));
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

export interface MnyPriceRow {
  /** Normalised ticker — see {@link normaliseMoneySymbol}. */
  symbol: string;
  /** YYYY-MM-DD. */
  date: string;
  /** Decimal string, full precision as Money held it. */
  price: string;
  /** ISO currency of the SECURITY (Money prices in the security's currency). */
  currency: string;
}

export interface MnyPriceHistory {
  prices: MnyPriceRow[];
  /** Securities that carried at least one usable price. */
  securities: number;
  /** Earliest and latest price dates, for the confirm sentence. */
  from: string | null;
  to: string | null;
  skipped: {
    /** Securities with no ticker symbol — unmatchable by anything stable. */
    noSymbol: number;
    /** Pence-flagged securities — price scale unmeasured, refused not guessed. */
    pence: number;
    /** Rows with no readable date or a negative/unreadable price. */
    unreadable: number;
    /** Second and later prices for a (symbol, day) already seen. */
    duplicates: number;
  };
}

/**
 * Money's symbol vocabulary → the app's.
 *
 * Money writes US listings with a country prefix and London listings with the
 * exchange suffix — the owner's register shows `US:GOOG` and `RR.L` side by
 * side. The app's convention (Yahoo-style) is the bare ticker for US and the
 * suffixed form for London, so the prefix is stripped and the suffix kept.
 */
export const normaliseMoneySymbol = (raw: string): string =>
  raw.trim().replace(/^[A-Z]{2,4}:/, '').trim();

/**
 * The pure half: rows in, prices out. Separated from the file IO so it can be
 * tested with invented rows — an .mdb binary cannot reasonably be synthesised
 * in a spec.
 */
export function pricesFromMoneyTables(
  secRows: readonly Row[],
  spRows: readonly Row[],
  isoByCrnc: ReadonlyMap<number, string | null>
): MnyPriceHistory {
  const skipped = { noSymbol: 0, pence: 0, unreadable: 0, duplicates: 0 };

  interface Sec { symbol: string; currency: string }
  const secByHandle = new Map<number, Sec>();
  for (const s of secRows) {
    const handle = num(s.hsec);
    if (handle === null) continue;
    const rawSymbol = str(s.szSymbol);
    if (!rawSymbol) {
      skipped.noSymbol += 1;
      continue;
    }
    if (s.fPence === true || s.fPence === 1 || s.fPence === -1) {
      skipped.pence += 1;
      continue;
    }
    const symbol = normaliseMoneySymbol(rawSymbol);
    if (symbol === '') {
      skipped.noSymbol += 1;
      continue;
    }
    const currency = isoByCrnc.get(num(s.hcrnc) ?? -1) ?? 'GBP';
    secByHandle.set(handle, { symbol, currency: currency ?? 'GBP' });
  }

  const prices: MnyPriceRow[] = [];
  const seen = new Set<string>();
  const pricedSymbols = new Set<string>();
  for (const r of spRows) {
    const sec = secByHandle.get(num(r.hsec) ?? -1);
    if (!sec) continue; // its security was skipped above, and counted there

    // A Date object from mdb-reader, and nothing else is trusted. The first
    // probe of this data sorted String(date) — weekday text — and produced a
    // median off garbage ordering; hence the insistence here.
    const dt = r.dt instanceof Date && !Number.isNaN(r.dt.getTime()) ? r.dt : null;
    const price = num(r.dPrice);
    if (dt === null || price === null || !Number.isFinite(price) || price < 0) {
      skipped.unreadable += 1;
      continue;
    }
    const date = dt.toISOString().slice(0, 10);
    const key = `${sec.symbol}|${date}`;
    if (seen.has(key)) {
      // One price per (symbol, day) — the day's price is one fact, and the
      // store enforces the same. First row wins, deterministically.
      skipped.duplicates += 1;
      continue;
    }
    seen.add(key);
    pricedSymbols.add(sec.symbol);
    prices.push({ symbol: sec.symbol, date, price: String(price), currency: sec.currency });
  }

  prices.sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol));
  return {
    prices,
    securities: pricedSymbols.size,
    from: prices[0]?.date ?? null,
    to: prices[prices.length - 1]?.date ?? null,
    skipped
  };
}

/** The IO half: decrypt, open, read the three tables (tolerantly), delegate. */
export function readMnyPriceHistory(bytes: Uint8Array): MnyPriceHistory {
  const reader = new MDBReader(Buffer.from(decryptMny(bytes)));
  const tableOrEmpty = (name: string): Row[] => {
    try {
      return reader.getTable(name).getData() as Row[];
    } catch {
      // A file without SP is a file whose owner never priced anything — an
      // empty history, not an error. (Contrast readMnyExport, where a missing
      // ACCT genuinely means "not a Money file".)
      return [];
    }
  };

  const isoByCrnc = new Map<number, string | null>();
  for (const c of tableOrEmpty('CRNC')) {
    const handle = num(c.hcrnc);
    if (handle !== null) isoByCrnc.set(handle, str(c.szIsoCode));
  }
  return pricesFromMoneyTables(tableOrEmpty('SEC'), tableOrEmpty('SP'), isoByCrnc);
}
