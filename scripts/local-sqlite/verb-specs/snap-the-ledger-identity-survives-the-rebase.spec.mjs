import { USER, EVERYDAY, storedBalances } from './_shared.mjs';

export default {
  invariant: 'B-1',
  title: 'a snap moves the balance to the bank\'s figure and shifts the opening balance by the same delta',
  design: '20260613090000:17-21 — "snap balance to the bank\'s figure and shift initial_balance by the same delta, so the invariant holds through the snap". MEASURED on the reference cluster: an account at −25.00 with one −25.00 row, snapped to 10.00, ends at balance 10.00 / initial 35.00, and B-1 holds',
  consequence: 'this is why verbs/mod.rs can say set_account_balance does not exist while this function takes an absolute figure: it is a REBASE, not an override. Adding the same delta to both sides of balance = initial_balance + Σ(amount) leaves it true, and not one transaction is invented, moved or deleted to get there',
  parity: 'match',

  command: {
    verb: 'link_bank_account_snap',
    payload: { account_id: EVERYDAY, user_id: USER, bank_balance: '10.00' },
  },
  expect: { outcome: 'ok' },
  result: { id: EVERYDAY, user_id: USER, name: 'Everyday', balance: '10.00', initial_balance: '35.00' },
  state: [
    storedBalances(EVERYDAY, '10.00/35.00'),
    {
      name: 'bank_balance_is_the_reference',
      // Rendered as a decimal on the SQLite side so the two engines are compared
      // on the FIGURE rather than on how each stores it — minor units against
      // numeric(20,2) is a difference in scale, not in money.
      sqlite: `SELECT (CASE WHEN bank_balance_minor < 0 THEN '-' ELSE '' END
                 || CAST(abs(bank_balance_minor) / 100 AS TEXT) || '.'
                 || substr('0' || CAST(abs(bank_balance_minor) % 100 AS TEXT), -2, 2))
                 FROM accounts WHERE id = '${EVERYDAY}'`,
      postgres: `SELECT bank_balance::text FROM public.accounts WHERE id = '${EVERYDAY}'`,
      expect: '10.00',
    },
    {
      // B-1 itself, computed rather than asserted: initial_balance + Σ(amount).
      name: 'b1_holds',
      sqlite: `SELECT CASE WHEN a.balance_minor = a.initial_balance_minor
                      + COALESCE((SELECT SUM(t.amount_minor) FROM transactions t WHERE t.account_id = a.id), 0)
                    THEN 'HOLDS' ELSE 'BROKEN' END FROM accounts a WHERE a.id = '${EVERYDAY}'`,
      postgres: `SELECT CASE WHEN a.balance = a.initial_balance
                        + COALESCE((SELECT SUM(t.amount) FROM public.transactions t WHERE t.account_id = a.id), 0)
                      THEN 'HOLDS' ELSE 'BROKEN' END FROM public.accounts a WHERE a.id = '${EVERYDAY}'`,
      expect: 'HOLDS',
    },
    {
      // 20260807200000 added bank_balance_date so an old statement cannot
      // overwrite a newer figure. The snap does not set it, MEASURED — that is
      // the live behaviour, and a snap that dated its own figure would be a
      // change to the cloud rather than a port of it.
      name: 'the_snap_does_not_date_its_own_figure',
      sqlite: `SELECT COALESCE(bank_balance_date, 'UNDATED') FROM accounts WHERE id = '${EVERYDAY}'`,
      postgres: `SELECT COALESCE(bank_balance_date::text, 'UNDATED') FROM public.accounts WHERE id = '${EVERYDAY}'`,
      expect: 'UNDATED',
    },
  ],
};
