import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { rc4, sha1, decryptMny, MnyDecryptError } from './mnyDecrypt';
import { readMnyExport } from './mnyReader';
import { transformMsMoneyExport } from './transform';

describe('rc4', () => {
  // Canonical RC4 test vector (RFC 6229 / the classic "Key"/"Plaintext" case).
  it('matches the known "Key"/"Plaintext" vector', () => {
    const key = new TextEncoder().encode('Key');
    const plain = new TextEncoder().encode('Plaintext');
    const cipher = rc4(key, plain);
    expect(Buffer.from(cipher).toString('hex')).toBe('bbf316e8d940af0ad3');
    // symmetric: decrypting the cipher returns the plaintext
    expect(Buffer.from(rc4(key, cipher)).toString('utf8')).toBe('Plaintext');
  });
});

describe('sha1', () => {
  const hex = (u: Uint8Array) => Buffer.from(u).toString('hex');
  it('matches known digests (empty, "abc", 40 zero bytes)', () => {
    expect(hex(sha1(new Uint8Array(0)))).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
    expect(hex(sha1(new TextEncoder().encode('abc')))).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    // the exact input the decryptor hashes (empty-password digest)
    expect(hex(sha1(new Uint8Array(40)))).toBe('b80de5d138758541c5f05265ad144ab9fa86d1db');
  });
});

describe('decryptMny', () => {
  it('rejects a non-Money file with a clear message', async () => {
    const notMoney = new Uint8Array(8192); // zero-filled, no MSISAM signature
    expect(() => decryptMny(notMoney)).toThrow(MnyDecryptError);
    expect(() => decryptMny(notMoney)).toThrow(/Not a Microsoft Money file/);
  });

  it('rejects a file too small to be a database', () => {
    expect(() => decryptMny(new Uint8Array(16))).toThrow(/too small/);
  });
});

// Real-file verification (opt-in): set MNY_TEST_FILE to a real .mny path. The
// file holds real financial data so it is never committed — this mirrors the
// repo's gated real-infra test pattern (Supabase smoke).
const realFile = process.env.MNY_TEST_FILE;
describe.runIf(realFile && existsSync(realFile!))('readMnyExport (real .mny)', () => {
  it('decrypts + extracts the whole database and every split reconciles once transformed', async () => {
    const bytes = new Uint8Array(readFileSync(realFile!));
    const exp = readMnyExport(bytes);

    expect(exp.accounts.length).toBeGreaterThan(0);
    expect(exp.transactions.length).toBeGreaterThan(0);

    // hacctRel pairing survives extraction: at least one investment account is
    // linked to a cash account, and the transform nests the cash side.
    const byId = new Map(exp.accounts.map(a => [a.id, a]));
    const pairs = exp.accounts.filter(a =>
      a.moneyType === 'investment' && a.relatedAccountId != null && byId.has(a.relatedAccountId));
    expect(pairs.length).toBeGreaterThan(0);

    // Roles cover every transaction exactly once.
    const roles = exp.transactions.reduce<Record<string, number>>((m, t) => {
      m[t.role] = (m[t.role] ?? 0) + 1; return m;
    }, {});
    const total = Object.values(roles).reduce((a, b) => a + b, 0);
    expect(total).toBe(exp.transactions.length);

    // The transform must accept the extracted export and every split parent
    // must reconcile to its lines (the core money-safety invariant).
    const out = transformMsMoneyExport(exp, new Date('2020-01-01').toISOString());
    expect(out.summary.accounts.investmentCashPairs).toBeGreaterThan(0);
    const linesByTxn = new Map<string, number>();
    for (const s of out.transactionSplits) {
      linesByTxn.set(s.transactionId, Math.round(((linesByTxn.get(s.transactionId) ?? 0) + s.amount) * 100) / 100);
    }
    const parentAmount = new Map(out.transactions.map(t => [t.id, t.amount]));
    for (const [txnId, sum] of linesByTxn) {
      expect(sum).toBeCloseTo(parentAmount.get(txnId)!, 2);
    }
  });
});
