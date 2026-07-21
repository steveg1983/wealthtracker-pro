/**
 * Minimal Node-global shims for the browser, for the .mny reader path only.
 *
 * mdb-reader's browser build pulls in create-hash → cipher-base →
 * readable-stream, which reference the Node globals `Buffer` and `process` at
 * module-evaluation time. The browser has neither. This module installs tiny
 * shims and MUST be imported before mdb-reader so the globals exist when its
 * dependency subtree evaluates.
 *
 * Scoped to the lazily-loaded import feature — it never runs in the main
 * bundle, and it only fills gaps (real Node/Buffer are left untouched).
 */
import { Buffer as BufferPolyfill } from 'buffer';

// A deliberately loose structural view of globalThis: the real types
// (@types/node) declare `process` as the full Node Process, which our minimal
// shim can't satisfy. Treating the two slots as `unknown` lets us fill only
// the gaps without a double-cast or `any`.
const g: { Buffer?: unknown; process?: unknown } = globalThis;

if (typeof g.Buffer === 'undefined') {
  g.Buffer = BufferPolyfill;
}

if (typeof g.process === 'undefined') {
  // Just enough of `process` for readable-stream / cipher-base to evaluate.
  g.process = {
    env: {},
    browser: true,
    nextTick: (cb: (...args: unknown[]) => void, ...args: unknown[]) => {
      queueMicrotask(() => cb(...args));
    },
    version: '',
    versions: {},
  };
}
