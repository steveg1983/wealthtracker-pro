/**
 * SETUP FOR THE DESKTOP MOUNT RUN — the shims, and deliberately nothing else.
 *
 * `src/test/setup.ts` is the app suite's, and it mocks three things this run
 * must not have mocked:
 *
 *   `@clerk/clerk-react`          nothing in a desktop build imports it, and a
 *                                 mock that answered would hide a leak;
 *   `contexts/AuthContext`        the same, one layer up;
 *   `contexts/AppContextSupabase` the SUBJECT. The whole point of this run is
 *                                 that the real state layer boots against a
 *                                 real `LocalDataPort` over the ledger's own
 *                                 wire protocol. Mocking it would leave a suite
 *                                 asserting that a mock renders.
 *
 * What it does keep is every browser shim, from the module both files share.
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { preferences } from '../services/preferencesService';
import { forgetDeviceIdentity } from '../services/local/deviceIdentity';
import './browserShims';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  vi.clearAllMocks();
  // Both singletons that outlive a test the way a page reload does not: the
  // settings document, and the owner of the open ledger. `setup.ts` says why at
  // length; the reason is the same one and the modules are the same modules.
  preferences.detach();
  forgetDeviceIdentity();
});
