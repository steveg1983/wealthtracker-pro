/**
 * Where `invoke` comes from, and the only thing in this program that knows.
 *
 * `window.__TAURI__`, put there by `withGlobalTauri` in `tauri.conf.json`, and
 * NOT from `@tauri-apps/api`. Installing that package would mean Vercel's build
 * container fetching a desktop dependency on every deploy of the web app — the
 * objection `crates/Cargo.toml` makes about Rust, one ecosystem along.
 *
 * The global is read through a guard rather than a cast, because a renderer that
 * assumed it was there would fail with `undefined is not a function` in a window
 * with no console open. The guard's other job is the browser case: this bundle
 * can be opened by an ordinary browser — it is a directory of files — and the
 * honest answer there is a sentence, not silence.
 */

import type { Invoke } from '../services/local/coreTransport';

/**
 * The shell's `invoke`, or `null` when this page is not running inside the app.
 *
 * A function rather than a constant because it reads the window, and a module
 * that read the window at import time would answer for whichever moment it
 * happened to be imported in.
 */
export const tauriInvoke = (): Invoke | null => {
  const candidate = (window as unknown as { __TAURI__?: unknown }).__TAURI__;
  if (typeof candidate !== 'object' || candidate === null) return null;
  const core = (candidate as { core?: unknown }).core;
  if (typeof core !== 'object' || core === null) return null;
  const invoke = (core as { invoke?: unknown }).invoke;
  return typeof invoke === 'function' ? (invoke as Invoke) : null;
};
