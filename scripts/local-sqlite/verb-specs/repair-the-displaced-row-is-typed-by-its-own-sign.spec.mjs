import { USER, EVERYDAY, RAINY_DAY, OTHER_LEG, THIS_LEG, ADJUSTMENT,
  adjustmentCategory, strandedRow, setups,
  balanceOf, balanceIdentityHolds, transferShape, transferLinksAreMutual,
  auditShape } from './_shared.mjs';
import { STRANDED } from './_repair.mjs';

// The `CASE WHEN amount < 0 THEN 'expense' ELSE 'income' END` on its own, with
// the sign the other way round. The displaced row stops being half a transfer,
// so it needs a type of its own, and the only honest source for that is the sign
// of its own amount.
//
// The whole fixture is mirrored: +15.00 in Everyday linked to −15.00 in Rainy
// day, with a +15.00 stranded row. The displaced row is positive, so it becomes
// `income` — where the main happy-path spec's is negative and becomes `expense`.
// A port that hard-coded either would pass one spec and fail this one.
export default {
  invariant: 'D-3',
  title: 'the displaced row is re-typed from the sign of its own amount, in both directions',
  design: 'repair_claimed_transfer 20260805145035:405 — CASE WHEN amount < 0, in SQL against the stored column',
  consequence: 'a row that stops being a transfer keeps the type it had as one, and reports count money in the wrong direction',
  parity: 'match',

  setup: setups(adjustmentCategory, {
    sqlite: `
      INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date,
                                transfer_account_id) VALUES
        ('${OTHER_LEG}', '${USER}', '${EVERYDAY}',  'In from savings', 1500, 'transfer', '2024-04-01', '${RAINY_DAY}'),
        ('${THIS_LEG}',  '${USER}', '${RAINY_DAY}', 'Out to everyday',-1500, 'transfer', '2024-04-01', '${EVERYDAY}');
      UPDATE transactions SET linked_transfer_id = '${THIS_LEG}'  WHERE id = '${OTHER_LEG}';
      UPDATE transactions SET linked_transfer_id = '${OTHER_LEG}' WHERE id = '${THIS_LEG}';
      UPDATE accounts SET balance_minor = balance_minor + 1500 WHERE id = '${EVERYDAY}';
      UPDATE accounts SET balance_minor = balance_minor - 1500 WHERE id = '${RAINY_DAY}';
      INSERT INTO transactions (id, user_id, account_id, description, amount_minor, type, date)
        VALUES ('${STRANDED}', '${USER}', '${EVERYDAY}', 'Really the other side', 1500, 'income', '2024-04-01');
      UPDATE accounts SET balance_minor = balance_minor + 1500 WHERE id = '${EVERYDAY}';`,
    postgres: `
      INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date,
                                       transfer_account_id) VALUES
        ('${OTHER_LEG}', '${USER}', '${EVERYDAY}',  'In from savings', 15.00, 'transfer', '2024-04-01', '${RAINY_DAY}'),
        ('${THIS_LEG}',  '${USER}', '${RAINY_DAY}', 'Out to everyday',-15.00, 'transfer', '2024-04-01', '${EVERYDAY}');
      UPDATE public.transactions SET linked_transfer_id = '${THIS_LEG}'  WHERE id = '${OTHER_LEG}';
      UPDATE public.transactions SET linked_transfer_id = '${OTHER_LEG}' WHERE id = '${THIS_LEG}';
      UPDATE public.accounts SET balance = balance + 15.00 WHERE id = '${EVERYDAY}';
      UPDATE public.accounts SET balance = balance - 15.00 WHERE id = '${RAINY_DAY}';
      INSERT INTO public.transactions (id, user_id, account_id, description, amount, type, date)
        VALUES ('${STRANDED}', '${USER}', '${EVERYDAY}', 'Really the other side', 15.00, 'income', '2024-04-01');
      UPDATE public.accounts SET balance = balance + 15.00 WHERE id = '${EVERYDAY}';`,
  }),
  command: {
    verb: 'repair_claimed_transfer',
    payload: {
      stranded_id: STRANDED,
      counterpart_id: THIS_LEG,
      partner_id: OTHER_LEG,
      adjustment_category_id: ADJUSTMENT,
      user_id: USER,
    },
  },
  expect: { outcome: 'ok' },
  result: { id: STRANDED, amount: '15.00', type: 'transfer' },

  rowDivergence: {
    category: 'a To/From category\'s id is minted by a trigger on both engines and is unknowable at authoring time on either — the state assertions compare it by NAME instead',
  },

  state: [
    // Positive, so `income` — the branch the main happy path never reaches.
    transferShape(OTHER_LEG, 'income:Account Adjustment:-:-:-'),
    transferShape(STRANDED, `transfer:To/From Rainy day:0002:${THIS_LEG.slice(-4)}:-`),
    transferShape(THIS_LEG, `transfer:To/From Everyday:0001:${STRANDED.slice(-4)}:-`),
    transferLinksAreMutual(),
    balanceOf(EVERYDAY, '5.00'),
    balanceOf(RAINY_DAY, '-15.00'),
    balanceIdentityHolds(EVERYDAY),
    balanceIdentityHolds(RAINY_DAY),
    auditShape('transaction/update,transaction/update,transaction/update'),
  ],
};
