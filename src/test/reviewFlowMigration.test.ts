/**
 * The review flow's migration, read as a file — because it is UNAPPLIED and
 * will stay unapplied until the owner runs it himself.
 *
 * ── WHY A TEST READS SQL ────────────────────────────────────────────────────
 * Nothing else in this repo can catch a mistake in it. There is no test
 * database in the gate, the SQL is not typechecked, and the owner applies
 * migrations by hand — so the first thing that would notice a missing guard is
 * the guard failing to fire against his live ledger. What CAN be checked
 * mechanically is the shape the house requires of every migration, and that is
 * what this does: the db:migrate-only banner, a fingerprint that refuses BY
 * NAME rather than proceeding, verification SELECTs to read afterwards, and the
 * two decisions that would be invisible-but-wrong if they were ever quietly
 * changed (the backfill direction, and the refusal to derive a review from an
 * ordinary update).
 *
 * It is a shape check and it says so. It cannot prove the SQL runs. It can
 * prove that nobody removed the parts that stop it running somewhere it should
 * not.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const MIGRATION = path.resolve(
  __dirname,
  '../../supabase/migrations/20260810090000_imported_rows_arrive_new.sql'
);

const sql = (): string => readFileSync(MIGRATION, 'utf8');

describe('20260810090000_imported_rows_arrive_new.sql', () => {
  it('exists where db:migrate will find it', () => {
    expect(existsSync(MIGRATION)).toBe(true);
  });

  it('says how it must be applied — never the SQL editor', () => {
    // Rule 1 of supabase/migrations/README.md. A migration applied by paste
    // does not get recorded, and the next `db:migrate` then tries to apply it
    // again on top of itself.
    expect(sql()).toContain('npm run db:migrate');
  });

  it('adds the column with a constant default, so no row is rewritten', () => {
    // The whole reason this is a boolean and not a reviewed_at timestamp: a
    // constant default is metadata-only, so fifty-one thousand rows of history
    // get the right answer for free and the audit trigger never fires.
    expect(sql()).toMatch(
      /ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false/
    );
  });

  it('backfills history as REVIEWED, not as new', () => {
    // The one line that decides whether the feature is usable at all on the
    // day it lands. `DEFAULT true` here would print every transaction the owner
    // has ever had in bold and put 51,000 in the counter.
    expect(sql()).not.toMatch(/needs_review boolean NOT NULL DEFAULT true/);
    // And no UPDATE that sets it on existing rows behind the column's back.
    expect(sql()).not.toMatch(/UPDATE public\.transactions\s+SET needs_review = true/);
  });

  it('refuses BY NAME rather than proceeding, for every function it restates', () => {
    const body = sql();
    // A guarded restatement, not a hopeful one. Each of these is the sentence
    // the owner would see if the live function were not what this body was
    // derived from — naming the function and telling him what to do.
    for (const guard of [
      'file_importer_not_idempotent',
      'file_importer_missing_category_confirmed',
      'feed_payee_memory_absent',
      'feed_cleared_state_unexpected',
      'updater_provenance_unexpected',
      'confirmer_takes_a_category'
    ]) {
      expect(body).toContain(guard);
    }
  });

  it('refuses to run twice, function by function', () => {
    const body = sql();
    for (const guard of [
      'file_importer_review_already_present',
      'feed_review_already_present',
      'updater_review_already_present',
      'confirmer_review_already_present'
    ]) {
      expect(body).toContain(guard);
    }
  });

  it('marks both importers\' rows as new work', () => {
    const body = sql();
    expect(body).toContain('true,  -- needs_review');   // the file importer
    expect(body).toContain('true    -- needs_review');  // the bank feed
  });

  it('honours the flag on an update only when the caller states it', () => {
    const body = sql();
    expect(body).toContain("WHEN p ? 'needs_review'");
    // NO derived arm. `p ? 'category'` has one, deliberately, because changing
    // a category is evidence about that category; "something wrote to this row"
    // is not evidence that a human read it, and the bulk categorise sweep, the
    // payee rename and the transfer-link repair all come through this function.
    expect(body).not.toMatch(/needs_review[\s\S]{0,200}IS DISTINCT FROM/);
  });

  it('clears the flag when a suggested category is confirmed', () => {
    expect(sql()).toContain('needs_review = false');
  });

  it('leaves create_transaction_atomic alone — a typed row is born reviewed', () => {
    // Touching it would be the tell that somebody had started marking hand
    // entry as new work, which is a chore invented out of nothing.
    expect(sql()).not.toContain('CREATE OR REPLACE FUNCTION public.create_transaction_atomic');
  });

  it('ships the verification SELECTs there is no other way to run', () => {
    const body = sql();
    expect(body).toContain('Verification');
    // The one that proves the migration did not move money. It cannot have —
    // no statement in it touches an amount — and this is what shows it rather
    // than asserting it.
    expect(body).toContain('initial_balance + COALESCE(t.total, 0)');
  });
});
