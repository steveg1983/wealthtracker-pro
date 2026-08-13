-- ============================================================================
-- OPENING BALANCE DATES — a READ-ONLY audit. Nothing here changes any row.
--
-- WHY THIS EXISTS
-- The Account Settings dialog used to pre-fill TODAY into the opening-balance
-- date whenever an account had none — which is the normal state for an imported
-- account, because Money records `dtOpen` only sometimes and our importer
-- writes nothing rather than inventing a date. Opening that dialog to change an
-- account's NAME and pressing Save therefore stamped "opened today" onto an
-- account that had been running since 2010. Fixed 2026-08-13; this finds
-- whatever the bug wrote before it was fixed.
--
-- WHAT THE APP DOES WITH THESE DATES (src/utils/openingDates.ts)
--   rung 1  a stored date — CLAMPED so it can never fall after the first
--           transaction. This is why an account WITH history is largely
--           protected: a wrong stored date of today still draws from the first
--           transaction. The stored value is wrong; the arithmetic is not.
--   rung 2  no stored date → the first transaction's date.
--   rung 3  no transactions → the paired "(Cash)" sibling's first activity.
--   rung 4  no signal at all → beginning of time, and the net-worth report
--           warns about it by name.
--
-- SO THE REAL DAMAGE IS CONCENTRATED IN SECTION C: accounts with a stored date
-- and NO transactions, where there is nothing to clamp against.
--
-- Run each section in the Supabase SQL editor and read the output. Nothing is
-- written; any correction is yours to make afterwards, by hand or by a script
-- you approve separately.
-- ============================================================================

-- ── A. STORED DATE LATER THAN THE FIRST TRANSACTION ─────────────────────────
-- The signature of the bug. `days_wrong` is how far the stored date sits after
-- the account's earliest activity. Anything near "days since 2026-08-13" was
-- almost certainly stamped by the dialog.
--
-- These are the accounts to eyeball first, but note the clamp: their HISTORY is
-- already being drawn from first_txn, so fixing the stored value tidies the
-- record rather than moving the chart.
select
  a.id,
  a.name,
  a.is_active,
  a.opening_balance_date::date                     as stored_date,
  min(t.date)::date                                as first_txn,
  (a.opening_balance_date::date - min(t.date)::date) as days_wrong,
  count(t.id)                                      as txn_count,
  a.initial_balance
from accounts a
join transactions t on t.account_id = a.id
where a.opening_balance_date is not null
group by a.id, a.name, a.is_active, a.opening_balance_date, a.initial_balance
having a.opening_balance_date::date > min(t.date)::date
order by days_wrong desc, a.name;

-- ── B. NO STORED DATE, BUT HISTORY EXISTS ───────────────────────────────────
-- NOT a fault: this is rung 2 working as designed, and it is what the report
-- banner means by "inferred from their first activity". Listed so the inferred
-- date can be confirmed as the real opening day — and so the count is known
-- before anyone decides to backfill.
select
  a.id,
  a.name,
  a.is_active,
  min(t.date)::date as would_apply_from,
  count(t.id)       as txn_count,
  a.initial_balance
from accounts a
join transactions t on t.account_id = a.id
where a.opening_balance_date is null
group by a.id, a.name, a.is_active, a.initial_balance
order by a.name;

-- ── C. THE ONES THAT CAN ACTUALLY DISTORT NET WORTH ─────────────────────────
-- A stored opening date, a non-zero opening balance, and NO transactions to
-- clamp it against. Whatever date is here is taken literally, so a value the
-- dialog invented puts real money on the wrong day — and an account with no
-- register is exactly the kind nobody opens to check.
--
-- Closed accounts included deliberately: they hold the oldest balances and are
-- the least likely to be looked at.
select
  a.id,
  a.name,
  a.is_active,
  a.opening_balance_date::date as stored_date,
  a.initial_balance,
  'no transactions — this date is used as-is' as note
from accounts a
where a.opening_balance_date is not null
  and coalesce(a.initial_balance, 0) <> 0
  and not exists (select 1 from transactions t where t.account_id = a.id)
order by a.opening_balance_date desc, a.name;

-- ── D. NO SIGNAL AT ALL (rung 4) ────────────────────────────────────────────
-- No stored date, no transactions, and money in the opening balance: the app
-- applies it from the beginning of time and says so on the net-worth report.
-- These overstate every point before the account really existed.
select
  a.id,
  a.name,
  a.is_active,
  a.initial_balance,
  'counts from the beginning of time' as note
from accounts a
where a.opening_balance_date is null
  and coalesce(a.initial_balance, 0) <> 0
  and not exists (select 1 from transactions t where t.account_id = a.id)
order by abs(coalesce(a.initial_balance, 0)) desc;

-- ── E. ONE-LINE SUMMARY ─────────────────────────────────────────────────────
-- How big is each bucket, before reading any of the detail above.
select
  count(*) filter (
    where a.opening_balance_date is not null
      and exists (select 1 from transactions t where t.account_id = a.id)
      and a.opening_balance_date::date >
          (select min(t.date)::date from transactions t where t.account_id = a.id)
  ) as a_stored_date_after_first_txn,
  count(*) filter (
    where a.opening_balance_date is null
      and exists (select 1 from transactions t where t.account_id = a.id)
  ) as b_inferred_from_first_txn,
  count(*) filter (
    where a.opening_balance_date is not null
      and coalesce(a.initial_balance, 0) <> 0
      and not exists (select 1 from transactions t where t.account_id = a.id)
  ) as c_literal_date_no_history,
  count(*) filter (
    where a.opening_balance_date is null
      and coalesce(a.initial_balance, 0) <> 0
      and not exists (select 1 from transactions t where t.account_id = a.id)
  ) as d_beginning_of_time,
  count(*) as accounts_total
from accounts a;
