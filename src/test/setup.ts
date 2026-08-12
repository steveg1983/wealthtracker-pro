import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, vi } from 'vitest';
import { preferences } from '../services/preferencesService';
import { forgetDeviceIdentity } from '../services/local/deviceIdentity';

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ user: null, isLoaded: true }),
  useAuth: () => ({ signOut: vi.fn(), getToken: vi.fn() }),
  useSession: () => ({ session: null }),
}));

vi.mock('@/contexts/AuthContext', () => {
  const mockValue = {
    user: null,
    isLoading: false,
    isAuthenticated: false,
    securityScore: 0,
    securityRecommendations: [],
    signOut: vi.fn(),
    refreshSession: vi.fn(),
  };

  const AuthContext = React.createContext(mockValue);

  const AuthProvider = ({ children }: { children: React.ReactNode }) =>
    React.createElement(AuthContext.Provider, { value: mockValue }, children);

  const useAuth = () => mockValue;

  const useRequireAuth = () => ({
    isAuthenticated: mockValue.isAuthenticated,
    isLoading: mockValue.isLoading,
  });

  const usePremiumFeatures = () => ({
    hasPasskey: false,
    hasMFA: false,
    hasEnhancedSecurity: false,
  });

  return {
    AuthProvider,
    useAuth,
    useRequireAuth,
    usePremiumFeatures,
  };
});

vi.mock('../contexts/AppContextSupabase', async () => {
  return await import('../test/mocks/AppContextSupabase');
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  // Empty the preferences document too.
  //
  // A tier of settings that used to live in `localStorage` — pinned accounts,
  // per-surface periods, grouping and sort choices, hidden register columns,
  // archive cutoffs — now lives in a module-level service so that it can travel
  // with the account (services/preferencesService). That service outlives an
  // individual test the way a page reload does not, so without this a value set
  // in one case would still be there in the next, and a suite's own
  // `localStorage.clear()` would no longer mean "start from nothing".
  //
  // `detach` is the app's own sign-out path, not a test-only hatch: it forgets
  // the signed-in user and everything held for them.
  preferences.detach();

  // And the device edition's own identity, for exactly the same reason one
  // paragraph up. `services/local/deviceIdentity` holds the owner of the open
  // ledger file in module scope — deliberately, because the callers are
  // `useState` initialisers scattered across the app — so a case that opened a
  // document would otherwise answer the NEXT case's "whose ledger is this?".
  // `forgetDeviceIdentity` is the app's own `close_ledger` path, not a hatch.
  forgetDeviceIdentity();
});

// Every browser API jsdom does not have. Shared with the desktop mount run,
// which needs all of them and none of the mocks above — see browserShims.ts.
import './browserShims';
