import { USER, preferenceDocuments, settingOf } from './_shared.mjs';

const DOCUMENT = {
  version: 1,
  values: {
    money_management_theme: 'dark',
    dashboardKeyAccounts: '["a0000000-0000-0000-0000-000000000001"]',
  },
};

export default {
  invariant: 'PREF-1',
  title: 'a document written comes back as the file holds it, not as it was sent',
  design: 'this crate answers a write with the row as STORED — localDataPort.ts: "Every write below answers with the row as stored, mapped by the same toTransaction the reads use". The preferences pair keeps that rule by re-reading the document after the upsert, on both engines',
  consequence: 'the settings tier exists because a restored login came up factory-reset. A write that answered with its own argument would report success for a document the store never accepted, and the person would find out on the machine they moved to',
  parity: 'match',

  command: {
    verb: 'write_preferences',
    payload: { user_id: USER, preferences: DOCUMENT },
  },
  expect: { outcome: 'ok' },
  result: { preferences: DOCUMENT },
  state: [
    preferenceDocuments('1'),
    settingOf(USER, 'money_management_theme', 'dark'),
  ],
};
