import {
  STRANGER, USER, secondUser, twoDismissals,
  dismissalShape, dismissalsOwnedBy,
} from './_shared.mjs';

export default {
  invariant: 'X-6',
  title: 'undoing somebody else’s refusal is a nothing, not a deletion',
  design: 'the .eq(user_id) that every one of this service’s three queries carries, and the RLS policy behind it: suggestion_dismissals_delete_own USING (user_id = requesting_user_id()), scoped TO authenticated, with anon matching no policy at all',
  consequence: 'the file is the whole store on a device, so an owner check that only lived in a cloud policy would be no check here. subject_key is canonical rather than random — two logins can legitimately hold the SAME key for the same finding — so a delete that dropped the owner would reach across accounts on the exact rows most likely to collide',
  parity: 'match',

  setup: {
    sqlite: `${secondUser.sqlite}\n${twoDismissals.sqlite}`,
    postgres: `${secondUser.postgres}\n${twoDismissals.postgres}`,
  },

  command: {
    verb: 'restore_suggestion',
    payload: { user_id: STRANGER, kind: 'transfer-pair', subject_key: 'the pair' },
  },

  expect: { outcome: 'ok' },

  result: { deleted: 0 },

  state: [
    dismissalShape('transfer-pair', 'the pair', 'transfer-pair:the pair:2'),
    dismissalsOwnedBy(USER, '2'),
    dismissalsOwnedBy(STRANGER, '0'),
  ],
};
