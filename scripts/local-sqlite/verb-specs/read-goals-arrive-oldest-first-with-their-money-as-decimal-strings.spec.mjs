import {
  USER, EVERYDAY, RAINY_DAY, WEEKLY_SHOP, HOLIDAY_GOAL, ROOF_GOAL, OPENED_SECOND,
  twoGoals, listedGoal, balanceIdentityHolds, auditRowsInTotal,
} from './_shared.mjs';

export default {
  invariant: 'READ-1',
  title: 'the goals come back oldest first, whole, with both amounts as decimal strings',
  design: 'planningService.getGoals: .select(\'*\').eq(\'user_id\', …).order(\'created_at\', { ascending: true }). goalFromDb reads three of the app\'s fields out of the metadata blob and two more out of status, so the crate carries both columns untouched and decides neither',
  consequence: 'currentAmount IS progress — the same figure under two names — so a goal whose amount arrived through a float would show a bar that does not match the money that was put by',
  parity: 'match',

  setup: twoGoals,
  command: { verb: 'list_goals', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  result: {
    goals: [
      listedGoal({
        id: HOLIDAY_GOAL, name: 'Holiday', description: 'somewhere warm',
        target_amount: '2500.00', current_amount: '123.45', target_date: '2025-06-01',
        category: WEEKLY_SHOP, priority: 'high', account_id: RAINY_DAY,
        contribution_frequency: 'monthly', auto_contribute: true, icon: 'sun', color: '#ffcc00',
        metadata: { type: 'savings' },
      }),
      listedGoal({
        id: ROOF_GOAL, name: 'New roof', target_amount: '5000.00', current_amount: '5000.00',
        status: 'completed', completed_at: '2024-03-04T05:06:07.000Z',
        created_at: OPENED_SECOND, updated_at: OPENED_SECOND,
      }),
    ],
  },
  state: [balanceIdentityHolds(EVERYDAY), auditRowsInTotal('0')],
};
