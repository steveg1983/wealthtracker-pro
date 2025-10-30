import { createAppStore } from '@/store';
import type { AppStore, RootPreloadedState } from '@/store';

export const createTestStore = (
  preloadedState?: RootPreloadedState,
): AppStore => createAppStore(preloadedState);

export type TestStore = ReturnType<typeof createTestStore>;
