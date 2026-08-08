import { USER, RESTORED_ROW, backupTransaction, chunk, wipedWithOneAccount } from './_shared.mjs';

export default {
  invariant: 'MONEY-4',
  title: 'the money a cloud backup keeps in a JSON blob is lifted into typed columns',
  design: 'DESIGN.md §3.3 and §5 divergence 9 — "the one most likely to bite: it is a hard failure on real data". src/types/index.ts declares ten untyped `number` fields inside transferMetadata and six inside investmentData; transactions_no_money_in_metadata refuses eleven of them outright. MEASURED: the blob below is accepted by Postgres and raises that CHECK on SQLite unless the money comes out first',
  consequence: 'without the lift, a real cloud backup cannot be restored at all — every wire transfer and every cross-currency row the MS Money importer wrote carries one of these keys',
  parity: 'divergent',
  reason: 'The cloud has no constraint on its metadata blob, so it stores the floats untouched and the figures stay untyped, unbounded and invisible to every report. The local file bans them by CHECK, so the restore promotes the four that have a typed home (fees, originalAmount, originalCurrency, exchangeRate) and REPORTS every one it drops. Nothing is lost in silence, which is the only part of this that is not negotiable.',

  setup: wipedWithOneAccount,
  command: {
    verb: 'restore_user_chunk',
    payload: {
      chunks: [chunk('transactions', [backupTransaction({
        description: 'Wire out',
        metadata: {
          transferMetadata: {
            fees: '12.50',
            originalAmount: '-30.00',
            originalCurrency: 'EUR',
            exchangeRate: '1.1234567891',
            marketValue: '9.99',
            transferType: 'wire',
          },
          reference: 'kept',
        },
      })])],
      user_id: USER,
    },
  },
  expect: { outcome: 'ok' },
  result: { inserted: 1 },
  rowDivergence: {
    dropped: 'The cloud stores the blob whole, so it drops nothing and reports nothing. Locally marketValue belongs on the holding rather than on a transaction and has no column here, so it is thrown away — and said so, which is what this key is for.',
  },
  state: [
    {
      // The promoted figures, as integers this file can add up.
      name: 'promoted_columns',
      sqlite: `SELECT COALESCE(CAST(fee_minor AS TEXT), 'NONE') || '/'
                 || COALESCE(CAST(original_amount_minor AS TEXT), 'NONE') || '/'
                 || COALESCE(original_currency, 'NONE') || '/'
                 || COALESCE(CAST(fx_rate_e10 AS TEXT), 'NONE')
                 FROM transactions WHERE id = '${RESTORED_ROW}'`,
      // The cloud has no such columns at all, which is the divergence stated as
      // a value rather than as prose.
      postgres: `SELECT 'NO SUCH COLUMNS' FROM public.transactions WHERE id = '${RESTORED_ROW}'`,
      expect: { sqlite: '1250/-3000/EUR/11234567891', postgres: 'NO SUCH COLUMNS' },
    },
    {
      // Everything non-numeric survives untouched on both engines: labels and
      // references are not money and nothing here is entitled to lose them.
      name: 'the_labels_survive',
      sqlite: `SELECT json_extract(metadata, '$.reference') || '/'
                 || json_extract(metadata, '$.transferMetadata.transferType')
                 FROM transactions WHERE id = '${RESTORED_ROW}'`,
      postgres: `SELECT (metadata->>'reference') || '/' || (metadata->'transferMetadata'->>'transferType')
                   FROM public.transactions WHERE id = '${RESTORED_ROW}'`,
      expect: 'kept/wire',
    },
    {
      name: 'no_money_left_in_the_blob',
      sqlite: `SELECT CASE WHEN json_extract(metadata, '$.transferMetadata.fees') IS NULL
                            AND json_extract(metadata, '$.transferMetadata.marketValue') IS NULL
                       THEN 'CLEAN' ELSE 'STILL THERE' END
                 FROM transactions WHERE id = '${RESTORED_ROW}'`,
      postgres: `SELECT CASE WHEN metadata->'transferMetadata'->'fees' IS NULL
                              AND metadata->'transferMetadata'->'marketValue' IS NULL
                         THEN 'CLEAN' ELSE 'STILL THERE' END
                   FROM public.transactions WHERE id = '${RESTORED_ROW}'`,
      expect: { sqlite: 'CLEAN', postgres: 'STILL THERE' },
    },
  ],
};
