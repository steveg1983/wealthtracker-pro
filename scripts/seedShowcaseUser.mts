/**
 * THE SHOWCASE LEDGER — ten invented years of a comfortable financial life,
 * generated for landing-page screenshots (owner's spec, 29 Aug 2026).
 *
 * The story, as specified:
 *  - A house bought before the window opens: worth £600k at the start with a
 *    £195k mortgage; the mortgage amortises to ~£50k over the ten years while
 *    the house revalues to ~£1m.
 *  - A personal pension opening at £250k: £2,000/month transferred in from
 *    the current account, each followed by a £400 government top-up recorded
 *    as an Account Adjustment, the whole pot growing at ~6.5%/yr TWR.
 *  - A Hargreaves Lansdown Stocks & Shares ISA opening at just over £210k:
 *    £3,000/month in, deployed in quarterly purchases — index funds tracking
 *    the FTSE 100 and S&P 500 carrying most of it, with smaller single-stock
 *    positions (Apple, Alphabet, Microsoft, Rolls-Royce, Shell, Rio Tinto).
 *  - Instant-access savings from £50k to ~£100k (calibrated below).
 *  - Net salary rising fairly linearly from £180k/yr to £300k/yr.
 *  - A leased car whose payment steps every three years: £500 → £850 →
 *    £1,150 → £1,500 a month.
 *  - Two credit cards carrying the day-to-day (fuel, dining, coffee, shops),
 *    paid in full every month, always.
 *  - Lifestyle spending is the RESIDUAL: whatever the salary leaves after the
 *    commitments above, spent on running a life — his instruction was to
 *    work it out and see where the total lands.
 *
 * EVERY figure, payee, price and institution below is invented or a public
 * market approximation: this repo is public and this data exists to be
 * photographed.
 *
 * DETERMINISTIC by construction — a seeded PRNG and a fixed "today", so two
 * runs produce byte-identical ledgers and a tweak re-runs in seconds.
 *
 * Usage:
 *   npx tsx scripts/seedShowcaseUser.mts --dry-run
 *     → prints the year-by-year story and final balances; touches nothing.
 *   npx tsx scripts/seedShowcaseUser.mts --email demo@example.com --password 'S3cret!' [--env .env.local]
 *     → creates/reuses the Clerk user and seeds the lot. REFUSES to run on a
 *       user that already has categories, accounts or transactions.
 *
 * Same safety construction as scripts/seedDemoUser.mts, which this extends in
 * spirit: every write scoped to the freshly created user id; re-running
 * cannot duplicate; pointing it at a lived-in account cannot touch the data.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { DEFAULT_CATEGORY_TREE } from '../src/data/defaultCategoryTree';

// ── CLI ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const DRY_RUN = args.includes('--dry-run');
const fail = (msg: string): never => { console.error(`ABORT: ${msg}`); process.exit(1); };

// ── Deterministic randomness ─────────────────────────────────────────────────
// mulberry32: tiny, seedable, good enough to jitter grocery bills. The seed is
// fixed so the ledger is reproducible; change it only to reroll the texture.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260829);
/** Jitter a base amount by ±pct, to 2dp — zero-mean, so totals stay honest. */
const jitter = (base: number, pct: number): number =>
  Math.round(base * (1 + (rand() * 2 - 1) * pct) * 100) / 100;
/** A day-of-month spread around `base` (±3), clamped to 1..28. */
const dayNear = (base: number): number =>
  Math.min(28, Math.max(1, base + Math.floor(rand() * 7) - 3));

// ── The clock ────────────────────────────────────────────────────────────────

const START = { y: 2016, m: 9 };            // September 2016
const MONTHS = 120;                          // ten years
const TODAY = '2026-08-29';                  // fixed, for determinism
/** Month index → { y, m } (m is 1-12). */
const ym = (i: number): { y: number; m: number } => {
  const t = (START.y * 12 + (START.m - 1)) + i;
  return { y: Math.floor(t / 12), m: (t % 12) + 1 };
};
const dstr = (y: number, m: number, d: number): string =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const monthDate = (i: number, d: number): string => { const { y, m } = ym(i); return dstr(y, m, d); };
/** Linear interpolation across the window. */
const lerp = (from: number, to: number, i: number): number => from + (to - from) * (i / (MONTHS - 1));
const pounds = (n: number): number => Math.round(n * 100) / 100;

// ── The market: one path, shared by everything that floats ───────────────────
// Monthly log-returns with the decade's shape — the 2018 wobble, the 2020
// crash and rebound, the 2022 drawdown — then NORMALISED so the whole path
// compounds to exactly the target annual TWR. Instruments ride this path with
// their own beta and drift, so the ISA's trackers, the single stocks and the
// pension funds all breathe together the way real portfolios do.

function marketPath(annualTwr: number): number[] {
  const shocks = new Map<number, number>([
    // month-index → extra log-return that month (the decade's events)
    [27, -0.06], [28, -0.04],               // late-2018 wobble
    [41, -0.10], [42, -0.13], [43, 0.07], [44, 0.05], // spring 2020
    [65, -0.05], [66, -0.04], [68, -0.05], [70, 0.03], // 2022 drawdown
  ]);
  const r = mulberry32(65537);
  const raw: number[] = [];
  for (let i = 0; i < MONTHS; i += 1) {
    const noise = (r() * 2 - 1) * 0.02;
    raw.push(0.005 + noise + (shocks.get(i) ?? 0));
  }
  // Normalise: scale additively in log-space so Π(1+r) = (1+twr)^(years).
  const targetLog = Math.log(1 + annualTwr) * (MONTHS / 12);
  const currentLog = raw.reduce((s, x) => s + Math.log(1 + x), 0);
  const adjust = (targetLog - currentLog) / MONTHS;
  return raw.map(x => Math.exp(Math.log(1 + x) + adjust) - 1);
}

const MARKET = marketPath(0.065);           // the pension's specified 6.5% TWR

/** An instrument's own monthly path: the market, leveraged by beta, plus its own story. */
function instrumentPath(beta: number, annualAlpha: number, seed: number): number[] {
  const r = mulberry32(seed);
  const alpha = Math.log(1 + annualAlpha) / 12;
  return MARKET.map(m => Math.exp(Math.log(1 + m) * beta + alpha + (r() * 2 - 1) * 0.01) - 1);
}

// ── Instruments ──────────────────────────────────────────────────────────────
// Real tickers carry approximations of their public decade (a demo must rhyme
// with reality to be believable); the funds are invented. All GBP.

interface Instrument {
  symbol: string; name: string; assetType: 'etf' | 'mutual_fund' | 'stock';
  startPrice: number; beta: number; alpha: number; seed: number;
  /** Share of each deployment this instrument takes, per account. */
  weight: number;
}

const ISA_INSTRUMENTS: Instrument[] = [
  { symbol: 'HLUK100', name: 'UK 100 Index Fund Acc', assetType: 'mutual_fund', startPrice: 1.82, beta: 0.85, alpha: -0.005, seed: 11, weight: 0.30 },
  { symbol: 'HLSP500', name: 'US 500 Index Fund Acc', assetType: 'mutual_fund', startPrice: 2.41, beta: 1.15, alpha: 0.045, seed: 12, weight: 0.40 },
  { symbol: 'AAPL', name: 'Apple Inc', assetType: 'stock', startPrice: 21.5, beta: 1.3, alpha: 0.09, seed: 13, weight: 0.06 },
  { symbol: 'GOOGL', name: 'Alphabet Inc', assetType: 'stock', startPrice: 31.0, beta: 1.25, alpha: 0.05, seed: 14, weight: 0.05 },
  { symbol: 'MSFT', name: 'Microsoft Corp', assetType: 'stock', startPrice: 44.0, beta: 1.2, alpha: 0.08, seed: 15, weight: 0.06 },
  { symbol: 'RR.L', name: 'Rolls-Royce Holdings', assetType: 'stock', startPrice: 7.4, beta: 1.6, alpha: 0.0, seed: 16, weight: 0.04 },
  { symbol: 'SHEL.L', name: 'Shell plc', assetType: 'stock', startPrice: 19.2, beta: 0.9, alpha: 0.01, seed: 17, weight: 0.05 },
  { symbol: 'RIO.L', name: 'Rio Tinto plc', assetType: 'stock', startPrice: 24.8, beta: 1.0, alpha: 0.02, seed: 18, weight: 0.04 },
];

const PENSION_INSTRUMENTS: Instrument[] = [
  { symbol: 'PENGEQ', name: 'Global Equity Pension Fund', assetType: 'mutual_fund', startPrice: 3.12, beta: 1.05, alpha: 0.01, seed: 21, weight: 0.60 },
  { symbol: 'PENUKE', name: 'UK Equity Income Pension Fund', assetType: 'mutual_fund', startPrice: 2.05, beta: 0.9, alpha: -0.01, seed: 22, weight: 0.25 },
  { symbol: 'PENBND', name: 'Sterling Bond Pension Fund', assetType: 'mutual_fund', startPrice: 1.48, beta: 0.3, alpha: 0.0, seed: 23, weight: 0.15 },
];

// ── The ledger being built ───────────────────────────────────────────────────

interface Txn {
  id: string; account: string; date: string; description: string;
  amount: number; type: 'income' | 'expense' | 'transfer'; category: string | null;
  needsReview?: boolean; uncleared?: boolean;
}
const txns: Txn[] = [];
const transferPairs: Array<{ out: Txn; into: Txn }> = [];

const add = (account: string, date: string, description: string, amount: number,
  category: string | null, extra?: Partial<Txn>): Txn => {
  const t: Txn = {
    id: randomUUID(), account, date, description, amount: pounds(amount),
    type: amount >= 0 ? 'income' : 'expense', category, ...extra,
  };
  txns.push(t);
  return t;
};
const addTransfer = (fromA: string, toA: string, date: string, desc: string, amount: number): void => {
  const out = add(fromA, date, desc, -amount, 'CAT:Transfer Out');
  const into = add(toA, date, desc, amount, 'CAT:Transfer In');
  out.type = 'transfer'; into.type = 'transfer';
  transferPairs.push({ out, into });
};

// Category references are by name at build time ('CAT:<name>'), resolved to
// ids at insert time — the dry run never needs a database.

// ── Accounts ─────────────────────────────────────────────────────────────────

interface AccountSeed {
  key: string; name: string; type: string; initial: number; institution: string;
  linked?: boolean;
}
const ACCOUNTS: AccountSeed[] = [
  { key: 'current', name: 'Premier Current Account', type: 'checking', initial: 4200, institution: 'HSBC', linked: true },
  { key: 'saver', name: 'Instant Access Saver', type: 'savings', initial: 50000, institution: 'Marcus by Goldman Sachs' },
  { key: 'amex', name: 'Platinum Cashback Card', type: 'credit', initial: 0, institution: 'American Express', linked: true },
  { key: 'visa', name: 'Rewards Visa', type: 'credit', initial: 0, institution: 'Barclaycard', linked: true },
  { key: 'pension', name: 'Personal Pension — SIPP', type: 'investment', initial: 250000, institution: 'Scottish Widows' },
  { key: 'isa', name: 'Stocks & Shares ISA', type: 'investment', initial: 210400, institution: 'Hargreaves Lansdown' },
  { key: 'house', name: 'Home — 14 Orchard Lane', type: 'asset', initial: 600000, institution: 'Property' },
  { key: 'mortgage', name: 'Mortgage — 14 Orchard Lane', type: 'mortgage', initial: -195000, institution: 'Nationwide' },
];

// ── The engine ───────────────────────────────────────────────────────────────

// Mortgage: £195k at 3%/yr; the payment is solved so ten years of amortisation
// leaves ~£50k outstanding (the owner's spec) — £1,525/mo does it.
const MORTGAGE_RATE_M = 0.03 / 12;
const MORTGAGE_PAYMENT = 1525;

// Car lease eras — every three years, the payment the owner named.
const LEASES = [
  { until: 36, amount: 500, payee: 'BMW FINANCIAL SERVICES' },
  { until: 72, amount: 850, payee: 'AUDI FINANCE' },
  { until: 108, amount: 1150, payee: 'MERCEDES-BENZ FINANCE UK' },
  { until: 999, amount: 1500, payee: 'PORSCHE FINANCIAL SERVICES' },
];

// Saver: opening £50k → ~£100k. Interest follows the decade's UK rates; the
// flat monthly top-up is CALIBRATED below to land the target.
const SAVER_RATE_M = (i: number): number =>
  (i < 48 ? 0.008 : i < 66 ? 0.004 : i < 78 ? 0.025 : 0.042) / 12;

function calibrateSaverTopUp(): number {
  const target = 100000;
  let lo = 0; let hi = 800;
  for (let iter = 0; iter < 40; iter += 1) {
    const t = (lo + hi) / 2;
    let bal = 50000;
    for (let i = 0; i < MONTHS; i += 1) bal = bal * (1 + SAVER_RATE_M(i)) + t;
    if (bal > target) hi = t; else lo = t;
  }
  return Math.round(((lo + hi) / 2) / 5) * 5; // a standing order is a round number
}
const SAVER_TOPUP = calibrateSaverTopUp();

// Holdings state, per investment account.
interface Holding {
  inst: Instrument; qty: number; cost: number; path: number[];
  buys: Array<{ date: string; qty: number; price: number; total: number }>;
}
const mkHoldings = (list: Instrument[]): Holding[] =>
  list.map(inst => ({ inst, qty: 0, cost: 0, path: instrumentPath(inst.beta, inst.alpha, inst.seed), buys: [] }));
const priceAt = (h: Holding, i: number): number => {
  let p = h.inst.startPrice;
  for (let k = 0; k <= i; k += 1) p *= 1 + h.path[k];
  return Math.round(p * 10000) / 10000;
};

const isaHoldings = mkHoldings(ISA_INSTRUMENTS);
const pensionHoldings = mkHoldings(PENSION_INSTRUMENTS);

/** Deploy `cash` across an account's instruments at month i's prices. */
function buy(holdings: Holding[], accountKey: string, i: number, cash: number, day: number): number {
  let spent = 0;
  for (const h of holdings) {
    const slice = pounds(cash * h.inst.weight);
    if (slice < 50) continue;
    const price = priceAt(h, i);
    const qty = Math.round((slice / price) * 10000) / 10000;
    const total = pounds(qty * price);
    h.qty += qty; h.cost += total; spent += total;
    h.buys.push({ date: monthDate(i, day), qty, price, total });
  }
  return pounds(spent);
}

// The investment engine keeps the register and the holdings in ONE identity:
//   account value = uninvested cash + Σ(qty × price)
// and each month's Market Value Change row is exactly the value change the
// cashflows don't explain. B-1 holds by construction, which is the whole
// discipline of this file.
interface InvestState { cash: number; holdings: Holding[]; value: number }
const isaState: InvestState = { cash: 0, holdings: isaHoldings, value: 0 };
const pensionState: InvestState = { cash: 0, holdings: pensionHoldings, value: 0 };

const holdingsValue = (hs: Holding[], i: number): number =>
  pounds(hs.reduce((s, h) => s + h.qty * priceAt(h, i), 0));

// Opening deployment: the opening balances are already-invested portfolios.
{
  // "before the window": buy at month-0 prices, cost basis = opening value.
  buy(isaHoldings, 'isa', 0, 210400 * 0.97, 1);
  isaState.cash = pounds(210400 - isaHoldings.reduce((s, h) => s + h.cost, 0));
  buy(pensionHoldings, 'pension', 0, 250000 * 0.98, 1);
  pensionState.cash = pounds(250000 - pensionHoldings.reduce((s, h) => s + h.cost, 0));
  isaState.value = pounds(isaState.cash + holdingsValue(isaHoldings, 0));
  pensionState.value = pounds(pensionState.cash + holdingsValue(pensionHoldings, 0));
}

// House path: the decade's shape (steady, a 2020 pause, a 2021-22 surge),
// normalised to land £1.0m from £600k.
const HOUSE_PATH = ((): number[] => {
  const raw: number[] = [];
  for (let i = 0; i < MONTHS; i += 1) {
    const yearish = i / 12;
    raw.push(yearish < 3.5 ? 0.004 : yearish < 4.6 ? 0.0 : yearish < 6.2 ? 0.008 : 0.0028);
  }
  const targetLog = Math.log(1000000 / 600000);
  const currentLog = raw.reduce((s, x) => s + Math.log(1 + x), 0);
  const adjust = (targetLog - currentLog) / MONTHS;
  return raw.map(x => Math.exp(Math.log(1 + x) + adjust) - 1);
})();

// ── Simulate the ten years ───────────────────────────────────────────────────

let mortgageBal = -195000;
let houseVal = 600000;
let saverBal = 50000;
let currentBal = 4200;
let amexOwed = 0;   // this month's spending, paid next month
let visaOwed = 0;
const yearly: Array<Record<string, number>> = [];

// The last weeks stay unfinished on purpose — the Reconciliation and To
// Review screenshots need work to show.
const CLEARED_UP_TO = '2026-08-07';
const RECONCILED_UP_TO = '2026-06-30';

for (let i = 0; i < MONTHS; i += 1) {
  const { y, m } = ym(i);
  const isCurrentMonth = i === MONTHS - 1;

  // Salary: £15,000 → £25,000 net/month, stepping each April.
  const aprils = Math.floor((i + (START.m - 4 + 12) % 12) / 12);
  const salary = pounds(15000 + (25000 - 15000) * (aprils / 10) + jitter(0, 0) );
  add('current', monthDate(i, 25), 'MERIDIAN CAPITAL LLP — SALARY', salary, 'CAT:Net Pay');
  currentBal += salary;

  // Pension: the £2,000 in, then HMRC's £400 — an Account Adjustment, exactly
  // as the owner records his own (value arrived, nothing was earned or spent).
  addTransfer('current', 'pension', monthDate(i, 1), 'STANDING ORDER — SIPP CONTRIBUTION', 2000);
  currentBal -= 2000; pensionState.cash += 2000;
  add('pension', monthDate(i, 3), 'HMRC TAX RELIEF AT SOURCE', 400, 'CAT:Account Adjustment');
  pensionState.cash += 400;

  // ISA: £3,000 in.
  addTransfer('current', 'isa', monthDate(i, 2), 'STANDING ORDER — HL ISA', 3000);
  currentBal -= 3000; isaState.cash += 3000;

  // Saver top-up (calibrated) and monthly interest.
  addTransfer('current', 'saver', monthDate(i, 4), 'STANDING ORDER — INSTANT SAVER', SAVER_TOPUP);
  currentBal -= SAVER_TOPUP;
  const interest = pounds(saverBal * SAVER_RATE_M(i));
  saverBal = pounds(saverBal * (1 + SAVER_RATE_M(i)) + SAVER_TOPUP);
  if (interest > 0) add('saver', monthDate(i, 28), 'INTEREST PAID', interest, 'CAT:Bank Interest');

  // Mortgage: interest charged inside the account, payment transferred in.
  const mInterest = pounds(-mortgageBal * MORTGAGE_RATE_M);
  add('mortgage', monthDate(i, 5), 'INTEREST CHARGED', -mInterest, 'CAT:Loan Interest Paid');
  addTransfer('current', 'mortgage', monthDate(i, 6), 'MORTGAGE PAYMENT — NATIONWIDE', MORTGAGE_PAYMENT);
  mortgageBal = pounds(mortgageBal - mInterest + MORTGAGE_PAYMENT);
  currentBal -= MORTGAGE_PAYMENT;

  // The car of the era.
  const lease = LEASES.find(l => i < l.until) ?? LEASES[3];
  add('current', monthDate(i, 8), lease.payee, -lease.amount, 'CAT:Financing & Leasing Charges');
  currentBal -= lease.amount;

  // House: quarterly revaluation.
  const growth = pounds(houseVal * HOUSE_PATH[i]);
  houseVal = pounds(houseVal + growth);
  if (m % 3 === 0) {
    const quarter = pounds(houseVal - 600000 - txns
      .filter(t => t.account === 'house')
      .reduce((s, t) => s + t.amount, 0));
    const reval = add('house', monthDate(i, 15), 'PROPERTY VALUE UPDATE — LOCAL SOLD PRICES', quarter, 'CAT:Market Value Change');
    reval.type = quarter >= 0 ? 'income' : 'expense';
  }

  // Investment accounts: quarterly deployment of accumulated cash, monthly
  // valuation row derived from the identity (see InvestState).
  for (const [key, st] of [['isa', isaState], ['pension', pensionState]] as const) {
    if (m % 3 === 1 && i > 0 && st.cash > 5000) {
      const spent = buy(st.holdings, key, i, st.cash - 500, 10);
      st.cash = pounds(st.cash - spent);
    }
    const newValue = pounds(st.cash + holdingsValue(st.holdings, i));
    const cashflows = (key === 'isa' ? 3000 : 2400);
    const reval = pounds(newValue - st.value - cashflows);
    if (Math.abs(reval) >= 0.01) {
      const r = add(key, monthDate(i, 27), 'MARKET VALUE UPDATE', reval, 'CAT:Market Value Change');
      r.type = reval >= 0 ? 'income' : 'expense';
    }
    st.value = newValue;
  }

  // ── Bills and life, era-scaled ─────────────────────────────────────────────
  const scale = lerp(1, 1.9, i);            // prices roughly double over the decade
  const bill = (day: number, payee: string, base: number, catName: string, acct = 'current'): void => {
    const amt = -jitter(base * scale, 0.06);
    add(acct, monthDate(i, day), payee, amt, `CAT:${catName}`);
    if (acct === 'current') currentBal += amt;
    else if (acct === 'amex') amexOwed -= amt;
    else visaOwed -= amt;
  };

  bill(1, 'ELMBRIDGE BOROUGH COUNCIL', 210, 'Council Tax');
  bill(3, 'OCTOPUS ENERGY', 160, 'Gas & Electricity');
  bill(5, 'THAMES WATER', 48, 'Water & Sewerage');
  bill(7, 'SKY Q & BROADBAND', 78, 'Telephone/Broadband/Sky/Tv Licence');
  bill(9, 'EE MOBILE', 55, 'Mobile Phone');
  bill(11, 'AVIVA HOME INSURANCE', 62, 'Insurance');
  bill(12, 'ADMIRAL MULTICAR', 98, 'Insurance-V');
  bill(13, 'NETFLIX.COM', 11, 'Subscriptions');
  bill(14, 'SPOTIFY UK', 10, 'Subscriptions');
  bill(15, 'DAVID LLOYD CLUBS', 89, 'Subscriptions');

  // Cards: the day-to-day, always on plastic (owner's spec).
  bill(dayNear(4), 'SHELL WEYBRIDGE', 55, 'Fuel Costs', 'amex');
  bill(dayNear(18), 'BP CONNECT COBHAM', 52, 'Fuel Costs', 'amex');
  for (const day of [3, 8, 13, 19, 24]) {
    bill(dayNear(day), rand() < 0.5 ? 'WAITROSE & PARTNERS' : 'M&S SIMPLY FOOD', 68, 'Food Shopping', 'visa');
  }
  for (const day of [6, 12, 21]) {
    bill(dayNear(day), ['THE IVY COBHAM', 'CÔTE BRASSERIE', 'PIZZA EXPRESS', 'THE WHITE HART'][Math.floor(rand() * 4)], 48, 'Dining Out', 'amex');
  }
  for (const day of [2, 9, 16, 23]) {
    bill(dayNear(day), rand() < 0.6 ? 'CAFFÈ NERO' : 'GAIL\'S BAKERY', 4.4, 'Coffee Shops', 'amex');
  }
  bill(dayNear(17), 'DELIVEROO', 18, 'Takeaways', 'visa');
  bill(dayNear(20), 'AMAZON.CO.UK', 24, 'Other/Misc-H', 'visa');
  bill(dayNear(22), 'JOHN LEWIS & PARTNERS', 45, 'Furnishings', 'visa');

  // Seasonal: December gifts, summer holiday, February ski trip most years.
  if (m === 12) bill(dayNear(10), 'JOHN LEWIS & PARTNERS', 260, 'Gifts', 'visa');
  if (m === 7) {
    const holiday = -jitter(2600 * scale, 0.12);
    add('amex', monthDate(i, dayNear(8)), 'BRITISH AIRWAYS', holiday * 0.45, 'CAT:Family Holidays');
    add('amex', monthDate(i, dayNear(9)), 'MARRIOTT RESORTS', holiday * 0.55, 'CAT:Family Holidays');
    amexOwed -= holiday;
  }
  if (m === 2 && y % 2 === 0) {
    const ski = -jitter(1400 * scale, 0.1);
    add('amex', monthDate(i, dayNear(12)), 'CRYSTAL SKI HOLIDAYS', ski, 'CAT:Family Holidays');
    amexOwed -= ski;
  }
  // The residual spender: whatever the month's committed flows leave behind
  // beyond a modest cushion goes on living (the owner's instruction) — split
  // across the categories a card statement actually carries.
  {
    // Spend the month's surplus down to a believable cushion — the owner's
    // instruction was to work the lifestyle out as the residual and see
    // where it lands. The categories are what a comfortable card statement
    // actually carries; weights jitter so no two months match.
    const cushion = 6000 + (currentBal - 6000) * 0.06; // drift gently toward ~£6k
    let left = pounds(currentBal - amexOwed - visaOwed - cushion);
    if (left > 400) {
      const chunks: Array<[string, string, string, number]> = [
        ['SELFRIDGES & CO', 'Clothing', 'amex', 0.14],
        ['HARRODS', 'Clothing', 'visa', 0.08],
        ['APPLE STORE REGENT ST', 'Other/Misc-P', 'visa', 0.08],
        ['THE PETERSHAM RICHMOND', 'Dining Out', 'amex', 0.10],
        ['CENTRE COURT GARDEN CO', 'Maintenance, Repairs & Gardening', 'visa', 0.12],
        ['BUPA DENTAL CARE', 'Dental', 'current', 0.05],
        ['SECRET ESCAPES', 'Family Holidays', 'amex', 0.14],
        ['WATCHES OF SWITZERLAND', 'Gifts', 'amex', 0.07],
        ['PC RICHARDSON INTERIORS', 'Furnishings', 'visa', 0.12],
        ['CHILDS FARM DAY NURSERY', 'Nursery / Schooling', 'current', 0.10],
      ];
      for (const [payee, catName, acctKey, share] of chunks) {
        if (left < 120) break;
        const amt = pounds(Math.min(left, left * 0.9 * jitter(share * 2.4, 0.3)));
        if (amt < 40) continue;
        bill(dayNear(15), payee, amt / scale, catName, acctKey);
        left = pounds(left - amt);
      }
    }
  }

  // Card statements: last month's balance paid in full, always (the spec).
  if (amexOwed > 0 && !isCurrentMonth) {
    addTransfer('current', 'amex', monthDate(i, 24), 'AMEX PAYMENT RECEIVED — THANK YOU', pounds(amexOwed));
    currentBal -= amexOwed; amexOwed = 0;
  }
  if (visaOwed > 0 && !isCurrentMonth) {
    addTransfer('current', 'visa', monthDate(i, 26), 'BARCLAYCARD PAYMENT — THANK YOU', pounds(visaOwed));
    currentBal -= visaOwed; visaOwed = 0;
  }

  if (m === 12 || isCurrentMonth) {
    yearly.push({
      year: y,
      house: houseVal, mortgage: mortgageBal, pension: pensionState.value,
      isa: isaState.value, saver: saverBal, current: pounds(currentBal),
    });
  }
}

// ── The unfinished edges (the whole point of two of the screenshots) ─────────

// Recent card arrivals still awaiting review, feed-style.
const REVIEW_ROWS: Array<[string, string, string, number]> = [
  ['amex', '2026-08-26', 'PRET A MANGER 441', -6.4],
  ['amex', '2026-08-27', 'SHELL WEYBRIDGE', -58.2],
  ['visa', '2026-08-27', 'WAITROSE & PARTNERS 220', -84.15],
  ['current', '2026-08-28', 'FPS CREDIT R HARRIS', 120.0],
  ['visa', '2026-08-28', 'AMAZON.CO.UK MKTP', -31.99],
  ['amex', '2026-08-28', 'TFL TRAVEL CHARGE', -8.4],
];
for (const [acct, date, desc, amt] of REVIEW_ROWS) {
  add(acct, date, desc, amt, null, { needsReview: true, uncleared: true });
}

// ── Dry-run report ───────────────────────────────────────────────────────────

const fmt = (n: number): string => `£${Math.round(n).toLocaleString('en-GB')}`;
console.log(`\nTHE SHOWCASE LEDGER — ${txns.length.toLocaleString()} transactions over ten years`);
console.log(`saver standing order calibrated to £${SAVER_TOPUP}/mo\n`);
console.log('year   house      mortgage   pension    ISA        saver     current');
for (const r of yearly) {
  console.log(
    `${r.year}   ${fmt(r.house).padEnd(10)} ${fmt(r.mortgage).padEnd(10)} ${fmt(r.pension).padEnd(10)} ${fmt(r.isa).padEnd(10)} ${fmt(r.saver).padEnd(9)} ${fmt(r.current)}`
  );
}
const last = yearly[yearly.length - 1];
const netWorth = last.house + last.mortgage + last.pension + last.isa + last.saver + last.current;
console.log(`\nNET WORTH TODAY: ${fmt(netWorth)}  (owner's aspiration: £1.7m — tweak from here)`);
console.log('\nISA holdings today:');
for (const h of isaHoldings) {
  const price = priceAt(h, MONTHS - 1);
  console.log(`  ${h.inst.symbol.padEnd(8)} ${h.inst.name.padEnd(32)} qty ${h.qty.toFixed(2).padStart(12)}  value ${fmt(h.qty * price)}`);
}
console.log('Pension holdings today:');
for (const h of pensionHoldings) {
  const price = priceAt(h, MONTHS - 1);
  console.log(`  ${h.inst.symbol.padEnd(8)} ${h.inst.name.padEnd(32)} qty ${h.qty.toFixed(2).padStart(12)}  value ${fmt(h.qty * price)}`);
}

if (DRY_RUN) {
  console.log('\nDRY RUN — nothing written.');
  process.exit(0);
}

// ── Insert mode ──────────────────────────────────────────────────────────────

const EMAIL = flag('email') ?? fail('--email is required (or use --dry-run)');
const PASSWORD = flag('password') ?? fail('--password is required');
const envPath = flag('env') ?? '.env.local';
if (!existsSync(envPath)) fail(`env file not found: ${envPath}`);
const env = Object.fromEntries(readFileSync(envPath, 'utf8').split('\n')
  .filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const { createClient } = await import('@supabase/supabase-js');
const url = env.VITE_SUPABASE_URL ?? fail('VITE_SUPABASE_URL missing');
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? fail('SUPABASE_SERVICE_ROLE_KEY missing');
const clerkKey = env.CLERK_SECRET_KEY ?? fail('CLERK_SECRET_KEY missing');
const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

async function clerkFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${clerkKey}`, 'Content-Type': 'application/json', ...init?.headers },
  });
}
async function findOrCreateClerkUser(): Promise<string> {
  const lookup = await clerkFetch(`/users?email_address=${encodeURIComponent(EMAIL)}`);
  if (!lookup.ok) fail(`Clerk lookup failed: HTTP ${lookup.status}`);
  const existing = (await lookup.json()) as Array<{ id: string }>;
  if (existing.length > 0) { console.log(`Clerk user exists (${existing[0].id}) — reusing.`); return existing[0].id; }
  const created = await clerkFetch('/users', {
    method: 'POST',
    body: JSON.stringify({
      email_address: [EMAIL], password: PASSWORD,
      first_name: 'Alex', last_name: 'Showcase', skip_password_checks: true,
    }),
  });
  if (!created.ok) fail(`Clerk create failed: HTTP ${created.status} ${await created.text()}`);
  const user = (await created.json()) as { id: string };
  console.log(`Clerk user created: ${user.id}`);
  return user.id;
}
async function findOrCreateDbUser(clerkId: string): Promise<string> {
  const { data: found, error: readErr } = await sb.from('users').select('id').eq('clerk_id', clerkId).maybeSingle();
  if (readErr) fail(`users read: ${readErr.message}`);
  if (found) { console.log(`users row exists (${found.id}) — reusing.`); return found.id; }
  const { data: inserted, error: insErr } = await sb.from('users').insert({
    clerk_id: clerkId, email: EMAIL, first_name: 'Alex', last_name: 'Showcase',
    subscription_tier: 'pro', subscription_status: 'active',
  }).select('id').single();
  if (insErr || !inserted) fail(`users insert: ${insErr?.message}`);
  console.log(`users row created: ${inserted.id}`);
  return inserted.id;
}

const clerkId = await findOrCreateClerkUser();
const USER = await findOrCreateDbUser(clerkId);

for (const table of ['categories', 'accounts', 'transactions'] as const) {
  const { count, error } = await sb.from(table).select('id', { count: 'exact', head: true }).eq('user_id', USER);
  if (error) fail(`${table} count: ${error.message}`);
  if ((count ?? 0) > 0) fail(`user ${USER} already has ${count} ${table} — refusing to seed twice`);
}

// Categories: the SHIPPING starter tree (so screenshots match what a new user
// gets) plus the system set, plus the handful of extra leaves this life needs.
interface CatRow { id: string; name: string; type: string; level: string; parent?: string; isSystem?: boolean; isTransfer?: boolean; isRevaluation?: boolean }
const catRows: CatRow[] = [
  { id: randomUUID(), name: 'Income', type: 'income', level: 'type', isSystem: true },
  { id: randomUUID(), name: 'Expense', type: 'expense', level: 'type', isSystem: true },
  { id: randomUUID(), name: 'Transfer', type: 'both', level: 'type', isSystem: true, isTransfer: true },
  { id: randomUUID(), name: 'Transfer In', type: 'both', level: 'detail', parent: 'Transfer', isSystem: true, isTransfer: true },
  { id: randomUUID(), name: 'Transfer Out', type: 'both', level: 'detail', parent: 'Transfer', isSystem: true, isTransfer: true },
  { id: randomUUID(), name: 'Revaluation', type: 'both', level: 'type', isSystem: true, isRevaluation: true },
  { id: randomUUID(), name: 'Market Value Change', type: 'both', level: 'detail', parent: 'Revaluation', isSystem: true, isRevaluation: true },
  { id: randomUUID(), name: 'Account Adjustment', type: 'both', level: 'detail', parent: 'Revaluation', isSystem: true, isRevaluation: true },
];
for (const group of DEFAULT_CATEGORY_TREE) {
  const parentType = group.type === 'income' ? 'Income' : 'Expense';
  catRows.push({ id: randomUUID(), name: group.name, type: group.type, level: 'sub', parent: parentType });
  const leaves = group.children.length > 0 ? group.children : [group.name];
  for (const leaf of leaves) {
    catRows.push({ id: randomUUID(), name: leaf, type: group.type, level: 'detail', parent: group.name });
  }
}

// The generator speaks a few names the tree holds twice (Insurance,
// Other/Misc) — disambiguated here by group. 'Insurance-V' means Vehicles'.
const DISAMBIG: Record<string, [string, string]> = {
  'Insurance': ['Household', 'Insurance'],
  'Insurance-V': ['Vehicles', 'Insurance'],
  'Other/Misc-H': ['Household', 'Other/Misc'],
  'Other/Misc-P': ['Personal', 'Other/Misc'],
};
const catIdByName = new Map<string, string>();
const catIdByPair = new Map<string, string>();
for (const c of catRows) {
  if (!catIdByName.has(c.name)) catIdByName.set(c.name, c.id);
  if (c.parent) catIdByPair.set(`${c.parent}:${c.name}`, c.id);
}
function resolveCat(ref: string | null): string | null {
  if (ref === null) return null;
  const name = ref.replace(/^CAT:/, '');
  const dis = DISAMBIG[name];
  if (dis) return catIdByPair.get(`${dis[0]}:${dis[1]}`) ?? fail(`unknown category pair ${dis.join(':')}`);
  return catIdByName.get(name) ?? fail(`unknown category ${name}`);
}

{
  const rows = catRows.map(c => ({
    id: c.id, user_id: USER, name: c.name, type: c.type, level: c.level,
    parent_id: c.parent ? (catIdByName.get(c.parent) ?? fail(`unknown parent ${c.parent}`)) : null,
    is_system: c.isSystem ?? false,
    is_transfer_category: c.isTransfer ?? false,
    is_revaluation_category: c.isRevaluation ?? false,
    is_active: true,
  }));
  const { error } = await sb.from('categories').insert(rows);
  if (error) fail(`categories insert: ${error.message}`);
  console.log(`categories: ${rows.length}`);
}

// Accounts.
const acctId = new Map<string, string>(ACCOUNTS.map(a => [a.key, randomUUID()]));
const acct = (key: string): string => acctId.get(key) ?? fail(`unknown account ${key}`);
{
  const { error } = await sb.from('accounts').insert(ACCOUNTS.map(a => ({
    id: acct(a.key), user_id: USER, name: a.name, type: a.type, currency: 'GBP',
    balance: a.initial, initial_balance: a.initial, institution: a.institution, is_active: true,
  })));
  if (error) fail(`accounts insert: ${error.message}`);
  console.log(`accounts: ${ACCOUNTS.length}`);
}

// Transactions.
{
  const rows = txns.map(t => ({
    id: t.id, user_id: USER, account_id: acct(t.account), date: t.date,
    description: t.description, amount: t.amount, type: t.type,
    category: resolveCat(t.category),
    is_cleared: !t.uncleared && t.date <= CLEARED_UP_TO,
    is_reconciled: !t.uncleared && t.date <= RECONCILED_UP_TO,
    needs_review: t.needsReview ?? false,
  }));
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await sb.from('transactions').insert(rows.slice(i, i + 200));
    if (error) fail(`transactions insert (batch ${i}): ${error.message}`);
  }
  console.log(`transactions: ${rows.length}`);
}
for (const { out, into } of transferPairs) {
  for (const [leg, other] of [[out, into], [into, out]] as const) {
    const { error } = await sb.from('transactions')
      .update({ transfer_account_id: acct(other.account), linked_transfer_id: other.id })
      .eq('id', leg.id).eq('user_id', USER);
    if (error) fail(`transfer link (${leg.description} ${leg.date}): ${error.message}`);
  }
}
console.log(`transfers: ${transferPairs.length} pairs linked`);

// Balances from the register — the identity, not a guess.
for (const a of ACCOUNTS) {
  const sum = txns.filter(t => t.account === a.key).reduce((s, t) => s + Math.round(t.amount * 100), 0);
  const balance = (Math.round(a.initial * 100) + sum) / 100;
  const linked = a.linked
    ? { bank_balance: balance, bank_balance_date: TODAY }
    : {};
  const { error } = await sb.from('accounts').update({ balance, ...linked }).eq('id', acct(a.key)).eq('user_id', USER);
  if (error) fail(`balance (${a.name}): ${error.message}`);
  console.log(`  ${a.name}: £${balance.toFixed(2)}`);
}

// Holdings + trade history + quarterly price series.
{
  const invRows: object[] = [];
  const tradeRows: object[] = [];
  const priceRows: object[] = [];
  for (const [key, holdings] of [['isa', isaHoldings], ['pension', pensionHoldings]] as const) {
    for (const h of holdings) {
      const invId = randomUUID();
      const price = priceAt(h, MONTHS - 1);
      invRows.push({
        id: invId, user_id: USER, account_id: acct(key),
        symbol: h.inst.symbol, name: h.inst.name,
        quantity: h.qty, cost_basis: pounds(h.cost),
        current_price: price, market_value: pounds(h.qty * price),
        asset_type: h.inst.assetType, currency: 'GBP',
        purchase_date: h.buys[0]?.date ?? monthDate(0, 1),
        purchase_price: h.buys[0]?.price ?? h.inst.startPrice,
        last_updated: new Date(`${TODAY}T08:00:00Z`).toISOString(),
      });
      for (const b of h.buys) {
        tradeRows.push({
          id: randomUUID(), investment_id: invId, user_id: USER,
          transaction_type: 'buy', quantity: b.qty, price: b.price,
          total_amount: b.total, date: b.date,
        });
      }
      for (let q = 0; q < MONTHS; q += 3) {
        priceRows.push({
          user_id: USER, symbol: h.inst.symbol, price_date: monthDate(q, 27),
          price: priceAt(h, q), currency: 'GBP', source: 'manual',
        });
      }
      priceRows.push({
        user_id: USER, symbol: h.inst.symbol, price_date: TODAY,
        price, currency: 'GBP', source: 'manual',
      });
    }
  }
  for (const [table, rows] of [['investments', invRows], ['investment_transactions', tradeRows], ['investment_prices', priceRows]] as const) {
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await sb.from(table).insert(rows.slice(i, i + 200));
      if (error) fail(`${table} insert: ${error.message}`);
    }
    console.log(`${table}: ${rows.length}`);
  }
}

// Budgets — the screenshot's subjects, sized to the ledger's own spending.
{
  const budgets: Array<[string, string, number, string]> = [
    ['Food shopping', 'Food Shopping', 1600, 'monthly'],
    ['Dining out', 'Dining Out', 900, 'monthly'],
    ['Fuel', 'Fuel Costs', 260, 'monthly'],
    ['Coffee', 'Coffee Shops', 90, 'monthly'],
    ['Holidays', 'Family Holidays', 15000, 'yearly'],
    ['Gifts', 'Gifts', 1200, 'yearly'],
  ];
  const rows = budgets.map(([name, catName, amount, period]) => ({
    user_id: USER, name, amount, period,
    category: resolveCat(`CAT:${catName}`),
    category_id: resolveCat(`CAT:${catName}`),
    start_date: '2026-01-01', is_active: true, alert_threshold: 80,
  }));
  const { error } = await sb.from('budgets').insert(rows);
  if (error) fail(`budgets insert: ${error.message}`);
  console.log(`budgets: ${rows.length}`);
}

// Bank feeds: three healthy connections, their linked accounts and a recent
// sync trail — enough for the Bank Feeds page to photograph. The tokens are
// the string below; nothing here can call a bank.
{
  const connections = [
    { key: 'current', institution_id: 'demo-hsbc', name: 'HSBC' },
    { key: 'amex', institution_id: 'demo-amex', name: 'American Express' },
    { key: 'visa', institution_id: 'demo-barclaycard', name: 'Barclaycard' },
  ];
  for (const c of connections) {
    const connId = randomUUID();
    const { error } = await sb.from('bank_connections').insert({
      id: connId, user_id: USER, provider: 'truelayer',
      institution_id: c.institution_id, institution_name: c.name,
      access_token_encrypted: 'demo-showcase-not-a-token',
      status: 'connected',
      last_sync: new Date(`${TODAY}T06:30:00Z`).toISOString(),
      expires_at: new Date('2026-11-20T00:00:00Z').toISOString(),
    });
    if (error) fail(`bank_connections (${c.name}): ${error.message}`);
    const { error: linkErr } = await sb.from('linked_accounts').insert({
      connection_id: connId, account_id: acct(c.key),
      external_account_id: `demo-${c.key}`, external_account_mask: '4471',
      external_account_name: ACCOUNTS.find(a => a.key === c.key)?.name,
    });
    if (linkErr) fail(`linked_accounts (${c.name}): ${linkErr.message}`);
    for (let d = 6; d >= 0; d -= 1) {
      const when = new Date(`${TODAY}T06:30:00Z`);
      when.setDate(when.getDate() - d);
      const { error: shErr } = await sb.from('sync_history').insert({
        connection_id: connId, sync_type: 'transactions', status: 'success',
        records_synced: d === 0 ? 6 : Math.floor(rand() * 4),
        created_at: when.toISOString(),
      });
      if (shErr) fail(`sync_history (${c.name}): ${shErr.message}`);
    }
  }
  console.log('bank feeds: 3 connections, linked, 7 days of sync history each');
}

console.log('\nDONE — sign in and photograph.');
