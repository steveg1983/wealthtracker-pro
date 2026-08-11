/**
 * The desktop's choosing line, and the one rule it rests on.
 *
 * `deviceDataPort.ts` is a single statement — `export const dataPort: DataPort =
 * requireDeviceDocument().port` — and that statement is a BET: that nothing
 * imports the application's data door before a ledger has been opened. The bet
 * is what buys the edition its simplicity. Without it the module would have to
 * be fifty-six forwarding methods around an engine that might not exist yet.
 *
 * So the bet is tested from both sides. Imported with a ledger open, it answers
 * with that ledger's port, the same object, not a copy. Imported without one, it
 * REFUSES — loudly, at the import, with a sentence that names the ordering rule
 * — rather than resolving to something empty that would make every screen in the
 * window report a ledger with no accounts in it.
 *
 * ── WHY EVERY IMPORT HERE IS DYNAMIC, INCLUDING THE SETUP ───────────────────
 *
 * Because the thing under test is what happens AT import, and a static import
 * happens once, before any test body runs. `vi.resetModules()` between cases is
 * what lets the module be evaluated twice against two different states of the
 * world, which is the only way the two sides of the bet can both be checked.
 *
 * The consequence is that `deviceDocument` has to be imported dynamically too,
 * AFTER the same reset: a reset registry gives the next dynamic import a fresh
 * copy of every module in its graph, so a statically-imported
 * `openDeviceDocument` would be filing its document into a different instance
 * of the module than the one the door then reads. That is not a wrinkle of the
 * test — it is the module-scope state being genuinely module-scope, and getting
 * it wrong here would have produced a test that passed for the wrong reason.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Invoke } from '../coreTransport';
import type { DeviceDocument } from '../deviceDocument';

const OWNER = '11111111-2222-4333-8444-555555555555';

/** A shell that never answers. Nothing here asks it anything. */
const silentShell: Invoke = () => new Promise(() => {});

/** Open a ledger in the CURRENT module registry. See the header. */
const open = async (owner: string, at: string): Promise<DeviceDocument> => {
  const { openDeviceDocument } = await import('../deviceDocument');
  return openDeviceDocument({ ledger: { owner, path: at }, invoke: silentShell });
};

beforeEach(() => {
  vi.resetModules();
});

afterEach(async () => {
  // The registry the case just used, emptied — this is module state, and a
  // suite that left one case's ledger standing would be a suite in which the
  // next case read the previous case's file.
  const { forgetDeviceDocument } = await import('../deviceDocument');
  const { forgetDeviceIdentity } = await import('../deviceIdentity');
  forgetDeviceDocument();
  forgetDeviceIdentity();
});

describe('the device edition’s data door', () => {
  it('is the port of the ledger this window has open', async () => {
    const document = await open(OWNER, '/tmp/one.wealth');

    const { dataPort } = await import('../deviceDataPort');

    // The same object, not an equivalent one: a copy would be a second engine
    // holding a second view of one file, and the two would disagree the first
    // time either cached anything.
    expect(dataPort).toBe(document.port);
  });

  it('says which edition it is, because that is what the app asks it', async () => {
    await open(OWNER, '/tmp/one.wealth');

    const { dataPort } = await import('../deviceDataPort');
    const capabilities = dataPort.capabilities();

    // Not an assertion about LocalDataPort — that is its own suite's job. It is
    // an assertion that what came through the door is the DEVICE engine, which
    // is the only thing this module is for.
    expect(capabilities.edition).toBe('device');
    expect(capabilities.backupTarget).toBe('device');
  });

  it('refuses to be imported before a ledger is open, and says why', async () => {
    // The ordering rule of the desktop mount. The failure this prevents is not
    // an exception — it is the ABSENCE of one: a port bound to nothing, and a
    // window of screens each reporting an empty ledger.
    await expect(import('../deviceDataPort')).rejects.toThrow(/No ledger is open in this window/);
  });

  it('names where the order is kept, so the sentence is actionable', async () => {
    await expect(import('../deviceDataPort')).rejects.toThrow(/src\/desktop\/main\.tsx/);
  });

  it('follows the window to a second ledger', async () => {
    // Opening another file replaces the document, the way it replaces the
    // identity and the way the shell's mutex replaces the connection. A door
    // that kept answering with the first one would be a window showing a ledger
    // that is no longer open — and, because the port carries the owner on every
    // verb, would be asking the second file for the first file's rows.
    await open(OWNER, '/tmp/one.wealth');
    const second = await open('99999999-8888-4777-8666-555555555555', '/tmp/two.wealth');

    const { dataPort } = await import('../deviceDataPort');

    expect(dataPort).toBe(second.port);
  });
});
