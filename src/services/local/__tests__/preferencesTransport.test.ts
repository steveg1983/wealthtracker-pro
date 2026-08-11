/**
 * The settings store, on a device — the third implementation of
 * `PreferencesTransport`, checked at the seam rather than through a file.
 *
 * The FILE half is proved twice elsewhere and neither place can prove this half:
 * `crates/wealth-core/tests/preferences.rs` opens a real ledger and closes it
 * again, and `scripts/local-sqlite/verb-specs/preferences-*` runs the same
 * payload against the cloud's own writer. What is here is the translation
 * between them — which verb is sent, in whose name, and what `null` means on the
 * way back — and one rule that lives nowhere else at all: this transport
 * REFUSES a user id that is not the open file's owner.
 */

import { describe, expect, it } from 'vitest';
import { localPreferencesTransport } from '../preferencesTransport';
import type { CoreTransport } from '../coreTransport';

const OWNER = '11111111-1111-1111-1111-111111111111';
const SOMEBODY_ELSE = '22222222-2222-2222-2222-222222222222';

/** A ledger that answers whatever it is told to, and remembers every question. */
const ledger = (
  answers: Record<string, unknown> = {}
): CoreTransport & { asked: { verb: string; payload: unknown }[] } => {
  const asked: { verb: string; payload: unknown }[] = [];
  return {
    asked,
    async call(verb: string, payload: unknown): Promise<unknown> {
      asked.push({ verb, payload });
      if (verb in answers) return answers[verb];
      return { answer: { preferences: null } };
    }
  };
};

describe('reading a device’s settings', () => {
  it('asks the file, in the file’s own name', async () => {
    const transport = ledger({
      read_preferences: { answer: { preferences: { version: 1, values: { theme: 'dark' } } } }
    });

    const document = await localPreferencesTransport({ owner: OWNER, transport }).read(OWNER);

    expect(transport.asked).toEqual([
      { verb: 'read_preferences', payload: { user_id: OWNER } }
    ]);
    expect(document).toEqual({ version: 1, values: { theme: 'dark' } });
  });

  it('answers null for a file that holds no document, and null is not empty', async () => {
    // `PreferencesService.attach` branches on exactly this. A transport that
    // flattened the two would either lose somebody's settings or lift a stale
    // machine's over a fresh file's.
    const transport = ledger({ read_preferences: { answer: { preferences: null } } });

    const document = await localPreferencesTransport({ owner: OWNER, transport }).read(OWNER);

    expect(document).toBeNull();
  });

  it('parses the document rather than trusting it', async () => {
    // `parsePreferencesDocument`'s two rules, reaching this engine: a `values`
    // entry that is not a string is DROPPED (nothing can consume it, and a later
    // write would echo the shape back into the file), and an unrecognised
    // VERSION is KEPT (it is a newer client's document, and an older client must
    // hand it back unharmed). The crate stores the document opaquely and checks
    // neither, which is why this has to.
    const transport = ledger({
      read_preferences: {
        answer: { preferences: { version: 97, values: { good: 'yes', bad: { nested: true } } } }
      }
    });

    const document = await localPreferencesTransport({ owner: OWNER, transport }).read(OWNER);

    expect(document).toEqual({ version: 97, values: { good: 'yes' } });
  });

  it('treats a missing key as a fault, not as "no settings"', async () => {
    // The one wrong reading that causes damage: `undefined` reported as an
    // absence would trigger the lift, which writes this window's document into
    // the file over whatever was really there.
    const transport = ledger({ read_preferences: { answer: {} } });

    await expect(
      localPreferencesTransport({ owner: OWNER, transport }).read(OWNER)
    ).rejects.toThrow(/did not say whether read_preferences found a document/);
  });

  it('treats an answer that is not an envelope as a fault', async () => {
    const transport = ledger({ read_preferences: { nothing: 'useful' } });

    await expect(
      localPreferencesTransport({ owner: OWNER, transport }).read(OWNER)
    ).rejects.toThrow(/answered read_preferences without a answer/);
  });
});

describe('writing a device’s settings', () => {
  it('sends the whole document, under the file’s owner', async () => {
    const transport = ledger();
    const document = { version: 1, values: { theme: 'dark', currency: 'GBP' } };

    await localPreferencesTransport({ owner: OWNER, transport }).write(OWNER, document);

    expect(transport.asked).toEqual([
      { verb: 'write_preferences', payload: { user_id: OWNER, preferences: document } }
    ]);
  });

  it('lets the ledger’s own refusal reach the caller unchanged', async () => {
    // Seam rule 4 reaches down here too: the crate wrote that sentence for a
    // person, and `PreferencesService.write` logs it while `restoreBackup`
    // prints it. Re-wording it would put this module's words in front of the
    // ledger's.
    const refusing: CoreTransport = {
      async call(): Promise<unknown> {
        throw new Error('CHECK constraint failed: user_preferences_prefs_is_small');
      }
    };

    await expect(
      localPreferencesTransport({ owner: OWNER, transport: refusing }).write(OWNER, {
        version: 1,
        values: {}
      })
    ).rejects.toThrow('CHECK constraint failed: user_preferences_prefs_is_small');
  });
});

describe('whose settings these are', () => {
  it('refuses to read another login’s settings out of this file', async () => {
    // A file can hold a second login's rows — a restored backup from an account
    // that had two — and there is no RLS to narrow an answer afterwards. Passing
    // the id through would answer `null` for a login the file does not hold,
    // which `attach` reads as "no settings yet".
    const transport = ledger();

    await expect(
      localPreferencesTransport({ owner: OWNER, transport }).read(SOMEBODY_ELSE)
    ).rejects.toThrow(/belong to 22222222.*this ledger is 11111111/);
    expect(transport.asked).toEqual([]);
  });

  it('refuses to write another login’s settings into this file', async () => {
    // The other direction, and the one that does the damage: the lift would
    // write this window's whole document into the file under an id the file does
    // not hold. The foreign key would refuse it at a moment nobody is watching,
    // and the person's settings would silently stop being saved.
    const transport = ledger();

    await expect(
      localPreferencesTransport({ owner: OWNER, transport }).write(SOMEBODY_ELSE, {
        version: 1,
        values: { theme: 'dark' }
      })
    ).rejects.toThrow(/Nothing was read or written/);
    expect(transport.asked).toEqual([]);
  });

  it('never sends the id it was given, only the one the file was opened as', async () => {
    // Belt and braces on the refusal above: even for the owner itself, the
    // payload's `user_id` comes from the DOCUMENT rather than from the argument,
    // so there is no path by which a caller's id reaches the file.
    const transport = ledger();

    await localPreferencesTransport({ owner: OWNER, transport }).read(OWNER);

    expect(transport.asked[0].payload).toEqual({ user_id: OWNER });
  });
});
