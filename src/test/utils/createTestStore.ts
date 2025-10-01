import type { PreloadedState } from '@reduxjs/toolkit';
import { createAppStore } from '../../store';
import type { AppStore, RootState } from '../../store';

/**
 * Creates a configured Redux store instance for tests.
 * Accepts optional preloaded state so tests can start from a known baseline.
 */
export const createTestStore = (
  preloadedState?: PreloadedState<RootState>
): AppStore => {
  return createAppStore(preloadedState);
};

export type TestStore = ReturnType<typeof createTestStore>;
