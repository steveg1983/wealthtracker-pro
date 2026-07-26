/**
 * Page tips — the small dismissible panels that explain a page in a sentence.
 *
 * A dismissal is written to localStorage and never expires, which is exactly
 * how a tip's copy was able to go stale for months without anyone noticing:
 * the only people who could have spotted it had already made it invisible.
 * Two things keep that honest — the id convention documented in PageTip, and
 * the reset below, offered as a preference in Settings.
 */

/** Every dismissal is stored as `<prefix><tip id>` = 'true'. */
export const PAGE_TIP_KEY_PREFIX = 'pageTipDismissed_';

/** The storage key for one tip. */
export function pageTipStorageKey(id: string): string {
  return `${PAGE_TIP_KEY_PREFIX}${id}`;
}

/**
 * Forget every dismissal, so all tips show again.
 *
 * Returns how many were actually forgotten, so the caller can tell the user
 * what changed rather than claiming success over a no-op.
 */
export function resetDismissedPageTips(): number {
  try {
    // Collect first, then delete: removing while iterating by index shifts
    // the remaining keys and silently skips half of them.
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null && key.startsWith(PAGE_TIP_KEY_PREFIX)) {
        keys.push(key);
      }
    }
    keys.forEach(key => localStorage.removeItem(key));
    return keys.length;
  } catch {
    // Private browsing can refuse storage entirely; nothing was dismissed
    // there either, so nothing needs bringing back.
    return 0;
  }
}
