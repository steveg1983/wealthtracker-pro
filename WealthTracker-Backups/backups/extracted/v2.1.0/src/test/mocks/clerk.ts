/**
 * Clerk Mock for Testing
 * Provides mock implementations for Clerk authentication
 */

import { vi } from 'vitest';
import React from 'react';

// Mock user object
export const mockUser = {
  id: 'user_test_123',
  primaryEmailAddress: {
    emailAddress: 'test@example.com',
  },
  firstName: 'Test',
  lastName: 'User',
  fullName: 'Test User',
  username: 'testuser',
  imageUrl: 'https://example.com/avatar.jpg',
};

// Mock session object
export const mockSession = {
  id: 'session_test_123',
  user: mockUser,
  status: 'active',
  lastActiveAt: new Date(),
  expireAt: new Date(Date.now() + 86400000), // 24 hours from now
};

// Mock Clerk hooks
export const useAuth = vi.fn(() => ({
  isLoaded: true,
  isSignedIn: true,
  userId: mockUser.id,
  sessionId: mockSession.id,
  signOut: vi.fn(),
  getToken: vi.fn(() => Promise.resolve('mock-token')),
}));

export const useUser = vi.fn(() => ({
  isLoaded: true,
  isSignedIn: true,
  user: mockUser,
}));

export const useSession = vi.fn(() => ({
  isLoaded: true,
  isSignedIn: true,
  session: mockSession,
}));

export const useClerk = vi.fn(() => ({
  loaded: true,
  client: {
    signIn: {
      create: vi.fn(),
    },
    signUp: {
      create: vi.fn(),
    },
    signOut: vi.fn(),
  },
  setActive: vi.fn(),
  session: mockSession,
  user: mockUser,
}));

// Mock Clerk components
export const SignIn = vi.fn(({ children }: any) => 
  React.createElement('div', { 'data-testid': 'clerk-sign-in' }, children)
);

export const SignUp = vi.fn(({ children }: any) => 
  React.createElement('div', { 'data-testid': 'clerk-sign-up' }, children)
);

export const UserButton = vi.fn(() => 
  React.createElement('div', { 'data-testid': 'clerk-user-button' })
);

export const ClerkProvider = vi.fn(({ children }: any) => 
  React.createElement('div', { 'data-testid': 'clerk-provider' }, children)
);

export const SignedIn = vi.fn(({ children }: any) => children);
export const SignedOut = vi.fn(() => null);
export const RedirectToSignIn = vi.fn(() => null);

// Mock the Clerk module
vi.mock('@clerk/clerk-react', () => ({
  useAuth,
  useUser,
  useSession,
  useClerk,
  SignIn,
  SignUp,
  UserButton,
  ClerkProvider,
  SignedIn,
  SignedOut,
  RedirectToSignIn,
}));