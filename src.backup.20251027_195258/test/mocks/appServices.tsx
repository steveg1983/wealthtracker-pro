import React from 'react';
import { vi } from 'vitest';

const mockClerkUser = {
  id: 'test-user-id',
  primaryEmailAddress: {
    emailAddress: 'test@example.com',
  },
};

export const mockOfflineService = {
  init: vi.fn().mockResolvedValue(undefined),
  getConflicts: vi.fn().mockResolvedValue([]),
  saveTransaction: vi.fn(),
  syncOfflineData: vi.fn(),
};

export const mockIndexedDBService = {
  init: vi.fn().mockResolvedValue(undefined),
  getAllKeys: vi.fn().mockResolvedValue([]),
  getItem: vi.fn().mockResolvedValue(undefined),
  put: vi.fn().mockResolvedValue(undefined),
  putBulk: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
  close: vi.fn(),
};

vi.mock('@clerk/clerk-react', () => ({
  UserButton: () => <div data-testid="user-button" />,
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useUser: () => ({
    user: mockClerkUser,
    isLoaded: true,
    isSignedIn: true,
  }),
}));

vi.mock('@/components/RealtimeAlerts', () => ({ default: () => null }));

vi.mock('@/services/offlineService', () => ({
  offlineService: mockOfflineService,
}));

vi.mock('@/services/indexedDBService', () => ({
  indexedDBService: mockIndexedDBService,
  migrateFromLocalStorage: vi.fn().mockResolvedValue(undefined),
}));
