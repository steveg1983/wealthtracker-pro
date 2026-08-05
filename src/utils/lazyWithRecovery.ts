import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import { isChunkLoadError } from './chunkLoadError';

/**
 * Every deploy replaces the hashed chunk filenames on the CDN, but a tab that
 * was already open keeps the index it booted with. Its next lazy import asks
 * for a file that no longer exists and fails ("Importing a module script
 * failed" in Safari, worded differently elsewhere), and the error boundary
 * takes over the page. One automatic reload fetches the fresh index and the tab
 * is healthy again — that is what this does, for route chunks and for the
 * modals, lists and reports the routes load in turn.
 *
 * The guard is a TIMESTAMP, and a successful import deliberately does NOT clear
 * it. Clearing on success looks tidier but loops: after the reload the route
 * chunk loads fine and clears the guard, so a chunk that is genuinely
 * unfetchable (a half-published deploy, a blocked asset, a partly-cached app
 * with no network) would fail → reload → clear → fail → reload for as long as
 * the tab is open. Time-boxing instead caps recovery at one reload per tab per
 * minute: ample for the stale-index case, where the retry happens seconds after
 * boot, and incapable of looping.
 */
const RELOAD_GUARD_KEY = 'chunk_reload_guard';
const RELOAD_COOLDOWN_MS = 60_000;

export interface ChunkRecoveryEnvironment {
  now: () => number;
  readGuard: () => string | null;
  /** Returns false when the guard could not be persisted — see the browser implementation. */
  writeGuard: (value: string) => boolean;
  isOnline: () => boolean;
  reload: () => void;
}

const browserEnvironment: ChunkRecoveryEnvironment = {
  now: () => Date.now(),
  readGuard: () => {
    try {
      return window.sessionStorage.getItem(RELOAD_GUARD_KEY);
    } catch {
      return null;
    }
  },
  writeGuard: (value: string) => {
    // Locked-down storage settings make setItem throw. Without a guard an
    // automatic reload could loop, so a failed write means "do not reload" and
    // the user gets the boundary's Reload button instead.
    try {
      window.sessionStorage.setItem(RELOAD_GUARD_KEY, value);
      return true;
    } catch {
      return false;
    }
  },
  isOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false),
  reload: () => window.location.reload(),
};

export interface ChunkRecoveryOptions {
  /**
   * Set false where reloading would throw away work the user cannot get back.
   * The import then rejects normally, so the call site must show its own
   * recovery — an unhandled rejection here costs the user the whole page.
   */
  autoReload?: boolean;
  environment?: ChunkRecoveryEnvironment;
}

function claimReloadAttempt(environment: ChunkRecoveryEnvironment): boolean {
  const stored = environment.readGuard();
  const lastAttemptAt = stored === null ? Number.NaN : Number.parseInt(stored, 10);

  if (Number.isFinite(lastAttemptAt)) {
    const elapsed = environment.now() - lastAttemptAt;
    // A negative elapsed means the clock moved backwards; treat that as expired
    // rather than locking recovery out until the clock catches up.
    if (elapsed >= 0 && elapsed < RELOAD_COOLDOWN_MS) {
      return false;
    }
  }

  return environment.writeGuard(String(environment.now()));
}

/**
 * Wraps a whole import expression — including any `.then()` that picks a named
 * export — so a failure in either link is recovered.
 */
export function importWithChunkRecovery<T>(
  load: () => Promise<T>,
  options: ChunkRecoveryOptions = {}
): Promise<T> {
  const { autoReload = true, environment = browserEnvironment } = options;

  return load().catch((error: unknown) => {
    // Offline, a reload replaces a running app with the browser's error page,
    // so it makes things worse rather than better.
    const recoverable = autoReload && isChunkLoadError(error) && environment.isOnline();

    if (!recoverable || !claimReloadAttempt(environment)) {
      throw error;
    }

    environment.reload();
    // The document is on its way out. Never settling keeps a half-built page —
    // or a flash of the error boundary — off the screen while it goes.
    return new Promise<T>(() => {});
  });
}

/**
 * `React.lazy` with stale-chunk recovery. Use this for every lazily loaded
 * component; use `lazyWithPreload` when the component also needs preloading.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRecovery<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  options?: ChunkRecoveryOptions
): LazyExoticComponent<T> {
  return lazy(() => importWithChunkRecovery(factory, options));
}
