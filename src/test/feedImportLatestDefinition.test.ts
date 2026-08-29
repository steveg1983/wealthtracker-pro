/**
 * The bank feed's import function, read as THE LATEST DEFINITION OF IT — not as
 * a file somebody remembered.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * On 28 August 2026, 20260828180000_a_fed_row_can_arrive_categorised.sql added
 * `category` and `tags` to `import_bank_transactions_atomic` by patching the
 * function's text rather than retyping it — the house rule, correctly followed.
 * But it patched the JUNE original (20260613090000) instead of the definition
 * that was actually live, and so silently reverted three later migrations'
 * work: `needs_review = true` (20260810090000), the payee-memory
 * auto-categorisation and its `category_confirmed` provenance (20260708100000 /
 * 20260722140000 / 20260808100000), and the explicit `is_cleared = false`
 * (20260707120000).
 *
 * The owner found it the next morning, by hand: a feed delivered ten
 * transactions, every one uncategorised, and the account's "To Review" column
 * read 0 — so the Accounts page offered him "Reconcile 2 accounts" instead of
 * the rows that had just landed.
 *
 * NOTHING IN THE GATE NOTICED. src/test/reviewFlowMigration.test.ts pins
 * 20260810090000 and passed throughout, because it asks what ONE FILE says. The
 * question nobody was asking is the one that matters:
 *
 *   > Of every migration that redefines this function, what does the NEWEST one
 *   > say?
 *
 * That is the whole mechanism here. It resolves the latest definition the same
 * way Postgres does — last writer wins — and asserts the properties that must
 * survive every future patch. A migration that reverts any of them goes red at
 * PR time and names the file it came from.
 *
 * ── THE RULE THIS ENCODES ───────────────────────────────────────────────────
 * "Never retype a financial function" needs a second clause, and this is it:
 * PATCH THE LATEST DEFINITION, found by searching ALL migrations for a
 * CREATE OR REPLACE of that function — never the file you happen to know about.
 *
 * It is a shape check and it says so. It cannot prove the SQL runs. It can
 * prove that the newest definition has not quietly lost something an older one
 * had.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../supabase/migrations');
const FUNCTION_NAME = 'import_bank_transactions_atomic';
const MARKER = `CREATE OR REPLACE FUNCTION public.${FUNCTION_NAME}(`;

interface Definition {
  /** The migration the winning definition came from. Named in failures. */
  file: string;
  /** The CREATE OR REPLACE … $$; block, verbatim. */
  body: string;
}

/**
 * The definition Postgres would end up with, resolved the way Postgres resolves
 * it: apply every migration in filename order and keep the last writer.
 *
 * Filename order IS timestamp order — every migration in this repo is named
 * `YYYYMMDDHHMMSS_…`, and `supabase db push` applies them sorted.
 */
function latestDefinition(): Definition {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const definers = files.filter((name) =>
    readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8').includes(MARKER)
  );

  // A repo with no definition of this function at all is a different and much
  // louder problem than a regressed one; say which it is.
  expect(
    definers.length,
    `no migration in ${MIGRATIONS_DIR} contains "${MARKER}"`
  ).toBeGreaterThan(0);

  const file = definers[definers.length - 1];
  const source = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

  // `lastIndexOf`, because a single migration may restate a function more than
  // once; within one file the last one is likewise the one that survives.
  const start = source.lastIndexOf(MARKER);
  const end = source.indexOf('$$;', start);
  expect(end, `unterminated function body in ${file}`).toBeGreaterThan(start);

  return { file, body: source.slice(start, end + 3) };
}

describe(`the latest definition of ${FUNCTION_NAME}`, () => {
  it('is found in exactly one winning migration', () => {
    const { file, body } = latestDefinition();
    expect(file).toMatch(/^\d{14}_.*\.sql$/);
    expect(body).toContain(MARKER);
  });

  /*
   * Each case below is a property some migration paid for. The comment says
   * WHICH one, so a future reader who wants to remove a check has to argue with
   * the migration that added it rather than with this file.
   */

  it('marks every fed row as new work (20260810090000)', () => {
    // The owner's "To Review shows 0". needs_review is NOT NULL DEFAULT false,
    // so a definition that omits it makes every fed row born already-reviewed.
    const { file, body } = latestDefinition();
    expect(body, `${file} does not write needs_review on insert`).toMatch(
      /true\s+-- needs_review/
    );
  });

  it('still inherits a category from payee memory (20260722140000)', () => {
    // The owner's "all uncategorised". Without this the app forgets every
    // payee it has ever filed.
    const { file, body } = latestDefinition();
    expect(body, `${file} lost the payee-memory lookup`).toContain(
      'payee_memory_category('
    );
  });

  it('still distinguishes a stated category from a guessed one (20260808100000)', () => {
    // category_confirmed = false marks a guess, so the Categorisation page can
    // ask about it. A definition without this calls every guess confirmed.
    const { file, body } = latestDefinition();
    expect(body, `${file} lost category provenance`).toContain('v_category_confirmed');
  });

  it('still lets a rule\'s category through, and its tags (20260828180000)', () => {
    // The reason 20260828180000 was written at all. `category` arrives via the
    // same v_category read that payee memory falls back from.
    const { file, body } = latestDefinition();
    expect(body, `${file} lost the row's category`).toContain("r->>'category'");
    expect(body, `${file} lost the row's tags`).toContain(
      "jsonb_array_elements_text(r->'tags')"
    );
  });

  it('still arrives unreconciled — the user reconciles, the feed does not (20260707120000)', () => {
    const { file, body } = latestDefinition();
    expect(body, `${file} no longer states is_cleared`).toContain('false,  -- is_cleared');
  });

  it('still audits every row and every balance move (20260613090000)', () => {
    // Two calls: one per inserted transaction, one per account balance change.
    // A financial write with no audit trail is the compliance blocker itself.
    const { file, body } = latestDefinition();
    const audits = body.match(/write_financial_audit/g) ?? [];
    expect(audits.length, `${file} has ${audits.length} audit call(s), expected 2`).toBe(2);
  });

  it('still locks the account row and checks it is owned (20260613090000)', () => {
    // service_role bypasses RLS, so this ownership check IS the security
    // boundary for a caller that passes the wrong p_user_id.
    const { file, body } = latestDefinition();
    expect(body, `${file} lost its FOR UPDATE lock`).toContain('FOR UPDATE');
    expect(body, `${file} lost its ownership check`).toContain(
      'account_not_found_or_not_owned'
    );
  });

  it('still keeps backfill and incremental balance moves apart (20260613090000)', () => {
    // THE most expensive line in the file to get wrong. A first sync's history
    // is already embodied in the provider's snapshot balance, so it shifts
    // initial_balance; new money adjusts balance. Inverting or dropping either
    // corrupts every balance in the account.
    const { file, body } = latestDefinition();
    expect(body, `${file} lost the backfill branch`).toContain(
      'initial_balance = COALESCE(initial_balance, 0) - v_sum'
    );
    expect(body, `${file} lost the incremental branch`).toContain(
      'balance = balance + v_sum'
    );
  });

  it('still honours a caller backfill stamp, and refuses a contradictory one (20260829170000)', () => {
    // The chunked-backfill drift: the handler splits a sync into 200-row calls,
    // and a per-call decision rebases chunk 1 then drifts the balance by every
    // later chunk's sum. The caller is the only party that saw the whole sync,
    // so its stamp outranks the table — and a stamp disagreeing with the arm
    // already chosen is the bug itself, refused rather than landed.
    const { file, body } = latestDefinition();
    expect(body, `${file} no longer reads the caller's backfill stamp`).toContain(
      "r ? 'backfill'"
    );
    expect(body, `${file} no longer refuses a contradictory stamp`).toContain(
      'backfill_stamp_conflict'
    );
    expect(body, `${file} no longer refuses a non-boolean stamp`).toContain(
      'backfill_stamp_not_boolean'
    );
  });

  it('still refuses rows belonging to another user, and keeps its search_path pinned', () => {
    const { file, body } = latestDefinition();
    expect(body, `${file} lost the per-row user check`).toContain(
      'row user_id does not match p_user_id'
    );
    expect(body, `${file} changed its security posture`).toContain('SECURITY INVOKER');
    expect(body, `${file} unpinned search_path`).toContain('SET search_path = public');
  });
});
