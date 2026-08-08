import { describe, it, expect } from 'vitest';
import {
  TYPE_AHEAD_RESET_MS,
  advanceTypeAheadBuffer,
  claimsSpaceForTypeAhead,
  findTypeAheadMatch,
  isAppleKeyboard,
  isTypeAheadKey,
  printableKeys,
  REGISTER_SHORTCUT_GROUPS,
} from '../registerShortcuts';

/**
 * The register's one keyboard rule, held to account: a bare letter searches,
 * a letter with a modifier never does, and the search behaves the way every
 * other list in the world behaves.
 *
 * Every payee below is invented — this repo is public.
 */

const ROWS = [
  { description: 'Sainsburys Local' },
  { description: 'Shell Garage' },
  { description: 'Council Tax' },
  { description: 'Sainsburys Superstore' },
  { description: '  Spotify  ' },
];

describe('type-ahead — which keys it claims', () => {
  it('claims a bare letter or digit', () => {
    for (const key of ['a', 'Z', '7', 'é', 'ß']) {
      expect(isTypeAheadKey({ key, ctrlKey: false, metaKey: false, altKey: false })).toBe(true);
    }
  });

  it('never claims one with a modifier held — that is a command', () => {
    expect(isTypeAheadKey({ key: 'd', ctrlKey: true, metaKey: false, altKey: false })).toBe(false);
    expect(isTypeAheadKey({ key: 'd', ctrlKey: false, metaKey: true, altKey: false })).toBe(false);
    expect(isTypeAheadKey({ key: 'd', ctrlKey: false, metaKey: false, altKey: true })).toBe(false);
  });

  it('leaves the named keys and the punctuation commands alone', () => {
    for (const key of ['Enter', 'ArrowDown', 'F2', 'Escape', ' ', '?', '+', '=']) {
      expect(isTypeAheadKey({ key, ctrlKey: false, metaKey: false, altKey: false })).toBe(false);
    }
  });
});

describe('type-ahead — the search string', () => {
  it('builds up while the typing continues, in lower case', () => {
    let buffer = advanceTypeAheadBuffer('', 'S', 0);
    buffer = advanceTypeAheadBuffer(buffer, 'A', 120);
    buffer = advanceTypeAheadBuffer(buffer, 'i', 90);
    expect(buffer).toBe('sai');
  });

  it('starts again after a pause, so yesterday cannot narrow today', () => {
    expect(advanceTypeAheadBuffer('sai', 'c', TYPE_AHEAD_RESET_MS)).toBe('c');
    expect(advanceTypeAheadBuffer('sai', 'c', TYPE_AHEAD_RESET_MS - 1)).toBe('saic');
  });
});

describe('the space bar — search, or reconcile?', () => {
  it('belongs to a search that is under way, so two-word payees are findable', () => {
    expect(claimsSpaceForTypeAhead('sandpiper', 120)).toBe(true);
  });

  it('reconciles when no search is running', () => {
    expect(claimsSpaceForTypeAhead('', 0)).toBe(false);
  });

  it('reconciles again once the search has gone cold', () => {
    // The safe way round: at worst a search eats a space and nothing happens
    // until it times out. The other way round would tick the R column on a row
    // the user never chose, half-way through typing a name.
    expect(claimsSpaceForTypeAhead('sandpiper', TYPE_AHEAD_RESET_MS)).toBe(false);
    expect(claimsSpaceForTypeAhead('sandpiper', TYPE_AHEAD_RESET_MS - 1)).toBe(true);
  });
});

describe('type-ahead — where it lands', () => {
  it('jumps to the next row whose description starts with what was typed', () => {
    expect(findTypeAheadMatch(ROWS, 'co', -1)).toBe(2);
  });

  it('ignores leading whitespace in a description', () => {
    expect(findTypeAheadMatch(ROWS, 'spo', -1)).toBe(4);
  });

  it('cycles through every payee sharing a first letter when that letter is repeated', () => {
    // s → Sainsburys Local, s again → Shell, again → Sainsburys Superstore…
    expect(findTypeAheadMatch(ROWS, 's', -1)).toBe(0);
    expect(findTypeAheadMatch(ROWS, 'ss', 0)).toBe(1);
    expect(findTypeAheadMatch(ROWS, 'sss', 1)).toBe(3);
    // …and round the end of the list back to the top.
    expect(findTypeAheadMatch(ROWS, 'ssss', 4)).toBe(0);
  });

  it('narrows without leaving the row it already landed on', () => {
    // "s" lands on row 0; adding "a" must NOT skip to the second Sainsburys.
    expect(findTypeAheadMatch(ROWS, 'sa', 0)).toBe(0);
  });

  it('wraps rather than stopping dead at the foot of the register', () => {
    expect(findTypeAheadMatch(ROWS, 'c', 4)).toBe(2);
  });

  it('says so plainly when nothing matches', () => {
    expect(findTypeAheadMatch(ROWS, 'zzz', -1)).toBe(-1);
    expect(findTypeAheadMatch([], 'a', -1)).toBe(-1);
    expect(findTypeAheadMatch(ROWS, '', -1)).toBe(-1);
  });
});

describe('how the keys are printed', () => {
  it('says ⌘ on a Mac keyboard and Ctrl everywhere else', () => {
    expect(isAppleKeyboard('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(true);
    expect(isAppleKeyboard('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false);
    expect(printableKeys(['Mod', 'D'], true)).toEqual(['⌘', 'D']);
    expect(printableKeys(['Mod', 'D'], false)).toEqual(['Ctrl', 'D']);
    expect(printableKeys(['Shift', '↑'], true)).toEqual(['Shift', '↑']);
  });
});

describe('the printed list', () => {
  it('names no shortcut the browser would keep for itself', () => {
    // Ctrl/Cmd + N, T and W are reserved in Chrome, Firefox and Safari alike:
    // a page cannot have them, so the list must never promise them.
    const reserved = ['N', 'T', 'W'];
    for (const group of REGISTER_SHORTCUT_GROUPS) {
      for (const shortcut of group.shortcuts) {
        for (const keys of [shortcut.keys, shortcut.alsoKeys ?? []]) {
          if (!keys.includes('Mod')) continue;
          expect(keys.some(key => reserved.includes(key))).toBe(false);
        }
      }
    }
  });

  it('explains every entry — a key with no consequence beside it teaches nothing', () => {
    for (const group of REGISTER_SHORTCUT_GROUPS) {
      expect(group.title.length).toBeGreaterThan(0);
      expect(group.shortcuts.length).toBeGreaterThan(0);
      for (const shortcut of group.shortcuts) {
        expect(shortcut.keys.length).toBeGreaterThan(0);
        expect(shortcut.what.trim().length).toBeGreaterThan(10);
      }
    }
  });
});
