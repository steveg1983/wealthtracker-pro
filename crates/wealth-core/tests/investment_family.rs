//! Integration tests for the investment family's four writes and one read —
//! `create_investment`, `update_investment`, `delete_investment`,
//! `apply_investment_prices` and `list_investments` — against the real vendored
//! schema.
//!
//! The differential proof for all five lives in `scripts/local-sqlite/verbs.mjs`,
//! where the same payload runs against `InvestmentService`'s own INSERT, UPDATE
//! and DELETE transcribed into SQL. What is here is the half with **no Postgres
//! counterpart to compare against**:
//!
//! 1. **The audit trail.** The cloud writes none for `investments` — divergence
//!    10, inherited from the planning family — so the entries have nothing to be
//!    compared against and everything to be asserted, including the one shape
//!    only this family has: a price sweep writes ONE ENTRY PER ROW rather than
//!    one per quote.
//! 2. **The 1e8 boundary.** `quantity_e8`, `current_price_e8` and
//!    `purchase_price_e8` are INTEGER counts of hundred-millionths where the
//!    cloud has `numeric(20,8)`. The round trip through that encoding, the
//!    refusal of a ninth decimal place (divergence M-2) and the int64 CLIFF the
//!    cloud's wider type does not have are all local-only claims.
//! 3. **`cost_basis` derived rather than stated.** Both engines derive it; only
//!    here can the ABSENCE of a `cost_basis` key on the payload be asserted, and
//!    only here does the read-modify-write happen inside the transaction that
//!    writes.
//! 4. **The query plan.** R-12: a read verb that full-scans is a bug report
//!    rather than a merge, and `idx_investments_symbol` has to serve two
//!    different questions.
//! 5. **The guard table**, empty across all four writes.
//!
//! All data is invented. This repo is public: no real payee, account number or
//! figure appears anywhere in it.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use rusqlite::Connection;
use wealth_core::db;
use wealth_core::scaled::Scaled8;
use wealth_core::verbs::{
    apply_investment_prices, create_investment, delete_investment, list_investments,
    update_investment, ApplyInvestmentPrices, CreateInvestment, DeleteInvestment, InvestmentDraft,
    InvestmentPatch, OwnedRead, QuoteWriteback, UpdateInvestment,
};
use wealth_core::wire::Field;

const OWNER: &str = "11111111-1111-1111-1111-111111111111";
const STRANGER: &str = "22222222-2222-2222-2222-222222222222";
const PORTFOLIO: &str = "a0000000-0000-0000-0000-000000000009";
const HOLDING: &str = "d0000000-0000-0000-0000-0000000000f1";
const SECOND: &str = "d0000000-0000-0000-0000-0000000000f2";

/// Two logins and one investment account to file a holding against.
fn fixture() -> Connection {
    let connection = db::open_in_memory().expect("open");
    wealth_core::apply_schema(&connection).expect("schema");
    connection
        .execute_batch(&format!(
            "INSERT INTO users (id, email) VALUES
               ('{OWNER}', 'harness@example.test'),
               ('{STRANGER}', 'stranger@example.test');
             INSERT INTO accounts (id, user_id, name, type, balance_minor, initial_balance_minor)
               VALUES ('{PORTFOLIO}', '{OWNER}', 'Dealing account', 'investment', 0, 0);"
        ))
        .expect("fixture");
    connection
}

/// A draft with the columns the table insists on, and nothing else.
fn draft(id: &str, symbol: &str, quantity: &str, unit_price: Option<&str>) -> InvestmentDraft {
    InvestmentDraft {
        id: Some(id.to_owned()),
        account_id: Some(PORTFOLIO.to_owned()),
        symbol: Some(symbol.to_owned()),
        name: Some("A Listed Company plc".to_owned()),
        quantity: Some(Scaled8::parse(quantity).expect("quantity")),
        purchase_price: unit_price.map(|p| Scaled8::parse(p).expect("price")),
        purchase_date: Some("2024-06-01".to_owned()),
        currency: Some("GBP".to_owned()),
        asset_type: Some("stock".to_owned()),
        notes: None,
    }
}

fn create(connection: &mut Connection, draft: InvestmentDraft) -> wealth_core::error::CoreResult<()> {
    create_investment(
        connection,
        CreateInvestment {
            user_id: OWNER.to_owned(),
            investment: draft,
        },
    )
    .map(|_| ())
}

fn scalar(connection: &Connection, sql: &str) -> i64 {
    connection.query_row(sql, [], |row| row.get(0)).expect(sql)
}

fn text(connection: &Connection, sql: &str) -> String {
    connection.query_row(sql, [], |row| row.get(0)).expect(sql)
}

/// Every audit entry, as `entity/action` in write order.
fn trail(connection: &Connection) -> String {
    connection
        .query_row(
            "SELECT COALESCE((SELECT group_concat(entry, ',') FROM (
               SELECT entity || '/' || action AS entry
                 FROM financial_audit_log ORDER BY seq)), 'NONE')",
            [],
            |row| row.get(0),
        )
        .expect("trail")
}

fn guards_held(connection: &Connection) -> i64 {
    scalar(connection, "SELECT COUNT(*) FROM _rpc_guard")
}

fn refusal_code(error: &wealth_core::error::CoreError) -> String {
    error.code().to_owned()
}

/// `EXPLAIN QUERY PLAN`, as the lines SQLite reports — `reads_at_scale.rs`'s
/// helper, with its reason: the bound values are the REAL ones, because SQLite's
/// planner is allowed to choose differently for a value it can see.
fn plan(connection: &Connection, sql: &str, bound: &[&str]) -> String {
    let mut statement = connection
        .prepare(&format!("EXPLAIN QUERY PLAN {sql}"))
        .expect("explain");
    statement
        .query_map(rusqlite::params_from_iter(bound), |record| {
            record.get::<_, String>(3)
        })
        .expect("explain rows")
        .map(|line| line.expect("line"))
        .collect::<Vec<_>>()
        .join(" | ")
}

// ── The create ──────────────────────────────────────────────────────────────

#[test]
fn a_new_holding_is_stored_whole_and_answered_as_stored() {
    let mut connection = fixture();
    let created = create_investment(
        &mut connection,
        CreateInvestment {
            user_id: OWNER.to_owned(),
            investment: draft(HOLDING, "SHEL.L", "100", Some("32.775")),
        },
    )
    .expect("create");

    // The answer is what storage holds, defaults and all.
    assert_eq!(created.answer.symbol, "SHEL.L");
    assert_eq!(created.answer.quantity.to_decimal_string(), "100.00000000");
    assert_eq!(
        created.answer.purchase_price.map(Scaled8::to_decimal_string),
        Some("32.77500000".to_owned())
    );
    // A price nobody has fetched is NULL, never zero — the UI must be able to
    // say "never priced" rather than show a holding worth nothing.
    assert!(created.answer.current_price.is_none());
    assert!(created.answer.last_updated.is_none());

    // 100 × 32.775 = 3277.50 exactly, and it is MONEY.
    assert_eq!(created.answer.cost_basis.to_decimal_string(), "3277.50");
    assert_eq!(
        scalar(&connection, "SELECT cost_basis_minor FROM investments"),
        327_750
    );
    // The column schema.sql anticipated and this family deliberately leaves
    // alone: a stored copy of quantity × price goes stale the moment the price
    // does, and the screen computes it instead.
    assert_eq!(
        scalar(&connection, "SELECT COUNT(*) FROM investments WHERE market_value_minor IS NULL"),
        1
    );
    assert_eq!(guards_held(&connection), 0);
}

#[test]
fn the_cost_of_a_position_rounds_the_way_the_cloud_rounds_it() {
    let mut connection = fixture();
    // 3 units at £12.345 is £37.035 — a figure `numeric(10,2)` rounds AWAY FROM
    // ZERO to £37.04, and so does this.
    create(&mut connection, draft(HOLDING, "FUND.L", "3", Some("12.345"))).expect("create");
    assert_eq!(
        scalar(&connection, "SELECT cost_basis_minor FROM investments"),
        3_704
    );

    // A SHORT position of the same size costs −£37.04, not −£37.03. A half-up
    // implementation would answer the second and the two ledgers would be a
    // penny apart on every short that landed on a half.
    create(&mut connection, draft(SECOND, "SHORT.L", "-3", Some("12.345"))).expect("create");
    assert_eq!(
        scalar(
            &connection,
            &format!("SELECT cost_basis_minor FROM investments WHERE id = '{SECOND}'")
        ),
        -3_704
    );
}

#[test]
fn a_holding_with_no_symbol_is_refused_by_name_rather_than_stored() {
    let mut connection = fixture();
    let mut without = draft(HOLDING, "", "10", Some("1.00"));
    without.symbol = Some(String::new());

    let refusal = create(&mut connection, without).expect_err("an empty symbol is refused");
    assert_eq!(refusal_code(&refusal), "investment_symbol_required");
    // Nothing written, and no entry: a refusal is not a change.
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM investments"), 0);
    assert_eq!(trail(&connection), "NONE");
}

#[test]
fn an_unnamed_holding_is_called_after_its_ticker() {
    let mut connection = fixture();
    let mut nameless = draft(HOLDING, "VWRL.L", "5", Some("100.00"));
    nameless.name = Some(String::new());

    create(&mut connection, nameless).expect("create");
    // FALSY, not nullish: the writer's `draft.name.trim() || symbol`.
    assert_eq!(text(&connection, "SELECT name FROM investments"), "VWRL.L");
}

#[test]
fn a_holding_cannot_be_filed_against_a_strangers_account() {
    let mut connection = fixture();
    let refusal = create_investment(
        &mut connection,
        CreateInvestment {
            user_id: STRANGER.to_owned(),
            investment: draft(HOLDING, "SHEL.L", "1", Some("1.00")),
        },
    )
    .expect_err("R-12 refuses it");
    // The composite key (account_id, user_id), not a hand-written check.
    assert_eq!(refusal_code(&refusal), "constraint_violated");
}

// ── The 1e8 boundary ────────────────────────────────────────────────────────

#[test]
fn a_ninth_decimal_place_is_refused_rather_than_rounded() {
    // Divergence M-2 at the verb rather than at the parser: the cloud's
    // numeric(20,8) rounds this and says nothing.
    let refusal = serde_json::from_str::<InvestmentDraft>(r#"{"quantity":"0.000000005"}"#)
        .expect_err("a ninth place is refused");
    assert!(
        refusal.to_string().contains("figure_not_representable"),
        "named, not generic: {refusal}"
    );
}

#[test]
fn a_position_wider_than_the_cloud_type_permits_is_refused_here() {
    // `schema.sql`: *"Postgres numeric(20,8) permits 1e12 units, so a position
    // larger than 9e10 units exists in the cloud type and is REFUSED here. That
    // divergence is deliberate and tested."* This is the test.
    let refusal = serde_json::from_str::<InvestmentDraft>(r#"{"quantity":"1000000000000"}"#)
        .expect_err("the int64 cliff");
    assert!(
        refusal.to_string().contains("figure_out_of_range"),
        "named, not generic: {refusal}"
    );

    // And the largest position that DOES fit is stored to the last unit.
    let mut connection = fixture();
    create(&mut connection, draft(HOLDING, "BIG.L", "90000000000", None)).expect("create");
    assert_eq!(
        scalar(&connection, "SELECT quantity_e8 FROM investments"),
        9_000_000_000_000_000_000
    );
}

#[test]
fn a_quantity_may_not_arrive_as_a_json_number() {
    // The same refusal `Money` makes, one scale out, and for the same reason: a
    // JSON number is a binary float by the time any parser has read it, and 0.1
    // + 0.2 units of a fund is a position nobody holds.
    let refusal = serde_json::from_str::<InvestmentDraft>(r#"{"quantity":100}"#)
        .expect_err("a number is refused");
    assert!(
        refusal.to_string().contains("figure_must_be_a_string"),
        "named, not generic: {refusal}"
    );
}

// ── The update ──────────────────────────────────────────────────────────────

#[test]
fn quantity_and_unit_cost_move_the_cost_basis_together_or_not_at_all() {
    let mut connection = fixture();
    create(&mut connection, draft(HOLDING, "SHEL.L", "100", Some("32.775"))).expect("create");

    // Quantity ALONE. The stored unit price supplies the other half — inside the
    // same transaction, which is what the cloud's second round trip cannot do.
    update_investment(
        &mut connection,
        UpdateInvestment {
            id: HOLDING.to_owned(),
            user_id: Some(OWNER.to_owned()),
            patch: InvestmentPatch {
                quantity: Field::Value(Scaled8::parse("200").expect("quantity")),
                ..InvestmentPatch::default()
            },
        },
    )
    .expect("update");
    assert_eq!(
        scalar(&connection, "SELECT cost_basis_minor FROM investments"),
        655_500
    );

    // A field that is NOT one of the two leaves the cost exactly as it was.
    update_investment(
        &mut connection,
        UpdateInvestment {
            id: HOLDING.to_owned(),
            user_id: Some(OWNER.to_owned()),
            patch: InvestmentPatch {
                notes: Field::Value("Held in the ISA".to_owned()),
                ..InvestmentPatch::default()
            },
        },
    )
    .expect("update");
    assert_eq!(
        scalar(&connection, "SELECT cost_basis_minor FROM investments"),
        655_500
    );
}

#[test]
fn a_holding_nobody_has_is_refused_and_changes_nothing() {
    let mut connection = fixture();
    create(&mut connection, draft(HOLDING, "SHEL.L", "100", Some("32.775"))).expect("create");
    let before = trail(&connection);

    let refusal = update_investment(
        &mut connection,
        UpdateInvestment {
            id: "d0000000-0000-0000-0000-00000000dead".to_owned(),
            user_id: Some(OWNER.to_owned()),
            patch: InvestmentPatch {
                name: Field::Value("Nothing".to_owned()),
                ..InvestmentPatch::default()
            },
        },
    )
    .expect_err("refused by name");
    assert_eq!(refusal_code(&refusal), "investment_not_found");
    assert_eq!(trail(&connection), before, "a refusal is not a change");
}

#[test]
fn somebody_elses_holding_is_refused_by_name() {
    let mut connection = fixture();
    create(&mut connection, draft(HOLDING, "SHEL.L", "100", Some("32.775"))).expect("create");

    let refusal = update_investment(
        &mut connection,
        UpdateInvestment {
            id: HOLDING.to_owned(),
            user_id: Some(STRANGER.to_owned()),
            patch: InvestmentPatch {
                name: Field::Value("Mine now".to_owned()),
                ..InvestmentPatch::default()
            },
        },
    )
    .expect_err("not yours");
    assert_eq!(refusal_code(&refusal), "investment_not_found");
    assert_eq!(
        text(&connection, "SELECT name FROM investments"),
        "A Listed Company plc"
    );
}

// ── The delete ──────────────────────────────────────────────────────────────

#[test]
fn a_holding_really_goes_and_takes_its_buys_and_sells_with_it() {
    let mut connection = fixture();
    create(&mut connection, draft(HOLDING, "SHEL.L", "100", Some("32.775"))).expect("create");
    connection
        .execute_batch(&format!(
            "INSERT INTO investment_transactions
               (id, investment_id, user_id, transaction_type, quantity_e8, unit_price_e8,
                total_amount_minor, date)
             VALUES ('f0000000-0000-0000-0000-0000000000f1', '{HOLDING}', '{OWNER}',
                     'buy', 10000000000, 3277500000, 327750, '2024-06-01');"
        ))
        .expect("a buy");

    let removed = delete_investment(
        &mut connection,
        DeleteInvestment {
            id: HOLDING.to_owned(),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("delete");

    assert_eq!(removed.answer.deleted, 1);
    assert_eq!(scalar(&connection, "SELECT COUNT(*) FROM investments"), 0);
    // The FILE's cascade, not the verb's — and the verb neither counted it nor
    // audited it, which is `delete_goal`'s decision about contributions.
    assert_eq!(
        scalar(&connection, "SELECT COUNT(*) FROM investment_transactions"),
        0
    );
    assert_eq!(trail(&connection), "investment/create,investment/delete");
}

#[test]
fn deleting_a_holding_that_has_already_gone_is_a_successful_nothing() {
    let mut connection = fixture();
    let removed = delete_investment(
        &mut connection,
        DeleteInvestment {
            id: HOLDING.to_owned(),
            user_id: Some(OWNER.to_owned()),
        },
    )
    .expect("not an error");
    assert_eq!(removed.answer.deleted, 0);
    // And no entry: an audit log whose value is that every line is a change must
    // not record a decision that had no effect.
    assert_eq!(trail(&connection), "NONE");
}

// ── The price sweep ─────────────────────────────────────────────────────────

#[test]
fn one_quote_prices_every_row_of_that_symbol_and_counts_the_rows() {
    let mut connection = fixture();
    // The same fund in two positions — an ISA and a dealing account is the
    // ordinary case, and it is why a quote is matched by SYMBOL and not by id.
    create(&mut connection, draft(HOLDING, "VWRL.L", "10", Some("100.00"))).expect("create");
    create(&mut connection, draft(SECOND, "VWRL.L", "5", Some("100.00"))).expect("create");

    let swept = apply_investment_prices(
        &mut connection,
        ApplyInvestmentPrices {
            user_id: OWNER.to_owned(),
            quotes: vec![
                QuoteWriteback {
                    symbol: "VWRL.L".to_owned(),
                    price: Scaled8::parse("104.755").expect("price"),
                    as_of: "2026-08-11T16:35:00.000Z".to_owned(),
                },
                // A symbol nobody holds contributes ZERO to the count, which is
                // what makes "3 of 5 updated" an honest sentence.
                QuoteWriteback {
                    symbol: "NOBODY.L".to_owned(),
                    price: Scaled8::parse("1.00").expect("price"),
                    as_of: "2026-08-11T16:35:00.000Z".to_owned(),
                },
            ],
        },
    )
    .expect("sweep");

    assert_eq!(swept.answer.repriced, 2);
    assert_eq!(
        scalar(
            &connection,
            "SELECT COUNT(*) FROM investments WHERE current_price_e8 = 10475500000"
        ),
        2
    );
    // Only the two price columns moved: the user's own figures are untouched.
    assert_eq!(
        scalar(&connection, "SELECT SUM(cost_basis_minor) FROM investments"),
        150_000
    );
    // ONE ENTRY PER ROW, not one per quote: an entry names an entity, and a
    // quote is not one.
    assert_eq!(
        trail(&connection),
        "investment/create,investment/create,investment/update,investment/update"
    );
    assert_eq!(guards_held(&connection), 0);
}

#[test]
fn no_quotes_writes_nothing_and_opens_nothing() {
    let mut connection = fixture();
    create(&mut connection, draft(HOLDING, "VWRL.L", "10", Some("100.00"))).expect("create");

    let swept = apply_investment_prices(
        &mut connection,
        ApplyInvestmentPrices {
            user_id: OWNER.to_owned(),
            quotes: Vec::new(),
        },
    )
    .expect("nothing is an answer");
    assert_eq!(swept.answer.repriced, 0);
    assert_eq!(trail(&connection), "investment/create");
}

#[test]
fn a_sweep_cannot_reach_another_logins_rows() {
    let mut connection = fixture();
    create(&mut connection, draft(HOLDING, "VWRL.L", "10", Some("100.00"))).expect("create");
    // The stranger holds the same fund, in a file that holds two logins — which
    // a restored backup really can be.
    connection
        .execute_batch(&format!(
            "INSERT INTO investments (id, user_id, symbol, name, asset_type, currency,
                                       quantity_e8, cost_basis_minor)
             VALUES ('{SECOND}', '{STRANGER}', 'VWRL.L', 'Theirs', 'etf', 'GBP', 100000000, 10000);"
        ))
        .expect("their holding");

    apply_investment_prices(
        &mut connection,
        ApplyInvestmentPrices {
            user_id: OWNER.to_owned(),
            quotes: vec![QuoteWriteback {
                symbol: "VWRL.L".to_owned(),
                price: Scaled8::parse("104.755").expect("price"),
                as_of: "2026-08-11T16:35:00.000Z".to_owned(),
            }],
        },
    )
    .expect("sweep");

    assert_eq!(
        scalar(
            &connection,
            &format!("SELECT COUNT(*) FROM investments WHERE id = '{SECOND}' AND current_price_e8 IS NULL")
        ),
        1
    );
}

// ── The read ────────────────────────────────────────────────────────────────

#[test]
fn holdings_arrive_by_symbol_and_only_this_logins() {
    let mut connection = fixture();
    create(&mut connection, draft(SECOND, "VWRL.L", "5", Some("100.00"))).expect("create");
    create(&mut connection, draft(HOLDING, "AAPL", "5", Some("100.00"))).expect("create");
    connection
        .execute_batch(&format!(
            "INSERT INTO investments (id, user_id, symbol, name, asset_type, currency,
                                       quantity_e8, cost_basis_minor)
             VALUES ('d0000000-0000-0000-0000-0000000000f3', '{STRANGER}', 'AAAA', 'Theirs',
                     'etf', 'GBP', 100000000, 10000);"
        ))
        .expect("their holding");

    let listed = list_investments(
        &connection,
        OwnedRead {
            user_id: OWNER.to_owned(),
        },
    )
    .expect("read");

    let symbols: Vec<&str> = listed
        .answer
        .investments
        .iter()
        .map(|row| row.symbol.as_str())
        .collect();
    assert_eq!(symbols, vec!["AAPL", "VWRL.L"]);
}

#[test]
fn the_reads_use_their_index_rather_than_walking_the_table() {
    // R-12: *"read verb full-scans → EXPLAIN assertion red"*. Both questions the
    // family asks are served by ONE composite index, which is why there is not a
    // second one on `symbol` alone.
    let connection = fixture();

    let list_plan = plan(
        &connection,
        "SELECT id FROM investments WHERE user_id = ?1 ORDER BY symbol, id",
        &[OWNER],
    );
    assert!(
        list_plan.contains("USING INDEX idx_investments_symbol"),
        "the list must SEARCH, not SCAN: {list_plan}"
    );
    // MEASURED, and the measurement decided the wording rather than the other
    // way round: the composite is `(user_id, symbol)`, so the index delivers the
    // owner and the symbol order and SQLite sorts only the `id` tie-break —
    // `USE TEMP B-TREE FOR LAST TERM OF ORDER BY`, over one portfolio.
    //
    // That is ACCEPTED rather than indexed away, on `reads.rs`'s own terms for
    // the five other light reads: the sort happens after the index has cut the
    // table to one owner's rows, which is tens of them, and a fourth column on
    // this index would trade write cost on every price sweep for a sort of
    // fifty. What would change the answer is a SCAN — the whole-table walk the
    // assertion above refuses — or a full `USE TEMP B-TREE FOR ORDER BY`, which
    // would mean the symbol ordering had stopped coming from the index.
    assert!(
        list_plan.contains("USE TEMP B-TREE FOR LAST TERM OF ORDER BY"),
        "the symbol order must come from the index, leaving only the tie-break: {list_plan}"
    );

    let sweep_plan = plan(
        &connection,
        "SELECT id FROM investments WHERE user_id = ?1 AND symbol = ?2 ORDER BY id",
        &[OWNER, "VWRL.L"],
    );
    assert!(
        sweep_plan.contains("USING INDEX idx_investments_symbol"),
        "a sweep must not walk a portfolio per quote: {sweep_plan}"
    );
}
