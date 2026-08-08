//! Integration tests for the transfer family, against the real vendored schema.
//!
//! The differential proof lives in `scripts/local-sqlite/verbs.mjs`: fifty-six
//! specs, every one of them running the same payload against the live Postgres
//! RPC and these verbs. What is here is the half that has **no Postgres
//! counterpart to compare against**, and there are four kinds of it:
//!
//! 1. **The guard claims.** `verbs/mod.rs` says all five of these verbs need no
//!    `_rpc_guard`, and for `link_split_line_transfer` — the one that writes to
//!    `transaction_splits` — that is a claim about a SQLite trigger with no cloud
//!    twin. It is proven behaviourally: the trigger is shown to be ARMED, and the
//!    verb is shown to refuse before reaching it.
//! 2. **The returned count.** `clear_transfer_links` returns an integer, and the
//!    differential harness compares rows rather than return values. The count is
//!    the thing the client acts on, so it is asserted here.
//! 3. **T-14, written once each.** The repair's audit entries are counted per
//!    entity, which is the property that makes each entry the whole story.
//! 4. **The audit chain.** Whether the hashes actually chain across a
//!    multi-row write is a local invariant; there is no cloud hash to compare to.
//!
//! All data is invented. This repo is public: no real payee, account number or
//! figure appears anywhere in it.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use rusqlite::Connection;
use wealth_core::db;
use wealth_core::error::CoreError;
use wealth_core::verbs::{
    clear_transfer_links, create_transfer_counterpart, link_split_line_transfer,
    link_transfer_pair, repair_claimed_transfer, ClearTransferLinks, CreateTransferCounterpart,
    LinkSplitLineTransfer, LinkTransferPair, RepairClaimedTransfer,
};

const OWNER: &str = "11111111-1111-1111-1111-111111111111";
const EVERYDAY: &str = "a0000000-0000-0000-0000-000000000001";
const RAINY_DAY: &str = "a0000000-0000-0000-0000-000000000002";
const HOLIDAY: &str = "a0000000-0000-0000-0000-000000000003";
const OUTGOINGS: &str = "c0000000-0000-0000-0000-000000000002";
const WEEKLY_SHOP: &str = "c0000000-0000-0000-0000-000000000003";
const ADJUSTMENT: &str = "c0000000-0000-0000-0000-0000000000a1";
const PARENT: &str = "70000000-0000-0000-0000-000000000001";
const PAIR_OUT: &str = "70000000-0000-0000-0000-00000000000a";
const PAIR_IN: &str = "70000000-0000-0000-0000-00000000000b";
const MATCHING: &str = "70000000-0000-0000-0000-00000000000c";
const LEG_LINE: &str = "50000000-0000-0000-0000-000000000001";
const PLAIN_LINE: &str = "50000000-0000-0000-0000-000000000002";

/// The base fixture: one owner, four accounts (three of which mint their own
/// To/From category through C-3's trigger), a category tree, and the −25.00
/// Corner shop row Everyday's balance matches.
fn fixture() -> Connection {
    let connection = db::open_in_memory().expect("open");
    wealth_core::apply_schema(&connection).expect("schema");
    connection
        .execute_batch(&format!(
            "INSERT INTO users (id, email) VALUES ('{OWNER}', 'harness@example.test');
             INSERT INTO categories (id, user_id, name, type, level) VALUES
               ('c0000000-0000-0000-0000-000000000001', '{OWNER}', 'Transfer', 'both', 'type'),
               ('{OUTGOINGS}', '{OWNER}', 'Outgoings', 'expense', 'type');
             INSERT INTO categories (id, user_id, name, type, level, parent_id) VALUES
               ('{WEEKLY_SHOP}', '{OWNER}', 'Weekly shop', 'expense', 'sub', '{OUTGOINGS}'),
               ('{ADJUSTMENT}', '{OWNER}', 'Account Adjustment', 'both', 'sub',
                'c0000000-0000-0000-0000-000000000001');
             INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor) VALUES
               ('{EVERYDAY}', '{OWNER}', 'Everyday', 'checking', -2500, 0),
               ('{RAINY_DAY}', '{OWNER}', 'Rainy day', 'savings', 0, 0),
               ('{HOLIDAY}', '{OWNER}', 'Holiday fund', 'savings', 0, 0);
             INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date, category)
               VALUES ('{PARENT}', '{OWNER}', '{EVERYDAY}', 'Corner shop', -2500, 'expense', '2024-03-01',
                       '{WEEKLY_SHOP}');"
        ))
        .expect("fixture");
    connection
}

/// Two unlinked rows with exactly opposite amounts, in two accounts.
fn with_pairable_rows(connection: &Connection) {
    connection
        .execute_batch(&format!(
            "INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date) VALUES
               ('{PAIR_OUT}', '{OWNER}', '{EVERYDAY}',  'Moved out', -3000, 'expense', '2024-04-02'),
               ('{PAIR_IN}',  '{OWNER}', '{RAINY_DAY}', 'Moved in',   3000, 'income',  '2024-04-02');
             UPDATE accounts SET balance_minor = balance_minor - 3000 WHERE id = '{EVERYDAY}';
             UPDATE accounts SET balance_minor = balance_minor + 3000 WHERE id = '{RAINY_DAY}';"
        ))
        .expect("pairable rows");
}

/// The Corner shop row as a split of −15.00 (an UNMATCHED leg, pointing at Rainy
/// day with no counterpart) and −10.00, plus the +15.00 row in Rainy day that is
/// really its other side.
fn with_an_unmatched_leg(connection: &Connection) {
    connection
        .execute_batch(&format!(
            "INSERT OR IGNORE INTO _rpc_guard VALUES ('split');
             UPDATE transactions SET is_split = 1, category = '' WHERE id = '{PARENT}';
             DELETE FROM _rpc_guard WHERE flag = 'split';
             INSERT INTO transaction_splits
               (id, transaction_id, user_id, category, amount_minor, sort_order, transfer_account_id) VALUES
               ('{LEG_LINE}', '{PARENT}', '{OWNER}', '{WEEKLY_SHOP}', -1500, 1, '{RAINY_DAY}');
             INSERT INTO transaction_splits
               (id, transaction_id, user_id, category, amount_minor, sort_order) VALUES
               ('{PLAIN_LINE}', '{PARENT}', '{OWNER}', '{WEEKLY_SHOP}', -1000, 2);
             INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date)
               VALUES ('{MATCHING}', '{OWNER}', '{RAINY_DAY}', 'From everyday', 1500, 'income', '2024-03-02');
             UPDATE accounts SET balance_minor = balance_minor + 1500 WHERE id = '{RAINY_DAY}';"
        ))
        .expect("unmatched leg");
}

/// A mutually linked pair (−15.00 Everyday ↔ +15.00 Rainy day) and the row that
/// really matches the +15.00 side, sitting stranded in Everyday.
fn with_a_claimed_transfer(connection: &Connection) {
    connection
        .execute_batch(&format!(
            "INSERT INTO transactions
               (id, user_id, account_id, description, amount_minor, type, date, transfer_account_id) VALUES
               ('{PAIR_OUT}', '{OWNER}', '{EVERYDAY}',  'To savings',   -1500, 'transfer', '2024-04-01', '{RAINY_DAY}'),
               ('{PAIR_IN}',  '{OWNER}', '{RAINY_DAY}', 'From everyday', 1500, 'transfer', '2024-04-01', '{EVERYDAY}');
             UPDATE transactions SET linked_transfer_id = '{PAIR_IN}'  WHERE id = '{PAIR_OUT}';
             UPDATE transactions SET linked_transfer_id = '{PAIR_OUT}' WHERE id = '{PAIR_IN}';
             UPDATE accounts SET balance_minor = balance_minor - 1500 WHERE id = '{EVERYDAY}';
             UPDATE accounts SET balance_minor = balance_minor + 1500 WHERE id = '{RAINY_DAY}';
             INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date)
               VALUES ('{MATCHING}', '{OWNER}', '{EVERYDAY}', 'Really the other side', -1500, 'expense', '2024-04-01');
             UPDATE accounts SET balance_minor = balance_minor - 1500 WHERE id = '{EVERYDAY}';"
        ))
        .expect("claimed transfer");
}

fn balance(connection: &Connection, account: &str) -> i64 {
    connection
        .query_row(
            "SELECT balance_minor FROM accounts WHERE id = ?1",
            [account],
            |row| row.get(0),
        )
        .expect("balance")
}

fn count(connection: &Connection, sql: &str) -> i64 {
    connection.query_row(sql, [], |row| row.get(0)).expect("count")
}

/// B-1 for one account: `balance = initial_balance + Σ(amounts)`.
fn identity_holds(connection: &Connection, account: &str) -> bool {
    let difference: i64 = connection
        .query_row(
            "SELECT a.balance_minor - (a.initial_balance_minor
                      + COALESCE((SELECT SUM(t.amount_minor) FROM transactions t
                                   WHERE t.account_id = a.id), 0))
               FROM accounts a WHERE a.id = ?1",
            [account],
            |row| row.get(0),
        )
        .expect("identity");
    difference == 0
}

/// The guard table must be empty before and after every verb — a stray flag
/// would disarm S-9 and S-10 for every later write on the same file.
fn guard_is_clear(connection: &Connection) -> bool {
    count(connection, "SELECT COUNT(*) FROM _rpc_guard") == 0
}

// ── 1. The guard claims ─────────────────────────────────────────────────────

#[test]
fn the_split_leg_trigger_is_armed_and_the_verb_refuses_before_reaching_it() {
    // THE CLAIM: `link_split_line_transfer` needs no `_rpc_guard('leg')`,
    // because `trg_protect_linked_leg` fires only `WHEN OLD.linked_transfer_id
    // IS NOT NULL` and the verb refuses `split_line_already_linked` before it
    // ever writes such a line.
    //
    // A test that only ran the happy path would prove nothing: it would pass
    // just as well if the trigger did not exist. So this proves all three parts.
    let mut connection = fixture();
    with_an_unmatched_leg(&connection);

    // (a) The verb works with no guard held, and holds none afterwards.
    assert!(guard_is_clear(&connection));
    let result = link_split_line_transfer(
        &mut connection,
        LinkSplitLineTransfer {
            split_id: LEG_LINE.into(),
            transaction_id: MATCHING.into(),
            user_id: Some(OWNER.into()),
        },
    )
    .expect("an unmatched leg pairs with the row that matches it");
    assert_eq!(result.split.linked_transfer_id.as_deref(), Some(MATCHING));
    assert!(guard_is_clear(&connection));

    // (b) The trigger IS armed: the same column, written by hand on the same
    // now-linked line, raises. This is the write the verb would have made had it
    // not refused first.
    let raised = connection
        .execute(
            "UPDATE transaction_splits SET linked_transfer_id = ?1 WHERE id = ?2",
            rusqlite::params![PARENT, LEG_LINE],
        )
        .expect_err("trg_protect_linked_leg must fire on a linked line");
    assert!(
        raised.to_string().contains("split_leg_locked"),
        "expected the leg trigger, got: {raised}"
    );

    // (c) So the verb's own refusal — not a guard, and not luck — is what keeps
    // the trigger out of the way. Ask it to pair the same line again and it says
    // so by name, rather than the file saying so with a constraint error.
    connection
        .execute_batch(&format!(
            "INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date)
               VALUES ('70000000-0000-0000-0000-00000000000d', '{OWNER}', '{HOLIDAY}', 'Another', 1500,
                       'income', '2024-03-03');
             UPDATE accounts SET balance_minor = balance_minor + 1500 WHERE id = '{HOLIDAY}';"
        ))
        .expect("a second candidate");
    let refusal = link_split_line_transfer(
        &mut connection,
        LinkSplitLineTransfer {
            split_id: LEG_LINE.into(),
            transaction_id: "70000000-0000-0000-0000-00000000000d".into(),
            user_id: Some(OWNER.into()),
        },
    )
    .expect_err("a linked line cannot be paired again");
    assert_eq!(refusal.code(), "split_line_already_linked");
    assert_ne!(
        refusal.code(),
        "constraint_violated",
        "the VERB must refuse this, not the file — a constraint error here would mean the \
         refusal order had stopped doing the work the missing guard depends on"
    );
}

#[test]
fn none_of_the_five_verbs_leaves_a_guard_flag_behind() {
    // A stray `_rpc_guard` row disarms S-9, S-10 and the split guards for every
    // later write on the same file, and nothing else would notice. Every verb in
    // this family is driven once and the table checked after each.
    let mut connection = fixture();
    with_pairable_rows(&connection);
    assert!(guard_is_clear(&connection));

    link_transfer_pair(
        &mut connection,
        LinkTransferPair {
            id_a: PAIR_OUT.into(),
            id_b: PAIR_IN.into(),
            user_id: Some(OWNER.into()),
        },
    )
    .expect("link");
    assert!(guard_is_clear(&connection), "after link_transfer_pair");

    clear_transfer_links(
        &mut connection,
        ClearTransferLinks {
            ids: Some(vec![PAIR_OUT.into(), PAIR_IN.into()]),
            user_id: Some(OWNER.into()),
        },
    )
    .expect("unlink");
    assert!(guard_is_clear(&connection), "after clear_transfer_links");

    create_transfer_counterpart(
        &mut connection,
        CreateTransferCounterpart {
            id: PARENT.into(),
            target_account_id: HOLIDAY.into(),
            user_id: Some(OWNER.into()),
        },
    )
    .expect("mint");
    assert!(guard_is_clear(&connection), "after create_transfer_counterpart");
}

// ── 2. The returned count, which the differential harness cannot compare ────

#[test]
fn the_unlink_count_is_the_number_of_rows_that_actually_changed() {
    // `clear_transfer_links` returns an integer and the client acts on it. The
    // three cases that make it mean something: a real change, a row that was
    // already unlinked, and a row whose link lives on a split line.
    let mut connection = fixture();
    with_a_claimed_transfer(&connection);

    // One side named: one change.
    let one = clear_transfer_links(
        &mut connection,
        ClearTransferLinks {
            ids: Some(vec![PAIR_OUT.into()]),
            user_id: Some(OWNER.into()),
        },
    )
    .expect("unlink one");
    assert_eq!(one.unlinked, 1);
    assert_eq!(one.transactions.len(), 1);
    // T-7 is now broken, on purpose: the other side still points at this one.
    // The verb does not chase reciprocals and this port does not either.
    assert_eq!(
        count(
            &connection,
            "SELECT COUNT(*) FROM transactions WHERE linked_transfer_id IS NOT NULL"
        ),
        1
    );

    // The same row again, plus one that was never linked: no changes at all, and
    // NOT an error — both are skipped rather than refused.
    let none = clear_transfer_links(
        &mut connection,
        ClearTransferLinks {
            ids: Some(vec![PAIR_OUT.into(), MATCHING.into()]),
            user_id: Some(OWNER.into()),
        },
    )
    .expect("skipping is not refusing");
    assert_eq!(none.unlinked, 0);
    assert!(none.transactions.is_empty());
    // And no audit noise for the writes that did not happen.
    assert_eq!(
        count(&connection, "SELECT COUNT(*) FROM financial_audit_log"),
        1
    );

    // Naming nothing returns zero and has no row to report.
    let empty = clear_transfer_links(
        &mut connection,
        ClearTransferLinks {
            ids: Some(Vec::new()),
            user_id: Some(OWNER.into()),
        },
    )
    .expect("an empty list is a no-op");
    assert_eq!(empty.unlinked, 0);
    assert!(empty.transaction.is_none());
}

#[test]
fn one_unknown_id_refuses_the_whole_call_and_unlinks_nothing() {
    let mut connection = fixture();
    with_a_claimed_transfer(&connection);

    let refusal = clear_transfer_links(
        &mut connection,
        ClearTransferLinks {
            ids: Some(vec![
                PAIR_OUT.into(),
                "70000000-0000-0000-0000-0000000000ff".into(),
            ]),
            user_id: Some(OWNER.into()),
        },
    )
    .expect_err("an id nobody has refuses the whole call");
    assert_eq!(refusal.code(), "transaction_not_found");
    assert!(matches!(refusal, CoreError::Refused(ref refused)
        if refused.hint().is_some_and(|hint| hint.contains("named for unlinking"))));

    // The row that WAS there is untouched: all or nothing.
    assert_eq!(
        count(
            &connection,
            "SELECT COUNT(*) FROM transactions WHERE linked_transfer_id IS NOT NULL"
        ),
        2
    );
    assert_eq!(
        count(&connection, "SELECT COUNT(*) FROM financial_audit_log"),
        0
    );
}

// ── 3. T-14: each row written once ──────────────────────────────────────────

#[test]
fn a_repair_writes_each_of_its_three_rows_exactly_once() {
    // The property that makes each audit entry the whole story: `before` is what
    // the user was looking at, `after` is the finished state, and there is no
    // third entry recording a half-repaired intermediate. It is the reason the
    // link step is spelled out in the RPC instead of calling link_transfer_pair.
    let mut connection = fixture();
    with_a_claimed_transfer(&connection);

    let before_everyday = balance(&connection, EVERYDAY);
    let before_rainy = balance(&connection, RAINY_DAY);

    let result = repair_claimed_transfer(
        &mut connection,
        RepairClaimedTransfer {
            stranded_id: MATCHING.into(),
            counterpart_id: PAIR_IN.into(),
            partner_id: PAIR_OUT.into(),
            adjustment_category_id: ADJUSTMENT.into(),
            user_id: Some(OWNER.into()),
        },
    )
    .expect("the repair");

    assert_eq!(result.transaction.linked_transfer_id.as_deref(), Some(PAIR_IN));
    assert_eq!(result.counterpart.linked_transfer_id.as_deref(), Some(MATCHING));
    assert_eq!(result.partner.linked_transfer_id, None);
    assert_eq!(result.partner.category.as_deref(), Some(ADJUSTMENT));
    assert_eq!(result.partner.kind, "expense");

    for row in [MATCHING, PAIR_IN, PAIR_OUT] {
        let entries: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM financial_audit_log
                  WHERE entity = 'transaction' AND entity_id = ?1",
                [row],
                |record| record.get(0),
            )
            .expect("entries");
        assert_eq!(entries, 1, "row {row} must be audited exactly once");
    }
    assert_eq!(
        count(&connection, "SELECT COUNT(*) FROM financial_audit_log"),
        3,
        "three rows touched, three entries, and none for any account"
    );

    // Balance-neutral by construction: no statement in the verb writes an
    // amount, a sign or an account_id, so nothing here can have moved.
    assert_eq!(balance(&connection, EVERYDAY), before_everyday);
    assert_eq!(balance(&connection, RAINY_DAY), before_rainy);
    assert!(identity_holds(&connection, EVERYDAY));
    assert!(identity_holds(&connection, RAINY_DAY));
}

#[test]
fn a_repair_refuses_a_pair_that_is_no_longer_mutual_in_either_direction() {
    // T-15, and the only place in the schema that tests T-7 at all. BOTH
    // directions are broken in turn, because a check written one way round
    // passes half the time and the half it passes is the half a stale tab hits.
    for (label, break_it) in [
        ("the counterpart no longer points back", PAIR_IN),
        ("the partner no longer points back", PAIR_OUT),
    ] {
        let mut connection = fixture();
        with_a_claimed_transfer(&connection);
        connection
            .execute(
                "UPDATE transactions SET linked_transfer_id = NULL WHERE id = ?1",
                [break_it],
            )
            .expect("break one direction");

        let refusal = repair_claimed_transfer(
            &mut connection,
            RepairClaimedTransfer {
                stranded_id: MATCHING.into(),
                counterpart_id: PAIR_IN.into(),
                partner_id: PAIR_OUT.into(),
                adjustment_category_id: ADJUSTMENT.into(),
                user_id: Some(OWNER.into()),
            },
        )
        .expect_err(label);
        assert_eq!(refusal.code(), "transfer_pair_not_linked", "{label}");
        assert_eq!(
            count(&connection, "SELECT COUNT(*) FROM financial_audit_log"),
            0,
            "{label}: nothing may be written"
        );
    }
}

// ── 4. The audit chain across a multi-row write ─────────────────────────────

#[test]
fn the_audit_chain_links_across_every_row_one_call_touches() {
    // Each entry's `prev_hash` must be the previous entry's `row_hash`, and each
    // `row_hash` must be the hash of its own fields. A multi-row verb is where a
    // chain breaks, because it is the only place several entries are written
    // between one pair of `BEGIN`/`COMMIT`.
    let mut connection = fixture();
    with_pairable_rows(&connection);

    create_transfer_counterpart(
        &mut connection,
        CreateTransferCounterpart {
            id: PARENT.into(),
            target_account_id: HOLIDAY.into(),
            user_id: Some(OWNER.into()),
        },
    )
    .expect("mint");

    let mut statement = connection
        .prepare(
            "SELECT seq, entity, entity_id, action, before_data, after_data, created_at,
                    prev_hash, row_hash
               FROM financial_audit_log ORDER BY seq",
        )
        .expect("prepare");
    let rows = statement
        .query_map([], |record| {
            Ok((
                record.get::<_, i64>(0)?,
                record.get::<_, String>(1)?,
                record.get::<_, String>(2)?,
                record.get::<_, String>(3)?,
                record.get::<_, Option<String>>(4)?,
                record.get::<_, Option<String>>(5)?,
                record.get::<_, String>(6)?,
                record.get::<_, Option<String>>(7)?,
                record.get::<_, String>(8)?,
            ))
        })
        .expect("query")
        .collect::<Result<Vec<_>, _>>()
        .expect("rows");

    assert_eq!(rows.len(), 3, "a mint audits the new row, the source and the account");
    let mut previous: Option<String> = None;
    for (seq, entity, entity_id, action, before, after, created_at, prev_hash, row_hash) in rows {
        assert_eq!(prev_hash, previous, "seq {seq} does not follow its predecessor");
        let expected = wealth_core::audit::chain_hash(
            prev_hash.as_deref(),
            seq,
            &entity,
            &entity_id,
            &action,
            before.as_deref(),
            after.as_deref(),
            &created_at,
        );
        assert_eq!(row_hash, expected, "seq {seq} does not hash to its own fields");
        previous = Some(row_hash);
    }
}

// ── 5. What the mint carries, and what it deliberately does not ────────────

#[test]
fn a_minted_counterpart_takes_the_defaults_the_rpcs_column_list_leaves_out() {
    // MEASURED against the reference cluster (probe-transfers4.sh, `ctc-detail`)
    // and asserted here because these are absences, and an absence is what a
    // "helpful" port adds without noticing. The source row has every one of
    // these set; the counterpart has none of them.
    let mut connection = fixture();
    connection
        .execute_batch(&format!(
            "UPDATE transactions SET notes = 'a note', is_cleared = 1, is_recurring = 1,
                    statement_sequence = 7, metadata = '{{\"k\":1}}', category_confirmed = 0,
                    import_source = 'csv', import_source_id = 'row-9'
              WHERE id = '{PARENT}';"
        ))
        .expect("enrich the source");

    let result = create_transfer_counterpart(
        &mut connection,
        CreateTransferCounterpart {
            id: PARENT.into(),
            target_account_id: RAINY_DAY.into(),
            user_id: Some(OWNER.into()),
        },
    )
    .expect("mint");

    let minted = &result.counterpart;
    // Carried.
    assert_eq!(minted.description, "Corner shop");
    assert_eq!(minted.date, "2024-03-01");
    assert_eq!(minted.notes.as_deref(), Some("a note"));
    assert_eq!(minted.amount.minor(), 2500);
    assert_eq!(minted.kind, "transfer");
    // NOT carried. A statement reconciled at one bank says nothing about one at
    // another, and a row minted here did not come from anybody's CSV.
    assert!(!minted.is_cleared, "a minted row is never cleared");
    assert!(!minted.is_recurring);
    assert_eq!(minted.statement_sequence, None);
    assert_eq!(minted.import_source, None);
    assert_eq!(minted.metadata, serde_json::json!({}));
    // Takes the column DEFAULT, which is 1 — even though the source says 0.
    assert!(minted.category_confirmed);

    // B-2: one account moved, by exactly the counterpart's amount, and the
    // source's account did not move at all.
    assert_eq!(balance(&connection, RAINY_DAY), 2500);
    assert_eq!(balance(&connection, EVERYDAY), -2500);
    assert!(identity_holds(&connection, EVERYDAY));
    assert!(identity_holds(&connection, RAINY_DAY));
}

#[test]
fn a_pair_that_is_only_a_penny_apart_is_not_a_pair() {
    // T-1 from the Rust side, where the boundary cases live: one penny, and the
    // zero case that `<> -b` alone would let through.
    let mut connection = fixture();
    with_pairable_rows(&connection);
    connection
        .execute_batch(&format!(
            "UPDATE transactions SET amount_minor = 2999 WHERE id = '{PAIR_IN}';
             UPDATE accounts SET balance_minor = balance_minor - 1 WHERE id = '{RAINY_DAY}';"
        ))
        .expect("a penny out");

    let refusal = link_transfer_pair(
        &mut connection,
        LinkTransferPair {
            id_a: PAIR_OUT.into(),
            id_b: PAIR_IN.into(),
            user_id: Some(OWNER.into()),
        },
    )
    .expect_err("a penny is enough");
    assert_eq!(refusal.code(), "transfer_amounts_not_opposite");
    assert!(
        refusal.to_string().contains("(-30.00 vs 29.99)"),
        "both figures, in the RPC's order: {refusal}"
    );

    connection
        .execute_batch(&format!(
            "UPDATE transactions SET amount_minor = 0 WHERE id IN ('{PAIR_OUT}', '{PAIR_IN}');
             UPDATE accounts SET balance_minor = 0 WHERE id IN ('{EVERYDAY}', '{RAINY_DAY}');
             UPDATE accounts SET balance_minor = -2500 WHERE id = '{EVERYDAY}';"
        ))
        .expect("both zero");
    let refusal = link_transfer_pair(
        &mut connection,
        LinkTransferPair {
            id_a: PAIR_OUT.into(),
            id_b: PAIR_IN.into(),
            user_id: Some(OWNER.into()),
        },
    )
    .expect_err("zero negates to zero, which is why the zero test is not redundant");
    assert_eq!(refusal.code(), "transfer_amounts_not_opposite");
}
