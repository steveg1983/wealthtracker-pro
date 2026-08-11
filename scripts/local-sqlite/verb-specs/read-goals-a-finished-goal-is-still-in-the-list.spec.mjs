import { USER, ROOF_GOAL, twoGoals, auditRowsInTotal } from './_shared.mjs';

export default {
  invariant: 'READ-6',
  title: 'a completed goal stays in the answer, because reaching one is the thing worth showing',
  design: 'getGoals has no status filter, and goalFromDb derives BOTH isActive (status !== \'paused\') and achieved (status === \'completed\') from the column this answer carries. completed_at is the achievement itself rather than a per-device flag — "a goal reached on the laptop shows as reached on the phone"',
  consequence: 'filter completed goals out here and finishing one erases it, along with the date it was finished on — the single most satisfying row in the file',
  parity: 'match',

  setup: twoGoals,
  command: { verb: 'list_goals', payload: { user_id: USER } },
  expect: { outcome: 'ok' },
  state: [
    auditRowsInTotal('0'),
    {
      name: 'the_finished_goal_is_stored_finished',
      sqlite: `SELECT status || ' at ' || completed_at FROM goals WHERE id = '${ROOF_GOAL}'`,
      postgres: `SELECT status || ' at ' || to_char(completed_at AT TIME ZONE 'UTC',
                        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM public.goals WHERE id = '${ROOF_GOAL}'`,
      expect: 'completed at 2024-03-04T05:06:07.000Z',
    },
  ],
};
