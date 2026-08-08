/**
 * The account register's keyboard: one rule, one key map, one place.
 *
 * ─ THE RULE ──────────────────────────────────────────────────────────────
 *   A bare letter or digit is ALWAYS type-ahead. It is never a command.
 *
 * Everything else follows from that. Commands live on a modifier (Ctrl/Cmd),
 * on a function key (F2), or on a key that types nothing at all — Space,
 * Enter, Escape, Delete, the arrows, Home/End, `+`, `?`. Nothing in the
 * register is bound to a bare letter, so no command can fire while someone is
 * typing a payee's name into the list, and no letter can be swallowed by a
 * command they never meant to press.
 *
 * ─ WHY SOME OBVIOUS KEYS ARE NOT HERE ────────────────────────────────────
 * Browsers keep some combinations for themselves and will not let a page have
 * them, whatever the page does with preventDefault. Ctrl/Cmd+N (new window),
 * Ctrl/Cmd+T (new tab) and Ctrl/Cmd+W (close) are reserved in Chrome, Firefox
 * and Safari alike — a page that "binds" one of them ships a shortcut that
 * does nothing, or worse, closes the window with the user's typing in it. So
 * "start a new transaction" is `+`, not Ctrl/Cmd+N, and "jump to the other
 * side of a transfer" is Ctrl/Cmd+Enter (free everywhere) rather than
 * Ctrl/Cmd+G, which Safari keeps for Find Again.
 *
 * The three modifier combinations that ARE used — Ctrl/Cmd+D, Ctrl/Cmd+F and
 * Ctrl/Cmd+Enter — are ones every major browser hands over. Two of them
 * (D and F) are on Safari's own short list of shortcuts a web app may take.
 *
 * ─ AND WHY THE REGISTER STOPS PROPAGATION ────────────────────────────────
 * The app carries a window-level shortcut listener (see useKeyboardShortcuts):
 * a bare `g` or `n` there starts a two-key "go to…" sequence, and `?` opens
 * the app-wide shortcut list. Type-ahead would set that off constantly —
 * typing "gr" to find Greggs would navigate to Reports mid-word. So every key
 * the register claims is stopped at the register, INCLUDING a letter that
 * matched nothing: a mistyped letter must not fall through and take the user
 * off the page they are working on.
 */

/** How long a type-ahead search stays open before the next letter starts a new one. */
export const TYPE_AHEAD_RESET_MS = 800;

/** The bit of a keyboard event this module needs. Keeps the helpers testable. */
export interface ModifierState {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

/**
 * Is this keypress a letter or digit typed with no modifier held — i.e. one
 * for the type-ahead search?
 *
 * `key.length === 1` excludes every named key ('Enter', 'ArrowDown', 'F2'),
 * and the Unicode classes accept accented letters and non-Latin scripts, so a
 * register of French or Greek payees is searchable too. Space is not here —
 * it has a rule of its own; see claimsSpaceForTypeAhead.
 */
export function isTypeAheadKey(event: ModifierState): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (event.key.length !== 1) return false;
  return /[\p{L}\p{N}]/u.test(event.key);
}

/**
 * Does the space bar belong to the search in progress, rather than to
 * Reconcile?
 *
 * The one place the register's two bare-key jobs actually collide. Space
 * reconciles the highlighted row; but most payees are two words, and someone
 * typing "sandpiper f…" reaches the space having typed only "sandpiper" — at
 * which point the register would tick the R column on whatever row that had
 * landed on. A WRITE to the ledger, out of a search nobody had finished.
 *
 * So: while a search is LIVE — something typed, and typed recently — the space
 * bar is part of it. With no search running it reconciles as it always does.
 *
 * That way round on purpose. Getting it wrong here means a search takes a
 * space it should not have, and nothing at all happens until the search times
 * out and the next Space reconciles — annoying, and undone by waiting a
 * moment. Getting it wrong the other way means reconciling a transaction the
 * user never chose, in the middle of typing. Only one of those two mistakes
 * touches the data.
 */
export function claimsSpaceForTypeAhead(buffer: string, elapsedMs: number): boolean {
  return buffer.length > 0 && elapsedMs < TYPE_AHEAD_RESET_MS;
}

/**
 * The search string after this keystroke.
 *
 * A pause longer than TYPE_AHEAD_RESET_MS starts a fresh search — otherwise
 * yesterday's letters would still be narrowing today's, and the list would
 * refuse to move for no visible reason.
 */
export function advanceTypeAheadBuffer(
  previous: string,
  key: string,
  elapsedMs: number
): string {
  if (elapsedMs >= TYPE_AHEAD_RESET_MS) return key.toLowerCase();
  return previous + key.toLowerCase();
}

/** The one thing type-ahead needs off a row. */
export interface TypeAheadRow {
  description: string;
}

/**
 * The row to jump to for `buffer`, or -1 when nothing matches.
 *
 * Two behaviours, both the long-standing list convention:
 *
 *  - ONE letter (or the same letter repeatedly — "sss") CYCLES: each press
 *    moves to the next row starting with it, so a held-down `s` walks the
 *    Sainsbury's, then the Shell, then the Spotify.
 *  - Several DIFFERENT letters NARROW: "sai" starts its search at the current
 *    row, so adding a letter to a search that already landed somewhere keeps
 *    you there instead of skipping to the next Sainsbury's.
 *
 * Both wrap, because a search that stops dead at the bottom of a register
 * looks broken to anyone who started halfway down it.
 */
export function findTypeAheadMatch(
  rows: readonly TypeAheadRow[],
  buffer: string,
  currentIndex: number
): number {
  if (rows.length === 0 || buffer.length === 0) return -1;

  const cycling = buffer.split('').every(char => char === buffer[0]);
  const needle = cycling ? buffer[0] : buffer;
  // Cycling starts at the row AFTER the current one; narrowing includes it.
  const start = cycling ? currentIndex + 1 : Math.max(currentIndex, 0);

  for (let step = 0; step < rows.length; step += 1) {
    // The modulo makes the scan wrap; the second modulo keeps a negative
    // start (nothing highlighted yet, currentIndex === -1) inside the array.
    const index = (((start + step) % rows.length) + rows.length) % rows.length;
    if (rows[index].description.trim().toLowerCase().startsWith(needle)) {
      return index;
    }
  }
  return -1;
}

/**
 * Does this machine label the modifier ⌘ or Ctrl?
 *
 * Only ever used for what is PRINTED. The handlers accept ctrlKey or metaKey
 * either way, so a Mac user with an external PC keyboard, or a Windows user on
 * a Mac keyboard, is never told the wrong key and never left without one.
 */
export function isAppleKeyboard(
  userAgent: string = typeof navigator === 'undefined' ? '' : navigator.userAgent
): boolean {
  return /Mac|iPhone|iPad|iPod/.test(userAgent);
}

/** One line of the shortcut list. */
export interface RegisterShortcut {
  /**
   * The keys to press, in order. The token 'Mod' is printed as ⌘ or Ctrl
   * depending on the keyboard — see isAppleKeyboard.
   */
  keys: readonly string[];
  /** A second way to do the same thing, printed after "or". */
  alsoKeys?: readonly string[];
  /** What happens — the consequence, in the app's own voice. */
  what: string;
}

/** A headed block of the shortcut list. */
export interface RegisterShortcutGroup {
  title: string;
  shortcuts: readonly RegisterShortcut[];
}

/**
 * THE key map. The dialog renders this and nothing else, so the list the user
 * reads cannot drift from the list the register answers to.
 */
export const REGISTER_SHORTCUT_GROUPS: readonly RegisterShortcutGroup[] = [
  {
    title: 'Moving down the register',
    shortcuts: [
      { keys: ['↑'], alsoKeys: ['↓'], what: 'Move the highlight one row.' },
      { keys: ['Page Up'], alsoKeys: ['Page Down'], what: 'Move it a screenful at a time.' },
      { keys: ['Home'], alsoKeys: ['End'], what: 'Jump to the first or the last transaction.' },
      {
        keys: ['a', 'b', 'c', '…'],
        what: 'Type a few letters to jump to the next transaction whose description starts with them. Keep pressing one letter to walk through every payee beginning with it.',
      },
      { keys: ['Esc'], what: 'Clear the highlight, and put the add bar back at the bottom.' },
    ],
  },
  {
    title: 'The highlighted transaction',
    shortcuts: [
      { keys: ['Enter'], what: 'Open it in the full editor.' },
      { keys: ['F2'], what: 'Jump down into the quick edit bar. Esc brings you back to the list.' },
      {
        keys: ['Space'],
        what: 'Reconcile it, or un-reconcile it if it already is — the same tick the R column shows. Mid-way through typing a payee it types a space instead, so two-word names still find their row.',
      },
      { keys: ['Delete'], alsoKeys: ['Backspace'], what: 'Delete it, after a confirmation that says what will be left behind.' },
      {
        keys: ['Mod', 'Enter'],
        what: 'Open the other half of a transfer, in the account it faces. Nothing happens on a row that is not a transfer.',
      },
      {
        keys: ['Mod', 'D'],
        what: "Copy it into the add bar as a new transaction dated today — nothing is saved until you press Add.",
      },
    ],
  },
  {
    title: 'Several transactions at once',
    shortcuts: [
      {
        keys: ['Shift', '↑'],
        alsoKeys: ['Shift', '↓'],
        what: 'Stretch the highlight over the rows in between. Shift with Page Up/Down or Home/End takes bigger bites.',
      },
      {
        keys: ['Space'],
        what: 'Reconcile every selected row — or un-reconcile them, when they are all reconciled already.',
      },
      {
        keys: ['Delete'],
        what: 'Delete them, after a confirmation that names every row that would leave half a transfer behind, and every row it is refusing to touch.',
      },
      { keys: ['Esc'], what: 'Drop back to a single highlighted row. A second Esc clears that too.' },
    ],
  },
  {
    title: 'The rest of the page',
    shortcuts: [
      { keys: ['+'], what: 'Start a new transaction — the cursor lands in the Date box of the add bar.' },
      { keys: ['Mod', 'F'], what: 'Open Search & filters with the cursor already in the search box.' },
      { keys: ['?'], what: 'Show this list.' },
    ],
  },
];

/**
 * The keys as they should be PRINTED on this machine.
 *
 * Only 'Mod' changes; every other token is already what the key top says.
 */
export function printableKeys(keys: readonly string[], apple: boolean): string[] {
  return keys.map(key => (key === 'Mod' ? (apple ? '⌘' : 'Ctrl') : key));
}
