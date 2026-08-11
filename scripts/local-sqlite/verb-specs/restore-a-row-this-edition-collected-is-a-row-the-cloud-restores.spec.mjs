import {
  USER, RESTORED_ROW, RESTORED_ACCOUNT, chunk, rowsInAccount, storedFlag, wipedWithOneAccount,
} from './_shared.mjs';

// B-11's claim, made mechanical: ONE format, read by both editions.
//
// The row below is not hand-written prose about what a backup looks like — it is
// literally the shape `collect_backup` emits, key for key: money as decimal TEXT
// (never a JSON number, which is a double by the time a parser has read it), the
// tags array the child table becomes, the four figures the cloud keeps inside
// `metadata.transferMetadata` put back where a cloud restore will look for them,
// and `is_reconciled` carrying its third value.
//
// Sending it through the RESTORE on both engines is the proof that matters: a
// file this edition writes is a file the cloud can pour back in, with the same
// result. The reverse direction — a cloud file into a local ledger — is what the
// other twenty-six restore specs have always asserted.
export default {
  invariant: 'X-7',
  title: 'the row a local collect writes restores identically on both engines',
  design: 'crate::backup — one column table read in BOTH directions, so a file this edition writes is a file the cloud reads; backupService.buildBackupBundle is the one builder all three engines call',
  consequence: 'two editions with two spellings of one format is a backup that restores on the machine it was taken from and nowhere else',
  parity: 'match',

  setup: wipedWithOneAccount,
  command: {
    verb: 'restore_user_chunk',
    payload: {
      chunks: [chunk('transactions', [{
        id: RESTORED_ROW,
        account_id: RESTORED_ACCOUNT,
        description: 'Corner shop',
        amount: '-70.10',
        type: 'expense',
        date: '2019-05-04',
        category: null,
        category_id: null,
        notes: null,
        merchant_name: null,
        location_city: null,
        location_country: null,
        payment_channel: null,
        is_recurring: false,
        is_cleared: true,
        is_reconciled: null,
        is_split: false,
        archived: false,
        statement_sequence: 3,
        category_confirmed: true,
        needs_review: false,
        transfer_account_id: null,
        import_source: 'ofx',
        import_source_id: 'FIT-0001',
        // The FX triple is ALL-OR-NOTHING in this schema
        // (`transactions_fx_complete`, a CHECK the cloud has never had), so a
        // collect that put the currency back without the amount and the rate
        // would write a file its own restore refuses. Measured the hard way:
        // this fixture said `fees` and `originalCurrency` alone and was refused
        // here while the cloud stored it.
        metadata: {
          reference: 'kept',
          transferMetadata: {
            fees: '1.50',
            originalAmount: '-80.00',
            originalCurrency: 'EUR',
            exchangeRate: '0.8765432100',
          },
        },
        created_at: '2019-05-04T00:00:00.000Z',
        updated_at: '2019-05-04T00:00:00.000Z',
        tags: ['groceries', 'weekly'],
      }])],
      user_id: USER,
    },
  },
  expect: { outcome: 'ok' },
  result: { inserted: 1 },

  state: [
    {
      name: 'the_whole_row_lands_the_same_way',
      sqlite: `SELECT amount_minor || '/' || COALESCE(CAST(statement_sequence AS TEXT), '-')
                 || '/' || COALESCE(import_source_id, '-')
                 || '/' || COALESCE(CAST(is_reconciled AS TEXT), 'NULL')
                 FROM transactions WHERE id = '${RESTORED_ROW}'`,
      postgres: `SELECT (amount * 100)::bigint || '/' || COALESCE(statement_sequence::text, '-')
                   || '/' || COALESCE(import_source_id, '-')
                   || '/' || COALESCE(is_reconciled::text, 'NULL')
                   FROM public.transactions WHERE id = '${RESTORED_ROW}'`,
      expect: '-7010/3/FIT-0001/NULL',
    },
    {
      name: 'the_tags_travel',
      sqlite: `SELECT group_concat(tag, ',') FROM (
                 SELECT tag FROM transaction_tags WHERE transaction_id = '${RESTORED_ROW}' ORDER BY tag)`,
      postgres: `SELECT array_to_string(tags, ',')
                   FROM public.transactions WHERE id = '${RESTORED_ROW}'`,
      expect: 'groceries,weekly',
    },
    {
      // The blob's non-money keys survive untouched on both engines — the
      // user's own text, which the promotion must not eat on its way past.
      name: 'the_users_own_text_survives_the_strip',
      sqlite: `SELECT json_extract(metadata, '$.reference')
                 FROM transactions WHERE id = '${RESTORED_ROW}'`,
      postgres: `SELECT metadata->>'reference'
                   FROM public.transactions WHERE id = '${RESTORED_ROW}'`,
      // WHERE the four promoted figures land is DESIGN.md divergence 9 and
      // differs by design — a typed column here, the blob there — so it is
      // asserted by `restore-money-in-the-metadata-blob-is-lifted-into-its-own-
      // column`, which declares that divergence rather than smuggling it into a
      // spec about the format. What is compared HERE is the half that must be
      // identical: the file is accepted by both, and nothing else in the blob
      // moved.
      expect: 'kept',
    },
    storedFlag(RESTORED_ROW, 'is_cleared', 'yes'),
    storedFlag(RESTORED_ROW, 'needs_review', 'no'),
    rowsInAccount(RESTORED_ACCOUNT, '1'),
  ],
};
