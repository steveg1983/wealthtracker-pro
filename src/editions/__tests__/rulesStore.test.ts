/**
 * CLOUD FOR THE MAIN APP, LOCAL FOR THE DOWNLOAD — pinned, because it is a
 * promise to two different users at once.
 *
 * The owner asked for it in those words on 28 Aug. What makes it true is that
 * the two halves of `editions/rulesStore.ts` give different answers while the
 * ENGINE that applies a rule stays one shared file — so a rule behaves
 * identically in both editions and only the cupboard differs.
 *
 * This suite runs under the cloud alias (vitest.config.ts). Its device twin is
 * the assertion below that the device half answers null, read directly rather
 * than through the specifier, so one file can hold both sides of the promise.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { defaultRulesStore as cloudStore } from '../cloud/rulesStore';
import { defaultRulesStore as deviceStore } from '../../desktop/editions/rulesStore';
import { userIdService } from '../../services/userIdService';

describe('where import rules live, per edition', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('the desktop download keeps them on the machine — there is no store to ask', () => {
    // Not a missing feature: a desktop window IS one device, so "follow me
    // between devices" solves a problem it does not have, and the ledger it
    // works on is a file on that machine.
    expect(deviceStore()).toBeNull();
  });

  it('the web app has no store either until somebody is signed in', () => {
    // A signed-out browser and a demo session both land here, and the service
    // treats it as ordinary rather than broken: rules stay local, exactly as
    // they always were.
    expect(cloudStore()).toBeNull();
  });

  it('the web app DOES hand back a real store once it knows who you are', () => {
    // Without this the suite would be three assertions that null is null —
    // true in the test environment whatever the cloud half did. Standing the
    // signed-in case up is what makes the pair meaningful.
    vi.spyOn(userIdService, 'getCurrentDatabaseUserId').mockReturnValue('user-1');

    const store = cloudStore();

    expect(store).not.toBeNull();
    expect(Object.keys(store!).sort()).toEqual(['insert', 'list', 'remove', 'update']);
  });

  it('and the desktop still does not, however signed in the machine looks', () => {
    // The device half asks nothing about identity, so nothing about identity
    // can change its answer. This is the promise: no cloud, by construction.
    vi.spyOn(userIdService, 'getCurrentDatabaseUserId').mockReturnValue('user-1');

    expect(deviceStore()).toBeNull();
  });

});
