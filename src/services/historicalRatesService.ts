/**
 * Daily exchange-rate HISTORY, held on the device (owner, 22 Aug: "can we get
 * backdated currency figures by day and hold them somewhere to be referenced
 * against and used for backdated calculations?").
 *
 * SOURCE — the European Central Bank's reference rates, via frankfurter.dev:
 * free, keyless, one HTTPS GET for a whole date range, daily figures back to
 * 4 January 1999. Verified before this was written: a range beginning on a
 * weekend answers from the previous business day, and a full year of one
 * pair is ~7 KB, so the complete history of a currency is a single small
 * request made once.
 *
 * WHY ON-DEVICE AND NOT A SERVER TABLE: the reports that need history run in
 * the desktop edition too, and desktop-reachable code may not import
 * Supabase (see docs/edition-gating.md). A plain fetch plus IndexedDB works
 * identically in both editions, costs no migration, and degrades offline to
 * whatever history the device already holds. The seam is this module's
 * exported functions — a server-backed store could stand behind them later
 * without a caller changing.
 *
 * UNITS — the table speaks the app's one dialect: units of a currency per
 * £1 (the FALLBACK_RATES convention in currency-decimal.ts), GBP the pivot,
 * so A→B is rateOf(B)/rateOf(A) everywhere and no module needs to know
 * which base the provider used.
 *
 * GAPS — the ECB publishes business days only. A weekend or holiday carries
 * the previous business day's rate forward; a date before the table begins
 * carries the earliest rate backward; a date past the newest fetch carries
 * the newest forward. Every surface that shows a figure built on this says
 * the basis out loud — the carrying is a stated policy, not a guess.
 *
 * One rule stands above this table: a rate RECORDED at transfer time (the
 * cross-currency dialog's confirmed conversions) always beats a reference
 * rate — that is the actual money that moved. This history is for VALUATION,
 * never for rewriting recorded transfers.
 */

const PROVIDER_ORIGIN = 'https://api.frankfurter.dev';
export const HISTORICAL_RATES_PROVIDER = 'European Central Bank reference rates';
/** The first date the ECB series exists for. */
const SERIES_EPOCH = '1999-01-04';

const DB_NAME = 'wealthtracker-fx-history';
const STORE = 'rates';
const OPEN_TIMEOUT_MS = 10_000;

export interface HistoricalRatesProvenance {
  source: 'ecb-history';
  /** The newest rate date the table holds — how fresh the history is. */
  asOf: Date;
}

export interface HistoricalRates {
  /**
   * Units of `currency` per £1 on `date`, carrying business days across gaps
   * as documented above. Null when the currency has no data at all.
   */
  rateOn(date: Date, currency: string): number | null;
  provenance: HistoricalRatesProvenance | null;
  /** Currencies asked for that the provider has no series for. */
  unavailable: readonly string[];
}

interface CurrencyHistory {
  currency: string;
  /** First and last date keys the `rates` record spans (inclusive). */
  from: string;
  through: string;
  /** Rate per date key, business days only. */
  rates: Record<string, number>;
}

export function fxDayKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/* ───────────────────────── storage ─────────────────────────
 * IndexedDB when the browser grants it, a module Map when it does not
 * (private-mode Safari, a torn-down test) — history then lives for the
 * session, which still spares the provider repeat fetches.
 */

const memoryStore = new Map<string, CurrencyHistory>();
let dbPromise: Promise<IDBDatabase | null> | null = null;
let openedDb: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(resolve => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const timer = setTimeout(() => resolve(null), OPEN_TIMEOUT_MS);
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'currency' });
        }
      };
      request.onsuccess = () => {
        clearTimeout(timer);
        openedDb = request.result;
        resolve(request.result);
      };
      request.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
  return dbPromise;
}

async function readHistory(currency: string): Promise<CurrencyHistory | null> {
  const db = await openDb();
  if (!db) return memoryStore.get(currency) ?? null;
  return new Promise(resolve => {
    try {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(currency);
      request.onsuccess = () => resolve((request.result as CurrencyHistory | undefined) ?? null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeHistory(history: CurrencyHistory): Promise<void> {
  const db = await openDb();
  if (!db) {
    memoryStore.set(history.currency, history);
    return;
  }
  await new Promise<void>(resolve => {
    try {
      const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(history);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/* ───────────────────────── fetching ───────────────────────── */

interface RangeResponse {
  rates?: Record<string, Record<string, number>>;
}

async function fetchRange(
  currencies: readonly string[],
  fromKey: string,
  toKey: string
): Promise<Record<string, Record<string, number>> | null> {
  try {
    const symbols = currencies.join(',');
    const response = await fetch(
      `${PROVIDER_ORIGIN}/v1/${fromKey}..${toKey}?base=GBP&symbols=${symbols}`
    );
    if (!response.ok) return null;
    const body = (await response.json()) as RangeResponse;
    return body.rates ?? null;
  } catch {
    return null;
  }
}

const addDays = (key: string, days: number): string => {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return fxDayKey(date);
};

const maxKey = (a: string, b: string): string => (a >= b ? a : b);

/**
 * In-flight requests keyed by their span, so two surfaces asking for the same
 * history in the same render burst share one provider call.
 */
const inFlight = new Map<string, Promise<HistoricalRates>>();

/**
 * The history for `currencies` (ISO codes, GBP allowed and answered as 1)
 * covering [from, to]. Cached spans are extended incrementally — the common
 * daily case fetches only the missing tail.
 */
export async function getHistoricalRates(
  currencies: readonly string[],
  from: Date,
  to: Date
): Promise<HistoricalRates> {
  const wanted = [...new Set(currencies.filter(c => c && c !== 'GBP'))].sort();
  const fromKey = maxKey(fxDayKey(from), SERIES_EPOCH);
  const toKey = maxKey(fxDayKey(to), fromKey);
  const flightKey = `${wanted.join(',')}|${fromKey}|${toKey}`;
  const standing = inFlight.get(flightKey);
  if (standing) return standing;

  const flight = (async (): Promise<HistoricalRates> => {
    const histories = new Map<string, CurrencyHistory>();
    const toFetchWhole: string[] = [];
    const toExtend: Array<{ currency: string; fromKey: string }> = [];

    for (const currency of wanted) {
      const held = await readHistory(currency);
      if (!held || held.from > fromKey) {
        // Nothing, or a hole before what we hold: refetch the whole span
        // (the payload is small enough that backfilling-in-place is not
        // worth the bookkeeping).
        toFetchWhole.push(currency);
      } else {
        histories.set(currency, held);
        if (held.through < toKey) toExtend.push({ currency, fromKey: addDays(held.through, 1) });
      }
    }

    if (toFetchWhole.length > 0) {
      const fetched = await fetchRange(toFetchWhole, fromKey, toKey);
      if (fetched) {
        for (const currency of toFetchWhole) {
          const rates: Record<string, number> = {};
          for (const [day, byCurrency] of Object.entries(fetched)) {
            if (byCurrency[currency] !== undefined) rates[day] = byCurrency[currency];
          }
          if (Object.keys(rates).length > 0) {
            const history: CurrencyHistory = { currency, from: fromKey, through: toKey, rates };
            histories.set(currency, history);
            await writeHistory(history);
          }
        }
      }
    }

    for (const { currency, fromKey: extendFrom } of toExtend) {
      const held = histories.get(currency);
      if (!held) continue;
      const fetched = await fetchRange([currency], extendFrom, toKey);
      if (fetched) {
        for (const [day, byCurrency] of Object.entries(fetched)) {
          if (byCurrency[currency] !== undefined) held.rates[day] = byCurrency[currency];
        }
      }
      // `through` advances even when the fetch failed or returned nothing —
      // otherwise an offline day would retry the same span forever. The
      // carry-forward answers the gap either way.
      held.through = toKey;
      await writeHistory(held);
    }

    const unavailable = wanted.filter(c => !histories.has(c));
    let newest: string | null = null;
    for (const history of histories.values()) {
      for (const day of Object.keys(history.rates)) {
        if (newest === null || day > newest) newest = day;
      }
    }

    const sortedKeysByCurrency = new Map<string, string[]>();
    for (const [currency, history] of histories) {
      sortedKeysByCurrency.set(currency, Object.keys(history.rates).sort());
    }

    return {
      rateOn(date: Date, currency: string): number | null {
        if (currency === 'GBP') return 1;
        const history = histories.get(currency);
        const keys = sortedKeysByCurrency.get(currency);
        if (!history || !keys || keys.length === 0) return null;
        const wantedKey = fxDayKey(date);
        // Binary search for the newest key ≤ wantedKey; before the epoch the
        // earliest carries backward, past the newest the last carries forward.
        let lo = 0;
        let hi = keys.length - 1;
        if (wantedKey < keys[0]) return history.rates[keys[0]];
        if (wantedKey >= keys[hi]) return history.rates[keys[hi]];
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2);
          if (keys[mid] <= wantedKey) lo = mid;
          else hi = mid - 1;
        }
        return history.rates[keys[lo]];
      },
      provenance: newest === null
        ? null
        : (() => {
            const [y, m, d] = newest.split('-').map(Number);
            return { source: 'ecb-history' as const, asOf: new Date(y, m - 1, d) };
          })(),
      unavailable,
    };
  })();

  inFlight.set(flightKey, flight);
  try {
    return await flight;
  } finally {
    inFlight.delete(flightKey);
  }
}

/** Test seam: forget everything held, on-device store included. */
export async function __resetHistoricalRatesForTests(): Promise<void> {
  memoryStore.clear();
  inFlight.clear();
  openedDb?.close();
  openedDb = null;
  dbPromise = null;
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>(resolve => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}
