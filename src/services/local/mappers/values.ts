/**
 * The primitives every crate answer is read through — and the ONE place a
 * money string becomes a number.
 *
 * ── WHY MONEY IS PARSED EXACTLY ONCE, HERE ──────────────────────────────────
 *
 * The crate hands money over as a fixed two-place decimal STRING, never as a
 * JSON number, and it does that on purpose: a JSON number is an IEEE-754 double
 * by the time any parser has read it, so `money.rs` refuses one outright
 * (`amount_must_be_a_string`). Seam rule 2 then says the app's side of the
 * boundary holds a `number`, because `Account.balance` and `Transaction.amount`
 * are `number` and widening them is a rewrite of every arithmetic site rather
 * than a seam.
 *
 * So exactly one conversion has to happen, and PHASE3-PLAN §3 makes it a
 * greppable rule: **no arithmetic on a money field anywhere under
 * `src/services/local/`** — parse once, here, and never divide, multiply or
 * total anything on the way past. R-7 is the mutation: a second conversion (the
 * classic `minor / 100`) is *"one careless line in the numbers on screen"*, and
 * there is no `/ 100` in this directory to find.
 *
 * `Number('30.60')` is exact in the only sense that matters: it is the same
 * double the cloud's `numeric(20,2)` column produces through PostgREST for the
 * same figure, so the two engines agree to the penny on every value the
 * contract suite compares. What must never happen is arriving at that double by
 * a different route — `Number(minor) / 100` gives 30.599999999999998 for some
 * inputs, which is a different number and a wrong one.
 */

/** A JSON object, and nothing that merely looks like one. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * One named field of an answer, without asserting anything about its type.
 * Absent keys and non-objects both read as `undefined`, which every reader
 * below then turns into the app's own "not stated" value.
 */
export const field = (value: unknown, key: string): unknown =>
  isRecord(value) ? value[key] : undefined;

/**
 * The rows of a named list in a verb's answer.
 *
 * @throws when the key is absent or is not a list. A verb that answered the
 * wrong shape is a FAULT — the crate's dispatch is exhaustive and its structs
 * are serialised by serde, so a missing `accounts` key means the transport is
 * talking to something other than this crate. Returning `[]` would report that
 * as an empty ledger, which is the one wrong answer nobody would question.
 */
export function rowsOf(answer: unknown, verb: string, key: string): Record<string, unknown>[] {
  return listOf(field(answer, 'answer'), verb, key);
}

/**
 * The rows of a named list ON a result object.
 *
 * The same rule as `rowsOf` one level up: the reads wrap their lists in
 * `{ answer: … }` and a write's list — the split writer's `counterparts` — sits
 * on the result itself. One reader, two callers, so a missing key is the same
 * fault either way rather than an empty array in one of them.
 *
 * @throws for `rowsOf`'s reason.
 */
export function listOf(value: unknown, verb: string, key: string): Record<string, unknown>[] {
  const list = field(value, key);
  if (!Array.isArray(list)) {
    throw new Error(`The ledger file answered ${verb} without a ${key} list.`);
  }
  return list.filter(isRecord);
}

/**
 * One named part of a WRITE verb's answer.
 *
 * The reads all wrap their rows in `{ answer: { <name>: [...] } }`; a write
 * answers with its own object — `{ transaction, audit_seq, … }` — and the four
 * that port a function returning a scalar put that scalar under `answer` beside
 * it. So `rowsOf` above cannot serve both, and this is the write side's reader.
 *
 * @throws when the key is absent or is not an object, for `rowsOf`'s reason:
 * the crate's dispatch is exhaustive and its results are serialised by serde, so
 * a missing key means the transport is talking to something other than this
 * crate. A default here would report that as a write that did nothing.
 */
export function rowOf(answer: unknown, verb: string, key: string): Record<string, unknown> {
  const value = field(answer, key);
  if (!isRecord(value)) {
    throw new Error(`The ledger file answered ${verb} without a ${key}.`);
  }
  return value;
}

/**
 * A count a write verb reports.
 *
 * `undefined` is refused rather than defaulted to 0 for the reason every count
 * in this seam is shown to somebody: "0 rows unlinked" and "the answer did not
 * say" are different sentences, and only one of them is true.
 *
 * @throws when the key is absent or is not a whole number.
 */
export function countOf(answer: unknown, verb: string, key: string): number {
  const value = field(answer, key);
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`The ledger file answered ${verb} without a ${key} count.`);
  }
  return value;
}

/**
 * A string a write verb echoed back.
 *
 * @throws when the key is absent or is not a string, for `countOf`'s reason:
 * the merge echoes the ids it was given precisely because the source no longer
 * exists to be looked up, so a blank there is a lost record rather than a
 * harmless default.
 */
export function textOf(answer: unknown, verb: string, key: string): string {
  const value = field(answer, key);
  if (typeof value !== 'string') {
    throw new Error(`The ledger file answered ${verb} without a ${key}.`);
  }
  return value;
}

/** Text, or nothing. Empty strings are text: the schema distinguishes '' from NULL. */
export const text = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

/** Text, or a stated fallback — for the NOT NULL columns. */
export const textOr = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

/** A JSON boolean. The crate serialises SQLite's 0/1 as `true`/`false` already. */
export const flag = (value: unknown): boolean => value === true;

/** An integer column, or nothing. */
export const whole = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) ? value : undefined;

/**
 * A two-place decimal money string as the app's `number`.
 *
 * `undefined` for anything that is not one, rather than 0: zero is a real
 * amount (an account swept to zero every night closes on exactly that), so
 * "no figure" and "nothing" must not share a value. Callers that need a
 * default state it themselves.
 */
export const money = (value: unknown): number | undefined => {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** Money with a stated floor — for the NOT NULL columns (a balance, a target). */
export const moneyOr = (value: unknown, fallback: number): number => money(value) ?? fallback;

/**
 * A timestamp column as a `Date` (seam rule 3: a Date crosses as a Date).
 *
 * The crate hands timestamps over in the exact shape `schema.sql` checks —
 * `2026-01-31T09:00:00.000Z` — so this is `new Date(iso)` with the one guard
 * that matters: an unparseable value becomes `undefined` rather than an Invalid
 * Date, which would flow into `.getTime()` as NaN and make every comparison
 * false in both directions.
 */
export const instant = (value: unknown): Date | undefined => {
  if (typeof value !== 'string' || value === '') return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

/**
 * A calendar DAY column ('YYYY-MM-DD') as a `Date`, read at noon UTC.
 *
 * Noon rather than midnight, and the reason is the one `Account.bankBalanceDate`
 * states at length: a day has no time and no zone, so any instant chosen for it
 * belongs to some zone, and midnight UTC is the choice that puts a row dated the
 * 31st on the 30th for everybody west of Greenwich. Noon is the only hour that
 * names the same calendar day in every zone the app is used in, so a date the
 * register prints is the date the file holds.
 *
 * Where the app deliberately keeps the DAY ITSELF (`bankBalanceDate` is a
 * string), the mapper keeps the string and never comes here.
 */
export const day = (value: unknown): Date | undefined => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

/** A list of strings — `tags`, `subject_ids` — with anything else dropped. */
export const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

/**
 * One of a closed set of app values, or a stated fallback.
 *
 * A `Record<Union, true>` rather than a cast, so that widening the union in
 * `src/types` fails to compile until this file has been told what the new
 * member is — the discipline `accountMapping.ts` uses for `AccountType`, for
 * the same reason: a cast would let a value the app has no branch for through,
 * and it would arrive as a blank cell rather than as an error.
 */
export const oneOf = <T extends string>(
  value: unknown,
  allowed: Record<T, true>,
  fallback: T
): T => {
  const isAllowed = (candidate: string): candidate is T =>
    Object.prototype.hasOwnProperty.call(allowed, candidate);
  return typeof value === 'string' && isAllowed(value) ? value : fallback;
};
