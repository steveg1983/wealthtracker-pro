import {
  USER, EXISTING_GOAL, existingGoal, balanceIdentityHolds, goalShape,
} from './_shared.mjs';

// Contract rule 50. Putting money towards a goal arrives at the seam as an
// ordinary update carrying the new progress — a figure the caller has ALREADY
// added up and ALREADY capped against the target. So the write SETS.
//
// The fixture starts at 250.05 and the patch says 2000.00, which is the target.
// An engine that read the field as an increment would answer 2250.05 and draw a
// bar past its own end; run twice, it would answer 4250.05. This spec sends the
// full figure once and the shape assertion is what an increment would fail.
export default {
  invariant: 'B-3',
  title: 'an update sets the progress it is given rather than adding it to what is stored',
  design: 'planningService.updateGoal:342-377 and DataPortPlanningWrites.updateGoal — "this operation SETS what it is given and never adds to what is stored"',
  consequence: 'the cap that stops a goal passing its own target lives in the caller, so an implementation that added would undo it silently and the progress bar would draw past its end',
  parity: 'match',

  setup: existingGoal,

  command: {
    verb: 'update_goal',
    payload: {
      id: EXISTING_GOAL,
      user_id: USER,
      patch: { current_amount: '2000.00' },
    },
  },

  expect: { outcome: 'ok' },

  rowDivergence: {
    updated_at: 'the instant of the write, on two clocks and in two transactions',
    created_at: 'the fixture inserted it on each engine separately',
  },

  result: { id: EXISTING_GOAL, current_amount: '2000.00', target_amount: '2000.00' },

  state: [
    goalShape(EXISTING_GOAL, 'Holiday:2000.00:2000.00:2026-01-01:active:-:-:-:-:manual:-'),
    balanceIdentityHolds('a0000000-0000-0000-0000-000000000001'),
  ],
};
