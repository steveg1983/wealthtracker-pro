import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Constant-time comparison for shared secrets and signatures.
 *
 * `===` on strings short-circuits at the first differing byte, so an attacker
 * who can time responses can recover a secret one character at a time. Node's
 * timingSafeEqual is the fix, but it THROWS when the two buffers differ in
 * length — and guarding that with a plain length check would itself leak the
 * secret's length. Hashing both sides first sidesteps both problems: SHA-256
 * digests are always 32 bytes, so the comparison never throws and reveals
 * nothing about the length of either input.
 */
export const timingSafeStringEqual = (a: string, b: string): boolean => {
  const digestA = createHash('sha256').update(a, 'utf8').digest();
  const digestB = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(digestA, digestB);
};
