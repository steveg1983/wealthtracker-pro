/**
 * Transfer evidence — "has this wording, in this account, always been a transfer?"
 *
 * The categoriser never learns transfers, so on a swept account the three
 * rows once filed as "Account Adjustment" outvoted the two hundred and
 * fifty-eight linked sweeps. This is the tally that lets the ledger's own
 * history answer instead, and these specs pin what counts, what does not,
 * and where the bar sits.
 */

import { describe, it, expect } from 'vitest';
import {
  buildTransferEvidenceIndex,
  transferEvidenceFor,
  transferEvidenceWording,
  TRANSFER_EVIDENCE_MIN_TRANSFERS,
  type TransferEvidenceRow,
} from './transferEvidence';
import type { Category } from '../types';

const categories: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type' },
  { id: 'adjust', name: 'Account Adjustment', type: 'expense', level: 'detail', parentId: 'type-expense' },
  // An account-managed To/From category: a transfer filing that NAMES its account.
  { id: 'tofrom-reserve', name: 'To/From Reserve', type: 'transfer', level: 'sub', isTransferCategory: true, accountId: 'reserve' },
  // The legacy sentinel: says "transfer", names no account.
  { id: 'transfer-in', name: 'Transfer In', type: 'transfer', level: 'sub' },
];

const SWEEP = 'Two Way Sweep from account 00001234';

/** A linked sweep into `current` from `reserve`, as the Money import left them. */
function sweep(overrides: Partial<TransferEvidenceRow> = {}): TransferEvidenceRow {
  return {
    accountId: 'current',
    description: SWEEP,
    type: 'transfer',
    category: 'tofrom-reserve',
    categoryConfirmed: true,
    transferAccountId: 'reserve',
    ...overrides,
  };
}

/** The same wording filed, deliberately, as something else. */
function adjustment(overrides: Partial<TransferEvidenceRow> = {}): TransferEvidenceRow {
  return {
    accountId: 'current',
    description: SWEEP,
    type: 'income',
    category: 'adjust',
    categoryConfirmed: true,
    ...overrides,
  };
}

/** A new sweep, as an import or the register sees it: no category yet. */
const fresh: TransferEvidenceRow = {
  accountId: 'current',
  description: SWEEP,
  type: 'income',
  category: '',
  categoryConfirmed: true,
};

function sweeps(count: number, overrides: Partial<TransferEvidenceRow> = {}): TransferEvidenceRow[] {
  return Array.from({ length: count }, () => sweep(overrides));
}

describe('transferEvidenceWording — a very near match, not a payee key', () => {
  it('forgives case, punctuation and spacing', () => {
    expect(transferEvidenceWording('Two Way  Sweep from account 00001234'))
      .toBe(transferEvidenceWording('TWO-WAY SWEEP FROM ACCOUNT 00001234.'));
  });

  it('keeps the digits — they name the other side', () => {
    expect(transferEvidenceWording('Sweep from account 00001234'))
      .not.toBe(transferEvidenceWording('Sweep from account 00005678'));
  });
});

describe('transferEvidenceFor — the proposal', () => {
  it('proposes the account the wording has overwhelmingly moved money to', () => {
    const history = [...sweeps(6), adjustment()];

    expect(transferEvidenceFor(history, categories, fresh)).toEqual({
      targetAccountId: 'reserve',
      transfers: 6,
      otherwise: 1,
    });
  });

  it('resolves the target from the To/From category when the row carries no account', () => {
    const history = sweeps(3, { transferAccountId: undefined });

    expect(transferEvidenceFor(history, categories, fresh)?.targetAccountId).toBe('reserve');
  });

  it(`needs at least ${TRANSFER_EVIDENCE_MIN_TRANSFERS} transfers — two sweeps are a coincidence`, () => {
    expect(transferEvidenceFor(sweeps(TRANSFER_EVIDENCE_MIN_TRANSFERS - 1), categories, fresh)).toBeNull();
    expect(transferEvidenceFor(sweeps(TRANSFER_EVIDENCE_MIN_TRANSFERS), categories, fresh)).not.toBeNull();
  });

  it('stays silent when the wording is genuinely split — four in five must agree', () => {
    // 3 transfers against 1 adjustment is 75%: below the bar.
    expect(transferEvidenceFor([...sweeps(3), adjustment()], categories, fresh)).toBeNull();
    // 4 against 1 is 80%: at it.
    expect(transferEvidenceFor([...sweeps(4), adjustment()], categories, fresh)).not.toBeNull();
  });

  it('does not let the app’s own unconfirmed guesses vote against the transfers', () => {
    // Five rows the categoriser guessed as "Account Adjustment" and nobody
    // agreed with — exactly the rows the owner found in To Review. They are
    // the mistake being corrected, not evidence for it.
    const guesses = Array.from({ length: 5 }, () => adjustment({ categoryConfirmed: false }));

    expect(transferEvidenceFor([...sweeps(3), ...guesses], categories, fresh)).toEqual({
      targetAccountId: 'reserve',
      transfers: 3,
      otherwise: 0,
    });
  });

  it('counts a split row as filed otherwise', () => {
    const split = adjustment({ category: '', isSplit: true });

    expect(transferEvidenceFor([...sweeps(3), split], categories, fresh)).toBeNull();
  });

  it('counts transfers to a DIFFERENT account against the proposal', () => {
    // One account is the habit or none is: 3 to the reserve against 2 to an
    // ISA is 60%.
    const history = [...sweeps(3), ...sweeps(2, { transferAccountId: 'isa', category: '' })];

    expect(transferEvidenceFor(history, categories, fresh)).toBeNull();
  });

  it('ignores a transfer whose target cannot be named', () => {
    // The legacy sentinel says "transfer" but no account can be proposed from it.
    const sentinels = sweeps(5, { transferAccountId: undefined, category: 'transfer-in' });

    expect(transferEvidenceFor(sentinels, categories, fresh)).toBeNull();
    // …and it does not count against real evidence either.
    expect(transferEvidenceFor([...sentinels, ...sweeps(3)], categories, fresh)?.transfers).toBe(3);
  });

  it('ignores a transfer to the row’s own account', () => {
    const orphans = sweeps(5, { transferAccountId: 'current', category: '' });

    expect(transferEvidenceFor(orphans, categories, fresh)).toBeNull();
  });

  it('is keyed by ACCOUNT — the same sentence in the reserve is a different movement', () => {
    const history = [...sweeps(6), adjustment()];
    const inReserve = { ...fresh, accountId: 'reserve' };

    expect(transferEvidenceFor(history, categories, inReserve)).toBeNull();
  });

  it('never answers for a row the user has already answered', () => {
    const history = sweeps(6);

    expect(transferEvidenceFor(history, categories, { ...fresh, type: 'transfer' })).toBeNull();
    expect(transferEvidenceFor(history, categories, { ...fresh, isSplit: true })).toBeNull();
    expect(transferEvidenceFor(history, categories, { ...fresh, category: 'adjust', categoryConfirmed: true })).toBeNull();
  });

  it('DOES answer for a row carrying only the app’s guess', () => {
    const guessed = { ...fresh, category: 'adjust', categoryConfirmed: false };

    expect(transferEvidenceFor(sweeps(6), categories, guessed)?.targetAccountId).toBe('reserve');
  });

  it('matches the wording very nearly, not exactly', () => {
    const history = sweeps(3, { description: 'TWO WAY SWEEP FROM ACCOUNT 00001234' });

    expect(transferEvidenceFor(history, categories, fresh)?.targetAccountId).toBe('reserve');
    expect(transferEvidenceFor(history, categories, { ...fresh, description: 'Two Way Sweep from account 00005678' })).toBeNull();
  });

  it('says nothing for a blank description', () => {
    const blanks = sweeps(5, { description: '' });

    expect(transferEvidenceFor(blanks, categories, { ...fresh, description: '' })).toBeNull();
    expect(transferEvidenceFor(blanks, categories, { ...fresh, description: '---' })).toBeNull();
  });
});

describe('buildTransferEvidenceIndex — the same answers, tallied once', () => {
  it('agrees with transferEvidenceFor row for row', () => {
    const history = [
      ...sweeps(6),
      adjustment(),
      ...sweeps(4, { accountId: 'reserve', description: 'Two Way Sweep to account 00005678', transferAccountId: 'current', category: '' }),
      ...sweeps(2, { description: 'Immediate faster payment', category: '' }),
    ];
    const index = buildTransferEvidenceIndex(history, categories);
    const asked: TransferEvidenceRow[] = [
      fresh,
      { ...fresh, accountId: 'reserve', description: 'two way sweep to account 00005678' },
      { ...fresh, description: 'Immediate faster payment' },
      { ...fresh, type: 'transfer' },
    ];

    for (const row of asked) {
      expect(index.lookup(row)).toEqual(transferEvidenceFor(history, categories, row));
    }
    expect(index.lookup(asked[0])?.targetAccountId).toBe('reserve');
    expect(index.lookup(asked[1])?.targetAccountId).toBe('current');
    expect(index.lookup(asked[2])).toBeNull();
  });

  it('breaks a tie between targets by id, so two runs propose the same account', () => {
    const history = [...sweeps(3), ...sweeps(3, { transferAccountId: 'annex', category: '' })];
    // 3 against 3 is 50%: no proposal at all, and the tie-break is only ever
    // reached on the way to that answer — but the answer must be the same one
    // twice.
    const a = buildTransferEvidenceIndex(history, categories).lookup(fresh);
    const b = buildTransferEvidenceIndex([...history].reverse(), categories).lookup(fresh);
    expect(a).toEqual(b);
    expect(a).toBeNull();
  });
});
