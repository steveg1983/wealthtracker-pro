import { describe, it, expect } from 'vitest';
import { applyStrandedFinding, repairClaimedTwin } from './strandedTransferActions';
import type { StrandedActionOperations } from './strandedTransferActions';
import type { ClaimedTwinFinding, StrandedFinding } from './strandedTransfers';
import type { Transaction } from '../types';

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: new Date('2026-05-01'),
  amount: -200,
  description: 'Transfer (Online)',
  category: '',
  accountId: 'acc-a',
  type: 'expense',
  ...over,
});

const ADJUSTMENT = 'revaluation-adjustment';

type Call = [string, ...unknown[]];

/**
 * A recording stand-in for the four write operations, with a per-operation
 * failure switch — every one of them reaches the database, so "what does the
 * caller see when the database refuses?" is part of each action's contract.
 */
function recorder(fail: Partial<Record<'link' | 'update' | 'archive' | 'repair', string>> = {}): {
  calls: Call[];
  ops: StrandedActionOperations;
} {
  const calls: Call[] = [];
  const ops: StrandedActionOperations = {
    linkTransferPair: async (idA, idB) => {
      calls.push(['link', idA, idB]);
      if (fail.link) throw new Error(fail.link);
    },
    updateTransaction: async (id, updates) => {
      calls.push(['update', id, updates]);
      if (fail.update) throw new Error(fail.update);
    },
    setTransactionArchived: async (id, archived) => {
      calls.push(['archive', id, archived]);
      if (fail.archive) throw new Error(fail.archive);
    },
    repairClaimedTransfer: async (strandedId, counterpartId, partnerId, categoryId) => {
      calls.push(['repair', strandedId, counterpartId, partnerId, categoryId]);
      if (fail.repair) throw new Error(fail.repair);
    },
  };
  return { calls, ops };
}

const claimedFinding = (over: Partial<ClaimedTwinFinding> = {}): ClaimedTwinFinding => ({
  kind: 'claimed',
  row: txn({ id: 'stranded', amount: 200, accountId: 'acc-joint', type: 'income' }),
  counterpart: txn({ id: 'counterpart', amount: -200, accountId: 'acc-current', type: 'transfer', category: 'transfer-cat', transferAccountId: 'acc-credit', linkedTransferId: 'partner' }),
  currentPartner: txn({ id: 'partner', amount: 200, accountId: 'acc-credit', type: 'transfer', category: 'transfer-cat', transferAccountId: 'acc-current', linkedTransferId: 'counterpart', date: new Date('2026-05-05') }),
  daysApart: 0,
  partnerDaysApart: 4,
  descriptionScore: 60,
  wonOnDescription: false,
  ...over,
});

describe('applyStrandedFinding — archive a duplicate', () => {
  it('soft-archives the spare copy and never deletes anything', async () => {
    const { calls, ops } = recorder();
    const finding: StrandedFinding = {
      kind: 'duplicate',
      row: txn({ id: 'stranded' }),
      duplicateOf: txn({ id: 'linked-copy', type: 'transfer' }),
      descriptionScore: 100,
    };
    await applyStrandedFinding(finding, ADJUSTMENT, ops);
    expect(calls).toEqual([['archive', 'stranded', true]]);
  });
});

describe('applyStrandedFinding — accept a categorised twin', () => {
  it('links both sides in ONE atomic call (the link RPC replaces the category)', async () => {
    const { calls, ops } = recorder();
    const finding: StrandedFinding = {
      kind: 'categorised',
      row: txn({ id: 'stranded' }),
      counterpart: txn({ id: 'twin', amount: 200, accountId: 'acc-b', type: 'income', category: 'cat-dental' }),
      counterpartCategoryName: 'Dental',
      daysApart: 1,
      descriptionScore: 20,
    };
    await applyStrandedFinding(finding, ADJUSTMENT, ops);
    expect(calls).toEqual([['link', 'stranded', 'twin']]);
  });
});

describe('applyStrandedFinding — file as Account Adjustment', () => {
  it('sets only the category on an ordinary income/expense row', async () => {
    const { calls, ops } = recorder();
    await applyStrandedFinding(
      { kind: 'one-sided', row: txn({ id: 'lonely' }) },
      ADJUSTMENT,
      ops
    );
    expect(calls).toEqual([['update', 'lonely', { category: ADJUSTMENT }]]);
  });

  it('re-types by SIGN and drops the target account when the row was a transfer', async () => {
    const { calls, ops } = recorder();
    await applyStrandedFinding(
      {
        kind: 'one-sided',
        row: txn({ id: 'lonely', amount: 200, type: 'transfer', transferAccountId: 'acc-b' }),
      },
      ADJUSTMENT,
      ops
    );
    expect(calls).toEqual([
      ['update', 'lonely', { category: ADJUSTMENT, type: 'income', transferAccountId: '' }],
    ]);
  });

  it('refuses — loudly — when the user has no adjustment category', async () => {
    const { calls, ops } = recorder();
    await expect(
      applyStrandedFinding({ kind: 'one-sided', row: txn({ id: 'lonely' }) }, null, ops)
    ).rejects.toThrow(/Account Adjustment/);
    expect(calls).toEqual([]);
  });
});

describe('repairClaimedTwin — one atomic call', () => {
  it('names the three rows and the filing category, in ONE call', async () => {
    const { calls, ops } = recorder();
    await repairClaimedTwin(claimedFinding(), ADJUSTMENT, ops);
    // The unlink, the filing of the displaced row and the re-link all happen
    // inside repair_claimed_transfer's single database transaction — the whole
    // point of the RPC, and why no compensation exists here any more.
    expect(calls).toEqual([['repair', 'stranded', 'counterpart', 'partner', ADJUSTMENT]]);
  });

  it('routes through applyStrandedFinding the same way', async () => {
    const { calls, ops } = recorder();
    await applyStrandedFinding(claimedFinding(), ADJUSTMENT, ops);
    expect(calls).toEqual([['repair', 'stranded', 'counterpart', 'partner', ADJUSTMENT]]);
  });

  it('never runs at all without an adjustment category — no half-done re-pair', async () => {
    const { calls, ops } = recorder();
    await expect(applyStrandedFinding(claimedFinding(), null, ops)).rejects.toThrow(/Account Adjustment/);
    expect(calls).toEqual([]);
  });

  it('surfaces the database refusal verbatim, with nothing else attempted', async () => {
    // The RPC validates against the rows as they are NOW, so a stale list is
    // refused rather than acted on — and because it is one transaction, the
    // message never has to describe a partial state.
    const { calls, ops } = recorder({ repair: 'transfer_pair_not_linked' });
    await expect(repairClaimedTwin(claimedFinding(), ADJUSTMENT, ops))
      .rejects.toThrow('transfer_pair_not_linked');
    expect(calls).toEqual([['repair', 'stranded', 'counterpart', 'partner', ADJUSTMENT]]);
  });
});
