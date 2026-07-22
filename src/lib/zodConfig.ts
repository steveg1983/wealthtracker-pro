import { z } from 'zod';

/**
 * Zod v4 probes for `new Function("")` on first use, to decide whether it can
 * JIT-compile object validators. Our CSP forbids eval, so the probe throws,
 * zod catches it and falls back to the interpreted path — correct, but it
 * spends a CSP violation (a red console error, and a Sentry report) on every
 * load to learn something the policy already decided.
 *
 * `jitless` short-circuits that: `jit && allowsEval.value` never evaluates the
 * cached probe, so the eval never happens. Runtime behaviour is unchanged —
 * the JIT path was already unreachable under the policy — we simply stop
 * asking.
 *
 * MUST be imported before any module that creates a schema: zod reads this
 * config when a schema's parser is built, which happens at module scope in
 * several services.
 */
z.config({ jitless: true });
