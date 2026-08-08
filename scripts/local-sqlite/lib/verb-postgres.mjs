// Postgres side of the VERB harness: the real cloud RPC, called with the same
// payload the Rust bridge receives.
//
// The payload is not translated. `create_transaction_atomic(p jsonb)` and
// `wealth-core-cli`'s `create_transaction` take the same key names, because the
// Rust command struct was written from the RPC's column list. That is the whole
// bridge: one JSON object, two engines. If a spec ever needed to send different
// payloads, the two things would not be implementations of one verb.
//
// Everything else follows lib/postgres.mjs: the same cluster from
// scripts/local-db/up.sh, the same WT_PGDATA / WT_PGPORT / LC_ALL=C conventions,
// psql driven directly because the shell harness's grep-the-output shape cannot
// report accepted-vs-refused per statement.
//
// NOTHING under scripts/local-db is modified.

import { spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const SETUP_OK = '__SETUP_OK__';
const ROW = '__ROW__';
const ERR = '__ERR__';
const STATE = '__STATE__';

// The canonical projection of a stored transaction. Money as a decimal string
// (numeric(20,2)::text is exact and involves no rounding function), date as
// text, tags as a JSON array. The Rust side produces the same key set from its
// own storage, and the runner compares the two objects field by field.
const ROW_JSON = `jsonb_build_object(
  'id', t.id,
  'user_id', t.user_id,
  'account_id', t.account_id,
  'description', t.description,
  'amount', t.amount::text,
  'type', t.type,
  'date', t.date::text,
  'category', t.category,
  'category_id', t.category_id,
  'notes', t.notes,
  'merchant_name', t.merchant_name,
  'location_city', t.location_city,
  'location_country', t.location_country,
  'payment_channel', t.payment_channel,
  'is_recurring', t.is_recurring,
  'is_cleared', t.is_cleared,
  'is_split', t.is_split,
  'archived', t.archived,
  'statement_sequence', t.statement_sequence,
  'category_confirmed', t.category_confirmed,
  'transfer_account_id', t.transfer_account_id,
  'linked_transfer_id', t.linked_transfer_id,
  'linked_transfer_split_id', t.linked_transfer_split_id,
  'import_source', t.import_source,
  'import_source_id', t.import_source_id,
  'external_transaction_id', t.external_transaction_id,
  'metadata', t.metadata,
  'tags', COALESCE(to_jsonb(t.tags), '[]'::jsonb)
)`;

/**
 * The RPC each verb maps onto, and how its result is projected.
 *
 * create takes ONE jsonb argument, so its payload is passed straight through.
 * update and delete take theirs POSITIONALLY — `(p_id, p, p_user_id)` and
 * `(p_id, p_user_id)` — and there is exactly one honest way to keep the "one
 * payload, both engines" rule while calling them: unpack the same object here.
 * The Rust command structs have the same three (and two) fields for the same
 * reason, so neither engine is handed a shape the other never saw.
 *
 * `COALESCE(… ->'patch', '{}')` because an absent patch is an empty patch on
 * both sides; `NULLIF(… ->>'user_id','')` because an absent owner is SQL NULL,
 * which is what makes `p_user_id IS NULL OR user_id = p_user_id` stand down.
 *
 * THE SPLIT WRITER IS PROJECTED, NOT RETURNED
 * -------------------------------------------
 * `set_transaction_splits_with_legs` returns `{is_split, split_count, amount,
 * counterparts}` and no transaction row, so there is nothing for the runner's
 * field-by-field row comparison to bite on. It is therefore PERFORMed and the
 * split PARENT is projected afterwards, through the same `ROW_JSON` every other
 * verb uses. That is not a translation of the result — the parent is a row both
 * engines store, read from storage on both sides after the call — and everything
 * the RPC's own return value carries (the line set, the counterparts, the
 * balances they moved) is asserted through `state` SELECTs written per engine,
 * which is where cross-engine comparisons of *rows* belong.
 *
 * `p_splits` is passed with `->` and NOT coalesced: an absent key must arrive as
 * SQL NULL so that the RPC's first refusal — "p_splits must be a jsonb array" —
 * is reachable from a payload rather than smoothed over by the driver.
 *
 * THE TRANSFER FAMILY IS PROJECTED TOO, AND WHICH ROW IS PART OF THE CONTRACT
 * --------------------------------------------------------------------------
 * All five return jsonb objects (or, for clear_transfer_links, a bare integer),
 * so like the split writer they are PERFORMed and one row is projected
 * afterwards through the same ROW_JSON. The row picked is the one the Rust side
 * returns under its own `transaction` key, so the two engines are compared on
 * the same row rather than on whichever each found convenient:
 *
 *   link_transfer_pair            id_a            (the RPC's `a`)
 *   create_transfer_counterpart   id              (the RPC's `source`)
 *   clear_transfer_links          ids[0]          (the first row NAMED)
 *   repair_claimed_transfer       stranded_id     (the RPC's `stranded`)
 *   link_split_line_transfer      transaction_id  (the RPC's `transaction`)
 *
 * Everything the projection cannot carry — the other side, the minted
 * counterpart, the line set, the balances, the unlink count — is asserted
 * through `state` SELECTs written per engine, which is where cross-engine
 * comparisons of rows belong.
 *
 * `p_ids` is rebuilt as a real uuid[] rather than passed as jsonb: the RPC's
 * signature takes an array and the whole point of its first two guarantees
 * (all-or-nothing, DISTINCT) is array-shaped. A NULL `ids` and an absent one
 * both arrive as the empty array, which the RPC treats identically to NULL
 * (`array_length(…, 1) IS NULL` is true for `{}`), so the distinction the RPC's
 * first line draws is unobservable from here and nothing is lost.
 */
const VERBS = {
  create_transaction: (payloadLiteral) =>
    `SELECT ${ROW_JSON} INTO v_row
       FROM public.create_transaction_atomic(${payloadLiteral}::jsonb) t;`,

  update_transaction: (payloadLiteral) =>
    `SELECT ${ROW_JSON} INTO v_row
       FROM public.update_transaction_atomic(
              (${payloadLiteral}::jsonb->>'id')::uuid,
              COALESCE(${payloadLiteral}::jsonb->'patch', '{}'::jsonb),
              NULLIF(${payloadLiteral}::jsonb->>'user_id', '')::uuid
            ) t;`,

  delete_transaction: (payloadLiteral) =>
    `SELECT ${ROW_JSON} INTO v_row
       FROM public.delete_transaction_atomic(
              (${payloadLiteral}::jsonb->>'id')::uuid,
              NULLIF(${payloadLiteral}::jsonb->>'user_id', '')::uuid
            ) t;`,

  set_transaction_splits_with_legs: (payloadLiteral) =>
    `PERFORM public.set_transaction_splits_with_legs(
               (${payloadLiteral}::jsonb->>'id')::uuid,
               ${payloadLiteral}::jsonb->'splits',
               NULLIF(${payloadLiteral}::jsonb->>'expected_amount', '')::numeric,
               NULLIF(${payloadLiteral}::jsonb->>'user_id', '')::uuid
             );
     SELECT ${ROW_JSON} INTO v_row
       FROM public.transactions t
      WHERE t.id = (${payloadLiteral}::jsonb->>'id')::uuid;`,

  link_transfer_pair: (payloadLiteral) =>
    `PERFORM public.link_transfer_pair(
               (${payloadLiteral}::jsonb->>'id_a')::uuid,
               (${payloadLiteral}::jsonb->>'id_b')::uuid,
               NULLIF(${payloadLiteral}::jsonb->>'user_id', '')::uuid
             );
     SELECT ${ROW_JSON} INTO v_row
       FROM public.transactions t
      WHERE t.id = (${payloadLiteral}::jsonb->>'id_a')::uuid;`,

  create_transfer_counterpart: (payloadLiteral) =>
    `PERFORM public.create_transfer_counterpart(
               (${payloadLiteral}::jsonb->>'id')::uuid,
               (${payloadLiteral}::jsonb->>'target_account_id')::uuid,
               NULLIF(${payloadLiteral}::jsonb->>'user_id', '')::uuid
             );
     SELECT ${ROW_JSON} INTO v_row
       FROM public.transactions t
      WHERE t.id = (${payloadLiteral}::jsonb->>'id')::uuid;`,

  clear_transfer_links: (payloadLiteral) =>
    `PERFORM public.clear_transfer_links(
               ARRAY(SELECT x::uuid
                       FROM jsonb_array_elements_text(
                              COALESCE(${payloadLiteral}::jsonb->'ids', '[]'::jsonb)) AS x),
               NULLIF(${payloadLiteral}::jsonb->>'user_id', '')::uuid
             );
     SELECT ${ROW_JSON} INTO v_row
       FROM public.transactions t
      WHERE t.id = (${payloadLiteral}::jsonb->'ids'->>0)::uuid;`,

  repair_claimed_transfer: (payloadLiteral) =>
    `PERFORM public.repair_claimed_transfer(
               (${payloadLiteral}::jsonb->>'stranded_id')::uuid,
               (${payloadLiteral}::jsonb->>'counterpart_id')::uuid,
               (${payloadLiteral}::jsonb->>'partner_id')::uuid,
               ${payloadLiteral}::jsonb->>'adjustment_category_id',
               NULLIF(${payloadLiteral}::jsonb->>'user_id', '')::uuid
             );
     SELECT ${ROW_JSON} INTO v_row
       FROM public.transactions t
      WHERE t.id = (${payloadLiteral}::jsonb->>'stranded_id')::uuid;`,

  link_split_line_transfer: (payloadLiteral) =>
    `PERFORM public.link_split_line_transfer(
               (${payloadLiteral}::jsonb->>'split_id')::uuid,
               (${payloadLiteral}::jsonb->>'transaction_id')::uuid,
               NULLIF(${payloadLiteral}::jsonb->>'user_id', '')::uuid
             );
     SELECT ${ROW_JSON} INTO v_row
       FROM public.transactions t
      WHERE t.id = (${payloadLiteral}::jsonb->>'transaction_id')::uuid;`,

  // THE CATEGORY FAMILY, AND THE ROW EACH ONE IS COMPARED ON
  // -------------------------------------------------------
  // merge_categories has no transaction id in its payload, so there is nothing
  // to name the way clear_transfer_links names `ids[0]`. The row picked is the
  // one the Rust side returns under its own `transaction` key — the FIRST whole
  // transaction the merge moves, in id order — and it is captured HERE by the
  // same predicate the RPC's own first loop uses, BEFORE the call, because
  // afterwards those rows point at the target and are indistinguishable from
  // rows that always did.
  //
  // Repeating the loop's WHERE clause in the harness is exactly the sort of
  // thing that can silently agree with a wrong implementation, so it is worth
  // saying why it is safe: if the two sides pick different rows, `row.id`
  // differs and the runner reports a divergence. A mismatch is loud, not
  // absorbed. Everything the projection cannot carry — the five counts, the
  // split lines, the budgets, the recurring templates, the audit shape and the
  // fact the source category is gone — is asserted through `state` SELECTs.
  //
  // `p_source_id` is read with `->>` and cast WITHOUT NULLIF, deliberately: a
  // JSON null must arrive as SQL NULL so the RPC's first refusal
  // (merge_needs_two_categories) is reachable from a payload.
  merge_categories: (payloadLiteral) =>
    `SELECT t.id INTO v_first
       FROM public.transactions t
      WHERE t.user_id = (SELECT c.user_id FROM public.categories c
                          WHERE c.id = (${payloadLiteral}::jsonb->>'source_id')::uuid)
        AND (t.category = ${payloadLiteral}::jsonb->>'source_id'
          OR t.category_id = (${payloadLiteral}::jsonb->>'source_id')::uuid)
      ORDER BY t.id
      LIMIT 1;
     PERFORM public.merge_categories(
               (${payloadLiteral}::jsonb->>'source_id')::uuid,
               (${payloadLiteral}::jsonb->>'target_id')::uuid,
               NULLIF(${payloadLiteral}::jsonb->>'user_id', '')::uuid
             );
     SELECT ${ROW_JSON} INTO v_row
       FROM public.transactions t
      WHERE t.id = v_first;`,

  // The two provenance verbs take `p_ids uuid[]`, so they follow
  // clear_transfer_links exactly: the array is rebuilt as a real uuid[] and the
  // row projected is `ids[0]`, the first row the CALLER named. A NULL `ids` and
  // an absent one both arrive as the empty array, which `id = ANY('{}')` matches
  // nothing for — the same zero the RPC returns either way.
  //
  // `p_category` is passed with `->>` and NOT coalesced: this function stores
  // whatever it is given, SQL NULL included, and smoothing that over in the
  // driver would hide a measured behaviour.
  apply_category_to_uncategorized: (payloadLiteral) =>
    `PERFORM public.apply_category_to_uncategorized(
               ARRAY(SELECT x::uuid
                       FROM jsonb_array_elements_text(
                              COALESCE(${payloadLiteral}::jsonb->'ids', '[]'::jsonb)) AS x),
               ${payloadLiteral}::jsonb->>'category',
               NULLIF(${payloadLiteral}::jsonb->>'user_id', '')::uuid
             );
     SELECT ${ROW_JSON} INTO v_row
       FROM public.transactions t
      WHERE t.id = (${payloadLiteral}::jsonb->'ids'->>0)::uuid;`,

  // The prune returns a bare integer and touches no transaction, so — like the
  // restore family — it is compared on its OWN answer, wrapped in an object so
  // the shape matches the Rust side's `answer`. Everything the count cannot
  // carry (which categories survived, which references were left dangling by the
  // cascade, that nothing was audited) is asserted through `state` SELECTs.
  //
  // `p_ids` is rebuilt as a real uuid[] for the reason clear_transfer_links
  // gives: the signature takes an array. A NULL `ids` and an absent one both
  // arrive as the empty array, and MEASURED (`probe-prune1.sh` `p-null-array`,
  // `p-empty-array`) the RPC answers 0 to both and to NULL, so nothing is lost.
  delete_unused_categories: (payloadLiteral) =>
    `SELECT jsonb_build_object(
              'deleted',
              public.delete_unused_categories(
                ARRAY(SELECT x::uuid
                        FROM jsonb_array_elements_text(
                               COALESCE(${payloadLiteral}::jsonb->'ids', '[]'::jsonb)) AS x),
                NULLIF(${payloadLiteral}::jsonb->>'user_id', '')::uuid))
       INTO v_row;`,

  confirm_transaction_categories: (payloadLiteral) =>
    `PERFORM public.confirm_transaction_categories(
               ARRAY(SELECT x::uuid
                       FROM jsonb_array_elements_text(
                              COALESCE(${payloadLiteral}::jsonb->'ids', '[]'::jsonb)) AS x),
               NULLIF(${payloadLiteral}::jsonb->>'user_id', '')::uuid
             );
     SELECT ${ROW_JSON} INTO v_row
       FROM public.transactions t
      WHERE t.id = (${payloadLiteral}::jsonb->'ids'->>0)::uuid;`,

  // THE INGEST PAIR IS COMPARED ON ITS OWN ANSWER TOO
  // -------------------------------------------------
  // Both RPCs return jsonb — `{inserted, skipped, idempotent}` and
  // `{inserted, skipped}` — and neither returns a transaction, so like the
  // restore family they are compared on that object and everything it cannot
  // carry (the rows, the balances, the audit trail, which category a guess
  // picked) is asserted through `state` SELECTs.
  //
  // `->'rows'` is NOT coalesced in either, deliberately: an absent key must
  // arrive as SQL NULL so the first refusal — "p_rows must be a jsonb array" —
  // stays reachable from a payload rather than being smoothed over by the
  // driver. The split writer's `p_splits` is passed the same way for the same
  // reason.
  import_transactions: (payloadLiteral) =>
    `SELECT public.import_transactions_atomic(
              (${payloadLiteral}::jsonb->>'user_id')::uuid,
              (${payloadLiteral}::jsonb->>'account_id')::uuid,
              ${payloadLiteral}::jsonb->'rows')
       INTO v_row;`,

  import_bank_transactions: (payloadLiteral) =>
    `SELECT public.import_bank_transactions_atomic(
              (${payloadLiteral}::jsonb->>'user_id')::uuid,
              ${payloadLiteral}::jsonb->'rows')
       INTO v_row;`,

  // THE RESTORE FAMILY IS COMPARED ON ITS OWN ANSWER
  // ------------------------------------------------
  // None of these four returns a transaction, so there is no row for the
  // runner's field-by-field comparison to bite on and nothing to project out of
  // storage either — a wipe's whole subject is rows that no longer exist. What
  // IS comparable is the value each function returns, so that is what `v_row`
  // carries: `user_financial_data_is_empty`'s boolean and `restore_user_chunk`'s
  // bigint are wrapped in an object so the shape matches the Rust side's
  // `answer`, and the other two already return jsonb and are passed through
  // key for key.
  //
  // Everything a return value cannot carry — the rows that survived, the
  // balances, the audit trail, the dates that did or did not move — is asserted
  // through `state` SELECTs written per engine, which is where cross-engine
  // comparisons of rows belong.
  user_financial_data_is_empty: (payloadLiteral) =>
    `SELECT jsonb_build_object(
              'empty',
              public.user_financial_data_is_empty(
                NULLIF(${payloadLiteral}::jsonb->>'user_id', '')::uuid))
       INTO v_row;`,

  // `p_confirm` is read with `->>` and NOT coalesced: a missing key must arrive
  // as SQL NULL so the RPC's `IS DISTINCT FROM` refusal is reachable from a
  // payload rather than smoothed over by the driver.
  wipe_user_financial_data: (payloadLiteral) =>
    `SELECT public.wipe_user_financial_data(
              ${payloadLiteral}::jsonb->>'confirm',
              NULLIF(${payloadLiteral}::jsonb->>'user_id', '')::uuid)
       INTO v_row;`,

  // THE CHUNK LIST, UNPACKED
  // ------------------------
  // The local verb takes a LIST of chunks and applies them in one transaction,
  // because DESIGN.md §5 divergence 6 says a local restore has no request-size
  // cliff to chunk around and R-11 says the deferred keys let it be atomic. The
  // cloud RPC takes exactly one. So a spec that wants the two compared sends ONE
  // chunk and this unpacks it — the same honest unpacking the update and delete
  // verbs already do for their positional arguments.
  //
  // A spec sending more than one chunk is asserting the local atomicity, which
  // has no cloud counterpart; those live in the crate's own integration tests.
  //
  // `->'rows'` is NOT coalesced, so an absent key arrives as SQL NULL and the
  // measured hole in `rows_not_an_array` stays reachable from a payload.
  restore_user_chunk: (payloadLiteral) =>
    `SELECT jsonb_build_object(
              'inserted',
              public.restore_user_chunk(
                ${payloadLiteral}::jsonb->'chunks'->0->>'entity',
                ${payloadLiteral}::jsonb->'chunks'->0->'rows',
                NULLIF(${payloadLiteral}::jsonb->>'user_id', '')::uuid))
       INTO v_row;`,

  finalize_user_restore: (payloadLiteral) =>
    `SELECT public.finalize_user_restore(
              COALESCE(${payloadLiteral}::jsonb->'links', '{}'::jsonb),
              NULLIF(${payloadLiteral}::jsonb->>'user_id', '')::uuid)
       INTO v_row;`,

  // The snap returns the whole accounts row. Projected into the same eight
  // fields crate::row::account::AccountRow serialises, money as a decimal string
  // on both sides — numeric::text is exact and involves no rounding function.
  link_bank_account_snap: (payloadLiteral) =>
    `SELECT jsonb_build_object(
              'id', a.id,
              'user_id', a.user_id,
              'name', a.name,
              'type', a.type,
              'currency', a.currency,
              'balance', a.balance::text,
              'initial_balance', a.initial_balance::text,
              'is_active', a.is_active)
       INTO v_row
       FROM public.link_bank_account_snap(
              (${payloadLiteral}::jsonb->>'account_id')::uuid,
              (${payloadLiteral}::jsonb->>'user_id')::uuid,
              (${payloadLiteral}::jsonb->>'bank_balance')::numeric) a;`,
};

/**
 * Run the RPC inside a plpgsql block that CATCHES its exception.
 *
 * Without this, `ON_ERROR_STOP=1` aborts the script the moment the RPC refuses
 * and the state assertions never run — so a refusal could only ever be checked
 * on the SQLite side, and "the refusal rolled everything back" would be
 * asserted on one engine and assumed on the other. The block's implicit
 * savepoint undoes the RPC's partial effects exactly as a rolled-back request
 * would, so what the assertions then see is the same state a refused call leaves
 * behind in production.
 */
function guarded(call) {
  return `
CREATE TEMP TABLE _wt_verb_out(row_json jsonb, err text) ON COMMIT DROP;
DO $wtblock$
DECLARE v_row jsonb;
        -- merge_categories has to remember which row it is going to be compared
        -- on BEFORE it runs; see the VERBS entry. Declared for every verb
        -- because a per-verb DECLARE list would be a second place to keep in
        -- step with the first.
        v_first uuid;
BEGIN
  ${call}
  INSERT INTO _wt_verb_out VALUES (v_row, NULL);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO _wt_verb_out VALUES (NULL, SQLERRM);
END
$wtblock$;`;
}

function psqlEnv() {
  return {
    ...process.env,
    PATH: `/opt/homebrew/opt/postgresql@17/bin:${process.env.PATH ?? ''}`,
    LC_ALL: 'C',
  };
}

/** Dollar-quote the payload so no amount of JSON punctuation can escape it. */
function quote(json) {
  let tag = 'wtpayload';
  let suffix = 0;
  while (json.includes(`$${tag}$`)) {
    suffix += 1;
    tag = `wtpayload${suffix}`;
  }
  return `$${tag}$${json}$${tag}$`;
}

export class PostgresVerbEngine {
  #fixtureSql;
  #host;
  #port;
  #tmp;

  constructor({ fixturePath }) {
    this.#fixtureSql = readFileSync(fixturePath, 'utf8');
    this.#host = process.env.WT_PGDATA ?? '/tmp/wtpg';
    this.#port = process.env.WT_PGPORT ?? '55432';
    this.#tmp = path.join(tmpdir(), `wt-verb-pg-${process.pid}.sql`);
  }

  get name() { return 'postgres'; }

  /** @returns {{ ok: true, version: string, encoding: string } | { ok: false, why: string }} */
  probe() {
    const result = this.#psql(['-c', "SELECT version() || '|' || current_setting('server_encoding')"]);
    if (result.status !== 0) {
      return {
        ok: false,
        why: (result.stderr || result.error?.message || 'psql failed').trim().split('\n')[0],
      };
    }
    const line = result.stdout.trim().split('\n')[0] ?? '';
    const [version, encoding] = line.split('|');
    return { ok: true, version: (version ?? '').split(' on ')[0], encoding: encoding ?? 'unknown' };
  }

  #psql(extra) {
    return spawnSync(
      'psql',
      ['-X', '-q', '-A', '-t', '-h', this.#host, '-p', this.#port, '-U', 'postgres', '-d', 'postgres',
        '-v', 'ON_ERROR_STOP=1', ...extra],
      { env: psqlEnv(), encoding: 'utf8' },
    );
  }

  run(spec) {
    const build = VERBS[spec.command.verb];
    if (!build) throw new Error(`no Postgres RPC is mapped for verb "${spec.command.verb}"`);

    // The local restore takes a LIST of chunks and the cloud RPC takes one, so
    // the driver above unpacks chunks[0]. A spec sending more than one is
    // asserting the LOCAL atomicity, which has no cloud counterpart — and if the
    // driver quietly ran the first chunk anyway, that spec would compare two
    // different operations and report whichever answer it happened to get. Say
    // so instead. Those assertions belong in crates/wealth-core/tests.
    if (spec.command.verb === 'restore_user_chunk' && (spec.command.payload.chunks?.length ?? 0) > 1) {
      throw new Error(
        'a restore spec sending more than one chunk has no Postgres counterpart: the RPC takes ' +
        'one entity per call. Assert the one-transaction property in the crate\'s own tests.',
      );
    }

    const payload = quote(JSON.stringify(spec.command.payload));
    const lines = [
      // Everything inside one transaction that is always rolled back, exactly
      // as the constraint harness does. The RPC's own atomicity is a property of
      // the RPC; this outer transaction is only fixture isolation.
      'BEGIN;',
      this.#fixtureSql,
      spec.setup?.postgres ?? '',
      `\\echo ${SETUP_OK}`,
      guarded(build(payload)),
      `\\echo ${ROW}`,
      "SELECT COALESCE(row_json::text, '') FROM _wt_verb_out;",
      `\\echo ${ERR}`,
      "SELECT COALESCE(err, '') FROM _wt_verb_out;",
    ];
    for (const entry of spec.state ?? []) {
      lines.push(`\\echo ${STATE}${entry.name}`);
      lines.push(entry.postgres.trim().endsWith(';') ? entry.postgres : `${entry.postgres};`);
    }
    lines.push('ROLLBACK;');

    writeFileSync(this.#tmp, `${lines.join('\n')}\n`, 'utf8');
    let result;
    try {
      result = this.#psql(['-f', this.#tmp]);
    } finally {
      try { unlinkSync(this.#tmp); } catch { /* already gone */ }
    }

    const stdout = result.stdout ?? '';
    const stderr = (result.stderr ?? '').trim();

    if (!stdout.includes(SETUP_OK)) {
      throw new Error(`setup failed: ${stderr.split('\n').slice(0, 3).join(' / ') || 'no output'}`);
    }
    if (!stdout.includes(ROW)) {
      // The guard block itself did not run. That is a harness fault, never a
      // refusal — a refusal arrives in the `err` column, not on stderr.
      throw new Error(`the guarded call did not run: ${stderr.split('\n')[0] || 'no output'}`);
    }

    const value = (marker) => {
      const at = stdout.indexOf(marker);
      if (at < 0) return '';
      return (stdout.slice(at + marker.length).split('\n')[1] ?? '').trim();
    };
    const rowText = value(ROW);
    const errText = value(ERR);

    const state = new Map();
    const afterErr = stdout.slice(stdout.indexOf(ERR) + ERR.length).split('\n');
    for (let i = 0; i < afterErr.length; i += 1) {
      const line = afterErr[i].trim();
      if (!line.startsWith(STATE)) continue;
      const name = line.slice(STATE.length);
      const next = (afterErr[i + 1] ?? '').trim();
      state.set(name, next === '' ? 'NULL' : next);
    }

    if (errText !== '') {
      return { outcome: 'refused', code: refusalCode(errText), message: errText, row: null, state };
    }
    // An accepted call with NO row to project is a real outcome, not a fault:
    // `clear_transfer_links([])` returns 0 and there is nothing to compare. The
    // SQLite side reports the same absence as `transaction: null`, so the two
    // still agree — about there being no row.
    return { outcome: 'ok', code: '', message: '', row: rowText === '' ? null : JSON.parse(rowText), state };
  }
}

/**
 * The name of the rule that refused. `RAISE EXCEPTION 'x'` gives SQLERRM `x`;
 * a constraint gives `... violates ... constraint "name"`.
 */
function refusalCode(message) {
  const named = message.match(/constraint "([^"]+)"/);
  if (named) return named[1];
  return message.split('\n')[0].trim();
}
