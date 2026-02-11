import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import ProtectedRoute, { isAuthBypassRuntimeAllowed } from './ProtectedRoute';

const { mockAuthState } = vi.hoisted(() => ({
  mockAuthState: {
    isLoaded: true,
    isSignedIn: true
  }
}));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => mockAuthState
}));

const renderProtectedRoute = (initialPath: string) => {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/"
          element={<div>Public Home</div>}
        />
        <Route
          path="/settings/data"
          element={(
            <ProtectedRoute>
              <div>Protected Content</div>
            </ProtectedRoute>
          )}
        />
      </Routes>
    </MemoryRouter>
  );
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.isLoaded = true;
    mockAuthState.isSignedIn = true;
    window.localStorage.removeItem('isTestMode');
    window.sessionStorage.clear();
  });

  it('renders protected content when user is signed in', () => {
    mockAuthState.isLoaded = true;
    mockAuthState.isSignedIn = true;

    renderProtectedRoute('/settings/data');

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects unauthenticated users to fallback route by default', () => {
    mockAuthState.isLoaded = true;
    mockAuthState.isSignedIn = false;

    renderProtectedRoute('/settings/data');

    expect(screen.getByText('Public Home')).toBeInTheDocument();
    expect(window.sessionStorage.getItem('redirectAfterLogin')).toBe('/settings/data');
  });

  it('allows test-mode bypass in test runtime when query flag is present', () => {
    mockAuthState.isLoaded = true;
    mockAuthState.isSignedIn = false;

    renderProtectedRoute('/settings/data?testMode=true');

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});

describe('isAuthBypassRuntimeAllowed', () => {
  it('returns false for production env', () => {
    expect(isAuthBypassRuntimeAllowed({ PROD: true, MODE: 'production', DEV: false })).toBe(false);
  });

  it('returns true for development env', () => {
    expect(isAuthBypassRuntimeAllowed({ PROD: false, MODE: 'development', DEV: true })).toBe(true);
  });

  it('returns true for test env', () => {
    expect(isAuthBypassRuntimeAllowed({ PROD: false, MODE: 'test', DEV: false })).toBe(true);
  });
});
