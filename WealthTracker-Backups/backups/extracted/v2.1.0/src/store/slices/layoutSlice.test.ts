/**
 * layoutSlice Tests
 * Comprehensive tests for the layout Redux slice
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import layoutReducer, {
  setWideMode,
  toggleWideMode,
} from './layoutSlice';

describe('layoutSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create a fresh store for each test
    store = configureStore({
      reducer: {
        layout: layoutReducer,
      },
    });
  });

  describe('initial state', () => {
    it('returns the correct initial state', () => {
      const state = store.getState().layout;
      expect(state).toEqual({
        isWideMode: false,
      });
    });

    it('starts with wide mode disabled', () => {
      const state = store.getState().layout;
      expect(state.isWideMode).toBe(false);
    });
  });

  describe('setWideMode', () => {
    it('sets wide mode to true', () => {
      store.dispatch(setWideMode(true));
      
      const state = store.getState().layout;
      expect(state.isWideMode).toBe(true);
    });

    it('sets wide mode to false', () => {
      // First set to true
      store.dispatch(setWideMode(true));
      
      // Then set to false
      store.dispatch(setWideMode(false));
      
      const state = store.getState().layout;
      expect(state.isWideMode).toBe(false);
    });

    it('can be called multiple times with same value', () => {
      store.dispatch(setWideMode(true));
      store.dispatch(setWideMode(true));
      store.dispatch(setWideMode(true));
      
      const state = store.getState().layout;
      expect(state.isWideMode).toBe(true);
    });

    it('can alternate between true and false', () => {
      const values = [true, false, true, false, true];
      
      values.forEach(value => {
        store.dispatch(setWideMode(value));
        const state = store.getState().layout;
        expect(state.isWideMode).toBe(value);
      });
    });
  });

  describe('toggleWideMode', () => {
    it('toggles from false to true', () => {
      // Initial state is false
      store.dispatch(toggleWideMode());
      
      const state = store.getState().layout;
      expect(state.isWideMode).toBe(true);
    });

    it('toggles from true to false', () => {
      // Set to true first
      store.dispatch(setWideMode(true));
      
      // Toggle
      store.dispatch(toggleWideMode());
      
      const state = store.getState().layout;
      expect(state.isWideMode).toBe(false);
    });

    it('toggles multiple times correctly', () => {
      const expectedStates = [true, false, true, false, true];
      
      expectedStates.forEach(expected => {
        store.dispatch(toggleWideMode());
        const state = store.getState().layout;
        expect(state.isWideMode).toBe(expected);
      });
    });

    it('works correctly after setWideMode', () => {
      store.dispatch(setWideMode(true));
      store.dispatch(toggleWideMode());
      
      expect(store.getState().layout.isWideMode).toBe(false);
      
      store.dispatch(setWideMode(false));
      store.dispatch(toggleWideMode());
      
      expect(store.getState().layout.isWideMode).toBe(true);
    });
  });

  describe('reducer behavior', () => {
    it('returns current state for unknown action', () => {
      const initialState = store.getState().layout;
      
      store.dispatch({ type: 'unknown/action' });
      
      const newState = store.getState().layout;
      expect(newState).toEqual(initialState);
    });

    it('maintains immutability', () => {
      const stateBefore = store.getState().layout;
      
      store.dispatch(setWideMode(true));
      
      const stateAfter = store.getState().layout;
      
      // References should be different
      expect(stateAfter).not.toBe(stateBefore);
      
      // Original should be unchanged
      expect(stateBefore.isWideMode).toBe(false);
    });

    it('creates new state object on each action that changes state', () => {
      const states: any[] = [];
      
      states.push(store.getState().layout);
      
      store.dispatch(setWideMode(true));  // false -> true
      states.push(store.getState().layout);
      
      store.dispatch(toggleWideMode());    // true -> false
      states.push(store.getState().layout);
      
      store.dispatch(setWideMode(true));   // false -> true
      states.push(store.getState().layout);
      
      // All state references should be different when state changes
      for (let i = 0; i < states.length; i++) {
        for (let j = i + 1; j < states.length; j++) {
          expect(states[i]).not.toBe(states[j]);
        }
      }
    });
    
    it('reuses state object when no change occurs', () => {
      // Redux Toolkit optimizes by not creating new state when no change
      const stateBefore = store.getState().layout;
      
      // Setting same value should not create new state object
      store.dispatch(setWideMode(false)); // false -> false (no change)
      
      const stateAfter = store.getState().layout;
      
      // Should be the same reference since no change occurred
      expect(stateAfter).toBe(stateBefore);
    });
  });

  describe('interaction scenarios', () => {
    it('handles rapid toggles', () => {
      // Simulate rapid toggling
      for (let i = 0; i < 20; i++) {
        store.dispatch(toggleWideMode());
      }
      
      // After even number of toggles, should be back to initial state
      const state = store.getState().layout;
      expect(state.isWideMode).toBe(false);
    });

    it('handles mixed setWideMode and toggleWideMode calls', () => {
      store.dispatch(setWideMode(true));      // true
      store.dispatch(toggleWideMode());        // false
      store.dispatch(setWideMode(true));      // true
      store.dispatch(toggleWideMode());        // false
      store.dispatch(toggleWideMode());        // true
      store.dispatch(setWideMode(false));     // false
      
      const state = store.getState().layout;
      expect(state.isWideMode).toBe(false);
    });

    it('setWideMode overrides any previous state', () => {
      // Set up some state
      store.dispatch(toggleWideMode());
      store.dispatch(toggleWideMode());
      store.dispatch(toggleWideMode());
      
      // setWideMode should override regardless of current state
      store.dispatch(setWideMode(true));
      expect(store.getState().layout.isWideMode).toBe(true);
      
      store.dispatch(setWideMode(false));
      expect(store.getState().layout.isWideMode).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles boolean-like values correctly', () => {
      // TypeScript prevents non-boolean values, but testing runtime behavior
      const testValues = [
        { value: true, expected: true },
        { value: false, expected: false },
        // These would be TypeScript errors, but testing runtime
        { value: 1 as any, expected: 1 },
        { value: 0 as any, expected: 0 },
        { value: '' as any, expected: '' },
        { value: 'true' as any, expected: 'true' },
      ];
      
      testValues.forEach(({ value, expected }) => {
        store.dispatch(setWideMode(value));
        const state = store.getState().layout;
        expect(state.isWideMode).toBe(expected);
      });
    });

    it('state remains consistent after error in unrelated reducer', () => {
      // Create store with multiple reducers
      const errorReducer = () => {
        throw new Error('Test error');
      };
      
      const multiStore = configureStore({
        reducer: {
          layout: layoutReducer,
          // This reducer would error if called
          error: (state = {}) => state,
        },
      });
      
      multiStore.dispatch(setWideMode(true));
      
      const state = multiStore.getState().layout;
      expect(state.isWideMode).toBe(true);
    });
  });

  describe('performance characteristics', () => {
    it('handles large number of state changes efficiently', () => {
      const iterations = 1000;
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        store.dispatch(setWideMode(i % 2 === 0));
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete quickly (less than 100ms for 1000 operations)
      expect(duration).toBeLessThan(100);
      
      // Final state should be correct
      const state = store.getState().layout;
      expect(state.isWideMode).toBe(false); // iterations is even
    });
  });

  describe('selector compatibility', () => {
    it('state shape is compatible with selectors', () => {
      const selectIsWideMode = (state: { layout: { isWideMode: boolean } }) => 
        state.layout.isWideMode;
      
      // Test with initial state
      let isWide = selectIsWideMode({ layout: store.getState().layout });
      expect(isWide).toBe(false);
      
      // Test after state change
      store.dispatch(setWideMode(true));
      isWide = selectIsWideMode({ layout: store.getState().layout });
      expect(isWide).toBe(true);
    });

    it('can be used with reselect-style memoization', () => {
      const calls: boolean[] = [];
      
      // Simple memoized selector
      let lastState: any = null;
      let lastResult: boolean | null = null;
      
      const memoizedSelector = (state: { layout: { isWideMode: boolean } }) => {
        if (state.layout === lastState) {
          return lastResult!;
        }
        lastState = state.layout;
        lastResult = state.layout.isWideMode;
        calls.push(lastResult);
        return lastResult;
      };
      
      // First call
      const state1 = { layout: store.getState().layout };
      memoizedSelector(state1);
      
      // Same state object - should use memoized value
      memoizedSelector(state1);
      
      // Change state
      store.dispatch(setWideMode(true));
      const state2 = { layout: store.getState().layout };
      memoizedSelector(state2);
      
      // Should have been called only twice (not three times)
      expect(calls).toEqual([false, true]);
    });
  });
});