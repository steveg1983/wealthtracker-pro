/**
 * What a WRITE hands back, against the REAL crate.
 *
 * @vitest-environment node
 *
 * The contract suite asks whether a write LANDED, and reads the file back with
 * an independent witness to find out. This asks a different question, and it is
 * the one slice 19 wrote down and left open: is the row the write ANSWERED with
 * a true description of the row that is now in the file?
 *
 * It was not. A verb answered with `crate::row::TransactionRow`, which IS the
 * audit entry's field set, and the audit entry does not carry `needs_review`.
 * So every write answered `needsReview: false` whatever the file held — and the
 * blast radius is small, specific and silent: an edit that never mentioned the
 * flag un-bolds an imported row in the register until the next read, for
 * somebody who is working through exactly those rows.
 *
 * `localDataPort.ts`'s header recorded it, and `scripts/local-sqlite/schema.sql`
 * amendment (6) ruled where the fix belongs — *"the field's read-back home is
 * the RESULT projection"* — because widening the audit row would re-chain every
 * hash to record what the review flag already says elsewhere. Slice 27 built
 * that projection: `crate::row::WrittenTransaction` is the audit row plus the
 * one column, and it is what every write now answers with.
 *
 * Proved here through the whole stack — the port, the spawn transport, the real
 * binary, a real file — because the gap was in the seam between the crate's
 * projection and the app's mapper, and neither side alone could show it.
 */

import { afterAll, describe, expect, it } from 'vitest';
import { LocalDataPort } from '../../local/localDataPort';
import { createSpawnTransport } from '../../local/spawnTransport';
import { LedgerFiles, locateBridge, readBack, seed } from './localCore.fixtureFile';
import type { PortFixture } from './contract';

const OWNER = '11111111-1111-1111-1111-111111111111';
const EVERYDAY = 'a0000000-0000-0000-0000-000000000001';
const OUTGOINGS = 'c0000000-0000-0000-0000-000000000002';

const bridge = locateBridge();
const files = new LedgerFiles(bridge);

afterAll(() => {
  files.dispose();
});

/**
 * One account, one category and nothing else. The rows this file cares about
 * arrive through the IMPORT verb, because that is the only way a row is born
 * needing review — `create_transaction` deliberately does not set the flag, so
 * a row a person typed is born reviewed (migration 20260810090000's rule).
 */
const fixture = (): PortFixture => ({
  accounts: [
    {
      id: EVERYDAY,
      name: 'Everyday',
      type: 'current',
      balance: 0,
      currency: 'GBP',
      institution: '',
      isActive: true,
      openingBalance: 0,
      lastUpdated: new Date('2026-01-01T00:00:00.000Z')
    }
  ],
  categories: [
    {
      id: 'c0000000-0000-0000-0000-000000000001',
      name: 'Transfer',
      type: 'both',
      level: 'type',
      parentId: null,
      isActive: true
    },
    {
      id: OUTGOINGS,
      name: 'Outgoings',
      type: 'expense',
      level: 'type',
      parentId: null,
      isActive: true
    }
  ]
});

const portFor = (file: string): LocalDataPort =>
  new LocalDataPort({
    owner: OWNER,
    transport: createSpawnTransport({ binary: bridge, database: file }),
    format: {
      steps: [],
      build: () => {
        throw new Error('not this test');
      },
      rowsForStep: () => [],
      remapIds: () => {
        throw new Error('not this test');
      }
    },
    migration: {
      plan: () => {
        throw new Error('not this test');
      }
    },
    logger: {
      error: (message, error) => {
        throw new Error(`${message}: ${String(error)}`);
      }
    }
  });

/** One imported row, which is a row nobody has looked at yet. */
const importOne = async (port: LocalDataPort): Promise<string> => {
  const result = await port.importTransactions(EVERYDAY, [
    {
      accountId: EVERYDAY,
      amount: -12.34,
      date: new Date('2026-02-03T12:00:00.000Z'),
      description: 'Corner shop',
      category: OUTGOINGS,
      type: 'expense',
      tags: [],
      cleared: false
    }
  ]);
  expect(result.inserted).toBe(1);

  const [row] = await port.listTransactions();
  expect(row.needsReview).toBe(true);
  return row.id;
};

describe('a written row answers with what the file now holds', () => {
  it('keeps a stored review flag through an edit that never mentioned it', async () => {
    // THE GAP, closed. Before the result projection this answered `false` and
    // a caller replacing its copy with the answer un-bolded the row.
    const file = files.create('written');
    seed(file, fixture(), OWNER);
    const port = portFor(file);
    const id = await importOne(port);

    const answered = await port.updateTransaction(id, { notes: 'looked at the receipt' });

    expect(answered.needsReview).toBe(true);
    // And the file agrees — read back by the independent witness, never by the
    // port, so this is not the engine agreeing with itself.
    const [stored] = readBack(file).transactions;
    expect(stored.needsReview).toBe(true);
    expect(stored.notes).toBe('looked at the receipt');
  });

  it('reports the flag going down, on the edit that puts it down', async () => {
    // The other direction, which is the one the register's four save buttons
    // send: `needs_review: false` explicitly.
    const file = files.create('written');
    seed(file, fixture(), OWNER);
    const port = portFor(file);
    const id = await importOne(port);

    const answered = await port.updateTransaction(id, { needsReview: false });

    expect(answered.needsReview).toBe(false);
    expect(readBack(file).transactions[0].needsReview).toBe(false);
  });

  it('says so on a row that was typed rather than imported', async () => {
    // A created row is born REVIEWED — the create verb deliberately does not set
    // the flag — so the projection has to be able to answer false truthfully as
    // well as true, or it would be a constant with a longer name.
    const file = files.create('written');
    seed(file, fixture(), OWNER);
    const port = portFor(file);

    const created = await port.createTransaction({
      accountId: EVERYDAY,
      amount: -5,
      date: new Date('2026-02-04T12:00:00.000Z'),
      description: 'Typed by a person',
      category: OUTGOINGS,
      type: 'expense',
      tags: [],
      cleared: false
    });

    expect(created.needsReview).toBe(false);
  });

  it('deletes an imported row without tripping over the projection', async () => {
    // The delete verb is the one place the result projection cannot be taken
    // beside the audit — by then the row is gone and `needs_review` is not a
    // column of anything — so it is taken BEFORE the delete instead. The seam
    // answers `void` here, so what this can prove is the half that matters: the
    // verb still works, and the row really goes. The crate's own
    // `tests/delete_transaction.rs` holds the answer's shape.
    const file = files.create('written');
    seed(file, fixture(), OWNER);
    const port = portFor(file);
    const id = await importOne(port);

    await expect(port.deleteTransaction(id)).resolves.toBeUndefined();

    expect(readBack(file).transactions).toEqual([]);
  });
});
