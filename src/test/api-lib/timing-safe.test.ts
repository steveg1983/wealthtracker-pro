import { describe, expect, it } from 'vitest';
// api/** is excluded from the vitest project (see vitest.config.ts), so the
// serverless helpers are exercised from here instead of going untested.
import { timingSafeStringEqual } from '../../../api/_lib/timing-safe';

describe('timingSafeStringEqual', () => {
  it('accepts identical secrets', () => {
    expect(timingSafeStringEqual('Bearer s3cret', 'Bearer s3cret')).toBe(true);
  });

  it('rejects a secret that differs only in the last character', () => {
    expect(timingSafeStringEqual('Bearer s3cret', 'Bearer s3crea')).toBe(false);
  });

  it('rejects a secret that differs only in the first character', () => {
    expect(timingSafeStringEqual('abcdef', 'zbcdef')).toBe(false);
  });

  it('rejects inputs of different lengths without throwing', () => {
    // Node's timingSafeEqual throws on unequal buffer lengths; hashing first is
    // what keeps this a plain false instead of a 500.
    expect(() => timingSafeStringEqual('short', 'a much longer secret')).not.toThrow();
    expect(timingSafeStringEqual('short', 'a much longer secret')).toBe(false);
  });

  it('rejects a prefix of the real secret', () => {
    expect(timingSafeStringEqual('Bearer s3cre', 'Bearer s3cret')).toBe(false);
  });

  it('rejects an empty candidate against a real secret', () => {
    expect(timingSafeStringEqual('', 'Bearer s3cret')).toBe(false);
  });

  it('treats two empty strings as equal', () => {
    // Callers must not rely on this for fail-closed behaviour: they guarantee a
    // non-empty secret via getRequiredEnv before comparing.
    expect(timingSafeStringEqual('', '')).toBe(true);
  });

  it('compares bytes, not rendered glyphs', () => {
    // Precomposed é vs e + combining acute: identical on screen, different
    // on the wire, so this must not match.
    expect(timingSafeStringEqual('caf\u00e9', 'cafe\u0301')).toBe(false);
  });

  it('handles the full Bearer-header shape used by the cron routes', () => {
    const secret = 'a'.repeat(64);
    expect(timingSafeStringEqual(`Bearer ${secret}`, `Bearer ${secret}`)).toBe(true);
    expect(timingSafeStringEqual(`Bearer ${secret}`, `Bearer ${'a'.repeat(63)}b`)).toBe(false);
    // A bare secret without the scheme must not authenticate.
    expect(timingSafeStringEqual(secret, `Bearer ${secret}`)).toBe(false);
  });
});
